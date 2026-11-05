import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  DayOfWeek,
  ScheduleTask,
  TaskCategory,
  HabitStreak,
  UserScheduleConfig,
} from './types/schedule';
import {
  INITIAL_TASKS,
  INITIAL_HABITS,
  DAYS_INFO,
  CATEGORY_INFO,
  DEFAULT_CONFIG,
} from './data/defaultSchedule';
import { sounds } from './utils/audio';
import { showSystemNotification } from './utils/notifications';
import { IPhoneFrame } from './components/IPhoneFrame';
import { DynamicIsland } from './components/DynamicIsland';
import { DaySelector } from './components/DaySelector';
import { TaskCard } from './components/TaskCard';
import { ActivityRings } from './components/ActivityRings';
import { ProgressView } from './components/ProgressView';
import { WeekTimelineView } from './components/WeekTimelineView';
import { EditTaskModal } from './components/EditTaskModal';
import { ScheduleCustomizerModal } from './components/ScheduleCustomizerModal';
import { InAppNotificationBanner } from './components/InAppNotificationBanner';
import { NotificationCenterModal } from './components/NotificationCenterModal';
import { useNotificationScheduler } from './hooks/useNotificationScheduler';
import { getWeekInfo, WeekInfo } from './utils/dateUtils';
import {
  recalculateSchedule,
  swapTwoTasks,
  moveTaskUpDown,
  cascadeShiftTasks,
  reorderDayTasks,
  sanitizeAndEnforceFixedSchedule,
  applyTaskScheduleWithSmartCascading,
  restoreBaselineAfterDeletion,
  sortDayTasksWithWakeUpFirst,
  validateTaskSchedulePlacement,
  ConflictResolutionOption,
  timeToMinutes,
  minutesToTime,
  isWakeUpTask,
  isUniversityBlock,
  isTutoringTask,
  pinUniversityBlockTimes,
  healDayOverlaps,
  getEffectiveTasksForWeek,
} from './utils/scheduleEngine';
import {
  verifyAndBurnStreaks,
  syncHabitsWithTaskToggle,
  getTodayInfo,
  isTaskMatchingHabit,
} from './utils/habitStreakEngine';

import {
  Calendar,
  CheckCircle2,
  Plus,
  SlidersHorizontal,
  Flame,
  Bell,
  LayoutGrid,
  Sparkles,
  Search,
  RotateCcw,
  GripVertical,
  Clock,
  HelpCircle,
  X,
  Moon,
  Sun,
  BatteryCharging,
  HeartPulse,
  Zap,
  ChevronDown,
  ChevronUp,
  Snowflake,
  GraduationCap,
} from 'lucide-react';
import { useTheme } from './utils/useTheme';
import {
  EnergyLevel,
  isEssentialTaskForMode,
  isSecondaryTask,
  adaptTaskForEnergyMode,
  STORAGE_KEY_ENERGY,
} from './utils/energyMode';
import { EnergyModeModal } from './components/EnergyModeModal';

const STORAGE_KEY_TASKS = 'auraday_tasks_v10';
const STORAGE_KEY_HABITS = 'auraday_habits_v2';
const STORAGE_KEY_CONFIG = 'auraday_config_v1';
const STORAGE_KEY_SINGLE_DAY_UNI = 'auraday_single_day_uni_v1';
const STORAGE_KEY_DELETED_WEEK_TASKS = 'auraday_deleted_week_tasks_v1';

const getInitialTodayKey = (): DayOfWeek => {
  const d = new Date().getDay();
  const map: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return map[d] || 'mon';
};


