import React, { useState, useEffect } from 'react';
import { AppNotification } from '../types/notifications';
import { subscribeToInAppNotifications } from '../utils/notifications';
import { X, Check, Snowflake, Sparkles } from 'lucide-react';

interface InAppNotificationBannerProps {
  onMarkTaskDone?: (taskId: string) => void;
  onFreezeAllHabits?: () => void;
}

export const InAppNotificationBanner: React.FC<InAppNotificationBannerProps> = ({
  onMarkTaskDone,
  onFreezeAllHabits,
}) => {
  const [currentNotif, setCurrentNotif] = useState<AppNotification | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToInAppNotifications((notif) => {
      setCurrentNotif(notif);
      setIsVisible(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 6000);
    return () => clearTimeout(timer);
  }, [isVisible, currentNotif]);

  if (!isVisible || !currentNotif) return null;

  return (
    <div className="fixed top-3 inset-x-0 z-50 flex justify-center px-4 pointer-events-none transition-all duration-300">
      <div className="pointer-events-auto w-full max-w-sm bg-slate-900/95 dark:bg-zinc-900/95 text-white backdrop-blur-xl border border-white/20 dark:border-zinc-800 shadow-2xl rounded-3xl p-3.5 flex flex-col gap-2.5 transition-all transform animate-fadeIn">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-white/10 flex items-center justify-center text-lg shrink-0 shadow-2xs">
              {currentNotif.icon || '🔔'}
            </div>
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-rose-400 dark:text-rose-300 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  Уведомление AuraDay
                </span>
              </div>
              <h4 className="text-xs font-bold text-white leading-snug break-words">
                {currentNotif.title}
              </h4>
              <p className="text-[11px] text-slate-300 leading-tight break-words">
                {currentNotif.body}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsVisible(false)}
            className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Action Buttons inside notification banner */}
        {(currentNotif.taskId || currentNotif.type === 'streak_warning') && (
          <div className="flex items-center gap-2 pt-1 border-t border-white/10">
            {currentNotif.taskId && onMarkTaskDone && (
              <button
                type="button"
                onClick={() => {
                  onMarkTaskDone(currentNotif.taskId!);
                  setIsVisible(false);
                }}
                className="flex-1 py-1.5 px-3 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold rounded-xl text-[11px] transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Отметить сделанным</span>
              </button>
            )}

            {currentNotif.type === 'streak_warning' && onFreezeAllHabits && (
              <button
                type="button"
                onClick={() => {
                  onFreezeAllHabits();
                  setIsVisible(false);
                }}
                className="flex-1 py-1.5 px-3 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white font-bold rounded-xl text-[11px] transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Snowflake className="w-3.5 h-3.5" />
                <span>Заморозить все стрики ❄️</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsVisible(false)}
              className="py-1.5 px-3 bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white font-semibold rounded-xl text-[11px] transition cursor-pointer"
            >
              Закрыть
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
