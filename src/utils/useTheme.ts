import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'auto' | 'light' | 'dark';

export interface ThemeState {
  themeMode: ThemeMode;
  effectiveTheme: 'light' | 'dark';
  isNight: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  cycleThemeMode: () => void;
  timeDescription: string;
}

const STORAGE_KEY = 'auraday_theme_mode_v1';

/**
 * Checks if current local time is night (20:00 - 07:00).
 * Night hours: 20:00 (8 PM) through 06:59:59 (6:59 AM).
 * Day hours: 07:00 (7 AM) through 19:59:59 (7:59 PM).
 */
export function checkIsNightTime(): boolean {
  const hour = new Date().getHours();
  return hour >= 20 || hour < 7;
}

export function useTheme(): ThemeState {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'auto') {
        return saved;
      }
    } catch {
      // Fallback
    }
    return 'light';
  });

  const [isNight, setIsNight] = useState<boolean>(checkIsNightTime);

  // Periodic check of time of day (every 30 seconds) to seamlessly transition
  useEffect(() => {
    const updateNight = () => {
      setIsNight(checkIsNightTime());
    };
    updateNight();
    const interval = setInterval(updateNight, 30000);
    return () => clearInterval(interval);
  }, []);

  // Compute effective theme
  const effectiveTheme: 'light' | 'dark' =
    themeMode === 'auto' ? (isNight ? 'dark' : 'light') : themeMode;

  // Apply to document class and meta theme-color
  useEffect(() => {
    const root = document.documentElement;
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
      document.body?.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      if (metaTheme) metaTheme.setAttribute('content', '#18181b');
    } else {
      root.classList.remove('dark');
      document.body?.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      if (metaTheme) metaTheme.setAttribute('content', '#fbf8f5');
    }
  }, [effectiveTheme]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Ignore
    }
  }, []);

  const cycleThemeMode = useCallback(() => {
    setThemeModeState((prev) => {
      let next: ThemeMode = 'auto';
      if (prev === 'auto') next = 'light';
      else if (prev === 'light') next = 'dark';
      else next = 'auto';

      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  const timeDescription =
    themeMode === 'auto'
      ? isNight
        ? 'Авто: Ночь (20:00–07:00) 🌙'
        : 'Авто: День (07:00–20:00) ☀️'
      : themeMode === 'dark'
      ? 'Темная тема 🌙'
      : 'Светлая тема ☀️';

  return {
    themeMode,
    effectiveTheme,
    isNight,
    setThemeMode,
    cycleThemeMode,
    timeDescription,
  };
}
