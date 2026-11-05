export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type TaskCategory = 
  | 'study_uni'      // Пары в вузе
  | 'tutoring'       // Репетиторство
  | 'gym_sport'      // Зал
  | 'abs'            // Пресс (30 мин)
  | 'career'         // SQL, Python, Мат.стат, Продуктовая аналитика
  | 'languages'      // Испанский (1.5ч), Английский (1ч)
  | 'reading'        // Книга (30 мин)
  | 'routine'        // Сон, подъем, готовка, душ, дорога
  | 'relaxation';    // Сериал, отдых

export interface ScheduleTask {
  id: string;
  title: string;
  subtitle?: string;
  startTime: string; // '09:00'
  endTime: string;   // '10:30'
  durationMinutes: number;
  category: TaskCategory;
  days: DayOfWeek[];
  prepNote?: string; // e.g. "Сборы 30 мин + 30 мин дорога"
  postNote?: string; // e.g. "Душ 15 минут сразу по приходу"
  location?: string;
  isImportant?: boolean;
  completedDays: Record<string, boolean>; // '2026-10-15': true
  tags?: string[];
  isCustom?: boolean;
  originalStartTime?: string;
  originalEndTime?: string;
  isPinnedPermanent?: boolean; // true = repeats permanently every week; false = one-off this week only
  weekScope?: 'this_week' | 'permanent'; // 'this_week' (temporary) or 'permanent' (forever)
  targetWeekId?: string; // e.g. '2026-W43' (the week where this temporary plan was added)
  temporaryReplacedTaskIds?: string[]; // IDs of baseline tasks replaced for this week only
}

export interface DayInfo {
  key: DayOfWeek;
  name: string;
  shortName: string;
  themeColor: string;
}

export interface HabitStreak {
  id: string;
  title: string;
  icon: string;
  category: TaskCategory;
  targetMinutes: number;
  streakDays: number;
  lastCompletedDate?: string;
  isFrozen?: boolean;
  isCustom?: boolean;
}

export interface UserScheduleConfig {
  wakeUpTimeWeekday: string; // '09:00'
  wakeUpTimeThursday: string; // '08:30' (because uni pairs at 10:00)
  wakeUpTimeWeekend: string; // '10:00'
  gymDays: DayOfWeek[]; // default ['wed', 'fri']
  gymTime: string; // '18:00'
  includeAnalyticsJuniorPrep: boolean;
  includeEnglish: boolean;
  eatLastTimestamp?: number | null; // For abs 1-hour wait timer
  showIPhoneMockup: boolean;
  soundEnabled: boolean;
  hapticEnabled: boolean;
  notificationsEnabled: boolean;
  notifyTaskStart?: boolean;
  notifyTaskUpcoming?: boolean;
  notifyStreakWarning?: boolean;
  customUniversityPairs?: Partial<Record<DayOfWeek, { startTime: string; endTime: string }>>;
  disabledUniversityDays?: DayOfWeek[];
  themeMode?: 'auto' | 'light' | 'dark';
}
