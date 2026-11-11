'use client';

import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type FocusEvent, type ReactNode } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { CircleAlert, CircleCheck, Info, X, type LucideIcon } from 'lucide-react';
import { EASE_OUT, MOTION_S } from '@/components/motion/tokens';
import { createPausableTimer, type PausableTimer } from '@/lib/feedback/pausable-timer';
import { Icon } from './icon';
import { cn } from '@/lib/utils';

export type ToastTone = 'neutral' | 'ok' | 'danger';

export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Defaults to 5 s. */
  durationMs?: number;
  /** One link or button beside the text ("Open" the new order, "View order"). */
  action?: { label: string; href: string } | { label: string; onClick: () => void };
  /** A toast with the same key replaces the one showing (its timer starts again), so rapid repeats don't stack. */
  key?: string;
}

interface ToastItem extends Required<Pick<ToastInput, 'title' | 'tone' | 'durationMs'>> {
  id: number;
  key?: string;
  /** Bumped when a keyed toast is replaced in place, which restarts its timer. */
  rev: number;
  description?: string;
  action?: ToastInput['action'];
}

const ToastContext = createContext<((t: ToastInput) => void) | null>(null);

const TONE_ICON: Record<ToastTone, { icon: LucideIcon; className: string }> = {
  neutral: { icon: Info, className: 'text-info-soft' },
  ok: { icon: CircleCheck, className: 'text-ok-soft' },
  danger: { icon: CircleAlert, className: 'text-error-soft' },
};

/** Mount once (the root layout does). Toasts never take focus; they are announced politely. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const show = useCallback((t: ToastInput) => {
    const id = nextId.current++;
    setToasts((all) => {
      const item = { key: t.key, title: t.title, description: t.description, action: t.action, tone: t.tone ?? 'neutral', durationMs: t.durationMs ?? 5000 } as const;
      const same = t.key === undefined ? -1 : all.findIndex((o) => o.key === t.key);
      // In place, so the card doesn't leave and come back for each repeat.
      if (same >= 0) return all.map((o, i) => (i === same ? { ...item, id: o.id, rev: o.rev + 1 } : o));
      return [...all.slice(-2), { ...item, id, rev: 0 }];
    });
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        data-toast-region=""
        className="pointer-events-none fixed inset-x-4 bottom-4 z-(--z-toast) flex flex-col gap-2 pb-[env(safe-area-inset-bottom)] sm:left-auto sm:right-6 sm:bottom-6 sm:w-md"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

const ACTION = 'press-text -ml-1 mt-1 inline-flex min-h-tap cursor-pointer items-center self-start rounded-full px-1 font-semibold underline underline-offset-4 hover:bg-surface/10 focus-visible:outline-(--toast-fg)';

const HIDDEN = { opacity: 0, y: 16, scale: 0.98 };

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const timer = useRef<PausableTimer | null>(null);

  useEffect(() => {
    const t = createPausableTimer(() => onDismiss(toast.id), toast.durationMs);
    timer.current = t;
    t.start();
    return () => t.stop();
  }, [toast.id, toast.rev, toast.durationMs, onDismiss]);

  // A toast never leaves while someone is reading it or has tabbed into it.
  const leaveFocus = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) timer.current?.release('focus');
  };

  const tone = TONE_ICON[toast.tone];
  return (
    <m.div
      data-entrance=""
      initial={HIDDEN}
      animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: MOTION_S.base, ease: EASE_OUT } }}
      exit={{ ...HIDDEN, transition: { duration: MOTION_S.fast, ease: EASE_OUT } }}
      onPointerEnter={() => timer.current?.hold('hover')}
      onPointerLeave={() => timer.current?.release('hover')}
      onFocus={() => timer.current?.hold('focus')}
      onBlur={leaveFocus}
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-(--toast-radius) bg-(--toast-bg) py-3 pl-4 pr-1',
        'text-(--toast-fg) shadow-(--toast-shadow)',
      )}
    >
      <Icon icon={tone.icon} className={cn('mt-0.5', tone.className)} />
      <div className="flex min-w-0 flex-1 flex-col py-0.5">
        <p className="font-semibold text-pretty">{toast.title}</p>
        {toast.description && <p className="mt-0.5 text-sm opacity-85">{toast.description}</p>}
        {toast.action &&
          ('href' in toast.action ? (
            <Link href={toast.action.href} onClick={() => onDismiss(toast.id)} className={ACTION}>
              {toast.action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                onDismiss(toast.id);
                (toast.action as { onClick: () => void }).onClick();
              }}
              className={ACTION}
            >
              {toast.action.label}
            </button>
          ))}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="press-icon inline-flex size-(--spacing-tap) shrink-0 items-center justify-center rounded-full hover:bg-surface/10 focus-visible:outline-(--toast-fg)"
      >
        <Icon icon={X} size="sm" label="Dismiss" />
      </button>
    </m.div>
  );
}

/**
 * Returns toast(...) for news the person can't see where they are: a new paid order, tracking sent, picked up,
 * `Couldn’t copy`. Anything whose result is in view (a switch, a saved field, Copied) confirms in place instead.
 */
/** The toast function, or null where no provider is mounted (a component rendered on its own). */
export const useOptionalToast = (): ((t: ToastInput) => void) | null => useContext(ToastContext);

export function useToast(): (t: ToastInput) => void {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
