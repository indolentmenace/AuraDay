import React, { useState } from 'react';
import { ScheduleTask } from '../types/schedule';
import { CATEGORY_INFO } from '../data/defaultSchedule';
import { Sparkles, ChevronDown, CheckCircle2, Clock } from 'lucide-react';

interface DynamicIslandProps {
  currentTask?: ScheduleTask | null;
  nextTask?: ScheduleTask | null;
  totalCompletedCount: number;
  totalTaskCount: number;
}

export const DynamicIsland: React.FC<DynamicIslandProps> = ({
  currentTask,
  nextTask,
  totalCompletedCount,
  totalTaskCount,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const percent = totalTaskCount > 0 ? Math.round((totalCompletedCount / totalTaskCount) * 100) : 0;

  return (
    <div className="w-full flex justify-center pt-1.5 pb-2 px-4 select-none shrink-0 z-20">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={`bg-slate-900/95 dark:bg-zinc-900/95 text-white backdrop-blur-xl border border-white/10 dark:border-zinc-800 shadow-md transition-all duration-300 ease-out cursor-pointer active:scale-[0.99] ${
          isExpanded
            ? 'w-full max-w-[382px] rounded-3xl p-4 shadow-xl'
            : 'h-[36px] px-3.5 rounded-full flex items-center justify-between gap-3 w-full max-w-[340px]'
        }`}
      >
        {!isExpanded ? (
          <>
            <div className="flex items-center gap-2 text-xs font-semibold truncate min-w-0">
              {currentTask ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="text-emerald-300 text-[11px] font-mono shrink-0">{currentTask.startTime}</span>
                  <span className="truncate text-slate-100">{currentTask.title}</span>
                </>
              ) : nextTask ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-amber-300 text-[11px] font-mono shrink-0">{nextTask.startTime}</span>
                  <span className="truncate text-slate-100">{nextTask.title}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                  <span className="truncate text-slate-100">Ритм дня активен</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-300 font-bold shrink-0">
              <span className="text-emerald-400">{percent}%</span>
              <div className="w-8 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 transition-all duration-500 rounded-full"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-rose-500/25 text-rose-300 flex items-center justify-center text-xs">
                  ✨
                </div>
                <div>
                  <span className="text-xs font-bold tracking-wide text-white block">
                    AuraDay Live Rhythm
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Интерактивный виджет дня
                  </span>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </div>

            {currentTask && (
              <div className="bg-white/5 rounded-2xl p-2.5 space-y-1 border border-white/5">
                <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>Идет прямо сейчас</span>
                </div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="shrink-0">{CATEGORY_INFO[currentTask.category]?.emoji}</span>
                  <span className="break-words leading-tight">{currentTask.title}</span>
                </div>
                <div className="text-[11px] text-slate-300 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  <span>{currentTask.startTime} – {currentTask.endTime} ({currentTask.durationMinutes} мин)</span>
                </div>
              </div>
            )}

            {nextTask && (
              <div className="bg-white/5 rounded-2xl p-2.5 space-y-1 border border-white/5">
                <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                  Следующее по расписанию
                </div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="shrink-0">{CATEGORY_INFO[nextTask.category]?.emoji}</span>
                  <span className="break-words leading-tight">{nextTask.title}</span>
                </div>
                <div className="text-[11px] text-slate-300 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>{nextTask.startTime} – {nextTask.endTime} ({nextTask.durationMinutes} мин)</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs pt-1 text-slate-400">
              <span className="flex items-center gap-1 text-[11px] font-medium text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Выполнено {totalCompletedCount} из {totalTaskCount} ({percent}%)
              </span>
              <span className="text-[10px] text-slate-400">Свернуть ▲</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
