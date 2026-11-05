import { DayOfWeek, ScheduleTask, UserScheduleConfig, TaskCategory } from '../types/schedule';
import { INITIAL_TASKS, DEFAULT_CONFIG } from '../data/defaultSchedule';
import { isGymTask } from './energyMode';

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(totalMins: number): string {
  const norm = ((totalMins % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export const OFFICIAL_UNIVERSITY_PAIRS: Record<DayOfWeek, { startTime: string; endTime: string } | null> = {
  mon: { startTime: '18:00', endTime: '20:40' },
  tue: { startTime: '16:00', endTime: '19:30' },
  wed: { startTime: '14:30', endTime: '16:00' },
  thu: { startTime: '10:00', endTime: '12:00' },
  fri: null,
  sat: null,
  sun: null,
};

export function getEffectivePair(
  day: DayOfWeek,
  config?: UserScheduleConfig
): { startTime: string; endTime: string } | null {
  if (config?.disabledUniversityDays?.includes(day)) {
    return null;
  }
  if (config?.customUniversityPairs?.[day]) {
    const custom = config.customUniversityPairs[day]!;
    if (custom.startTime && custom.endTime) {
      return custom;
    }
  }
  return OFFICIAL_UNIVERSITY_PAIRS[day] || null;
}

/**
 * Checks if a task is the wake up / morning start task.
 * Rule: "подъем был всегда первым в списках дел"
 */
export function isWakeUpTask(task?: Partial<ScheduleTask> | null): boolean {
  if (!task) return false;
  const lower = ((task.title || '') + ' ' + (task.subtitle || '') + ' ' + (task.id || '')).toLowerCase();

  // If it's explicitly evening / night sleep, reading, series, it is NOT morning wake-up!
  if (
    lower.includes('ночной сон') ||
    lower.includes('отход ко сну') ||
    lower.includes('сон на ночь') ||
    lower.includes('засыпание') ||
    lower.includes('перед сном') ||
    lower.includes('книг') ||
    lower.includes('сериал')
  ) {
    return false;
  }

  // Tasks starting in the afternoon / evening (>= 15:00 / 3 PM) are never morning wake-up!
  if (task.startTime) {
    const startM = timeToMinutes(task.startTime);
    if (startM >= 900) {
      return false;
    }
  }

  return (
    lower.includes('подъем') ||
    lower.includes('подъём') ||
    lower.includes('проснуться') ||
    lower.includes('пробуждение') ||
    lower.includes('выспаться') ||
    lower.includes('утренний подъем') ||
    lower.includes('утренний подъём') ||
    lower.includes('сон до') ||
    lower.includes('час сна') ||
    lower.includes('дополнительный сон') ||
    lower.includes('утренний сон') ||
    (lower.includes('сон') && !lower.includes('ноч')) ||
    (task.id ? task.id.includes('wake-breakfast') || task.id.includes('wake-brunch') || task.id.includes('wake') : false)
  );
}

/**
 * Universal Day Task Sorter:
 * Ensures the wake up task is ALWAYS #1 at the top of the day list,
 * followed by all other tasks in strict chronological order.
 */
export function sortDayTasksWithWakeUpFirst(tasks: ScheduleTask[]): ScheduleTask[] {
  return [...tasks].sort((a, b) => {
    const aWake = isWakeUpTask(a);
    const bWake = isWakeUpTask(b);
    if (aWake && !bWake) return -1;
    if (!aWake && bWake) return 1;

    // If start times match, break ties by strict daily routine sequence
    if (a.startTime === b.startTime) {
      const aGymOrder = getGymSequenceIndex(a);
      const bGymOrder = getGymSequenceIndex(b);
      if (aGymOrder !== -1 && bGymOrder !== -1) return aGymOrder - bGymOrder;
      if (aGymOrder !== -1 && isShowerTask(b)) return -1;
      if (isShowerTask(a) && bGymOrder !== -1) return 1;
      if (isShowerTask(a) && isReadingTask(b)) return -1;
      if (isReadingTask(a) && isShowerTask(b)) return 1;
      return a.endTime.localeCompare(b.endTime);
    }

    return a.startTime.localeCompare(b.startTime);
  });
}

/**
 * Returns the chronological index of a task in the canonical baseline (INITIAL_TASKS) for a day.
 * Rule: "порядок дел оставался как в эталоне"
 */
export function getBaselineTaskIndex(task: ScheduleTask, day: DayOfWeek): number {
  if (!task) return 999;
  const baseline = INITIAL_TASKS.filter((b) => b.days.includes(day));
  const idx = baseline.findIndex((b) => b.id === task.id || b.title === task.title);
  if (idx >= 0) return idx;
  const lower = (task.title || '').toLowerCase();
  const partialIdx = baseline.findIndex(
    (b) => b.title.toLowerCase().includes(lower) || lower.includes(b.title.toLowerCase())
  );
  if (partialIdx >= 0) return partialIdx;
  return 999;
}

/**
 * Checks whether a task belongs to the university pair or its direct commute/prep.
 */
export function isUniversityBlock(task: ScheduleTask): boolean {
  if (!task) return false;
  if (isWakeUpTask(task)) return false;
  const titleLower = (task.title || '').toLowerCase();
  const idLower = (task.id || '').toLowerCase();
  const lower = (titleLower + ' ' + (task.subtitle || '').toLowerCase() + ' ' + idLower);
  if (lower.includes('подъем') || lower.includes('подъём') || (lower.includes('сон') && !lower.includes('ноч'))) {
    return false;
  }
  if (idLower.includes('gym') || lower.includes('зал')) {
    return false;
  }
  return (
    task.category === 'study_uni' ||
    idLower.includes('-prep-uni') ||
    idLower.includes('-travel-uni') ||
    idLower.includes('-travel-home') ||
    idLower.includes('uni-classes') ||
    titleLower.includes('пары в вузе') ||
    titleLower.includes('сборы в университет') ||
    titleLower.includes('сборы в вуз') ||
    titleLower.includes('дорога в вуз') ||
    titleLower.includes('дорога домой') ||
    (titleLower.includes('пары') &&
      !titleLower.includes('после пар') &&
      !titleLower.includes('до пар') &&
      !titleLower.includes('под пары') &&
      !titleLower.includes('перед парами'))
  );
}

/**
 * Checks if a task is tutoring (репетиторство / занятие с учеником).
 * Rule: "не сдвигай вообще репетиторство пока я сама не поправлю время в редактировании"
 */
export function isTutoringTask(task?: Partial<ScheduleTask> | null): boolean {
  if (!task) return false;
  if (task.category === 'tutoring') return true;
  const idLower = (task.id || '').toLowerCase();
  const titleLower = (task.title || '').toLowerCase();
  return (
    idLower.includes('tutoring') ||
    titleLower.includes('репетитор') ||
    titleLower.includes('ученик')
  );
}

/**
 * Pins official immutable timetable for university classes and commute.
 * Rule: "пары нельзя сдвигать по времени (даже если на минуту)"
 */
export function pinUniversityBlockTimes(tasks: ScheduleTask[], day: DayOfWeek): ScheduleTask[] {
  const pairInfo = OFFICIAL_UNIVERSITY_PAIRS[day];
  if (!pairInfo) return tasks;

  const pairStartMins = timeToMinutes(pairInfo.startTime);
  const pairEndMins = timeToMinutes(pairInfo.endTime);
  const prepStartMins = pairStartMins - 60;
  const travelStartMins = pairStartMins - 30;
  const returnEndMins = pairEndMins + 30;

  return tasks.map((t) => {
    if (!t.days.includes(day)) return t;
    if (isWakeUpTask(t) || t.id.includes('gym') || t.title.toLowerCase().includes('зал')) {
      return t;
    }
    const tLower = t.title.toLowerCase();
    if (t.category === 'study_uni' || tLower.includes('пары в вузе') || t.id.includes('uni-classes')) {
      return {
        ...t,
        startTime: pairInfo.startTime,
        endTime: pairInfo.endTime,
        durationMinutes: pairEndMins - pairStartMins,
      };
    }
    if (
      t.id.includes('-prep-uni') ||
      (tLower.includes('сборы') && (tLower.includes('вуз') || tLower.includes('университет')))
    ) {
      return {
        ...t,
        startTime: minutesToTime(prepStartMins),
        endTime: minutesToTime(travelStartMins),
        durationMinutes: 30,
      };
    }
    if (t.id.includes('-travel-uni') || tLower.includes('дорога в вуз')) {
      return {
        ...t,
        startTime: minutesToTime(travelStartMins),
        endTime: minutesToTime(pairStartMins),
        durationMinutes: 30,
      };
    }
    if (t.id.includes('-travel-home') || tLower.includes('дорога домой')) {
      return {
        ...t,
        startTime: minutesToTime(pairEndMins),
        endTime: minutesToTime(returnEndMins),
        durationMinutes: 30,
      };
    }
    return t;
  });
}

/**
 * Strict validator for task scheduling:
 * 1. University pairs cannot be shifted or rescheduled.
 * 2. If editing wake-up on Monday to 11-12 (ending at 12:00 or later),
 *    FORBID setting wake-up to 12:00 because daytime tasks would push pairs by 15 minutes!
 *    "если я например исправляю подъем на 11-12 в понедельник и из-за этого все сдвигается не по времени на 15 минут, то запрещай мне ставить до 12"
 */
export function validateTaskSchedulePlacement(
  task: ScheduleTask,
  day: DayOfWeek,
  config?: UserScheduleConfig,
  allTasks?: ScheduleTask[]
): {
  isForbidden: boolean;
  forbiddenReason?: string;
  maxAllowedWakeUpEnd?: string;
} {
  if (!task) return { isForbidden: false };

  // Friday, Saturday, Sunday have no university pairs: all tasks can shift freely without prohibitions!
  if (day === 'fri' || day === 'sat' || day === 'sun') {
    return { isForbidden: false };
  }

  const startM = timeToMinutes(task.startTime);
  const endM = timeToMinutes(task.endTime);
  const isWake = isWakeUpTask(task);

  // 2. University Pair check & Wake-up constraints:
  const pairInfo = getEffectivePair(day, config);
  // Check if university pair is actively present on this day (not deleted or hidden in allTasks)
  const hasActiveUniPair = Boolean(
    pairInfo &&
      (!allTasks ||
        allTasks.some(
          (t) =>
            t.days.includes(day) &&
            (t.category === 'study_uni' || t.id.includes('uni-classes'))
        ))
  );

  // Wake-up validation across all days:
  // "снова проблема с запретом на подъем в легком режиме в 11:30 из-за пар хотя я все успеваю исправь эту ошибку во всех днях"
  if (isWake) {
    if (hasActiveUniPair && pairInfo) {
      const pairStartMins = timeToMinutes(pairInfo.startTime);
      const prepStartMins = pairStartMins - 60;

      // Case A: Wake-up task itself extends into or starts during university prep / pairs
      if (startM >= prepStartMins || endM > prepStartMins) {
        return {
          isForbidden: true,
          forbiddenReason:
            `⛔ Пары в вузе начинаются в ${pairInfo.startTime} (сборы в ${minutesToTime(prepStartMins)})!\n` +
            `Подъем в ${task.startTime}–${task.endTime} накладывается на пары или сборы в университет.\n` +
            `Окончание сна и подъема должно быть не позже ${minutesToTime(prepStartMins)}.`,
          maxAllowedWakeUpEnd: minutesToTime(prepStartMins),
        };
      }

      // Case B: Wake-up ends before prep. Check if mandatory daytime tasks fit before prepStartMins
      const activeTasksSource = allTasks || INITIAL_TASKS;
      const daytimeMandatoryTasks = activeTasksSource.filter((t) => {
        if (!t.days.includes(day)) return false;
        if (t.id === task.id || isWakeUpTask(t)) return false;
        if (isUniversityBlock(t)) return false;
        // Exclude evening tasks (post-university)
        if (
          isEveningSeries(t) ||
          t.id.includes('dinner') ||
          t.id.includes('reading') ||
          t.id.includes('shower') ||
          t.category === 'gym_sport'
        ) {
          return false;
        }
        // Exclude free time (can be compressed or dropped)
        if (isFreeTimeTask(t)) return false;

        // Must be a daytime task scheduled before prep
        const tStart = timeToMinutes(t.startTime);
        return tStart < prepStartMins;
      });

      const requiredMandatoryMins = daytimeMandatoryTasks.reduce((sum, t) => {
        const dur =
          t.durationMinutes ||
          Math.max(15, timeToMinutes(t.endTime) - timeToMinutes(t.startTime)) ||
          30;
        return sum + dur;
      }, 0);

      const availableMins = prepStartMins - endM;

      if (requiredMandatoryMins > availableMins) {
        const maxAllowedEnd = minutesToTime(prepStartMins - requiredMandatoryMins);
        const taskNames = daytimeMandatoryTasks.map((t) => `«${t.title}»`).join(', ');
        return {
          isForbidden: true,
          forbiddenReason:
            `⛔ Подъем позже ${maxAllowedEnd} сдвинет пары в вузе!\n` +
            `До сборов на пары (${minutesToTime(prepStartMins)}) необходимо ${requiredMandatoryMins} мин на обязательные дневные дела (${taskNames}), а остается только ${availableMins} мин.\n` +
            `Окончание подъема должно быть не позже ${maxAllowedEnd}.`,
          maxAllowedWakeUpEnd: maxAllowedEnd,
        };
      }
    }

    return { isForbidden: false };
  }

  // 3. Direct Lunch check: Lunch cannot be moved to late afternoon / dinner on university days
  const isLunch = isMealTask(task) && task.title.toLowerCase().includes('обед');
  if (isLunch && startM >= 900 && hasActiveUniPair) {
    return {
      isForbidden: true,
      forbiddenReason:
        '⛔ Обед не может начинаться в 15:00 или позже на учебный день!\n' +
        'Иначе он передвигается вплотную к ужину и нарушает интервал перед сборами на пары.',
    };
  }

  // 4. General non-wake daytime task check on days with active university pairs
  if (hasActiveUniPair && pairInfo && !isUniversityBlock(task)) {
    const pairStartMins = timeToMinutes(pairInfo.startTime);
    const pairEndMins = timeToMinutes(pairInfo.endTime);
    const prepStartMins = pairStartMins - 60;
    // If a task is scheduled to start before prep but ends after prepStartMins,
    // or starts during prep/pair hours
    if ((startM < prepStartMins && endM > prepStartMins) || (startM >= prepStartMins && startM < pairEndMins)) {
      return {
        isForbidden: true,
        forbiddenReason: `⛔ Это дело (${task.startTime}–${task.endTime}) накладывается на сборы (${minutesToTime(prepStartMins)}) или пары в университете (${pairInfo.startTime}–${pairInfo.endTime}). Пары можно удалить в списке дел ниже или выбрать другое время.`,
      };
    }
  }

  // 5. Fixed Tutoring protection rule:
  // Rule: "не сдвигай вообще репетиторство пока я сама не поправлю время в редактировании"
  // Unless the user is editing the tutoring task itself, prevent any other task from overlapping with tutoring!
  if (!isTutoringTask(task)) {
    const activeTasksSource = allTasks || INITIAL_TASKS;
    const tutoringTask = activeTasksSource.find(
      (t) => t.days.includes(day) && isTutoringTask(t) && t.id !== task.id
    );
    if (tutoringTask) {
      const tutStartM = timeToMinutes(tutoringTask.startTime);
      const tutEndM = timeToMinutes(tutoringTask.endTime);
      // If task overlaps with the fixed tutoring slot
      if (startM < tutEndM && endM > tutStartM) {
        return {
          isForbidden: true,
          forbiddenReason:
            `⛔ Накладка с репетиторством (${tutoringTask.startTime}–${tutoringTask.endTime})!\n` +
            `Время урока с учеником зафиксировано и не сдвигается автоматически.\n` +
            `Поправьте время репетиторства вручную в его окне редактирования или выберите время до ${tutoringTask.startTime} / после ${tutoringTask.endTime}.`,
        };
      }
    }
  }

  // 6. Evening routines protection (Shower, Reading, Dinner, Series)
  // Rule: Evening routines can NEVER be placed in the daytime before pairs or before 18:00
  if (isEveningRoutineTask(task)) {
    const minAllowedStart = hasActiveUniPair && pairInfo ? timeToMinutes(pairInfo.endTime) + 30 : 1080;
    if (startM < minAllowedStart) {
      return {
        isForbidden: true,
        forbiddenReason: `⛔ Вечерние дела («${task.title}») не могут стоять днем! Они должны быть вечером (не раньше ${minutesToTime(minAllowedStart)}).`,
      };
    }
  }

  return { isForbidden: false };
}


/**
 * Checks if a task is an evening relaxation / series anchor.
 */
export function isEveningSeries(task: ScheduleTask): boolean {
  return task.id.includes('series') || task.title.toLowerCase().includes('сериал');
}

/**
 * Checks if a task is a shower routine (Evening shower, post-gym shower).
 * Strictly excludes Sunday morning wake-up "Выспаться от души".
 */
export function isShowerTask(task?: Partial<ScheduleTask> | null): boolean {
  if (!task) return false;
  const id = (task.id || '').toLowerCase();
  const title = (task.title || '').toLowerCase();
  const subtitle = (task.subtitle || '').toLowerCase();
  // Strictly exclude reading / book tasks (e.g. "Чтение книги после душа")
  if (task.category === 'reading' || id.includes('reading') || title.includes('чтение') || title.includes('книг')) return false;
  // Strictly exclude Sunday morning wake-up "Выспаться от души"
  if (title.includes('от души') || subtitle.includes('от души')) return false;
  if (id.includes('shower')) return true;
  return title.includes('душ') || subtitle.includes('душ');
}

/**
 * Checks if a task is a dinner routine.
 */
export function isDinnerTask(task?: Partial<ScheduleTask> | null): boolean {
  if (!task) return false;
  const id = (task.id || '').toLowerCase();
  if (id.includes('dinner')) return true;
  const title = (task.title || '').toLowerCase();
  return title.includes('ужин');
}

/**
 * Checks if a task is an evening reading routine.
 */
export function isReadingTask(task?: Partial<ScheduleTask> | null): boolean {
  if (!task) return false;
  if (task.category === 'reading' || (task.id || '').includes('reading')) return true;
  const title = (task.title || '').toLowerCase();
  return title.includes('чтение') || title.includes('книг');
}

/**
 * Gym sequence helper functions ensuring the strict biological and logical human chain:
 * 1. prep-gym (Сборы в зал)
 * 2. walk-gym (Пешком в зал)
 * 3. gym-workout (Тренировка в зале)
 * 4. walk-home (Пешком домой из зала / возвращение)
 * 5. shower-postgym (Душ сразу после зала)
 * 6. reading (Чтение книги после душа)
 * 7. series (Сериал 23:00)
 */
export function isPrepGymTask(task?: Partial<ScheduleTask> | null): boolean {
  if (!task) return false;
  const id = (task.id || '').toLowerCase();
  const title = (task.title || '').toLowerCase();
  return id.includes('prep-gym') || title.includes('сборы в зал');
}

export function isWalkToGymTask(task?: Partial<ScheduleTask> | null): boolean {
  if (!task) return false;
  const id = (task.id || '').toLowerCase();
  const title = (task.title || '').toLowerCase();
  return id.includes('walk-gym') || title.includes('пешком в зал');
}

export function isGymWorkoutTask(task?: Partial<ScheduleTask> | null): boolean {
  if (!task) return false;
  if (isPrepGymTask(task) || isWalkToGymTask(task) || isWalkHomeFromGymTask(task) || isShowerTask(task)) return false;
  const id = (task.id || '').toLowerCase();
  const title = (task.title || '').toLowerCase();
  return (
    task.category === 'gym_sport' ||
    id.includes('gym') ||
    id.includes('workout') ||
    title.includes('тренировка в зале') ||
    title.includes('силовая')
  );
}

export function isWalkHomeFromGymTask(task?: Partial<ScheduleTask> | null): boolean {
  if (!task) return false;
  const id = (task.id || '').toLowerCase();
  const title = (task.title || '').toLowerCase();
  return id.includes('walk-home') || title.includes('пешком домой из зала') || title.includes('возвращение из зала');
}

export function getGymSequenceIndex(task?: Partial<ScheduleTask> | null): number {
  if (!task) return -1;
  if (isPrepGymTask(task)) return 1;
  if (isWalkToGymTask(task)) return 2;
  if (isGymWorkoutTask(task)) return 3;
  if (isWalkHomeFromGymTask(task)) return 4;
  return -1;
}

/**
 * Comprehensive check for evening routine tasks (Shower, Reading, Series, Dinner).
 * These tasks belong strictly to the evening rhythm and must NEVER be placed in daytime windows.
 */
export function isEveningRoutineTask(task: ScheduleTask): boolean {
  if (!task) return false;
  if (isEveningSeries(task)) return true;
  if (isShowerTask(task)) return true;
  if (isReadingTask(task)) return true;
  if (isDinnerTask(task)) return true;
  const lower = ((task.title || '') + ' ' + (task.subtitle || '') + ' ' + (task.id || '')).toLowerCase();
  if (lower.includes('ночной сон') || lower.includes('отход ко сну')) return true;
  return false;
}

/**
 * Checks if a task is a meal or cooking routine (Home lunch, dinner, breakfast).
 * Rule: "в отдых не входит домашний обед или ужин"
 */
export function isMealTask(task: ScheduleTask): boolean {
  const lower = (task.title + ' ' + (task.subtitle || '') + ' ' + task.id).toLowerCase();
  return (
    lower.includes('обед') ||
    lower.includes('ужин') ||
    lower.includes('завтрак') ||
    lower.includes('ланч') ||
    lower.includes('бранч') ||
    lower.includes('полдник') ||
    lower.includes('готовка') ||
    lower.includes('еда')
  );
}

/**
 * Checks if a task is genuine free time / relaxation that can be shrunk or removed.
 * Rule: "в отдых не входит домашний обед или ужин" - Meals are NEVER free time.
 */
export function isFreeTimeTask(task: ScheduleTask): boolean {
  if (isMealTask(task)) return false;
  const lower = task.title.toLowerCase();
  return (
    task.category === 'relaxation' ||
    lower.includes('свободное время') ||
    lower.includes('свободный вечер') ||
    lower.includes('чилл') ||
    (lower.includes('отдых') && !lower.includes('обед') && !lower.includes('ужин') && !lower.includes('завтрак'))
  );
}

/**
 * Balances an individual day's schedule strictly respecting constraints:
 * 1. University pairs & commute are FIXED (never shift automatically).
 * 2. If daytime does not have enough time before university prep (17:00 on Mon):
 *    - Step A: Remove or compress excess free time ("Свободное время & кофе", "Отдых").
 *    - Step B: If still not enough time, move overflowing daytime tasks to the evening after university.
 * 3. Reading is placed after evening shower before 23:00 series.
 */
export function balanceDaySchedule(
  day: DayOfWeek,
  allDayTasks: ScheduleTask[],
  config: UserScheduleConfig
): ScheduleTask[] {
  if (!allDayTasks || allDayTasks.length === 0) return [];

  // Determine wake up time for this day: prioritize user-customized wake-up time if present
  const isWeekend = day === 'sat' || day === 'sun';
  const isThu = day === 'thu';
  const defaultWakeUpTarget = isThu
    ? config.wakeUpTimeThursday || '08:30'
    : isWeekend
    ? config.wakeUpTimeWeekend || '10:00'
    : config.wakeUpTimeWeekday || '09:00';

  const existingWake = allDayTasks.find(isWakeUpTask);
  const wakeUpTarget = existingWake?.startTime ? existingWake.startTime : defaultWakeUpTarget;

  const pairInfo = getEffectivePair(day, config);

  // If this day has no university pairs (fri, sat, sun, or if pairs were deleted)
  if (!pairInfo || !allDayTasks.some(isUniversityBlock)) {
    let curMins = timeToMinutes(wakeUpTarget);
    const sorted = [...allDayTasks].sort((a, b) => a.startTime.localeCompare(b.startTime));

    const adjusted = sorted.map((t) => {
      // If it's wake up block, set exact target
      if (t.id.includes('wake-breakfast') || t.id.includes('wake-brunch')) {
        const dur = t.durationMinutes || (isThu ? 30 : 60);
        const end = curMins + dur;
        const res = { ...t, startTime: minutesToTime(curMins), endTime: minutesToTime(end) };
        curMins = end;
        return res;
      }

      // If it's a fixed evening series at 23:00
      if (isEveningSeries(t)) {
        return { ...t, startTime: '23:00', endTime: '23:55', durationMinutes: 55 };
      }

      // If it's tutoring or gym with fixed slot
      // Rule: "не сдвигай вообще репетиторство пока я сама не поправлю время в редактировании"
      // Rule: "зал вечером" - Gym has a dedicated scheduled slot
      if ((isTutoringTask(t) || isGymTask(t)) && t.startTime && t.endTime) {
        curMins = Math.max(curMins, timeToMinutes(t.endTime));
        return t;
      }

      const origStart = timeToMinutes(t.startTime);
      const dur = t.durationMinutes || Math.max(15, timeToMinutes(t.endTime) - origStart) || 30;
      const start = Math.max(curMins, origStart);
      const end = start + dur;
      curMins = end;
      return {
        ...t,
        startTime: minutesToTime(start),
        endTime: minutesToTime(end),
        durationMinutes: dur,
      };
    });

    return alignEveningShowerAndReading(adjusted);
  }

  // --- DAY WITH UNIVERSITY PAIR (Mon: 18:00, Tue: 16:00, Wed: 14:30, Thu: 10:00) ---
  const pairStartMins = timeToMinutes(pairInfo.startTime);
  const pairEndMins = timeToMinutes(pairInfo.endTime);
  const prepStartMins = pairStartMins - 60; // e.g. 17:00 on Monday
  const prepEndMins = pairStartMins - 30;   // e.g. 17:30 on Monday
  const travelStartMins = pairStartMins - 30; // e.g. 17:30 on Monday
  const travelEndMins = pairStartMins;       // e.g. 18:00 on Monday
  const returnEndMins = pairEndMins + 30;     // e.g. 21:10 on Monday

  // Extract university tasks and pin them to strict official times
  const uniTasks: ScheduleTask[] = [];
  const otherTasks: ScheduleTask[] = [];

  allDayTasks.forEach((t) => {
    if (isUniversityBlock(t)) {
      if (t.category === 'study_uni') {
        uniTasks.push({
          ...t,
          startTime: pairInfo.startTime,
          endTime: pairInfo.endTime,
          durationMinutes: pairEndMins - pairStartMins,
        });
      } else if (t.id.includes('-prep-uni') || t.title.includes('Сборы')) {
        uniTasks.push({
          ...t,
          startTime: minutesToTime(prepStartMins),
          endTime: minutesToTime(prepEndMins),
          durationMinutes: 30,
        });
      } else if (t.id.includes('-travel-uni') || t.title.includes('Дорога в вуз')) {
        uniTasks.push({
          ...t,
          startTime: minutesToTime(travelStartMins),
          endTime: minutesToTime(travelEndMins),
          durationMinutes: 30,
        });
      } else if (t.id.includes('-travel-home') || t.title.includes('Дорога домой')) {
        uniTasks.push({
          ...t,
          startTime: minutesToTime(pairEndMins),
          endTime: minutesToTime(returnEndMins),
          durationMinutes: 30,
        });
      } else {
        uniTasks.push(t);
      }
    } else {
      otherTasks.push(t);
    }
  });

  // Separate non-university tasks into daytime and evening tasks
  // Tasks originally scheduled or intended before university
  const daytimeTasks: ScheduleTask[] = [];
  const eveningTasks: ScheduleTask[] = [];

  otherTasks.forEach((t) => {
    const origStart = timeToMinutes(t.startTime);
    // Evening tasks: evening routines (shower, reading, dinner, series), gym, or tasks after university return
    if (isEveningRoutineTask(t) || isEveningSeries(t) || isGymTask(t) || origStart >= returnEndMins) {
      eveningTasks.push(t);
    } else {
      daytimeTasks.push(t);
    }
  });

  // Sort daytime tasks in their current relative order
  daytimeTasks.sort((a, b) => {
    // Wake up always comes first
    if (a.id.includes('wake-breakfast') || a.id.includes('wake-brunch')) return -1;
    if (b.id.includes('wake-breakfast') || b.id.includes('wake-brunch')) return 1;
    return a.startTime.localeCompare(b.startTime);
  });

  // Window available before university prep (e.g. 09:00 to 17:00 on Monday = 480 mins)
  const wakeUpMins = timeToMinutes(wakeUpTarget);
  const availableWindowMins = Math.max(0, prepStartMins - wakeUpMins);

  // Calculate sum of durations of daytime tasks
  let totalDaytimeDuration = daytimeTasks.reduce((sum, t) => sum + (t.durationMinutes || 30), 0);
  let deficitMins = totalDaytimeDuration - availableWindowMins;

  // RULE A: "удаляй лишнее свободное время"
  // If there's a deficit, shrink or delete free time tasks (never meals)
  if (deficitMins > 0) {
    for (let i = 0; i < daytimeTasks.length && deficitMins > 0; i++) {
      const task = daytimeTasks[i];
      if (isFreeTimeTask(task)) {
        const curDur = task.durationMinutes || 30;
        if (curDur <= deficitMins) {
          // Completely eliminate excess free time
          deficitMins -= curDur;
          daytimeTasks[i] = { ...task, durationMinutes: 0 };
        } else {
          // Shrink free time
          const newDur = curDur - deficitMins;
          daytimeTasks[i] = { ...task, durationMinutes: newDur };
          deficitMins = 0;
        }
      }
    }
  }

  // Filter out zero-duration tasks
  const activeDaytimeTasks = daytimeTasks.filter((t) => (t.durationMinutes || 0) > 0);

  // RULE B: "если не хватает времени днем перемещай какие то дела"
  // If STILL deficit > 0, move the overflowing tasks to the evening
  const placedDaytimeTasks: ScheduleTask[] = [];
  const movedToEveningTasks: ScheduleTask[] = [];

  let curMins = wakeUpMins;

  activeDaytimeTasks.forEach((t) => {
    // RULE: "не сдвигай вообще репетиторство пока я сама не поправлю время в редактировании"
    if (isTutoringTask(t)) {
      curMins = Math.max(curMins, timeToMinutes(t.endTime));
      placedDaytimeTasks.push(t);
      return;
    }
    const dur = t.durationMinutes || 30;
    if (curMins + dur <= prepStartMins) {
      placedDaytimeTasks.push({
        ...t,
        startTime: minutesToTime(curMins),
        endTime: minutesToTime(curMins + dur),
      });
      curMins += dur;
    } else {
      // Cannot fit before university prep -> move to evening after university!
      movedToEveningTasks.push(t);
    }
  });

  // If there's a small gap between curMins and prepStartMins, and we have a free time task, let it fill the gap
  if (curMins < prepStartMins) {
    const freeIdx = placedDaytimeTasks.findIndex((t) => isFreeTimeTask(t));
    if (freeIdx >= 0) {
      const extraGap = prepStartMins - curMins;
      const ft = placedDaytimeTasks[freeIdx];
      placedDaytimeTasks[freeIdx] = {
        ...ft,
        durationMinutes: ft.durationMinutes + extraGap,
        endTime: minutesToTime(timeToMinutes(ft.endTime) + extraGap),
      };
      // Shift any tasks after freeIdx up to prepStartMins
      let running = timeToMinutes(placedDaytimeTasks[freeIdx].endTime);
      for (let j = freeIdx + 1; j < placedDaytimeTasks.length; j++) {
        const nextDur = placedDaytimeTasks[j].durationMinutes;
        placedDaytimeTasks[j] = {
          ...placedDaytimeTasks[j],
          startTime: minutesToTime(running),
          endTime: minutesToTime(running + nextDur),
        };
        running += nextDur;
      }
    }
  }

  // Sequence Evening tasks: starts at returnEndMins (e.g. 21:10 on Monday)
  let curEveningMins = returnEndMins;

  // Combine: post-commute routine, then daytime overflow, then evening routines
  const isLateEveningUni = pairEndMins >= 1020; // e.g. after 17:00 on Mon (20:40) & Tue (19:30)

  const allEvening = [...movedToEveningTasks, ...eveningTasks].sort((a, b) => {
    const aTitle = a.title.toLowerCase();
    const bTitle = b.title.toLowerCase();
    const aIsLunch = aTitle.includes('обед') || a.id.includes('lunch');
    const bIsLunch = bTitle.includes('обед') || b.id.includes('lunch');
    const aIsDinner = aTitle.includes('ужин') || a.id.includes('dinner');
    const bIsDinner = bTitle.includes('ужин') || b.id.includes('dinner');

    // Rule 1: Lunch ALWAYS precedes dinner in human daily routine
    if (aIsLunch && bIsDinner) return -1;
    if (aIsDinner && bIsLunch) return 1;

    // Rule 2: Series is always at 23:00 at end of day
    if (isEveningSeries(a)) return 1;
    if (isEveningSeries(b)) return -1;

    // Rule 3: Reading is towards the end before series
    const aIsReading = a.category === 'reading' || isReadingTask(a);
    const bIsReading = b.category === 'reading' || isReadingTask(b);
    if (aIsReading && !bIsReading) return 1;
    if (!aIsReading && bIsReading) return -1;

    // Rule 4: Gym sequence integrity (prep -> walk to gym -> gym workout -> walk home)
    const aGymOrder = getGymSequenceIndex(a);
    const bGymOrder = getGymSequenceIndex(b);
    if (aGymOrder !== -1 && bGymOrder !== -1) {
      return aGymOrder - bGymOrder;
    }
    // Any gym activity precedes post-gym shower
    const aIsShower = isShowerTask(a);
    const bIsShower = isShowerTask(b);
    if (aGymOrder !== -1 && bIsShower) return -1;
    if (aIsShower && bGymOrder !== -1) return 1;

    // Rule 5: User requested "пресс был ближе к душу или ужину"
    // Abs workout is placed right before evening shower!
    const aIsAbs = a.category === 'abs' || aTitle.includes('пресс');
    const bIsAbs = b.category === 'abs' || bTitle.includes('пресс');
    if (aIsAbs && bIsShower) return -1;
    if (bIsAbs && aIsShower) return 1;

    // Rule 6: Shower in late evening before reading
    if (aIsShower && bIsReading) return -1;
    if (bIsShower && aIsReading) return 1;

    // Rule 7: For late evening uni return (Mon 21:10, Tue 20:00), dinner is eaten upon arrival
    if (isLateEveningUni) {
      if (aIsDinner && !bIsDinner) return -1;
      if (!aIsDinner && bIsDinner) return 1;
    } else {
      // For midday/morning uni (Thu return at 12:30), lunch is eaten upon arrival!
      if (aIsLunch && !bIsLunch) return -1;
      if (!aIsLunch && bIsLunch) return 1;
    }

    return a.startTime.localeCompare(b.startTime);
  });

  const placedEveningTasks: ScheduleTask[] = [];

  allEvening.forEach((t) => {
    // RULE: "не сдвигай вообще репетиторство пока я сама не поправлю время в редактировании"
    if (isTutoringTask(t)) {
      curEveningMins = Math.max(curEveningMins, timeToMinutes(t.endTime));
      placedEveningTasks.push(t);
      return;
    }
    // RULE: "зал вечером" - Gym has a dedicated scheduled time and must not be shifted by daytime moves!
    if (isGymTask(t)) {
      curEveningMins = Math.max(curEveningMins, timeToMinutes(t.endTime));
      placedEveningTasks.push(t);
      return;
    }
    if (isEveningSeries(t)) {
      placedEveningTasks.push({
        ...t,
        startTime: '23:00',
        endTime: '23:55',
        durationMinutes: 55,
      });
      return;
    }

    const origStart = timeToMinutes(t.startTime);
    const dur = t.durationMinutes || Math.max(15, timeToMinutes(t.endTime) - origStart) || 30;
    const startMins = Math.max(curEveningMins, origStart);
    placedEveningTasks.push({
      ...t,
      startTime: minutesToTime(startMins),
      endTime: minutesToTime(startMins + dur),
      durationMinutes: dur,
    });
    curEveningMins = startMins + dur;
  });

  const combined = [...placedDaytimeTasks, ...uniTasks, ...placedEveningTasks];
  return alignEveningShowerAndReading(combined);
}

/**
 * Ensures evening shower precedes reading and series is at 23:00.
 * Guarantees shower is NEVER placed in daytime!
 * Strictly preserves the gym chain:
 * prep -> walk to gym -> gym workout -> walk home -> shower -> reading -> series.
 */
export function alignEveningShowerAndReading(tasks: ScheduleTask[]): ScheduleTask[] {
  let updated = [...tasks];
  const showerTask = updated.find(isShowerTask);
  const readingTask = updated.find(isReadingTask);
  const seriesTask = updated.find(isEveningSeries);
  const walkGymTask = updated.find(isWalkToGymTask);
  const gymTask = updated.find(isGymWorkoutTask);
  const walkHomeTask = updated.find(isWalkHomeFromGymTask);

  // 1. Gym sequence integrity checks:
  // If gym sequence exists on this day (e.g. Wednesday or Friday):
  if (walkHomeTask && gymTask) {
    const gymEndM = timeToMinutes(gymTask.endTime);
    const walkHomeStartM = timeToMinutes(walkHomeTask.startTime);
    if (walkHomeStartM < gymEndM) {
      const dur = walkHomeTask.durationMinutes || 10;
      updated = updated.map((t) =>
        t.id === walkHomeTask.id
          ? { ...t, startTime: minutesToTime(gymEndM), endTime: minutesToTime(gymEndM + dur), durationMinutes: dur }
          : t
      );
    }
  }

  // 2. Post-gym shower must strictly be AFTER gym walk home:
  // "пешком в зал идет после душа" -> Shower must NEVER precede gym or walk-gym!
  const activeWalkHome = updated.find(isWalkHomeFromGymTask);
  const activeWalkGym = updated.find(isWalkToGymTask);

  if (showerTask) {
    let showerStartM = timeToMinutes(showerTask.startTime);
    const showerDur = showerTask.durationMinutes || 15;

    // If day has walk to gym, shower can NEVER be before or at the same time as walk to gym!
    // If shower is placed before walk to gym or in daytime (< 19:00), reset or fix it:
    if (activeWalkGym && showerStartM <= timeToMinutes(activeWalkGym.startTime)) {
      // Shower was erroneously placed before walk to gym! Move shower to immediately after walk home!
      const targetShowerStart = activeWalkHome
        ? timeToMinutes(activeWalkHome.endTime)
        : (INITIAL_TASKS.find((i) => i.id === showerTask.id)?.startTime ? timeToMinutes(INITIAL_TASKS.find((i) => i.id === showerTask.id)!.startTime) : 1320);
      updated = updated.map((t) =>
        t.id === showerTask.id
          ? {
              ...t,
              startTime: minutesToTime(targetShowerStart),
              endTime: minutesToTime(targetShowerStart + showerDur),
              durationMinutes: showerDur,
            }
          : t
      );
      showerStartM = targetShowerStart;
    } else if (activeWalkHome && showerStartM < timeToMinutes(activeWalkHome.endTime)) {
      const targetShowerStart = timeToMinutes(activeWalkHome.endTime);
      updated = updated.map((t) =>
        t.id === showerTask.id
          ? {
              ...t,
              startTime: minutesToTime(targetShowerStart),
              endTime: minutesToTime(targetShowerStart + showerDur),
              durationMinutes: showerDur,
            }
          : t
      );
      showerStartM = targetShowerStart;
    } else if (showerStartM < 1140) { // earlier than 19:00 -> erroneous daytime placement
      const baselineShower = INITIAL_TASKS.find((init) => init.id === showerTask.id);
      const canonStart = baselineShower ? baselineShower.startTime : '22:00';
      const canonEnd = baselineShower ? baselineShower.endTime : '22:15';
      const dur = baselineShower?.durationMinutes || 15;
      updated = updated.map((t) =>
        t.id === showerTask.id
          ? { ...t, startTime: canonStart, endTime: canonEnd, durationMinutes: dur }
          : t
      );
    }
  }

  const activeShower = updated.find(isShowerTask);
  const activeReading = updated.find(isReadingTask);
  const curWalkHome = updated.find(isWalkHomeFromGymTask);

  if (activeReading) {
    const showerEndMins = activeShower
      ? timeToMinutes(activeShower.endTime)
      : (curWalkHome ? timeToMinutes(curWalkHome.endTime) + 15 : 1335);
    const seriesStartMins = 1380; // 23:00
    const maxReadingEndMins = seriesStartMins; // 23:00 max

    // "книга и возвращение из зала в одно время" -> Reading MUST start strictly after shower ends,
    // and strictly after walk home ends!
    let minReadingStart = showerEndMins;
    if (curWalkHome) {
      minReadingStart = Math.max(minReadingStart, timeToMinutes(curWalkHome.endTime));
    }

    const baselineReading = INITIAL_TASKS.find((i) => i.id === activeReading.id);
    const canonStartMins = baselineReading ? timeToMinutes(baselineReading.startTime) : 1335;

    let readingStartMins = Math.max(minReadingStart, canonStartMins);
    if (readingStartMins >= maxReadingEndMins) {
      readingStartMins = Math.max(minReadingStart, maxReadingEndMins - 30);
    }
    const readingDur = activeReading.durationMinutes || (baselineReading ? baselineReading.durationMinutes : 40) || 30;
    const readingEndMins = Math.min(
      readingStartMins + readingDur,
      maxReadingEndMins
    );

    updated = updated.map((t) => {
      if (t.id === activeReading.id) {
        return {
          ...t,
          title: t.title.includes('после душа') ? t.title : 'Чтение книги после душа',
          startTime: minutesToTime(readingStartMins),
          endTime: minutesToTime(readingEndMins),
          durationMinutes: Math.max(15, readingEndMins - readingStartMins),
        };
      }
      return t;
    });
  }

  if (seriesTask) {
    updated = updated.map((t) =>
      t.id === seriesTask.id
        ? { ...t, startTime: '23:00', endTime: '23:55', durationMinutes: 55 }
        : t
    );
  }

  return updated;
}

/**
 * Global Schedule Balancer and Validator
 * Iterates through every day and ensures:
 * 1. Mon pairs: 18:00 – 20:40 (commute 17:00, 17:30, 20:40)
 * 2. Tue pairs: 16:00 – 19:30 (commute 15:00, 15:30, 19:30)
 * 3. Wed pairs: 14:30 – 16:00 (commute 13:30, 14:00, 16:00)
 * 4. Thu pairs: 10:00 – 12:00 (commute 09:00, 09:30, 12:00)
 * 5. Daytime tasks never collide or push pairs (excess free time is removed or tasks moved to evening).
 */
export function hasScheduleOverlaps(tasks: ScheduleTask[]): boolean {
  const sorted = [...tasks].sort((a, b) => a.startTime.localeCompare(b.startTime));
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i];
    const nxt = sorted[i + 1];
    if (timeToMinutes(cur.endTime) > timeToMinutes(nxt.startTime)) {
      return true;
    }
  }
  return false;
}

/**
 * Automatically heals any time overlaps on a day:
 * 1. Guarantees wake-up is first at index 0.
 * 2. If a task overlaps with the subsequent task, adjusts start/end times sequentially.
 * 3. Never produces overlapping intervals.
 */
export function healDayOverlaps(tasks: ScheduleTask[]): ScheduleTask[] {
  let sorted = sortDayTasksWithWakeUpFirst([...tasks]);
  for (let i = 0; i < sorted.length - 1; i++) {
    const curEnd = timeToMinutes(sorted[i].endTime);
    const nxtStart = timeToMinutes(sorted[i + 1].startTime);
    if (curEnd > nxtStart) {
      // RULE: University blocks, Tutoring, and Gym workouts are IMMUTABLE priority anchors. Never push them forward!
      // Rule: "не сдвигай вообще репетиторство пока я сама не поправлю время в редактировании"
      // Rule: "зал вечером" - Gym has a dedicated scheduled time
      if (isUniversityBlock(sorted[i + 1]) || isTutoringTask(sorted[i + 1]) || isGymTask(sorted[i + 1])) {
        const curStart = timeToMinutes(sorted[i].startTime);
        if (curStart < nxtStart) {
          const clampedDur = Math.max(15, nxtStart - curStart);
          sorted[i] = {
            ...sorted[i],
            endTime: minutesToTime(curStart + clampedDur),
            durationMinutes: clampedDur,
          };
        }
        continue;
      }

      const dur =
        sorted[i + 1].durationMinutes ||
        Math.max(15, timeToMinutes(sorted[i + 1].endTime) - nxtStart);
      const newStart = curEnd;
      const newEnd = Math.min(1435, newStart + dur);
      sorted[i + 1] = {
        ...sorted[i + 1],
        startTime: minutesToTime(newStart),
        endTime: minutesToTime(newEnd),
        durationMinutes: newEnd - newStart,
      };
    }
  }

  // Pin official university hours for days that actually have university blocks in the list
  const daysInList = Array.from(new Set(sorted.flatMap((t) => t.days)));
  daysInList.forEach((d) => {
    if (sorted.some((t) => t.days.includes(d) && isUniversityBlock(t))) {
      sorted = pinUniversityBlockTimes(sorted, d);
    }
  });

  // Guarantee evening routines (shower, reading, series) are in evening
  sorted = alignEveningShowerAndReading(sorted);

  return sorted;
}

export function sanitizeAndEnforceFixedSchedule(
  allTasks: ScheduleTask[],
  _config: UserScheduleConfig,
  singleDayDeletedUniKeys?: string[]
): ScheduleTask[] {
  const days: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const singleDayUniDeletedDays = new Set<DayOfWeek>();
  (singleDayDeletedUniKeys || []).forEach((k) => {
    const parts = k.split('_');
    const dayPart = parts[parts.length - 1] as DayOfWeek;
    if (days.includes(dayPart)) {
      singleDayUniDeletedDays.add(dayPart);
    }
  });

  let result: ScheduleTask[] = [];

  days.forEach((day) => {
    let dayTasks = allTasks.filter((t) => t.days.includes(day));
    const isUniDisabledInSettings = Boolean(_config?.disabledUniversityDays?.includes(day));
    const isUniDisabledForSingleDay = singleDayUniDeletedDays.has(day);
    const isUniEffectivelyDisabled = isUniDisabledInSettings || isUniDisabledForSingleDay;

    if (isUniDisabledInSettings) {
      dayTasks = dayTasks.filter((t) => !isUniversityBlock(t));
    }

    const initDayTasks = INITIAL_TASKS.filter((t) => t.days.includes(day)).filter(
      (t) => !isUniDisabledInSettings || !isUniversityBlock(t)
    );
    const officialPair = isUniEffectivelyDisabled ? null : OFFICIAL_UNIVERSITY_PAIRS[day];
    const uniTask = dayTasks.find((t) => t.category === 'study_uni' || t.id.includes('uni-classes'));
    const isPairDisplaced = Boolean(officialPair && (!uniTask || uniTask.startTime !== officialPair.startTime));
    const hasCustomAdded = dayTasks.some((t) => t.id.startsWith('custom-'));

    // Active tasks for overlap and order checking (excluding single-day hidden university blocks)
    const activeDayTasksForCheck = isUniDisabledForSingleDay
      ? dayTasks.filter((t) => !isUniversityBlock(t))
      : dayTasks;
    const hasOverlaps = hasScheduleOverlaps(activeDayTasksForCheck);
    const isGymDay = Boolean((_config?.gymDays || ['wed', 'fri']).includes(day));

    // Check if ANY evening routine task (shower, reading, dinner, series) is misplaced in daytime or scrambled
    const hasMisplacedEveningTask = activeDayTasksForCheck.some((t) => {
      if (!isEveningRoutineTask(t)) return false;
      const startM = timeToMinutes(t.startTime);
      // On active university days: cannot start before university classes return time
      if (officialPair) {
        const pairEndMins = timeToMinutes(officialPair.endTime);
        const returnEndMins = pairEndMins + 30;
        if (startM < returnEndMins) return true;
      }
      // On non-gym days, evening shower cannot be before 20:30 (1230); on gym days post-gym shower cannot be before 19:00 (1140)
      if (isShowerTask(t) && startM < (isGymDay ? 1140 : 1230)) return true;
      if (isReadingTask(t) && startM < 1260) return true; // reading before 21:00
      if (isEveningSeries(t) && t.startTime !== '23:00') return true; // series not at 23:00
      if (isDinnerTask(t) && startM < 1080) return true; // dinner before 18:00
      return false;
    });

    const hasScrambledDaytimeOrder = (() => {
      const wake = activeDayTasksForCheck.find(isWakeUpTask);
      const eveShower = activeDayTasksForCheck.find((t) => isShowerTask(t) && !t.id.includes('postgym'));
      const anyShower = activeDayTasksForCheck.find(isShowerTask);
      const reading = activeDayTasksForCheck.find(isReadingTask);
      const series = activeDayTasksForCheck.find(isEveningSeries);
      const dinner = activeDayTasksForCheck.find(isDinnerTask);
      const lunch = activeDayTasksForCheck.find(
        (t) =>
          (t.id.endsWith('-lunch') && !t.id.includes('cook')) ||
          (isMealTask(t) &&
            t.title.toLowerCase().includes('обед') &&
            !t.title.toLowerCase().includes('готовк'))
      );
      const cookLunch = activeDayTasksForCheck.find(
        (t) =>
          t.id.includes('cook-lunch') ||
          t.title.toLowerCase().includes('готовка обеда') ||
          t.title.toLowerCase().includes('готовка свежего обеда')
      );

      if (anyShower && lunch && timeToMinutes(anyShower.startTime) <= timeToMinutes(lunch.startTime)) {
        return true;
      }
      if (anyShower && wake && timeToMinutes(anyShower.startTime) <= timeToMinutes(wake.endTime)) {
        return true;
      }
      // Lunch must never be after dinner or in the evening (>= 18:00)
      if (lunch && dinner && timeToMinutes(lunch.startTime) >= timeToMinutes(dinner.startTime)) {
        return true;
      }
      if (lunch && timeToMinutes(lunch.startTime) >= 1080) {
        return true;
      }
      // Cook lunch must not be after lunch on the same day
      if (cookLunch && lunch && timeToMinutes(cookLunch.startTime) > timeToMinutes(lunch.startTime)) {
        return true;
      }
      // Evening shower must be after dinner on non-gym days
      if (eveShower && dinner && timeToMinutes(eveShower.startTime) < timeToMinutes(dinner.startTime)) {
        return true;
      }
      // Reading must be after shower ends
      if (anyShower && reading && timeToMinutes(reading.startTime) < timeToMinutes(anyShower.endTime)) {
        return true;
      }
      // Series must be after lunch, dinner, shower, and reading
      if (series) {
        const seriesStart = timeToMinutes(series.startTime);
        if (lunch && seriesStart < timeToMinutes(lunch.endTime)) return true;
        if (dinner && seriesStart < timeToMinutes(dinner.endTime)) return true;
        if (anyShower && seriesStart < timeToMinutes(anyShower.endTime)) return true;
        if (reading && seriesStart < timeToMinutes(reading.endTime)) return true;
      }
      // Multiple tasks squashed at the end of the day (23:55 / 00:00) or tiny duration (< 10 min)
      const tasksEndingLate = activeDayTasksForCheck.filter(
        (t) => t.endTime === '23:55' || t.endTime === '00:00' || timeToMinutes(t.endTime) >= 1435
      );
      if (tasksEndingLate.length >= 2) {
        return true;
      }
      const hasSquashedTask = activeDayTasksForCheck.some((t) => {
        const s = timeToMinutes(t.startTime);
        const e = t.endTime === '00:00' ? 1440 : timeToMinutes(t.endTime);
        return e - s < 10;
      });
      if (hasSquashedTask) {
        return true;
      }
      // Daytime tasks (languages, midday rest, cook lunch) pushed to late night (>= 22:00)
      const hasDaytimeTaskInLateNight = activeDayTasksForCheck.some((t) => {
        if (
          t.id.includes('spanish') ||
          t.id.includes('english') ||
          t.id.includes('free-midday') ||
          t.id.includes('free-morning') ||
          t.id.includes('cook-lunch')
        ) {
          return timeToMinutes(t.startTime) >= 1320;
        }
        return false;
      });
      if (hasDaytimeTaskInLateNight) {
        return true;
      }
      return false;
    })();

    const hasGymInvertedOrder = (() => {
      const walkGym = activeDayTasksForCheck.find(isWalkToGymTask);
      const gym = activeDayTasksForCheck.find(isGymWorkoutTask);
      const walkHome = activeDayTasksForCheck.find(isWalkHomeFromGymTask);
      const shower = activeDayTasksForCheck.find(isShowerTask);
      const reading = activeDayTasksForCheck.find(isReadingTask);

      // Walk to gym must be strictly BEFORE shower
      if (walkGym && shower && timeToMinutes(walkGym.startTime) >= timeToMinutes(shower.startTime)) {
        return true;
      }
      // Walk home must be strictly BEFORE shower
      if (walkHome && shower && timeToMinutes(walkHome.startTime) >= timeToMinutes(shower.startTime)) {
        return true;
      }
      // Reading must be strictly AFTER shower ends
      if (shower && reading && timeToMinutes(reading.startTime) < timeToMinutes(shower.endTime)) {
        return true;
      }
      // Reading must NEVER overlap with or start before walkHome ends
      if (walkHome && reading && timeToMinutes(reading.startTime) < timeToMinutes(walkHome.endTime)) {
        return true;
      }
      // Gym workout must be before walkHome
      if (gym && walkHome && timeToMinutes(gym.startTime) >= timeToMinutes(walkHome.startTime)) {
        return true;
      }
      return false;
    })();

    // If day has misplaced evening tasks, scrambled daytime order, gym inversion, or displaced university pairs
    // and no custom added tasks, restore pristine baseline where schedule is 100% canonical!
    if ((isPairDisplaced || hasMisplacedEveningTask || hasScrambledDaytimeOrder || hasGymInvertedOrder) && !hasCustomAdded) {
      const healed = initDayTasks.map((init) => {
        const matched = dayTasks.find((d) => d.id === init.id);
        return {
          ...init,
          isCustom: false,
          isPinnedPermanent: false,
          completedDays: matched?.completedDays || init.completedDays || {},
        };
      });
      result = [...result, ...sortDayTasksWithWakeUpFirst(healed)];
      return;
    }

    const hasCustom = dayTasks.some((t) => t.isCustom);

    // If day has NO custom tasks and was corrupted or has overlaps, heal it directly from INITIAL_TASKS!
    if (!hasCustom) {
      if (hasOverlaps || dayTasks.length !== initDayTasks.length || isPairDisplaced || hasMisplacedEveningTask || hasScrambledDaytimeOrder || hasGymInvertedOrder) {
        const healed = initDayTasks.map((init) => {
          const matched = dayTasks.find((d) => d.id === init.id);
          return {
            ...init,
            isCustom: false,
            isPinnedPermanent: false,
            completedDays: matched?.completedDays || init.completedDays || {},
          };
        });
        result = [...result, ...sortDayTasksWithWakeUpFirst(healed)];
        return;
      }

      // Check Thursday meal ordering
      if (day === 'thu') {
        const dinner = dayTasks.find((t) => t.id === 'thu-dinner');
        const lunch = dayTasks.find((t) => t.id === 'thu-lunch');
        if (dinner && lunch && timeToMinutes(dinner.startTime) < timeToMinutes(lunch.startTime)) {
          const healed = initDayTasks.map((init) => {
            const matched = dayTasks.find((d) => d.id === init.id);
            return {
              ...init,
              isCustom: false,
              isPinnedPermanent: false,
              completedDays: matched?.completedDays || init.completedDays || {},
            };
          });
          result = [...result, ...sortDayTasksWithWakeUpFirst(healed)];
          return;
        }
      }

      // Clean day with no custom tasks - keep pristine schedule with wake-up first
      if (!isUniEffectivelyDisabled) {
        dayTasks = pinUniversityBlockTimes(dayTasks, day);
      }
      dayTasks = alignEveningShowerAndReading(dayTasks);
      result = [...result, ...sortDayTasksWithWakeUpFirst(dayTasks)];
      return;
    }

    // Day has custom tasks: if daytime/evening order was scrambled, restore all baseline tasks on this day!
    if (hasMisplacedEveningTask || hasScrambledDaytimeOrder || hasGymInvertedOrder) {
      dayTasks = dayTasks.map((t) => {
        if (!t.id.startsWith('custom-')) {
          const init = initDayTasks.find((i) => i.id === t.id);
          if (init) {
            return {
              ...t,
              startTime: init.startTime,
              endTime: init.endTime,
              durationMinutes: init.durationMinutes,
              isCustom: false,
              isPinnedPermanent: false,
            };
          }
        }
        return t;
      });
    }

    if (!isUniDisabledInSettings) {
      dayTasks = pinUniversityBlockTimes(dayTasks, day);
    }
    dayTasks = alignEveningShowerAndReading(dayTasks);

    if (isUniDisabledForSingleDay) {
      // Heal only active non-university tasks so hidden single-day deleted uni blocks don't push active plans
      const uniBlocks = dayTasks.filter(isUniversityBlock);
      let nonUniBlocks = dayTasks.filter((t) => !isUniversityBlock(t));
      if (hasScheduleOverlaps(nonUniBlocks)) {
        nonUniBlocks = healDayOverlaps(nonUniBlocks);
      }
      result = [...result, ...sortDayTasksWithWakeUpFirst([...nonUniBlocks, ...uniBlocks])];
      return;
    }

    if (hasScheduleOverlaps(dayTasks) || isPairDisplaced || hasGymInvertedOrder) {
      const healed = healDayOverlaps(dayTasks);
      result = [...result, ...sortDayTasksWithWakeUpFirst(healed)];
      return;
    }

    result = [...result, ...sortDayTasksWithWakeUpFirst(dayTasks)];
  });

  return result;
}

/**
 * Intelligent Schedule Auto-Adapter (runs on config/rhythm changes).
 */
export function recalculateSchedule(
  existingTasks: ScheduleTask[],
  config: UserScheduleConfig
): ScheduleTask[] {
  let tasks = [...existingTasks];
  const allDays: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  // Sync gym days
  const gymDays = config.gymDays || ['wed', 'fri'];

  allDays.forEach((day) => {
    const isGymDay = gymDays.includes(day);

    if (isGymDay) {
      const hasGym = tasks.some((t) => t.days.includes(day) && t.category === 'gym_sport');
      if (!hasGym) {
        const gymTime = config.gymTime || '18:00';
        const gymStartMins = timeToMinutes(gymTime);

        tasks.push(
          {
            id: `${day}-prep-gym`,
            title: 'Сборы в зал (10 мин)',
            startTime: minutesToTime(gymStartMins - 20),
            endTime: minutesToTime(gymStartMins - 10),
            durationMinutes: 10,
            category: 'gym_sport',
            days: [day],
            completedDays: {},
          },
          {
            id: `${day}-walk-gym`,
            title: 'Пешком в зал (10 мин)',
            startTime: minutesToTime(gymStartMins - 10),
            endTime: gymTime,
            durationMinutes: 10,
            category: 'gym_sport',
            days: [day],
            completedDays: {},
          },
          {
            id: `${day}-gym-workout`,
            title: 'Зал: Тренировка (1ч) + Пресс (30м) в зале',
            subtitle: '1 час силовой/кардио + 30 мин пресса прямо в зале',
            startTime: gymTime,
            endTime: minutesToTime(gymStartMins + 90),
            durationMinutes: 90,
            category: 'gym_sport',
            days: [day],
            isImportant: true,
            completedDays: {},
          },
          {
            id: `${day}-walk-home`,
            title: 'Пешком домой из зала (10 мин)',
            startTime: minutesToTime(gymStartMins + 90),
            endTime: minutesToTime(gymStartMins + 100),
            durationMinutes: 10,
            category: 'gym_sport',
            days: [day],
            completedDays: {},
          },
          {
            id: `${day}-shower-postgym`,
            title: 'Душ сразу после зала (15 мин)',
            subtitle: 'Освежающий душ сразу по приходу домой',
            startTime: minutesToTime(gymStartMins + 100),
            endTime: minutesToTime(gymStartMins + 115),
            durationMinutes: 15,
            category: 'routine',
            days: [day],
            completedDays: {},
          }
        );

        tasks = tasks.filter((t) => !(t.days.includes(day) && t.category === 'abs' && t.id.includes('-abs')));
      }
    } else {
      tasks = tasks.filter((t) => !(t.days.includes(day) && t.category === 'gym_sport'));
      tasks = tasks.filter((t) => !(t.days.includes(day) && t.id.includes('shower-postgym')));

      const hasAbs = tasks.some((t) => t.days.includes(day) && t.category === 'abs');
      if (!hasAbs) {
        tasks.push({
          id: `${day}-abs-home`,
          title: 'Пресс дома (30 мин)',
          subtitle: 'Через 1.5 часа после еды — комфортно и эффективно',
          startTime: '12:30',
          endTime: '13:00',
          durationMinutes: 30,
          category: 'abs',
          days: [day],
          completedDays: {},
        });
      }

      const hasShower = tasks.some((t) => t.days.includes(day) && t.title.toLowerCase().includes('душ'));
      if (!hasShower) {
        tasks.push({
          id: `${day}-shower-evening`,
          title: 'Вечерний расслабляющий душ (15 мин)',
          subtitle: 'Теплый душ перед чтением',
          startTime: '21:45',
          endTime: '22:00',
          durationMinutes: 15,
          category: 'routine',
          days: [day],
          completedDays: {},
        });
      }
    }

    // Sync wake up target if changed in settings or config
    const wakeUpTarget =
      (day === 'sat' || day === 'sun'
        ? config.wakeUpTimeWeekend
        : day === 'thu'
        ? config.wakeUpTimeThursday
        : config.wakeUpTimeWeekday) || '09:00';
    const dayWake = tasks.find((t) => t.days.includes(day) && isWakeUpTask(t));
    if (dayWake && !dayWake.isCustom && dayWake.startTime !== wakeUpTarget) {
      const dur = dayWake.durationMinutes || 60;
      const targetStartM = timeToMinutes(wakeUpTarget);
      const targetEndM = targetStartM + dur;
      const updatedWake: ScheduleTask = {
        ...dayWake,
        startTime: wakeUpTarget,
        endTime: minutesToTime(targetEndM),
        durationMinutes: dur,
        isCustom: true,
      };
      const res = applyTaskScheduleWithSmartCascading(
        tasks,
        updatedWake,
        day,
        'cascade_same_day',
        config
      );
      tasks = res.updatedTasks;
    }
  });

  return sanitizeAndEnforceFixedSchedule(tasks, config);
}

export const NEXT_DAY_MAP: Record<DayOfWeek, DayOfWeek> = {
  mon: 'tue',
  tue: 'wed',
  wed: 'thu',
  thu: 'fri',
  fri: 'sat',
  sat: 'sun',
  sun: 'mon',
};

/**
 * Sequences an explicitly ordered list of tasks on a day into non-overlapping consecutive time slots.
 * Strict rule: If university pair is present, it anchors at its configured hours,
 * tasks placed before it sequence in daytime, tasks placed after it sequence in evening.
 */
export function sequenceOrderedDayTasks(
  day: DayOfWeek,
  orderedTasks: ScheduleTask[],
  config?: UserScheduleConfig
): ScheduleTask[] {
  const safeConfig = config || DEFAULT_CONFIG;
  const pairInfo = getEffectivePair(day, safeConfig);

  const defaultWakeUpTarget =
    (day === 'sat' || day === 'sun'
      ? safeConfig.wakeUpTimeWeekend
      : day === 'thu'
      ? safeConfig.wakeUpTimeThursday
      : safeConfig.wakeUpTimeWeekday) || '09:00';

  // Find existing wake-up task for this day
  const existingWake = orderedTasks.find(isWakeUpTask);
  // Preserve user-configured wake-up time (e.g. 10:30 on Monday)
  const wakeUpTarget = existingWake?.startTime ? existingWake.startTime : defaultWakeUpTarget;
  const wakeUpMins = timeToMinutes(wakeUpTarget);

  if (!pairInfo || !orderedTasks.some(isUniversityBlock)) {
    // Days without university pair (e.g. Fri, Sat, Sun, or when pairs were deleted)
    const sortedTasks = [...orderedTasks];
    const wakeIdx = sortedTasks.findIndex(isWakeUpTask);
    if (wakeIdx > 0) {
      const [w] = sortedTasks.splice(wakeIdx, 1);
      sortedTasks.unshift(w);
    }

    const tutIdx = sortedTasks.findIndex(isTutoringTask);
    const tutTask = tutIdx >= 0 ? sortedTasks[tutIdx] : null;
    const tutStartMins = tutTask ? timeToMinutes(tutTask.startTime) : -1;
    const tutEndMins = tutTask ? timeToMinutes(tutTask.endTime) : -1;

    let curMins = wakeUpMins;
    let enteredEveningZone = false;
    const beforeTutPlaced: ScheduleTask[] = [];
    const overflowAfterTut: ScheduleTask[] = [];
    const afterTutPlaced: ScheduleTask[] = [];

    sortedTasks.forEach((task, idx) => {
      if (isTutoringTask(task)) {
        curMins = Math.max(curMins, tutEndMins);
        return;
      }

      // Tasks after tutoring are sequenced in the dedicated tail pass below
      if (tutTask && idx > tutIdx) {
        return;
      }

      const dur =
        task.durationMinutes ||
        Math.max(15, timeToMinutes(task.endTime) - timeToMinutes(task.startTime)) ||
        30;

      // If before tutoring anchor, check if it fits before tutoring starts
      if (tutTask && idx < tutIdx) {
        if (curMins + dur <= tutStartMins) {
          beforeTutPlaced.push({
            ...task,
            startTime: minutesToTime(curMins),
            endTime: minutesToTime(curMins + dur),
            durationMinutes: dur,
            isCustom: true,
          });
          curMins += dur;
        } else {
          overflowAfterTut.push(task);
        }
        return;
      }

      if (isEveningRoutineTask(task) && !enteredEveningZone) {
        enteredEveningZone = true;
        const remEveDur = sortedTasks.slice(idx).reduce((s, t) => {
          return s + (t.durationMinutes || Math.max(15, timeToMinutes(t.endTime) - timeToMinutes(t.startTime)) || 30);
        }, 0);
        const targetEveStart = Math.max(1080, Math.min(1200, 1435 - remEveDur));
        curMins = Math.max(curMins, targetEveStart);
      }

      const start = Math.min(curMins, 1430);
      const end = Math.min(start + dur, 1435);
      curMins = end;
      afterTutPlaced.push({
        ...task,
        startTime: minutesToTime(start),
        endTime: minutesToTime(end),
        durationMinutes: dur,
        isCustom: true,
      });
    });

    if (!tutTask) {
      return afterTutPlaced;
    }

    // Sequence any tasks after tutoring (including any overflow from before tutoring)
    let curAfterTutMins = Math.max(curMins, tutEndMins);
    let enteredEveAfterTut = false;
    const tailTasks = [...overflowAfterTut, ...sortedTasks.slice(tutIdx + 1)];
    const placedTail: ScheduleTask[] = tailTasks.map((task, idx) => {
      const dur =
        task.durationMinutes ||
        Math.max(15, timeToMinutes(task.endTime) - timeToMinutes(task.startTime)) ||
        30;
      if (isEveningRoutineTask(task) && !enteredEveAfterTut) {
        enteredEveAfterTut = true;
        const remEveDur = tailTasks.slice(idx).reduce((s, t) => {
          return s + (t.durationMinutes || Math.max(15, timeToMinutes(t.endTime) - timeToMinutes(t.startTime)) || 30);
        }, 0);
        const targetEveStart = Math.max(1080, Math.min(1200, 1435 - remEveDur));
        curAfterTutMins = Math.max(curAfterTutMins, targetEveStart);
      }
      const start = Math.min(curAfterTutMins, 1430);
      const end = Math.min(start + dur, 1435);
      curAfterTutMins = end;
      return {
        ...task,
        startTime: minutesToTime(start),
        endTime: minutesToTime(end),
        durationMinutes: dur,
        isCustom: true,
      };
    });

    return [...beforeTutPlaced, tutTask, ...placedTail];
  }

  // Day WITH university pair
  const pairStartMins = timeToMinutes(pairInfo.startTime);
  const pairEndMins = timeToMinutes(pairInfo.endTime);
  const prepStartMins = pairStartMins - 60; // 30m prep + 30m travel
  const travelStartMins = pairStartMins - 30;
  const returnEndMins = pairEndMins + 30; // 30m travel home

  const firstUniIdx = orderedTasks.findIndex((t) => isUniversityBlock(t));
  let lastUniIdx = -1;
  orderedTasks.forEach((t, idx) => {
    if (isUniversityBlock(t)) lastUniIdx = idx;
  });

  const beforeUni: ScheduleTask[] = [];
  const uniBlock: ScheduleTask[] = [];
  const afterUni: ScheduleTask[] = [];

  orderedTasks.forEach((t, i) => {
    if (isUniversityBlock(t)) {
      uniBlock.push(t);
    } else if (isEveningRoutineTask(t) || isGymTask(t)) {
      // Evening routines (shower, dinner, reading, series) and gym stay in evening after university
      afterUni.push(t);
    } else if (lastUniIdx !== -1 && i > lastUniIdx) {
      afterUni.push(t);
    } else if (firstUniIdx !== -1 && i < firstUniIdx) {
      beforeUni.push(t);
    } else {
      beforeUni.push(t);
    }
  });

  // Ensure wake up task is always first in beforeUni
  const wakeIdx = beforeUni.findIndex(isWakeUpTask);
  if (wakeIdx > 0) {
    const [w] = beforeUni.splice(wakeIdx, 1);
    beforeUni.unshift(w);
  }

  // 1. Check window before university prep:
  const availableWindowMins = Math.max(0, prepStartMins - wakeUpMins);
  let totalBeforeDuration = beforeUni.reduce((sum, t) => {
    return sum + (t.durationMinutes || Math.max(15, timeToMinutes(t.endTime) - timeToMinutes(t.startTime)) || 30);
  }, 0);
  let deficit = totalBeforeDuration - availableWindowMins;

  // RULE A: "удаляй лишнее свободное время"
  if (deficit > 0) {
    for (let i = 0; i < beforeUni.length && deficit > 0; i++) {
      const task = beforeUni[i];
      if (
        task.category === 'relaxation' ||
        task.title.toLowerCase().includes('свободное время') ||
        task.title.toLowerCase().includes('отдых')
      ) {
        const curDur = task.durationMinutes || 30;
        if (curDur <= deficit) {
          deficit -= curDur;
          beforeUni[i] = { ...task, durationMinutes: 0 };
        } else {
          beforeUni[i] = { ...task, durationMinutes: curDur - deficit };
          deficit = 0;
        }
      }
    }
  }

  const activeBeforeUni = beforeUni.filter((t) => (t.durationMinutes || 0) > 0);

  // RULE B: "если не хватает времени днем перемещай какие то дела"
  const fittingBeforeUni: ScheduleTask[] = [];
  const overflowToAfterUni: ScheduleTask[] = [];

  let curDayMins = wakeUpMins;
  activeBeforeUni.forEach((task) => {
    // RULE: "не сдвигай вообще репетиторство пока я сама не поправлю время в редактировании"
    if (isTutoringTask(task)) {
      curDayMins = Math.max(curDayMins, timeToMinutes(task.endTime));
      fittingBeforeUni.push(task);
      return;
    }
    const dur =
      task.durationMinutes ||
      Math.max(15, timeToMinutes(task.endTime) - timeToMinutes(task.startTime)) ||
      30;
    if (curDayMins + dur <= prepStartMins) {
      fittingBeforeUni.push({
        ...task,
        startTime: minutesToTime(curDayMins),
        endTime: minutesToTime(curDayMins + dur),
        durationMinutes: dur,
        isCustom: task.isCustom || (isWakeUpTask(task) && task.startTime !== defaultWakeUpTarget),
      });
      curDayMins += dur;
    } else {
      overflowToAfterUni.push(task);
    }
  });

  if (curDayMins < prepStartMins) {
    const freeIdx = fittingBeforeUni.findIndex(
      (t) =>
        t.category === 'relaxation' ||
        t.title.toLowerCase().includes('свободное время') ||
        t.title.toLowerCase().includes('отдых')
    );
    if (freeIdx >= 0) {
      const extra = prepStartMins - curDayMins;
      const ft = fittingBeforeUni[freeIdx];
      fittingBeforeUni[freeIdx] = {
        ...ft,
        durationMinutes: ft.durationMinutes + extra,
        endTime: minutesToTime(timeToMinutes(ft.endTime) + extra),
      };
      let running = timeToMinutes(fittingBeforeUni[freeIdx].endTime);
      for (let j = freeIdx + 1; j < fittingBeforeUni.length; j++) {
        const nextDur = fittingBeforeUni[j].durationMinutes;
        fittingBeforeUni[j] = {
          ...fittingBeforeUni[j],
          startTime: minutesToTime(running),
          endTime: minutesToTime(running + nextDur),
        };
        running += nextDur;
      }
    }
  }

  // 2. Fixed university block
  const sequencedUni: ScheduleTask[] = uniBlock.map((t) => {
    if (t.category === 'study_uni') {
      return {
        ...t,
        startTime: pairInfo.startTime,
        endTime: pairInfo.endTime,
        durationMinutes: pairEndMins - pairStartMins,
      };
    } else if (t.id.includes('-prep-uni') || t.title.includes('Сборы')) {
      return {
        ...t,
        startTime: minutesToTime(prepStartMins),
        endTime: minutesToTime(travelStartMins),
        durationMinutes: 30,
      };
    } else if (t.id.includes('-travel-uni') || t.title.includes('Дорога в вуз')) {
      return {
        ...t,
        startTime: minutesToTime(travelStartMins),
        endTime: minutesToTime(pairStartMins),
        durationMinutes: 30,
      };
    } else if (t.id.includes('-travel-home') || t.title.includes('Дорога домой')) {
      return {
        ...t,
        startTime: minutesToTime(pairEndMins),
        endTime: minutesToTime(returnEndMins),
        durationMinutes: 30,
      };
    }
    return t;
  });

  // 3. Sequence afterUni in evening in the exact order specified by the user
  const allAfterUni = [...overflowToAfterUni, ...afterUni];
  let curEveMins = returnEndMins;
  const sequencedAfter: ScheduleTask[] = allAfterUni.map((task) => {
    // RULE: "не сдвигай вообще репетиторство пока я сама не поправлю время в редактировании"
    if (isTutoringTask(task)) {
      curEveMins = Math.max(curEveMins, timeToMinutes(task.endTime));
      return task;
    }
    const dur =
      task.durationMinutes ||
      Math.max(15, timeToMinutes(task.endTime) - timeToMinutes(task.startTime)) ||
      30;
    const startMins = Math.min(curEveMins, 1430);
    const endMins = Math.min(startMins + dur, 1435);
    curEveMins = endMins;
    return {
      ...task,
      startTime: minutesToTime(startMins),
      endTime: minutesToTime(endMins),
      durationMinutes: dur,
      isCustom: true,
    };
  });

  return [...fittingBeforeUni, ...sequencedUni, ...sequencedAfter];
}

/**
 * Range-aware resequencer for drag-and-drop and swap operations on a day.
 * - Preserves tasks before minIdx untouched.
 * - Allows moving tasks directly into free windows created by deleting university pairs on ANY day.
 * - Jumps cleanly over fixed anchors (Wake-up, Tutoring, and active University blocks).
 * - Preserves unaffected tasks after maxIdx and never scrambles or inverts task order at 23:55.
 */
function resequenceTaskRangeOnDay(
  day: DayOfWeek,
  originalDayTasks: ScheduleTask[],
  reorderedDayTasks: ScheduleTask[],
  minIdx: number,
  maxIdx: number,
  movedTaskIds: Set<string>,
  initialStartMins: number,
  config?: UserScheduleConfig
): ScheduleTask[] {
  const safeConfig = config || DEFAULT_CONFIG;
  const pairInfo = getEffectivePair(day, safeConfig);
  const hasActiveUni = Boolean(pairInfo && originalDayTasks.some(isUniversityBlock));

  const isFixedAnchor = (t: ScheduleTask): boolean =>
    isWakeUpTask(t) || isTutoringTask(t) || (hasActiveUni && isUniversityBlock(t));

  const fixedAnchors = originalDayTasks
    .filter(isFixedAnchor)
    .map((t) => ({
      id: t.id,
      start: timeToMinutes(t.startTime),
      end: timeToMinutes(t.endTime),
    }))
    .sort((a, b) => a.start - b.start);

  const fitOutsideFixed = (startM: number, dur: number): number => {
    let s = startM;
    let changed = true;
    while (changed) {
      changed = false;
      for (const anchor of fixedAnchors) {
        if (s < anchor.end && s + dur > anchor.start) {
          s = anchor.end;
          changed = true;
        }
      }
    }
    return s;
  };

  const origStartMap = new Map<string, number>();
  const hadGapBeforeMap = new Map<string, boolean>();
  originalDayTasks.forEach((t, idx) => {
    const s = timeToMinutes(t.startTime);
    origStartMap.set(t.id, s);
    if (idx > 0) {
      const prevEnd = timeToMinutes(originalDayTasks[idx - 1].endTime);
      hadGapBeforeMap.set(t.id, s - prevEnd >= 30);
    } else {
      hadGapBeforeMap.set(t.id, false);
    }
  });

  const result = [...reorderedDayTasks];
  let curMins = initialStartMins;
  const isTwoTaskSwap = movedTaskIds.size === 2;
  const swapTargetSecondStart = isTwoTaskSwap
    ? timeToMinutes(originalDayTasks[maxIdx].startTime)
    : -1;
  const swapHadIntermediateGap =
    isTwoTaskSwap &&
    originalDayTasks.slice(minIdx + 1, maxIdx + 1).some((t) => hadGapBeforeMap.get(t.id));

  for (let i = minIdx; i < result.length; i++) {
    const task = result[i];
    if (isFixedAnchor(task)) {
      curMins = Math.max(curMins, timeToMinutes(task.endTime));
      continue;
    }

    const dur =
      task.durationMinutes ||
      Math.max(15, timeToMinutes(task.endTime) - timeToMinutes(task.startTime)) ||
      30;
    const origStart = origStartMap.get(task.id) ?? timeToMinutes(task.startTime);

    if (i > maxIdx) {
      // Past the reordered range: if there's no collision with this task, stop cascading!
      if (curMins <= origStart) {
        break;
      }
    } else if (i > minIdx) {
      // Inside [minIdx + 1 .. maxIdx]
      if (isTwoTaskSwap && i === maxIdx && swapHadIntermediateGap && swapTargetSecondStart > curMins) {
        // When swapping two tasks across a large free gap, the second task takes the second slot
        const remDur = result.slice(i).reduce((sum, rt) => {
          if (isFixedAnchor(rt)) return sum;
          return (
            sum +
            (rt.durationMinutes ||
              Math.max(15, timeToMinutes(rt.endTime) - timeToMinutes(rt.startTime)) ||
              30)
          );
        }, 0);
        const maxSafeStart = Math.max(curMins, 1435 - remDur);
        curMins = Math.max(curMins, Math.min(swapTargetSecondStart, maxSafeStart));
      } else if (hadGapBeforeMap.get(task.id) && !movedTaskIds.has(task.id) && origStart > curMins) {
        // Preserve intentional free gap (e.g., deleted university window before evening dinner),
        // while ensuring the remaining evening tasks never overflow 23:55 (1435)
        const remDur = result.slice(i).reduce((sum, rt) => {
          if (isFixedAnchor(rt)) return sum;
          return (
            sum +
            (rt.durationMinutes ||
              Math.max(15, timeToMinutes(rt.endTime) - timeToMinutes(rt.startTime)) ||
              30)
          );
        }, 0);
        const maxSafeStart = Math.max(curMins, 1435 - remDur);
        curMins = Math.max(curMins, Math.min(origStart, maxSafeStart));
      }
    }

    // Check if remaining tasks from i to end of day exceed 1435 when curMins is already late
    const startMins = fitOutsideFixed(curMins, dur);
    const safeStartMins = Math.min(startMins, 1430);
    const endMins = Math.min(1435, Math.max(safeStartMins + 5, safeStartMins + dur));

    result[i] = {
      ...task,
      startTime: minutesToTime(safeStartMins),
      endTime: minutesToTime(endMins),
      durationMinutes: dur,
      isCustom: true,
    };
    curMins = endMins;
  }

  return result;
}

/**
 * Reorder tasks on a day when dragging and dropping a card to a new position.
 * Respects user's direct reordering and sequences tasks reliably without scrambling the day.
 */
export function reorderDayTasks(
  allTasks: ScheduleTask[],
  sourceTaskId: string,
  targetTaskId: string,
  day: DayOfWeek,
  config: UserScheduleConfig,
  hiddenTaskIds?: string[]
): ScheduleTask[] {
  if (sourceTaskId === targetTaskId) return allTasks;
  const hiddenSet = new Set(hiddenTaskIds || []);

  const dayTasks = sortDayTasksWithWakeUpFirst(
    allTasks.filter((t) => t.days.includes(day) && !hiddenSet.has(t.id))
  );

  const srcIdx = dayTasks.findIndex((t) => t.id === sourceTaskId);
  let tgtIdx = dayTasks.findIndex((t) => t.id === targetTaskId);
  if (srcIdx < 0 || tgtIdx < 0) return allTasks;

  const srcTask = dayTasks[srcIdx];

  // University pair classes, tutoring slots, and morning wake-up are anchored and not directly draggable
  if (isUniversityBlock(srcTask) || isTutoringTask(srcTask) || isWakeUpTask(srcTask)) {
    return allTasks;
  }

  // If dropped onto the morning wake-up card (index 0), place right after wake-up (index 1)
  const droppedOnWake = isWakeUpTask(dayTasks[tgtIdx]);
  if (droppedOnWake) {
    tgtIdx = 1;
    if (srcIdx === 1) {
      // Already at index 1; if there is a gap after wake-up, pull to wake-up's endTime
      const wakeEnd = timeToMinutes(dayTasks[0].endTime);
      if (timeToMinutes(srcTask.startTime) <= wakeEnd) return allTasks;
    }
  }

  const reordered = [...dayTasks];
  const [removed] = reordered.splice(srcIdx, 1);
  reordered.splice(tgtIdx, 0, removed);

  const minIdx = Math.min(srcIdx, tgtIdx);
  const maxIdx = Math.max(srcIdx, tgtIdx);

  // Determine the starting minute for the reordered range:
  // If moving UP (srcIdx > tgtIdx) onto a card that has a free gap (>= 30m, e.g. deleted uni window) before it,
  // place the moved card into that free gap (starting at the previous card's endTime) unless it's an evening routine
  // task and the gap starts before 18:00.
  let initialStartMins = timeToMinutes(dayTasks[minIdx].startTime);
  if (droppedOnWake && dayTasks[0]) {
    initialStartMins = timeToMinutes(dayTasks[0].endTime);
  } else if (srcIdx > tgtIdx && tgtIdx > 0) {
    const prevEndMins = timeToMinutes(dayTasks[tgtIdx - 1].endTime);
    const tgtStartMins = timeToMinutes(dayTasks[tgtIdx].startTime);
    if (tgtStartMins - prevEndMins >= 30) {
      if (!isEveningRoutineTask(srcTask) || prevEndMins >= 1080) {
        initialStartMins = prevEndMins;
      }
    }
  }

  const sequenced = resequenceTaskRangeOnDay(
    day,
    dayTasks,
    reordered,
    minIdx,
    maxIdx,
    new Set([sourceTaskId]),
    initialStartMins,
    config
  );
  const seqMap = new Map(sequenced.map((t) => [t.id, t]));

  return allTasks.map((t) => {
    if (t.days.includes(day) && seqMap.has(t.id)) {
      return seqMap.get(t.id)!;
    }
    return t;
  });
}

/**
 * Cascades changes forward for flexible tasks without pushing university pairs.
 */
export function cascadeShiftTasks(
  allTasks: ScheduleTask[],
  targetTask: ScheduleTask,
  day: DayOfWeek,
  config: UserScheduleConfig
): ScheduleTask[] {
  const dayTasks = allTasks
    .filter((t) => t.days.includes(day))
    .map((t) => (t.id === targetTask.id ? targetTask : t));

  const balanced = balanceDaySchedule(day, dayTasks, config);
  const balancedMap = new Map(balanced.map((t) => [t.id, t]));

  return allTasks.map((t) => {
    if (t.days.includes(day) && balancedMap.has(t.id)) {
      return balancedMap.get(t.id)!;
    }
    return t;
  });
}

/**
 * Swaps two tasks cleanly on a day and re-sequences the affected range.
 */
export function swapTwoTasks(
  allTasks: ScheduleTask[],
  taskId1: string,
  taskId2: string,
  day: DayOfWeek,
  config: UserScheduleConfig,
  hiddenTaskIds?: string[]
): ScheduleTask[] {
  if (taskId1 === taskId2) return allTasks;
  const hiddenSet = new Set(hiddenTaskIds || []);

  const dayTasks = sortDayTasksWithWakeUpFirst(
    allTasks.filter((t) => t.days.includes(day) && !hiddenSet.has(t.id))
  );

  const idx1 = dayTasks.findIndex((t) => t.id === taskId1);
  const idx2 = dayTasks.findIndex((t) => t.id === taskId2);
  if (idx1 < 0 || idx2 < 0) return allTasks;

  const t1 = dayTasks[idx1];
  const t2 = dayTasks[idx2];
  if (
    isUniversityBlock(t1) ||
    isUniversityBlock(t2) ||
    isTutoringTask(t1) ||
    isTutoringTask(t2) ||
    isWakeUpTask(t1) ||
    isWakeUpTask(t2)
  ) {
    return allTasks;
  }

  const swapped = [...dayTasks];
  swapped[idx1] = t2;
  swapped[idx2] = t1;

  const minIdx = Math.min(idx1, idx2);
  const maxIdx = Math.max(idx1, idx2);
  const initialStartMins = timeToMinutes(dayTasks[minIdx].startTime);

  const sequenced = resequenceTaskRangeOnDay(
    day,
    dayTasks,
    swapped,
    minIdx,
    maxIdx,
    new Set([taskId1, taskId2]),
    initialStartMins,
    config
  );
  const seqMap = new Map(sequenced.map((t) => [t.id, t]));

  return allTasks.map((t) => {
    if (t.days.includes(day) && seqMap.has(t.id)) {
      return seqMap.get(t.id)!;
    }
    return t;
  });
}

/**
 * Moves a task one step up or down in the schedule.
 * Supports stepping into free windows (such as deleted university pair slots) and jumping over fixed anchors.
 */
export function moveTaskUpDown(
  allTasks: ScheduleTask[],
  taskId: string,
  direction: 'up' | 'down',
  day: DayOfWeek,
  config: UserScheduleConfig,
  hiddenTaskIds?: string[]
): ScheduleTask[] {
  const hiddenSet = new Set(hiddenTaskIds || []);
  const dayTasks = sortDayTasksWithWakeUpFirst(
    allTasks.filter((t) => t.days.includes(day) && !hiddenSet.has(t.id))
  );

  const idx = dayTasks.findIndex((t) => t.id === taskId);
  if (idx < 0) return allTasks;

  const currTask = dayTasks[idx];
  if (isUniversityBlock(currTask) || isTutoringTask(currTask) || isWakeUpTask(currTask)) {
    return allTasks;
  }

  const safeConfig = config || DEFAULT_CONFIG;
  const pairInfo = getEffectivePair(day, safeConfig);
  const hasActiveUni = Boolean(pairInfo && dayTasks.some(isUniversityBlock));
  const isFixed = (t: ScheduleTask) =>
    isWakeUpTask(t) || isTutoringTask(t) || (hasActiveUni && isUniversityBlock(t));

  if (direction === 'up' && idx > 0) {
    const prevTask = dayTasks[idx - 1];
    const prevEndMins = timeToMinutes(prevTask.endTime);
    const currStartMins = timeToMinutes(currTask.startTime);

    // If there is a free gap (>= 30m, e.g. deleted university pairs) right above currTask,
    // move currTask up into the start of that free gap!
    if (currStartMins - prevEndMins >= 30 && (!isEveningRoutineTask(currTask) || prevEndMins >= 1080)) {
      const sequenced = resequenceTaskRangeOnDay(
        day,
        dayTasks,
        dayTasks,
        idx,
        idx,
        new Set([taskId]),
        prevEndMins,
        config
      );
      const seqMap = new Map(sequenced.map((t) => [t.id, t]));
      return allTasks.map((t) => (t.days.includes(day) && seqMap.has(t.id) ? seqMap.get(t.id)! : t));
    }

    // Find the nearest movable task above idx (jumping over fixed anchors like Tutoring)
    let targetIdx = idx - 1;
    while (targetIdx >= 0 && isFixed(dayTasks[targetIdx])) {
      targetIdx--;
    }
    if (targetIdx >= 0) {
      return swapTwoTasks(allTasks, dayTasks[targetIdx].id, taskId, day, config, hiddenTaskIds);
    }
  } else if (direction === 'down' && idx < dayTasks.length - 1) {
    // Find the nearest movable task below idx (jumping over fixed anchors like Tutoring)
    let targetIdx = idx + 1;
    while (targetIdx < dayTasks.length && isFixed(dayTasks[targetIdx])) {
      targetIdx++;
    }
    if (targetIdx < dayTasks.length) {
      return swapTwoTasks(allTasks, taskId, dayTasks[targetIdx].id, day, config, hiddenTaskIds);
    }
  }

  return allTasks;
}

export const RUSSIAN_DAY_ACCUSATIVE: Record<DayOfWeek, string> = {
  mon: 'понедельник',
  tue: 'вторник',
  wed: 'среду',
  thu: 'четверг',
  fri: 'пятницу',
  sat: 'субботу',
  sun: 'воскресенье',
};

export type ConflictResolutionOption =
  | 'cascade_same_day'
  | 'shift_earlier'
  | 'shift_later'
  | 'move_to_evening'
  | 'move_to_next_day';

export interface TaskPlacementAnalysis {
  hasConflict: boolean;
  overlappingTasks: ScheduleTask[];
  subsequentTasks: ScheduleTask[];
  precedingTasks: ScheduleTask[];
  canShiftEarlier: boolean;
  canShiftLater: boolean;
  hasChoiceEarlierOrLater: boolean;
  earlierSlotStartTime?: string;
  laterSlotStartTime?: string;
  freeTimeRemovedMinutes: number;
  freeTimeTaskTitles: string[];
  canFitSameDay: boolean;
  overflowTasks: ScheduleTask[];
  canMoveToEvening: boolean;
  mustMoveToNextDay: boolean;
  recommendationMessage: string;
  nextDayName: string;
  options: {
    mode: ConflictResolutionOption;
    label: string;
    description: string;
    isRecommended?: boolean;
    disabled?: boolean;
  }[];
}

/**
 * Performs deep feasibility analysis when placing a task at a specific time:
 * 1. Checks collisions with overlapping and preceding/subsequent tasks.
 * 2. Compresses or deletes excess free time ("свободное время", "отдых") — NEVER touching meals.
 * 3. If overlapping with scheduled tasks (e.g. gym on Friday):
 *    - checks if overlapping tasks can be shifted EARLIER (e.g. into previous free time).
 *    - checks if overlapping tasks can be shifted LATER (after the new plan).
 *    - if both earlier and later are viable, explicitly prompts the user to choose earlier vs later.
 * 4. Explicitly lists the exact names of all displaced or overflow tasks.
 */
export function analyzeTaskTimePlacement(
  allTasks: ScheduleTask[],
  movingTask: ScheduleTask,
  targetDay: DayOfWeek,
  config: UserScheduleConfig,
  hiddenTaskIds?: string[]
): TaskPlacementAnalysis {
  const hiddenSet = new Set(hiddenTaskIds || []);
  const newStartMins = timeToMinutes(movingTask.startTime);
  const rawEndMins = timeToMinutes(movingTask.endTime);
  const dur = movingTask.durationMinutes || Math.max(15, rawEndMins - newStartMins) || 60;
  const newEndMins = rawEndMins <= newStartMins ? Math.min(1435, newStartMins + dur) : rawEndMins;
  const nextDay = NEXT_DAY_MAP[targetDay];
  const nextDayName = RUSSIAN_DAY_ACCUSATIVE[nextDay];

  const dayTasks = allTasks.filter(
    (t) => t.days.includes(targetDay) && t.id !== movingTask.id && !hiddenSet.has(t.id)
  );

  const isMovingWake = isWakeUpTask(movingTask);

  // Directly overlapping tasks (excluding fixed university classes and hidden tasks)
  const overlappingTasks = dayTasks.filter((t) => {
    if (isUniversityBlock(t)) return false;
    const s = timeToMinutes(t.startTime);
    const e = timeToMinutes(t.endTime);
    return s < newEndMins && e > newStartMins;
  });

  const rawPairInfo = getEffectivePair(targetDay, config);
  const hasActiveUniOnDay = Boolean(
    rawPairInfo &&
      dayTasks.some(
        (t) => isUniversityBlock(t) || t.category === 'study_uni' || t.id.includes('uni-classes')
      )
  );
  const pairInfo = hasActiveUniOnDay ? rawPairInfo : null;
  const prepStartMins = pairInfo ? timeToMinutes(pairInfo.startTime) - 60 : 1440;
  const returnEndMins = pairInfo ? timeToMinutes(pairInfo.endTime) + 30 : 1440;
  const bedtimeMins = 1435; // 23:55

  // Preceding tasks that end before or at newStartMins
  const precedingTasks = dayTasks
    .filter((t) => {
      if (isUniversityBlock(t)) return false;
      if (isMovingWake) return false;
      return timeToMinutes(t.endTime) <= newStartMins;
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Subsequent tasks that start at or after newStartMins and conflict/overlap with newEndMins
  const subsequentTasks = dayTasks
    .filter((t) => {
      if (isUniversityBlock(t)) return false;
      const s = timeToMinutes(t.startTime);
      const e = timeToMinutes(t.endTime);
      return (
        overlappingTasks.some((o) => o.id === t.id) ||
        (s < newEndMins && e > newStartMins)
      );
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // If no overlaps and no subsequent tasks colliding
  if (overlappingTasks.length === 0 && subsequentTasks.length === 0) {
    return {
      hasConflict: false,
      overlappingTasks: [],
      subsequentTasks: [],
      precedingTasks,
      canShiftEarlier: false,
      canShiftLater: false,
      hasChoiceEarlierOrLater: false,
      freeTimeRemovedMinutes: 0,
      freeTimeTaskTitles: [],
      canFitSameDay: true,
      overflowTasks: [],
      canMoveToEvening: false,
      mustMoveToNextDay: false,
      recommendationMessage: 'Время свободно, накладок нет.',
      nextDayName,
      options: [
        {
          mode: 'cascade_same_day',
          label: 'Сохранить',
          description: 'Время свободно',
          isRecommended: true,
        },
      ],
    };
  }

  // Handle case: Direct overlap with existing tasks (e.g. adding plans that clash with gym or existing plans)
  if (overlappingTasks.length > 0) {
    const realOverlapping = overlappingTasks.filter((t) => !isFreeTimeTask(t));
    const tasksToAskAbout = realOverlapping.length > 0 ? realOverlapping : overlappingTasks;

    const overlappingNames = tasksToAskAbout.map((t) => `«${t.title}»`).join(', ');
    const totalOverlappingDur = tasksToAskAbout.reduce(
      (sum, t) => sum + (t.durationMinutes || Math.max(15, timeToMinutes(t.endTime) - timeToMinutes(t.startTime)) || 30),
      0
    );

    // Can we shift overlapping tasks EARLIER (before newStartMins)?
    const isThu = targetDay === 'thu';
    const isWeekend = targetDay === 'sat' || targetDay === 'sun';
    const wakeUpTarget = isThu
      ? config?.wakeUpTimeThursday || '08:30'
      : isWeekend
      ? config?.wakeUpTimeWeekend || '10:00'
      : config?.wakeUpTimeWeekday || '09:00';
    const wakeUpMins = timeToMinutes(wakeUpTarget);
    const earliestAllowedStart = pairInfo && newStartMins > returnEndMins ? returnEndMins : wakeUpMins;

    const canShiftEarlier = !isMovingWake && newStartMins - totalOverlappingDur >= earliestAllowedStart;
    const earlierSlotStart = Math.max(earliestAllowedStart, newStartMins - totalOverlappingDur);
    const earlierSlotStartTime = minutesToTime(earlierSlotStart);

    // Can we shift overlapping tasks LATER (after newEndMins)?
    const nonFreeSubsequent = subsequentTasks
      .filter((t) => !tasksToAskAbout.some((o) => o.id === t.id))
      .filter((t) => !isFreeTimeTask(t) && !isEveningSeries(t));
    const nonFreeSubsequentDur = nonFreeSubsequent.reduce(
      (sum, t) => sum + (t.durationMinutes || Math.max(15, timeToMinutes(t.endTime) - timeToMinutes(t.startTime)) || 30),
      0
    );

    const canShiftLater = isMovingWake || !pairInfo || newEndMins < bedtimeMins;
    const laterSlotStartTime = minutesToTime(newEndMins);

    const conflictOptions: Array<{
      mode: ConflictResolutionOption;
      label: string;
      description: string;
      isRecommended?: boolean;
    }> = [
      {
        mode: 'shift_later',
        label: `Сдвинуть позже (на ${laterSlotStartTime})`,
        description: `Переместить ${overlappingNames} сразу после новых планов (с ${laterSlotStartTime})`,
        isRecommended: true,
      },
    ];

    if (canShiftEarlier) {
      conflictOptions.push({
        mode: 'shift_earlier',
        label: `Сдвинуть раньше (на ${earlierSlotStartTime})`,
        description: `Переместить ${overlappingNames} перед новыми планами (до ${movingTask.startTime})`,
        isRecommended: false,
      });
    }

    conflictOptions.push({
      mode: 'move_to_next_day',
      label: `Перенести ${overlappingNames} на ${nextDayName}`,
      description: `Перенести конфликтующие дела на ${nextDayName}`,
    });

    return {
      hasConflict: true,
      overlappingTasks: tasksToAskAbout,
      subsequentTasks,
      precedingTasks,
      canShiftEarlier,
      canShiftLater,
      hasChoiceEarlierOrLater: canShiftEarlier && canShiftLater,
      earlierSlotStartTime,
      laterSlotStartTime,
      freeTimeRemovedMinutes: 0,
      freeTimeTaskTitles: [],
      canFitSameDay: true,
      overflowTasks: tasksToAskAbout,
      canMoveToEvening: false,
      mustMoveToNextDay: false,
      recommendationMessage: `На это время (${movingTask.startTime}–${minutesToTime(newEndMins)}) уже запланированы дела: ${overlappingNames}. Куда их передвинуть?`,
      nextDayName,
      options: conflictOptions,
    };
  }

  // Determine if movingTask is in daytime (before university prep)
  const isBeforeUni = pairInfo && newStartMins < prepStartMins;

  if (isBeforeUni) {
    const daytimeAvailable = Math.max(0, prepStartMins - newEndMins);
    const daytimeSubsequent = subsequentTasks.filter((t) => timeToMinutes(t.startTime) < prepStartMins);

    // Free time tasks in daytime (excluding meals!)
    const freeTimeTasks = daytimeSubsequent.filter((t) => isFreeTimeTask(t));
    const nonFreeTasks = daytimeSubsequent.filter((t) => !freeTimeTasks.some((f) => f.id === t.id));

    const nonFreeDuration = nonFreeTasks.reduce(
      (sum, t) => sum + (t.durationMinutes || Math.max(15, timeToMinutes(t.endTime) - timeToMinutes(t.startTime)) || 30),
      0
    );
    const freeDuration = freeTimeTasks.reduce((sum, t) => sum + (t.durationMinutes || 30), 0);
    const totalDaytimeDuration = nonFreeDuration + freeDuration;

    // Case 1: All tasks fit even with free time
    if (totalDaytimeDuration <= daytimeAvailable) {
      const subsequentNames = subsequentTasks.map((t) => `«${t.title}»`).join(', ');
      return {
        hasConflict: overlappingTasks.length > 0,
        overlappingTasks,
        subsequentTasks,
        precedingTasks,
        canShiftEarlier: false,
        canShiftLater: true,
        hasChoiceEarlierOrLater: false,
        freeTimeRemovedMinutes: 0,
        freeTimeTaskTitles: [],
        canFitSameDay: true,
        overflowTasks: [],
        canMoveToEvening: false,
        mustMoveToNextDay: false,
        recommendationMessage: `Все последующие дела (${subsequentNames}) автоматически сдвинутся по цепочке без накладок.`,
        nextDayName,
        options: [
          {
            mode: 'cascade_same_day',
            label: 'Сдвинуть все дела цепочкой',
            description: `Последующие дела (${subsequentNames}) сдвинутся на свободное время`,
            isRecommended: true,
          },
          {
            mode: 'move_to_next_day',
            label: `Перенести на ${nextDayName}`,
            description: `Перенести перекрывающиеся дела на ${nextDayName}`,
          },
        ],
      };
    }

    // Case 2: Deficit can be solved by deleting/compressing free time
    const deficit = totalDaytimeDuration - daytimeAvailable;
    if (deficit <= freeDuration) {
      const nonFreeNames = nonFreeTasks.map((t) => `«${t.title}»`).join(', ');
      const freeNames = freeTimeTasks.map((t) => `«${t.title}»`).join(', ');
      return {
        hasConflict: true,
        overlappingTasks,
        subsequentTasks,
        precedingTasks,
        canShiftEarlier: false,
        canShiftLater: true,
        hasChoiceEarlierOrLater: false,
        freeTimeRemovedMinutes: deficit,
        freeTimeTaskTitles: freeTimeTasks.map((t) => t.title),
        canFitSameDay: true,
        overflowTasks: [],
        canMoveToEvening: false,
        mustMoveToNextDay: false,
        recommendationMessage: `Свободное время (${freeNames}) будет удалено/сжато, чтобы дела (${nonFreeNames}) поместились до пар без накладок.`,
        nextDayName,
        options: [
          {
            mode: 'cascade_same_day',
            label: 'Удалить свободное время & сдвинуть дела',
            description: `Удалить лишний отдых и сдвинуть по цепочке дела: ${nonFreeNames}`,
            isRecommended: true,
          },
          {
            mode: 'move_to_next_day',
            label: `Перенести на ${nextDayName}`,
            description: `Оставить свободное время и перенести дела на ${nextDayName}`,
          },
        ],
      };
    }

    // Case 3: Even with ALL free time deleted, non-free tasks overflow
    let cur = newEndMins;
    const fittingDaytime: ScheduleTask[] = [];
    const overflowTasks: ScheduleTask[] = [];

    nonFreeTasks.forEach((t) => {
      const dur = t.durationMinutes || Math.max(15, timeToMinutes(t.endTime) - timeToMinutes(t.startTime)) || 30;
      if (cur + dur <= prepStartMins) {
        fittingDaytime.push(t);
        cur += dur;
      } else {
        overflowTasks.push(t);
      }
    });

    const overflowNames = overflowTasks.map((t) => `«${t.title}»`).join(', ');

    // Check if overflowTasks can fit in the evening (after returnEndMins)
    const eveningAvailable = Math.max(0, 1380 - returnEndMins); // up to 23:00 series
    const existingEvening = dayTasks.filter((t) => !isUniversityBlock(t) && timeToMinutes(t.startTime) >= returnEndMins);
    const existingEveningNonFree = existingEvening.filter(
      (t) => !isFreeTimeTask(t) && !isEveningSeries(t)
    );
    const existingEveDuration = existingEveningNonFree.reduce((sum, t) => sum + (t.durationMinutes || 30), 0);
    const overflowDuration = overflowTasks.reduce((sum, t) => sum + (t.durationMinutes || 30), 0);

    const canMoveToEvening = existingEveDuration + overflowDuration <= eveningAvailable;

    if (canMoveToEvening) {
      return {
        hasConflict: true,
        overlappingTasks,
        subsequentTasks,
        precedingTasks,
        canShiftEarlier: false,
        canShiftLater: true,
        hasChoiceEarlierOrLater: false,
        freeTimeRemovedMinutes: freeDuration,
        freeTimeTaskTitles: freeTimeTasks.map((t) => t.title),
        canFitSameDay: false,
        overflowTasks,
        canMoveToEvening: true,
        mustMoveToNextDay: false,
        recommendationMessage: `До пар не хватает времени (свободное время уже убрано). Дела ${overflowNames} можно перенести на вечер после пар!`,
        nextDayName,
        options: [
          {
            mode: 'move_to_evening',
            label: 'Перенести на вечер после пар',
            description: `Переместить ${overflowNames} на вечер (после ${minutesToTime(returnEndMins)})`,
            isRecommended: true,
          },
          {
            mode: 'move_to_next_day',
            label: `Перенести на ${nextDayName}`,
            description: `Переместить ${overflowNames} на ${nextDayName}`,
          },
        ],
      };
    } else {
      return {
        hasConflict: true,
        overlappingTasks,
        subsequentTasks,
        precedingTasks,
        canShiftEarlier: false,
        canShiftLater: false,
        hasChoiceEarlierOrLater: false,
        freeTimeRemovedMinutes: freeDuration,
        freeTimeTaskTitles: freeTimeTasks.map((t) => t.title),
        canFitSameDay: false,
        overflowTasks,
        canMoveToEvening: false,
        mustMoveToNextDay: true,
        recommendationMessage: `На это время поставить нельзя! Иначе следующие планы: ${overflowNames} не помещаются сегодня даже при удалении свободного времени и их нужно переносить только на другой день (${nextDayName}).`,
        nextDayName,
        options: [
          {
            mode: 'move_to_next_day',
            label: `Перенести ${overflowNames} на ${nextDayName}`,
            description: `Единственный вариант: перенести не помещающиеся дела на ${nextDayName}`,
            isRecommended: true,
          },
        ],
      };
    }
  } else {
    // Afternoon / Evening or Day without University (Fri, Sat, Sun)
    let cur = newEndMins;
    const fitting: ScheduleTask[] = [];
    const overflowTasks: ScheduleTask[] = [];
    const freeTimeTasks: ScheduleTask[] = [];

    subsequentTasks.forEach((t) => {
      if (isFreeTimeTask(t)) {
        freeTimeTasks.push(t);
        return;
      }
      const dur = t.durationMinutes || Math.max(15, timeToMinutes(t.endTime) - timeToMinutes(t.startTime)) || 30;
      if (cur + dur <= bedtimeMins) {
        fitting.push(t);
        cur += dur;
      } else {
        overflowTasks.push(t);
      }
    });

    if (overflowTasks.length > 0) {
      const overflowNames = overflowTasks.map((t) => `«${t.title}»`).join(', ');
      return {
        hasConflict: true,
        overlappingTasks,
        subsequentTasks,
        precedingTasks,
        canShiftEarlier: false,
        canShiftLater: false,
        hasChoiceEarlierOrLater: false,
        freeTimeRemovedMinutes: freeTimeTasks.reduce((s, t) => s + (t.durationMinutes || 30), 0),
        freeTimeTaskTitles: freeTimeTasks.map((t) => t.title),
        canFitSameDay: false,
        overflowTasks,
        canMoveToEvening: false,
        mustMoveToNextDay: true,
        recommendationMessage: `На это время поставить нельзя! Иначе следующие планы: ${overflowNames} не помещаются до конца дня и их нужно переносить только на другой день (${nextDayName}).`,
        nextDayName,
        options: [
          {
            mode: 'move_to_next_day',
            label: `Перенести ${overflowNames} на ${nextDayName}`,
            description: `Переместить не помещающиеся планы на ${nextDayName}`,
            isRecommended: true,
          },
        ],
      };
    }

    const subsequentNames = subsequentTasks.map((t) => `«${t.title}»`).join(', ');
    return {
      hasConflict: overlappingTasks.length > 0,
      overlappingTasks,
      subsequentTasks,
      precedingTasks,
      canShiftEarlier: false,
      canShiftLater: true,
      hasChoiceEarlierOrLater: false,
      freeTimeRemovedMinutes: freeTimeTasks.reduce((s, t) => s + (t.durationMinutes || 30), 0),
      freeTimeTaskTitles: freeTimeTasks.map((t) => t.title),
      canFitSameDay: true,
      overflowTasks: [],
      canMoveToEvening: false,
      mustMoveToNextDay: false,
      recommendationMessage: `Все последующие дела (${subsequentNames}) автоматически сдвинутся по цепочке без накладок.`,
      nextDayName,
      options: [
        {
          mode: 'cascade_same_day',
          label: 'Сдвинуть все дела цепочкой',
          description: `Все последующие дела (${subsequentNames}) сдвинутся дальше`,
          isRecommended: true,
        },
        {
          mode: 'move_to_next_day',
          label: `Перенести на ${nextDayName}`,
          description: `Переместить перекрывающиеся дела на ${nextDayName}`,
        },
      ],
    };
  }
}

export interface AffectedTaskDetail {
  id: string;
  task: ScheduleTask;
  title: string;
  category: TaskCategory;
  originalStartTime: string;
  originalEndTime: string;
  proposedStartTime: string;
  proposedEndTime: string;
  durationMinutes: number;
  shiftDeltaMinutes: number;
  isDirectOverlap: boolean;
  isUniversityBlock: boolean;
  isTutoringBlock?: boolean;
  movedToEvening?: boolean;
  isDropped?: boolean;
  overlapWithTitle?: string;
}

/**
 * Computes the full cascade chain of all tasks affected by placing/moving a task:
 * Returns every task whose time was shifted, displaced, moved to evening, or directly overlapped.
 * Also immediately detects secondary collisions: if any task is moved to a time where another
 * task already exists, that task is immediately added to the list as well!
 */
export function computeAllAffectedTasks(
  allTasks: ScheduleTask[],
  movingTask: ScheduleTask,
  targetDay: DayOfWeek,
  resolutionMode: ConflictResolutionOption,
  config: UserScheduleConfig,
  customTimes?: Record<string, { startTime: string; endTime: string }>,
  deletedTaskIds?: string[],
  movedToDays?: Record<string, DayOfWeek>,
  hiddenTaskIds?: string[]
): AffectedTaskDetail[] {
  const hiddenSet = new Set(hiddenTaskIds || []);
  const dayOriginalTasks = allTasks
    .filter((t) => t.days.includes(targetDay) && t.id !== movingTask.id && !hiddenSet.has(t.id))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const newStartMins = timeToMinutes(movingTask.startTime);
  const rawEndMins = timeToMinutes(movingTask.endTime);
  const dur = movingTask.durationMinutes || Math.max(15, rawEndMins - newStartMins) || 60;
  const newEndMins = rawEndMins <= newStartMins ? Math.min(1435, newStartMins + dur) : rawEndMins;
  const isMovingWake = isWakeUpTask(movingTask);

  const safeMovingTask: ScheduleTask = {
    ...movingTask,
    endTime: minutesToTime(newEndMins),
    durationMinutes: dur,
  };

  // Directly overlapping task IDs with movingTask (ignoring hidden tasks)
  const directOverlapIds = new Set(
    dayOriginalTasks
      .filter((t) => {
        if (isUniversityBlock(t)) return false;
        const s = timeToMinutes(t.startTime);
        const e = timeToMinutes(t.endTime);
        if (isMovingWake) {
          // When wake-up is shifted, all tasks scheduled before the new wake-up ends are directly displaced!
          return s < newEndMins;
        }
        return s < newEndMins && e > newStartMins;
      })
      .map((t) => t.id)
  );

  // Run simulation of cascading schedule excluding hidden tasks
  const sim = applyTaskScheduleWithSmartCascading(
    allTasks,
    safeMovingTask,
    targetDay,
    resolutionMode,
    config,
    hiddenTaskIds
  );

  const simMap = new Map<string, ScheduleTask>();
  sim.updatedTasks
    .filter((t) => t.days.includes(targetDay))
    .forEach((t) => simMap.set(t.id, t));

  const affectedMap = new Map<string, AffectedTaskDetail>();

  dayOriginalTasks.forEach((orig) => {
    if (orig.id === movingTask.id) return;

    const simTask = simMap.get(orig.id);
    const isDirectOverlap = directOverlapIds.has(orig.id);
    const isUni = isUniversityBlock(orig);

    if (!simTask) {
      if (isTutoringTask(orig) || isGymTask(orig)) {
        // Tutoring and Gym are NEVER dropped!
        return;
      }
      affectedMap.set(orig.id, {
        id: orig.id,
        task: orig,
        title: orig.title,
        category: orig.category,
        originalStartTime: orig.startTime,
        originalEndTime: orig.endTime,
        proposedStartTime: orig.startTime,
        proposedEndTime: orig.endTime,
        durationMinutes: orig.durationMinutes || 30,
        shiftDeltaMinutes: 0,
        isDirectOverlap,
        isUniversityBlock: isUni,
        isDropped: true,
      });
      return;
    }

    // RULE: "не сдвигай вообще репетиторство пока я сама не поправлю время в редактировании"
    // Tutoring and Gym times must never be changed when moving unrelated daytime tasks
    if (isTutoringTask(orig) || isGymTask(orig)) {
      if (isDirectOverlap) {
        affectedMap.set(orig.id, {
          id: orig.id,
          task: orig,
          title: orig.title,
          category: orig.category,
          originalStartTime: orig.startTime,
          originalEndTime: orig.endTime,
          proposedStartTime: orig.startTime,
          proposedEndTime: orig.endTime,
          durationMinutes: orig.durationMinutes || 60,
          shiftDeltaMinutes: 0,
          isDirectOverlap: true,
          isUniversityBlock: false,
          isTutoringBlock: isTutoringTask(orig),
        });
      }
      return;
    }

    const timeChanged =
      simTask.startTime !== orig.startTime || simTask.endTime !== orig.endTime;

    if (timeChanged || isDirectOverlap) {
      const origStartM = timeToMinutes(orig.startTime);
      const simStartM = timeToMinutes(simTask.startTime);

      // Rule: Do not shift earlier on its own unless resolutionMode is explicitly 'shift_earlier'
      let finalPropStartM = simStartM;
      if (resolutionMode !== 'shift_earlier' && simStartM < origStartM) {
        finalPropStartM = origStartM;
      }
      const dur =
        simTask.durationMinutes ||
        orig.durationMinutes ||
        Math.max(15, timeToMinutes(simTask.endTime) - simStartM);
      const finalPropEndM = Math.min(1435, finalPropStartM + dur);
      const delta = finalPropStartM - origStartM;

      if (finalPropStartM !== origStartM || finalPropEndM !== timeToMinutes(orig.endTime) || isDirectOverlap) {
        affectedMap.set(orig.id, {
          id: orig.id,
          task: orig,
          title: orig.title,
          category: orig.category,
          originalStartTime: orig.startTime,
          originalEndTime: orig.endTime,
          proposedStartTime: minutesToTime(finalPropStartM),
          proposedEndTime: minutesToTime(finalPropEndM),
          durationMinutes: dur,
          shiftDeltaMinutes: delta,
          isDirectOverlap,
          isUniversityBlock: isUni,
          movedToEvening: finalPropStartM >= 1260 && origStartM < 1260,
        });
      }
    }
  });

  // SECONDARY COLLISIONS DETECTION:
  // "если я передвигаю накладку, добавляй сразу дело которое на это же время куда я переставила"
  // Whenever any task in the affected list (or movingTask) has a time slot (from customTimes or proposed),
  // check if any OTHER task on this day occupies that same time slot. If so, immediately add it!
  const deletedSet = new Set(deletedTaskIds || []);
  const movedMap = movedToDays || {};

  let iteration = 0;
  let addedNew = true;

  while (addedNew && iteration < 10) {
    iteration++;
    addedNew = false;

    // Collect all active placed intervals:
    // 1) movingTask itself
    const activeSlots: Array<{ id: string; title: string; startM: number; endM: number }> = [
      { id: movingTask.id, title: movingTask.title, startM: newStartMins, endM: newEndMins },
    ];

    // 2) all tasks currently in affectedMap (unless deleted or moved to another day)
    affectedMap.forEach((aff) => {
      if (deletedSet.has(aff.id) || movedMap[aff.id]) return;
      const custom = customTimes?.[aff.id];
      const startStr = custom?.startTime ?? aff.proposedStartTime;
      const endStr = custom?.endTime ?? aff.proposedEndTime;
      activeSlots.push({
        id: aff.id,
        title: aff.title,
        startM: timeToMinutes(startStr),
        endM: timeToMinutes(endStr),
      });
    });

    // Check all day tasks for collision with any activeSlot
    for (const orig of dayOriginalTasks) {
      if (orig.id === movingTask.id) continue;
      if (deletedSet.has(orig.id) || movedMap[orig.id]) continue;

      const origCustom = customTimes?.[orig.id];
      const origAff = affectedMap.get(orig.id);
      const oStartM = timeToMinutes(origCustom?.startTime ?? origAff?.proposedStartTime ?? orig.startTime);
      const oEndM = timeToMinutes(origCustom?.endTime ?? origAff?.proposedEndTime ?? orig.endTime);

      for (const slot of activeSlots) {
        if (slot.id === orig.id) continue;
        if (oStartM < slot.endM && oEndM > slot.startM) {
          // Collision detected!
          if (!affectedMap.has(orig.id)) {
            const isTutor = isTutoringTask(orig);
            const isGym = isGymTask(orig);
            if (isTutor || isGym) {
              // Tutoring and Gym are priority anchors and do not shift due to incidental slot overlap
              continue;
            }
            const oDur = orig.durationMinutes || Math.max(15, oEndM - oStartM) || 30;
            const propStartM = Math.max(slot.endM, timeToMinutes(orig.startTime));
            const propEndM = Math.min(1435, propStartM + oDur);
            affectedMap.set(orig.id, {
              id: orig.id,
              task: orig,
              title: orig.title,
              category: orig.category,
              originalStartTime: orig.startTime,
              originalEndTime: orig.endTime,
              proposedStartTime: minutesToTime(propStartM),
              proposedEndTime: minutesToTime(propEndM),
              durationMinutes: oDur,
              shiftDeltaMinutes: isTutor ? 0 : propStartM - timeToMinutes(orig.startTime),
              isDirectOverlap: true,
              isUniversityBlock: isUniversityBlock(orig),
              isTutoringBlock: isTutor,
              overlapWithTitle: slot.title,
            });
            addedNew = true;
          } else {
            const currentAff = affectedMap.get(orig.id)!;
            if (!currentAff.overlapWithTitle && slot.id !== movingTask.id) {
              currentAff.overlapWithTitle = slot.title;
            }
          }
        }
      }
    }
  }

  // Return sorted chronologically by active start time
  return Array.from(affectedMap.values()).sort((a, b) => {
    const aTime = customTimes?.[a.id]?.startTime ?? a.proposedStartTime ?? a.originalStartTime;
    const bTime = customTimes?.[b.id]?.startTime ?? b.proposedStartTime ?? b.originalStartTime;
    return aTime.localeCompare(bTime);
  });
}

/**
 * Layouts day tasks strictly adhering to golden rules:
 * 1. University classes and commute have 100% FIXED immutable times (never shifted by even 1 minute!).
 * 2. Excess free time is dropped if daytime doesn't fit before university prep ("просто удаляй отдых если все не вмещается").
 * 3. Languages and interview prep (SQL, Python, Stat) can be comfortably arranged or moved to evening after university return.
 * 4. Abs workout is placed directly before dinner or directly before shower ("а пресс перед ужином или перед душем").
 * 5. Gym is scheduled in the evening ("так же как зал вечером").
 * 6. Reading book is before 23:00 series.
 */
export function layoutDayTasksRespectingFixedPairsAndBaseline(
  targetDay: DayOfWeek,
  tasksToPlace: ScheduleTask[],
  newStartMins: number,
  newEndMins: number,
  config: UserScheduleConfig
): {
  remapped: Map<string, { startTime: string; endTime: string; durationMinutes?: number }>;
  freeToDrop: Set<string>;
  notice: string;
} {
  const pairInfo = getEffectivePair(targetDay, config);
  const remapped = new Map<string, { startTime: string; endTime: string; durationMinutes?: number }>();
  const freeToDrop = new Set<string>();

  // DAY WITH UNIVERSITY PAIR (Mon, Tue, Wed, Thu) - only if university blocks are present
  if (pairInfo && tasksToPlace.some(isUniversityBlock)) {
    const pairStartMins = timeToMinutes(pairInfo.startTime);
    const pairEndMins = timeToMinutes(pairInfo.endTime);
    const prepStartMins = pairStartMins - 60;
    const travelStartMins = pairStartMins - 30;
    const returnEndMins = pairEndMins + 30;

    tasksToPlace.forEach((t) => {
      if (isUniversityBlock(t)) {
        if (t.category === 'study_uni' || t.title.toLowerCase().includes('пары') || t.id.includes('uni-classes')) {
          remapped.set(t.id, {
            startTime: pairInfo.startTime,
            endTime: pairInfo.endTime,
            durationMinutes: pairEndMins - pairStartMins,
          });
        } else if (
          t.id.includes('-prep-uni') ||
          (t.title.toLowerCase().includes('сборы') &&
            (t.title.toLowerCase().includes('вуз') || t.title.toLowerCase().includes('университет')))
        ) {
          remapped.set(t.id, {
            startTime: minutesToTime(prepStartMins),
            endTime: minutesToTime(travelStartMins),
            durationMinutes: 30,
          });
        } else if (t.id.includes('-travel-uni') || t.title.toLowerCase().includes('дорога в вуз')) {
          remapped.set(t.id, {
            startTime: minutesToTime(travelStartMins),
            endTime: minutesToTime(pairStartMins),
            durationMinutes: 30,
          });
        } else if (t.id.includes('-travel-home') || t.title.toLowerCase().includes('дорога домой')) {
          remapped.set(t.id, {
            startTime: minutesToTime(pairEndMins),
            endTime: minutesToTime(returnEndMins),
            durationMinutes: 30,
          });
        }
      } else if (isTutoringTask(t)) {
        // RULE: "не сдвигай вообще репетиторство пока я сама не поправлю время в редактировании"
        remapped.set(t.id, {
          startTime: t.startTime,
          endTime: t.endTime,
          durationMinutes: t.durationMinutes || Math.max(15, timeToMinutes(t.endTime) - timeToMinutes(t.startTime)),
        });
      } else if (isGymTask(t)) {
        // RULE: "зал вечером" - Gym has a dedicated scheduled time. Unrelated daytime moves must NEVER shift gym later!
        remapped.set(t.id, {
          startTime: t.startTime,
          endTime: t.endTime,
          durationMinutes: t.durationMinutes || Math.max(10, timeToMinutes(t.endTime) - timeToMinutes(t.startTime)),
        });
      }
    });

    const nonUniTasks = tasksToPlace.filter((t) => !isUniversityBlock(t) && !isTutoringTask(t) && !isGymTask(t));
    const sortedBaseline = [...nonUniTasks].sort((a, b) => {
      const startDiff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
      if (startDiff !== 0) return startDiff;
      return getBaselineTaskIndex(a, targetDay) - getBaselineTaskIndex(b, targetDay);
    });

    const daytimeCandidates: ScheduleTask[] = [];
    const eveningCandidates: ScheduleTask[] = [];

    sortedBaseline.forEach((t) => {
      const origStart = timeToMinutes(t.startTime);
      if (isEveningRoutineTask(t) || isGymTask(t) || origStart >= returnEndMins) {
        eveningCandidates.push(t);
      } else {
        daytimeCandidates.push(t);
      }
    });

    // Daytime window: from newEndMins to prepStartMins
    const daytimeAvail = Math.max(0, prepStartMins - newEndMins);
    const daytimeReal = daytimeCandidates.filter((t) => !isFreeTimeTask(t));
    const daytimeRest = daytimeCandidates.filter((t) => isFreeTimeTask(t));

    const realDur = daytimeReal.reduce((s, t) => s + (t.durationMinutes || 30), 0);
    const restDur = daytimeRest.reduce((s, t) => s + (t.durationMinutes || 30), 0);

    // Rule: "просто удаляй отдых если все не вмещается"
    let toPlaceInDaytime: ScheduleTask[] = [];
    if (realDur + restDur <= daytimeAvail) {
      toPlaceInDaytime = daytimeCandidates;
    } else {
      daytimeRest.forEach((r) => freeToDrop.add(r.id));
      toPlaceInDaytime = daytimeReal;
    }

    const daytimeTutoring = tasksToPlace.find(
      (t) => isTutoringTask(t) && timeToMinutes(t.startTime) < prepStartMins
    );

    let curDay = newEndMins;
    const daytimeOverflowToEve: ScheduleTask[] = [];

    toPlaceInDaytime.forEach((t) => {
      const dur = t.durationMinutes || 30;
      const origStart = timeToMinutes(t.startTime);
      let plannedStart = Math.max(curDay, origStart);

      if (daytimeTutoring) {
        const tutStartM = timeToMinutes(daytimeTutoring.startTime);
        const tutEndM = timeToMinutes(daytimeTutoring.endTime);
        if (plannedStart < tutStartM) {
          if (plannedStart + dur > tutStartM) {
            plannedStart = Math.max(tutEndM, origStart);
          }
        } else if (plannedStart < tutEndM) {
          plannedStart = Math.max(tutEndM, origStart);
        }
      }

      if (plannedStart + dur <= prepStartMins) {
        remapped.set(t.id, {
          startTime: minutesToTime(plannedStart),
          endTime: minutesToTime(plannedStart + dur),
          durationMinutes: dur,
        });
        curDay = plannedStart + dur;
        if (daytimeTutoring) {
          const tutStartM = timeToMinutes(daytimeTutoring.startTime);
          const tutEndM = timeToMinutes(daytimeTutoring.endTime);
          if (curDay > tutStartM && curDay < tutEndM) {
            curDay = tutEndM;
          }
        }
      } else {
        // "ты можешь менять планы по языкам и подготовке к собесу по времени для комфорта"
        daytimeOverflowToEve.push(t);
      }
    });

    const eveTutoring = tasksToPlace.find(
      (t) => isTutoringTask(t) && timeToMinutes(t.startTime) >= returnEndMins
    );

    // Evening sequencing (starting at returnEndMins, e.g. 21:10)
    // Order:
    // 1. Dinner (ужин)
    // 2. Abs workout ("а пресс перед ужином или перед душем")
    // 3. Overflow daytime tasks (languages, career)
    // 4. Evening shower (душ)
    // 5. Reading (чтение)
    // 6. Series (23:00)
    const allEve = [...daytimeOverflowToEve, ...eveningCandidates].filter((t) => !isTutoringTask(t)).sort((a, b) => {
      const aLower = a.title.toLowerCase();
      const bLower = b.title.toLowerCase();
      const aDinner = isDinnerTask(a);
      const bDinner = isDinnerTask(b);
      const aAbs = a.category === 'abs' || aLower.includes('пресс');
      const bAbs = b.category === 'abs' || bLower.includes('пресс');
      const aShower = isShowerTask(a);
      const bShower = isShowerTask(b);
      const aReading = isReadingTask(a);
      const bReading = isReadingTask(b);
      const aSeries = isEveningSeries(a);
      const bSeries = isEveningSeries(b);

      if (aSeries) return 1;
      if (bSeries) return -1;
      if (aReading && !bReading) return 1;
      if (!aReading && bReading) return -1;

      // Gym sequence integrity: prep -> walk to gym -> gym -> walk home
      const aGymOrder = getGymSequenceIndex(a);
      const bGymOrder = getGymSequenceIndex(b);
      if (aGymOrder !== -1 && bGymOrder !== -1) {
        return aGymOrder - bGymOrder;
      }
      if (aGymOrder !== -1 && bShower) return -1;
      if (aShower && bGymOrder !== -1) return 1;

      if (aShower && !bShower && !bReading && !bSeries) return 1;
      if (!aShower && bShower && !aReading && !aSeries) return -1;

      // Dinner first upon arrival on late uni days
      if (aDinner && !bDinner) return -1;
      if (!aDinner && bDinner) return 1;

      // Abs before shower
      if (aAbs && bShower) return -1;
      if (bAbs && aShower) return 1;

      return getBaselineTaskIndex(a, targetDay) - getBaselineTaskIndex(b, targetDay);
    });

    const gymTasks = tasksToPlace.filter((t) => isGymTask(t));
    const earliestGymStart =
      gymTasks.length > 0 ? Math.min(...gymTasks.map((t) => timeToMinutes(t.startTime))) : 1440;
    const latestGymEnd =
      gymTasks.length > 0 ? Math.max(...gymTasks.map((t) => timeToMinutes(t.endTime))) : returnEndMins;

    let curEve = returnEndMins;
    allEve.forEach((t) => {
      if (isEveningSeries(t)) {
        remapped.set(t.id, {
          startTime: '23:00',
          endTime: '23:55',
          durationMinutes: 55,
        });
        return;
      }
      let dur = t.durationMinutes || 30;
      if (t.category === 'reading') {
        const space = 1380 - curEve;
        if (space > 15 && space < dur) dur = space;
      }
      const origStart = timeToMinutes(t.startTime);
      let plannedStart = Math.max(curEve, origStart);

      if (eveTutoring) {
        const eTutStart = timeToMinutes(eveTutoring.startTime);
        const eTutEnd = timeToMinutes(eveTutoring.endTime);
        if (plannedStart < eTutStart) {
          if (plannedStart + dur > eTutStart) {
            plannedStart = Math.max(eTutEnd, origStart);
          }
        } else if (plannedStart < eTutEnd) {
          plannedStart = Math.max(eTutEnd, origStart);
        }
      }

      // RULE: Gym in the evening must never be pushed forward by daytime overflow or flexible tasks
      if (earliestGymStart < 1440 && plannedStart < earliestGymStart && plannedStart + dur > earliestGymStart) {
        if (isFreeTimeTask(t) || t.title.toLowerCase().includes('полдник') || t.title.toLowerCase().includes('отдых')) {
          const space = earliestGymStart - plannedStart;
          if (space >= 15) {
            dur = space;
          } else {
            freeToDrop.add(t.id);
            return;
          }
        }
      }

      // If task was scheduled after gym, place it cleanly after gym ends
      if (earliestGymStart < 1440 && origStart >= earliestGymStart) {
        plannedStart = Math.max(latestGymEnd, origStart);
      }

      remapped.set(t.id, {
        startTime: minutesToTime(plannedStart),
        endTime: minutesToTime(plannedStart + dur),
        durationMinutes: dur,
      });
      curEve = plannedStart + dur;
      if (eveTutoring) {
        const eTutStart = timeToMinutes(eveTutoring.startTime);
        const eTutEnd = timeToMinutes(eveTutoring.endTime);
        if (curEve >= eTutStart && curEve < eTutEnd) {
          curEve = eTutEnd;
        }
      }
      if (earliestGymStart < 1440 && curEve >= earliestGymStart && curEve < latestGymEnd) {
        curEve = latestGymEnd;
      }
    });

    return {
      remapped,
      freeToDrop,
      notice:
        daytimeOverflowToEve.length > 0
          ? `Пары зафиксированы строго в ${pairInfo.startTime}–${pairInfo.endTime}. Из-за нехватки дневного времени дела «${daytimeOverflowToEve.map((t) => t.title).join(', ')}» перенесены на вечер после пар.`
          : freeToDrop.size > 0
          ? `Пары зафиксированы строго в ${pairInfo.startTime}–${pairInfo.endTime}. Лишний отдых удален, дела выстроены по эталону.`
          : `Пары зафиксированы строго в ${pairInfo.startTime}–${pairInfo.endTime}, дела выстроены по эталону.`,
    };
  }

  // --- DAY WITHOUT UNIVERSITY PAIRS (Fri, Sat, Sun) ---
  tasksToPlace.forEach((t) => {
    if (isTutoringTask(t) || isGymTask(t)) {
      remapped.set(t.id, {
        startTime: t.startTime,
        endTime: t.endTime,
        durationMinutes: t.durationMinutes || Math.max(15, timeToMinutes(t.endTime) - timeToMinutes(t.startTime)),
      });
    }
  });

  const weekendTutoring = tasksToPlace.find((t) => isTutoringTask(t));

  const sorted = [...tasksToPlace].filter((t) => !isTutoringTask(t) && !isGymTask(t)).sort((a, b) => {
    const startDiff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    if (startDiff !== 0) return startDiff;
    return getBaselineTaskIndex(a, targetDay) - getBaselineTaskIndex(b, targetDay);
  });

  const series = sorted.find((t) => isEveningSeries(t));
  const nonSeries = sorted.filter((t) => !isEveningSeries(t));
  const real = nonSeries.filter((t) => !isFreeTimeTask(t));
  const rest = nonSeries.filter((t) => isFreeTimeTask(t));

  const avail = Math.max(0, 1380 - newEndMins);
  const realD = real.reduce((s, t) => s + (t.durationMinutes || 30), 0);
  const restD = rest.reduce((s, t) => s + (t.durationMinutes || 30), 0);

  const toPlace = realD + restD <= avail ? nonSeries : real;
  if (realD + restD > avail) {
    rest.forEach((r) => freeToDrop.add(r.id));
  }

  // Sort respecting chronological order while keeping evening shower -> reading at the end before series
  const sortedToPlace = [...toPlace].sort((a, b) => {
    const aShower = isShowerTask(a) && !a.id.includes('postgym');
    const bShower = isShowerTask(b) && !b.id.includes('postgym');
    const aReading = isReadingTask(a);
    const bReading = isReadingTask(b);

    if (aReading && !bReading) return 1;
    if (!aReading && bReading) return -1;
    if (aShower && !bShower && !bReading) return 1;
    if (!aShower && bShower && !aReading) return -1;

    const startDiff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    if (startDiff !== 0) return startDiff;
    return getBaselineTaskIndex(a, targetDay) - getBaselineTaskIndex(b, targetDay);
  });

  const pairlessGymTasks = tasksToPlace.filter((t) => isGymTask(t));
  const earliestGymStart =
    pairlessGymTasks.length > 0 ? Math.min(...pairlessGymTasks.map((t) => timeToMinutes(t.startTime))) : 1440;
  const latestGymEnd =
    pairlessGymTasks.length > 0 ? Math.max(...pairlessGymTasks.map((t) => timeToMinutes(t.endTime))) : newEndMins;

  let cur = newEndMins;
  const maxBeforeSeries = series ? 1380 : 1435;

  sortedToPlace.forEach((t, idx) => {
    let dur = t.durationMinutes || 30;
    if (t.category === 'reading') {
      const space = 1380 - cur;
      if (space > 15 && space < dur) dur = space;
    }
    const origStart = timeToMinutes(t.startTime);
    const remDurFromHere = sortedToPlace.slice(idx).reduce((s, rt) => s + (rt.durationMinutes || 30), 0);
    const latestSafeStart = Math.max(cur, maxBeforeSeries - remDurFromHere);
    const boundedOrigStart = Math.min(origStart, latestSafeStart);

    let startMins = Math.min(Math.max(cur, boundedOrigStart), 1425);
    if (isEveningRoutineTask(t)) {
      const minEve = Math.min(origStart >= 1140 ? origStart : 1200, latestSafeStart);
      startMins = Math.max(startMins, Math.max(1080, minEve));
    }

    if (weekendTutoring) {
      const wTutStart = timeToMinutes(weekendTutoring.startTime);
      const wTutEnd = timeToMinutes(weekendTutoring.endTime);
      if (startMins < wTutStart) {
        if (startMins + dur > wTutStart) {
          startMins = Math.max(wTutEnd, boundedOrigStart);
        }
      } else if (startMins < wTutEnd) {
        startMins = Math.max(wTutEnd, boundedOrigStart);
      }
    }

    if (earliestGymStart < 1440 && startMins < earliestGymStart && startMins + dur > earliestGymStart) {
      if (isFreeTimeTask(t) || t.title.toLowerCase().includes('отдых')) {
        const space = earliestGymStart - startMins;
        if (space >= 15) {
          dur = space;
        } else {
          freeToDrop.add(t.id);
          return;
        }
      }
    }
    if (earliestGymStart < 1440 && origStart >= earliestGymStart) {
      startMins = Math.max(latestGymEnd, boundedOrigStart);
    }

    const endMins = Math.min(1435, startMins + dur);
    const finalDur = Math.max(15, endMins - startMins);
    remapped.set(t.id, {
      startTime: minutesToTime(startMins),
      endTime: minutesToTime(endMins),
      durationMinutes: finalDur,
    });
    cur = endMins;
    if (weekendTutoring) {
      const wTutStart = timeToMinutes(weekendTutoring.startTime);
      const wTutEnd = timeToMinutes(weekendTutoring.endTime);
      if (cur > wTutStart && cur < wTutEnd) {
        cur = wTutEnd;
      }
    }
    if (earliestGymStart < 1440 && cur >= earliestGymStart && cur < latestGymEnd) {
      cur = latestGymEnd;
    }
  });

  if (series) {
    remapped.set(series.id, {
      startTime: '23:00',
      endTime: '23:55',
      durationMinutes: 55,
    });
  }

  return {
    remapped,
    freeToDrop,
    notice:
      freeToDrop.size > 0
        ? `Лишний отдых удален, дела выстроены по эталону без накладок`
        : `Дела выстроены в эталонном порядке без накладок`,
  };
}

/**
 * Executes smart cascading and applies the selected resolution mode:
 * - 'shift_earlier': shifts overlapping tasks earlier before the new plan.
 * - 'shift_later': shifts overlapping tasks later after the new plan.
 * - 'cascade_same_day': deletes/compresses free time and cascades subsequent tasks consecutively.
 * - 'move_to_evening': cascades daytime, moves overflow tasks to evening after pairs.
 * - 'move_to_next_day': moves overflow or conflicting tasks to next day.
 */
export function applyTaskScheduleWithSmartCascading(
  allTasks: ScheduleTask[],
  movingTask: ScheduleTask,
  targetDay: DayOfWeek,
  resolutionMode: ConflictResolutionOption = 'cascade_same_day',
  config: UserScheduleConfig,
  hiddenTaskIds?: string[]
): { updatedTasks: ScheduleTask[]; noticeMessage: string | null } {
  const hiddenSet = new Set(hiddenTaskIds || []);
  const activeAllTasks = allTasks.filter(
    (t) => !t.days.includes(targetDay) || !hiddenSet.has(t.id)
  );

  // Check strict university pairs protection rule on active tasks:
  const validation = validateTaskSchedulePlacement(movingTask, targetDay, config, activeAllTasks);
  if (validation.isForbidden) {
    return {
      updatedTasks: allTasks,
      noticeMessage: '⛔ Действие запрещено (сдвиг пар в вузе)',
    };
  }

  const analysis = analyzeTaskTimePlacement(activeAllTasks, movingTask, targetDay, config);
  const nextDay = NEXT_DAY_MAP[targetDay];
  const nextDayName = RUSSIAN_DAY_ACCUSATIVE[nextDay];
  const rawPairInfo = getEffectivePair(targetDay, config);
  const hasActiveUniOnDay = Boolean(
    rawPairInfo &&
      activeAllTasks.some(
        (t) =>
          t.days.includes(targetDay) &&
          (isUniversityBlock(t) || t.category === 'study_uni' || t.id.includes('uni-classes'))
      )
  );
  const pairInfo = hasActiveUniOnDay ? rawPairInfo : null;
  const prepStartMins = pairInfo ? timeToMinutes(pairInfo.startTime) - 60 : 1440;
  const returnEndMins = pairInfo ? timeToMinutes(pairInfo.endTime) + 30 : 1440;
  const newStartMins = timeToMinutes(movingTask.startTime);
  const rawEndMins = timeToMinutes(movingTask.endTime);
  const dur = movingTask.durationMinutes || Math.max(15, rawEndMins - newStartMins) || 60;
  const newEndMins = rawEndMins <= newStartMins ? Math.min(1435, newStartMins + dur) : rawEndMins;

  // Mark newly placed or custom task
  const customMovingTask: ScheduleTask = {
    ...movingTask,
    endTime: minutesToTime(newEndMins),
    durationMinutes: dur,
    isCustom: true,
    originalStartTime: movingTask.originalStartTime || movingTask.startTime,
    originalEndTime: movingTask.originalEndTime || minutesToTime(newEndMins),
  };

  // Mode: shift_earlier
  if (resolutionMode === 'shift_earlier') {
    const realOverlapping = analysis.overlappingTasks.filter((t) => !isFreeTimeTask(t));
    const overlappingNames = realOverlapping.map((t) => `«${t.title}»`).join(', ');
    const totalDur = realOverlapping.reduce(
      (sum, t) => sum + (t.durationMinutes || Math.max(15, timeToMinutes(t.endTime) - timeToMinutes(t.startTime)) || 30),
      0
    );

    let startCursor = newStartMins - totalDur;
    const remapped = new Map<string, { startTime: string; endTime: string }>();

    realOverlapping.forEach((t) => {
      const dur = t.durationMinutes || Math.max(15, timeToMinutes(t.endTime) - timeToMinutes(t.startTime)) || 30;
      remapped.set(t.id, {
        startTime: minutesToTime(startCursor),
        endTime: minutesToTime(startCursor + dur),
      });
      startCursor += dur;
    });

    // Check if preceding non-free tasks need to move earlier because startCursor < their endTime
    const earliestRealStart = newStartMins - totalDur;
    const precedingNonFree = analysis.precedingTasks.filter((t) => !isFreeTimeTask(t));
    let backCursor = earliestRealStart;
    for (let i = precedingNonFree.length - 1; i >= 0; i--) {
      const pt = precedingNonFree[i];
      const ptEnd = timeToMinutes(pt.endTime);
      if (ptEnd > backCursor) {
        const ptDur = pt.durationMinutes || Math.max(15, ptEnd - timeToMinutes(pt.startTime)) || 30;
        const newPtStart = Math.max(0, backCursor - ptDur);
        remapped.set(pt.id, {
          startTime: minutesToTime(newPtStart),
          endTime: minutesToTime(backCursor),
        });
        backCursor = newPtStart;
      } else {
        break;
      }
    }

    // Filter out free time tasks that overlap with the new placement
    const freeToDrop = new Set(
      allTasks
        .filter((t) => t.days.includes(targetDay) && isFreeTimeTask(t))
        .filter((t) => {
          const s = timeToMinutes(t.startTime);
          const e = timeToMinutes(t.endTime);
          return s < newEndMins && e > earliestRealStart;
        })
        .map((t) => t.id)
    );

    let updatedTasks = allTasks
      .filter((t) => !t.days.includes(targetDay) || !freeToDrop.has(t.id))
      .map((t) => {
        if (t.id === movingTask.id) return customMovingTask;
        if (t.days.includes(targetDay) && remapped.has(t.id)) {
          const { startTime, endTime } = remapped.get(t.id)!;
          return {
            ...t,
            originalStartTime: t.originalStartTime || t.startTime,
            originalEndTime: t.originalEndTime || t.endTime,
            startTime,
            endTime,
          };
        }
        return t;
      });

    if (!updatedTasks.some((t) => t.id === movingTask.id)) {
      updatedTasks.push(customMovingTask);
    }

    const noticeMessage = `Планы ${overlappingNames} успешно сдвинуты на раньше (до ${movingTask.startTime})`;
    return { updatedTasks, noticeMessage };
  }

  // Mode: shift_later
  // Rule: "если идет сдвиг дел на позже исправь так чтобы порядок дел оставался как в эталоне, просто удаляй отдых если все не вмещается"
  if (resolutionMode === 'shift_later') {
    const isMovingWake = isWakeUpTask(movingTask);
    const dayAll = allTasks.filter((t) => t.days.includes(targetDay) && t.id !== movingTask.id);
    const precedingIds = new Set<string>();
    const freeRemapped = new Map<string, { startTime: string; endTime: string; durationMinutes: number }>();
    const freeToDrop = new Set<string>();

    if (!isMovingWake) {
      dayAll.forEach((t) => {
        const s = timeToMinutes(t.startTime);
        const e = timeToMinutes(t.endTime);
        if (e <= newStartMins) {
          precedingIds.add(t.id);
        } else if (s < newStartMins && e > newStartMins) {
          if (isFreeTimeTask(t)) {
            const rem = newStartMins - s;
            if (rem >= 15) {
              precedingIds.add(t.id);
              freeRemapped.set(t.id, {
                startTime: t.startTime,
                endTime: movingTask.startTime,
                durationMinutes: rem,
              });
            } else {
              freeToDrop.add(t.id);
            }
          }
        }
      });
    }

    const tasksToLayout = dayAll.filter(
      (t) => !precedingIds.has(t.id) && !freeToDrop.has(t.id) && !hiddenSet.has(t.id)
    );
    const { remapped, freeToDrop: droppedInLayout, notice } = layoutDayTasksRespectingFixedPairsAndBaseline(
      targetDay,
      tasksToLayout,
      newStartMins,
      newEndMins,
      config
    );
    droppedInLayout.forEach((id) => freeToDrop.add(id));

    let updatedTasks = allTasks
      .filter((t) => !t.days.includes(targetDay) || !freeToDrop.has(t.id))
      .map((t) => {
        if (t.id === movingTask.id) return customMovingTask;
        if (t.days.includes(targetDay)) {
          if (remapped.has(t.id)) {
            const r = remapped.get(t.id)!;
            return {
              ...t,
              originalStartTime: t.originalStartTime || t.startTime,
              originalEndTime: t.originalEndTime || t.endTime,
              startTime: r.startTime,
              endTime: r.endTime,
              durationMinutes: r.durationMinutes || t.durationMinutes,
              isCustom: true,
            };
          }
          if (freeRemapped.has(t.id)) {
            const fr = freeRemapped.get(t.id)!;
            return {
              ...t,
              startTime: fr.startTime,
              endTime: fr.endTime,
              durationMinutes: fr.durationMinutes,
            };
          }
        }
        return t;
      });

    if (!updatedTasks.some((t) => t.id === movingTask.id)) {
      updatedTasks.push(customMovingTask);
    }

    if (hasActiveUniOnDay) {
      updatedTasks = pinUniversityBlockTimes(updatedTasks, targetDay);
    }

    // Park any hidden tasks on targetDay that directly overlap with movingTask so they don't cause background collisions
    if (hiddenSet.size > 0) {
      updatedTasks = updatedTasks.map((t) => {
        if (t.days.includes(targetDay) && hiddenSet.has(t.id)) {
          const s = timeToMinutes(t.startTime);
          const e = timeToMinutes(t.endTime);
          if (s < newEndMins && e > newStartMins) {
            const vacatedStart = movingTask.originalStartTime || '09:00';
            const dur = t.durationMinutes || 60;
            const vacatedEnd = minutesToTime(timeToMinutes(vacatedStart) + dur);
            return {
              ...t,
              startTime: vacatedStart,
              endTime: vacatedEnd,
            };
          }
        }
        return t;
      });
    }

    const targetDayTasks = updatedTasks.filter((t) => t.days.includes(targetDay));
    const activeTargetDayTasks = targetDayTasks.filter((t) => !hiddenSet.has(t.id));
    if (hasScheduleOverlaps(activeTargetDayTasks)) {
      const healedDay = healDayOverlaps(activeTargetDayTasks);
      const healedMap = new Map(healedDay.map((t) => [t.id, t]));
      updatedTasks = updatedTasks.map((t) => {
        if (t.days.includes(targetDay) && healedMap.has(t.id)) {
          return healedMap.get(t.id)!;
        }
        return t;
      });
    }

    return { updatedTasks, noticeMessage: notice };
  }

  // Mode: move_to_next_day
  if (resolutionMode === 'move_to_next_day') {
    const toDisplace = analysis.overflowTasks.length > 0 ? analysis.overflowTasks : analysis.overlappingTasks;
    const displaceIds = new Set(toDisplace.map((t) => t.id));

    let cur = newEndMins;
    const remapped = new Map<string, { startTime: string; endTime: string }>();

    const remainingSubsequent = analysis.subsequentTasks.filter((t) => !displaceIds.has(t.id));
    remainingSubsequent.forEach((t) => {
      if (analysis.freeTimeRemovedMinutes > 0 && isFreeTimeTask(t)) {
        return;
      }
      const dur = t.durationMinutes || Math.max(15, timeToMinutes(t.endTime) - timeToMinutes(t.startTime)) || 30;
      const origStart = timeToMinutes(t.startTime);
      const startMins = Math.max(cur, origStart);
      remapped.set(t.id, {
        startTime: minutesToTime(startMins),
        endTime: minutesToTime(startMins + dur),
      });
      cur = startMins + dur;
    });

    let updatedTasks = allTasks.map((t) => {
      if (t.id === movingTask.id) return customMovingTask;
      if (displaceIds.has(t.id)) {
        const newDays = t.days.filter((d) => d !== targetDay);
        if (!newDays.includes(nextDay)) newDays.push(nextDay);
        return { ...t, days: newDays };
      }
      if (remapped.has(t.id)) {
        const { startTime, endTime } = remapped.get(t.id)!;
        return {
          ...t,
          originalStartTime: t.originalStartTime || t.startTime,
          originalEndTime: t.originalEndTime || t.endTime,
          startTime,
          endTime,
        };
      }
      return t;
    });

    if (!updatedTasks.some((t) => t.id === movingTask.id)) {
      updatedTasks.push(customMovingTask);
    }

    const noticeMessage = `Планы ${toDisplace.map((t) => `«${t.title}»`).join(', ')} перенесены на ${nextDayName}`;
    return { updatedTasks, noticeMessage };
  }

  // Mode: move_to_evening
  if (resolutionMode === 'move_to_evening') {
    const overflowIds = new Set(analysis.overflowTasks.map((t) => t.id));
    const remapped = new Map<string, { startTime: string; endTime: string }>();

    let curDay = newEndMins;
    const fittingDay = analysis.subsequentTasks.filter(
      (t) => !overflowIds.has(t.id) && timeToMinutes(t.startTime) < prepStartMins && !isFreeTimeTask(t)
    );

    fittingDay.forEach((t) => {
      const dur = t.durationMinutes || Math.max(15, timeToMinutes(t.endTime) - timeToMinutes(t.startTime)) || 30;
      const origStart = timeToMinutes(t.startTime);
      const startMins = Math.max(curDay, origStart);
      remapped.set(t.id, {
        startTime: minutesToTime(startMins),
        endTime: minutesToTime(startMins + dur),
      });
      curDay = startMins + dur;
    });

    let curEve = returnEndMins;
    analysis.overflowTasks.forEach((t) => {
      const dur = t.durationMinutes || Math.max(15, timeToMinutes(t.endTime) - timeToMinutes(t.startTime)) || 30;
      remapped.set(t.id, {
        startTime: minutesToTime(curEve),
        endTime: minutesToTime(curEve + dur),
      });
      curEve += dur;
    });

    const existingEvening = allTasks
      .filter((t) => t.days.includes(targetDay) && !isUniversityBlock(t) && timeToMinutes(t.startTime) >= returnEndMins && !hiddenSet.has(t.id))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    existingEvening.forEach((t) => {
      if (overflowIds.has(t.id) || isEveningSeries(t)) return;
      if (isTutoringTask(t) || isGymTask(t)) {
        // RULE: Tutoring and Gym are priority anchors and must never be shifted by overflow
        remapped.set(t.id, {
          startTime: t.startTime,
          endTime: t.endTime,
        });
        curEve = Math.max(curEve, timeToMinutes(t.endTime));
        return;
      }
      const dur = t.durationMinutes || Math.max(15, timeToMinutes(t.endTime) - timeToMinutes(t.startTime)) || 30;
      const origStart = timeToMinutes(t.startTime);
      const startMins = Math.max(curEve, origStart);
      remapped.set(t.id, {
        startTime: minutesToTime(startMins),
        endTime: minutesToTime(startMins + dur),
      });
      curEve = startMins + dur;
    });

    let updatedTasks = allTasks.map((t) => {
      if (t.id === movingTask.id) return customMovingTask;
      if (remapped.has(t.id)) {
        const { startTime, endTime } = remapped.get(t.id)!;
        return {
          ...t,
          originalStartTime: t.originalStartTime || t.startTime,
          originalEndTime: t.originalEndTime || t.endTime,
          startTime,
          endTime,
        };
      }
      return t;
    });

    if (!updatedTasks.some((t) => t.id === movingTask.id)) {
      updatedTasks.push(customMovingTask);
    }

    // Park any hidden tasks on targetDay that directly overlap with active tasks
    if (hiddenSet.size > 0) {
      const activeIntervals = updatedTasks
        .filter((t) => t.days.includes(targetDay) && !hiddenSet.has(t.id))
        .map((t) => ({ s: timeToMinutes(t.startTime), e: timeToMinutes(t.endTime) }));

      updatedTasks = updatedTasks.map((t) => {
        if (t.days.includes(targetDay) && hiddenSet.has(t.id)) {
          const s = timeToMinutes(t.startTime);
          const e = timeToMinutes(t.endTime);
          const collides = activeIntervals.some((a) => s < a.e && e > a.s);
          if (collides) {
            const vacatedStart = movingTask.originalStartTime || '09:00';
            const dur = t.durationMinutes || 60;
            return {
              ...t,
              startTime: vacatedStart,
              endTime: minutesToTime(timeToMinutes(vacatedStart) + dur),
            };
          }
        }
        return t;
      });
    }

    if (hasActiveUniOnDay) {
      updatedTasks = pinUniversityBlockTimes(updatedTasks, targetDay);
    }

    const noticeMessage = `Планы ${analysis.overflowTasks.map((t) => `«${t.title}»`).join(', ')} перенесены на вечер после пар (с ${minutesToTime(returnEndMins)})`;
    return { updatedTasks, noticeMessage };
  }

  // Default mode: cascade_same_day
  // Rule: "если идет сдвиг дел на позже исправь так чтобы порядок дел оставался как в эталоне, просто удаляй отдых если все не вмещается"
  const isMovingWake = isWakeUpTask(movingTask);

  // If there is no conflict with any active task on targetDay (e.g. moving a task into a vacant window where university pairs were deleted),
  // place the task directly without disturbing any other tasks on the day!
  if (!analysis.hasConflict && !isMovingWake) {
    let updatedTasks = allTasks.map((t) => (t.id === movingTask.id ? customMovingTask : t));
    if (!updatedTasks.some((t) => t.id === movingTask.id)) {
      updatedTasks.push(customMovingTask);
    }
    if (hiddenSet.size > 0) {
      updatedTasks = updatedTasks.map((t) => {
        if (t.days.includes(targetDay) && hiddenSet.has(t.id) && !isUniversityBlock(t)) {
          const s = timeToMinutes(t.startTime);
          const e = timeToMinutes(t.endTime);
          if (s < newEndMins && e > newStartMins) {
            const vacatedStart = movingTask.originalStartTime || '09:00';
            const hDur = t.durationMinutes || 60;
            return {
              ...t,
              startTime: vacatedStart,
              endTime: minutesToTime(timeToMinutes(vacatedStart) + hDur),
            };
          }
        }
        return t;
      });
    }
    if (hasActiveUniOnDay) {
      updatedTasks = pinUniversityBlockTimes(updatedTasks, targetDay);
    }
    return { updatedTasks, noticeMessage: null };
  }

  const dayAll = allTasks.filter(
    (t) => t.days.includes(targetDay) && t.id !== movingTask.id && !hiddenSet.has(t.id)
  );
  const remaining = isMovingWake
    ? dayAll
    : dayAll.filter(
        (t) => timeToMinutes(t.startTime) >= newStartMins || timeToMinutes(t.endTime) > newStartMins
      );

  const { remapped, freeToDrop, notice } = layoutDayTasksRespectingFixedPairsAndBaseline(
    targetDay,
    remaining,
    newStartMins,
    newEndMins,
    config
  );

  let updatedTasks = allTasks
    .filter((t) => !t.days.includes(targetDay) || !freeToDrop.has(t.id))
    .map((t) => {
      if (t.id === movingTask.id) return customMovingTask;
      if (t.days.includes(targetDay) && remapped.has(t.id)) {
        const r = remapped.get(t.id)!;
        return {
          ...t,
          originalStartTime: t.originalStartTime || t.startTime,
          originalEndTime: t.originalEndTime || t.endTime,
          startTime: r.startTime,
          endTime: r.endTime,
          durationMinutes: r.durationMinutes || t.durationMinutes,
          isCustom: true,
        };
      }
      return t;
    });

  if (!updatedTasks.some((t) => t.id === movingTask.id)) {
    updatedTasks.push(customMovingTask);
  }

  // Park any hidden tasks on targetDay that directly overlap with active tasks or movingTask so they never block or displace active plans
  if (hiddenSet.size > 0) {
    const activeIntervals = updatedTasks
      .filter((t) => t.days.includes(targetDay) && !hiddenSet.has(t.id))
      .map((t) => ({ s: timeToMinutes(t.startTime), e: timeToMinutes(t.endTime) }));

    updatedTasks = updatedTasks.map((t) => {
      if (t.days.includes(targetDay) && hiddenSet.has(t.id) && !isUniversityBlock(t)) {
        const s = timeToMinutes(t.startTime);
        const e = timeToMinutes(t.endTime);
        const collides = activeIntervals.some((a) => s < a.e && e > a.s);
        if (collides) {
          const vacatedStart = movingTask.originalStartTime || '09:00';
          const dur = t.durationMinutes || 60;
          return {
            ...t,
            startTime: vacatedStart,
            endTime: minutesToTime(timeToMinutes(vacatedStart) + dur),
          };
        }
      }
      return t;
    });
  }

  if (hasActiveUniOnDay) {
    updatedTasks = pinUniversityBlockTimes(updatedTasks, targetDay);
  }
  const targetDayTasks = updatedTasks.filter((t) => t.days.includes(targetDay));
  const activeTargetDayTasks = targetDayTasks.filter((t) => !hiddenSet.has(t.id));
  if (hasScheduleOverlaps(activeTargetDayTasks)) {
    const healedDay = healDayOverlaps(activeTargetDayTasks);
    const healedMap = new Map(healedDay.map((t) => [t.id, t]));
    updatedTasks = updatedTasks.map((t) => {
      if (t.days.includes(targetDay) && healedMap.has(t.id)) {
        return healedMap.get(t.id)!;
      }
      return t;
    });
  }

  return { updatedTasks, noticeMessage: notice };
}

/**
 * Restores the baseline schedule when a user-added plan is deleted:
 * Rule: "но если я удалю добавленные планы, то возвращай все как было"
 */
export function restoreBaselineAfterDeletion(
  allTasks: ScheduleTask[],
  deletedTaskId: string,
  targetDay: DayOfWeek,
  config: UserScheduleConfig
): ScheduleTask[] {
  const deletedTask = allTasks.find((t) => t.id === deletedTaskId);
  const isDeletedUni = Boolean(deletedTask && isUniversityBlock(deletedTask));

  // 1. Remove the task from targetDay (and if university pair was deleted, also remove associated prep & travel)
  const remaining = allTasks
    .map((t) => {
      const isTargetUni = isDeletedUni && isUniversityBlock(t) && t.days.includes(targetDay);
      if (t.id === deletedTaskId || isTargetUni) {
        return {
          ...t,
          days: t.days.filter((d) => d !== targetDay),
        };
      }
      return t;
    })
    .filter((t) => t.days.length > 0);

  // 2. Identify remaining tasks on targetDay
  const remainingDayTasks = remaining.filter((t) => t.days.includes(targetDay));
  const hasRemainingCustom = remainingDayTasks.some((t) => t.isCustom && t.id !== deletedTaskId);

  // Default tasks for day, excluding the explicitly deleted task and any uni blocks if uni was deleted
  const defaultTasksForDay = INITIAL_TASKS.filter((t) => {
    if (!t.days.includes(targetDay)) return false;
    if (t.id === deletedTaskId) return false;
    if (isDeletedUni && isUniversityBlock(t)) return false;
    return true;
  });

  // If no custom tasks remain on this day, restore default schedule from INITIAL_TASKS!
  if (!hasRemainingCustom) {
    const restoredDayTasks = defaultTasksForDay.map((init) => {
      const existing = remainingDayTasks.find((r) => r.id === init.id);
      return {
        ...init,
        completedDays: existing?.completedDays || init.completedDays || {},
      };
    });

    const others = remaining.filter((t) => !t.days.includes(targetDay));
    return [...others, ...restoredDayTasks];
  }

  // If some custom tasks still remain, restore default tasks whose original slot is now vacant
  const customRanges = remainingDayTasks
    .filter((t) => t.isCustom)
    .map((t) => ({ start: timeToMinutes(t.startTime), end: timeToMinutes(t.endTime) }));

  const defaultMap = new Map(defaultTasksForDay.map((t) => [t.id, t]));

  const restored = remaining.map((t) => {
    if (!t.days.includes(targetDay) || t.isCustom) return t;
    const init = defaultMap.get(t.id);
    if (!init) return t;

    const origStart = timeToMinutes(init.startTime);
    const origEnd = timeToMinutes(init.endTime);
    const isOccupied = customRanges.some((c) => origStart < c.end && origEnd > c.start);
    if (!isOccupied) {
      return {
        ...t,
        startTime: init.startTime,
        endTime: init.endTime,
        durationMinutes: init.durationMinutes,
      };
    }
    return t;
  });

  // Re-insert any missing baseline tasks for targetDay whose slot is now vacant
  const currentTaskIds = new Set(restored.filter((t) => t.days.includes(targetDay)).map((t) => t.id));
  defaultTasksForDay.forEach((init) => {
    if (!currentTaskIds.has(init.id)) {
      const origStart = timeToMinutes(init.startTime);
      const origEnd = timeToMinutes(init.endTime);
      const isOccupied = customRanges.some((c) => origStart < c.end && origEnd > c.start);
      if (!isOccupied) {
        restored.push({
          ...init,
          completedDays: {},
        });
        currentTaskIds.add(init.id);
      }
    }
  });

  return sortDayTasksWithWakeUpFirst(restored);
}

/**
 * Resolves the effective schedule tasks for a specific week:
 * - On current week (isCurrentWeek === true):
 *   Includes permanent tasks + temporary tasks added for this week.
 * - On next week or other weeks (isCurrentWeek === false):
 *   Restores canonical baseline for any tasks that were only replaced/deleted for a single week!
 *   Includes only permanent baseline tasks + pinned permanent custom tasks (isPinnedPermanent === true).
 *   Temporary plans (weekScope === 'this_week') are completely omitted, so everything is as before.
 */
export function getEffectiveTasksForWeek(
  allTasks: ScheduleTask[],
  weekId: string,
  isCurrentWeek: boolean,
  targetDay?: DayOfWeek,
  config?: UserScheduleConfig,
  singleDayDeletedUniKeys?: string[] | Set<string>,
  deletedWeekTaskKeys?: string[] | Set<string>
): ScheduleTask[] {
  const disabledInSettings = new Set(config?.disabledUniversityDays || []);
  const singleDayDisabled = new Set(
    Array.isArray(singleDayDeletedUniKeys)
      ? singleDayDeletedUniKeys
      : Array.from(singleDayDeletedUniKeys || [])
  );
  const deletedTaskKeysSet = new Set(
    Array.isArray(deletedWeekTaskKeys)
      ? deletedWeekTaskKeys
      : Array.from(deletedWeekTaskKeys || [])
  );

  const isUniDayDisabled = (d: DayOfWeek): boolean => {
    return disabledInSettings.has(d) || singleDayDisabled.has(`${weekId}_${d}`);
  };

  const isTaskDeletedOnWeek = (taskId: string, day: DayOfWeek): boolean => {
    return (
      deletedTaskKeysSet.has(`${weekId}_${day}_${taskId}`) ||
      deletedTaskKeysSet.has(`${weekId}_${taskId}`)
    );
  };

  if (isCurrentWeek) {
    // Current week: filter out temporary tasks that were explicitly created for a DIFFERENT week
    let currentWeekTasks = allTasks.filter((t) => {
      if (t.weekScope === 'this_week' && t.targetWeekId && t.targetWeekId !== weekId) {
        return false;
      }
      return true;
    });

    // If disabled in settings (all weeks) or deleted for this specific day on this week:
    currentWeekTasks = currentWeekTasks
      .map((t) => {
        if (!isUniversityBlock(t)) return t;
        const filteredDays = t.days.filter((d) => !isUniDayDisabled(d));
        return { ...t, days: filteredDays };
      })
      .filter((t) => t.days.length > 0);

    // Filter out any plans deleted for this week/day
    if (deletedTaskKeysSet.size > 0) {
      currentWeekTasks = currentWeekTasks
        .map((t) => {
          const filteredDays = t.days.filter((d) => !isTaskDeletedOnWeek(t.id, d));
          return { ...t, days: filteredDays };
        })
        .filter((t) => t.days.length > 0);
    }

    return targetDay ? currentWeekTasks.filter((t) => t.days.includes(targetDay)) : currentWeekTasks;
  }

  // Past or Future (e.g. past week archive or next week) weeks:
  // Rule: "если я добавлю какие то новые планы то они только на эту неделю, на следующей все должно быть как прежде"
  // Keep permanent custom tasks (isPinnedPermanent === true or weekScope === 'permanent')
  // OR custom tasks created specifically for this week (targetWeekId === weekId)
  const weekCustomTasks = allTasks.filter(
    (t) => t.isCustom && (t.targetWeekId === weekId || t.isPinnedPermanent || t.weekScope === 'permanent')
  );

  // Map existing tasks by id so we preserve completedDays (and any user completion marks for past/future dates)
  const existingTaskMap = new Map<string, ScheduleTask>();
  allTasks.forEach((t) => {
    existingTaskMap.set(t.id, t);
  });

  const daysToCheck: DayOfWeek[] = targetDay ? [targetDay] : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  let result: ScheduleTask[] = [];

  daysToCheck.forEach((d) => {
    const customForDay = weekCustomTasks
      .filter((p) => p.days.includes(d))
      .filter((t) => !isTaskDeletedOnWeek(t.id, d));
    const customById = new Map(customForDay.map((c) => [c.id, c]));

    let dayTasks = INITIAL_TASKS.filter((init) => init.days.includes(d)).map((init) => {
      const customMatch = customById.get(init.id);
      const existing = existingTaskMap.get(init.id);
      if (customMatch) {
        return {
          ...customMatch,
          completedDays: existing?.completedDays || customMatch.completedDays || init.completedDays || {},
        };
      }
      if (existing) {
        return {
          ...init,
          completedDays: existing.completedDays || init.completedDays || {},
        };
      }
      return init;
    });

    // If disabled in settings (all weeks) or deleted on this specific week:
    if (isUniDayDisabled(d)) {
      dayTasks = dayTasks.filter((t) => !isUniversityBlock(t));
    }

    // Filter out tasks deleted on this week for day d
    dayTasks = dayTasks.filter((t) => !isTaskDeletedOnWeek(t.id, d));

    const existingDayIds = new Set(dayTasks.map((t) => t.id));
    const newCustomForDay = customForDay.filter((c) => !existingDayIds.has(c.id));

    if (newCustomForDay.length === 0) {
      result = [...result, ...dayTasks];
    } else {
      // Merge newly added custom tasks with baseline tasks
      const combined = [...dayTasks, ...newCustomForDay];
      const healed = healDayOverlaps(combined);
      result = [...result, ...healed];
    }
  });

  if (targetDay) {
    return result;
  }

  // Deduplicate multi-day tasks while preserving their combined days and completedDays
  const dedupedMap = new Map<string, ScheduleTask>();
  result.forEach((t) => {
    const prev = dedupedMap.get(t.id);
    if (!prev) {
      const existing = existingTaskMap.get(t.id);
      dedupedMap.set(t.id, {
        ...t,
        completedDays: existing?.completedDays || t.completedDays || {},
      });
    }
  });

  return Array.from(dedupedMap.values());
}

/**
 * Returns any baseline tasks from INITIAL_TASKS that are currently missing from the day.
 * Used to inform user and provide a quick one-click restore button.
 */
export function getMissingBaselineTasksForDay(
  currentDayTasks: ScheduleTask[],
  day: DayOfWeek
): ScheduleTask[] {
  const initForDay = INITIAL_TASKS.filter((i) => i.days.includes(day));
  const currentIds = new Set(currentDayTasks.map((t) => t.id));
  const currentTitles = new Set(currentDayTasks.map((t) => t.title.toLowerCase().trim()));

  return initForDay.filter((init) => {
    if (currentIds.has(init.id)) return false;
    const initTitle = init.title.toLowerCase().trim();
    if (currentTitles.has(initTitle)) return false;
    return true;
  });
}

export interface ConflictDisplacedInfo {
  taskId: string;
  taskTitle: string;
  targetDay: DayOfWeek;
  newTime: string;
  mode: 'same_day' | 'next_day';
  description: string;
}

/**
 * Backward compatibility wrapper using applyTaskScheduleWithSmartCascading.
 */
export function resolveTaskScheduleConflicts(
  allTasks: ScheduleTask[],
  newTask: ScheduleTask,
  targetDay: DayOfWeek,
  resolutionMode: 'same_day' | 'next_day' = 'same_day',
  config?: UserScheduleConfig
): { updatedTasks: ScheduleTask[]; displaced: ConflictDisplacedInfo[] } {
  const activeConfig = config || ({ wakeUpTimeWeekday: '09:00', wakeUpTimeThursday: '08:30', wakeUpTimeWeekend: '10:00' } as UserScheduleConfig);
  const mode: ConflictResolutionOption = resolutionMode === 'next_day' ? 'move_to_next_day' : 'cascade_same_day';
  const res = applyTaskScheduleWithSmartCascading(allTasks, newTask, targetDay, mode, activeConfig);

  const displaced: ConflictDisplacedInfo[] = res.noticeMessage
    ? [
        {
          taskId: newTask.id,
          taskTitle: newTask.title,
          targetDay,
          newTime: newTask.startTime,
          mode: resolutionMode,
          description: res.noticeMessage,
        },
      ]
    : [];

  return { updatedTasks: res.updatedTasks, displaced };
}
