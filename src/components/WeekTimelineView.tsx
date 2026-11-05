import React, { useState } from 'react';
import { ScheduleTask, DayOfWeek, TaskCategory } from '../types/schedule';
import { DAYS_INFO, CATEGORY_INFO } from '../data/defaultSchedule';
import { WeekInfo } from '../utils/dateUtils';
import { sortDayTasksWithWakeUpFirst } from '../utils/scheduleEngine';
import { Clock, Filter, Sparkles } from 'lucide-react';

interface WeekTimelineViewProps {
  tasks: ScheduleTask[];
  onSelectDay: (day: DayOfWeek) => void;
  weekInfo?: WeekInfo;
}

export const WeekTimelineView: React.FC<WeekTimelineViewProps> = ({
  tasks,
  onSelectDay,
  weekInfo,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<TaskCategory | 'all'>('all');

  const days: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  const filteredTasks = (day: DayOfWeek) => {
    const list = tasks
      .filter((t) => t.days.includes(day))
      .filter((t) => (selectedFilter === 'all' ? true : t.category === selectedFilter));
    return sortDayTasksWithWakeUpFirst(list);
  };

  const filters: { key: TaskCategory | 'all'; label: string; icon: string }[] = [
    { key: 'all', label: 'Вся неделя', icon: '✨' },
    { key: 'study_uni', label: 'Вуз & Пары', icon: '🎓' },
    { key: 'tutoring', label: 'Репетиторство', icon: '📐' },
    { key: 'gym_sport', label: 'Зал & Спорт', icon: '💪' },
    { key: 'languages', label: 'Испанский & Англ', icon: '🇪🇸' },
    { key: 'career', label: 'Аналитик Junior', icon: '📊' },
  ];

  return (
    <div className="space-y-4 pb-10">
      {/* Filters Pill Bar */}
      <div className="overflow-x-auto no-scrollbar py-1">
        <div className="flex items-center gap-1.5 min-w-max px-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setSelectedFilter(f.key)}
              className={`px-3 py-1.5 rounded-2xl text-xs font-semibold flex items-center gap-1.5 transition-all select-none cursor-pointer ${
                selectedFilter === f.key
                  ? 'bg-slate-900 text-white shadow-xs scale-105'
                  : 'bg-white/80 text-slate-600 border border-slate-100 hover:bg-white'
              }`}
            >
              <span>{f.icon}</span>
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Days Cards */}
      <div className="space-y-3">
        {days.map((dayKey) => {
          const info = DAYS_INFO[dayKey];
          const dayTasks = filteredTasks(dayKey);
          const dateStr = weekInfo?.dayDates[dayKey]?.shortDate;

          return (
            <div
              key={dayKey}
              className="bg-white/80 border border-slate-100 rounded-3xl p-4 shadow-2xs hover:shadow-xs transition"
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: info.themeColor }} />
                  <h3 className="text-sm font-extrabold text-slate-800">
                    {info.name}
                    {dateStr && (
                      <span className="ml-1.5 text-xs font-normal text-slate-400">
                        · {dateStr}
                      </span>
                    )}
                  </h3>
                  {dayKey === 'sat' || dayKey === 'sun' ? (
                    <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold">
                      Свободный день ☀️
                    </span>
                  ) : null}
                </div>

                <button
                  onClick={() => onSelectDay(dayKey)}
                  className="text-xs font-semibold text-rose-500 hover:text-rose-600 transition cursor-pointer"
                >
                  Открыть день →
                </button>
              </div>

              {dayTasks.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400 italic">
                  Нет запланированных дел по выбранному фильтру
                </div>
              ) : (
                <div className="divide-y divide-slate-50 pt-1">
                  {dayTasks.map((t) => {
                    const cat = CATEGORY_INFO[t.category] || CATEGORY_INFO.routine;
                    return (
                      <div key={t.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-mono text-[11px] text-slate-400 font-semibold w-24 shrink-0">
                            {t.startTime} – {t.endTime}
                          </span>
                          <span className="text-sm shrink-0">{cat.emoji}</span>
                          <span className={`font-semibold truncate ${t.isImportant ? 'text-indigo-950 font-bold' : 'text-slate-700'}`}>
                            {t.title}
                          </span>
                        </div>

                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${cat.badgeBg}`}>
                          {cat.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
