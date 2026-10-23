import { useCallback, useRef, useState } from 'react';
import Navbar          from './components/Navbar';
import ClothingSidebar from './components/ClothingSidebar';
import VirtualMirror   from './components/VirtualMirror';
import OutfitControls  from './components/OutfitControls';
import { useCamera }   from './hooks/useCamera';
import { aiTryOn, type TryOnProgress } from './services/tryOnService';
import type { Garment } from './types';

export default function App() {
  const camera = useCamera();
  const [selectedGarment, setSelectedGarment] = useState<Garment | null>(null);

  // AI try-on state
  const [aiProgress,  setAiProgress]  = useState<TryOnProgress | null>(null);
  const [aiResultUrl, setAiResultUrl] = useState<string | null>(null);
  const [aiError,     setAiError]     = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }, []);

  // ── Handle garment selection ────────────────────────────────────────────────
  const handleSelect = useCallback((g: Garment) => {
    setSelectedGarment(g);
    setAiResultUrl(null);
    setAiProgress(null);
    setAiError(null);
    showToast(`Selected: ${g.name} — see live preview, then click AI Try-On`, 'info');
  }, [showToast]);

  const handleReset = useCallback(() => {
    setSelectedGarment(null);
    setAiResultUrl(null);
    setAiProgress(null);
    setAiError(null);
    showToast('Outfit cleared', 'info');
  }, [showToast]);

  // ── AI Try-On trigger ──────────────────────────────────────────────────────
  const handleAiTryOn = useCallback(async () => {
    if (!selectedGarment || camera.status !== 'active') {
      showToast('Start your camera and select a garment first', 'error');
      return;
    }

    // Capture current frame from live camera
    const photoDataUrl = camera.capturePhoto();
    if (!photoDataUrl) {
      showToast('Could not capture frame from camera', 'error');
      return;
    }

    setAiError(null);
    setAiResultUrl(null);

    try {
      showToast('📸 Frame captured — sending to AI model…', 'info');

      const resultUrl = await aiTryOn(
        photoDataUrl,
        selectedGarment.image,
        (progress) => setAiProgress(progress),
      );

      setAiResultUrl(resultUrl);
      setAiProgress({ status: 'done', message: 'Try-on complete!', progress: 1 });
      showToast('🎉 AI Try-On complete! Check your new look.', 'success');

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setAiError(msg);
      setAiProgress({ status: 'error', message: msg });
      showToast(`AI Try-On failed: ${msg}`, 'error');
    }
  }, [selectedGarment, camera, showToast]);

  // ── Save / Download ────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!aiResultUrl) return;
    // Store in localStorage for persistence
    const saved = JSON.parse(localStorage.getItem('trialshopy_saved_looks') ?? '[]');
    saved.unshift({
      id: `look-${Date.now()}`,
      garmentName: selectedGarment?.name ?? 'Unknown',
      resultUrl: aiResultUrl,
      savedAt: new Date().toISOString(),
    });
    localStorage.setItem('trialshopy_saved_looks', JSON.stringify(saved.slice(0, 20)));
    showToast('Look saved! ✨', 'success');
  }, [aiResultUrl, selectedGarment, showToast]);

  const handleDownload = useCallback(() => {
    if (!aiResultUrl) return;
    const a = document.createElement('a');
    a.href = aiResultUrl;
    a.download = `trialshopy-tryon-${selectedGarment?.id ?? 'look'}-${Date.now()}.jpg`;
    a.click();
    showToast('Downloading…', 'info');
  }, [aiResultUrl, selectedGarment, showToast]);

  const handleClearAiResult = useCallback(() => {
    setAiResultUrl(null);
    setAiProgress(null);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-base overflow-hidden">
      <Navbar cameraStatus={camera.status} apiConfigured={true} />

      <main className="flex-1 flex overflow-hidden">
        {/* Left: clothing library */}
        <ClothingSidebar selected={selectedGarment} onSelect={handleSelect} />

        {/* Centre: virtual mirror */}
        <VirtualMirror
          camera={camera}
          selectedGarment={selectedGarment}
          aiResultUrl={aiResultUrl}
          aiProgress={aiProgress}
          onClearAiResult={handleClearAiResult}
        />

        {/* Right: controls */}
        <OutfitControls
          garment={selectedGarment}
          cameraActive={camera.status === 'active'}
          aiProgress={aiProgress}
          aiResultUrl={aiResultUrl}
          onAiTryOn={handleAiTryOn}
          onReset={handleReset}
          onSave={handleSave}
          onDownload={handleDownload}
        />
      </main>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 px-4 py-2.5 rounded-xl border shadow-card animate-fade-in text-[12px] font-medium max-w-md ${
          toast.type === 'success' ? 'bg-emerald/10 border-emerald/30 text-emerald' :
          toast.type === 'error'   ? 'bg-red-950/80 border-red-800/50 text-red-300' :
                                     'bg-surface border-border text-soft'
        }`} role="alert">
          {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
          <span className="truncate">{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
