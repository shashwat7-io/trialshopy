/**
 * AI Virtual Try-On Service
 * Connects to HuggingFace IDM-VTON spaces for photorealistic virtual try-on.
 * Uses Nymbo/Virtual-Try-On with fallback to yisol/IDM-VTON.
 */
import { Client, handle_file } from '@gradio/client';
import type { Garment } from '../types';

const PRIMARY_SPACE  = 'Nymbo/Virtual-Try-On';
const FALLBACK_SPACE = 'yisol/IDM-VTON';
const TIMEOUT_MS     = 180_000; // 3 minutes max

export type TryOnStatus = 'idle' | 'uploading' | 'connecting' | 'generating' | 'done' | 'error';

export interface TryOnProgress {
  status: TryOnStatus;
  message: string;
  progress?: number; // 0–1
}

type ProgressCallback = (p: TryOnProgress) => void;

export interface TryOnRequestOptions {
  garment: Garment;
  onProgress?: ProgressCallback;
}

/** Convert a data URL or remote URL to a clean Blob */
async function toBlob(source: string): Promise<Blob> {
  // If it's a data URL
  if (source.startsWith('data:')) {
    const parts = source.split(',');
    const mime = parts[0]?.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
    const b64 = parts[1] ?? '';
    const binary = atob(b64);
    const u8 = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) u8[i] = binary.charCodeAt(i);
    return new Blob([u8], { type: mime });
  }

  // If it's a remote URL
  try {
    const res = await fetch(source);
    if (res.ok) {
      return await res.blob();
    }
  } catch {
    // If direct fetch is blocked by CORS, load image via Image element and canvas
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 400;
      canvas.height = img.naturalHeight || 500;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context failed')); return; }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Could not convert image to blob'));
      }, 'image/jpeg', 0.95);
    };
    img.onerror = () => reject(new Error(`Failed to load image from ${source}`));
    img.src = source;
  });
}

/** Fetch result image from Gradio and return as an image URL */
async function extractResultUrl(result: any): Promise<string> {
  const data = result?.data;
  if (!data || data.length === 0) throw new Error('No result data returned from AI model');

  const output = data[0];
  const url = typeof output === 'string' ? output : output?.url ?? output?.path;
  if (!url) throw new Error('Unexpected result format from AI model');

  // If already a valid URL or data URL, return it directly
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }

  // If it's a relative path, try to fetch it
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to download result image from space');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/**
 * Run Photorealistic AI Virtual Try-On using IDM-VTON.
 */
export async function aiTryOn(
  personDataUrl: string,
  garmentImageUrl: string,
  onProgress?: ProgressCallback,
  options?: Partial<TryOnRequestOptions>,
): Promise<string> {
  const report = (status: TryOnStatus, message: string, progress?: number) => {
    onProgress?.({ status, message, progress });
  };

  const garmentName = options?.garment?.name ?? 'garment';
  const garmentCategory = options?.garment?.category ?? 'apparel';
  const promptDescription = `${garmentName}, high quality modern ${garmentCategory}, tailored fit, photorealistic fabric texture, studio lighting`;

  report('uploading', 'Preparing high-resolution portrait & garment…', 0.10);

  // Convert inputs to Blobs
  const [personBlob, garmentBlob] = await Promise.all([
    toBlob(personDataUrl),
    toBlob(garmentImageUrl),
  ]);

  report('connecting', 'Connecting to IDM-VTON AI model on HuggingFace…', 0.25);

  let client: any = null;
  let spaceUsed = PRIMARY_SPACE;

  try {
    client = await Client.connect(spaceUsed);
  } catch (err1) {
    console.warn(`Could not connect to ${PRIMARY_SPACE}, trying fallback ${FALLBACK_SPACE}…`, err1);
    report('connecting', 'Connecting to backup IDM-VTON space…', 0.30);
    spaceUsed = FALLBACK_SPACE;
    try {
      client = await Client.connect(spaceUsed);
    } catch (err2) {
      console.error('All AI try-on spaces unavailable:', err2);
      throw new Error(
        'The IDM-VTON AI servers are currently busy or under high traffic. Please wait a moment and click Try Again.'
      );
    }
  }

  report('generating', 'AI is synthesizing photorealistic fabric, folds & fit… (takes ~25–40s)', 0.45);

  let result: any;
  try {
    // Call the /tryon endpoint with auto-masking enabled
    result = await client.predict('/tryon', [
      {
        background: handle_file(personBlob),
        layers: [],
        composite: null,
      },
      handle_file(garmentBlob),
      promptDescription,
      true, // is_checked: auto-mask previous clothing
      true, // is_checked_crop: auto-align & crop
      30,   // denoise_steps
      42,   // seed
    ]);
  } catch (predictErr: any) {
    console.warn('/tryon failed, trying alternative /predict endpoint…', predictErr);
    report('generating', 'Processing via secondary model pipeline…', 0.60);
    try {
      result = await client.predict('/predict', [
        handle_file(personBlob),
        handle_file(garmentBlob),
      ]);
    } catch (err3: any) {
      console.error('AI Prediction error:', err3);
      throw new Error(
        predictErr?.message?.includes('queue')
          ? 'The AI model is in a high-demand queue. Please wait 30 seconds and try again.'
          : (predictErr?.message || 'AI try-on generation failed. Please try again.')
      );
    }
  }

  report('generating', 'Finalizing photorealistic output…', 0.95);
  const resultUrl = await extractResultUrl(result);

  report('done', 'AI Try-On complete!', 1.0);
  return resultUrl;
}
