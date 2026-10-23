import { useEffect, useRef } from 'react';
import {
  Camera, CameraOff, FlipHorizontal, Loader, ShieldAlert,
  Sparkles, Video
} from 'lucide-react';
import type { Garment } from '../types';
import type { UseCameraReturn } from '../hooks/useCamera';
import { usePoseDetection, type Landmark } from '../hooks/usePoseDetection';
import type { TryOnProgress } from '../services/tryOnService';

/* ── helpers ─────────────────────────────────────────────────────────────────── */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ── smoothed skeleton ───────────────────────────────────────────────────────── */

interface SmoothSkeleton {
  nose: { x: number; y: number };
  ls: { x: number; y: number }; rs: { x: number; y: number };
  le: { x: number; y: number }; re: { x: number; y: number };
  lw: { x: number; y: number }; rw: { x: number; y: number };
  lh: { x: number; y: number }; rh: { x: number; y: number };
}

function defaultSkeleton(): SmoothSkeleton {
  return {
    nose: { x: 0.50, y: 0.18 },
    ls: { x: 0.60, y: 0.38 }, rs: { x: 0.40, y: 0.38 },
    le: { x: 0.75, y: 0.55 }, re: { x: 0.25, y: 0.55 },
    lw: { x: 0.78, y: 0.72 }, rw: { x: 0.22, y: 0.72 },
    lh: { x: 0.56, y: 0.68 }, rh: { x: 0.44, y: 0.68 },
  };
}

function updateSkeleton(sk: SmoothSkeleton, lm: Landmark[], t: number) {
  const up = (key: keyof SmoothSkeleton, idx: number) => {
    const pt = lm[idx];
    if (!pt || (pt.visibility ?? 1) < 0.3) return;
    sk[key].x = lerp(sk[key].x, pt.x, t);
    sk[key].y = lerp(sk[key].y, pt.y, t);
  };
  up('nose', 0);
  up('ls', 11); up('rs', 12);
  up('le', 13); up('re', 14);
  up('lw', 15); up('rw', 16);
  up('lh', 23); up('rh', 24);
}

/** Extract dominant colour from a garment image */
function extractDominantColor(img: HTMLImageElement): string {
  const c = document.createElement('canvas');
  const sz = 64; c.width = sz; c.height = sz;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, sz, sz);
  const x0 = Math.floor(sz * 0.2), y0 = Math.floor(sz * 0.25);
  const x1 = Math.floor(sz * 0.8), y1 = Math.floor(sz * 0.75);
  const id = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
  const d = id.data;
  let rS = 0, gS = 0, bS = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const bri = (d[i] + d[i + 1] + d[i + 2]) / 3;
    if (bri > 230 || d[i + 3] < 128) continue;
    rS += d[i]; gS += d[i + 1]; bS += d[i + 2]; n++;
  }
  if (n === 0) return '#333333';
  return `rgb(${Math.round(rS / n)},${Math.round(gS / n)},${Math.round(bS / n)})`;
}

