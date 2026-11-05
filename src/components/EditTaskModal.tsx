import React, { useState, useMemo, useEffect } from 'react';
import { ScheduleTask, TaskCategory, DayOfWeek, UserScheduleConfig } from '../types/schedule';
import { CATEGORY_INFO, DAYS_INFO } from '../data/defaultSchedule';
import { isEssentialTaskForMode, EnergyLevel } from '../utils/energyMode';
import {
  timeToMinutes,
  minutesToTime,
  NEXT_DAY_MAP,
  analyzeTaskTimePlacement,
  validateTaskSchedulePlacement,
  ConflictResolutionOption,
  computeAllAffectedTasks,
  AffectedTaskDetail,
  isWakeUpTask,
  isUniversityBlock,
  isTutoringTask,
} from '../utils/scheduleEngine';
import { X, Check, Trash2, ArrowUpDown, AlertCircle, Sparkles, Moon, Calendar, Clock, RotateCcw } from 'lucide-react';

export interface CategoryTaskSuggestion {
  title: string;
  subtitle?: string;
  durationMinutes: number;
  category: TaskCategory;
  emoji?: string;
  badge?: string;
}

export const BASELINE_PINNED_SUGGESTIONS: Record<TaskCategory, CategoryTaskSuggestion[]> = {
  relaxation: [
    {
      title: 'Прогулка',
      subtitle: 'Спокойная прогулка на свежем воздухе, перезагрузка и отдых',
      durationMinutes: 60,
      category: 'relaxation',
      emoji: '🌿',
      badge: '60 мин',
    },
    {
      title: 'Сериал (23:00)',
      subtitle: 'Просмотр любимого сериала, вечерний релакс',
      durationMinutes: 55,
      category: 'relaxation',
      emoji: '🍿',
      badge: '55 мин',
    },
    {
      title: 'Свободное время & Отдых',
      subtitle: 'Личное время, музыка, хобби или неторопливый отдых',
      durationMinutes: 60,
      category: 'relaxation',
      emoji: '☕',
      badge: '60 мин',
    },
  ],
  languages: [
    {
      title: 'Испанский (1.5 ч)',
      subtitle: 'Грамматика, лексика, аудирование',
      durationMinutes: 90,
      category: 'languages',
      emoji: '🇪🇸',
      badge: '90 мин',
    },
    {
      title: 'Английский (1 ч)',
      subtitle: 'Лексика, чтение, разговорная практика',
      durationMinutes: 60,
      category: 'languages',
      emoji: '🇬🇧',
      badge: '60 мин',
    },
  ],
  reading: [
    {
      title: 'Чтение книги (30 мин)',
      subtitle: 'Художественная или профессиональная литература перед сном',
      durationMinutes: 30,
      category: 'reading',
      emoji: '📖',
      badge: '30 мин',
    },
  ],
  gym_sport: [
    {
      title: 'Сборы в зал (10 мин)',
      subtitle: 'Форма, кроссовки, бутылка воды',
      durationMinutes: 10,
      category: 'gym_sport',
      emoji: '🎒',
      badge: '10 мин',
    },
    {
      title: 'Пешком в зал (10 мин)',
      subtitle: 'Пешком до фитнес-клуба',
      durationMinutes: 10,
      category: 'gym_sport',
      emoji: '🚶',
      badge: '10 мин',
    },
    {
      title: 'Тренировка в зале (1ч) + Пресс (30м)',
      subtitle: '1 час силовой/кардио + 30 мин пресса прямо в зале',
      durationMinutes: 90,
      category: 'gym_sport',
      emoji: '🏋️',
      badge: '90 мин',
    },
    {
      title: 'Пешком домой из зала (10 мин)',
      subtitle: 'Пешком домой после тренировки',
      durationMinutes: 10,
      category: 'gym_sport',
      emoji: '🏠',
      badge: '10 мин',
    },
  ],
  abs: [
    {
      title: 'Пресс (30 мин)',
      subtitle: 'Тренировка пресса и укрепление мышц кора',
      durationMinutes: 30,
      category: 'abs',
      emoji: '🔥',
      badge: '30 мин',
    },
  ],
  career: [
    {
      title: 'SQL & Python для аналитика (1 час)',
      subtitle: '30м SQL запросы + 30м скрипты на Python',
      durationMinutes: 60,
      category: 'career',
      emoji: '📊',
      badge: '60 мин',
    },
    {
      title: 'Мат.статистика & задачи (30 мин)',
      subtitle: 'Гипотезы, p-value, метрики продукта и задачи',
      durationMinutes: 30,
      category: 'career',
      emoji: '📈',
      badge: '30 мин',
    },
  ],
  study_uni: [
    {
      title: 'Пары в вузе',
      subtitle: 'Основное расписание университета (лекции и семинары)',
      durationMinutes: 90,
      category: 'study_uni',
      emoji: '🎓',
      badge: '90 мин',
    },
  ],
  tutoring: [
    {
      title: 'Репетиторство (урок)',
      subtitle: 'Индивидуальное занятие с учеником по математике',
      durationMinutes: 60,
      category: 'tutoring',
      emoji: '📐',
      badge: '60 мин',
    },
  ],
  routine: [
    {
      title: 'Подъем & утренние сборы',
      subtitle: 'Зарядка, душ, утренний распорядок',
      durationMinutes: 30,
      category: 'routine',
      emoji: '⏰',
      badge: '30 мин',
    },
    {
      title: 'Обед & отдых',
      subtitle: 'Полноценный прием пищи и перезагрузка',
      durationMinutes: 45,
      category: 'routine',
      emoji: '🍲',
      badge: '45 мин',
    },
    {
      title: 'Ужин & вечерний душ',
      subtitle: 'Прием пищи и подготовка к вечеру',
      durationMinutes: 40,
      category: 'routine',
      emoji: '🍳',
      badge: '40 мин',
    },
  ],
};

