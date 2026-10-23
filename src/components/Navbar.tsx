import { Camera, Cpu, Settings, Wifi, WifiOff } from 'lucide-react';
import type { CameraStatus } from '../types';

interface NavbarProps {
  cameraStatus: CameraStatus;
  apiConfigured: boolean;
}

export default function Navbar({ cameraStatus, apiConfigured }: NavbarProps) {
  const camActive = cameraStatus === 'active';
  const camDenied = cameraStatus === 'denied';

  return (
    <header className="flex-none h-14 flex items-center justify-between px-5 border-b border-border bg-surface z-30">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <img src="/logo.png" alt="TRIALSHOPY" className="w-8 h-8 rounded-lg object-cover" />
        <div className="leading-tight">
          <div className="font-display font-bold text-bright text-[15px] tracking-tight">TRIALSHOPY</div>
          <div className="text-[9px] text-muted uppercase tracking-widest font-medium">AI Virtual Try-On</div>
        </div>
      </div>

      {/* Status pills */}
      <div className="flex items-center gap-2">
        {/* Camera status */}
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border ${
          camActive
            ? 'bg-emerald/10 text-emerald border-emerald/20'
            : camDenied
              ? 'bg-red-950 text-red-400 border-red-800/50'
              : 'bg-card text-muted border-border'
        }`}>
          <Camera size={10} />
          {camActive ? 'Camera Live' : camDenied ? 'Denied' : 'Camera Off'}
        </div>

        {/* API status */}
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border ${
          apiConfigured
            ? 'bg-accent/10 text-accent-light border-accent/20'
            : 'bg-card text-muted border-border'
        }`}>
          {apiConfigured ? <Wifi size={10} /> : <WifiOff size={10} />}
          {apiConfigured ? 'AI Ready' : 'Demo Mode'}
        </div>

        {/* AI engine pill */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-card text-muted border border-border">
          <Cpu size={10} />
          Try-On Engine
        </div>

        <button
          className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center text-muted hover:text-bright hover:border-accent/40 transition-all"
          title="Settings"
          aria-label="Settings"
        >
          <Settings size={14} />
        </button>
      </div>
    </header>
  );
}
