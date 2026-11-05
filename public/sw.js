// AuraDay Background Service Worker
// Enables notifications when the browser tab is closed and when the screen is locked

const CACHE_NAME = 'auraday-v1';
const DB_NAME = 'auraday_sw_db';
const STORE_NAME = 'reminders';

// Active in-memory timers
let activeTimers = new Map();

// Helper: Open IndexedDB in Service Worker
function openRemindersDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveRemindersToDB(reminders) {
  try {
    const db = await openRemindersDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    // Clear old reminders
    store.clear();
    reminders.forEach((r) => store.put(r));
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (err) {
    console.error('Failed to save reminders in SW DB:', err);
  }
}

async function getRemindersFromDB() {
  try {
    const db = await openRemindersDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

async function removeReminderFromDB(id) {
  try {
    const db = await openRemindersDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
  } catch {
    // ignore
  }
}

// Display native system / lock screen notification
async function triggerNotification(item) {
  if (!item || !item.title) return;

  try {
    await self.registration.showNotification(item.title, {
      body: item.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: item.tag || `auraday-${item.id}`,
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200],
      silent: false,
      data: {
        url: '/',
        id: item.id,
        timestamp: Date.now(),
      },
    });

    await removeReminderFromDB(item.id);
  } catch (err) {
    console.error('Failed to show SW notification:', err);
  }
}

// Schedule timers for all pending reminders
function scheduleTimers(reminders) {
  // Clear existing timers
  for (const [, timerId] of activeTimers) {
    clearTimeout(timerId);
  }
  activeTimers.clear();

  const now = Date.now();

  reminders.forEach((r) => {
    const delay = r.triggerAt - now;

    // Trigger immediately if due in the last 15 minutes (or currently due)
    if (delay <= 0 && delay > -15 * 60 * 1000) {
      triggerNotification(r);
    } else if (delay > 0) {
      // If browser supports Notification Triggers API (Chromium/Android), register with OS
      if (typeof TimestampTrigger !== 'undefined' && 'showTrigger' in Notification.prototype) {
        try {
          self.registration.showNotification(r.title, {
            body: r.body || '',
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            tag: r.tag || `auraday-${r.id}`,
            renotify: true,
            requireInteraction: true,
            vibrate: [200, 100, 200],
            silent: false,
            showTrigger: new TimestampTrigger(r.triggerAt),
            data: { url: '/', id: r.id, timestamp: r.triggerAt },
          });
        } catch {
          // fallback to setTimeout
        }
      }

      // Fallback timer inside SW
      const timerId = setTimeout(() => {
        triggerNotification(r);
        activeTimers.delete(r.id);
      }, delay);
      activeTimers.set(r.id, timerId);
    }
  });
}

// Background check routine (handles device unlock, tab reactivation, or periodic sync)
async function checkPendingReminders() {
  const reminders = await getRemindersFromDB();
  const now = Date.now();
  for (const r of reminders) {
    // Deliver reminder if it became due in the last 25 minutes
    if (r.triggerAt <= now && now - r.triggerAt < 25 * 60 * 1000) {
      await triggerNotification(r);
    } else if (now - r.triggerAt >= 25 * 60 * 1000) {
      // Clean up stale reminders older than 25 minutes
      await removeReminderFromDB(r.id);
    }
  }
}

// Install Event
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await clients.claim();
      // Restore reminders from IndexedDB
      const stored = await getRemindersFromDB();
      if (stored && stored.length > 0) {
        scheduleTimers(stored);
      }
    })()
  );
});

// Message listener from React client
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === 'SCHEDULE_REMINDERS' && Array.isArray(data.reminders)) {
    saveRemindersToDB(data.reminders).then(() => {
      scheduleTimers(data.reminders);
    });
  }

  if (data.type === 'SHOW_NOTIFICATION' && data.payload) {
    triggerNotification(data.payload);
  }
});

// Periodic Sync (supported in Chromium/Android)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-reminders') {
    event.waitUntil(checkPendingReminders());
  }
});

// Sync Event (Background Sync)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reminders') {
    event.waitUntil(checkPendingReminders());
  }
});

// Notification Click Event (opens or focuses app when tapped on lock screen or drawer)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Periodic timer tick inside Service Worker
setInterval(checkPendingReminders, 30000);
