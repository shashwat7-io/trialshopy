import { useState } from 'react';
import { Check } from 'lucide-react';
import type { Garment } from '../types';

interface ClothingCardProps {
  garment: Garment;
  selected: boolean;
  onSelect: (g: Garment) => void;
}

export default function ClothingCard({ garment, selected, onSelect }: ClothingCardProps) {
  const [imgError, setImgError] = useState(false);

  const fallbackColor = garment.colors[0] ?? '#7c3aed';

  return (
    <div
      className={`garment-card group ${selected ? 'selected' : ''}`}
      onClick={() => onSelect(garment)}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Select ${garment.name}`}
      onKeyDown={e => e.key === 'Enter' && onSelect(garment)}
    >
      {/* Garment image */}
      <div className="aspect-[3/4] relative overflow-hidden bg-[#1a1a2e]">
        {!imgError ? (
          <img
            src={garment.image}
            alt={garment.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          /* Fallback: colored placeholder with garment emoji */
          <div
            className="w-full h-full flex flex-col items-center justify-center gap-2"
            style={{ background: `linear-gradient(135deg, ${fallbackColor}22, ${fallbackColor}44)` }}
          >
            <div className="text-4xl">
              {garment.category === 'tshirts'  ? '👕' :
               garment.category === 'shirts'   ? '👔' :
               garment.category === 'jackets'  ? '🧥' :
               garment.category === 'hoodies'  ? '🫒' :
               garment.category === 'trousers' ? '👖' : '👗'}
            </div>
            <div className="text-[9px] text-muted text-center px-2 font-medium">{garment.name}</div>
          </div>
        )}

        {/* Price tag */}
        {garment.price && (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[9px] font-bold text-white/90"
               style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
            ${garment.price}
          </div>
        )}

        {/* Selected checkmark */}
        {selected && (
          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent flex items-center justify-center shadow-glow-sm animate-scale-in">
            <Check size={11} className="text-white" strokeWidth={3} />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </div>

      {/* Info */}
      <div className="p-2">
        <div className="text-[11px] font-semibold text-soft truncate leading-tight">{garment.name}</div>
        <div className="flex items-center gap-1.5 mt-1">
          {/* Color dots */}
          <div className="flex gap-0.5">
            {garment.colors.slice(0, 3).map(c => (
              <div key={c} className="w-2.5 h-2.5 rounded-full border border-white/10 flex-shrink-0"
                   style={{ background: c }} />
            ))}
          </div>
          <span className="text-[9px] text-muted ml-auto">{garment.sizes.length} sizes</span>
        </div>
      </div>
    </div>
  );
}
