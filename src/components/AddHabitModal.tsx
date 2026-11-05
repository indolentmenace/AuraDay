import React, { useState } from 'react';
import { TaskCategory, HabitStreak } from '../types/schedule';
import { CATEGORY_INFO } from '../data/defaultSchedule';
import { X, Plus, Sparkles, Snowflake, Flame, Clock } from 'lucide-react';

interface AddHabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (habit: Omit<HabitStreak, 'id'>) => void;
}

const PRESET_ICONS = [
  '🎯', '💧', '🏃', '🧘', '💻', '📚', '⚡', '🥑',
  '🥗', '🎨', '📝', '☕', '🏋️', '🧩', '⏰', '✨',
  '🏊', '🚴', '💊', '🍎', '💤', '🧠', '🎧', '🎸'
];

const PRESET_DURATIONS = [
  { label: '15 мин', value: 15 },
  { label: '30 мин', value: 30 },
  { label: '45 мин', value: 45 },
  { label: '1 час', value: 60 },
  { label: '1.5 часа', value: 90 },
  { label: '2 часа', value: 120 },
];

export const AddHabitModal: React.FC<AddHabitModalProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('🎯');
  const [category, setCategory] = useState<TaskCategory>('career');
  const [targetMinutes, setTargetMinutes] = useState(30);
  const [streakDays, setStreakDays] = useState(0);
  const [isFrozen, setIsFrozen] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onAdd({
      title: title.trim(),
      icon: icon.trim() || '🎯',
      category,
      targetMinutes: Math.max(5, targetMinutes),
      streakDays: Math.max(0, streakDays),
      isFrozen,
      isCustom: true,
    });

    // Reset and close
    setTitle('');
    setIcon('🎯');
    setCategory('career');
    setTargetMinutes(30);
    setStreakDays(0);
    setIsFrozen(false);
    onClose();
  };

  const categories: TaskCategory[] = [
    'career',
    'languages',
    'gym_sport',
    'abs',
    'reading',
    'routine',
    'relaxation',
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 rounded-t-[32px] sm:rounded-[32px] w-full max-w-md shadow-2xl border-t sm:border border-slate-100 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[88vh] sm:max-h-[90vh]">
        {/* iOS Pull Down Grabber Bar */}
        <div className="w-full pt-2.5 pb-1 flex justify-center sm:hidden shrink-0">
          <div className="w-10 h-1 bg-slate-300 dark:bg-zinc-600 rounded-full" />
        </div>
        {/* Header */}
        <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center shadow-xs">
              <Flame className="w-4 h-4 fill-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Новый стрик / Привычка
              </h3>
              <p className="text-[10px] text-slate-400">
                Отслеживай ежедневную серию и замораживай при необходимости
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Title input */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
              Название привычки
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: 10 000 шагов, Медитация, LeetCode..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
            />
          </div>

          {/* Emoji / Icon Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
              Иконка / Эмодзи
            </label>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl shrink-0 shadow-2xs">
                {icon}
              </div>
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="Свой эмодзи"
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-slate-50/70 border border-slate-100 rounded-2xl">
              {PRESET_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`w-8 h-8 rounded-xl text-base flex items-center justify-center transition cursor-pointer ${
                    icon === emoji
                      ? 'bg-amber-400 text-white shadow-xs scale-105'
                      : 'bg-white hover:bg-slate-100 border border-slate-200/60'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
              Категория
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {categories.map((catKey) => {
                const info = CATEGORY_INFO[catKey];
                const isSelected = category === catKey;
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setCategory(catKey)}
                    className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
                      isSelected
                        ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>{info.emoji}</span>
                    <span className="truncate">{info.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Daily Goal / Target Minutes */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider flex items-center justify-between">
              <span>Цель в день</span>
              <span className="font-mono text-amber-700 text-[11px] font-bold">
                {targetMinutes >= 60 ? `${(targetMinutes / 60).toFixed(1)} ч` : `${targetMinutes} мин`}
              </span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {PRESET_DURATIONS.map((dur) => (
                <button
                  key={dur.value}
                  type="button"
                  onClick={() => setTargetMinutes(dur.value)}
                  className={`py-2 px-2 text-xs font-bold rounded-xl border transition cursor-pointer text-center ${
                    targetMinutes === dur.value
                      ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {dur.label}
                </button>
              ))}
            </div>
          </div>

          {/* Starting Streak */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider flex items-center justify-between">
              <span>Начальный стрик (дней подряд)</span>
              <span className="font-mono text-amber-700 text-xs font-bold">{streakDays} дн.</span>
            </label>
            <input
              type="number"
              min="0"
              max="999"
              value={streakDays}
              onChange={(e) => setStreakDays(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          {/* Streak Freeze initial toggle */}
          <div className="bg-sky-50/80 border border-sky-200 rounded-2xl p-3.5 flex items-start gap-3">
            <input
              type="checkbox"
              id="freezeInitial"
              checked={isFrozen}
              onChange={(e) => setIsFrozen(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-sky-600 accent-sky-600 cursor-pointer"
            />
            <label htmlFor="freezeInitial" className="text-xs text-sky-950 cursor-pointer">
              <span className="font-bold flex items-center gap-1.5">
                <Snowflake className="w-3.5 h-3.5 text-sky-600" />
                Сразу заморозить стрик ❄️
              </span>
              <span className="text-[11px] text-sky-800/80 block mt-0.5">
                Защищает серию от сгорания, если сегодня выходной или нет времени на привычку.
              </span>
            </label>
          </div>

          {/* Action buttons */}
          <div
            className="pt-2 flex items-center gap-2"
            style={{ paddingBottom: 'max(1.25rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-2xl transition cursor-pointer flex items-center justify-center"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="flex-2 h-12 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white font-bold rounded-2xl text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Создать привычку</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
