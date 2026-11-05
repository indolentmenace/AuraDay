import { DayOfWeek } from '../types/schedule';

export interface DayDateInfo {
  date: Date;
  dayOfMonth: number;
  monthName: string;
  formattedDate: string; // e.g. "15 октября"
  shortDate: string; // e.g. "15 окт"
  dateKey: string; // "2026-10-15"
}

export interface WeekInfo {
  weekOffset: number; // 0 = current week, -1 = last week, etc.
  mondayDate: Date;
  sundayDate: Date;
  weekId: string; // e.g. "2026-W42"
  formattedRange: string; // e.g. "12 – 18 октября"
  title: string; // e.g. "Текущая неделя", "Прошлая неделя"
  isCurrentWeek: boolean;
  dayDates: Record<DayOfWeek, DayDateInfo>;
}

export function getISOWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function getMondayOfWeek(weekOffset = 0, baseDate = new Date()): Date {
  const d = new Date(baseDate);
  const day = d.getDay(); // 0 is Sun, 1 is Mon, 2 is Tue...
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

const MONTH_NAMES_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

const MONTH_NAMES_SHORT = [
  'янв',
  'фев',
  'мар',
  'апр',
  'мая',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
];

export function getWeekInfo(weekOffset = 0, baseDate = new Date()): WeekInfo {
  const monday = getMondayOfWeek(weekOffset, baseDate);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const monDay = monday.getDate();
  const sunDay = sunday.getDate();
  const monMonth = MONTH_NAMES_GENITIVE[monday.getMonth()];
  const sunMonth = MONTH_NAMES_GENITIVE[sunday.getMonth()];

  let formattedRange = '';
  if (monday.getMonth() === sunday.getMonth()) {
    formattedRange = `${monDay} – ${sunDay} ${monMonth}`;
  } else {
    formattedRange = `${monDay} ${monMonth} – ${sunDay} ${sunMonth}`;
  }

  let title = '';
  if (weekOffset === 0) {
    title = 'Текущая неделя';
  } else if (weekOffset === -1) {
    title = 'Прошлая неделя';
  } else if (weekOffset === -2) {
    title = '2 недели назад';
  } else if (weekOffset === -3) {
    title = '3 недели назад';
  } else if (weekOffset === -4) {
    title = '4 недели назад';
  } else if (weekOffset < -4) {
    title = `${Math.abs(weekOffset)} недель назад`;
  } else if (weekOffset === 1) {
    title = 'Следующая неделя';
  } else {
    title = `Через ${weekOffset} нед.`;
  }

  const weekNum = getISOWeekNumber(monday);
  const weekId = `${monday.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;

  const dayKeys: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const dayDates = {} as Record<DayOfWeek, DayDateInfo>;

  dayKeys.forEach((key, index) => {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + index);

    const year = cur.getFullYear();
    const month = (cur.getMonth() + 1).toString().padStart(2, '0');
    const dayStr = cur.getDate().toString().padStart(2, '0');
    const dateKey = `${year}-${month}-${dayStr}`;

    dayDates[key] = {
      date: cur,
      dayOfMonth: cur.getDate(),
      monthName: MONTH_NAMES_GENITIVE[cur.getMonth()],
      formattedDate: `${cur.getDate()} ${MONTH_NAMES_GENITIVE[cur.getMonth()]}`,
      shortDate: `${cur.getDate()} ${MONTH_NAMES_SHORT[cur.getMonth()]}`,
      dateKey,
    };
  });

  return {
    weekOffset,
    mondayDate: monday,
    sundayDate: sunday,
    weekId,
    formattedRange,
    title,
    isCurrentWeek: weekOffset === 0,
    dayDates,
  };
}
