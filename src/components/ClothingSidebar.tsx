import { useState } from 'react';
import { Search, SlidersHorizontal, Upload, X } from 'lucide-react';
import ClothingCard from './ClothingCard';
import { GARMENTS, CATEGORIES } from '../data/garments';
import type { Garment, GarmentCategory } from '../types';

interface ClothingSidebarProps {
  selected: Garment | null;
  onSelect: (g: Garment) => void;
}

export default function ClothingSidebar({ selected, onSelect }: ClothingSidebarProps) {
  const [category, setCategory] = useState<GarmentCategory>('all');
  const [query,    setQuery]    = useState('');

  const filtered = GARMENTS.filter(g => {
    const matchCat   = category === 'all' || g.category === category;
    const matchQuery = !query || g.name.toLowerCase().includes(query.toLowerCase()) ||
                       g.brand?.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQuery;
  });

  return (
    <aside className="w-72 flex flex-col border-r border-border bg-surface overflow-hidden flex-none">
      {/* Header */}
      <div className="flex-none px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[13px] font-semibold text-bright">Garment Library</h2>
            <p className="text-[10px] text-muted mt-0.5">{filtered.length} items available</p>
          </div>
          <button className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center text-muted hover:text-bright hover:border-accent/40 transition-all"
                  title="Filter options" aria-label="Filter">
            <SlidersHorizontal size={12} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search garments…"
            className="w-full bg-card border border-border rounded-lg pl-7 pr-7 py-1.5 text-[12px] text-bright placeholder-muted focus:outline-none focus:border-accent/60 transition-colors"
            aria-label="Search garments"
          />
          {query && (
            <button onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-bright"
                    aria-label="Clear search">
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex-none px-3 py-2 border-b border-border overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id as GarmentCategory)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all ${
                category === cat.id
                  ? 'bg-accent text-white shadow-glow-sm'
                  : 'bg-card text-muted hover:text-bright hover:bg-border border border-border'
              }`}
            >
              {cat.label}
              <span className={`ml-1 text-[9px] ${category === cat.id ? 'text-white/70' : 'text-muted'}`}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map(g => (
              <ClothingCard
                key={g.id}
                garment={g}
                selected={selected?.id === g.id}
                onSelect={onSelect}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
            <div className="text-2xl">🔍</div>
            <p className="text-[11px] text-muted">No garments found for <strong className="text-soft">"{query}"</strong></p>
            <button onClick={() => setQuery('')} className="text-[10px] text-accent-light hover:underline">Clear search</button>
          </div>
        )}
      </div>

      {/* Upload custom */}
      <div className="flex-none p-3 border-t border-border">
        <button className="w-full btn-ghost text-[11px] py-2 gap-1.5">
          <Upload size={12} />
          Upload Custom Garment
        </button>
      </div>
    </aside>
  );
}
