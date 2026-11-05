import React from 'react';
import { Smartphone } from 'lucide-react';

interface IPhoneFrameProps {
  children: React.ReactNode;
  showFrame: boolean;
  onToggleFrame: () => void;
}

export const IPhoneFrame: React.FC<IPhoneFrameProps> = ({
  children,
  showFrame,
  onToggleFrame,
}) => {
  return (
    <div className="min-h-[100dvh] bg-[#f2eee9] dark:bg-[#0c0c0e] text-slate-800 dark:text-zinc-100 flex flex-col items-center justify-start sm:py-6 sm:px-4 relative font-sans transition-colors duration-300">
      {/* Top Floating Viewport Control on Desktop */}
      <div className="hidden sm:flex items-center gap-2 mb-3 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-200/80 dark:border-zinc-800 shadow-sm z-40 transition-colors">
        <Smartphone className="w-3.5 h-3.5 text-rose-500" />
        <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Формат устройства:</span>
        <button
          onClick={onToggleFrame}
          className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            showFrame
              ? 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200'
          }`}
        >
          {showFrame ? 'iPhone 11 (414 × 896)' : 'Широкий экран'}
        </button>
      </div>

      {/* Main Container: Exact iPhone 11 bezel on desktop (414x896) or full screen on mobile without fake status bar */}
      <div
        className={`w-full transition-all duration-300 relative flex flex-col ${
          showFrame
            ? 'sm:w-[414px] sm:max-w-[414px] sm:h-[896px] sm:rounded-[44px] sm:border-[10px] sm:border-[#1d1d20] dark:sm:border-[#27272a] sm:shadow-[0_25px_70px_rgba(0,0,0,0.28)] sm:ring-1 sm:ring-black/20 overflow-hidden bg-[#fbf8f5] dark:bg-[#18181b] min-h-[100dvh] sm:min-h-0'
            : 'max-w-2xl min-h-[100dvh] sm:min-h-0 sm:rounded-3xl sm:border sm:border-slate-200/60 dark:sm:border-zinc-800 sm:shadow-lg bg-[#fbf8f5] dark:bg-[#18181b]'
        }`}
      >
        {/* Scrollable Screen Content (With native safe-area-inset for real iPhone) */}
        <div className="flex-1 overflow-y-auto no-scrollbar relative flex flex-col pt-safe">
          {children}
        </div>
      </div>
    </div>
  );
};
