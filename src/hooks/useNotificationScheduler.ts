import { useEffect, useRef } from 'react';
import { ScheduleTask, UserScheduleConfig, HabitStreak, DayOfWeek } from '../types/schedule';
import { sendAppNotification, syncBackgroundReminders, ScheduledReminder } from '../utils/notifications';
import { timeToMinutes } from '../utils/scheduleEngine';
import { getTodayInfo, formatDateKey } from '../utils/habitStreakEngine';

interface NotificationSchedulerProps {
  tasks: ScheduleTask[];
  habits: HabitStreak[];
  config: UserScheduleConfig;
  selectedDay?: DayOfWeek;
  isTaskCompletedForDay: (task: ScheduleTask, day: DayOfWeek) => boolean;
}

export function useNotificationScheduler({
  tasks,
  habits,
  config,
  isTaskCompletedForDay,
}: NotificationSchedulerProps) {
  // Store sent notification IDs for today to prevent duplicates across reloads & intervals
  const sentNotifsRef = useRef<Set<string>>(new Set<string>());

  useEffect(() => {
    if (!config.notificationsEnabled) {
      // Clear background reminders if notifications disabled
      syncBackgroundReminders([]);
      return;
    }

    const today = getTodayInfo();
    const todayStr = today.dateStr;
    const storageKey = `auraday_sent_notifs_${todayStr}`;

    // Load today's sent notifications from localStorage
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        sentNotifsRef.current = new Set(JSON.parse(saved));
      }
    } catch {
      // ignore
    }

    const saveSentKeys = () => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(sentNotifsRef.current)));
      } catch {
        // ignore
      }
    };

    // Sync future reminders to background Service Worker for lock screen & closed tab triggers (Today + Tomorrow)
    const syncRemindersToServiceWorker = () => {
      try {
        const now = new Date();
        const currentEpoch = now.getTime();
        const todayDayKey = today.dayKey;

        const [year, month, dayNum] = todayStr.split('-').map(Number);
        const reminders: ScheduledReminder[] = [];

        // 1. Today's remaining tasks
        const todayTasks = tasks.filter((t) => t.days.includes(todayDayKey));

        todayTasks.forEach((task) => {
          const isDone = isTaskCompletedForDay(task, todayDayKey);
          if (isDone) return;

          const startMinutes = timeToMinutes(task.startTime);
          const sh = Math.floor(startMinutes / 60);
          const sm = startMinutes % 60;

          const taskStartDate = new Date(year, month - 1, dayNum, sh, sm, 0, 0);
          const taskStartEpoch = taskStartDate.getTime();
          const fifteenBeforeEpoch = taskStartEpoch - 15 * 60 * 1000;

          if (config.notifyTaskUpcoming !== false && fifteenBeforeEpoch > currentEpoch) {
            reminders.push({
              id: `upcoming_${task.id}_${todayStr}`,
              title: `⏰ Через 15 минут: ${task.title}`,
              body: `Начало в ${task.startTime}. Длительность: ${task.durationMinutes} мин.`,
              triggerAt: fifteenBeforeEpoch,
              tag: `upcoming_${task.id}`,
            });
          }

          if (config.notifyTaskStart !== false && taskStartEpoch > currentEpoch) {
            reminders.push({
              id: `start_${task.id}_${todayStr}`,
              title: `🎯 Пора начинать: ${task.title}`,
              body: task.subtitle || `Запланировано на ${task.startTime} – ${task.endTime}`,
              triggerAt: taskStartEpoch,
              tag: `start_${task.id}`,
            });
          }
        });

        // 2. Tomorrow's tasks (so morning reminders fire even if tab was closed overnight)
        const tomorrowDate = new Date(now);
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const dayKeys: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const tomorrowDayKey = dayKeys[tomorrowDate.getDay()];
        const tomorrowStr = formatDateKey(tomorrowDate);
        const [tYear, tMonth, tDayNum] = tomorrowStr.split('-').map(Number);

        const tomorrowTasks = tasks.filter((t) => t.days.includes(tomorrowDayKey));

        tomorrowTasks.forEach((task) => {
          const startMinutes = timeToMinutes(task.startTime);
          const sh = Math.floor(startMinutes / 60);
          const sm = startMinutes % 60;

          const taskStartDate = new Date(tYear, tMonth - 1, tDayNum, sh, sm, 0, 0);
          const taskStartEpoch = taskStartDate.getTime();
          const fifteenBeforeEpoch = taskStartEpoch - 15 * 60 * 1000;

          if (config.notifyTaskUpcoming !== false && fifteenBeforeEpoch > currentEpoch) {
            reminders.push({
              id: `upcoming_${task.id}_${tomorrowStr}`,
              title: `⏰ Через 15 минут: ${task.title}`,
              body: `Начало в ${task.startTime}. Длительность: ${task.durationMinutes} мин.`,
              triggerAt: fifteenBeforeEpoch,
              tag: `upcoming_${task.id}`,
            });
          }

          if (config.notifyTaskStart !== false && taskStartEpoch > currentEpoch) {
            reminders.push({
              id: `start_${task.id}_${tomorrowStr}`,
              title: `🎯 Пора начинать: ${task.title}`,
              body: task.subtitle || `Запланировано на ${task.startTime} – ${task.endTime}`,
              triggerAt: taskStartEpoch,
              tag: `start_${task.id}`,
            });
          }
        });

        // 3. 21:00 Evening streak warning for today
        if (config.notifyStreakWarning !== false) {
          const streakDate = new Date(year, month - 1, dayNum, 21, 0, 0, 0);
          const streakEpoch = streakDate.getTime();
          if (streakEpoch > currentEpoch) {
            const atRiskHabits = habits.filter((h) => !h.isFrozen && h.lastCompletedDate !== todayStr);
            if (atRiskHabits.length > 0) {
              reminders.push({
                id: `streak_warn_${todayStr}`,
                title: `🔥 Стрики под угрозой сгорания!`,
                body: `Осталось 3 часа до полуночи! Не забудь отметить ${atRiskHabits.length} привычек или заморозить их ❄️`,
                triggerAt: streakEpoch,
                tag: `streak_warn_${todayStr}`,
              });
            }
          }
        }

        syncBackgroundReminders(reminders);
      } catch (err) {
        console.error('Failed to prepare background reminders:', err);
      }
    };

    const checkScheduleAndNotify = () => {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutesNum = now.getMinutes();
      const currentTotalMinutes = currentHours * 60 + currentMinutesNum;
      const todayDayKey = today.dayKey;

      const sent = sentNotifsRef.current;
      let hasNewSent = false;

      // 1. Task Reminders for today's tasks
      const todayTasks = tasks.filter((t) => t.days.includes(todayDayKey));

      todayTasks.forEach((task) => {
        const isDone = isTaskCompletedForDay(task, todayDayKey);
        if (isDone) return;

        const startMinutes = timeToMinutes(task.startTime);
        const diffMinutes = startMinutes - currentTotalMinutes;

        // Window for 15-Minute Alert:
        // Delivers when current time is within 15 minutes before start (1 to 15 min window)
        if (config.notifyTaskUpcoming !== false && diffMinutes <= 15 && diffMinutes >= 1) {
          const key = `task_upcoming_${task.id}_${todayStr}`;
          if (!sent.has(key)) {
            sent.add(key);
            hasNewSent = true;
            sendAppNotification({
              title: `Через ${diffMinutes > 1 ? diffMinutes + ' мин' : '1 минуту'}: ${task.title}`,
              body: `Начало в ${task.startTime}. Длительность: ${task.durationMinutes} мин.`,
              icon: '⏰',
              type: 'task_upcoming',
              taskId: task.id,
              playSound: config.soundEnabled,
            });
          }
        }

        // Window for Start-Time Alert:
        // Delivers when task start time arrives or within the first 20 minutes of start
        if (config.notifyTaskStart !== false && diffMinutes <= 0 && diffMinutes >= -20) {
          const key = `task_start_${task.id}_${todayStr}`;
          if (!sent.has(key)) {
            sent.add(key);
            hasNewSent = true;
            sendAppNotification({
              title: `Пора начинать: ${task.title}`,
              body: task.subtitle || `Время: ${task.startTime} – ${task.endTime}`,
              icon: '🎯',
              type: 'task_start',
              taskId: task.id,
              playSound: config.soundEnabled,
            });
          }
        }
      });

      // 2. Evening Streak Protection Warning (21:00 – 21:30 window)
      if (
        config.notifyStreakWarning !== false &&
        currentHours === 21 &&
        currentMinutesNum >= 0 &&
        currentMinutesNum <= 30
      ) {
        const key = `streak_warn_${todayStr}`;
        if (!sent.has(key)) {
          const atRiskHabits = habits.filter((h) => !h.isFrozen && h.lastCompletedDate !== todayStr);
          if (atRiskHabits.length > 0) {
            sent.add(key);
            hasNewSent = true;
            const count = atRiskHabits.length;
            sendAppNotification({
              title: `Стрики под угрозой сгорания! 🔥`,
              body: `Осталось 3 часа до полуночи! Не забудь отметить ${count} привычек или заморозить их ❄️`,
              icon: '🔥',
              type: 'streak_warning',
              playSound: config.soundEnabled,
            });
          }
        }
      }

      if (hasNewSent) {
        saveSentKeys();
      }
    };

    // Initial check & initial sync to Service Worker
    checkScheduleAndNotify();
    syncRemindersToServiceWorker();

    // Check periodically in foreground (every 10 seconds)
    const interval = setInterval(checkScheduleAndNotify, 10000);

    // Update Service Worker background queue on visibility/page state changes (screen lock, minimizing, closing)
    const handleVisibilityChange = () => {
      checkScheduleAndNotify();
      syncRemindersToServiceWorker();
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleVisibilityChange);
    window.addEventListener('beforeunload', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleVisibilityChange);
    };
  }, [tasks, habits, config, isTaskCompletedForDay]);
}