/** Build a torso + sleeve body-shaped outline */
function buildTorsoPath(
  ctx: CanvasRenderingContext2D,
  sk: SmoothSkeleton, W: number, H: number,
  mirrorX: (v: number) => number,
  isShortSleeve: boolean,
) {
  const ls = { x: mirrorX(sk.ls.x) * W, y: sk.ls.y * H };
  const rs = { x: mirrorX(sk.rs.x) * W, y: sk.rs.y * H };
  const lh = { x: mirrorX(sk.lh.x) * W, y: sk.lh.y * H };
  const rh = { x: mirrorX(sk.rh.x) * W, y: sk.rh.y * H };
  const le = { x: mirrorX(sk.le.x) * W, y: sk.le.y * H };
  const re = { x: mirrorX(sk.re.x) * W, y: sk.re.y * H };

  const shoulderW = Math.sqrt((rs.x - ls.x) ** 2 + (rs.y - ls.y) ** 2);
  const expand = shoulderW * 0.12;
  const sleeveFrac = isShortSleeve ? 0.45 : 0.85;

  const lSleeve = {
    x: ls.x + (le.x - ls.x) * sleeveFrac,
    y: ls.y + (le.y - ls.y) * sleeveFrac,
  };
  const rSleeve = {
    x: rs.x + (re.x - rs.x) * sleeveFrac,
    y: rs.y + (re.y - rs.y) * sleeveFrac,
  };
  const sleeveW = shoulderW * (isShortSleeve ? 0.12 : 0.10);
  const neckY = (ls.y + rs.y) / 2 - shoulderW * 0.04;
  const neckCx = (ls.x + rs.x) / 2;

  ctx.beginPath();
  ctx.moveTo(neckCx - shoulderW * 0.13, neckY);
  ctx.quadraticCurveTo(ls.x - expand * 0.3, neckY + shoulderW * 0.02, ls.x - expand, ls.y);
  ctx.lineTo(lSleeve.x - sleeveW * (lSleeve.x > ls.x ? -1 : 1), lSleeve.y - sleeveW);
  ctx.lineTo(lSleeve.x + sleeveW * (lSleeve.x > ls.x ? 1 : -1), lSleeve.y + sleeveW);
  ctx.quadraticCurveTo(ls.x - expand * 0.5, (ls.y + lh.y) / 2, lh.x - expand * 0.7, lh.y);
  ctx.lineTo(rh.x + expand * 0.7, rh.y);
  ctx.quadraticCurveTo(rs.x + expand * 0.5, (rs.y + rh.y) / 2,
    rSleeve.x + sleeveW * (rSleeve.x < rs.x ? 1 : -1), rSleeve.y + sleeveW);
  ctx.lineTo(rSleeve.x - sleeveW * (rSleeve.x < rs.x ? -1 : 1), rSleeve.y - sleeveW);
  ctx.lineTo(rs.x + expand, rs.y);
  ctx.quadraticCurveTo(rs.x + expand * 0.3, neckY + shoulderW * 0.02, neckCx + shoulderW * 0.13, neckY);
  const neckDepth = shoulderW * 0.15;
  ctx.quadraticCurveTo(neckCx, neckY + neckDepth, neckCx - shoulderW * 0.13, neckY);
  ctx.closePath();
}

/* ── component ───────────────────────────────────────────────────────────────── */

interface VirtualMirrorProps {
  camera: UseCameraReturn;
  selectedGarment: Garment | null;
  aiResultUrl: string | null;        // AI-generated result image URL
  aiProgress: TryOnProgress | null;  // AI generation progress
  onClearAiResult: () => void;       // Dismiss AI result
}

