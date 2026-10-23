import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera, CameraOff, FlipHorizontal, Loader, Sparkles, Video,
  Upload, UserCheck, Eye, EyeOff, RotateCcw, Image as ImageIcon
} from 'lucide-react';
import type { Garment } from '../types';
import type { UseCameraReturn } from '../hooks/useCamera';
import { usePoseDetection, type Landmark } from '../hooks/usePoseDetection';
import type { TryOnProgress } from '../services/tryOnService';

/* ── Studio Model Presets for Instant Testing ──────────────────────────────── */
export const STUDIO_MODELS = [
  {
    id: 'model-maya',
    name: 'Maya (Studio Portrait)',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=768&h=1024&fit=crop',
    gender: 'Female',
  },
  {
    id: 'model-alex',
    name: 'Alex (Casual Portrait)',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=768&h=1024&fit=crop',
    gender: 'Male',
  },
  {
    id: 'model-jordan',
    name: 'Jordan (Streetwear)',
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=768&h=1024&fit=crop',
    gender: 'Male',
  },
];

interface VirtualMirrorProps {
  camera: UseCameraReturn;
  selectedGarment: Garment | null;
  aiResultUrl: string | null;
  aiProgress: TryOnProgress | null;
  onClearAiResult: () => void;
  activePhotoUrl: string | null;
  onSelectPhotoUrl: (url: string | null) => void;
  countdown: number | null;
  isFlashing: boolean;
  onLandmarksUpdate?: (landmarks: Landmark[] | null) => void;
}

