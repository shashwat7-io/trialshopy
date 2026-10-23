import { useCallback, useEffect, useRef, useState } from 'react';
import type { CameraStatus } from '../types';

export interface CaptureOptions {
  cropPortrait?: boolean; // Crop to 3:4 ratio optimal for AI try-on models
  mirror?: boolean;       // Mirror horizontally to match the reflection
  enhance?: boolean;      // Auto-enhance contrast/lighting
  centerX?: number;       // Normalized X center (0-1) for intelligent framing
  centerY?: number;       // Normalized Y center (0-1)
}

export interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  error: string | null;
  devices: MediaDeviceInfo[];
  activeDeviceId: string | null;
  startCamera: (deviceId?: string) => Promise<void>;
  stopCamera: () => void;
  switchCamera: (deviceId: string) => Promise<void>;
  capturePhoto: (options?: CaptureOptions) => string | null;
}

export function useCamera(): UseCameraReturn {
  const videoRef   = useRef<HTMLVideoElement | null>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const [status,         setStatus]         = useState<CameraStatus>('idle');
  const [error,          setError]          = useState<string | null>(null);
  const [devices,        setDevices]        = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter(d => d.kind === 'videoinput'));
    } catch { /* ok */ }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('idle');
    setActiveDeviceId(null);
  }, []);

  const startCamera = useCallback(async (deviceId?: string) => {
    setStatus('requesting');
    setError(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1920, min: 1280 }, height: { ideal: 1080, min: 720 } }
          : { width: { ideal: 1920, min: 1280 }, height: { ideal: 1080, min: 720 }, facingMode: 'user' },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const track = stream.getVideoTracks()[0];
      setActiveDeviceId(track?.getSettings().deviceId ?? null);
      setStatus('active');
      await loadDevices();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Camera access failed';
      if (msg.includes('Permission') || msg.includes('NotAllowed') || msg.includes('denied')) {
        setStatus('denied');
        setError('Camera permission denied. Please allow camera access in your browser settings.');
      } else {
        setStatus('error');
        setError(msg);
      }
    }
  }, [loadDevices]);

  const switchCamera = useCallback(async (deviceId: string) => {
    stopCamera();
    await startCamera(deviceId);
  }, [stopCamera, startCamera]);

  /**
   * Optimized photo capture:
   * - Crops 16:9 webcam feeds into 3:4 portrait (768x1024 or higher) for diffusion try-on models
   * - Mirrors horizontally to match the natural mirror view the user posed in
   * - Applies subtle contrast and lighting enhancement to optimize AI input quality
   */
  const capturePhoto = useCallback((options: CaptureOptions = {}): string | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;

    const {
      cropPortrait = true,
      mirror = true,
      enhance = true,
      centerX = 0.5,
    } = options;

    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;

    let sx = 0, sy = 0, sw = vw, sh = vh;
    let outW = vw, outH = vh;

    if (cropPortrait) {
      // Ideal portrait ratio for VITON-HD / IDM-VTON is 3:4 (e.g. 768 x 1024)
      const targetAspect = 3 / 4;
      if (vw / vh > targetAspect) {
        // Landscape stream: crop width
        sw = Math.round(vh * targetAspect);
        sh = vh;
        // Bias crop around detected person center (clamped so it doesn't overflow)
        const desiredX = Math.round(vw * centerX - sw / 2);
        sx = Math.max(0, Math.min(vw - sw, desiredX));
        sy = 0;
      } else {
        // Taller stream: crop height
        sw = vw;
        sh = Math.round(vw / targetAspect);
        sx = 0;
        sy = Math.max(0, Math.min(vh - sh, Math.round(vh * 0.4 - sh / 2)));
      }
      // Target output resolution of at least 768x1024 for high quality diffusion
      outW = Math.max(768, Math.min(1080, sw));
      outH = Math.round(outW / targetAspect);
    }

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.save();

    // Horizontal mirror if user posed in mirror view
    if (mirror) {
      ctx.translate(outW, 0);
      ctx.scale(-1, 1);
    }

    // Auto-contrast & clarity filter for crisp portrait lighting
    if (enhance) {
      ctx.filter = 'contrast(1.05) saturate(1.04) brightness(1.02)';
    }

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH);
    ctx.restore();

    return canvas.toDataURL('image/jpeg', 0.95);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { stopCamera(); }, [stopCamera]);

  return { videoRef, status, error, devices, activeDeviceId, startCamera, stopCamera, switchCamera, capturePhoto };
}