export default function VirtualMirror({
  camera, selectedGarment, aiResultUrl, aiProgress, onClearAiResult,
}: VirtualMirrorProps) {
  const { videoRef, status, error, devices, activeDeviceId, startCamera, stopCamera, switchCamera } = camera;
  const canvasRef    = useRef<HTMLCanvasElement | null>(null);
  const rafRef       = useRef<number | null>(null);
  const skRef        = useRef<SmoothSkeleton>(defaultSkeleton());
  const garmentColor = useRef<string>('#333333');

  const { status: poseStatus, detect } = usePoseDetection();

  // ── Extract garment colour on selection ────────────────────────────────────
  useEffect(() => {
    garmentColor.current = '#333333';
    if (!selectedGarment) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { if (!cancelled) garmentColor.current = extractDominantColor(img); };
    img.onerror = () => {
      if (!cancelled) garmentColor.current = selectedGarment.colors[0] ?? '#333333';
    };
    img.src = selectedGarment.image;
    return () => { cancelled = true; };
  }, [selectedGarment]);

  // ── Live preview render loop (shows colour blend while AI is generating) ──
  useEffect(() => {
    if (status !== 'active') return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let cancelled = false, dimsSet = false;
    const sk = skRef.current;

    let poseTimer: ReturnType<typeof setInterval> | null = null;
    if (poseStatus === 'ready') {
      poseTimer = setInterval(() => {
        if (cancelled || video.readyState < 2) return;
        const lm = detect(video, performance.now());
        if (lm) updateSkeleton(sk, lm, 0.25);
      }, 80);
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
          const mirror = (v: number) => 1 - v;

          // Draw mirrored video
          ctx.save();
          ctx.translate(W, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, W, H);
          ctx.restore();

          // Live colour-blend preview (only when no AI result showing)
          if (selectedGarment && poseStatus === 'ready' && !aiResultUrl) {
            const isShortSleeve = selectedGarment.category === 'tshirts';

            // Multiply blend — garment colour merges with body shadows
            ctx.save();
            buildTorsoPath(ctx, sk, W, H, mirror, isShortSleeve);
            ctx.clip();
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = garmentColor.current;
            ctx.fillRect(0, 0, W, H);
            ctx.restore();

            // Semi-transparent overlay to strengthen colour
            ctx.save();
            buildTorsoPath(ctx, sk, W, H, mirror, isShortSleeve);
            ctx.clip();
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 0.42;
            ctx.fillStyle = garmentColor.current;
            ctx.fillRect(0, 0, W, H);
            ctx.restore();

            // Soft edge
            ctx.save();
            buildTorsoPath(ctx, sk, W, H, mirror, isShortSleeve);
            ctx.strokeStyle = garmentColor.current;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.2;
            ctx.stroke();
            ctx.restore();
          }
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
  }, [status, poseStatus, detect, videoRef, selectedGarment, aiResultUrl]);

  const otherDevices = devices.filter(d => d.deviceId !== activeDeviceId);
  const isGenerating = aiProgress && !['idle', 'done', 'error'].includes(aiProgress.status);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Top bar */}
      <div className="flex-none flex items-center justify-between px-4 py-2 border-b border-border bg-surface">
        <div className="flex items-center gap-2">
          <Video size={13} className="text-muted" />
          <span className="text-[11px] font-semibold text-soft uppercase tracking-widest">Virtual Mirror</span>
          {status === 'active' && (
            <span className="flex items-center gap-1 tag-live">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" /> LIVE
            </span>
          )}
          {status === 'active' && selectedGarment && !aiResultUrl && (
            <span className="tag-demo">Preview</span>
          )}
          {aiResultUrl && (
            <span className="tag-ai"><Sparkles size={9} /> AI Generated</span>
          )}
          {poseStatus === 'loading' && status === 'active' && (
            <span className="flex items-center gap-1 text-[10px] text-muted">
              <Loader size={10} className="animate-spin" /> Loading pose model…
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {aiResultUrl && (
            <button onClick={onClearAiResult}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/20 border border-accent/30 text-accent-light hover:bg-accent/30 text-[10px] font-medium transition-all">
              ← Back to Live
            </button>
          )}
          {status === 'active' && otherDevices.length > 0 && !aiResultUrl && (
            <button onClick={() => switchCamera(otherDevices[0].deviceId)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-card border border-border text-muted hover:text-bright hover:border-accent/40 text-[10px] transition-all">
              <FlipHorizontal size={11} /> Switch
            </button>
          )}
          {status === 'active' ? (
            <button onClick={stopCamera}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-950/60 border border-red-800/50 text-red-400 hover:text-red-300 text-[10px] transition-all">
              <CameraOff size={11} /> Stop
            </button>
          ) : (
            <button onClick={() => startCamera()}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-accent/20 border border-accent/30 text-accent-light hover:bg-accent/30 text-[10px] transition-all">
              <Camera size={11} /> Start Camera
            </button>
          )}
        </div>
      </div>

      {/* Mirror area */}
      <div className="flex-1 relative bg-base flex items-center justify-center overflow-hidden">

        {/* IDLE */}
        {status === 'idle' && (
          <div className="flex flex-col items-center gap-6 animate-fade-in text-center px-8 select-none">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
                <Camera size={36} className="text-accent/60" />
              </div>
              <div className="absolute -inset-3 rounded-full border border-accent/10 animate-pulse-slow" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-bright mb-1">Your Virtual Mirror</h3>
              <p className="text-[12px] text-muted leading-relaxed max-w-xs">
                Turn on your camera, select a garment, and click <strong className="text-accent-light">AI Try-On</strong> to see yourself wearing it.
              </p>
            </div>
            <button onClick={() => startCamera()} className="btn-primary text-[12px] py-2">
              <Camera size={13} /> Start Camera
            </button>
          </div>
        )}

        {/* REQUESTING */}
        {status === 'requesting' && (
          <div className="flex flex-col items-center gap-4 animate-fade-in text-center">
            <div className="w-14 h-14 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
            <p className="text-[13px] text-muted">Requesting camera access…</p>
          </div>
        )}

        {/* DENIED / ERROR */}
        {(status === 'denied' || status === 'error') && (
          <div className="flex flex-col items-center gap-5 animate-fade-in text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-red-950/60 border border-red-800/50 flex items-center justify-center">
              <ShieldAlert size={28} className="text-red-400" />
            </div>
            <p className="text-[14px] font-semibold text-red-300">
              {status === 'denied' ? 'Camera Access Denied' : 'Camera Error'}
            </p>
            <p className="text-[11px] text-muted max-w-xs">{error}</p>
            <button onClick={() => startCamera()} className="btn-ghost text-[12px] py-2 gap-1.5">
              <Camera size={12} /> Try Again
            </button>
          </div>
        )}

        {/* Hidden video source */}
        <video
          ref={videoRef as React.RefObject<HTMLVideoElement>}
          autoPlay playsInline muted
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
          aria-hidden="true"
        />

        {/* ── LIVE CANVAS (visible when no AI result) ─────────────────── */}
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full object-contain"
          style={{
            display: status === 'active' && !aiResultUrl ? 'block' : 'none',
            width: '100%', height: '100%',
          }}
          aria-label="Live virtual try-on preview"
        />

        {/* ── AI RESULT IMAGE (replaces live feed) ────────────────────── */}
        {aiResultUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-base animate-fade-in">
            <img
              src={aiResultUrl}
              alt="AI-generated try-on result"
              className="max-w-full max-h-full object-contain"
            />
          </div>
        )}

        {/* ── AI PROCESSING OVERLAY ───────────────────────────────────── */}
        {isGenerating && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in z-20">
            <div className="flex flex-col items-center gap-5 max-w-sm text-center">
              {/* Spinner */}
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-accent/20 border-t-accent animate-spin" />
                <div className="absolute inset-4 w-12 h-12 rounded-full border-4 border-violet-400/10 border-b-violet-400 animate-spin"
                     style={{ animationDirection: 'reverse', animationDuration: '0.7s' }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles size={18} className="text-accent-light animate-pulse-slow" />
                </div>
              </div>

              {/* Status text */}
              <div>
                <p className="text-[14px] font-semibold text-bright mb-1">
                  AI Virtual Try-On
                </p>
                <p className="text-[12px] text-muted leading-relaxed">
                  {aiProgress?.message ?? 'Processing…'}
                </p>
              </div>

              {/* Progress bar */}
              {aiProgress?.progress != null && (
                <div className="w-48 h-1.5 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-500"
                    style={{ width: `${Math.round(aiProgress.progress * 100)}%` }}
                  />
                </div>
              )}

              {/* Pipeline steps */}
              <div className="flex items-center gap-2 text-[10px] text-muted">
                {['Uploading', 'Pose analysis', 'Warping garment', 'Blending'].map((step, i) => (
                  <span key={step} className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-slow"
                          style={{ animationDelay: `${i * 0.4}s` }} />
                    {step}
                    {i < 3 && <span className="text-border ml-0.5">→</span>}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Hint when camera live but no garment */}
        {status === 'active' && !selectedGarment && !aiResultUrl && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2.5 px-4 py-2.5 rounded-xl glass border border-border animate-fade-in pointer-events-none">
            <Sparkles size={13} className="text-accent-light" />
            <span className="text-[11px] text-soft">Select a garment → see live preview → click <strong className="text-accent-light">AI Try-On</strong> for photorealistic result</span>
          </div>
        )}

        {/* Active garment badge */}
        {status === 'active' && selectedGarment && !aiResultUrl && (
          <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-lg glass border border-accent/30 animate-fade-in">
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-[10px] font-semibold text-accent-light">
              Preview: {selectedGarment.name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
