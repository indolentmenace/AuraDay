import { AppNotification, NotificationPermissionState } from '../types/notifications';
import { sounds } from './audio';

const STORAGE_KEY_NOTIFICATIONS = 'auraday_notifications_history_v1';

export interface ScheduledReminder {
  id: string;
  title: string;
  body: string;
  triggerAt: number; // epoch timestamp in ms
  tag?: string;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return reg;
  } catch (err) {
    console.error('Service worker registration failed:', err);
    return null;
  }
}

export function getNotificationPermissionStatus(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as NotificationPermissionState;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  // Register service worker when permission is requested
  if ('serviceWorker' in navigator) {
    registerServiceWorker();
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch {
      return false;
    }
  }
  return false;
}

export async function showSystemNotification(title: string, body: string, icon = '✨'): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  const fullTitle = `${icon} ${title}`;
  const options = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    silent: false,
    data: { url: '/' },
  };

  // 1. Prefer ServiceWorkerRegistration.showNotification (Works on lock screen, closed tab, Android & Desktop)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(fullTitle, options);
        return true;
      }
    } catch (err) {
      console.warn('SW showNotification fallback:', err);
    }
  }

  // 2. Fallback to standard Notification constructor
  try {
    new Notification(fullTitle, options);
    return true;
  } catch {
    return false;
  }
}

export async function syncBackgroundReminders(reminders: ScheduledReminder[]): Promise<void> {
  if (typeof window === 'undefined') return;

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg.active) {
        reg.active.postMessage({
          type: 'SCHEDULE_REMINDERS',
          reminders,
        });
      }
    } catch (err) {
      console.warn('Could not post reminders to SW:', err);
    }
  }
}

// In-App Notification Subscribers
type InAppNotificationListener = (notif: AppNotification) => void;
const listeners = new Set<InAppNotificationListener>();

export function subscribeToInAppNotifications(listener: InAppNotificationListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function dispatchInAppNotification(notif: AppNotification) {
  listeners.forEach((l) => {
    try {
      l(notif);
    } catch (e) {
      console.error(e);
    }
  });
}

// Notification History
export function getNotificationHistory(): AppNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addNotificationToHistory(notif: AppNotification): AppNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const current = getNotificationHistory();
    const updated = [notif, ...current].slice(0, 50); // Keep last 50
    localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function clearNotificationHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_NOTIFICATIONS);
  } catch {
    // ignore
  }
}

export interface DispatchNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  type?: AppNotification['type'];
  taskId?: string;
  habitId?: string;
  playSound?: boolean;
}

export function sendAppNotification({
  title,
  body,
  icon = '🔔',
  type = 'system',
  taskId,
  habitId,
  playSound = true,
}: DispatchNotificationOptions): AppNotification {
  const notif: AppNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title,
    body,
    icon,
    timestamp: Date.now(),
    type,
    taskId,
    habitId,
    read: false,
  };

  // 1. Play sound
  if (playSound) {
    sounds.playBell(true);
  }

  // 2. Browser native push notification
  showSystemNotification(title, body, icon);

  // 3. Dispatch to In-App Toast & HUD
  dispatchInAppNotification(notif);

  // 4. Save to history
  addNotificationToHistory(notif);

  return notif;
}
