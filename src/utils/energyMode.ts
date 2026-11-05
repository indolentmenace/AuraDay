import { ScheduleTask, DayOfWeek } from '../types/schedule';

export type EnergyLevel = 'full' | 'low' | 'sick';

export interface DayEnergyState {
  level: EnergyLevel;
  restoredTaskIds?: string[]; // IDs of tasks the user manually chose to un-hide in light mode
  hiddenTaskIds?: string[]; // IDs of tasks the user manually chose to hide / return to secondary
}

export const STORAGE_KEY_ENERGY = 'auraday_energy_modes_v1';

/**
 * Classification of tasks based on the user's explicit rule:
 * - Второстепенные дела: языки, пресс, и подготовка к аналитике.
 * - Когда прям очень плохо: то и зал.
 */

/** Checks if a task is related to Gym & Workout (Зал) */
export function isGymTask(task: ScheduleTask): boolean {
  if (!task) return false;
  const idLower = (task.id || '').toLowerCase();
  const titleLower = (task.title || '').toLowerCase();
  // Shower immediately after gym is a hygiene routine, never a gym exercise
  if (idLower.includes('shower') || titleLower.includes('душ')) return false;
  if (task.category === 'gym_sport') return true;
  return (
    idLower.includes('gym') ||
    idLower.includes('workout') ||
    titleLower.includes('зал') ||
    titleLower.includes('силовая') ||
    titleLower.includes('спорт')
  );
}

/** Checks if a task is related to Languages (Языки: Spanish, English) */
export function isLanguageTask(task: ScheduleTask): boolean {
  if (task.category === 'languages') return true;
  const idLower = task.id.toLowerCase();
  const titleLower = task.title.toLowerCase();
  return (
    idLower.includes('spanish') ||
    idLower.includes('english') ||
    idLower.includes('lang') ||
    titleLower.includes('испанск') ||
    titleLower.includes('английск') ||
    titleLower.includes('язык')
  );
}

/** Checks if a task is related to Abs (Пресс) */
export function isAbsTask(task: ScheduleTask): boolean {
  if (task.category === 'abs') return true;
  // If it's a dedicated gym session, classify it under Gym
  if (isGymTask(task)) return false;
  const idLower = task.id.toLowerCase();
  const titleLower = task.title.toLowerCase();
  return idLower.includes('abs') || titleLower.includes('пресс');
}

/** Checks if a task is related to Analytics preparation (Подготовка к аналитике: SQL, Python, статистика, A/B) */
export function isAnalyticsTask(task: ScheduleTask): boolean {
  if (task.category === 'career') return true;
  const idLower = task.id.toLowerCase();
  const titleLower = task.title.toLowerCase();
  return (
    idLower.includes('sql') ||
    idLower.includes('python') ||
    idLower.includes('stat') ||
    idLower.includes('analytics') ||
    titleLower.includes('аналитик') ||
    titleLower.includes('sql') ||
    titleLower.includes('python') ||
    titleLower.includes('статистик') ||
    titleLower.includes('a/b')
  );
}

/**
 * Identifies secondary tasks based on user guidelines:
 * - Второстепенные дела: языки, пресс, и подготовка к аналитике.
 * - Когда прям очень плохо (sick): то и зал.
 */
export function isSecondaryTask(task: ScheduleTask, mode: EnergyLevel): boolean {
  if (mode === 'full') return false;

  // 1. Языки
  if (isLanguageTask(task)) return true;

  // 2. Пресс
  if (isAbsTask(task)) return true;

  // 3. Подготовка к аналитике
  if (isAnalyticsTask(task)) return true;

  // 4. Зал — скрывается только в режиме «Восстановление & Болезнь» (когда прям очень плохо)
  if (mode === 'sick' && isGymTask(task)) {
    return true;
  }

  return false;
}

/**
 * Determines whether a task belongs to the active schedule for the chosen energy mode.
 */
export function isEssentialTaskForMode(
  task: ScheduleTask,
  mode: EnergyLevel,
  restoredTaskIds: string[] = [],
  manuallyHiddenTaskIds: string[] = []
): boolean {
  // If user explicitly sent this task to secondary / hidden for this day
  if (manuallyHiddenTaskIds.includes(task.id)) {
    return false;
  }

  if (mode === 'full') return true;

  // If user explicitly restored this task back to the day plan, keep it
  if (restoredTaskIds.includes(task.id)) return true;

  // Secondary tasks (languages, abs, analytics prep, and gym if sick) are hidden
  if (isSecondaryTask(task, mode)) {
    return false;
  }

  // University classes and travel are strictly protected
  const idLower = task.id.toLowerCase();
  const titleLower = task.title.toLowerCase();
  if (
    task.category === 'study_uni' ||
    idLower.includes('-prep-uni') ||
    idLower.includes('-travel-uni') ||
    idLower.includes('-travel-home') ||
    titleLower.includes('вуз') ||
    titleLower.includes('пары')
  ) {
    return true;
  }

  // When very sick ("прям очень плохо"): tutoring is also deferred
  if (mode === 'sick' && task.category === 'tutoring') {
    return false;
  }

  // All routine, meals, sleep, tutoring (in light mode), gym (in light mode), and relaxation stay active
  return true;
}

/**
 * Transforms task duration and title if a user chooses to restore a secondary task in Light mode.
 */
export function adaptTaskForEnergyMode(task: ScheduleTask, mode: EnergyLevel): ScheduleTask {
  if (mode === 'full') return task;

  const idLower = task.id.toLowerCase();

  // In Light mode, secondary tasks (languages, abs, analytics prep) are hidden.
  // Morning sleep/wake-up is not forcibly locked to 10:00 so the user can freely set sleep earlier
  // (e.g. 09:00 or 08:30) and return English or other secondary tasks whenever desired!

  // Spanish: express micro-session
  if (task.category === 'languages' && idLower.includes('spanish')) {
    return {
      ...task,
      title: 'Испанский язык (микро-сессия 15 мин)',
      subtitle: '⚡ Легкий режим: сохраняем стрик без перегрузки (карточки / лексика)',
      durationMinutes: 15,
    };
  }

  // English: express micro-session
  if (task.category === 'languages' && idLower.includes('english')) {
    return {
      ...task,
      title: 'Английский язык (микро-сессия 15 мин)',
      subtitle: '⚡ Легкий режим: 15 минут подкаста или карточек слов',
      durationMinutes: 15,
    };
  }

  // Analytics (SQL/Python/Stat): express 15m
  if (task.category === 'career') {
    return {
      ...task,
      title: `${task.title} (экспресс 15 мин)`,
      subtitle: '⚡ Легкий режим: 1 быстрая задача для поддержания стрика',
      durationMinutes: 15,
    };
  }

  // Abs: 10m gentle stretch
  if (task.category === 'abs') {
    return {
      ...task,
      title: 'Пресс & Разминка (10 мин)',
      subtitle: '⚡ Легкий режим: мягкая планка и растяжка ради стрика',
      durationMinutes: 10,
    };
  }

  return task;
}
