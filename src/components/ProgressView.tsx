import React, { useState } from 'react';
import { HabitStreak, ScheduleTask } from '../types/schedule';
import { WeekInfo } from '../utils/dateUtils';
import { Flame, Sparkles, Snowflake, Plus, Trash2, Check } from 'lucide-react';
import { AddHabitModal } from './AddHabitModal';
import { isTaskMatchingHabit, getTodayInfo } from '../utils/habitStreakEngine';

interface QuoteItem {
  quote: string;
  author: string;
  tag?: string;
}

const DAILY_QUOTES: QuoteItem[] = [
  {
    quote: 'Мы то, что мы делаем изо дня в день. Совершенство — это не действие, а привычка.',
    author: 'Аристотель',
    tag: 'Дисциплина',
  },
  {
    quote: 'Маленькие шаги, совершаемые каждый день, ведут к великим достижениям.',
    author: 'Конфуций',
    tag: 'Фокус',
  },
  {
    quote: 'Успех — это сумма небольших усилий, повторяющихся изо дня в день.',
    author: 'Роберт Кольер',
    tag: 'Постоянство',
  },
  {
    quote: 'Секрет движения вперед — это первый шаг.',
    author: 'Марк Твен',
    tag: 'Старт',
  },
  {
    quote: 'Терпение и постоянство имеют магический эффект, перед которым трудности исчезают.',
    author: 'Джон Куинси Адамс',
    tag: 'Сила воли',
  },
  {
    quote: 'Если ты не сдашься, ты победишь. Самое важное — продолжать идти.',
    author: 'Марк Аврелий',
    tag: 'Стойкость',
  },
  {
    quote: 'Каждое утро у нас есть выбор: продолжать спать с мечтами или проснуться и воплотить их.',
    author: 'Мухаммед Али',
    tag: 'Энергия',
  },
  {
    quote: 'Тот, кто передвигает горы, начинает с того, что убирает маленькие камешки.',
    author: 'Китайская мудрость',
    tag: 'Прогресс',
  },
  {
    quote: 'Дисциплина — это мост между целями и достижениями.',
    author: 'Джим Рон',
    tag: 'Привычки',
  },
  {
    quote: 'Будущее зависит от того, что вы делаете сегодня.',
    author: 'Махатма Ганди',
    tag: 'Момент',
  },
  {
    quote: 'Сложнее всего — начать действовать, все остальное зависит только от упорства.',
    author: 'Амелия Эрхарт',
    tag: 'Решимость',
  },
  {
    quote: 'Делай то, что можешь, с тем, что имеешь, там, где ты находишься.',
    author: 'Теодор Рузвельт',
    tag: 'Действие',
  },
  {
    quote: 'Не бойтесь расти медленно, бойтесь только оставаться неизменными.',
    author: 'Восточная пословица',
    tag: 'Рост',
  },
  {
    quote: 'Побеждает не тот, кто сильнее, а тот, кто идет до конца.',
    author: 'Сенека',
    tag: 'Характер',
  },
];

interface ProgressViewProps {
  habits: HabitStreak[];
  tasks?: ScheduleTask[];
  onIncrementStreak: (habitId: string) => void;
  onToggleFreeze: (habitId: string) => void;
  onAddHabit: (habit: Omit<HabitStreak, 'id'>) => void;
  onDeleteHabit: (habitId: string) => void;
  onFreezeAll?: (freeze: boolean) => void;
  weeklyCompletedRate: number; // 0 - 100
  weekInfo?: WeekInfo;
}

