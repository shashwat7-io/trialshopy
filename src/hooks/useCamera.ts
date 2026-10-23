import { useCallback, useEffect, useRef, useState } from 'react';
import type { CameraStatus } from '../types';

export interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  error: string | null;
  devices: MediaDeviceInfo[];
  activeDeviceId: string | null;
  startCamera: (deviceId?: string) => Promise<void>;
  stopCamera: () => void;
  switchCamera: (deviceId: string) => Promise<void>;
  capturePhoto: () => string | null;
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
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
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

  const capturePhoto = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.92);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { stopCamera(); }, [stopCamera]);

  return { videoRef, status, error, devices, activeDeviceId, startCamera, stopCamera, switchCamera, capturePhoto };
}
