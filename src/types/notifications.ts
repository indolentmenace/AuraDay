export interface AppNotification {
  id: string;
  title: string;
  body: string;
  icon?: string;
  timestamp: number;
  type: 'task_start' | 'task_upcoming' | 'streak_warning' | 'abs_timer' | 'wakeup' | 'system';
  taskId?: string;
  habitId?: string;
  read?: boolean;
}

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';
