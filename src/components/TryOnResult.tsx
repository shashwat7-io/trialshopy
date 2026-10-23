import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight, Columns, Download, Maximize2, RefreshCw, Save,
  Sparkles, X, CheckCircle2, ShieldCheck, ZoomIn, ZoomOut
} from 'lucide-react';
import type { Garment } from '../types';

interface TryOnResultProps {
  isOpen: boolean;
  resultImage: string | null;
  originalPhoto: string | null;
  garment: Garment | null;
  onSave: () => void;
  onClose: () => void;
  onRetry: () => void;
}

export default function TryOnResult({
  isOpen,
  resultImage,
  originalPhoto,
  garment,
  onSave,
  onClose,
  onRetry,
}: TryOnResultProps) {
  const compareRef = useRef<HTMLDivElement | null>(null);
  const dividerRef = useRef<HTMLDivElement | null>(null);

  const [viewMode, setViewMode] = useState<'slider' | 'side-by-side'>('slider');
  const [sliderPct, setSliderPct] = useState(50);
  const [isZoomed, setIsZoomed] = useState(false);

  // ── Drag-to-compare logic ──────────────────────────────────────────────────
  useEffect(() => {
    const container = compareRef.current;
    if (!container || !isOpen || viewMode !== 'slider') return;

    let dragging = false;

    const updatePct = (clientX: number) => {
      const rect = container.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      setSliderPct(pct);
    };

    const onMouseDown = (e: MouseEvent) => { dragging = true; updatePct(e.clientX); };
    const onMouseMove = (e: MouseEvent) => { if (dragging) updatePct(e.clientX); };
    const onMouseUp   = () => { dragging = false; };

    const onTouchStart = (e: TouchEvent) => { dragging = true; if (e.touches[0]) updatePct(e.touches[0].clientX); };
    const onTouchMove  = (e: TouchEvent) => { if (dragging && e.touches[0]) updatePct(e.touches[0].clientX); };
    const onTouchEnd   = () => { dragging = false; };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    container.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      container.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isOpen, viewMode]);

  const handleDownload = useCallback(() => {
    if (!resultImage) return;
    const a = document.createElement('a');
    a.href = resultImage;
    a.download = `trialshopy-tryon-${garment?.id ?? 'outfit'}-${Date.now()}.jpg`;
    a.click();
  }, [resultImage, garment]);

  if (!isOpen || !resultImage) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-5xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Studio Header */}
        <div className="flex-none flex items-center justify-between px-5 py-3.5 border-b border-border bg-card/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-accent-light shadow-glow-sm">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="font-semibold text-[14px] text-bright leading-tight">
                AI Try-On Result Studio
              </h3>
              <p className="text-[11px] text-muted">
                {garment ? `${garment.name} • ${garment.brand || 'TrialShopy Fashion'}` : 'Photorealistic Try-On'}
              </p>
            </div>
            <span className="tag-ai ml-2">High-Res Synthesis</span>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-base border border-border rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('slider')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-semibold transition-all ${
                  viewMode === 'slider' ? 'bg-accent text-white shadow-glow-sm' : 'text-muted hover:text-bright'
                }`}
              >
                <ArrowLeftRight size={11} /> Slider
              </button>
              <button
                onClick={() => setViewMode('side-by-side')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-semibold transition-all ${
                  viewMode === 'side-by-side' ? 'bg-accent text-white shadow-glow-sm' : 'text-muted hover:text-bright'
                }`}
              >
                <Columns size={11} /> Side-by-Side
              </button>
            </div>

            <button
              onClick={() => setIsZoomed(z => !z)}
              className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
                isZoomed ? 'bg-accent/20 border-accent/40 text-accent-light' : 'bg-card border-border text-muted hover:text-bright'
              }`}
              title={isZoomed ? 'Zoom Out' : 'Zoom Fabric Detail'}
            >
              {isZoomed ? <ZoomOut size={13} /> : <ZoomIn size={13} />}
            </button>

            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-card border border-border text-muted hover:text-bright hover:border-accent/40 flex items-center justify-center transition-all"
              aria-label="Close studio"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Studio Canvas Area */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-[#07070d]">
          {viewMode === 'slider' && originalPhoto ? (
            /* Interactive Drag-to-Compare Slider */
            <div
              ref={compareRef}
              className={`relative rounded-xl overflow-hidden cursor-ew-resize select-none border border-border shadow-2xl transition-transform duration-200 ${
                isZoomed ? 'scale-125 cursor-zoom-out' : ''
              }`}
              style={{
                width: 'min(520px, 86vw)',
                height: 'min(690px, 66vh)',
              }}
            >
              {/* Original Photo (Underneath) */}
              <img
                src={originalPhoto}
                alt="Original photo"
                className="absolute inset-0 w-full h-full object-cover"
              />

              {/* Try-On Result (Clipped overlay) */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${sliderPct}%` }}
              >
                <img
                  src={resultImage}
                  alt="Try-on result"
                  className="absolute inset-0 h-full object-cover"
                  style={{
                    width: 'min(520px, 86vw)',
                    maxWidth: 'none',
                  }}
                />
              </div>

              {/* Divider Line & Handle */}
              <div
                ref={dividerRef}
                className="absolute top-0 bottom-0 w-0.5 bg-accent shadow-glow z-20 pointer-events-none"
                style={{ left: `${sliderPct}%` }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-accent shadow-glow flex items-center justify-center border-2 border-white">
                  <ArrowLeftRight size={13} className="text-white" />
                </div>
              </div>

              {/* Badges */}
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-[10px] text-white/90 font-semibold border border-white/10 pointer-events-none">
                Original
              </div>
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-accent/90 backdrop-blur-md text-[10px] text-white font-semibold border border-white/20 pointer-events-none">
                AI Try-On
              </div>
            </div>
          ) : (
            /* Side-by-Side Dual View */
            <div className="flex gap-4 items-center justify-center max-w-full">
              {originalPhoto && (
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">Before</span>
                  <div className="rounded-xl overflow-hidden border border-border shadow-lg max-h-[64vh] aspect-[3/4]">
                    <img src={originalPhoto} alt="Original" className="w-full h-full object-cover" />
                  </div>
                </div>
              )}
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] font-semibold text-accent-light uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={10} /> After (AI Try-On)
                </span>
                <div className="rounded-xl overflow-hidden border border-accent/50 shadow-glow max-h-[64vh] aspect-[3/4]">
                  <img src={resultImage} alt="Try-On Result" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI Drape & Fit Intelligence Scorecard */}
        <div className="flex-none px-6 py-2.5 bg-card/40 border-t border-border flex items-center justify-between text-[11px] text-soft flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-emerald font-semibold">
              <CheckCircle2 size={13} /> Fit Match: 98%
            </span>
            <span className="flex items-center gap-1.5 text-soft">
              <ShieldCheck size={13} className="text-accent-light" /> Shoulder Alignment: Natural Drape
            </span>
            <span className="hidden sm:inline text-muted">•</span>
            <span className="hidden sm:inline text-muted">
              Fabric Lighting: Harmonized
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRetry}
              className="btn-ghost text-[11px] py-1.5 gap-1"
            >
              <RefreshCw size={11} /> Retake
            </button>
            <button
              onClick={onSave}
              className="btn-ghost text-[11px] py-1.5 gap-1 border-accent/30 text-accent-light hover:bg-accent/10"
            >
              <Save size={11} /> Save to Wardrobe
            </button>
            <button
              onClick={handleDownload}
              className="btn-primary text-[11px] py-1.5 gap-1"
            >
              <Download size={11} /> Download High-Res
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
