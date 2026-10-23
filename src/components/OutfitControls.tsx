import { useState } from 'react';
import {
  ArrowRight, CheckCircle, Download, Package, Palette,
  Ruler, Save, ShoppingBag, Sparkles, X
} from 'lucide-react';
import type { Garment } from '../types';
import type { TryOnProgress } from '../services/tryOnService';

interface OutfitControlsProps {
  garment: Garment | null;
  cameraActive: boolean;
  aiProgress: TryOnProgress | null;
  aiResultUrl: string | null;
  onAiTryOn: () => void;
  onReset: () => void;
  onSave: () => void;
  onDownload: () => void;
}

export default function OutfitControls({
  garment, cameraActive, aiProgress, aiResultUrl,
  onAiTryOn, onReset, onSave, onDownload,
}: OutfitControlsProps) {
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize]   = useState<string>('');
  const [imgError, setImgError]           = useState(false);

  if (garment && !selectedColor && garment.colors.length) {
    setSelectedColor(garment.colors[0]);
    setSelectedSize(garment.sizes[2] ?? garment.sizes[0] ?? '');
  }

  const isGenerating = aiProgress && !['idle', 'done', 'error'].includes(aiProgress.status);
  const canGenerate  = !!garment && cameraActive && !isGenerating;

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!garment) {
    return (
      <aside className="w-80 flex flex-col border-l border-border bg-surface overflow-hidden flex-none">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center">
            <Package size={24} className="text-muted" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-soft mb-1">No garment selected</p>
            <p className="text-[11px] text-muted leading-relaxed">
              Pick a clothing item from the left library. You'll see an instant preview, then click <strong className="text-accent-light">AI Try-On</strong> for a photorealistic result.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-80 flex flex-col border-l border-border bg-surface overflow-hidden flex-none">
      {/* Header */}
      <div className="flex-none px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag size={13} className="text-muted" />
            <span className="text-[11px] font-semibold text-soft uppercase tracking-widest">Outfit Controls</span>
          </div>
          <button onClick={onReset}
            className="w-6 h-6 rounded-md bg-card border border-border text-muted hover:text-bright hover:border-accent/40 flex items-center justify-center transition-all"
            title="Clear selection">
            <X size={11} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Garment card */}
        <div className="p-4 border-b border-border">
          <div className="flex gap-3">
            <div className="w-20 h-24 rounded-xl overflow-hidden bg-[#1a1a2e] flex-shrink-0 border border-border">
              {!imgError ? (
                <img src={garment.image} alt={garment.name}
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl">
                  {garment.category === 'tshirts' ? '👕' : garment.category === 'shirts' ? '👔' :
                   garment.category === 'jackets' ? '🧥' : garment.category === 'hoodies' ? '🧶' : '👖'}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted capitalize">{garment.category.replace('tshirts', 'T-Shirts')}</p>
              <h3 className="text-[14px] font-semibold text-bright leading-tight mt-0.5">{garment.name}</h3>
              {garment.brand && <p className="text-[10px] text-muted mt-0.5">{garment.brand}</p>}
              {garment.price && <p className="text-[15px] font-bold text-accent-light mt-2">${garment.price}</p>}
            </div>
          </div>
          {garment.description && (
            <p className="text-[11px] text-muted leading-relaxed mt-3">{garment.description}</p>
          )}
        </div>

        {/* Status */}
        <div className="px-4 py-3 border-b border-border">
          <div className="space-y-1.5">
            <div className={`flex items-center gap-2 text-[11px] ${cameraActive ? 'text-emerald' : 'text-muted'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${cameraActive ? 'bg-emerald animate-pulse' : 'bg-border'}`} />
              {cameraActive ? 'Camera live — instant preview active' : 'Start camera to see preview'}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-emerald">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald" />
              Garment selected
            </div>
            {aiResultUrl && (
              <div className="flex items-center gap-2 text-[11px] text-accent-light">
                <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                AI result ready
              </div>
            )}
          </div>
        </div>

        {/* Colour picker */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <Palette size={12} className="text-muted" />
            <span className="text-[11px] font-semibold text-soft">Color</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {garment.colors.map(c => (
              <button key={c} onClick={() => setSelectedColor(c)}
                className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                  selectedColor === c ? 'border-accent scale-110 shadow-glow-sm' : 'border-white/10 hover:border-white/30'
                }`}
                style={{ background: c }} title={c} aria-pressed={selectedColor === c}>
                {selectedColor === c && <CheckCircle size={12} className="text-white drop-shadow m-auto" />}
              </button>
            ))}
          </div>
        </div>

        {/* Size picker */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <Ruler size={12} className="text-muted" />
            <span className="text-[11px] font-semibold text-soft">Size</span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {garment.sizes.map(sz => (
              <button key={sz} onClick={() => setSelectedSize(sz)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                  selectedSize === sz
                    ? 'bg-accent border-accent text-white shadow-glow-sm'
                    : 'bg-card border-border text-muted hover:border-accent/40 hover:text-bright'
                }`}
                aria-pressed={selectedSize === sz}>
                {sz}
              </button>
            ))}
          </div>
        </div>

        {/* AI info */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-accent/5 border border-accent/15">
            <Sparkles size={12} className="text-accent-light flex-shrink-0 mt-0.5" />
            <div className="text-[10px] text-soft leading-relaxed">
              <strong className="text-accent-light">How it works:</strong> The live preview uses colour blending for instant feedback.
              Click <strong className="text-bright">AI Try-On</strong> below to generate a photorealistic image using the IDM-VTON AI model — it takes 30–90 seconds but looks real.
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex-none p-4 border-t border-border space-y-2">
        {/* AI Try-On button */}
        <button
          id="btn-ai-tryon"
          onClick={onAiTryOn}
          disabled={!canGenerate}
          className="w-full btn-primary py-3 text-[13px] font-semibold"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              {aiProgress?.message ?? 'Generating…'}
            </>
          ) : (
            <>
              <Sparkles size={15} />
              AI Try-On
              <ArrowRight size={13} />
            </>
          )}
        </button>

        {/* Save / Download (visible when AI result exists) */}
        {aiResultUrl && (
          <div className="flex gap-2">
            <button onClick={onSave} className="flex-1 btn-ghost py-2 text-[11px] gap-1">
              <Save size={12} /> Save
            </button>
            <button onClick={onDownload} className="flex-1 btn-ghost py-2 text-[11px] gap-1">
              <Download size={12} /> Download
            </button>
          </div>
        )}

        {/* Reset */}
        <button onClick={onReset} className="w-full btn-ghost py-2 text-[12px]">
          Reset Outfit
        </button>
      </div>
    </aside>
  );
}
