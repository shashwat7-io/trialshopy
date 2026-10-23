import { useCallback, useRef, useState } from 'react';
import Navbar          from './components/Navbar';
import ClothingSidebar from './components/ClothingSidebar';
import VirtualMirror   from './components/VirtualMirror';
import OutfitControls  from './components/OutfitControls';
import TryOnResult     from './components/TryOnResult';
import { useCamera }   from './hooks/useCamera';
import { aiTryOn, type TryOnProgress } from './services/tryOnService';
import type { Garment } from './types';
import type { Landmark } from './hooks/usePoseDetection';

/** Simple audio chime for countdown and camera shutter */
function playChime(freq = 520, duration = 0.08, type: OscillatorType = 'sine') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    /* ok if audio context is blocked */
  }
}

export default function App() {
  const camera = useCamera();
  const [selectedGarment, setSelectedGarment] = useState<Garment | null>(null);

  // Active target photo (camera capture, user upload, or studio model preset)
  const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);

  // Capture timer & mode preferences
  const [captureTimer, setCaptureTimer] = useState<0 | 3>(3);
  const [tryOnMode, setTryOnMode]       = useState<'auto' | 'studio' | 'cloud'>('auto');

  // Animation states
  const [countdown, setCountdown]   = useState<number | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);

  // Latest pose landmarks detected from video
  const latestLandmarks = useRef<Landmark[] | null>(null);

  // AI try-on state
  const [aiProgress,  setAiProgress]  = useState<TryOnProgress | null>(null);
  const [aiResultUrl, setAiResultUrl] = useState<string | null>(null);
  const [aiError,     setAiError]     = useState<string | null>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);

  // Toast notification
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
    showToast(`Selected: ${g.name} — Click AI Try-On to generate your look`, 'info');
  }, [showToast]);

  const handleReset = useCallback(() => {
    setSelectedGarment(null);
    setAiResultUrl(null);
    setAiProgress(null);
    setAiError(null);
    setActivePhotoUrl(null);
    setCapturedPhotoUrl(null);
    showToast('Outfit cleared', 'info');
  }, [showToast]);

  const handleLandmarksUpdate = useCallback((lm: Landmark[] | null) => {
    latestLandmarks.current = lm;
  }, []);

  // ── Core AI Try-On Execution ──────────────────────────────────────────────
  const runGeneration = useCallback(async (photoDataUrl: string, targetGarment: Garment) => {
    setAiError(null);
    setAiResultUrl(null);
    setCapturedPhotoUrl(photoDataUrl);

    try {
      showToast('✨ AI is creating your photorealistic try-on photograph…', 'info');

      const resultUrl = await aiTryOn(
        photoDataUrl,
        targetGarment.image,
        (progress) => setAiProgress(progress),
        {
          garment: targetGarment,
          landmarks: latestLandmarks.current,
          mode: tryOnMode,
        }
      );

      setAiResultUrl(resultUrl);
      setAiProgress({ status: 'done', message: 'Photorealistic try-on complete!', progress: 1 });
      setIsResultModalOpen(true);
      showToast('🎉 Your photorealistic AI Try-On is ready! Opening Studio…', 'success');

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setAiError(msg);
      setAiProgress({ status: 'error', message: msg });
      showToast(`AI Try-On failed: ${msg}`, 'error');
    }
  }, [tryOnMode, showToast]);

  // ── Capture with 3s Timer or Instant Shutter ──────────────────────────────
  const handleAiTryOn = useCallback(async () => {
    if (!selectedGarment) {
      showToast('Select a garment first', 'error');
      return;
    }

    // Case A: A static photo (uploaded or studio preset) is already selected
    if (activePhotoUrl) {
      runGeneration(activePhotoUrl, selectedGarment);
      return;
    }

    // Case B: Live camera
    if (camera.status !== 'active') {
      showToast('Start your camera or select a studio model photo first', 'error');
      return;
    }

    // Function to execute camera snapshot
    const doCapture = () => {
      // Trigger camera flash
      playChime(880, 0.12, 'triangle');
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 220);

      // Intelligent 3:4 portrait crop centered on user
      const photoDataUrl = camera.capturePhoto({
        cropPortrait: true,
        mirror: true,
        enhance: true,
      });

      if (!photoDataUrl) {
        showToast('Could not capture frame from camera', 'error');
        return;
      }

      runGeneration(photoDataUrl, selectedGarment);
    };

    if (captureTimer === 3) {
      // 3-second countdown sequence
      setCountdown(3);
      playChime(440, 0.08);

      setTimeout(() => {
        setCountdown(2);
        playChime(440, 0.08);
      }, 1000);

      setTimeout(() => {
        setCountdown(1);
        playChime(440, 0.08);
      }, 2000);

      setTimeout(() => {
        setCountdown(null);
        doCapture();
      }, 3000);

    } else {
      doCapture();
    }
  }, [selectedGarment, activePhotoUrl, camera, captureTimer, runGeneration, showToast]);

  // ── Save / Download ────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!aiResultUrl) return;
    const saved = JSON.parse(localStorage.getItem('trialshopy_saved_looks') ?? '[]');
    saved.unshift({
      id: `look-${Date.now()}`,
      garmentId: selectedGarment?.id ?? 'garment',
      garmentName: selectedGarment?.name ?? 'Unknown',
      garmentImage: selectedGarment?.image ?? '',
      resultImage: aiResultUrl,
      capturedAt: new Date().toISOString(),
    });
    localStorage.setItem('trialshopy_saved_looks', JSON.stringify(saved.slice(0, 20)));
    showToast('Look saved to your wardrobe! ✨', 'success');
  }, [aiResultUrl, selectedGarment, showToast]);

  const handleDownload = useCallback(() => {
    if (!aiResultUrl) return;
    const a = document.createElement('a');
    a.href = aiResultUrl;
    a.download = `trialshopy-tryon-${selectedGarment?.id ?? 'look'}-${Date.now()}.jpg`;
    a.click();
    showToast('Downloading high-res photograph…', 'info');
  }, [aiResultUrl, selectedGarment, showToast]);

  const handleClearAiResult = useCallback(() => {
    setAiResultUrl(null);
    setAiProgress(null);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-base overflow-hidden">
      <Navbar cameraStatus={camera.status} apiConfigured={true} />

      <main className="flex-1 flex overflow-hidden">
        {/* Left: Clothing Library */}
        <ClothingSidebar selected={selectedGarment} onSelect={handleSelect} />

        {/* Centre: Virtual Mirror */}
        <VirtualMirror
          camera={camera}
          selectedGarment={selectedGarment}
          aiResultUrl={aiResultUrl}
          aiProgress={aiProgress}
          onClearAiResult={handleClearAiResult}
          activePhotoUrl={activePhotoUrl}
          onSelectPhotoUrl={(url) => {
            setActivePhotoUrl(url);
            setAiResultUrl(null);
          }}
          countdown={countdown}
          isFlashing={isFlashing}
          onLandmarksUpdate={handleLandmarksUpdate}
        />

        {/* Right: Outfit Controls */}
        <OutfitControls
          garment={selectedGarment}
          cameraActive={camera.status === 'active'}
          hasActivePhoto={!!activePhotoUrl}
          aiProgress={aiProgress}
          aiResultUrl={aiResultUrl}
          captureTimer={captureTimer}
          onSetCaptureTimer={setCaptureTimer}
          tryOnMode={tryOnMode}
          onSetTryOnMode={setTryOnMode}
          onAiTryOn={handleAiTryOn}
          onReset={handleReset}
          onSave={handleSave}
          onDownload={handleDownload}
          onOpenResultModal={() => setIsResultModalOpen(true)}
        />
      </main>

      {/* High-Resolution Try-On Result Comparison Studio Modal */}
      <TryOnResult
        isOpen={isResultModalOpen}
        resultImage={aiResultUrl}
        originalPhoto={capturedPhotoUrl || activePhotoUrl}
        garment={selectedGarment}
        onSave={handleSave}
        onClose={() => setIsResultModalOpen(false)}
        onRetry={() => {
          setIsResultModalOpen(false);
          handleAiTryOn();
        }}
      />

      {/* Floating Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 px-4 py-2.5 rounded-xl border shadow-card animate-fade-in text-[12px] font-medium max-w-md ${
            toast.type === 'success' ? 'bg-emerald/15 border-emerald/30 text-emerald' :
            toast.type === 'error'   ? 'bg-red-950/85 border-red-800/50 text-red-300' :
                                       'bg-surface/95 border-border text-soft backdrop-blur-md'
          }`}
          role="alert"
        >
          {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
          <span className="truncate">{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
