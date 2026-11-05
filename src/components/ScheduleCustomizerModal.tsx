import React, { useState } from 'react';
import { UserScheduleConfig, DayOfWeek, ScheduleTask, HabitStreak } from '../types/schedule';
import { DAYS_INFO } from '../data/defaultSchedule';
import {
  X,
  Moon,
  Sun,
  Dumbbell,
  GraduationCap,
  Bell,
  Volume2,
  RotateCcw,
  Sparkles,
  Check,
  Heart,
  Zap,
  Flame,
  Trash2,
} from 'lucide-react';
import { requestNotificationPermission } from '../utils/notifications';

interface ScheduleCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: UserScheduleConfig;
  onUpdateConfig: (newConfig: UserScheduleConfig) => void;
  tasks: ScheduleTask[];
  onUpdatePairTime: (day: DayOfWeek, startTime: string, endTime: string) => void;
  onTriggerRecalculate: (cfg?: UserScheduleConfig) => void;
  onResetToDefault: () => void;
  habits?: HabitStreak[];
  onDeleteHabit?: (habitId: string) => void;
  onToggleUniversityDay?: (day: DayOfWeek) => void;
  themeMode?: 'auto' | 'light' | 'dark';
  onSetThemeMode?: (mode: 'auto' | 'light' | 'dark') => void;
}