interface EditTaskModalProps {
  task: ScheduleTask | null; // null if creating a new task
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    task: ScheduleTask,
    cascadeShift?: boolean,
    conflictResolution?: ConflictResolutionOption,
    customOverrides?: {
      remappedTimes?: Record<string, { startTime: string; endTime: string }>;
      deletedTaskIds?: string[];
      movedToDays?: Record<string, DayOfWeek>;
    }
  ) => void;
  onDelete?: (taskId: string) => void;
  onMoveToSecondary?: (taskId: string) => void;
  initialDay?: DayOfWeek;
  dayTasks?: ScheduleTask[];
  allTasks?: ScheduleTask[];
  config?: UserScheduleConfig;
  onSwapTasks?: (taskId1: string, taskId2: string) => void;
  hiddenTaskIds?: string[];
  dayEnergyModes?: Record<string, { level: EnergyLevel; restoredTaskIds?: string[]; hiddenTaskIds?: string[] }>;
  currentWeekId?: string;
}

export const EditTaskModal: React.FC<EditTaskModalProps> = ({
  task,
  isOpen,
  onClose,
  onSave,
  onDelete,
  onMoveToSecondary,
  initialDay = 'mon',
  dayTasks = [],
  allTasks = [],
  config,
  onSwapTasks,
  hiddenTaskIds = [],
  dayEnergyModes,
  currentWeekId,
}) => {
  const [title, setTitle] = useState(task ? task.title : '');
  const [subtitle, setSubtitle] = useState(task ? task.subtitle || '' : '');
  const [startTime, setStartTime] = useState(task ? task.startTime : '14:00');
  const [endTime, setEndTime] = useState(task ? task.endTime : '14:30');
  const [category] = useState<TaskCategory>(task ? task.category : 'routine');
  const [cascadeShift, setCascadeShift] = useState(true);
  const [conflictResolution, setConflictResolution] = useState<ConflictResolutionOption>('cascade_same_day');
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(
    task ? task.days : [initialDay]
  );
  // Rule: "если я добавлю какие то новые планы то они только на эту неделю... можно при добавлении дела придумать кнопку закрепить его в расписании и тогда оставлять его навсегда"
  const [isPinnedPermanent, setIsPinnedPermanent] = useState<boolean>(
    task ? (task.isPinnedPermanent ?? !task.isCustom) : false
  );

  // User customized times for any specific affected task in the chain
  const [customTimes, setCustomTimes] = useState<Record<string, { startTime: string; endTime: string }>>({});
  // User selected tasks to be deleted from the day
  const [deletedTaskIds, setDeletedTaskIds] = useState<string[]>([]);
  // User selected tasks to be moved to another day
  const [movedToDays, setMovedToDays] = useState<Record<string, DayOfWeek>>({});
  // Track open day picker for an affected task
  const [openDayPickerForId, setOpenDayPickerForId] = useState<string | null>(null);

  // Sync state when editing task or modal opening changes
  useEffect(() => {
    if (isOpen) {
      setTitle(task ? task.title : '');
      setSubtitle(task ? task.subtitle || '' : '');
      setStartTime(task ? task.startTime : '14:00');
      setEndTime(task ? task.endTime : '14:30');
      setCascadeShift(true);
      setSelectedDays(task ? task.days : [initialDay]);
      setIsPinnedPermanent(task ? (task.isPinnedPermanent ?? !task.isCustom) : false);
      setCustomTimes({});
      setDeletedTaskIds([]);
      setMovedToDays({});
      setOpenDayPickerForId(null);
    }
  }, [task, isOpen, initialDay]);

  const toggleDay = (day: DayOfWeek) => {
    if (selectedDays.includes(day)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter((d) => d !== day));
      }
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const calculateDuration = (start: string, end: string) => {
    try {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      return Math.max(15, endMin - startMin);
    } catch {
      return 30;
    }
  };

  // Temporary task representation for analysis
  const tempMovingTask = useMemo<ScheduleTask>(() => {
    const startM = timeToMinutes(startTime);
    let endM = timeToMinutes(endTime);
    if (endM <= startM) {
      endM = Math.min(1435, startM + (task?.durationMinutes || 60));
    }
    const dur = Math.max(15, endM - startM);
    return {
      id: task ? task.id : 'temp-new-id',
      title: title.trim() || 'Новое дело',
      subtitle: subtitle.trim() || undefined,
      startTime,
      endTime: minutesToTime(endM),
      durationMinutes: dur,
      category,
      days: selectedDays,
      completedDays: task ? task.completedDays : {},
      isCustom: true,
    };
  }, [task, title, subtitle, startTime, endTime, category, selectedDays]);

  const activeDay = selectedDays[0] || initialDay;
  const isMovingWake = isWakeUpTask(tempMovingTask);
  const wakeUpTarget =
    (activeDay === 'sat' || activeDay === 'sun'
      ? config?.wakeUpTimeWeekend || '10:00'
      : activeDay === 'thu'
      ? config?.wakeUpTimeThursday || '08:30'
      : config?.wakeUpTimeWeekday || '09:00');
  const wakeUpMins = timeToMinutes(wakeUpTarget);
  const isEarlierThanWakeUp = !isMovingWake && timeToMinutes(startTime) < wakeUpMins;

  // Compute hidden task IDs on activeDay (e.g. English, Spanish in Light Mode)
  const activeHiddenTaskIds = useMemo<string[]>(() => {
    if (dayEnergyModes && dayEnergyModes[activeDay]) {
      const dayState = dayEnergyModes[activeDay];
      const level = dayState.level || 'full';
      const restored = dayState.restoredTaskIds || [];
      const hidden = dayState.hiddenTaskIds || [];
      if (level !== 'full' || hidden.length > 0) {
        return allTasks
          .filter((t) => t.days.includes(activeDay) && !isEssentialTaskForMode(t, level, restored, hidden))
          .map((t) => t.id);
      }
    }
    if (hiddenTaskIds && hiddenTaskIds.length > 0) {
      return hiddenTaskIds;
    }
    // If moving task itself is adapted for Light Mode
    const isMovingLight =
      tempMovingTask.subtitle?.toLowerCase().includes('легкий режим') ||
      tempMovingTask.subtitle?.toLowerCase().includes('лёгкий режим') ||
      tempMovingTask.title?.toLowerCase().includes('микро-сессия') ||
      tempMovingTask.title?.toLowerCase().includes('экспресс');
    if (isMovingLight) {
      return allTasks
        .filter((t) => t.days.includes(activeDay) && !isEssentialTaskForMode(t, 'low', [tempMovingTask.id], []))
        .map((t) => t.id);
    }
    return [];
  }, [dayEnergyModes, activeDay, allTasks, hiddenTaskIds, tempMovingTask]);

  const activeHiddenSet = useMemo(() => new Set(activeHiddenTaskIds), [activeHiddenTaskIds]);

  // Tasks to analyze for activeDay: only active, non-hidden tasks (always keep moving task)
  const tasksToAnalyze = useMemo(() => {
    const source = allTasks && allTasks.length > 0 ? allTasks : dayTasks;
    const deletedSet = new Set(deletedTaskIds);
    return source.filter(
      (t) =>
        (!t.days.includes(activeDay) || !activeHiddenSet.has(t.id) || t.id === tempMovingTask.id) &&
        !deletedSet.has(t.id)
    );
  }, [allTasks, dayTasks, activeDay, activeHiddenSet, tempMovingTask.id, deletedTaskIds]);

  // Strict university pairs protection validator
  const validation = useMemo(() => {
    return validateTaskSchedulePlacement(tempMovingTask, activeDay, config, tasksToAnalyze);
  }, [tempMovingTask, activeDay, config, tasksToAnalyze]);

  // Deep feasibility & cascading analysis
  const placementAnalysis = useMemo(() => {
    const activeConfig =
      config ||
      ({
        wakeUpTimeWeekday: '09:00',
        wakeUpTimeThursday: '08:30',
        wakeUpTimeWeekend: '10:00',
      } as UserScheduleConfig);

    return analyzeTaskTimePlacement(
      tasksToAnalyze,
      tempMovingTask,
      activeDay,
      activeConfig,
      activeHiddenTaskIds
    );
  }, [tasksToAnalyze, tempMovingTask, activeDay, config, activeHiddenTaskIds]);

  // Sync default selection to the recommended option (never auto-select shift_earlier)
  useEffect(() => {
    const recommended = placementAnalysis.options.find((o) => o.isRecommended);
    if (recommended) {
      setConflictResolution(recommended.mode);
    } else if (placementAnalysis.mustMoveToNextDay) {
      setConflictResolution('move_to_next_day');
    } else if (placementAnalysis.canMoveToEvening) {
      setConflictResolution('move_to_evening');
    } else if (placementAnalysis.canShiftLater && placementAnalysis.overlappingTasks.length > 0) {
      setConflictResolution('shift_later');
    } else {
      setConflictResolution('cascade_same_day');
    }
  }, [placementAnalysis]);

  // Chain of all tasks affected by this placement / shift
  const affectedTasksChain = useMemo<AffectedTaskDetail[]>(() => {
    const activeConfig =
      config ||
      ({
        wakeUpTimeWeekday: '09:00',
        wakeUpTimeThursday: '08:30',
        wakeUpTimeWeekend: '10:00',
      } as UserScheduleConfig);

    return computeAllAffectedTasks(
      tasksToAnalyze,
      tempMovingTask,
      activeDay,
      conflictResolution,
      activeConfig,
      customTimes,
      deletedTaskIds,
      movedToDays,
      activeHiddenTaskIds
    );
  }, [
    tasksToAnalyze,
    tempMovingTask,
    activeDay,
    conflictResolution,
    config,
    customTimes,
    deletedTaskIds,
    movedToDays,
    activeHiddenTaskIds,
  ]);

  const handleAffectedTimeChange = (id: string, newStart: string, taskDur: number) => {
    const startM = timeToMinutes(newStart);
    const newEnd = minutesToTime(Math.min(1435, startM + taskDur));
    setCustomTimes((prev) => ({
      ...prev,
      [id]: { startTime: newStart, endTime: newEnd },
    }));
  };

  const handleAffectedEndTimeChange = (id: string, newEnd: string, taskStart: string) => {
    setCustomTimes((prev) => ({
      ...prev,
      [id]: {
        startTime: prev[id]?.startTime ?? taskStart,
        endTime: newEnd,
      },
    }));
  };

  const handleResetAffectedTime = (id: string) => {
    setCustomTimes((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleToggleDeleteAffected = (id: string) => {
    setDeletedTaskIds((prev) => {
      const willDelete = !prev.includes(id);
      if (willDelete) {
        setMovedToDays((m) => {
          const next = { ...m };
          delete next[id];
          return next;
        });
      }
      return willDelete ? [...prev, id] : prev.filter((x) => x !== id);
    });
  };

  const handleMoveToDay = (id: string, targetDay: DayOfWeek) => {
    setMovedToDays((prev) => ({
      ...prev,
      [id]: targetDay,
    }));
    setDeletedTaskIds((prev) => prev.filter((x) => x !== id));
    setOpenDayPickerForId(null);
  };

  const handleCancelMoveToDay = (id: string) => {
    setMovedToDays((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (validation.isForbidden) return;

    const startM = timeToMinutes(startTime);
    let endM = timeToMinutes(endTime);
    if (endM <= startM) {
      endM = Math.min(1435, startM + (task?.durationMinutes || 60));
    }
    const duration = Math.max(15, endM - startM);
    const validEndTime = minutesToTime(endM);

    const updatedTask: ScheduleTask = {
      id: task ? task.id : `custom-${Date.now()}`,
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      startTime,
      endTime: validEndTime,
      durationMinutes: duration,
      category,
      days: selectedDays,
      completedDays: task ? task.completedDays : {},
      isCustom: true,
      originalStartTime: task?.originalStartTime || startTime,
      originalEndTime: task?.originalEndTime || validEndTime,
      isPinnedPermanent,
      weekScope: isPinnedPermanent ? 'permanent' : 'this_week',
      targetWeekId: isPinnedPermanent ? undefined : (task?.targetWeekId || currentWeekId),
    };

    onSave(updatedTask, cascadeShift, conflictResolution, {
      remappedTimes: customTimes,
      deletedTaskIds,
      movedToDays,
    });
    onClose();
  };

  const handleStartTimeChange = (newStart: string) => {
    setStartTime(newStart);
    const oldStartM = timeToMinutes(startTime);
    const oldEndM = timeToMinutes(endTime);
    const dur = oldEndM > oldStartM ? oldEndM - oldStartM : (task?.durationMinutes || 60);
    const newStartM = timeToMinutes(newStart);
    const newEndM = Math.min(1435, newStartM + dur);
    setEndTime(minutesToTime(newEndM));
  };

  const daysList: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white dark:bg-[#1a1a1e] rounded-t-[32px] sm:rounded-[32px] w-full max-w-md shadow-2xl border-t sm:border border-slate-200/80 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[86vh] sm:max-h-[88vh] text-slate-800 dark:text-zinc-100 transition-colors">
        {/* iOS Pull Down Grabber Bar */}
        <div className="w-full pt-2.5 pb-1 flex justify-center sm:hidden shrink-0">
          <div className="w-10 h-1 bg-slate-300 dark:bg-zinc-600 rounded-full" />
        </div>
        {/* Header */}
        <div className="p-4 px-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100">
              {task ? 'Редактировать дело' : 'Новое дело в расписание'}
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-zinc-400">
              Все последующие дела автоматически сдвинутся по цепочке без накладок
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable inputs container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 pb-6">
            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                Название
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: SQL оконные функции"
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:focus:ring-sky-500 text-sm font-medium text-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Subtitle / Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                Описание / детали
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Подсказки, материалы или ссылки"
                className="w-full px-4 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:focus:ring-sky-500 text-xs text-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Time pickers */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                Начало
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:focus:ring-sky-500 text-sm font-mono font-medium text-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                Окончание
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:focus:ring-sky-500 text-sm font-mono font-medium text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Rule: "если я добавлю какие то новые планы то они только на эту неделю, на следующей все должно быть как прежде, можно при добавлении дела придумать кнопку закрепить его в расписании и тогда оставлять его навсегда" */}
          <div className="bg-gradient-to-br from-slate-50 to-amber-50/40 dark:from-slate-800/80 dark:to-zinc-800/80 rounded-2xl p-3 border border-slate-200/90 dark:border-zinc-700/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5 uppercase tracking-wider">
                <span>{isPinnedPermanent ? '📌' : '⚡'}</span>
                Срок действия дела
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isPinnedPermanent
                    ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                    : 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                }`}
              >
                {isPinnedPermanent ? 'На все недели навсегда' : 'Только на эту неделю'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsPinnedPermanent(false)}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  !isPinnedPermanent
                    ? 'bg-white dark:bg-slate-800 border-amber-400 dark:border-amber-500 shadow-sm ring-2 ring-amber-400/30'
                    : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-zinc-700 hover:border-slate-300 text-slate-500 dark:text-zinc-400'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-zinc-100">
                  <span>⚡</span> Только эта неделя
                </div>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 leading-tight">
                  Разовый план. На следующей неделе вернется обычный распорядок.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setIsPinnedPermanent(true)}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  isPinnedPermanent
                    ? 'bg-white dark:bg-slate-800 border-purple-500 dark:border-purple-400 shadow-sm ring-2 ring-purple-500/30'
                    : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-zinc-700 hover:border-slate-300 text-slate-500 dark:text-zinc-400'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-zinc-100">
                  <span>📌</span> Закрепить навсегда
                </div>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 leading-tight">
                  Повторять каждую неделю на постоянной основе.
                </p>
              </button>
            </div>
          </div>

          {/* Strict University Pairs Protection Warning / Block */}
          {validation.isForbidden && (
            <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800/80 rounded-2xl p-3 text-xs text-rose-950 dark:text-rose-200 flex items-start gap-2.5 shadow-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="font-extrabold text-xs tracking-wide text-rose-900 dark:text-rose-200">
                  {validation.forbiddenReason?.includes('репетитор')
                    ? '⛔ Действие запрещено (накладка с репетиторством)'
                    : '⛔ Действие запрещено (сдвиг пар в вузе)'}
                </div>
                {validation.forbiddenReason && (
                  <p className="text-[11px] text-rose-800 dark:text-rose-300 mt-1 whitespace-pre-line leading-relaxed">
                    {validation.forbiddenReason}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Early wake-up warning */}
          {!validation.isForbidden && isEarlierThanWakeUp && (
            <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-3 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-amber-950">Время начала раньше подъема ({wakeUpTarget})</div>
                <p className="text-[11px] text-amber-800 mt-0.5 leading-snug">
                  Подъем всегда закреплен первым в расписании дня. Чтобы сохранить естественный ритм, рекомендуем ставить новые дела после времени подъема.
                </p>
              </div>
            </div>
          )}

          {/* SMART CONFLICT & CASCADING SECTION */}
          {placementAnalysis.hasConflict && (
            <div className="space-y-3">
              {/* UNIFIED CONFLICT RESOLUTION: "спрашивать куда передвинуть те которые уже были" */}
              {placementAnalysis.overlappingTasks.length > 0 ? (
                <div className="bg-gradient-to-br from-indigo-50/90 via-purple-50/80 to-sky-50/80 border-2 border-indigo-200/80 rounded-3xl p-4 space-y-3 shadow-xs animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                        Куда передвинуть уже стоявшие дела?
                      </h4>
                      <p className="text-[11px] text-indigo-800 font-medium">
                        На {startTime}–{endTime} уже стояли:{' '}
                        <span className="font-bold">
                          {placementAnalysis.overlappingTasks.map((t) => `«${t.title}»`).join(', ')}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 pt-1">
                    {/* OPTION: SHIFT LATER */}
                    <button
                      type="button"
                      onClick={() => setConflictResolution('shift_later')}
                      className={`p-3 rounded-2xl text-xs font-semibold text-left transition-all border-2 cursor-pointer flex items-center justify-between gap-3 ${
                        conflictResolution === 'shift_later'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm scale-[1.01]'
                          : 'bg-white text-slate-800 border-indigo-100 hover:border-indigo-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-extrabold flex items-center gap-1.5">
                          <span>➡️ Сдвинуть на позже</span>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md font-bold ${
                              conflictResolution === 'shift_later'
                                ? 'bg-white/20 text-white'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            с {placementAnalysis.laterSlotStartTime || endTime}
                          </span>
                        </div>
                        <p
                          className={`text-[11px] mt-0.5 truncate ${
                            conflictResolution === 'shift_later' ? 'text-indigo-100' : 'text-slate-500'
                          }`}
                        >
                          Поставить сразу после новых планов (вечерние дела аккуратно сдвинутся)
                        </p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          conflictResolution === 'shift_later'
                            ? 'border-white bg-white text-indigo-600'
                            : 'border-slate-300'
                        }`}
                      >
                        {conflictResolution === 'shift_later' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </button>

                    {/* OPTION: SHIFT EARLIER */}
                    {placementAnalysis.canShiftEarlier && (
                      <button
                        type="button"
                        onClick={() => setConflictResolution('shift_earlier')}
                        className={`p-3 rounded-2xl text-xs font-semibold text-left transition-all border-2 cursor-pointer flex items-center justify-between gap-3 ${
                          conflictResolution === 'shift_earlier'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm scale-[1.01]'
                            : 'bg-white text-slate-800 border-indigo-100 hover:border-indigo-300'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-extrabold flex items-center gap-1.5">
                            <span>⬅️ Сдвинуть на раньше</span>
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md font-bold ${
                                conflictResolution === 'shift_earlier'
                                  ? 'bg-white/20 text-white'
                                  : 'bg-indigo-100 text-indigo-800'
                              }`}
                            >
                              на {placementAnalysis.earlierSlotStartTime || startTime}
                            </span>
                          </div>
                          <p
                            className={`text-[11px] mt-0.5 truncate ${
                              conflictResolution === 'shift_earlier' ? 'text-indigo-100' : 'text-slate-500'
                            }`}
                          >
                            Поставить перед новыми планами (за счет свободного времени)
                          </p>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            conflictResolution === 'shift_earlier'
                              ? 'border-white bg-white text-indigo-600'
                              : 'border-slate-300'
                          }`}
                        >
                          {conflictResolution === 'shift_earlier' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </button>
                    )}

                    {/* OPTION: MOVE TO NEXT DAY */}
                    <button
                      type="button"
                      onClick={() => setConflictResolution('move_to_next_day')}
                      className={`p-3 rounded-2xl text-xs font-semibold text-left transition-all border-2 cursor-pointer flex items-center justify-between gap-3 ${
                        conflictResolution === 'move_to_next_day'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm scale-[1.01]'
                          : 'bg-white text-slate-800 border-indigo-100 hover:border-indigo-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-extrabold flex items-center gap-1.5">
                          <span>📅 Перенести на {placementAnalysis.nextDayName}</span>
                        </div>
                        <p
                          className={`text-[11px] mt-0.5 truncate ${
                            conflictResolution === 'move_to_next_day' ? 'text-indigo-100' : 'text-slate-500'
                          }`}
                        >
                          Освободить сегодня время и перенести на {placementAnalysis.nextDayName}
                        </p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          conflictResolution === 'move_to_next_day'
                            ? 'border-white bg-white text-indigo-600'
                            : 'border-slate-300'
                        }`}
                      >
                        {conflictResolution === 'move_to_next_day' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </button>

                    {/* OPTION: EVENING (IF APPLICABLE) */}
                    {placementAnalysis.canMoveToEvening && (
                      <button
                        type="button"
                        onClick={() => setConflictResolution('move_to_evening')}
                        className={`p-3 rounded-2xl text-xs font-semibold text-left transition-all border-2 cursor-pointer flex items-center justify-between gap-3 ${
                          conflictResolution === 'move_to_evening'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm scale-[1.01]'
                            : 'bg-white text-slate-800 border-indigo-100 hover:border-indigo-300'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-extrabold flex items-center gap-1.5">
                            <span>🌙 Перенести на вечер после пар</span>
                          </div>
                          <p
                            className={`text-[11px] mt-0.5 truncate ${
                              conflictResolution === 'move_to_evening' ? 'text-indigo-100' : 'text-slate-500'
                            }`}
                          >
                            Поставить в вечерний свободный интервал
                          </p>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            conflictResolution === 'move_to_evening'
                              ? 'border-white bg-white text-indigo-600'
                              : 'border-slate-300'
                          }`}
                        >
                          {conflictResolution === 'move_to_evening' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* Non-overlapping subsequent task cascading */
                <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3.5 space-y-2 animate-fadeIn">
                  <div className="flex items-center gap-2 text-xs font-bold text-sky-900">
                    <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>Сдвиг последующих дел</span>
                  </div>
                  <p className="text-xs text-sky-800 leading-relaxed font-medium">
                    {placementAnalysis.recommendationMessage}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setConflictResolution('cascade_same_day')}
                      className={`p-2.5 rounded-xl text-xs font-semibold text-left transition border cursor-pointer ${
                        conflictResolution === 'cascade_same_day'
                          ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                          : 'bg-white text-slate-700 border-sky-200 hover:bg-sky-100/50'
                      }`}
                    >
                      <div className="font-bold">Сдвинуть цепочкой</div>
                      <div className="text-[10px] opacity-90">
                        Все последующие дела сдвинутся автоматически
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConflictResolution('move_to_next_day')}
                      className={`p-2.5 rounded-xl text-xs font-semibold text-left transition border cursor-pointer ${
                        conflictResolution === 'move_to_next_day'
                          ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                          : 'bg-white text-slate-700 border-sky-200 hover:bg-sky-100/50'
                      }`}
                    >
                      <div className="font-bold">На {placementAnalysis.nextDayName}</div>
                      <div className="text-[10px] opacity-90">
                        Перенести дела на следующий день
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* COMPREHENSIVE CHAIN OF ALL AFFECTED TASKS */}
          {affectedTasksChain.length > 0 && (
            <div className="bg-gradient-to-br from-indigo-50/90 via-slate-50 to-sky-50/70 border-2 border-indigo-200/80 rounded-3xl p-4 space-y-3.5 shadow-xs animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                      Все дела, на которые влияет сдвиг ({affectedTasksChain.length})
                    </h4>
                    <p className="text-[11px] text-indigo-800 font-medium">
                      Можно выбрать точное время для любого дела или удалить его:
                    </p>
                  </div>
                </div>
                {(Object.keys(customTimes).length > 0 || deletedTaskIds.length > 0 || Object.keys(movedToDays).length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomTimes({});
                      setDeletedTaskIds([]);
                      setMovedToDays({});
                      setOpenDayPickerForId(null);
                    }}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer bg-white px-2 py-1 rounded-lg border border-indigo-200 shadow-xs"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Сбросить всё</span>
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {affectedTasksChain.map((item) => {
                  const isDeleted = deletedTaskIds.includes(item.id);
                  const destDay = movedToDays[item.id];
                  const isMovedToOtherDay = Boolean(destDay);
                  const hasCustom = Boolean(customTimes[item.id]);
                  const curStart = customTimes[item.id]?.startTime ?? item.proposedStartTime;
                  const curEnd = customTimes[item.id]?.endTime ?? item.proposedEndTime;
                  const catInfo = item.category ? CATEGORY_INFO[item.category as TaskCategory] : undefined;

                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl p-3 border transition-all ${
                        isDeleted
                          ? 'bg-rose-50/70 border-rose-200 opacity-75'
                          : isMovedToOtherDay
                          ? 'bg-purple-50/80 border-purple-300 shadow-xs'
                          : hasCustom
                          ? 'bg-indigo-50/80 border-indigo-300 shadow-xs'
                          : 'bg-white border-slate-200/80 shadow-xs'
                      }`}
                    >
                      {/* Task info header */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm shrink-0">{catInfo?.emoji || '📌'}</span>
                          <span
                            className={`text-xs font-bold break-words leading-tight ${
                              isDeleted ? 'line-through text-slate-400' : 'text-slate-800'
                            }`}
                          >
                            {item.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                          {item.overlapWithTitle ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 break-words leading-tight max-w-full">
                              Накладка с «{item.overlapWithTitle}»
                            </span>
                          ) : item.isDirectOverlap ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                              Накладка
                            </span>
                          ) : null}
                          {item.shiftDeltaMinutes !== 0 && !item.isDirectOverlap && !item.overlapWithTitle && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-sky-100 text-sky-800 border border-sky-200 shrink-0">
                              {item.shiftDeltaMinutes > 0
                                ? `+${item.shiftDeltaMinutes} мин`
                                : `${item.shiftDeltaMinutes} мин`}
                            </span>
                          )}
                          {item.movedToEvening && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200 shrink-0">
                              Вечер
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Controls row */}
                      <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-2">
                        {isDeleted ? (
                          <div className="flex items-center justify-between w-full flex-wrap gap-2">
                            <span className="text-[11px] font-bold text-rose-700 flex items-center gap-1 min-w-0 break-words leading-tight">
                              <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                              Будет удалено из расписания на этот день
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleDeleteAffected(item.id)}
                              className="px-2.5 py-1 text-[11px] font-bold bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-xs shrink-0"
                            >
                              <RotateCcw className="w-3 h-3" /> Восстановить
                            </button>
                          </div>
                        ) : isMovedToOtherDay && destDay ? (
                          <div className="flex items-center justify-between w-full bg-purple-50/90 border border-purple-200 rounded-xl p-2 transition flex-wrap gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0">
                                <Calendar className="w-3 h-3" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-purple-950 block break-words leading-tight">
                                  Перенос на {DAYS_INFO[destDay].name} ({DAYS_INFO[destDay].shortName})
                                </span>
                                <span className="text-[10px] text-purple-700 block break-words leading-tight">
                                  Снимется с текущего дня и добавится на {DAYS_INFO[destDay].name.toLowerCase()}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCancelMoveToDay(item.id)}
                              className="px-2.5 py-1 text-[11px] font-bold text-purple-700 bg-white hover:bg-purple-100 border border-purple-200 rounded-lg transition cursor-pointer shrink-0 shadow-2xs self-center"
                            >
                              Отменить
                            </button>
                          </div>
                        ) : item.isTutoringBlock || isTutoringTask(item.task) ? (
                          <div className="flex items-center justify-between w-full bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex-wrap gap-2">
                            <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                              🔒 Время урока зафиксировано: {item.originalStartTime}–{item.originalEndTime}
                            </span>
                            <span className="text-[10px] text-amber-800 font-medium">
                              Не сдвигается автоматически
                            </span>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-slate-500 font-medium">
                                  Было <span className="font-mono text-slate-400 line-through">{item.originalStartTime}</span>:
                                </span>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="time"
                                    value={curStart}
                                    onChange={(e) =>
                                      handleAffectedTimeChange(item.id, e.target.value, item.durationMinutes)
                                    }
                                    className="px-2 py-0.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:outline-none"
                                  />
                                  <span className="text-xs text-slate-400 font-bold">–</span>
                                  <input
                                    type="time"
                                    value={curEnd}
                                    onChange={(e) =>
                                      handleAffectedEndTimeChange(item.id, e.target.value, item.proposedStartTime)
                                    }
                                    className="px-2 py-0.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:outline-none"
                                  />
                                </div>
                                {hasCustom && (
                                  <button
                                    type="button"
                                    onClick={() => handleResetAffectedTime(item.id)}
                                    title="Сбросить к авто"
                                    className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg transition cursor-pointer"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                  </button>
                                )}
                              </div>

                              <div className="flex items-center gap-1">
                                {!item.isUniversityBlock && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOpenDayPickerForId(openDayPickerForId === item.id ? null : item.id)
                                      }
                                      className={`px-2 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1 border ${
                                        openDayPickerForId === item.id
                                          ? 'bg-purple-600 text-white border-purple-600'
                                          : 'text-purple-700 bg-purple-50 hover:bg-purple-100 border-purple-200'
                                      }`}
                                    >
                                      <Calendar className="w-3 h-3" />
                                      <span>На другой день</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleToggleDeleteAffected(item.id)}
                                      className="px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer flex items-center gap-1"
                                    >
                                      <Trash2 className="w-3 h-3 text-rose-500" />
                                      <span>Удалить</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Dropdown/row for choosing day to transfer */}
                            {openDayPickerForId === item.id && (
                              <div className="w-full pt-2 border-t border-purple-100 p-2 bg-purple-50/70 rounded-xl space-y-1.5 animate-fadeIn">
                                <div className="flex items-center justify-between text-[11px] font-bold text-purple-950">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-purple-600" />
                                    Перенести «{item.title}» на:
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setOpenDayPickerForId(null)}
                                    className="text-[10px] text-purple-600 hover:text-purple-900 font-bold cursor-pointer"
                                  >
                                    ✕ Закрыть
                                  </button>
                                </div>
                                <div className="grid grid-cols-6 gap-1">
                                  {daysList
                                    .filter((d) => d !== activeDay)
                                    .map((d) => {
                                      const isNext = d === NEXT_DAY_MAP[activeDay];
                                      return (
                                        <button
                                          key={d}
                                          type="button"
                                          onClick={() => handleMoveToDay(item.id, d)}
                                          className={`py-1 px-1 rounded-lg text-center text-xs font-bold border transition cursor-pointer ${
                                            isNext
                                              ? 'bg-purple-600 text-white border-purple-600 shadow-2xs hover:bg-purple-700'
                                              : 'bg-white text-purple-900 border-purple-200 hover:bg-purple-100'
                                          }`}
                                        >
                                          <div>{DAYS_INFO[d].shortName}</div>
                                          {isNext && (
                                            <div className="text-[9px] font-normal opacity-90 leading-none">
                                              Завтра
                                            </div>
                                          )}
                                        </button>
                                      );
                                    })}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Auto-cascade toggle */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-start gap-2.5">
            <input
              type="checkbox"
              id="cascade"
              checked={cascadeShift}
              onChange={(e) => setCascadeShift(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-sky-600 accent-sky-600 cursor-pointer"
            />
            <label htmlFor="cascade" className="text-xs text-slate-700 cursor-pointer">
              <span className="font-bold block text-slate-800">Авто-сдвиг всех последующих дел</span>
              <span className="text-[11px] text-slate-500">
                Все последующие дела по цепочке переместятся вперед, предотвращая накладки по времени.
              </span>
            </label>
          </div>



          {/* Days selector */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
              Дни недели
            </label>
            <div className="flex gap-1 justify-between">
              {daysList.map((d) => {
                const isSelected = selectedDays.includes(d);
                return (
                  <button
                    type="button"
                    key={d}
                    onClick={() => toggleDay(d)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? 'bg-rose-500 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {DAYS_INFO[d].shortName}
                  </button>
                );
              })}
            </div>
          </div>

          </div>

          {/* Fixed Footer: All action buttons ALWAYS visible on screen without scrolling, generous space & zero clipping */}
          <div
            className="shrink-0 pt-3.5 px-4 sm:px-6 border-t border-slate-100 dark:border-zinc-800 bg-white/95 dark:bg-[#1a1a1e]/95 backdrop-blur-md flex flex-col gap-2.5"
            style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem))' }}
          >
            {/* Secondary actions row if editing an existing task */}
            {task && (onDelete || (!isUniversityBlock(tempMovingTask) && onMoveToSecondary)) && (
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800/70">
                {onDelete ? (
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(task.id);
                      onClose();
                    }}
                    title="Удалить дело из расписания на этот день"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition cursor-pointer active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{isUniversityBlock(tempMovingTask) ? 'Удалить пары на этот день' : 'Удалить дело'}</span>
                  </button>
                ) : <div />}

                {onMoveToSecondary && !isUniversityBlock(tempMovingTask) && (
                  <button
                    type="button"
                    onClick={() => {
                      onMoveToSecondary(task.id);
                      onClose();
                    }}
                    title="Убрать во второстепенные дела"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition cursor-pointer active:scale-95"
                  >
                    <Moon className="w-3.5 h-3.5 shrink-0" />
                    <span>В резервные</span>
                  </button>
                )}
              </div>
            )}

            {/* Primary Action Buttons: Отмена and Сохранить / Добавить */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-sm font-bold transition cursor-pointer flex items-center justify-center active:scale-[0.98]"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={validation.isForbidden}
                className={`flex-[1.4] h-12 rounded-2xl text-sm font-bold shadow-md hover:scale-[1.01] active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer px-4 ${
                  validation.isForbidden
                    ? 'bg-rose-400 text-white cursor-not-allowed opacity-80 shadow-none'
                    : 'bg-slate-900 dark:bg-rose-600 hover:bg-slate-800 dark:hover:bg-rose-700 text-white shadow-slate-900/10 dark:shadow-rose-950/30'
                }`}
              >
                <Check className="w-4 h-4 shrink-0 stroke-[2.5]" />
                <span className="truncate">
                  {validation.isForbidden
                    ? 'Сдвиг пар запрещен'
                    : task
                    ? 'Сохранить'
                    : 'Добавить'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
