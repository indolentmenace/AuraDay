import React, { useState, useRef } from 'react';
import { ScheduleTask } from '../types/schedule';
import { CATEGORY_INFO } from '../data/defaultSchedule';
import { Check, Clock, Edit2, GripVertical, Trash2 } from 'lucide-react';
import { sounds } from '../utils/audio';

interface TaskCardProps {
  task: ScheduleTask;
  isCompleted: boolean;
  onToggleComplete: (taskId: string) => void;
  onEditTask: (task: ScheduleTask) => void;
  onDeleteTask?: (taskId: string) => void;
  onDragStartTask: (taskId: string) => void;
  onDragOverTask: (taskId: string) => void;
  onDropOnTask: (targetTaskId: string, sourceTaskId?: string) => void;
  onDragEndTask?: () => void;
  isDragOver?: boolean;
  isDragging?: boolean;
  soundEnabled: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  isCompleted,
  onToggleComplete,
  onEditTask,
  onDeleteTask,
  onDragStartTask,
  onDragOverTask,
  onDropOnTask,
  onDragEndTask,
  isDragOver = false,
  isDragging = false,
  soundEnabled,
}) => {
  const cat = CATEGORY_INFO[task.category] || CATEGORY_INFO.routine;

  // Swipe to delete & drag-to-reorder state (touch & desktop pointer)
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isOpenDelete, setIsOpenDelete] = useState(false);

  const startX = useRef(0);
  const startY = useRef(0);
  const currentOffsetX = useRef(0);
  const gestureMode = useRef<'swipe' | 'reorder' | null>(null);
  const lastOverTaskId = useRef<string | null>(null);
  const isPointerDown = useRef(false);
  const activePointerId = useRef<number | null>(null);

  const handleToggle = () => {
    if (!isCompleted) {
      sounds.playCheck(soundEnabled);
    } else {
      sounds.playUncheck(soundEnabled);
    }
    onToggleComplete(task.id);
  };

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}ч ${m}м`;
    if (h > 0) return `${h} ч`;
    return `${m} мин`;
  };

  const isUniBlock =
    task.category === 'study_uni' ||
    task.id.includes('-prep-uni') ||
    task.id.includes('-travel-uni') ||
    task.id.includes('-travel-home');

  // Unified Pointer handlers supporting both card reordering and horizontal swipe-to-delete
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isUniBlock) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('a') ||
      target.closest('[data-no-drag="true"]')
    ) {
      return;
    }

    const isFromHandle = Boolean(target.closest('[data-drag-handle]'));

    startX.current = e.clientX;
    startY.current = e.clientY;
    currentOffsetX.current = isOpenDelete ? -64 : 0;
    isPointerDown.current = true;
    activePointerId.current = e.pointerId;
    lastOverTaskId.current = null;

    if (isFromHandle) {
      if (isOpenDelete) {
        setOffsetX(0);
        setIsOpenDelete(false);
        currentOffsetX.current = 0;
      }
      gestureMode.current = 'reorder';
      setIsSwiping(false);
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      onDragStartTask(task.id);
      return;
    }

    gestureMode.current = null;
    setIsSwiping(false);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPointerDown.current || isUniBlock) return;
    if (activePointerId.current !== null && e.pointerId !== activePointerId.current) return;

    const deltaX = e.clientX - startX.current;
    const deltaY = e.clientY - startY.current;

    if (gestureMode.current === null) {
      if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          gestureMode.current = 'swipe';
          setIsSwiping(true);
          try {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          } catch {
            // ignore
          }
        } else {
          // Vertical movement on card body: on mouse/trackpad, initiate card reordering!
          if (e.pointerType === 'mouse' && !isOpenDelete) {
            gestureMode.current = 'reorder';
            try {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            } catch {
              // ignore
            }
            onDragStartTask(task.id);
          } else {
            isPointerDown.current = false;
            activePointerId.current = null;
            return;
          }
        }
      }
    }

    if (gestureMode.current === 'swipe') {
      const baseOffset = isOpenDelete ? -64 : 0;
      const targetOffset = baseOffset + deltaX;
      // Allow swiping left up to -84px, right up to 10px bounce
      const clamped = Math.max(-84, Math.min(10, targetOffset));
      setOffsetX(clamped);
      currentOffsetX.current = clamped;
    } else if (gestureMode.current === 'reorder') {
      const elem = document.elementFromPoint(e.clientX, e.clientY);
      const cardElem = elem?.closest('[data-task-id]');
      if (cardElem) {
        const targetId = cardElem.getAttribute('data-task-id');
        if (targetId && targetId !== task.id) {
          lastOverTaskId.current = targetId;
          onDragOverTask(targetId);
        }
      }
    }
  };

  const releasePointer = (target: EventTarget & Element, pointerId: number) => {
    try {
      if ((target as HTMLElement).hasPointerCapture?.(pointerId)) {
        (target as HTMLElement).releasePointerCapture(pointerId);
      }
    } catch {
      // ignore
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isPointerDown.current) return;
    if (activePointerId.current !== null && e.pointerId !== activePointerId.current) return;

    if (gestureMode.current === 'swipe') {
      if (currentOffsetX.current < -28) {
        setOffsetX(-64);
        setIsOpenDelete(true);
      } else {
        setOffsetX(0);
        setIsOpenDelete(false);
      }
    } else if (gestureMode.current === 'reorder') {
      const elem = document.elementFromPoint(e.clientX, e.clientY);
      const cardElem = elem?.closest('[data-task-id]');
      const pointedId = cardElem?.getAttribute('data-task-id');
      const finalTargetId =
        pointedId && pointedId !== task.id ? pointedId : lastOverTaskId.current;
      if (finalTargetId && finalTargetId !== task.id) {
        onDropOnTask(finalTargetId, task.id);
      }
      onDragEndTask?.();
    }

    releasePointer(e.currentTarget, e.pointerId);
    isPointerDown.current = false;
    activePointerId.current = null;
    setIsSwiping(false);
    gestureMode.current = null;
    lastOverTaskId.current = null;
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    if (!isPointerDown.current) return;
    if (gestureMode.current === 'reorder') {
      onDragEndTask?.();
    } else if (gestureMode.current === 'swipe') {
      setOffsetX(isOpenDelete ? -64 : 0);
    }
    releasePointer(e.currentTarget, e.pointerId);
    isPointerDown.current = false;
    activePointerId.current = null;
    setIsSwiping(false);
    gestureMode.current = null;
    lastOverTaskId.current = null;
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    sounds.playUncheck(soundEnabled);
    setOffsetX(0);
    setIsOpenDelete(false);
    onDeleteTask?.(task.id);
  };

  return (
    <div className="relative select-none touch-pan-y">
      {/* Trash button (appears in the empty space revealed on the right) */}
      {!isUniBlock && (
        <div
          style={{
            opacity: Math.min(1, Math.max(0, -offsetX / 25)),
            transform: `translateY(-50%) scale(${Math.min(1, Math.max(0.5, -offsetX / 64))})`,
            pointerEvents: offsetX < -25 ? 'auto' : 'none',
          }}
          className="absolute right-1.5 top-1/2 z-0 flex items-center justify-center transition-all duration-150"
        >
          <button
            type="button"
            onClick={handleDelete}
            aria-label="Удалить дело"
            title="Удалить дело"
            className="w-12 h-12 rounded-2xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white shadow-md flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <Trash2 className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>
      )}

      {/* Foreground Task Card with exact original styles & shadows */}
      <div
        data-task-id={task.id}
        onDragStart={(e) => e.preventDefault()}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.26s cubic-bezier(0.16, 1, 0.3, 1)',
          touchAction: 'pan-y',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={(e) => {
          if (isOpenDelete) {
            e.stopPropagation();
            setOffsetX(0);
            setIsOpenDelete(false);
          }
        }}
        className={`ios-card group relative p-4 rounded-3xl transition-shadow duration-200 border select-none ${
          isUniBlock
            ? 'cursor-default ring-1 ring-indigo-200/50 dark:ring-indigo-500/30 category-card-study_uni'
            : 'cursor-grab active:cursor-grabbing'
        } ${
          isDragging
            ? 'opacity-40 scale-[0.98] border-dashed border-sky-400 bg-sky-50/40 dark:bg-sky-950/40 shadow-inner'
            : isDragOver
            ? 'scale-[1.02] ring-2 ring-sky-500 bg-sky-50/90 dark:bg-sky-950/90 shadow-lg border-sky-400'
            : isCompleted
            ? 'bg-white/50 border-slate-200/60 opacity-60 shadow-none dark:bg-slate-800/40 dark:border-slate-700/50'
            : `category-card-${task.category} border shadow-xs hover:shadow-md hover:scale-[1.008]`
        }`}
      >
        <div className="flex items-start gap-2.5">
          {/* iOS Drag Handle Grip with Touch & Pointer Support */}
          <div
            data-drag-handle="true"
            title={isUniBlock ? 'Пары в вузе' : 'Зажмите и переместите карточку'}
            className={`shrink-0 -ml-1.5 px-1.5 py-1 transition rounded-xl ${
              isUniBlock
                ? 'text-indigo-400 dark:text-indigo-500 cursor-default opacity-60'
                : 'text-slate-300 dark:text-slate-600 group-hover:text-sky-600 dark:group-hover:text-sky-400 cursor-grab active:cursor-grabbing touch-none'
            }`}
          >
            <GripVertical className="w-4 h-4 pointer-events-none" />
          </div>

          {/* Checkbox button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggle();
            }}
            aria-label={isCompleted ? 'Отметить невыполненным' : 'Отметить выполненным'}
            className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer mt-0.5 ${
              isCompleted
                ? 'bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-200 dark:ring-emerald-800 scale-95'
                : 'border-2 border-slate-300 dark:border-slate-600 hover:border-slate-400 bg-white dark:bg-slate-800 shadow-2xs hover:scale-105'
            }`}
          >
            {isCompleted && <Check className="w-4 h-4 stroke-[3]" />}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1 flex-wrap">
                <span
                  className={`category-badge-${task.category} inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full`}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.name}</span>
                </span>
                {task.category === 'study_uni' && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border border-indigo-200/70 dark:border-indigo-700/60 shadow-2xs">
                    Пары в вузе
                  </span>
                )}
                {isUniBlock && task.category !== 'study_uni' && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/60">
                    Дорога в вуз
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 text-slate-400 dark:text-slate-400 text-xs font-mono font-medium shrink-0">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{task.startTime} – {task.endTime}</span>
                <span className="text-[10px] text-slate-400">({formatDuration(task.durationMinutes)})</span>
              </div>
            </div>

            <h3
              className={`category-title-${task.category} text-base font-bold mt-1.5 transition-colors leading-snug break-words ${
                isCompleted
                  ? 'line-through text-slate-400 decoration-slate-400 decoration-2 dark:text-slate-500'
                  : ''
              }`}
            >
              {task.title}
            </h3>

            {task.subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-normal leading-relaxed break-words">
                {task.subtitle}
              </p>
            )}
          </div>

          {/* Action button: Edit */}
          <div className="flex items-center shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditTask(task);
              }}
              title="Редактировать время или название"
              className="opacity-70 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-700/80 rounded-xl transition cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
