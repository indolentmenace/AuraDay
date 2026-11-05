import React from 'react';
import { DayOfWeek, DayInfo } from '../types/schedule';
import { DAYS_INFO } from '../data/defaultSchedule';
import { WeekInfo } from '../utils/dateUtils';
import { Check, ChevronLeft, ChevronRight, History, RotateCcw, Calendar } from 'lucide-react';

interface DaySelectorProps {
  selectedDay: DayOfWeek;
  onSelectDay: (day: DayOfWeek) => void;
  dayStats: Record<DayOfWeek, { total: number; completed: number }>;
  weekInfo: WeekInfo;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  onResetToCurrentWeek?: () => void;
}

export const DaySelector: React.FC<DaySelectorProps> = ({
  selectedDay,
  onSelectDay,
  dayStats,
  weekInfo,
  onPrevWeek,
  onNextWeek,
  onResetToCurrentWeek,
}) => {
  const days: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const isPast = weekInfo?.weekOffset < 0;
  const isFuture = weekInfo?.weekOffset > 0;

  return (
    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-slate-200/70 dark:border-zinc-800 rounded-3xl p-2.5 shadow-2xs space-y-2 transition-colors">
      {/* Integrated Week Navigation Header */}
      <div className="flex items-center justify-between px-1 text-xs">
        {/* Left Arrow: Previous Week */}
        <button
          type="button"
          onClick={onPrevWeek}
          title="Предыдущая неделя"
          className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 active:scale-95 text-slate-700 dark:text-zinc-200 flex items-center justify-center transition cursor-pointer shrink-0"
        >
          <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
        </button>

        {/* Center: Week Range & Badge */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-bold text-slate-800 dark:text-slate-100 text-xs">
            {weekInfo?.formattedRange}
          </span>
          {isPast ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-800/60 shrink-0">
              <History className="w-2.5 h-2.5" />
              <span>Архив</span>
            </span>
          ) : isFuture ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 shrink-0">
              План
            </span>
          ) : (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 shrink-0">
              Текущая
            </span>
          )}
        </div>

        {/* Right Arrow & Quick Return */}
        <div className="flex items-center gap-1 shrink-0">
          {weekInfo && !weekInfo.isCurrentWeek && onResetToCurrentWeek && (
            <button
              type="button"
              onClick={onResetToCurrentWeek}
              title="К текущей неделе"
              className="px-2 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer border border-rose-200/60 dark:border-rose-800/60"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Сегодня</span>
            </button>
          )}

          <button
            type="button"
            onClick={onNextWeek}
            disabled={weekInfo?.weekOffset >= 1}
            title="Следующая неделя"
            className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none active:scale-95 text-slate-700 dark:text-slate-200 flex items-center justify-center transition cursor-pointer"
          >
            <ChevronRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* 7-Day Date Pills Row - Fixed 7 columns, zero scrollbars */}
      <div className="w-full pt-0.5">
        <div className="grid grid-cols-7 gap-1 w-full">
          {days.map((dayKey) => {
            const info = DAYS_INFO[dayKey];
            const isSelected = selectedDay === dayKey;
            const stats = dayStats[dayKey] || { total: 0, completed: 0 };
            const isAllDone = stats.total > 0 && stats.completed === stats.total;
            const percent = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
            const dayNumber = weekInfo?.dayDates[dayKey]?.dayOfMonth;

            return (
              <button
                key={dayKey}
                onClick={() => onSelectDay(dayKey)}
                className={`flex flex-col items-center justify-between py-1.5 px-0.5 rounded-2xl transition-all duration-150 relative select-none cursor-pointer min-w-0 ${
                  isSelected
                    ? 'bg-slate-900 dark:bg-rose-600 text-white shadow-md'
                    : 'bg-white/70 dark:bg-zinc-800/70 hover:bg-white dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-100/90 dark:border-zinc-700/60 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-0.5 justify-center min-w-0">
                  <span
                    className={`text-[11px] font-semibold tracking-wide ${
                      isSelected ? 'text-slate-300 dark:text-rose-100' : 'text-slate-400 dark:text-slate-400'
                    }`}
                  >
                    {info.shortName}
                  </span>
                  {dayNumber && (
                    <span
                      className={`text-[10px] font-bold ${
                        isSelected ? 'text-rose-300 dark:text-white' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {dayNumber}
                    </span>
                  )}
                </div>

                <div className="my-1 flex items-center justify-center">
                  {isAllDone ? (
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        isSelected ? 'bg-emerald-400 text-slate-900' : 'bg-emerald-500 text-white'
                      }`}
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  ) : (
                    <span
                      className={`text-xs sm:text-sm font-bold font-mono ${
                        isSelected ? 'text-white' : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {stats.completed}/{stats.total}
                    </span>
                  )}
                </div>

                {/* Mini progress bar under day */}
                <div className="w-5 sm:w-6 h-1 rounded-full bg-slate-200/50 dark:bg-slate-700/60 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isAllDone
                        ? 'bg-emerald-400'
                        : isSelected
                        ? 'bg-rose-400 dark:bg-white'
                        : 'bg-indigo-300 dark:bg-indigo-400'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>

                {/* Special indicator for gym days */}
                {dayKey === 'wed' || dayKey === 'fri' ? (
                  <span className="absolute -top-1 -right-0.5 text-[8px] w-3.5 h-3.5 rounded-full bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-100 flex items-center justify-center font-bold shadow-2xs">
                    💪
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