export const ScheduleCustomizerModal: React.FC<ScheduleCustomizerModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  tasks,
  onUpdatePairTime,
  onTriggerRecalculate,
  onResetToDefault,
  habits,
  onDeleteHabit,
  onToggleUniversityDay,
  themeMode,
  onSetThemeMode,
}) => {
  const days: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const uniDays: { day: DayOfWeek; label: string }[] = [
    { day: 'mon', label: 'Понедельник' },
    { day: 'tue', label: 'Вторник' },
    { day: 'wed', label: 'Среда' },
    { day: 'thu', label: 'Четверг' },
  ];

  const getPairTimes = (day: DayOfWeek) => {
    const p = tasks.find((t) => t.days.includes(day) && t.category === 'study_uni');
    return {
      startTime: p ? p.startTime : '18:00',
      endTime: p ? p.endTime : '20:40',
    };
  };

  const toggleGymDay = (day: DayOfWeek) => {
    let updated = [...config.gymDays];
    if (updated.includes(day)) {
      if (updated.length > 1) {
        updated = updated.filter((d) => d !== day);
      }
    } else {
      updated.push(day);
    }
    const newCfg = { ...config, gymDays: updated };
    onUpdateConfig(newCfg);
    onTriggerRecalculate(newCfg);
  };

  const handleWakeUpChange = (key: keyof UserScheduleConfig, val: string) => {
    const newCfg = { ...config, [key]: val };
    onUpdateConfig(newCfg);
    onTriggerRecalculate(newCfg);
  };

  const handleRequestNotifications = async () => {
    if (!config.notificationsEnabled) {
      await requestNotificationPermission();
      onUpdateConfig({ ...config, notificationsEnabled: true });
    } else {
      onUpdateConfig({ ...config, notificationsEnabled: false });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 rounded-t-[32px] sm:rounded-[32px] w-full max-w-md shadow-2xl border-t sm:border border-slate-100 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[88vh] sm:max-h-[90vh] text-slate-800 dark:text-zinc-100 transition-colors">
        {/* iOS Pull Down Grabber Bar */}
        <div className="w-full pt-2.5 pb-1 flex justify-center sm:hidden shrink-0">
          <div className="w-10 h-1 bg-slate-300 dark:bg-zinc-600 rounded-full" />
        </div>
        {/* Header */}
        <div className="p-4 px-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 flex items-center justify-center text-sm">
              ⚙️
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100">
                Настройка под твой ритм
              </h3>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <Zap className="w-3 h-3 fill-emerald-500" /> Авто-пересчет расписания активен
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* 1. University Pairs Times (Auto-adjusts prep & travel) */}
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-indigo-600 shrink-0" />
                <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                  Расписание пар в вузе
                </h4>
              </div>
              <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold shrink-0">
                На все недели
              </span>
            </div>
            <p className="text-[11px] text-indigo-700/80 leading-normal break-words">
              Удаление здесь отключает пары на все недели. (Для отмены только в один день — удалите пару через редактирование карточки):
            </p>

            <div className="space-y-2 pt-1">
              {uniDays.map(({ day, label }) => {
                const isDisabled = Boolean(config.disabledUniversityDays?.includes(day));
                const times = getPairTimes(day);
                return (
                  <div
                    key={day}
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-xs flex-wrap gap-2 transition ${
                      isDisabled
                        ? 'bg-slate-100/70 border-slate-200/80 dark:bg-zinc-800/40 dark:border-zinc-700/60 opacity-80'
                        : 'bg-white/90 dark:bg-zinc-800/90 border-indigo-100/90 dark:border-zinc-700 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${isDisabled ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-zinc-200'} w-24 shrink-0`}>
                        {label}
                      </span>
                      {isDisabled && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                          Пары удалены (на все недели)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {!isDisabled ? (
                        <>
                          <div className="flex items-center gap-1.5 font-mono">
                            <input
                              type="time"
                              value={times.startTime}
                              onChange={(e) => onUpdatePairTime(day, e.target.value, times.endTime)}
                              className="px-2 py-1 bg-indigo-50/50 dark:bg-zinc-700 border border-indigo-200/80 dark:border-zinc-600 rounded-lg text-xs font-bold text-indigo-900 dark:text-indigo-200"
                            />
                            <span className="text-slate-400">–</span>
                            <input
                              type="time"
                              value={times.endTime}
                              onChange={(e) => onUpdatePairTime(day, times.startTime, e.target.value)}
                              className="px-2 py-1 bg-indigo-50/50 dark:bg-zinc-700 border border-indigo-200/80 dark:border-zinc-600 rounded-lg text-xs font-bold text-indigo-900 dark:text-indigo-200"
                            />
                          </div>
                          {onToggleUniversityDay && (
                            <button
                              type="button"
                              onClick={() => onToggleUniversityDay(day)}
                              title={`Удалить пары (${label}) на все недели`}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition cursor-pointer active:scale-95"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      ) : (
                        onToggleUniversityDay && (
                          <button
                            type="button"
                            onClick={() => onToggleUniversityDay(day)}
                            className="px-2.5 py-1 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Вернуть пары</span>
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Sleep & Wakeup section */}
          <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Moon className="w-4 h-4 text-indigo-500" />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Сон и время подъема
              </h4>
            </div>
            <p className="text-[11px] text-slate-500">
              Сон в радость: утро и завтрак подстроятся автоматически.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Будни (Пн, Вт, Ср, Пт)
                </label>
                <input
                  type="time"
                  value={config.wakeUpTimeWeekday}
                  onChange={(e) => handleWakeUpChange('wakeUpTimeWeekday', e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Четверг (под пары)
                </label>
                <input
                  type="time"
                  value={config.wakeUpTimeThursday}
                  onChange={(e) => handleWakeUpChange('wakeUpTimeThursday', e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-mono font-bold"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Выходные (Сб, Вс — сладкий сон)
                </label>
                <input
                  type="time"
                  value={config.wakeUpTimeWeekend}
                  onChange={(e) => handleWakeUpChange('wakeUpTimeWeekend', e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-mono font-bold"
                />
              </div>

              {config.wakeUpTimeWeekday > '11:30' && (
                <div className="col-span-2 p-2.5 bg-rose-50 border border-rose-300 rounded-xl text-[11px] text-rose-950 font-medium flex items-start gap-2 shadow-xs">
                  <span className="text-rose-600 font-bold shrink-0 mt-0.5">⛔</span>
                  <span className="min-w-0 break-words leading-relaxed">
                    <strong>Учебные дни (Пн, Вт, Ср):</strong> Подъем позже 11:30 может сместить обязательные дела перед парами. В легком режиме доступен комфортный сон до 11:30. С пятницы по воскресенье можно сдвигать свободно без запретов.
                  </span>
                </div>
              )}

              {config.wakeUpTimeWeekday >= '10:00' && config.wakeUpTimeWeekday <= '11:30' && (
                <div className="col-span-2 p-2.5 bg-sky-50 border border-sky-200 rounded-xl text-[11px] text-sky-950 font-medium flex items-center gap-2">
                  <span className="text-sky-600 font-bold shrink-0">🌙</span>
                  <span className="min-w-0 break-words leading-relaxed">
                    <strong>Легкий режим:</strong> Окно сна до 11:30 полностью поддерживается во всех днях — второстепенные дела скрываются, и все обязательные дела успеваются до пар!
                  </span>
                </div>
              )}

              {config.wakeUpTimeThursday > '09:00' && (
                <div className="col-span-2 p-2.5 bg-rose-50 border border-rose-300 rounded-xl text-[11px] text-rose-950 font-medium flex items-start gap-2 shadow-xs">
                  <span className="text-rose-600 font-bold shrink-0 mt-0.5">⛔</span>
                  <span className="min-w-0 break-words leading-relaxed">
                    <strong>Четверг:</strong> Пары начинаются строго в 10:00 (сборы в 09:00). Подъем не может быть позже 09:00, чтобы не опоздать на пары! Рекомендуется 08:30.
                  </span>
                </div>
              )}

              <div className="col-span-2 p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-[11px] text-emerald-950 font-medium flex items-center gap-2">
                <span className="text-emerald-600 font-bold shrink-0">✨</span>
                <span className="min-w-0 break-words leading-relaxed">
                  <strong>С пятницы по воскресенье:</strong> Полная свобода — можно спать сколько угодно и сдвигать любые дела без запретов!
                </span>
              </div>
            </div>
          </div>

          {/* 3. Gym Schedule */}
          <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                  Дни зала (2 раза в неделю)
                </h4>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                1ч зал + 30м пресс
              </span>
            </div>
            <p className="text-[11px] text-emerald-700/80">
              Нажмите на день недели — тренировка, сборы (10м), дорога (10м) и душ автоматически перенесутся:
            </p>

            <div className="flex gap-1 justify-between">
              {days.map((d) => {
                const isSelected = config.gymDays.includes(d);
                return (
                  <button
                    type="button"
                    key={d}
                    onClick={() => toggleGymDay(d)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-xs scale-105'
                        : 'bg-white text-emerald-900 border border-emerald-200/60 hover:bg-emerald-100/50'
                    }`}
                  >
                    {DAYS_INFO[d].shortName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Notifications & Sound */}
          <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-rose-500" />
              <h4 className="text-xs font-bold text-rose-950 uppercase tracking-wider">
                Звуки & Напоминания
              </h4>
            </div>

            <div className="space-y-2 pt-1">
              <label className="flex items-center justify-between text-xs cursor-pointer">
                <span className="text-slate-700 font-medium flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-rose-400" />
                  Приятные мягкие звуки нажатия
                </span>
                <input
                  type="checkbox"
                  checked={config.soundEnabled}
                  onChange={(e) => onUpdateConfig({ ...config, soundEnabled: e.target.checked })}
                  className="w-4 h-4 rounded text-rose-500 accent-rose-500 cursor-pointer"
                />
              </label>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-700 font-medium flex items-center gap-2">
                  <Bell className="w-4 h-4 text-rose-400" />
                  Уведомления и напоминания
                </span>
                <button
                  type="button"
                  onClick={handleRequestNotifications}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-xl transition cursor-pointer ${
                    config.notificationsEnabled
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-rose-200/80 text-rose-800 hover:bg-rose-300'
                  }`}
                >
                  {config.notificationsEnabled ? 'Включены ✓' : 'Включить'}
                </button>
              </div>
            </div>
          </div>

          {/* 5. Habits & Streaks Management */}
          {habits && habits.length > 0 && (
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
                <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                  Управление стриками и привычками ({habits.length})
                </h4>
              </div>
              <p className="text-[11px] text-amber-800/80 leading-tight">
                Здесь можно удалить любую привычку или сбросить стрик:
              </p>

              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {habits.map((h) => (
                  <div
                    key={h.id}
                    className="bg-white p-2.5 rounded-xl border border-amber-100/90 flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base shrink-0">{h.icon}</span>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-800 block break-words leading-tight">{h.title}</span>
                        <span className="text-[10px] text-slate-400">
                          Стрик: {h.streakDays} дн. {h.isFrozen ? '• Заморожен ❄️' : ''}
                        </span>
                      </div>
                    </div>
                    {onDeleteHabit && (
                      <button
                        type="button"
                        onClick={() => onDeleteHabit(h.id)}
                        className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer shrink-0"
                        title="Удалить стрик"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Manual Recalculate Button */}
          <button
            type="button"
            onClick={() => {
              onTriggerRecalculate(config);
            }}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl text-xs font-bold shadow-sm transition flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <Sparkles className="w-4 h-4" />
            <span>Пересчитать расписание прямо сейчас</span>
          </button>

          {/* Modal Actions */}
          <div
            className="pt-2 flex justify-end items-center border-t border-slate-100 dark:border-zinc-800"
            style={{ paddingBottom: 'max(1.25rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))' }}
          >
            <button
              onClick={onClose}
              className="w-full h-11 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl text-xs font-bold shadow-md hover:opacity-90 transition text-center cursor-pointer"
            >
              Готово
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
