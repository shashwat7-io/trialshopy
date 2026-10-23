import { useCallback } from 'react';
import { Clock, Download, Trash2 } from 'lucide-react';
import type { SavedLook } from '../types';

interface SavedLooksGalleryProps {
  looks: SavedLook[];
  onDelete: (id: string) => void;
  onDownload: (look: SavedLook) => void;
}

export default function SavedLooksGallery({ looks, onDelete, onDownload }: SavedLooksGalleryProps) {
  const handleDownload = useCallback((look: SavedLook) => {
    const a = document.createElement('a');
    a.href = look.resultImage;
    a.download = `trialshopy-look-${look.id}.jpg`;
    a.click();
    onDownload(look);
  }, [onDownload]);

  if (looks.length === 0) {
    return (
      <div className="px-4 py-5 border-t border-border">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={12} className="text-muted" />
          <span className="text-[11px] font-semibold text-soft uppercase tracking-widest">Saved Looks</span>
        </div>
        <div className="text-center py-4">
          <p className="text-[10px] text-muted">No looks saved yet. Try something on!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 border-t border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock size={12} className="text-muted" />
          <span className="text-[11px] font-semibold text-soft uppercase tracking-widest">Saved Looks</span>
        </div>
        <span className="text-[10px] text-muted">{looks.length}</span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {looks.map(look => (
          <div key={look.id}
               className="relative group rounded-lg overflow-hidden aspect-[3/4] bg-card border border-border hover:border-accent/40 transition-all cursor-pointer">
            <img src={look.resultImage} alt={look.garmentName}
                 className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              <button onClick={() => handleDownload(look)}
                      className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
                      title="Download">
                <Download size={11} />
              </button>
              <button onClick={() => onDelete(look.id)}
                      className="w-6 h-6 rounded-md bg-red-900/60 hover:bg-red-800/60 text-red-300 flex items-center justify-center transition-all"
                      title="Delete">
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
