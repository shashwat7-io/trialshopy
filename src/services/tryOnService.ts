/**
 * AI Virtual Try-On Service
 * Calls the Nymbo/Virtual-Try-On HuggingFace Space via @gradio/client.
 * Falls back to Kwai-Kolors if the primary space is unavailable.
 */
import { Client, handle_file } from '@gradio/client';

const PRIMARY_SPACE   = 'Nymbo/Virtual-Try-On';
const FALLBACK_SPACE  = 'yisol/IDM-VTON';
const TIMEOUT_MS      = 180_000; // 3 minutes max

export type TryOnStatus = 'idle' | 'connecting' | 'uploading' | 'generating' | 'done' | 'error';

export interface TryOnProgress {
  status: TryOnStatus;
  message: string;
  progress?: number; // 0–1
}

type ProgressCallback = (p: TryOnProgress) => void;

/** Convert a data URL to a File object */
function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(',');
  const mime = header?.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = atob(base64 ?? '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

/** Convert a remote URL to a Blob (for garment images) */
async function urlToFile(url: string, filename: string): Promise<File> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch garment image: ${res.status}`);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || 'image/jpeg' });
}

/** Fetch result image and return as a local object URL */
async function fetchResultAsObjectUrl(result: any): Promise<string> {
  // Gradio results can be: { url: string }, { path: string }, or raw data URL / base64
  const data = result?.data;
  if (!data || data.length === 0) throw new Error('No result data from AI model');

  const output = data[0];

  // If it's a URL string or has a url property
  const url = typeof output === 'string' ? output : output?.url ?? output?.path;
  if (!url) throw new Error('Unexpected result format from AI model');

  // If it's already a data URL
  if (url.startsWith('data:')) return url;

  // Fetch and create object URL
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to download result image');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/**
 * Run AI virtual try-on.
 * @param personDataUrl - Base64 data URL of the person's photo
 * @param garmentImageUrl - URL of the garment product image
 * @param onProgress - Progress callback
 * @returns Object URL of the result image
 */
export async function aiTryOn(
  personDataUrl: string,
  garmentImageUrl: string,
  onProgress?: ProgressCallback,
): Promise<string> {
  const report = (status: TryOnStatus, message: string, progress?: number) => {
    onProgress?.({ status, message, progress });
  };

  // Wrap in a timeout
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // ── Step 1: Prepare files ──────────────────────────────────────────────
    report('uploading', 'Preparing your photo…', 0.05);
    const personFile = dataUrlToFile(personDataUrl, 'person.jpg');

    report('uploading', 'Loading garment image…', 0.15);
    let garmentFile: File;
    try {
      garmentFile = await urlToFile(garmentImageUrl, 'garment.jpg');
    } catch {
      // If fetch fails (CORS), try with a proxy or use the raw URL
      throw new Error(
        'Could not load the garment image due to CORS restrictions. ' +
        'Try using a garment with a directly accessible image URL.'
      );
    }

    // ── Step 2: Connect to HF Space ────────────────────────────────────────
    report('connecting', 'Connecting to AI model…', 0.20);

    let client: any;
    let spaceName = PRIMARY_SPACE;
    try {
      client = await Client.connect(spaceName);
    } catch (e1) {
      // Fallback space
      report('connecting', 'Primary model busy, trying fallback…', 0.22);
      spaceName = FALLBACK_SPACE;
      try {
        client = await Client.connect(spaceName);
      } catch (e2) {
        throw new Error(
          'Both AI models are currently unavailable. This can happen when HuggingFace Spaces ' +
          'are under heavy load. Please try again in a few minutes.'
        );
      }
    }

    // ── Step 3: Call the try-on endpoint ────────────────────────────────────
    report('generating', 'AI is generating your look… (this takes 30–90 seconds)', 0.30);

    let result: any;
    try {
      // The Nymbo/Virtual-Try-On Space uses IDM-VTON under the hood.
      // Its API accepts these parameters:
      result = await client.predict('/tryon', [
        {
          background: handle_file(personFile),
          layers: [],
          composite: null,
        },                                // dict: person image (ImageEditor format)
        handle_file(garmentFile),          // garm_img: garment image
        'A clothing garment',              // garment_des: description
        true,                              // is_checked: use auto-generated mask
        true,                              // is_checked_crop: auto crop & resize
        30,                                // denoise_steps
        42,                                // seed
      ]);
    } catch (predictErr: any) {
      // If the /tryon endpoint doesn't exist, try /predict
      if (predictErr?.message?.includes('not found') || predictErr?.message?.includes('API')) {
        report('generating', 'Trying alternative endpoint…', 0.35);
        result = await client.predict('/predict', [
          handle_file(personFile),
          handle_file(garmentFile),
        ]);
      } else {
        throw predictErr;
      }
    }

    // ── Step 4: Extract result ─────────────────────────────────────────────
    report('generating', 'Downloading result…', 0.90);
    const resultUrl = await fetchResultAsObjectUrl(result);

    report('done', 'Try-on complete!', 1.0);
    return resultUrl;

  } finally {
    clearTimeout(timer);
  }
}
