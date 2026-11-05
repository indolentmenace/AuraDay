import React from 'react';
import { EnergyLevel } from '../utils/energyMode';
import { DayOfWeek } from '../types/schedule';
import { DAYS_INFO } from '../data/defaultSchedule';
import { X, Zap, BatteryCharging, HeartPulse, Check, Sparkles, Snowflake, ArrowRight } from 'lucide-react';

interface EnergyModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDay: DayOfWeek;
  currentLevel: EnergyLevel;
  onSelectLevel: (level: EnergyLevel, applyToAllDays?: boolean) => void;
  onFreezeAllHabits?: () => void;
  totalTasksCount: number;
  lightTasksCount: number;
}

export const EnergyModeModal: React.FC<EnergyModeModalProps> = ({
  isOpen,
  onClose,
  selectedDay,
  currentLevel,
  onSelectLevel,
  onFreezeAllHabits,
  totalTasksCount,
  lightTasksCount,
}) => {
  if (!isOpen) return null;

  const dayName = DAYS_INFO[selectedDay]?.name || 'день';
  const hiddenCount = Math.max(0, totalTasksCount - lightTasksCount);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white dark:bg-[#1a1a1e] rounded-t-[32px] sm:rounded-[32px] w-full max-w-md shadow-2xl border-t sm:border border-slate-200/80 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[85vh] text-slate-800 dark:text-zinc-100 transition-colors">
        {/* iOS Pull Down Grabber Bar */}
        <div className="w-full pt-2.5 pb-1 flex justify-center sm:hidden shrink-0">
          <div className="w-10 h-1 bg-slate-300 dark:bg-zinc-600 rounded-full" />
        </div>
        {/* Header */}
        <div className="p-4 px-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center text-sm shadow-2xs">
              🔋
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100">
                Режим дня & Энергия
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
                Адаптивный график для: <strong className="text-slate-700 dark:text-zinc-200">{dayName}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 flex items-center justify-center text-slate-500 dark:text-slate-400 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-3.5 overflow-y-auto">
          {/* Quick Explanation */}
          <div className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-2xl border border-slate-200/50 dark:border-zinc-700/60 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span className="leading-snug">
              В обычные дни расписание содержит 17–20 дел. Если нет сил или недомогание, включи <strong>«Легкий режим»</strong>, чтобы сохранить стрики и восстановиться без чувства вины.
            </span>
          </div>

          {/* Option 1: Full Energy */}
          <button
            type="button"
            onClick={() => {
              onSelectLevel('full');
              onClose();
            }}
            className={`w-full p-3.5 rounded-2xl border-2 transition-all cursor-pointer text-left flex items-start justify-between gap-3 ${
              currentLevel === 'full'
                ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-500 shadow-xs'
                : 'bg-white dark:bg-[#1f1f23] border-slate-200/70 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 fill-emerald-500 text-emerald-500" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-100">
                    ⚡ Полная энергия (100%)
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-200">
                    Обычный ритм
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-snug">
                  Все {totalTasksCount} задач дня. Полные блоки по аналитике, языкам, парам и спорту.
                </p>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 ${
                currentLevel === 'full'
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : 'border-slate-300 dark:border-zinc-600'
              }`}
            >
              {currentLevel === 'full' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </button>

          {/* Option 2: Light Energy Mode (Recommended) */}
          <button
            type="button"
            onClick={() => {
              onSelectLevel('low');
              onClose();
            }}
            className={`w-full p-3.5 rounded-2xl border-2 transition-all cursor-pointer text-left flex items-start justify-between gap-3 ${
              currentLevel === 'low'
                ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-500 shadow-xs'
                : 'bg-white dark:bg-[#1f1f23] border-slate-200/70 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-2xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <BatteryCharging className="w-5 h-5 text-amber-600" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-100">
                    🔋 Легкий режим (Энергосбережение)
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900/70 dark:text-amber-200">
                    Рекомендуется
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-snug">
                  Скрывает второстепенные дела: <strong>языки, пресс и подготовку к аналитике</strong>. Зал, пары в вузе и базовая рутина остаются в графике!
                </p>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 ${
                currentLevel === 'low'
                  ? 'border-amber-500 bg-amber-500 text-white'
                  : 'border-slate-300 dark:border-zinc-600'
              }`}
            >
              {currentLevel === 'low' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </button>

          {/* Option 3: Sick / Recovery Mode */}
          <button
            type="button"
            onClick={() => {
              onSelectLevel('sick');
              onClose();
            }}
            className={`w-full p-3.5 rounded-2xl border-2 transition-all cursor-pointer text-left flex items-start justify-between gap-3 ${
              currentLevel === 'sick'
                ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-500 shadow-xs'
                : 'bg-white dark:bg-[#1f1f23] border-slate-200/70 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-2xl bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0">
                <HeartPulse className="w-5 h-5 text-rose-600" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-100">
                    🤒 Восстановление & Болезнь
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-rose-100 text-rose-900 dark:bg-rose-900/70 dark:text-rose-200">
                    Максимум покоя
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-snug">
                  Когда очень плохо: отменяются языки, пресс, аналитика <strong>и зал</strong>. Оставляем только сон, чай, еду и обязательные пары в вузе.
                </p>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 ${
                currentLevel === 'sick'
                  ? 'border-rose-500 bg-rose-500 text-white'
                  : 'border-slate-300 dark:border-zinc-600'
              }`}
            >
              {currentLevel === 'sick' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </button>

          {/* Sick helper button: Freeze all habits */}
          {onFreezeAllHabits && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  onFreezeAllHabits();
                  onSelectLevel('sick');
                  onClose();
                }}
                className="w-full py-2.5 px-3 rounded-2xl bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <Snowflake className="w-4 h-4 text-sky-600" />
                <span>Заморозить все стрики на время болезни ❄️</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          className="pt-3.5 px-6 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/60 flex items-center justify-between gap-3"
          style={{ paddingBottom: 'max(1.25rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))' }}
        >
          <button
            type="button"
            onClick={() => {
              onSelectLevel('low', true);
              onClose();
            }}
            className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
          >
            Включить на всю неделю
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold text-xs shadow-xs hover:opacity-90 transition cursor-pointer"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};
