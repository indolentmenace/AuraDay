import { HabitStreak, ScheduleTask, DayOfWeek } from '../types/schedule';

/**
 * Checks whether a given schedule task corresponds to a habit.
 * "если стрик или дело по нему не отмечался"
 */
export function isTaskMatchingHabit(task: ScheduleTask, habit: HabitStreak): boolean {
  if (!task || !habit) return false;
  const tTitle = (task.title || '').toLowerCase();
  const hTitle = (habit.title || '').toLowerCase();
  const hId = habit.id;

  // 1. Specific default habit IDs
  if (hId === 'habit-spanish') {
    return tTitle.includes('испан');
  }
  if (hId === 'habit-english') {
    return tTitle.includes('англ');
  }
  if (hId === 'habit-abs') {
    return task.category === 'abs' || tTitle.includes('пресс');
  }
  if (hId === 'habit-reading') {
    return task.category === 'reading' || tTitle.includes('чтени') || tTitle.includes('книг');
  }
  if (hId === 'habit-analytics') {
    return (
      task.category === 'career' ||
      tTitle.includes('sql') ||
      tTitle.includes('python') ||
      tTitle.includes('аналитик') ||
      tTitle.includes('мат.стат')
    );
  }
  if (hId === 'habit-gym') {
    return task.category === 'gym_sport' || tTitle.includes('зал') || tTitle.includes('тренировк');
  }
  if (hId === 'habit-series') {
    return task.category === 'relaxation' || tTitle.includes('сериал') || tTitle.includes('фильм');
  }

  // 2. Custom or general habit matching by category
  if (task.category === habit.category) {
    return true;
  }

  // 3. Word stem match in title
  const words = hTitle.split(/[\s,()&+/!?-]+/).filter((w) => w.length >= 4);
  if (words.some((w) => tTitle.includes(w))) {
    return true;
  }

  return false;
}

/**
 * Format a Date to 'YYYY-MM-DD' in local timezone.
 */
export function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Get yesterday's date string and day-of-week key.
 */
export function getYesterdayInfo(): { dateStr: string; dayKey: DayOfWeek } {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const dayKeys: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return {
    dateStr: formatDateKey(d),
    dayKey: dayKeys[d.getDay()],
  };
}

/**
 * Get today's date string and day-of-week key.
 */
export function getTodayInfo(): { dateStr: string; dayKey: DayOfWeek } {
  const d = new Date();
  const dayKeys: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return {
    dateStr: formatDateKey(d),
    dayKey: dayKeys[d.getDay()],
  };
}

/**
 * Checks if a task was completed on a specific date or day key.
 */
export function isTaskCompletedOnDateOrDay(
  task: ScheduleTask,
  dateStr: string,
  dayKey: DayOfWeek,
  weekId?: string
): boolean {
  if (!task.completedDays) return false;
  if (task.completedDays[dateStr]) return true;
  if (weekId && task.completedDays[`${weekId}_${dayKey}`]) return true;
  if (task.completedDays[dayKey]) return true;
  return false;
}

/**
 * Checks whether a habit or its associated task was completed on a given date.
 */
export function wasHabitOrTaskCompletedOnDate(
  habit: HabitStreak,
  dateStr: string,
  dayKey: DayOfWeek,
  tasks: ScheduleTask[],
  weekId?: string
): boolean {
  // Marked directly on habit streak
  if (habit.lastCompletedDate === dateStr) {
    return true;
  }

  // Marked on an associated task in schedule
  const matchingTasks = tasks.filter(
    (t) => t.days.includes(dayKey) && isTaskMatchingHabit(t, habit)
  );

  return matchingTasks.some((t) => isTaskCompletedOnDateOrDay(t, dateStr, dayKey, weekId));
}

export interface StreakBurnResult {
  updatedHabits: HabitStreak[];
  burnedHabits: HabitStreak[];
}

/**
 * Evaluates all habits and burns out (resets to 0) any streak that missed yesterday
 * without being marked (neither streak nor task) UNLESS it was frozen.
 *
 * "сделай что если стрик или дело по нему не отмечался, то этот стрик сгорает(обнуляется), только если он не был заморожен"
 */
export function verifyAndBurnStreaks(
  habits: HabitStreak[],
  tasks: ScheduleTask[],
  weekId?: string
): StreakBurnResult {
  const today = getTodayInfo();
  const yesterday = getYesterdayInfo();

  const burnedHabits: HabitStreak[] = [];

  const updatedHabits = habits.map((h) => {
    // If streak is already 0, nothing to burn
    if (!h.streakDays || h.streakDays <= 0) {
      return h;
    }

    // "только если он не был заморожен"
    // If habit is frozen, it is protected from burning out!
    if (h.isFrozen) {
      return h;
    }

    // 1. Was it completed today?
    const isDoneToday = wasHabitOrTaskCompletedOnDate(h, today.dateStr, today.dayKey, tasks, weekId);
    if (isDoneToday) {
      if (h.lastCompletedDate !== today.dateStr) {
        return { ...h, lastCompletedDate: today.dateStr };
      }
      return h;
    }

    // 2. Was it completed yesterday?
    const isDoneYesterday = wasHabitOrTaskCompletedOnDate(
      h,
      yesterday.dateStr,
      yesterday.dayKey,
      tasks,
      weekId
    );
    if (isDoneYesterday) {
      if (h.lastCompletedDate !== yesterday.dateStr) {
        return { ...h, lastCompletedDate: yesterday.dateStr };
      }
      // Yesterday was completed, today is still open -> streak is safe!
      return h;
    }

    // 3. If lastCompletedDate is already today's date (e.g. marked via flame button earlier today)
    if (h.lastCompletedDate === today.dateStr) {
      return h;
    }

    // 4. Neither yesterday nor today was completed, and it is NOT frozen:
    // The streak burns out (resets to 0)!
    burnedHabits.push(h);
    return {
      ...h,
      streakDays: 0,
      lastCompletedDate: undefined,
    };
  });

  return { updatedHabits, burnedHabits };
}

/**
 * When a user completes or uncompletes a task in the schedule,
 * automatically sync corresponding habit streak.
 */
export function syncHabitsWithTaskToggle(
  task: ScheduleTask,
  dayKey: DayOfWeek,
  isCompleted: boolean,
  habits: HabitStreak[],
  todayStr: string,
  todayDayKey: DayOfWeek
): { updatedHabits: HabitStreak[]; affectedHabit?: HabitStreak } {
  // Only sync streak if this task was toggled for today!
  const isActionForToday = dayKey === todayDayKey;
  if (!isActionForToday) {
    return { updatedHabits: habits };
  }

  let affectedHabit: HabitStreak | undefined;

  const updatedHabits = habits.map((h) => {
    if (!isTaskMatchingHabit(task, h)) {
      return h;
    }

    if (isCompleted) {
      // If task is completed and habit is not yet marked for today:
      if (h.lastCompletedDate !== todayStr) {
        const nextStreak = (h.streakDays || 0) + 1;
        affectedHabit = {
          ...h,
          streakDays: nextStreak,
          lastCompletedDate: todayStr,
        };
        return affectedHabit;
      }
    } else {
      // If task is unchecked and habit was marked for today:
      if (h.lastCompletedDate === todayStr) {
        const nextStreak = Math.max(0, (h.streakDays || 0) - 1);
        affectedHabit = {
          ...h,
          streakDays: nextStreak,
          lastCompletedDate: undefined,
        };
        return affectedHabit;
      }
    }

    return h;
  });

  return { updatedHabits, affectedHabit };
}
