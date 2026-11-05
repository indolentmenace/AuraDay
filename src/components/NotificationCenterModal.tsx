import React, { useState, useEffect } from 'react';
import { UserScheduleConfig } from '../types/schedule';
import { AppNotification, NotificationPermissionState } from '../types/notifications';
import {
  requestNotificationPermission,
  getNotificationPermissionStatus,
  getNotificationHistory,
  clearNotificationHistory,
} from '../utils/notifications';
import {
  Bell,
  Clock,
  Flame,
  Sparkles,
  X,
  Volume2,
  Trash2,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: UserScheduleConfig;
  onUpdateConfig: (config: UserScheduleConfig) => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
}) => {
  const [permission, setPermission] = useState<NotificationPermissionState>('default');
  const [history, setHistory] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (isOpen) {
      setPermission(getNotificationPermissionStatus());
      setHistory(getNotificationHistory());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    setPermission(getNotificationPermissionStatus());
    onUpdateConfig({ ...config, notificationsEnabled: granted });
  };

  const handleClearHistory = () => {
    clearNotificationHistory();
    setHistory([]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white dark:bg-[#1a1a1e] rounded-t-[32px] sm:rounded-[32px] w-full max-w-md shadow-2xl border-t sm:border border-slate-200/80 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[88vh] text-slate-800 dark:text-zinc-100 transition-colors">
        {/* iOS Pull Down Grabber Bar */}
        <div className="w-full pt-2.5 pb-1 flex justify-center sm:hidden shrink-0">
          <div className="w-10 h-1 bg-slate-300 dark:bg-zinc-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="p-4 px-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center text-base shadow-2xs">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100">
                Центр уведомлений
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-zinc-400">
                Умные напоминания о делах и защите стриков
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 flex items-center justify-center text-slate-500 dark:text-zinc-400 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 pb-6">
          {/* Main Master Switch & Permission Status Card */}
          <div className="bg-gradient-to-br from-rose-50/80 via-pink-50/40 to-amber-50/50 dark:from-rose-950/30 dark:via-pink-950/20 dark:to-zinc-900 border border-rose-200/70 dark:border-rose-900/50 rounded-3xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 block">
                  Уведомления AuraDay
                </span>
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 block">
                  {config.notificationsEnabled
                    ? 'Активны: напоминания приходят вовремя'
                    : 'Отключены: вы не получаете напоминания'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextVal = !config.notificationsEnabled;
                  if (nextVal && permission !== 'granted') {
                    handleRequestPermission();
                  } else {
                    onUpdateConfig({ ...config, notificationsEnabled: nextVal });
                  }
                }}
                className={`w-12 h-6.5 rounded-full transition-colors relative cursor-pointer p-0.5 ${
                  config.notificationsEnabled
                    ? 'bg-rose-500'
                    : 'bg-slate-300 dark:bg-zinc-700'
                }`}
              >
                <div
                  className={`w-5.5 h-5.5 rounded-full bg-white shadow-sm transition-transform ${
                    config.notificationsEnabled ? 'translate-x-5.5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Browser Permission Badge */}
            <div className="pt-2 border-t border-rose-200/60 dark:border-zinc-800/80 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs">
                {permission === 'granted' ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Разрешено в браузере ✓</span>
                  </span>
                ) : permission === 'denied' ? (
                  <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1 text-[11px]">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Заблокировано браузером</span>
                  </span>
                ) : (
                  <span className="text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1 text-[11px]">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>Внутри приложения (разрешите push)</span>
                  </span>
                )}
              </div>

              {permission !== 'granted' && (
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs active:scale-95"
                >
                  Разрешить Push
                </button>
              )}
            </div>
          </div>

          {/* Detailed Types Preferences */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider px-1">
              Что отправлять:
            </h4>

            <div className="bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/70 dark:border-zinc-800 rounded-3xl p-3 space-y-3">
              {/* Option 1: 15-minute pre-alert */}
              <label className="flex items-start justify-between gap-3 cursor-pointer">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-100 block">
                      За 15 минут до начала дела
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-zinc-400 block">
                      «Через 15 минут: Испанский язык (1.5ч)» — успеете налить чай и настроиться
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.notifyTaskUpcoming !== false}
                  onChange={(e) =>
                    onUpdateConfig({ ...config, notifyTaskUpcoming: e.target.checked })
                  }
                  className="mt-1 w-4 h-4 rounded text-rose-600 accent-rose-600 cursor-pointer"
                />
              </label>

              {/* Option 2: Exact start time */}
              <label className="flex items-start justify-between gap-3 cursor-pointer pt-2 border-t border-slate-200/50 dark:border-zinc-800">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-100 block">
                      В момент начала дела
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-zinc-400 block">
                      «Пора начинать: Пресс (30 мин)» — сразу при переходе к следующему блоку
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.notifyTaskStart !== false}
                  onChange={(e) =>
                    onUpdateConfig({ ...config, notifyTaskStart: e.target.checked })
                  }
                  className="mt-1 w-4 h-4 rounded text-rose-600 accent-rose-600 cursor-pointer"
                />
              </label>

              {/* Option 3: Evening streak burnout warning */}
              <label className="flex items-start justify-between gap-3 cursor-pointer pt-2 border-t border-slate-200/50 dark:border-zinc-800">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-300 flex items-center justify-center shrink-0 mt-0.5">
                    <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-100 block">
                      Защита стриков в 21:00 🔥
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-zinc-400 block">
                      Напомнит за 3 часа до полуночи, если неотмеченные стрики могут сгореть
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.notifyStreakWarning !== false}
                  onChange={(e) =>
                    onUpdateConfig({ ...config, notifyStreakWarning: e.target.checked })
                  }
                  className="mt-1 w-4 h-4 rounded text-rose-600 accent-rose-600 cursor-pointer"
                />
              </label>

              {/* Sound Feedback */}
              <label className="flex items-start justify-between gap-3 cursor-pointer pt-2 border-t border-slate-200/50 dark:border-zinc-800">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0 mt-0.5">
                    <Volume2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-100 block">
                      Звуковой сигнал колокольчика
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-zinc-400 block">
                      Приятный мягкий синтезированный перезвон при уведомлении
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.soundEnabled}
                  onChange={(e) =>
                    onUpdateConfig({ ...config, soundEnabled: e.target.checked })
                  }
                  className="mt-1 w-4 h-4 rounded text-rose-600 accent-rose-600 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* History Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                История ({history.length}):
              </h4>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="text-[11px] text-slate-400 hover:text-rose-500 flex items-center gap-1 transition cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Очистить</span>
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="text-center py-6 px-4 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800">
                <Bell className="w-6 h-6 text-slate-300 dark:text-zinc-600 mx-auto mb-1.5 opacity-60" />
                <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                  Новых уведомлений пока нет
                </p>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
                  Здесь будут сохраняться напоминания о делах и защите стриков
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {history.map((item) => {
                  const date = new Date(item.timestamp);
                  const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date
                    .getMinutes()
                    .toString()
                    .padStart(2, '0')}`;
                  return (
                    <div
                      key={item.id}
                      className="p-3 bg-white dark:bg-zinc-800/80 rounded-2xl border border-slate-200/60 dark:border-zinc-700/80 shadow-2xs flex items-start gap-2.5"
                    >
                      <span className="text-base shrink-0">{item.icon || '🔔'}</span>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-slate-800 dark:text-zinc-100 truncate">
                            {item.title}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {timeStr}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-tight break-words">
                          {item.body}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer with Safe Area */}
        <div
          className="shrink-0 p-4 border-t border-slate-100 dark:border-zinc-800 bg-white/95 dark:bg-[#1a1a1e]/95 backdrop-blur-md"
          style={{ paddingBottom: 'max(1.25rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="w-full h-12 bg-slate-900 dark:bg-rose-600 hover:bg-slate-800 dark:hover:bg-rose-700 text-white font-bold rounded-2xl text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Готово</span>
          </button>
        </div>
      </div>
    </div>
  );
};