export const ProgressView: React.FC<ProgressViewProps> = ({
  habits,
  tasks,
  onIncrementStreak,
  onToggleFreeze,
  onAddHabit,
  onDeleteHabit,
  onFreezeAll,
  weeklyCompletedRate,
  weekInfo,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Daily refreshing quote based on day of year
  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  );
  const currentQuote = DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
  const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

  const frozenCount = habits.filter((h) => h.isFrozen).length;
  const allFrozen = habits.length > 0 && frozenCount === habits.length;

  return (
    <div className="space-y-5 pb-8">
      {/* Daily Inspiring Quote Card */}
      <div className="bg-gradient-to-br from-amber-50/90 via-purple-50/70 to-rose-50/80 border border-amber-200/60 rounded-3xl p-5 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-6 -mt-6 w-28 h-28 bg-amber-200/30 rounded-full blur-2xl pointer-events-none" />
        
        <div>
          <div className="space-y-2">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100/90 text-amber-900 border border-amber-200/70">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                Цитата дня
              </span>
            </div>

            <p className="text-xs sm:text-sm font-semibold text-slate-800 italic leading-relaxed">
              «{currentQuote.quote}»
            </p>

            <p className="text-[11px] font-bold text-slate-500">
              — {currentQuote.author}
            </p>
          </div>
        </div>

        {/* Weekly Progress Bar (PRESERVED) */}
        <div className="mt-4 pt-3 border-t border-amber-200/40 space-y-1.5">
          <div className="flex justify-between items-center text-xs font-semibold">
            <span className="text-slate-600">
              Эффективность недели {weekInfo ? `(${weekInfo.formattedRange})` : ''}
            </span>
            <span className="font-mono text-amber-900 font-bold">{weeklyCompletedRate}%</span>
          </div>
          <div className="w-full bg-white/70 h-3 rounded-full overflow-hidden p-0.5 border border-amber-200/50">
            <div
              className="h-full bg-gradient-to-r from-amber-400 via-rose-400 to-purple-400 rounded-full transition-all duration-700"
              style={{ width: `${Math.max(8, weeklyCompletedRate)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Streak Freeze Info Banner */}
      <div className="bg-gradient-to-r from-sky-50/90 via-cyan-50/80 to-blue-50/90 border border-sky-200/80 rounded-3xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-sky-200/90 text-sky-800 flex items-center justify-center shrink-0 shadow-2xs">
            <Snowflake className="w-5 h-5 text-sky-600 animate-pulse" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-extrabold text-sky-950 flex items-center gap-1.5 flex-wrap">
              <span>Заморозка стриков</span>
              {frozenCount > 0 ? (
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-sky-200 text-sky-800 border border-sky-300">
                  {frozenCount} {frozenCount === 1 ? 'заморожен' : 'заморожено'}
                </span>
              ) : (
                <span className="text-[10px] font-medium text-sky-700 bg-sky-100/80 px-2 py-0.5 rounded-full">
                  Все стрики активны
                </span>
              )}
            </h4>
            <p className="text-[11px] text-sky-700/90 leading-tight mt-0.5 break-words">
              Замораживай серии привычек, когда берешь выходной — они не сгорят! ❄️
            </p>
          </div>
        </div>

        {onFreezeAll && habits.length > 0 && (
          <button
            type="button"
            onClick={() => onFreezeAll(!allFrozen)}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer shrink-0 shadow-2xs flex items-center gap-1 border self-start sm:self-auto ${
              allFrozen
                ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500'
                : 'bg-white hover:bg-sky-50 text-sky-800 border-sky-200'
            }`}
          >
            {allFrozen ? (
              <>
                <Flame className="w-3.5 h-3.5 fill-white shrink-0" />
                <span className="whitespace-nowrap">Разморозить все</span>
              </>
            ) : (
              <>
                <Snowflake className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span className="whitespace-nowrap">Заморозить все</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Habit Streaks Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-rose-500" />
            Серии привычек (Стрики)
          </h3>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white font-bold rounded-xl text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Добавить стрик</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {habits.map((h) => {
            const isFrozen = Boolean(h.isFrozen);
            const isDoneToday = h.lastCompletedDate === todayStr;

            const todayInfo = getTodayInfo();
            const linkedTask = tasks?.find(
              (t) => t.days.includes(todayInfo.dayKey) && isTaskMatchingHabit(t, h)
            );
            const isTaskDoneToday = linkedTask
              ? Boolean(
                  linkedTask.completedDays?.[todayInfo.dateStr] ||
                  (weekInfo && linkedTask.completedDays?.[`${weekInfo.weekId}_${todayInfo.dayKey}`]) ||
                  (weekInfo?.isCurrentWeek && linkedTask.completedDays?.[todayInfo.dayKey])
                )
              : false;

            return (
              <div
                key={h.id}
                className={`rounded-3xl p-4 shadow-2xs transition flex flex-col justify-between gap-3 border ${
                  isFrozen
                    ? 'bg-gradient-to-br from-sky-50/90 via-cyan-50/50 to-white dark:from-sky-950/30 dark:via-cyan-950/20 dark:to-zinc-900 border-sky-300 dark:border-sky-800 shadow-sky-100/60'
                    : 'bg-white/90 dark:bg-zinc-900/90 hover:bg-white dark:hover:bg-zinc-900 border-slate-100 dark:border-zinc-800 hover:shadow-xs hover:border-slate-200'
                }`}
              >
                {/* Top row: Icon on left, Delete in top-right corner */}
                <div className="flex items-start justify-between gap-2">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shrink-0 transition shadow-2xs ${
                      isFrozen
                        ? 'bg-sky-100 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800'
                        : 'bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700'
                    }`}
                  >
                    {h.icon}
                  </div>

                  {/* Delete button in top-right corner */}
                  <button
                    type="button"
                    onClick={() => onDeleteHabit(h.id)}
                    title="Удалить стрик"
                    className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-300 dark:text-zinc-600 hover:text-rose-500 hover:bg-rose-50/80 dark:hover:bg-rose-950/40 transition cursor-pointer -mr-1 -mt-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Middle: Title visible in full, Goal, and Linked Schedule Task */}
                <div className="space-y-1 my-auto min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-100 leading-snug break-words">
                      {h.title}
                    </h4>
                    {isFrozen ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800 shrink-0">
                        Заморожен ❄️
                      </span>
                    ) : h.streakDays === 0 ? (
                      <span className="text-[9px] font-medium px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400 shrink-0">
                        Сгорел (0 дн.)
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-zinc-400 font-medium">
                    Цель: {h.targetMinutes >= 60 ? `${h.targetMinutes / 60} ч/день` : `${h.targetMinutes} мин/день`}
                  </div>

                  {/* Linked Schedule Task status */}
                  {linkedTask && (
                    <div className="text-[10px] font-medium flex items-center gap-1 pt-0.5">
                      {isTaskDoneToday ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Дело «{linkedTask.title}» выполнено</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-zinc-500 truncate" title={`Связано с делом: ${linkedTask.title}`}>
                          Дело: {linkedTask.title}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom row: Freeze button and Flame (+1 day) button */}
                <div className="pt-2.5 border-t border-slate-100/80 flex items-center justify-between gap-2 mt-auto flex-wrap">
                  {/* Freeze button in the shape of a snowflake */}
                  <button
                    type="button"
                    onClick={() => onToggleFreeze(h.id)}
                    title={isFrozen ? "Разморозить стрик" : "Заморозить стрик (защитить от сгорания)"}
                    className={`h-8 px-2.5 rounded-xl flex items-center gap-1.5 text-xs font-bold transition cursor-pointer border shrink-0 ${
                      isFrozen
                        ? 'bg-sky-500 text-white border-sky-500 shadow-xs hover:bg-sky-600 scale-[1.02]'
                        : 'bg-slate-50 hover:bg-sky-50 text-slate-600 hover:text-sky-700 border-slate-200/80 hover:border-sky-300 shadow-2xs'
                    }`}
                  >
                    <Snowflake className={`w-3.5 h-3.5 shrink-0 ${isFrozen ? 'animate-pulse' : 'text-sky-500'}`} />
                    <span className="text-[11px] whitespace-nowrap">{isFrozen ? 'Разморозить' : 'Заморозка'}</span>
                  </button>

                  {/* Flame button: strictly 1 time per day with visual feedback */}
                  {isDoneToday ? (
                    <button
                      type="button"
                      onClick={() => onIncrementStreak(h.id)}
                      title="Отмечено за сегодня! Нажмите, если хотите отменить"
                      className="h-8 px-2.5 rounded-xl flex items-center gap-1.5 font-bold transition cursor-pointer active:scale-95 shadow-sm border shrink-0 bg-gradient-to-r from-amber-500 to-rose-500 text-white border-amber-400"
                    >
                      <Flame className="w-3.5 h-3.5 shrink-0 fill-white text-white animate-pulse" />
                      <span className="font-mono text-xs font-black whitespace-nowrap">{h.streakDays} дн.</span>
                      <span className="text-[9px] bg-white/25 px-1 py-0.2 rounded font-bold leading-none">✓ сегодня</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onIncrementStreak(h.id)}
                      title="Нажмите огонек, чтобы отметить серию за сегодня (+1 день)"
                      className={`h-8 px-2.5 rounded-xl flex items-center gap-1.5 font-bold transition cursor-pointer active:scale-95 shadow-2xs border group shrink-0 ${
                        isFrozen
                          ? 'bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-950 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-200'
                          : 'bg-amber-50 hover:bg-amber-100 border-amber-200/80 text-amber-950 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200'
                      }`}
                    >
                      <Flame className={`w-3.5 h-3.5 shrink-0 ${isFrozen ? 'text-sky-500 fill-sky-500' : 'text-amber-500 fill-amber-500'} group-hover:scale-110 transition`} />
                      <span className="font-mono text-xs font-extrabold whitespace-nowrap">{h.streakDays} дн.</span>
                      <span className="text-[10px] text-amber-700/80 dark:text-amber-300 font-bold">+1</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal for adding habit */}
      <AddHabitModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={onAddHabit}
      />
    </div>
  );
};
