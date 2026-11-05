import React from 'react';
import { ScheduleTask } from '../types/schedule';

interface ActivityRingsProps {
  tasks: ScheduleTask[];
  completedMap: Record<string, boolean>;
}

export const ActivityRings: React.FC<ActivityRingsProps> = ({
  tasks,
  completedMap,
}) => {
  // Category groups:
  // Ring 1 (Outer, Rose/Coral): Languages & Reading
  const group1 = tasks.filter((t) => t.category === 'languages' || t.category === 'reading');
  const group1Total = group1.length || 1;
  const group1Done = group1.filter((t) => completedMap[t.id]).length;
  const p1 = Math.min(100, Math.round((group1Done / group1Total) * 100));

  // Ring 2 (Middle, Emerald/Teal): Sport & Abs
  const group2 = tasks.filter((t) => t.category === 'gym_sport' || t.category === 'abs');
  const group2Total = group2.length || 1;
  const group2Done = group2.filter((t) => completedMap[t.id]).length;
  const p2 = Math.min(100, Math.round((group2Done / group2Total) * 100));

  // Ring 3 (Inner, Sky/Indigo): Career (Product Analyst) & Tutoring & University
  const group3 = tasks.filter((t) => t.category === 'career' || t.category === 'tutoring' || t.category === 'study_uni');
  const group3Total = group3.length || 1;
  const group3Done = group3.filter((t) => completedMap[t.id]).length;
  const p3 = Math.min(100, Math.round((group3Done / group3Total) * 100));

  // SVG Geometry
  const size = 110;
  const strokeWidth = 8;
  const center = size / 2;

  const r1 = 46;
  const c1 = 2 * Math.PI * r1;
  const offset1 = c1 - (p1 / 100) * c1;

  const r2 = 34;
  const c2 = 2 * Math.PI * r2;
  const offset2 = c2 - (p2 / 100) * c2;

  const r3 = 22;
  const c3 = 2 * Math.PI * r3;
  const offset3 = c3 - (p3 / 100) * c3;

  const totalTasks = tasks.length || 1;
  const totalDone = tasks.filter((t) => completedMap[t.id]).length;
  const overallPercent = Math.round((totalDone / totalTasks) * 100);

  return (
    <div className="bg-white/90 dark:bg-[#202025] backdrop-blur-md border border-slate-200/70 dark:border-zinc-800 rounded-3xl p-4 shadow-xs dark:shadow-md flex items-center justify-between gap-4 transition-all duration-300">
      <div className="relative shrink-0 w-[110px] h-[110px]">
        <svg className="w-full h-full -rotate-90 transform" viewBox={`0 0 ${size} ${size}`}>
          {/* Background track rings (light / dark adapted) */}
          <circle
            cx={center}
            cy={center}
            r={r1}
            strokeWidth={strokeWidth}
            fill="transparent"
            className="stroke-rose-100 dark:stroke-rose-950/60 transition-colors"
          />
          <circle
            cx={center}
            cy={center}
            r={r2}
            strokeWidth={strokeWidth}
            fill="transparent"
            className="stroke-teal-100 dark:stroke-teal-950/60 transition-colors"
          />
          <circle
            cx={center}
            cy={center}
            r={r3}
            strokeWidth={strokeWidth}
            fill="transparent"
            className="stroke-indigo-100 dark:stroke-indigo-950/60 transition-colors"
          />

          {/* Active progress rings */}
          <circle
            cx={center}
            cy={center}
            r={r1}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={c1}
            strokeDashoffset={offset1}
            strokeLinecap="round"
            className="stroke-rose-500 dark:stroke-rose-400 transition-all duration-700 ease-out"
          />
          <circle
            cx={center}
            cy={center}
            r={r2}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={c2}
            strokeDashoffset={offset2}
            strokeLinecap="round"
            className="stroke-teal-500 dark:stroke-teal-400 transition-all duration-700 ease-out"
          />
          <circle
            cx={center}
            cy={center}
            r={r3}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={c3}
            strokeDashoffset={offset3}
            strokeLinecap="round"
            className="stroke-indigo-500 dark:stroke-indigo-400 transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-sm font-extrabold text-slate-800 dark:text-zinc-100 font-mono leading-none transition-colors">
            {overallPercent}%
          </span>
          <span className="text-[9px] text-slate-400 dark:text-zinc-400 font-semibold uppercase tracking-tighter mt-0.5 transition-colors">
            Сегодня
          </span>
        </div>
      </div>

      {/* Legend & Stats */}
      <div className="flex-1 space-y-1.5 min-w-0">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 truncate">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400 dark:bg-rose-500 shrink-0" />
            <span className="text-slate-700 dark:text-zinc-200 font-medium truncate transition-colors">
              Языки & Книга
            </span>
          </div>
          <span className="font-mono font-bold text-rose-500 dark:text-rose-400 text-[11px] shrink-0">
            {p1}%
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 truncate">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 dark:bg-teal-500 shrink-0" />
            <span className="text-slate-700 dark:text-zinc-200 font-medium truncate transition-colors">
              Спорт & Пресс
            </span>
          </div>
          <span className="font-mono font-bold text-teal-600 dark:text-teal-400 text-[11px] shrink-0">
            {p2}%
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 truncate">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 dark:bg-indigo-500 shrink-0" />
            <span className="text-slate-700 dark:text-zinc-200 font-medium truncate transition-colors">
              Аналитика & Вуз
            </span>
          </div>
          <span className="font-mono font-bold text-indigo-500 dark:text-indigo-400 text-[11px] shrink-0">
            {p3}%
          </span>
        </div>

        <div className="pt-1 text-[11px] text-slate-400 dark:text-zinc-400 italic transition-colors">
          {overallPercent === 100 
            ? '🎉 Потрясающий день! Все цели закрыты!' 
            : overallPercent >= 50 
            ? '✨ Отличный темп, больше половины сделано!' 
            : '🌸 Шаг за шагом к цели без спешки и стресса.'}
        </div>
      </div>
    </div>
  );
};
