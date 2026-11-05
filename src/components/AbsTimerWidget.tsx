import React, { useState, useEffect } from 'react';
import { Utensils, Timer, CheckCircle, RotateCcw, Flame } from 'lucide-react';
import { sounds } from '../utils/audio';

interface AbsTimerWidgetProps {
  lastEatTimestamp: number | null;
  onSetLastEat: (timestamp: number | null) => void;
  onMarkAbsCompleted?: () => void;
  soundEnabled: boolean;
}

export const AbsTimerWidget: React.FC<AbsTimerWidgetProps> = ({
  lastEatTimestamp,
  onSetLastEat,
  onMarkAbsCompleted,
  soundEnabled,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [isAlerted, setIsAlerted] = useState(false);

  useEffect(() => {
    if (!lastEatTimestamp) {
      setSecondsRemaining(null);
      setIsAlerted(false);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - lastEatTimestamp) / 1000);
      const remaining = Math.max(0, 3600 - elapsed); // 60 minutes = 3600 seconds
      setSecondsRemaining(remaining);

      if (remaining === 0 && !isAlerted) {
        setIsAlerted(true);
        sounds.playCelebration(soundEnabled);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastEatTimestamp, isAlerted, soundEnabled]);

  const handleStartTimer = () => {
    const now = Date.now();
    onSetLastEat(now);
    sounds.playCheck(soundEnabled);
    setIsAlerted(false);
  };

  const handleReset = () => {
    onSetLastEat(null);
    setSecondsRemaining(null);
    setIsAlerted(false);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Progress percentage (0% to 100% of 60 mins)
  const progressPercent = secondsRemaining !== null 
    ? Math.min(100, Math.max(0, Math.round(((3600 - secondsRemaining) / 3600) * 100)))
    : 0;

  return (
    <div className="bg-gradient-to-br from-teal-50/90 via-emerald-50/70 to-cyan-50/80 border border-teal-100 rounded-3xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-2xl bg-teal-100/80 text-teal-700 flex items-center justify-center font-bold text-sm shadow-xs">
            ⚡
          </div>
          <div>
            <h4 className="text-xs font-bold text-teal-950 uppercase tracking-wider">
              Таймер пресса после еды
            </h4>
            <p className="text-[11px] text-teal-700/80 font-medium">
              Правило: качать пресс не менее чем через 1 час после приема пищи
            </p>
          </div>
        </div>

        {lastEatTimestamp && (
          <button
            onClick={handleReset}
            title="Сбросить таймер"
            className="p-1.5 text-teal-600/70 hover:text-teal-800 hover:bg-teal-100/50 rounded-xl transition"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
      </div>

      {secondsRemaining === null ? (
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
          <button
            onClick={handleStartTimer}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white text-xs font-semibold rounded-2xl shadow-sm transition"
          >
            <Utensils className="w-4 h-4" />
            <span>Я только что поела (запустить таймер 1 час)</span>
          </button>
        </div>
      ) : secondsRemaining > 0 ? (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-teal-800 flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-teal-600 animate-spin" style={{ animationDuration: '4s' }} />
              Идет усвоение пищи:
            </span>
            <span className="font-mono text-sm font-bold text-teal-900 bg-white/80 px-2 py-0.5 rounded-lg border border-teal-100">
              {formatTime(secondsRemaining)}
            </span>
          </div>

          <div className="w-full bg-teal-200/50 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full rounded-full transition-all duration-1000"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[10px] text-teal-600 font-medium">
            <span>Прошло: {Math.floor((3600 - secondsRemaining) / 60)} мин</span>
            <span>Пресс разрешен в: {new Date((lastEatTimestamp || Date.now()) + 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-100/90 border border-emerald-300/60 rounded-2xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-emerald-600 animate-bounce" />
            <div>
              <div className="text-xs font-bold text-emerald-900">Прошел 1 час!</div>
              <div className="text-[11px] text-emerald-700">Идеальное время для 30 минут пресса!</div>
            </div>
          </div>
          {onMarkAbsCompleted && (
            <button
              onClick={() => {
                onMarkAbsCompleted();
                handleReset();
              }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Готово
            </button>
          )}
        </div>
      )}
    </div>
  );
};
