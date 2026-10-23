import { useCallback, useEffect, useRef, useState } from 'react';

export type PoseStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface Landmark {
  x: number;  // 0–1, normalised to image width
  y: number;  // 0–1, normalised to image height
  z: number;
  visibility?: number;
}

export interface UsePoseReturn {
  status: PoseStatus;
  detect: (video: HTMLVideoElement, ts: number) => Landmark[] | null;
}

let _poseLandmarker: any = null;
let _loadPromise: Promise<any> | null = null;

async function loadModel() {
  if (_poseLandmarker) return _poseLandmarker;
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    const vision = await import('@mediapipe/tasks-vision');
    const { PoseLandmarker, FilesetResolver } = vision;
    const wasmFileset = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );
    _poseLandmarker = await PoseLandmarker.createFromOptions(wasmFileset, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
    return _poseLandmarker;
  })();

  return _loadPromise;
}

export function usePoseDetection(): UsePoseReturn {
  const [status, setStatus] = useState<PoseStatus>('idle');
  const landmarkerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    loadModel()
      .then(lm => {
        if (cancelled) return;
        landmarkerRef.current = lm;
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => { cancelled = true; };
  }, []);

  const detect = useCallback((video: HTMLVideoElement, ts: number): Landmark[] | null => {
    const lm = landmarkerRef.current;
    if (!lm || video.readyState < 2) return null;
    try {
      const result = lm.detectForVideo(video, ts);
      if (result?.landmarks?.length > 0) {
        return result.landmarks[0] as Landmark[];
      }
    } catch { /* skip frame */ }
    return null;
  }, []);

  return { status, detect };
}
