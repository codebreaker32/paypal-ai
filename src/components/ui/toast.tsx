'use client';

import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, X, type LucideIcon } from 'lucide-react';
import { Icon } from './icon';
import { cn } from '@/lib/utils';

export type ToastTone = 'neutral' | 'ok' | 'danger';

export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Defaults to 5 s. */
  durationMs?: number;
  /** One link beside the text ("Open" the new order). */
  action?: { label: string; href: string };
}

interface ToastItem extends Required<Pick<ToastInput, 'title' | 'tone' | 'durationMs'>> {
  id: number;
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
    setToasts((all) => [
      ...all.slice(-2),
      { id, title: t.title, description: t.description, action: t.action, tone: t.tone ?? 'neutral', durationMs: t.durationMs ?? 5000 },
    ]);
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
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => clearTimeout(timer);
  }, [toast.id, toast.durationMs, onDismiss]);

  const tone = TONE_ICON[toast.tone];
  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-(--toast-radius) bg-(--toast-bg) py-3 pl-4 pr-1',
        'text-(--toast-fg) shadow-(--toast-shadow) animate-rise-in',
      )}
    >
      <Icon icon={tone.icon} className={cn('mt-0.5', tone.className)} />
      <div className="flex min-w-0 flex-1 flex-col py-0.5">
        <p className="font-semibold text-pretty">{toast.title}</p>
        {toast.description && <p className="mt-0.5 text-sm opacity-85">{toast.description}</p>}
        {toast.action && (
          <Link
            href={toast.action.href}
            onClick={() => onDismiss(toast.id)}
            className="-ml-1 mt-1 inline-flex min-h-tap items-center self-start rounded-full px-1 font-semibold underline underline-offset-4 hover:bg-surface/10 focus-visible:outline-(--toast-fg)"
          >
            {toast.action.label}
          </Link>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="inline-flex size-(--spacing-tap) shrink-0 items-center justify-center rounded-full hover:bg-surface/10 focus-visible:outline-(--toast-fg)"
      >
        <Icon icon={X} size="sm" label="Dismiss" />
      </button>
    </div>
  );
}

/** Returns toast(...) for brief confirmations: "Link copied", "Tracking sent to PayPal". */
export function useToast(): (t: ToastInput) => void {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
