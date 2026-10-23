import { useCallback, useEffect, useRef } from 'react';
import { ArrowLeftRight, Download, Info, RefreshCw, Save, Sparkles, X } from 'lucide-react';
import type { Garment, TryOnStatus } from '../types';

interface TryOnResultProps {
  status: TryOnStatus;
  resultImage: string | null;
  originalPhoto: string | null;
  garment: Garment | null;
  error: string | null;
  apiConfigured: boolean;
  onSave: () => void;
  onClose: () => void;
  onRetry: () => void;
}

export default function TryOnResult({
  status, resultImage, originalPhoto, garment, error,
  apiConfigured, onSave, onClose, onRetry,
}: TryOnResultProps) {
  const compareRef = useRef<HTMLDivElement | null>(null);
  const dividerRef = useRef<HTMLDivElement | null>(null);

  // ── Drag-to-compare ────────────────────────────────────────────────────────
  useEffect(() => {
    const container = compareRef.current;
    const divider   = dividerRef.current;
    if (!container || !divider || status !== 'done' || !resultImage || !originalPhoto) return;

    let dragging = false;
    const move = (clientX: number) => {
      const rect = container.getBoundingClientRect();
      const pct  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      divider.style.left = `${pct * 100}%`;
      const before = divider.previousElementSibling as HTMLElement | null;
      if (before) before.style.clipPath = `inset(0 ${(1 - pct) * 100}% 0 0)`;
    };
    const onMouseDown = (e: MouseEvent) => { dragging = true; move(e.clientX); };
    const onMouseMove = (e: MouseEvent) => { if (dragging) move(e.clientX); };
    const onMouseUp   = () => { dragging = false; };
    const onTouch     = (e: TouchEvent) => { if (e.touches[0]) move(e.touches[0].clientX); };

    divider.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove',  onMouseMove);
    window.addEventListener('mouseup',    onMouseUp);
    divider.addEventListener('touchmove', onTouch);

    return () => {
      divider.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove',  onMouseMove);
      window.removeEventListener('mouseup',    onMouseUp);
      divider.removeEventListener('touchmove', onTouch);
    };
  }, [status, resultImage, originalPhoto]);

  const handleDownload = useCallback(() => {
    if (!resultImage) return;
    const a = document.createElement('a');
    a.href = resultImage;
    a.download = `trialshopy-tryon-${garment?.id ?? 'look'}-${Date.now()}.jpg`;
    a.click();
  }, [resultImage, garment]);

  if (status === 'idle') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
         role="dialog" aria-modal="true" aria-label="Try-On Result">
      <div className="relative w-full max-w-4xl mx-4 bg-surface border border-border rounded-2xl shadow-card overflow-hidden animate-scale-in">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Sparkles size={15} className="text-accent-light" />
            <span className="font-semibold text-[14px] text-bright">
              {status === 'processing' ? 'Generating your look…' :
               status === 'done'       ? `${garment?.name ?? 'Try-On'} Result` :
               status === 'error'      ? 'Try-On Failed' : ''}
            </span>
            {status === 'done' && !apiConfigured && (
              <span className="tag-demo">Demo Mode</span>
            )}
            {status === 'done' && apiConfigured && (
              <span className="tag-ai">AI Generated</span>
            )}
          </div>
          <button onClick={onClose}
                  className="w-7 h-7 rounded-lg bg-card border border-border text-muted hover:text-bright hover:border-accent/40 flex items-center justify-center transition-all"
                  aria-label="Close result">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">

          {/* ── Processing ───────────────────────────────────────────── */}
          {status === 'processing' && (
            <div className="flex flex-col items-center gap-5 py-12">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-accent/20 border-t-accent animate-spin" />
                <div className="absolute inset-4 w-12 h-12 rounded-full border-4 border-violet-400/10 border-b-violet-400 animate-spin"
                     style={{ animationDirection: 'reverse', animationDuration: '0.7s' }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles size={18} className="text-accent-light animate-pulse-slow" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-[14px] font-semibold text-bright mb-1">AI Try-On in Progress</p>
                <p className="text-[12px] text-muted max-w-xs">
                  {apiConfigured
                    ? 'Sending your photo to the AI model. This usually takes 5–15 seconds.'
                    : 'Compositing demo overlay — for real AI try-on, configure your API key.'}
                </p>
              </div>
              {/* Progress steps */}
              <div className="flex items-center gap-2 text-[10px] text-muted">
                {['Analysing pose', 'Warping garment', 'Blending'].map((step, i) => (
                  <span key={step} className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-slow"
                          style={{ animationDelay: `${i * 0.4}s` }} />
                    {step}
                    {i < 2 && <span className="text-border ml-0.5">→</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Error ─────────────────────────────────────────────────── */}
          {status === 'error' && (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-950/60 border border-red-800/50 flex items-center justify-center text-2xl">⚠️</div>
              <div>
                <p className="text-[14px] font-semibold text-red-300 mb-1">Something went wrong</p>
                <p className="text-[12px] text-muted max-w-sm">{error ?? 'An unexpected error occurred.'}</p>
              </div>
              <button onClick={onRetry} className="btn-ghost gap-1.5 text-[12px]">
                <RefreshCw size={13} /> Try Again
              </button>
            </div>
          )}

          {/* ── Result ────────────────────────────────────────────────── */}
          {status === 'done' && resultImage && originalPhoto && (
            <>
              {/* Drag-to-compare viewer */}
              <div ref={compareRef}
                   className="relative w-full rounded-xl overflow-hidden select-none cursor-ew-resize"
                   style={{ height: 480 }}>
                {/* Original (base layer, full width) */}
                <img src={originalPhoto} alt="Original photo"
                     className="absolute inset-0 w-full h-full object-contain bg-[#0d0d18]" />

                {/* Result (clipped, draggable) */}
                <img src={resultImage} alt="Try-on result"
                     className="absolute inset-0 w-full h-full object-contain bg-[#0d0d18]"
                     style={{ clipPath: 'inset(0 50% 0 0)' }} />

                {/* Divider handle */}
                <div ref={dividerRef}
                     className="absolute top-0 bottom-0 w-0.5 bg-accent shadow-glow cursor-ew-resize z-10"
                     style={{ left: '50%' }}>
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-accent shadow-glow flex items-center justify-center">
                    <ArrowLeftRight size={14} className="text-white" />
                  </div>
                </div>

                {/* Labels */}
                <div className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-black/60 text-[10px] text-white/70 font-medium backdrop-blur-sm pointer-events-none">
                  Original
                </div>
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-accent/80 text-[10px] text-white font-medium backdrop-blur-sm pointer-events-none">
                  Try-On
                </div>
              </div>

              {/* Demo notice */}
              {!apiConfigured && (
                <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-accent/10 border border-accent/20">
                  <Info size={13} className="text-accent-light flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-soft leading-relaxed">
                    <strong className="text-accent-light">Demo mode:</strong> This is a simple overlay preview.
                    For realistic AI-powered try-on (with CatVTON or IDM-VTON), configure your{' '}
                    <code className="text-accent-light">TRYON_API_KEY</code> in <code>.env</code>.
                  </p>
                </div>
              )}

              {/* Action bar */}
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={onClose} className="btn-ghost text-[12px] py-2">Close</button>
                <button onClick={onSave}  className="btn-ghost text-[12px] py-2 gap-1.5">
                  <Save size={13} /> Save Look
                </button>
                <button onClick={handleDownload} className="btn-primary text-[12px] py-2 gap-1.5">
                  <Download size={13} /> Download
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