export default function App() {
  // Load tasks from localStorage or default
  const [tasks, setTasks] = useState<ScheduleTask[]>(() => {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEY_TASKS) ||
        localStorage.getItem('auraday_tasks_v9') ||
        localStorage.getItem('auraday_tasks_v8') ||
        localStorage.getItem('auraday_tasks_v7');
      if (saved) {
        let parsed: ScheduleTask[] = JSON.parse(saved);
        let savedCfg: UserScheduleConfig = DEFAULT_CONFIG;
        try {
          const rawCfg = localStorage.getItem(STORAGE_KEY_CONFIG);
          if (rawCfg) savedCfg = { ...DEFAULT_CONFIG, ...JSON.parse(rawCfg) };
        } catch {
          // ignore
        }
        let savedSingleDayUni: string[] = [];
        try {
          const rawSingleUni = localStorage.getItem(STORAGE_KEY_SINGLE_DAY_UNI);
          if (rawSingleUni) savedSingleDayUni = JSON.parse(rawSingleUni);
        } catch {
          // ignore
        }
        // Normalize any wake-up tasks that got forcibly shifted to 10:00 by earlier logic
        parsed = parsed.map((t) => {
          if (
            (t.id === 'mon-wake-breakfast' ||
              t.id === 'tue-wake-breakfast' ||
              t.id === 'wed-wake-breakfast' ||
              t.id === 'fri-wake-breakfast') &&
            t.startTime === '10:00' &&
            t.title.includes('+1 час сна')
          ) {
            return {
              ...t,
              startTime: '09:00',
              endTime: '10:00',
              title: 'Мягкий подъем, утренний чай & завтрак',
              subtitle: 'Любимый долгий сон без спешки, чай и вкусный завтрак',
            };
          }
          return t;
        });
        const sanitized = sanitizeAndEnforceFixedSchedule(parsed, savedCfg, savedSingleDayUni);
        try {
          localStorage.removeItem('auraday_tasks_v7');
          localStorage.removeItem('auraday_tasks_v8');
          localStorage.removeItem('auraday_tasks_v9');
          localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(sanitized));
        } catch {
          // ignore
        }
        return sanitized;
      }
    } catch {
      // ignore
    }
    return INITIAL_TASKS;
  });

  // Load habits from localStorage, evaluating streaks and burning out expired non-frozen ones
  const [habits, setHabits] = useState<HabitStreak[]>(() => {
    try {
      const v2 = localStorage.getItem('auraday_habits_v2');
      if (v2) {
        const parsed: HabitStreak[] = JSON.parse(v2);
        // Verify streak burnout on load:
        const { updatedHabits } = verifyAndBurnStreaks(parsed, INITIAL_TASKS);
        return updatedHabits;
      }
      const v1 = localStorage.getItem('auraday_habits_v1');
      if (v1) {
        const parsed: HabitStreak[] = JSON.parse(v1);
        const resetHabits = parsed.map((h) => ({
          ...h,
          streakDays: 0,
          lastCompletedDate: undefined,
        }));
        localStorage.setItem('auraday_habits_v2', JSON.stringify(resetHabits));
        localStorage.removeItem('auraday_habits_v1');
        return resetHabits;
      }
    } catch {
      // ignore
    }
    return INITIAL_HABITS.map((h) => ({ ...h, streakDays: 0, lastCompletedDate: undefined }));
  });

  // Config
  const [config, setConfig] = useState<UserScheduleConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_CONFIG;
  });

  // Theme mode with automatic day/night detection and persistence
  const { themeMode, effectiveTheme, cycleThemeMode, timeDescription } = useTheme();

  // Selected Day, Week Offset & Navigation
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(getInitialTodayKey);
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const weekInfo = useMemo(() => getWeekInfo(weekOffset), [weekOffset]);
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'progress'>('today');
  const [filterCategory, setFilterCategory] = useState<TaskCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

  // Modals & Banners
  const [editingTask, setEditingTask] = useState<ScheduleTask | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [showAbsTipBanner, setShowAbsTipBanner] = useState(true);

  // Energy Mode State per day (Full 100%, Low / Light mode, Sick / Recovery)
  const [dayEnergyModes, setDayEnergyModes] = useState<Record<string, { level: EnergyLevel; restoredTaskIds?: string[]; hiddenTaskIds?: string[] }>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ENERGY);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error(e);
      return {};
    }
  });
  const [isEnergyModalOpen, setIsEnergyModalOpen] = useState(false);
  const [dismissedSuggestionDays, setDismissedSuggestionDays] = useState<Record<string, boolean>>({});
  const [showHiddenTasksSection, setShowHiddenTasksSection] = useState(false);

  // Single-day deleted university pairs tracked per week-day (e.g. "2026-W44_mon")
  // Rule: "если я удаляю в один конкретный день то в настройках пары не удаляются, если через настройки то они удаляются на все недели"
  const [singleDayDeletedUniKeys, setSingleDayDeletedUniKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SINGLE_DAY_UNI);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SINGLE_DAY_UNI, JSON.stringify(singleDayDeletedUniKeys));
    } catch (e) {
      console.error(e);
    }
  }, [singleDayDeletedUniKeys]);

  // Tasks deleted for a specific week and day (e.g. "2026-W45_tue_reading-eve")
  // Rule: "разрежи удалять планы на следующей неделе свайпом"
  const [deletedWeekTaskKeys, setDeletedWeekTaskKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DELETED_WEEK_TASKS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_DELETED_WEEK_TASKS, JSON.stringify(deletedWeekTaskKeys));
    } catch (e) {
      console.error(e);
    }
  }, [deletedWeekTaskKeys]);

  // Sync state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
    } catch (e) {
      console.error(e);
    }
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HABITS, JSON.stringify(habits));
    } catch (e) {
      console.error(e);
    }
  }, [habits]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
    } catch (e) {
      console.error(e);
    }
  }, [config]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ENERGY, JSON.stringify(dayEnergyModes));
    } catch (e) {
      console.error(e);
    }
  }, [dayEnergyModes]);

  // Return university pairs to template automatically unless explicitly deleted in settings:
  // Rule: "возвращай их в шаблон пока я не удалю их в настройках вообще"
  useEffect(() => {
    const uniDays: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu'];
    const disabledDays = new Set(config.disabledUniversityDays || []);

    setTasks((prev) => {
      let missingAny = false;
      for (const d of uniDays) {
        if (!disabledDays.has(d)) {
          const hasUni = prev.some(
            (t) => t.days.includes(d) && (t.category === 'study_uni' || t.id.includes('uni-classes'))
          );
          if (!hasUni) {
            missingAny = true;
            break;
          }
        }
      }
      if (!missingAny) return prev;
      return sanitizeAndEnforceFixedSchedule(prev, config, singleDayDeletedUniKeys);
    });
  }, [config.disabledUniversityDays, singleDayDeletedUniKeys]);

  // Check if a task is completed on a day for the active week
  const isTaskCompletedForDay = (task: ScheduleTask, day: DayOfWeek): boolean => {
    const dateKey = weekInfo.dayDates[day]?.dateKey;
    const weekDayKey = `${weekInfo.weekId}_${day}`;
    if (dateKey && task.completedDays[dateKey] !== undefined) {
      return !!task.completedDays[dateKey];
    }
    if (task.completedDays[weekDayKey] !== undefined) {
      return !!task.completedDays[weekDayKey];
    }
    if (weekInfo.isCurrentWeek) {
      return !!task.completedDays[day];
    }
    return false;
  };

  // Current day energy state & level
  const currentEnergyState = dayEnergyModes[selectedDay] || { level: 'full', restoredTaskIds: [], hiddenTaskIds: [] };
  const currentEnergyLevel: EnergyLevel = currentEnergyState.level || 'full';
  const restoredTaskIds: string[] = currentEnergyState.restoredTaskIds || [];
  const manuallyHiddenTaskIds: string[] = currentEnergyState.hiddenTaskIds || [];

  // Effective tasks for active week:
  // Current week = baseline + temporary week tasks + pinned custom tasks
  // Next week / other weeks = baseline (with English/Reading intact!) + pinned custom tasks
  const effectiveWeekTasks = useMemo(() => {
    return getEffectiveTasksForWeek(
      tasks,
      weekInfo.weekId,
      weekInfo.isCurrentWeek,
      undefined,
      config,
      singleDayDeletedUniKeys,
      deletedWeekTaskKeys
    );
  }, [tasks, weekInfo, config, singleDayDeletedUniKeys, deletedWeekTaskKeys]);

  // Automated notification scheduler (task reminders, 21:00 streak warning)
  useNotificationScheduler({
    tasks: effectiveWeekTasks,
    habits,
    config,
    selectedDay,
    isTaskCompletedForDay,
  });

  // All tasks scheduled for selected day on active week
  const baseDayTasks = useMemo(() => {
    return getEffectiveTasksForWeek(
      tasks,
      weekInfo.weekId,
      weekInfo.isCurrentWeek,
      selectedDay,
      config,
      singleDayDeletedUniKeys,
      deletedWeekTaskKeys
    );
  }, [tasks, selectedDay, weekInfo, config, singleDayDeletedUniKeys, deletedWeekTaskKeys]);

  // Tasks partitioned according to Energy Mode (Full vs Low vs Sick)
  const { activeModeDayTasks, hiddenDayTasks } = useMemo(() => {
    if (currentEnergyLevel === 'full' && manuallyHiddenTaskIds.length === 0) {
      return { activeModeDayTasks: baseDayTasks, hiddenDayTasks: [] };
    }

    const active: ScheduleTask[] = [];
    const hidden: ScheduleTask[] = [];

    baseDayTasks.forEach((task) => {
      if (isEssentialTaskForMode(task, currentEnergyLevel, restoredTaskIds, manuallyHiddenTaskIds)) {
        active.push(adaptTaskForEnergyMode(task, currentEnergyLevel));
      } else {
        hidden.push(task);
      }
    });

    return { activeModeDayTasks: active, hiddenDayTasks: hidden };
  }, [baseDayTasks, currentEnergyLevel, restoredTaskIds, manuallyHiddenTaskIds]);

  // Tasks for currently selected day (wake-up is ALWAYS first)
  const currentDayTasks = useMemo(() => {
    const list = activeModeDayTasks
      .filter((t) => (filterCategory === 'all' ? true : t.category === filterCategory))
      .filter((t) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          (t.subtitle && t.subtitle.toLowerCase().includes(q)) ||
          CATEGORY_INFO[t.category]?.name.toLowerCase().includes(q)
        );
      });
    return sortDayTasksWithWakeUpFirst(list);
  }, [activeModeDayTasks, filterCategory, searchQuery]);

  // Day statistics for the selected week adapted to each day's energy mode
  const dayStats = useMemo(() => {
    const days: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const res: Record<DayOfWeek, { total: number; completed: number }> = {
      mon: { total: 0, completed: 0 },
      tue: { total: 0, completed: 0 },
      wed: { total: 0, completed: 0 },
      thu: { total: 0, completed: 0 },
      fri: { total: 0, completed: 0 },
      sat: { total: 0, completed: 0 },
      sun: { total: 0, completed: 0 },
    };

    days.forEach((d) => {
      const mode = dayEnergyModes[d]?.level || 'full';
      const rIds = dayEnergyModes[d]?.restoredTaskIds || [];
      const hIds = dayEnergyModes[d]?.hiddenTaskIds || [];
      const dAll = effectiveWeekTasks.filter((t) => t.days.includes(d));
      const dActive =
        mode === 'full' && hIds.length === 0
          ? dAll
          : dAll.filter((t) => isEssentialTaskForMode(t, mode, rIds, hIds));
      res[d].total = dActive.length;
      res[d].completed = dActive.filter((t) => isTaskCompletedForDay(t, d)).length;
    });

    return res;
  }, [effectiveWeekTasks, weekInfo, dayEnergyModes]);

  // Completed map for current day of selected week
  const completedMapForDay = useMemo(() => {
    const map: Record<string, boolean> = {};
    effectiveWeekTasks.forEach((t) => {
      map[t.id] = isTaskCompletedForDay(t, selectedDay);
    });
    tasks.forEach((t) => {
      if (map[t.id] === undefined) {
        map[t.id] = isTaskCompletedForDay(t, selectedDay);
      }
    });
    return map;
  }, [effectiveWeekTasks, tasks, selectedDay, weekInfo]);

  const totalCurrentDay = activeModeDayTasks.length;
  const completedCurrentDay = activeModeDayTasks.filter((t) => isTaskCompletedForDay(t, selectedDay)).length;

  // Toggle task complete status for selected week (including past weeks)
  const handleToggleTask = (taskId: string) => {
    const targetTask =
      effectiveWeekTasks.find((t) => t.id === taskId) ||
      baseDayTasks.find((t) => t.id === taskId) ||
      tasks.find((t) => t.id === taskId);
    if (!targetTask) return;

    const current = isTaskCompletedForDay(targetTask, selectedDay);
    const nextVal = !current;

    const dateKey = weekInfo.dayDates[selectedDay]?.dateKey;
    const weekDayKey = `${weekInfo.weekId}_${selectedDay}`;

    // Sync corresponding habit streak if marking for today
    if (weekInfo.isCurrentWeek) {
      const today = getTodayInfo();
      const { updatedHabits, affectedHabit } = syncHabitsWithTaskToggle(
        targetTask,
        selectedDay,
        nextVal,
        habits,
        today.dateStr,
        today.dayKey
      );

      if (affectedHabit) {
        setHabits(updatedHabits);
        if (nextVal) {
          setScheduleNotice(
            `Дело выполнено! Стрик «${affectedHabit.title}» отмечен за сегодня 🔥 (${affectedHabit.streakDays} дн.)`
          );
          setTimeout(() => setScheduleNotice(null), 4000);
        } else {
          setScheduleNotice(`Отметка стрика «${affectedHabit.title}» за сегодня снята.`);
          setTimeout(() => setScheduleNotice(null), 4000);
        }
      }
    }

    setTasks((prev) => {
      const existsInPrev = prev.some((t) => t.id === taskId);
      const baseList = existsInPrev ? prev : [...prev, targetTask];

      return baseList.map((t) => {
        if (t.id !== taskId) return t;
        const updatedCompleted = {
          ...t.completedDays,
          ...(dateKey ? { [dateKey]: nextVal } : {}),
          [weekDayKey]: nextVal,
        };
        if (weekInfo.isCurrentWeek) {
          updatedCompleted[selectedDay] = nextVal;
        }

        const updated = {
          ...t,
          completedDays: updatedCompleted,
        };

        // Check if all tasks in day now completed -> celebrate!
        if (nextVal) {
          setTimeout(() => {
            const allDoneAfter = activeModeDayTasks.every((item) =>
              item.id === taskId ? true : isTaskCompletedForDay(item, selectedDay)
            );
            if (allDoneAfter && activeModeDayTasks.length > 0) {
              confetti({
                particleCount: 90,
                spread: 75,
                origin: { y: 0.65 },
                colors: ['#38bdf8', '#34d399', '#fde047', '#c084fc'],
              });
              sounds.playCelebration(config.soundEnabled);
              if (weekInfo.isCurrentWeek) {
                showSystemNotification('Умничка! 🎉', 'Все дела на сегодня выполнены на 100%!');
              }
            }
          }, 100);
        }

        return updated;
      });
    });
  };

  // Mark all completed for selected day in selected week
  const handleCompleteAll = () => {
    const dateKey = weekInfo.dayDates[selectedDay]?.dateKey;
    const weekDayKey = `${weekInfo.weekId}_${selectedDay}`;
    const targetTaskIds = new Set(activeModeDayTasks.map((t) => t.id));

    setTasks((prev) => {
      const prevIds = new Set(prev.map((t) => t.id));
      const missingTasks = activeModeDayTasks.filter((t) => !prevIds.has(t.id));
      const baseList = missingTasks.length > 0 ? [...prev, ...missingTasks] : prev;

      return baseList.map((t) => {
        if (!targetTaskIds.has(t.id)) return t;
        const updatedCompleted = {
          ...t.completedDays,
          ...(dateKey ? { [dateKey]: true } : {}),
          [weekDayKey]: true,
        };
        if (weekInfo.isCurrentWeek) {
          updatedCompleted[selectedDay] = true;
        }
        return {
          ...t,
          completedDays: updatedCompleted,
        };
      });
    });

    // Sync matching habits for today
    const today = getTodayInfo();
    if (weekInfo.isCurrentWeek && selectedDay === today.dayKey) {
      let currentHabits = habits;
      activeModeDayTasks.forEach((task) => {
        const { updatedHabits } = syncHabitsWithTaskToggle(
          task,
          selectedDay,
          true,
          currentHabits,
          today.dateStr,
          today.dayKey
        );
        currentHabits = updatedHabits;
      });
      setHabits(currentHabits);
    }

    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    sounds.playCelebration(config.soundEnabled);
  };

  // Reset completion for selected day in selected week
  const handleResetDay = () => {
    const dateKey = weekInfo.dayDates[selectedDay]?.dateKey;
    const weekDayKey = `${weekInfo.weekId}_${selectedDay}`;
    const targetTaskIds = new Set(activeModeDayTasks.map((t) => t.id));

    setTasks((prev) =>
      prev.map((t) => {
        if (!targetTaskIds.has(t.id)) return t;
        const newCompleted = { ...t.completedDays };
        if (dateKey) delete newCompleted[dateKey];
        delete newCompleted[weekDayKey];
        if (weekInfo.isCurrentWeek) {
          delete newCompleted[selectedDay];
        }
        return {
          ...t,
          completedDays: newCompleted,
        };
      })
    );
    sounds.playUncheck(config.soundEnabled);
  };

  // Switch Energy Mode (Full 100% / Light mode / Sick recovery)
  const handleSelectEnergyLevel = (level: EnergyLevel, applyToAllDays = false) => {
    if (applyToAllDays) {
      const allDays: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
      const nextModes: Record<string, { level: EnergyLevel; restoredTaskIds?: string[]; hiddenTaskIds?: string[] }> = {};
      allDays.forEach((d) => {
        nextModes[d] = {
          level,
          restoredTaskIds: level === 'full' ? [] : (dayEnergyModes[d]?.restoredTaskIds || []),
          hiddenTaskIds: level === 'full' ? [] : (dayEnergyModes[d]?.hiddenTaskIds || []),
        };
      });
      setDayEnergyModes(nextModes);
      setScheduleNotice(
        level === 'low'
          ? '🔋 «Легкий режим» включен на всю неделю! Скрыты второстепенные задачи, привычки сокращены до 10–15 мин.'
          : level === 'sick'
          ? '🤒 Режим «Восстановление» включен на всю неделю. Покой и выздоровление!'
          : '⚡ Обычный ритм (100% энергии) включен на всю неделю!'
      );
    } else {
      setDayEnergyModes((prev) => ({
        ...prev,
        [selectedDay]: {
          level,
          restoredTaskIds: level === 'full' ? [] : (prev[selectedDay]?.restoredTaskIds || []),
          hiddenTaskIds: level === 'full' ? [] : (prev[selectedDay]?.hiddenTaskIds || []),
        },
      }));
      setScheduleNotice(
        level === 'low'
          ? `🔋 На ${DAYS_INFO[selectedDay].name.toLowerCase()} включен «Легкий режим» (базовый минимум 10–15 мин)!`
          : level === 'sick'
          ? `🤒 На ${DAYS_INFO[selectedDay].name.toLowerCase()} включен режим «Восстановление». Полный покой!`
          : `⚡ На ${DAYS_INFO[selectedDay].name.toLowerCase()} возвращен обычный ритм (100% энергии).`
      );
    }
    setTimeout(() => setScheduleNotice(null), 6000);
    sounds.playCheck(config.soundEnabled);
  };

  // Restore a single hidden task into the day's active plan
  const handleRestoreHiddenTask = (taskId: string) => {
    setDayEnergyModes((prev) => {
      const cur = prev[selectedDay] || { level: 'low', restoredTaskIds: [], hiddenTaskIds: [] };
      const updatedRestored = Array.from(new Set([...(cur.restoredTaskIds || []), taskId]));
      const updatedHidden = (cur.hiddenTaskIds || []).filter((id) => id !== taskId);
      return {
        ...prev,
        [selectedDay]: {
          ...cur,
          restoredTaskIds: updatedRestored,
          hiddenTaskIds: updatedHidden,
        },
      };
    });

    // If restoring a morning task (starts before 12:00, e.g. English at 10:00),
    // ensure wake-up is cleanly placed before it without any overlap or collision!
    setTasks((prev) => {
      const restoredTask = prev.find((t) => t.id === taskId);
      if (!restoredTask) return prev;
      const restStartM = timeToMinutes(restoredTask.startTime);
      const dayWake = prev.find((t) => t.days.includes(selectedDay) && isWakeUpTask(t));
      if (dayWake && timeToMinutes(dayWake.endTime) > restStartM && timeToMinutes(dayWake.startTime) >= restStartM) {
        const baselineStart = selectedDay === 'thu' ? '08:30' : '09:00';
        const dur = dayWake.durationMinutes || 60;
        const newEnd = minutesToTime(timeToMinutes(baselineStart) + dur);
        return prev.map((t) => {
          if (t.id === dayWake.id) {
            return {
              ...t,
              startTime: baselineStart,
              endTime: newEnd,
              isCustom: true,
            };
          }
          return t;
        });
      }
      return prev;
    });

    setScheduleNotice('Дело возвращено в текущий план дня! 📋');
    setTimeout(() => setScheduleNotice(null), 4000);
    sounds.playCheck(config.soundEnabled);
  };

  // Return / move an active task back into secondary tasks (hidden)
  const handleMoveToSecondary = (taskId: string) => {
    const taskObj = tasks.find((t) => t.id === taskId);
    setDayEnergyModes((prev) => {
      const cur = prev[selectedDay] || { level: currentEnergyLevel, restoredTaskIds: [], hiddenTaskIds: [] };
      const updatedRestored = (cur.restoredTaskIds || []).filter((id) => id !== taskId);
      const updatedHidden = Array.from(new Set([...(cur.hiddenTaskIds || []), taskId]));
      const nextLevel = cur.level === 'full' ? 'low' : cur.level;
      return {
        ...prev,
        [selectedDay]: {
          ...cur,
          level: nextLevel,
          restoredTaskIds: updatedRestored,
          hiddenTaskIds: updatedHidden,
        },
      };
    });

    setShowHiddenTasksSection(true);
    const title = taskObj?.title ? `«${taskObj.title}»` : 'Дело';
    setScheduleNotice(`${title} возвращено во второстепенные дела 💤`);
    setTimeout(() => setScheduleNotice(null), 4000);
    sounds.playCheck(config.soundEnabled);
  };

  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null);

  // Streak Burnout Verification:
  // "сделай что если стрик или дело по нему не отмечался, то этот стрик сгорает(обнуляется), только если он не был заморожен"
  useEffect(() => {
    const runBurnCheck = () => {
      setHabits((prev) => {
        const { updatedHabits, burnedHabits } = verifyAndBurnStreaks(prev, tasks, weekInfo.weekId);
        if (burnedHabits.length > 0) {
          const names = burnedHabits.map((h) => `«${h.title}»`).join(', ');
          setScheduleNotice(
            `Стрик ${names} сгорел 🔥➡️ 0 (дело не было отмечено). Замораживайте стрики ❄️, чтобы защитить прогресс!`
          );
          setTimeout(() => setScheduleNotice(null), 6000);
          return updatedHabits;
        }
        return prev;
      });
    };

    runBurnCheck();
    window.addEventListener('focus', runBurnCheck);
    const interval = setInterval(runBurnCheck, 60000); // Check every minute
    return () => {
      window.removeEventListener('focus', runBurnCheck);
      clearInterval(interval);
    };
  }, [tasks, weekInfo.weekId]);

  // Helper: check if university pairs are deleted for the active week & selectedDay
  const isSelectedDayUniDeleted = useMemo(() => {
    return (
      (config.disabledUniversityDays || []).includes(selectedDay) ||
      singleDayDeletedUniKeys.includes(`${weekInfo.weekId}_${selectedDay}`)
    );
  }, [config.disabledUniversityDays, singleDayDeletedUniKeys, weekInfo.weekId, selectedDay]);

  // Config for selectedDay that treats single-day deleted university pairs as disabled during scheduling operations
  const effectiveConfigForSelectedDay = useMemo<UserScheduleConfig>(() => {
    if (!isSelectedDayUniDeleted) return config;
    const currentDisabled = config.disabledUniversityDays || [];
    if (currentDisabled.includes(selectedDay)) return config;
    return {
      ...config,
      disabledUniversityDays: [...currentDisabled, selectedDay],
    };
  }, [config, isSelectedDayUniDeleted, selectedDay]);

  // Save Task (Create or Edit) with smart cascading across all subsequent plans
  const handleSaveTask = (
    newTask: ScheduleTask,
    _cascadeShift = true,
    conflictResolution: ConflictResolutionOption = 'cascade_same_day',
    customOverrides?: {
      remappedTimes?: Record<string, { startTime: string; endTime: string }>;
      deletedTaskIds?: string[];
      movedToDays?: Record<string, DayOfWeek>;
    }
  ) => {
    const uniBlockIdsOnSelectedDay = isSelectedDayUniDeleted
      ? tasks
          .filter(
            (t) =>
              t.days.includes(selectedDay) &&
              (isUniversityBlock(t) || t.category === 'study_uni' || t.id.includes('uni-classes'))
          )
          .map((t) => t.id)
      : [];

    const hiddenIds = Array.from(
      new Set([...hiddenDayTasks.map((t) => t.id), ...uniBlockIdsOnSelectedDay])
    ).filter((id) => id !== newTask.id);

    const activeTasksForValidation = effectiveWeekTasks.filter(
      (t) => !t.days.includes(selectedDay) || !hiddenIds.includes(t.id)
    );

    const validation = validateTaskSchedulePlacement(
      newTask,
      selectedDay,
      effectiveConfigForSelectedDay,
      activeTasksForValidation
    );
    if (validation.isForbidden) {
      setScheduleNotice(
        validation.forbiddenReason?.includes('репетитор')
          ? '⛔ Действие запрещено (накладка с репетиторством)'
          : '⛔ Действие запрещено (сдвиг пар в вузе)'
      );
      setTimeout(() => setScheduleNotice(null), 5000);
      sounds.playUncheck(config.soundEnabled);
      return;
    }

    if (currentEnergyLevel !== 'full') {
      setDayEnergyModes((prev) => {
        const cur = prev[selectedDay] || { level: currentEnergyLevel, restoredTaskIds: [], hiddenTaskIds: [] };
        const nextRestored = Array.from(new Set([...(cur.restoredTaskIds || []), newTask.id]));
        const nextHidden = (cur.hiddenTaskIds || []).filter((id) => id !== newTask.id);
        return {
          ...prev,
          [selectedDay]: {
            ...cur,
            restoredTaskIds: nextRestored,
            hiddenTaskIds: nextHidden,
          },
        };
      });
    }

    const hasDeletedUniInOverrides = Boolean(
      customOverrides?.deletedTaskIds?.some((id) => {
        const t = tasks.find((x) => x.id === id);
        return t && (t.category === 'study_uni' || isUniversityBlock(t));
      })
    );
    if (hasDeletedUniInOverrides) {
      const singleDayKey = `${weekInfo.weekId}_${selectedDay}`;
      setSingleDayDeletedUniKeys((prev) => Array.from(new Set([...prev, singleDayKey])));
    }

    let notice: string | null = null;
    setTasks((prev) => {
      const effectiveUniDeleted = isSelectedDayUniDeleted || hasDeletedUniInOverrides;
      const currentUniIds = effectiveUniDeleted
        ? prev
            .filter(
              (t) =>
                t.days.includes(selectedDay) &&
                (isUniversityBlock(t) || t.category === 'study_uni' || t.id.includes('uni-classes'))
            )
            .map((t) => t.id)
        : [];
      const overrideDeletedIds = customOverrides?.deletedTaskIds || [];
      const allHiddenForDay = Array.from(
        new Set([...hiddenIds, ...currentUniIds, ...overrideDeletedIds])
      );

      const effectiveCfgForSave: UserScheduleConfig = effectiveUniDeleted
        ? {
            ...effectiveConfigForSelectedDay,
            disabledUniversityDays: Array.from(
              new Set([...(effectiveConfigForSelectedDay.disabledUniversityDays || []), selectedDay])
            ),
          }
        : effectiveConfigForSelectedDay;

      const res = applyTaskScheduleWithSmartCascading(
        prev,
        newTask,
        selectedDay,
        conflictResolution,
        effectiveCfgForSave,
        allHiddenForDay
      );
      let updated = res.updatedTasks;
      notice = res.noticeMessage;

      // 1. Remove any non-uni tasks marked as deleted by the user
      if (customOverrides?.deletedTaskIds && customOverrides.deletedTaskIds.length > 0) {
        const toDelete = new Set(customOverrides.deletedTaskIds);
        updated = updated
          .map((t) => {
            if (toDelete.has(t.id) && !isUniversityBlock(t)) {
              return {
                ...t,
                days: t.days.filter((d) => d !== selectedDay),
              };
            }
            return t;
          })
          .filter((t) => t.days.length > 0);
      }

      // 1b. Move any tasks to another day as requested by the user
      if (customOverrides?.movedToDays && Object.keys(customOverrides.movedToDays).length > 0) {
        const movedMap = customOverrides.movedToDays;
        const movedNotices: string[] = [];

        updated = updated.map((t) => {
          const destDay = movedMap[t.id];
          if (destDay && t.days.includes(selectedDay)) {
            const nextDays = t.days.filter((d) => d !== selectedDay);
            if (!nextDays.includes(destDay)) {
              nextDays.push(destDay);
            }
            movedNotices.push(`«${t.title}» → ${DAYS_INFO[destDay].name}`);
            return {
              ...t,
              days: nextDays,
            };
          }
          return t;
        });

        // Heal destination days to avoid overlaps with existing schedule on those days
        const destDays = Array.from(new Set(Object.values(movedMap)));
        destDays.forEach((destDay) => {
          const destTasks = updated.filter((t) => t.days.includes(destDay));
          const healed = healDayOverlaps(destTasks);
          const healedMap = new Map(healed.map((t) => [t.id, t]));
          updated = updated.map((t) => (t.days.includes(destDay) && healedMap.has(t.id) ? healedMap.get(t.id)! : t));
        });

        if (movedNotices.length > 0) {
          const movedText = `Перенесено на другой день: ${movedNotices.join(', ')}`;
          notice = notice ? `${notice}. ${movedText}` : movedText;
        }
      }

      // 2. Apply user custom time placements for specific affected tasks
      if (customOverrides?.remappedTimes && Object.keys(customOverrides.remappedTimes).length > 0) {
        const customMap = customOverrides.remappedTimes;
        updated = updated.map((t) => {
          if (t.days.includes(selectedDay) && customMap[t.id]) {
            const { startTime, endTime } = customMap[t.id];
            const startM = timeToMinutes(startTime);
            const endM = timeToMinutes(endTime);
            const dur = Math.max(15, endM - startM);
            return {
              ...t,
              startTime,
              endTime,
              durationMinutes: dur,
              isCustom: true,
            };
          }
          return t;
        });
      }

      // 3. If a university class was modified, automatically recalculate commute & prep
      if (newTask.category === 'study_uni') {
        return recalculateSchedule(updated, config);
      }

      // 4. Pin university blocks only if university pairs are active on selectedDay
      if (!effectiveUniDeleted) {
        updated = pinUniversityBlockTimes(updated, selectedDay);
      }
      return updated;
    });

    if (notice) {
      setScheduleNotice(notice);
      setTimeout(() => setScheduleNotice(null), 6000);
    }
    sounds.playCheck(config.soundEnabled);
  };

  // Helper to get hidden + single-day deleted uni task IDs for reordering/swapping
  const getDayExcludedTaskIds = (taskList: ScheduleTask[]) => {
    const baseHidden = hiddenDayTasks.map((t) => t.id);
    if (!isSelectedDayUniDeleted) return baseHidden;
    const uniIds = taskList
      .filter(
        (t) =>
          t.days.includes(selectedDay) &&
          (isUniversityBlock(t) || t.category === 'study_uni' || t.id.includes('uni-classes'))
      )
      .map((t) => t.id);
    return Array.from(new Set([...baseHidden, ...uniIds]));
  };

  // Swap two tasks' time positions cleanly
  const handleSwapTasks = (taskId1: string, taskId2: string) => {
    setTasks((prev) => {
      const prevIds = new Set(prev.map((t) => t.id));
      const missingFromPrev = baseDayTasks.filter((t) => !prevIds.has(t.id));
      const baseList = missingFromPrev.length > 0 ? [...prev, ...missingFromPrev] : prev;

      const swapped = swapTwoTasks(
        baseList,
        taskId1,
        taskId2,
        selectedDay,
        effectiveConfigForSelectedDay,
        getDayExcludedTaskIds(baseList)
      );
      return swapped.map((t) =>
        t.days.includes(selectedDay) && t.isCustom ? { ...t, isPinnedPermanent: true } : t
      );
    });
    sounds.playCheck(config.soundEnabled);
  };

  // Move task Up (earlier) or Down (later)
  const handleMoveUp = (taskId: string) => {
    setTasks((prev) => {
      const prevIds = new Set(prev.map((t) => t.id));
      const missingFromPrev = baseDayTasks.filter((t) => !prevIds.has(t.id));
      const baseList = missingFromPrev.length > 0 ? [...prev, ...missingFromPrev] : prev;

      const moved = moveTaskUpDown(
        baseList,
        taskId,
        'up',
        selectedDay,
        effectiveConfigForSelectedDay,
        getDayExcludedTaskIds(baseList)
      );
      return moved.map((t) =>
        t.days.includes(selectedDay) && t.isCustom ? { ...t, isPinnedPermanent: true } : t
      );
    });
    sounds.playCheck(config.soundEnabled);
  };

  const handleMoveDown = (taskId: string) => {
    setTasks((prev) => {
      const prevIds = new Set(prev.map((t) => t.id));
      const missingFromPrev = baseDayTasks.filter((t) => !prevIds.has(t.id));
      const baseList = missingFromPrev.length > 0 ? [...prev, ...missingFromPrev] : prev;

      const moved = moveTaskUpDown(
        baseList,
        taskId,
        'down',
        selectedDay,
        effectiveConfigForSelectedDay,
        getDayExcludedTaskIds(baseList)
      );
      return moved.map((t) =>
        t.days.includes(selectedDay) && t.isCustom ? { ...t, isPinnedPermanent: true } : t
      );
    });
    sounds.playCheck(config.soundEnabled);
  };

  // Drag and Drop reordering
  const handleDragStartTask = (taskId: string) => {
    setDraggingTaskId(taskId);
  };

  const handleDragOverTask = (targetTaskId: string) => {
    if (draggingTaskId && draggingTaskId !== targetTaskId) {
      if (dragOverTaskId !== targetTaskId) {
        setDragOverTaskId(targetTaskId);
      }
    }
  };

  const handleDragEndTask = () => {
    setDraggingTaskId(null);
    setDragOverTaskId(null);
  };

  const handleDropOnTask = (targetTaskId: string, explicitSourceTaskId?: string) => {
    const sourceId = explicitSourceTaskId || draggingTaskId;
    if (sourceId && sourceId !== targetTaskId) {
      const srcTask = activeModeDayTasks.find((t) => t.id === sourceId);
      if (srcTask) {
        if (isWakeUpTask(srcTask)) {
          setScheduleNotice('⏰ Утренний подъем всегда стоит первым в списке дел (изменить время можно через ✏️)');
          setTimeout(() => setScheduleNotice(null), 4000);
          setDraggingTaskId(null);
          setDragOverTaskId(null);
          return;
        }
        if (isTutoringTask(srcTask)) {
          setScheduleNotice('📌 Время репетиторства зафиксировано (изменить его можно через ✏️ редактирование)');
          setTimeout(() => setScheduleNotice(null), 4000);
          setDraggingTaskId(null);
          setDragOverTaskId(null);
          return;
        }
      }

      setTasks((prev) => {
        const prevIds = new Set(prev.map((t) => t.id));
        const missingFromPrev = baseDayTasks.filter((t) => !prevIds.has(t.id));
        const baseList = missingFromPrev.length > 0 ? [...prev, ...missingFromPrev] : prev;

        const reordered = reorderDayTasks(
          baseList,
          sourceId,
          targetTaskId,
          selectedDay,
          effectiveConfigForSelectedDay,
          getDayExcludedTaskIds(baseList)
        );
        return reordered.map((t) =>
          t.days.includes(selectedDay) && t.isCustom ? { ...t, isPinnedPermanent: true } : t
        );
      });
      sounds.playCheck(config.soundEnabled);
    }
    setDraggingTaskId(null);
    setDragOverTaskId(null);
  };

  // Update University Pair Time and trigger auto-recalculation
  const handleUpdatePairTime = (day: DayOfWeek, startTime: string, endTime: string) => {
    const updatedCustom = {
      ...(config.customUniversityPairs || {}),
      [day]: { startTime, endTime },
    };
    const newConfig: UserScheduleConfig = {
      ...config,
      customUniversityPairs: updatedCustom,
    };
    setConfig(newConfig);
    setTasks((prev) => {
      const updated = prev.map((t) => {
        if (t.days.includes(day) && t.category === 'study_uni') {
          return { ...t, startTime, endTime };
        }
        return t;
      });
      return recalculateSchedule(updated, newConfig);
    });
    sounds.playCheck(config.soundEnabled);
  };

  // Toggle university day in settings: delete or restore pairs for a day (affects all weeks)
  const handleToggleUniversityDay = (day: DayOfWeek) => {
    const isCurrentlyDisabled = Boolean(config.disabledUniversityDays?.includes(day));
    let nextDisabled: DayOfWeek[];
    if (isCurrentlyDisabled) {
      nextDisabled = (config.disabledUniversityDays || []).filter((d) => d !== day);
      // Also clear any single day deleted keys for this day to restore everywhere
      setSingleDayDeletedUniKeys((prev) => prev.filter((k) => !k.endsWith(`_${day}`)));
    } else {
      nextDisabled = [...(config.disabledUniversityDays || []), day];
    }
    const newConfig: UserScheduleConfig = {
      ...config,
      disabledUniversityDays: nextDisabled,
    };
    setConfig(newConfig);

    setTasks((prev) => {
      let updated: ScheduleTask[];
      if (isCurrentlyDisabled) {
        // Restore pairs for this day from INITIAL_TASKS
        const initUniTasks = INITIAL_TASKS.filter(
          (t) => t.days.includes(day) && isUniversityBlock(t)
        );
        const existingDayTasks = prev.filter((t) => t.days.includes(day));
        const missingUniTasks = initUniTasks.filter(
          (init) => !existingDayTasks.some((e) => e.id === init.id)
        );
        updated = [...prev, ...missingUniTasks];
      } else {
        // Delete / remove pairs and prep/travel for this day
        updated = prev
          .map((t) => {
            if (t.days.includes(day) && isUniversityBlock(t)) {
              return {
                ...t,
                days: t.days.filter((d) => d !== day),
              };
            }
            return t;
          })
          .filter((t) => t.days.length > 0);
      }
      return recalculateSchedule(updated, newConfig);
    });
    sounds.playCheck(config.soundEnabled);
  };

  // Recalculate full schedule
  const handleTriggerRecalculate = (cfg?: UserScheduleConfig) => {
    const activeCfg = cfg || config;
    setTasks((prev) => recalculateSchedule(prev, activeCfg));
    sounds.playCheck(config.soundEnabled);
  };

  // Delete Task with automatic baseline restoration:
  // "но если я удалю добавленные планы, то возвращай все как было"
  // "разрежи удалять планы на следующей неделе свайпом"
  const handleDeleteTask = (taskId: string) => {
    const targetTask = (weekInfo.isCurrentWeek ? tasks : baseDayTasks).find((t) => t.id === taskId) || tasks.find((t) => t.id === taskId);
    const isUni = Boolean(
      targetTask &&
        (isUniversityBlock(targetTask) ||
          targetTask.category === 'study_uni' ||
          targetTask.id.includes('uni-classes'))
    );

    if (isUni) {
      // User specifically deleted pairs for selectedDay in task edit:
      // "разреши мне удалять в какой то определенный день именно через редактирование дела"
      // "если я удаляю в один конкретный день то в настройках пары не удаляются, если через настройки то они удаляются на все недели"
      const singleDayKey = `${weekInfo.weekId}_${selectedDay}`;
      setSingleDayDeletedUniKeys((prev) => Array.from(new Set([...prev, singleDayKey])));

      // NOTE: Do NOT modify config.disabledUniversityDays here!
      // In settings, pairs must remain untouched and active for other weeks.
      sounds.playUncheck(config.soundEnabled);
      setScheduleNotice(`Пары на ${DAYS_INFO[selectedDay].shortName} удалены`);
      setTimeout(() => setScheduleNotice(null), 4000);
      return;
    }

    // Mark plan deleted for this week and day
    const weekTaskDayKey = `${weekInfo.weekId}_${selectedDay}_${taskId}`;
    const weekTaskKey = `${weekInfo.weekId}_${taskId}`;
    setDeletedWeekTaskKeys((prev) => Array.from(new Set([...prev, weekTaskDayKey, weekTaskKey])));

    if (weekInfo.isCurrentWeek) {
      setTasks((prev) => restoreBaselineAfterDeletion(prev, taskId, selectedDay, config));
    } else {
      // If on future week (e.g. next week), if this was a custom task added for this week, clean from tasks
      if (targetTask?.targetWeekId === weekInfo.weekId) {
        setTasks((prev) =>
          prev
            .map((t) => {
              if (t.id === taskId) {
                return {
                  ...t,
                  days: t.days.filter((d) => d !== selectedDay),
                };
              }
              return t;
            })
            .filter((t) => t.days.length > 0)
        );
      }
    }

    sounds.playUncheck(config.soundEnabled);
    const title = targetTask?.title ? `«${targetTask.title}»` : 'План';
    setScheduleNotice(`${title} удален`);
    setTimeout(() => setScheduleNotice(null), 4000);
  };

  // Helper for today's local date string YYYY-MM-DD
  const getTodayDateString = (): string => {
    const d = new Date();
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Increment habit streak: strictly only ONCE per day!
  const handleIncrementStreak = (habitId: string) => {
    const today = getTodayInfo();
    const todayStr = today.dateStr;
    const targetHabit = habits.find((h) => h.id === habitId);
    if (!targetHabit) return;

    const isDoneToday = targetHabit.lastCompletedDate === todayStr;
    const nextCompleted = !isDoneToday;

    // Sync matching task in today's schedule
    const matchingTask = tasks.find(
      (t) => t.days.includes(today.dayKey) && isTaskMatchingHabit(t, targetHabit)
    );

    if (matchingTask) {
      const dateKey = weekInfo.dayDates[today.dayKey]?.dateKey;
      const weekDayKey = `${weekInfo.weekId}_${today.dayKey}`;
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== matchingTask.id) return t;
          const updatedCompleted = {
            ...t.completedDays,
            ...(dateKey ? { [dateKey]: nextCompleted } : {}),
            [weekDayKey]: nextCompleted,
          };
          if (weekInfo.isCurrentWeek) {
            updatedCompleted[today.dayKey] = nextCompleted;
          }
          return {
            ...t,
            completedDays: updatedCompleted,
          };
        })
      );
    }

    setHabits((prev) =>
      prev.map((h) => {
        if (h.id === habitId) {
          if (isDoneToday) {
            // Already marked today: undo today's mark
            const newStreak = Math.max(0, h.streakDays - 1);
            setScheduleNotice(`Отметка серии «${h.title}» за сегодня снята.`);
            setTimeout(() => setScheduleNotice(null), 4000);
            sounds.playUncheck(config.soundEnabled);
            return {
              ...h,
              streakDays: newStreak,
              lastCompletedDate: undefined,
            };
          } else {
            // Mark for today (first and only time today)
            const newStreak = h.streakDays + 1;
            setScheduleNotice(`Серия «${h.title}» отмечена за сегодня! 🔥 (${newStreak} дн.)`);
            setTimeout(() => setScheduleNotice(null), 4000);
            sounds.playCelebration(config.soundEnabled);
            confetti({
              particleCount: 25,
              spread: 50,
              origin: { y: 0.7 },
              colors: ['#f59e0b', '#f43f5e', '#ec4899'],
            });
            return {
              ...h,
              streakDays: newStreak,
              lastCompletedDate: todayStr,
            };
          }
        }
        return h;
      })
    );
  };

  // Toggle streak freeze for a habit
  const handleToggleFreeze = (habitId: string) => {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id === habitId) {
          const nextFrozen = !h.isFrozen;
          setScheduleNotice(
            nextFrozen
              ? `Стрик «${h.title}» заморожен ❄️ Прогресс защищен от сгорания!`
              : `Стрик «${h.title}» разморожен 🔥 Серия активна!`
          );
          setTimeout(() => setScheduleNotice(null), 5000);
          sounds.playCheck(config.soundEnabled);
          return { ...h, isFrozen: nextFrozen };
        }
        return h;
      })
    );
  };

  // Freeze or unfreeze all habits
  const handleFreezeAll = (freeze: boolean) => {
    setHabits((prev) => prev.map((h) => ({ ...h, isFrozen: freeze })));
    setScheduleNotice(
      freeze
        ? `Все серии привычек заморожены ❄️ Дни защищены!`
        : `Все серии привычек разморожены 🔥`
    );
    setTimeout(() => setScheduleNotice(null), 5000);
    sounds.playCheck(config.soundEnabled);
  };

  // Add a new habit / streak
  const handleAddHabit = (newHabit: Omit<HabitStreak, 'id'>) => {
    const habit: HabitStreak = {
      ...newHabit,
      id: `habit-${Date.now()}`,
    };
    setHabits((prev) => [habit, ...prev]);
    setScheduleNotice(`Привычка «${habit.title}» успешно создана! 🎯`);
    setTimeout(() => setScheduleNotice(null), 5000);
    sounds.playCheck(config.soundEnabled);
  };

  // Delete a habit
  const handleDeleteHabit = (habitId: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== habitId));
    sounds.playUncheck(config.soundEnabled);
  };

  // Reset to default schedule
  const handleResetToDefault = () => {
    setTasks(INITIAL_TASKS);
    setHabits(INITIAL_HABITS);
    setConfig(DEFAULT_CONFIG);
    localStorage.removeItem(STORAGE_KEY_TASKS);
    localStorage.removeItem('auraday_tasks_v8');
    localStorage.removeItem('auraday_tasks_v7');
    localStorage.removeItem(STORAGE_KEY_HABITS);
    localStorage.removeItem(STORAGE_KEY_CONFIG);
  };

  // Restore pristine clean schedule for selected day
  const handleRestoreCleanDay = () => {
    const initDayTasks = INITIAL_TASKS.filter((t) => t.days.includes(selectedDay));
    const currentCompleted = completedMapForDay;
    const restored = initDayTasks.map((init) => ({
      ...init,
      completedDays:
        currentCompleted[init.id] !== undefined
          ? { [selectedDay]: currentCompleted[init.id] }
          : init.completedDays || {},
    }));
    const others = tasks.filter((t) => !t.days.includes(selectedDay));
    setTasks([...others, ...restored]);
    setScheduleNotice(`Расписание на ${DAYS_INFO[selectedDay].name.toLowerCase()} восстановлено к идеальному!`);
    setTimeout(() => setScheduleNotice(null), 4000);
    sounds.playCheck(config.soundEnabled);
  };

  // Calculate current & upcoming task based on current hour/minute
  const { currentTask, nextTask } = useMemo(() => {
    const now = new Date();
    const curTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const dayAllTasks = sortDayTasksWithWakeUpFirst(
      tasks.filter((t) => t.days.includes(selectedDay))
    );

    const cur = dayAllTasks.find((t) => curTime >= t.startTime && curTime <= t.endTime);
    const nxt = dayAllTasks.find((t) => t.startTime > curTime);

    return { currentTask: cur || null, nextTask: nxt || null };
  }, [tasks, selectedDay]);

  // Overall weekly completion percentage
  const weeklyTotalTasks = Object.values(dayStats).reduce((a, b) => a + b.total, 0);
  const weeklyCompletedTasks = Object.values(dayStats).reduce((a, b) => a + b.completed, 0);
  const weeklyRate = weeklyTotalTasks > 0 ? Math.round((weeklyCompletedTasks / weeklyTotalTasks) * 100) : 0;

  // Filter items
  const filterTabs: { key: TaskCategory | 'all'; label: string; icon: string }[] = [
    { key: 'all', label: 'Все', icon: '✨' },
    { key: 'study_uni', label: 'Вуз', icon: '🎓' },
    { key: 'tutoring', label: 'Ученики', icon: '📐' },
    { key: 'gym_sport', label: 'Зал', icon: '💪' },
    { key: 'abs', label: 'Пресс', icon: '⚡' },
    { key: 'languages', label: 'Языки', icon: '🇪🇸' },
    { key: 'career', label: 'Аналитика', icon: '📊' },
    { key: 'reading', label: 'Книга', icon: '📖' },
    { key: 'relaxation', label: 'Сериал', icon: '🎬' },
  ];

  const currentDateFormatted = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <IPhoneFrame
      showFrame={config.showIPhoneMockup}
      onToggleFrame={() => setConfig({ ...config, showIPhoneMockup: !config.showIPhoneMockup })}
    >
      {/* Dynamic Island Capsule */}
      <DynamicIsland
        currentTask={currentTask}
        nextTask={nextTask}
        totalCompletedCount={completedCurrentDay}
        totalTaskCount={totalCurrentDay}
      />

      {/* Main Content Area */}
      <div className="flex-1 px-4 sm:px-5 space-y-4 pt-1 pb-24">
        {/* Top Header Card */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="min-w-0 pr-1">
            <span className="text-[11px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-1 truncate">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>Твой персональный ритм</span>
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight capitalize truncate">
              {DAYS_INFO[selectedDay].name}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium capitalize-first truncate">
              {weekInfo.dayDates[selectedDay]?.formattedDate} · {weekInfo.title}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Dark Mode Theme Toggle */}
            <button
              onClick={cycleThemeMode}
              title={`Тема: ${timeDescription} (Нажми для переключения: Светлая / Темная / Авто)`}
              className="w-9 h-9 rounded-2xl bg-white/80 dark:bg-zinc-800/80 hover:bg-white dark:hover:bg-zinc-700 active:scale-95 text-slate-700 dark:text-zinc-200 border border-slate-200/60 dark:border-zinc-700 shadow-xs flex items-center justify-center transition cursor-pointer shrink-0"
            >
              {effectiveTheme === 'dark' ? (
                <Moon className="w-4 h-4 text-indigo-400 fill-indigo-400/20" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500 fill-amber-500/20" />
              )}
            </button>

            {/* Energy Mode Indicator & Switcher Button */}
            <button
              onClick={() => setIsEnergyModalOpen(true)}
              title={`Режим дня & Энергия: ${
                currentEnergyLevel === 'low'
                  ? 'Легкий режим (энергосбережение)'
                  : currentEnergyLevel === 'sick'
                  ? 'Восстановление / Болезнь'
                  : 'Полная энергия (100%)'
              }`}
              className={`w-9 h-9 rounded-2xl active:scale-95 border shadow-xs flex items-center justify-center transition cursor-pointer shrink-0 ${
                currentEnergyLevel === 'low'
                  ? 'bg-amber-100/90 dark:bg-amber-950/70 border-amber-300 dark:border-amber-700/80 text-amber-900 dark:text-amber-200 shadow-amber-200/50'
                  : currentEnergyLevel === 'sick'
                  ? 'bg-rose-100/90 dark:bg-rose-950/70 border-rose-300 dark:border-rose-700/80 text-rose-900 dark:text-rose-200 shadow-rose-200/50'
                  : 'bg-white/80 dark:bg-zinc-800/80 hover:bg-white dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border-slate-200/60 dark:border-zinc-700'
              }`}
            >
              {currentEnergyLevel === 'low' ? (
                <BatteryCharging className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-pulse" />
              ) : currentEnergyLevel === 'sick' ? (
                <HeartPulse className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              ) : (
                <Zap className="w-4 h-4 text-emerald-500 fill-emerald-500/30" />
              )}
            </button>

            {/* Notification Center Bell Button */}
            <button
              onClick={() => {
                setIsNotificationCenterOpen(true);
                sounds.playCheck(config.soundEnabled);
              }}
              title="Уведомления и напоминания"
              className="relative w-9 h-9 rounded-2xl bg-white/80 dark:bg-zinc-800/80 hover:bg-white dark:hover:bg-zinc-700 active:scale-95 text-slate-700 dark:text-zinc-200 border border-slate-200/60 dark:border-zinc-700 shadow-xs flex items-center justify-center transition cursor-pointer shrink-0"
            >
              <Bell className="w-4 h-4 text-rose-500" />
              {config.notificationsEnabled && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-800 animate-pulse" />
              )}
            </button>

            {/* Settings Button (Кнопка настроек) */}
            <button
              onClick={() => setIsCustomizerOpen(true)}
              title="Настройки ритма"
              className="w-9 h-9 rounded-2xl bg-white/80 dark:bg-zinc-800/80 hover:bg-white dark:hover:bg-zinc-700 active:scale-95 text-slate-700 dark:text-zinc-200 border border-slate-200/60 dark:border-zinc-700 shadow-xs flex items-center justify-center transition cursor-pointer shrink-0"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 7-Day iOS Pills & Week Navigation in One Unified Row */}
        <DaySelector
          selectedDay={selectedDay}
          onSelectDay={(day) => {
            setSelectedDay(day);
            sounds.playCheck(config.soundEnabled);
          }}
          dayStats={dayStats}
          weekInfo={weekInfo}
          onPrevWeek={() => {
            setWeekOffset((prev) => prev - 1);
            sounds.playCheck(config.soundEnabled);
          }}
          onNextWeek={() => {
            setWeekOffset((prev) => Math.min(1, prev + 1));
            sounds.playCheck(config.soundEnabled);
          }}
          onResetToCurrentWeek={() => {
            setWeekOffset(0);
            setSelectedDay(getInitialTodayKey());
            sounds.playCelebration(config.soundEnabled);
          }}
        />

        {/* View Tabs Selector (План дня, Вся неделя, Прогресс & Стрики) */}
        <div className="bg-slate-200/60 dark:bg-zinc-800/80 p-1 rounded-2xl flex items-center text-xs font-bold text-slate-600 dark:text-zinc-300 select-none">
          <button
            onClick={() => setActiveTab('today')}
            className={`flex-1 py-1.5 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'today'
                ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>План дня</span>
          </button>

          <button
            onClick={() => setActiveTab('week')}
            className={`flex-1 py-1.5 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'week'
                ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Вся неделя</span>
          </button>

          <button
            onClick={() => setActiveTab('progress')}
            className={`flex-1 py-1.5 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'progress'
                ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-rose-500" />
            <span>Прогресс</span>
          </button>
        </div>

        {/* TAB 1: TODAY'S PLAN */}
        {activeTab === 'today' && (
          <div className="space-y-4">
            {/* Apple Activity Rings Card */}
            <ActivityRings
              tasks={activeModeDayTasks}
              completedMap={completedMapForDay}
            />

            {/* Proactive Adaptive Day Suggestion Banner for heavy days (14+ tasks) when in Full mode */}
            {currentEnergyLevel === 'full' &&
              baseDayTasks.length >= 14 &&
              dismissedSuggestionDays[selectedDay] !== true && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-200/90 dark:border-amber-800/70 rounded-3xl p-3 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-slate-800 dark:text-zinc-100 transition-all animate-fadeIn">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-2xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                      <BatteryCharging className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-amber-950 dark:text-amber-200">
                          Плотный график: {baseDayTasks.length} задач на день
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-200/70 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200">
                          Высокая нагрузка
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSelectEnergyLevel('low')}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1"
                    >
                      <Zap className="w-3.5 h-3.5 fill-white" />
                      <span>Легкий режим</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEnergyModalOpen(true)}
                      className="px-2.5 py-1.5 rounded-xl bg-white/90 dark:bg-zinc-800 hover:bg-white dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-semibold text-xs border border-amber-200/80 dark:border-zinc-700 transition cursor-pointer"
                    >
                      Настроить
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDismissedSuggestionDays((prev) => ({ ...prev, [selectedDay]: true }))
                      }
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                      title="Скрыть подсказку"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

            {/* Active Energy Mode Banner (when low or sick) */}
            {currentEnergyLevel !== 'full' && (
              <div
                className={`p-3 rounded-3xl border flex items-center justify-between gap-3 text-xs shadow-2xs transition-all animate-fadeIn ${
                  currentEnergyLevel === 'low'
                    ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300/80 dark:border-amber-800/70 text-amber-950 dark:text-amber-100'
                    : 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-300/80 dark:border-rose-800/70 text-rose-950 dark:text-rose-100'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 text-base ${
                      currentEnergyLevel === 'low'
                        ? 'bg-amber-200/70 dark:bg-amber-900/60'
                        : 'bg-rose-200/70 dark:bg-rose-900/60'
                    }`}
                  >
                    {currentEnergyLevel === 'low' ? '🔋' : '🤒'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs">
                        {currentEnergyLevel === 'low'
                          ? '«Легкий режим» дня активен'
                          : 'Режим «Восстановление» активен'}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          currentEnergyLevel === 'low'
                            ? 'bg-amber-200/80 text-amber-900 dark:bg-amber-900/90 dark:text-amber-200'
                            : 'bg-rose-200/80 text-rose-900 dark:bg-rose-900/90 dark:text-rose-200'
                        }`}
                      >
                        Энергосбережение
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSelectEnergyLevel('full')}
                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 font-bold text-[11px] border border-slate-200/80 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700 transition cursor-pointer shadow-2xs"
                  >
                    Вернуть 100%
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEnergyModalOpen(true)}
                    className="p-1.5 rounded-xl bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700 transition cursor-pointer"
                    title="Настройки режима дня"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Category Filter Pills & Search */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по делам (испанский, пары, SQL...)"
                  className="w-full pl-8 pr-3 py-2 rounded-2xl bg-white/70 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-300 dark:focus:ring-rose-500 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category Filter Pills with Clean Runner (No arrows, no extra labels) */}
              <div className="task-types-scroll overflow-x-auto py-1 select-none">
                <div className="flex items-center gap-1.5 min-w-max px-0.5">
                  {filterTabs.map((f) => (
                    <button
                      key={f.key}
                      onClick={(e) => {
                        setFilterCategory(f.key);
                        e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                      }}
                      className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                        filterCategory === f.key
                          ? 'bg-slate-900 dark:bg-rose-600 text-white shadow-xs'
                          : 'bg-white/70 dark:bg-zinc-800/80 text-slate-600 dark:text-zinc-300 border border-slate-200/50 dark:border-zinc-700/60 hover:bg-white dark:hover:bg-zinc-700'
                      }`}
                    >
                      <span>{f.icon}</span>
                      <span>{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions (Mark all / Reset) */}
            <div className="flex items-center justify-between text-xs px-1 text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Дела на день ({completedCurrentDay} из {totalCurrentDay} выполнено)
              </span>

              <div className="flex items-center gap-3">
                {completedCurrentDay < totalCurrentDay && (
                  <button
                    onClick={handleCompleteAll}
                    className="text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Все готово</span>
                  </button>
                )}
                {completedCurrentDay > 0 && (
                  <button
                    onClick={handleResetDay}
                    className="text-slate-400 hover:text-slate-600 font-medium flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Снять отметки</span>
                  </button>
                )}
              </div>
            </div>

            {/* Conflict Rescheduling Notice Banner */}
            {scheduleNotice && (
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-3 rounded-2xl shadow-md text-xs font-semibold flex items-center justify-between gap-2 animate-fadeIn">
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles className="w-4 h-4 text-emerald-200 shrink-0" />
                  <span className="break-words leading-snug">{scheduleNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setScheduleNotice(null)}
                  className="p-1 hover:bg-white/20 rounded-full transition shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* University pairs restore banner without long verbose text */}
            {singleDayDeletedUniKeys.includes(`${weekInfo.weekId}_${selectedDay}`) && (
              <div className="bg-indigo-50/80 dark:bg-zinc-800/80 border border-indigo-200/90 dark:border-zinc-700/80 rounded-2xl p-3 flex items-center justify-between gap-2 text-xs animate-fadeIn">
                <div className="flex items-center gap-2 min-w-0">
                  <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="text-indigo-950 dark:text-zinc-200 font-semibold">
                    Пары отменены
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSingleDayDeletedUniKeys((prev) =>
                      prev.filter((k) => k !== `${weekInfo.weekId}_${selectedDay}`)
                    );
                    setScheduleNotice(`Пары возвращены в расписание`);
                    setTimeout(() => setScheduleNotice(null), 4000);
                    sounds.playCheck(config.soundEnabled);
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition cursor-pointer shrink-0 shadow-2xs active:scale-95 flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Вернуть пары</span>
                </button>
              </div>
            )}

            {/* Tasks List */}
            {currentDayTasks.length === 0 ? (
              <div className="bg-white/60 dark:bg-slate-900/60 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-2">
                <div className="text-3xl">☕</div>
                <div className="text-sm font-bold text-slate-700 dark:text-slate-200">Нет дел по выбранному фильтру</div>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Попробуйте очистить фильтр или добавьте новое дело кнопкой + вверху
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {currentDayTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isCompleted={!!completedMapForDay[task.id]}
                    onToggleComplete={handleToggleTask}
                    onEditTask={(t) => {
                      setEditingTask(t);
                      setIsEditModalOpen(true);
                    }}
                    onDeleteTask={handleDeleteTask}
                    onDragStartTask={handleDragStartTask}
                    onDragOverTask={handleDragOverTask}
                    onDropOnTask={handleDropOnTask}
                    onDragEndTask={handleDragEndTask}
                    isDragging={draggingTaskId === task.id}
                    isDragOver={dragOverTaskId === task.id}
                    soundEnabled={config.soundEnabled}
                  />
                ))}
              </div>
            )}

            {/* Hidden Secondary Tasks Drawer in Light / Sick Mode */}
            {hiddenDayTasks.length > 0 && (
              <div className="border border-dashed border-slate-200/90 dark:border-zinc-800 rounded-3xl p-3.5 bg-slate-50/70 dark:bg-zinc-900/40 space-y-2 transition-all">
                <button
                  type="button"
                  onClick={() => setShowHiddenTasksSection((prev) => !prev)}
                  className="w-full flex items-center justify-between text-xs font-bold text-slate-700 dark:text-zinc-300 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-xl bg-slate-200 dark:bg-zinc-800 flex items-center justify-center text-xs">
                      💤
                    </span>
                    <span>Скрытые второстепенные дела ({hiddenDayTasks.length})</span>
                    <span className="text-[10px] font-normal text-slate-400 dark:text-zinc-500">
                      {showHiddenTasksSection ? 'Скрыть список' : 'Показать'}
                    </span>
                  </div>
                  {showHiddenTasksSection ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {showHiddenTasksSection && (
                  <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-zinc-800/80 animate-fadeIn">
                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                      {hiddenDayTasks.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between p-2.5 rounded-2xl bg-white/80 dark:bg-zinc-800/70 border border-slate-200/60 dark:border-zinc-700/60 text-xs shadow-2xs gap-2"
                        >
                          <div className="min-w-0 pr-1">
                            <div className="font-semibold text-slate-700 dark:text-zinc-200 truncate">
                              {t.title}
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-zinc-400 flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>
                                {t.startTime} – {t.endTime} ({t.durationMinutes} мин)
                              </span>
                              <span>·</span>
                              <span>{CATEGORY_INFO[t.category]?.name}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRestoreHiddenTask(t.id)}
                            className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-bold text-[10px] shadow-2xs transition shrink-0 cursor-pointer"
                          >
                            + Вернуть
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: WEEK TIMELINE */}
        {activeTab === 'week' && (
          <WeekTimelineView
            tasks={effectiveWeekTasks}
            weekInfo={weekInfo}
            onSelectDay={(day) => {
              setSelectedDay(day);
              setActiveTab('today');
              sounds.playCheck(config.soundEnabled);
            }}
          />
        )}

        {/* TAB 3: PROGRESS & STREAKS */}
        {activeTab === 'progress' && (
          <ProgressView
            habits={habits}
            tasks={tasks}
            weekInfo={weekInfo}
            onIncrementStreak={handleIncrementStreak}
            onToggleFreeze={handleToggleFreeze}
            onAddHabit={handleAddHabit}
            onDeleteHabit={handleDeleteHabit}
            onFreezeAll={handleFreezeAll}
            weeklyCompletedRate={weeklyRate}
          />
        )}
      </div>

      {/* Floating Add Task Action Button (+) at bottom */}
      <div className="sticky bottom-3 w-full flex justify-center pointer-events-none z-30 pb-safe">
        <button
          type="button"
          onClick={() => {
            setEditingTask(null);
            setIsEditModalOpen(true);
            sounds.playCheck(config.soundEnabled);
          }}
          title="Добавить новое дело"
          className="pointer-events-auto w-12 h-12 rounded-full bg-gradient-to-tr from-rose-600 via-rose-500 to-pink-500 text-white shadow-xl shadow-rose-500/35 hover:shadow-rose-500/50 active:scale-90 transition-all flex items-center justify-center border-2 border-white dark:border-[#18181b] cursor-pointer"
        >
          <Plus className="w-6 h-6 stroke-[3]" />
        </button>
      </div>

      {/* Edit & Create Task Modal */}
      {isEditModalOpen && (
        <EditTaskModal
          task={editingTask}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingTask(null);
          }}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          onMoveToSecondary={handleMoveToSecondary}
          initialDay={selectedDay}
          dayTasks={activeModeDayTasks}
          allTasks={effectiveWeekTasks}
          config={effectiveConfigForSelectedDay}
          onSwapTasks={handleSwapTasks}
          hiddenTaskIds={hiddenDayTasks.map((t) => t.id)}
          dayEnergyModes={dayEnergyModes}
          currentWeekId={weekInfo.weekId}
        />
      )}

      {/* Schedule Customizer Modal */}
      {isCustomizerOpen && (
        <ScheduleCustomizerModal
          isOpen={isCustomizerOpen}
          onClose={() => setIsCustomizerOpen(false)}
          config={config}
          onUpdateConfig={setConfig}
          tasks={tasks}
          onUpdatePairTime={handleUpdatePairTime}
          onTriggerRecalculate={handleTriggerRecalculate}
          onResetToDefault={handleResetToDefault}
          habits={habits}
          onDeleteHabit={handleDeleteHabit}
          onToggleUniversityDay={handleToggleUniversityDay}
        />
      )}

      {/* Energy Mode & Adaptive Day Template Modal */}
      {isEnergyModalOpen && (
        <EnergyModeModal
          isOpen={isEnergyModalOpen}
          onClose={() => setIsEnergyModalOpen(false)}
          selectedDay={selectedDay}
          currentLevel={currentEnergyLevel}
          onSelectLevel={handleSelectEnergyLevel}
          onFreezeAllHabits={() => handleFreezeAll(true)}
          totalTasksCount={baseDayTasks.length}
          lightTasksCount={baseDayTasks.filter((t) => isEssentialTaskForMode(t, 'low', [])).length}
        />
      )}

      {/* Interactive In-App Notification Banner HUD */}
      <InAppNotificationBanner
        onMarkTaskDone={(taskId) => {
          handleToggleTask(taskId);
        }}
        onFreezeAllHabits={() => handleFreezeAll(true)}
      />

      {/* Notification Center Modal */}
      {isNotificationCenterOpen && (
        <NotificationCenterModal
          isOpen={isNotificationCenterOpen}
          onClose={() => setIsNotificationCenterOpen(false)}
          config={config}
          onUpdateConfig={setConfig}
        />
      )}
    </IPhoneFrame>
  );
}