export default function VirtualMirror({
  camera,
  selectedGarment,
  aiResultUrl,
  aiProgress,
  onClearAiResult,
  activePhotoUrl,
  onSelectPhotoUrl,
  countdown,
  isFlashing,
  onLandmarksUpdate,
}: VirtualMirrorProps) {
  const { videoRef, status, error, devices, activeDeviceId, startCamera, stopCamera, switchCamera } = camera;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef    = useRef<number | null>(null);

  const [inputMode, setInputMode] = useState<'camera' | 'upload' | 'preset'>('camera');
  const [showGuide, setShowGuide] = useState(true);
  const [alignmentStatus, setAlignmentStatus] = useState<string>('Detecting posture…');
  const [alignmentState, setAlignmentState]   = useState<'good' | 'adjust' | 'waiting'>('waiting');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { status: poseStatus, detect } = usePoseDetection();

  // ── File upload handler ───────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onSelectPhotoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // ── Live camera mirror loop (CLEAN video: NO CLOTH OVERLAY ON USER BODY) ───
  useEffect(() => {
    if (status !== 'active' || activePhotoUrl) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let cancelled = false;
    let dimsSet = false;

    let poseTimer: ReturnType<typeof setInterval> | null = null;
    if (poseStatus === 'ready') {
      poseTimer = setInterval(() => {
        if (cancelled || video.readyState < 2) return;
        const lm = detect(video, performance.now());
        if (lm) {
          onLandmarksUpdate?.(lm);

          // Evaluate alignment
          const ls = lm[11], rs = lm[12];
          if (ls && rs && (ls.visibility ?? 1) > 0.4 && (rs.visibility ?? 1) > 0.4) {
            const shoulderDist = Math.hypot(rs.x - ls.x, rs.y - ls.y);
            const shoulderMidX = (ls.x + rs.x) / 2;

            if (shoulderDist < 0.16) {
              setAlignmentStatus('📐 Step closer or center torso');
              setAlignmentState('adjust');
            } else if (shoulderDist > 0.65) {
              setAlignmentStatus('📐 Step back slightly for full upper body');
              setAlignmentState('adjust');
            } else if (Math.abs(shoulderMidX - 0.5) > 0.18) {
              setAlignmentStatus('↔ Center yourself in frame');
              setAlignmentState('adjust');
            } else {
              setAlignmentStatus('✨ Perfect Posture & Alignment — Ready to Capture');
              setAlignmentState('good');
            }
          } else {
            setAlignmentStatus('👤 Align yourself inside the guide');
            setAlignmentState('waiting');
          }
        }
      }, 90);
    }

    const draw = () => {
      if (cancelled) return;
      if (video.readyState >= 2) {
        if (!dimsSet && video.videoWidth > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          dimsSet = true;
        }
        if (dimsSet) {
          const W = canvas.width, H = canvas.height;
          const ctx = canvas.getContext('2d')!;

          // Draw mirrored crisp video (Acts like a true mirror, NO unwanted cloth painted on body)
          ctx.save();
          ctx.translate(W, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, W, H);
          ctx.restore();
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelled = true;
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      if (poseTimer) clearInterval(poseTimer);
    };
  }, [status, poseStatus, detect, videoRef, activePhotoUrl, onLandmarksUpdate]);

  const otherDevices = devices.filter(d => d.deviceId !== activeDeviceId);
  const isGenerating = aiProgress && !['idle', 'done', 'error'].includes(aiProgress.status);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative select-none">
      {/* Top bar controls */}
      <div className="flex-none flex items-center justify-between px-4 py-2 border-b border-border bg-surface z-20">
        <div className="flex items-center gap-2">
          <Video size={13} className="text-muted" />
          <span className="text-[11px] font-semibold text-soft uppercase tracking-widest">Virtual Mirror</span>

          {/* Mode Tabs */}
          <div className="flex items-center bg-card border border-border rounded-lg p-0.5 ml-2">
            <button
              onClick={() => { setInputMode('camera'); onSelectPhotoUrl(null); }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                inputMode === 'camera' && !activePhotoUrl ? 'bg-accent text-white shadow-glow-sm' : 'text-muted hover:text-bright'
              }`}
            >
              <Camera size={10} /> Live Mirror
            </button>
            <button
              onClick={() => { setInputMode('upload'); fileInputRef.current?.click(); }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                inputMode === 'upload' || (activePhotoUrl && !STUDIO_MODELS.some(m => m.image === activePhotoUrl))
                  ? 'bg-accent text-white shadow-glow-sm'
                  : 'text-muted hover:text-bright'
              }`}
            >
              <Upload size={10} /> Upload Photo
            </button>
            <button
              onClick={() => {
                setInputMode('preset');
                if (!activePhotoUrl) onSelectPhotoUrl(STUDIO_MODELS[0].image);
              }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                inputMode === 'preset' ? 'bg-accent text-white shadow-glow-sm' : 'text-muted hover:text-bright'
              }`}
            >
              <ImageIcon size={10} /> Studio Models
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />

          {status === 'active' && !activePhotoUrl && (
            <span className="flex items-center gap-1 tag-live ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" /> LIVE
            </span>
          )}

          {aiResultUrl && (
            <span className="tag-ai"><Sparkles size={9} /> AI Generated</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Guide toggle button */}
          {status === 'active' && !activePhotoUrl && !aiResultUrl && (
            <button
              onClick={() => setShowGuide(prev => !prev)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-medium transition-all ${
                showGuide
                  ? 'bg-accent/20 border-accent/40 text-accent-light shadow-glow-sm'
                  : 'bg-card border-border text-muted hover:text-bright'
              }`}
              title="Toggle smart alignment guide"
            >
              {showGuide ? <Eye size={11} /> : <EyeOff size={11} />}
              Guide {showGuide ? 'ON' : 'OFF'}
            </button>
          )}

          {activePhotoUrl && !aiResultUrl && (
            <button
              onClick={() => onSelectPhotoUrl(null)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card border border-border text-muted hover:text-bright text-[10px] transition-all"
            >
              <RotateCcw size={11} /> Reset Photo
            </button>
          )}

          {aiResultUrl && (
            <button
              onClick={onClearAiResult}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/20 border border-accent/30 text-accent-light hover:bg-accent/30 text-[10px] font-medium transition-all"
            >
              ← Back to Mirror
            </button>
          )}

          {status === 'active' && otherDevices.length > 0 && !aiResultUrl && !activePhotoUrl && (
            <button
              onClick={() => switchCamera(otherDevices[0].deviceId)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-card border border-border text-muted hover:text-bright hover:border-accent/40 text-[10px] transition-all"
            >
              <FlipHorizontal size={11} /> Switch
            </button>
          )}

          {status === 'active' ? (
            <button
              onClick={stopCamera}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-950/60 border border-red-800/50 text-red-400 hover:text-red-300 text-[10px] transition-all"
            >
              <CameraOff size={11} /> Stop
            </button>
          ) : (
            <button
              onClick={() => { onSelectPhotoUrl(null); startCamera(); }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-accent/20 border border-accent/30 text-accent-light hover:bg-accent/30 text-[10px] transition-all"
            >
              <Camera size={11} /> Start Camera
            </button>
          )}
        </div>
      </div>

      {/* Main Mirror Area */}
      <div className="flex-1 relative bg-base flex items-center justify-center overflow-hidden">

        {/* ── CAMERA IDLE STATE ─────────────────────────────────────────── */}
        {status === 'idle' && !activePhotoUrl && (
          <div className="flex flex-col items-center gap-6 animate-fade-in text-center px-8 select-none z-10">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
                <Camera size={36} className="text-accent/60" />
              </div>
              <div className="absolute -inset-3 rounded-full border border-accent/10 animate-pulse-slow" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-bright mb-1">Your Virtual Try-On Mirror</h3>
              <p className="text-[12px] text-muted leading-relaxed max-w-sm">
                Clean, undisturbed mirror feed with smart framing assistance. Select a garment, strike a pose, and create your AI try-on photograph.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button onClick={() => startCamera()} className="btn-primary text-[12px] py-2">
                <Camera size={13} /> Start Camera
              </button>
              <button
                onClick={() => {
                  setInputMode('preset');
                  onSelectPhotoUrl(STUDIO_MODELS[0].image);
                }}
                className="btn-ghost text-[12px] py-2 gap-1.5"
              >
                <UserCheck size={13} /> Try Studio Model
              </button>
            </div>
          </div>
        )}

        {/* ── CAMERA REQUESTING / PERMISSION ───────────────────────────── */}
        {status === 'requesting' && (
          <div className="flex flex-col items-center gap-4 animate-fade-in text-center z-10">
            <div className="w-14 h-14 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
            <p className="text-[13px] text-muted">Requesting camera access…</p>
          </div>
        )}

        {/* Hidden video element feeding canvas */}
        <video
          ref={videoRef as React.RefObject<HTMLVideoElement>}
          autoPlay
          playsInline
          muted
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
          aria-hidden="true"
        />

        {/* ── LIVE MIRROR CANVAS (100% CLEAN VIDEO — NO BODY OVERLAYS) ─── */}
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full object-contain"
          style={{
            display: status === 'active' && !activePhotoUrl && !aiResultUrl ? 'block' : 'none',
            width: '100%',
            height: '100%',
          }}
          aria-label="Live camera mirror"
        />

        {/* ── STATIC PHOTO VIEW (UPLOADED / STUDIO MODEL / CAPTURED SNAPSHOT) ── */}
        {activePhotoUrl && !aiResultUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-base/90 p-4 animate-fade-in">
            <div className="relative max-w-full max-h-full rounded-2xl overflow-hidden border border-border shadow-2xl">
              <img
                src={activePhotoUrl}
                alt="Target try-on portrait"
                className="max-w-full max-h-[82vh] object-contain rounded-2xl"
              />
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full glass border border-white/20 text-[10px] text-bright font-medium backdrop-blur-md">
                <Sparkles size={11} className="text-accent-light" />
                Target Portrait Ready for Try-On
              </div>
            </div>
          </div>
        )}

        {/* ── STUDIO MODEL PRESET SELECTOR BAR ────────────────────────── */}
        {inputMode === 'preset' && !aiResultUrl && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 p-1.5 rounded-xl glass border border-border/80 shadow-card z-20 animate-fade-in">
            <span className="text-[10px] font-semibold text-muted px-2 uppercase tracking-wider">Models:</span>
            {STUDIO_MODELS.map(m => (
              <button
                key={m.id}
                onClick={() => onSelectPhotoUrl(m.image)}
                className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  activePhotoUrl === m.image
                    ? 'bg-accent text-white shadow-glow-sm'
                    : 'bg-card/70 hover:bg-card text-soft border border-border'
                }`}
              >
                <img src={m.image} alt={m.name} className="w-4 h-4 rounded-full object-cover" />
                {m.name.split(' ')[0]}
              </button>
            ))}
          </div>
        )}

        {/* ── SMART AR ALIGNMENT GUIDE OVERLAY (NON-INTRUSIVE) ─────────── */}
        {status === 'active' && !activePhotoUrl && !aiResultUrl && showGuide && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10 animate-fade-in">
            {/* 3:4 Framing Target Box */}
            <div
              className="relative rounded-3xl border border-accent/30 shadow-[0_0_30px_rgba(124,58,237,0.12)] transition-all duration-300"
              style={{
                width: 'min(72vh * 0.75, 84vw)',
                height: 'min(72vh, 90vw * 1.33)',
              }}
            >
              {/* Corner brackets */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-accent rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-accent rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-accent rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-accent rounded-br-lg" />

              {/* Elegant Head & Shoulder silhouette outline */}
              <svg className="w-full h-full opacity-35" viewBox="0 0 300 400" fill="none">
                {/* Head oval */}
                <ellipse cx="150" cy="115" rx="38" ry="48" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" className="text-accent-light" />
                {/* Neck & Shoulders drape curve */}
                <path
                  d="M 132 165 C 132 185 105 195 70 215 C 45 230 35 255 30 310 L 270 310 C 265 255 255 230 230 215 C 195 195 168 185 168 165"
                  stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" className="text-accent-light"
                />
              </svg>

              {/* Status Pill in bottom of frame */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3.5 py-1.5 rounded-full glass border border-white/15 text-[11px] font-medium backdrop-blur-md">
                <span className={`w-2 h-2 rounded-full ${
                  alignmentState === 'good' ? 'bg-emerald animate-pulse' :
                  alignmentState === 'adjust' ? 'bg-amber-400' : 'bg-accent-light'
                }`} />
                <span className={alignmentState === 'good' ? 'text-emerald font-semibold' : 'text-soft'}>
                  {alignmentStatus}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── COUNTDOWN TIMER OVERLAY ─────────────────────────────────── */}
        {countdown !== null && countdown > 0 && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center z-30 animate-fade-in pointer-events-none">
            <div className="relative flex items-center justify-center">
              {/* Pulsing countdown ring */}
              <div className="w-32 h-32 rounded-full border-4 border-accent animate-ping opacity-40" />
              <div className="w-28 h-28 rounded-full border-4 border-accent bg-base/80 flex items-center justify-center shadow-glow">
                <span className="text-5xl font-black text-bright animate-scale-in">
                  {countdown}
                </span>
              </div>
            </div>
            <p className="text-[14px] font-semibold text-bright mt-6 tracking-wide drop-shadow">
              Hold still and look at the camera 📸
            </p>
          </div>
        )}

        {/* ── CAMERA SHUTTER FLASH EFFECT ─────────────────────────────── */}
        {isFlashing && (
          <div className="absolute inset-0 bg-white z-40 transition-opacity duration-300 pointer-events-none opacity-90 animate-fade-in" />
        )}

        {/* ── FLOATING PICTURE-IN-PICTURE GARMENT CARD ────────────────── */}
        {selectedGarment && !aiResultUrl && (
          <div className="absolute bottom-4 right-4 z-20 flex items-center gap-3 p-2.5 rounded-2xl glass border border-accent/40 shadow-glow animate-fade-in max-w-xs backdrop-blur-xl">
            <div className="w-14 h-16 rounded-xl overflow-hidden bg-card flex-shrink-0 border border-white/10">
              <img
                src={selectedGarment.image}
                alt={selectedGarment.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0 pr-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                <span className="text-[9px] font-bold text-accent-light uppercase tracking-wider">Ready to Wear</span>
              </div>
              <h4 className="text-[12px] font-bold text-bright truncate leading-tight">{selectedGarment.name}</h4>
              <p className="text-[10px] text-muted truncate mt-0.5">{selectedGarment.brand || 'TrialShopy Studio'}</p>
              <div className="flex items-center gap-2 mt-1">
                {selectedGarment.price && (
                  <span className="text-[11px] font-bold text-emerald">${selectedGarment.price}</span>
                )}
                <span className="text-[9px] text-soft bg-white/10 px-1.5 py-0.5 rounded">
                  {selectedGarment.category}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── AI PROCESSING OVERLAY ───────────────────────────────────── */}
        {isGenerating && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/75 backdrop-blur-md animate-fade-in z-30">
            <div className="flex flex-col items-center gap-5 max-w-sm text-center px-6">
              {/* Dual animated concentric spinners */}
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-accent/20 border-t-accent animate-spin" />
                <div
                  className="absolute inset-3 w-14 h-14 rounded-full border-4 border-violet-400/20 border-b-violet-400 animate-spin"
                  style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles size={20} className="text-accent-light animate-pulse" />
                </div>
              </div>

              {/* Status description */}
              <div>
                <p className="text-[15px] font-bold text-bright mb-1 tracking-tight">
                  Crafting Photorealistic Try-On
                </p>
                <p className="text-[12px] text-soft leading-relaxed">
                  {aiProgress?.message ?? 'Synthesizing fabric drape & textures…'}
                </p>
              </div>

              {/* Progress indicator */}
              {aiProgress?.progress != null && (
                <div className="w-56 h-2 rounded-full bg-border overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-accent to-violet-400 rounded-full transition-all duration-300"
                    style={{ width: `${Math.round(aiProgress.progress * 100)}%` }}
                  />
                </div>
              )}

              {/* Pipeline milestone indicators */}
              <div className="flex items-center gap-1.5 text-[10px] text-muted">
                {['Portrait', 'Pose Fit', 'Drape', 'Lighting'].map((step, i) => (
                  <span key={step} className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"
                          style={{ animationDelay: `${i * 0.3}s` }} />
                    <span className="text-soft font-medium">{step}</span>
                    {i < 3 && <span className="text-border mx-0.5">→</span>}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
