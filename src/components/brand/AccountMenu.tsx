'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { CircleUserRound } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { useToast } from '@/components/ui/toast';
import { logout } from '@/lib/client/auth';
import { cn } from '@/lib/utils';

const ROW = 'press-text flex min-h-tap w-full items-center rounded-md px-3 text-left text-sm font-semibold hover:bg-surface-subtle';

const LINKS = [
  { href: '/shops', label: 'Your shops' },
  { href: '/shops/new', label: 'Add a shop' },
  { href: '/account', label: 'Account' },
  { href: '/help', label: 'Help' },
];

/**
 * The one account menu (header and seller shell). A disclosure of plain links, not a `role="menu"`: Tab walks it, Esc or
 * a press outside closes it, and focus goes back to the button.
 */
export function AccountMenu({ email, placement = 'down', className, panelClassName }: { email: string; placement?: 'up' | 'down'; className?: string; panelClassName?: string }) {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const toast = useToast();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element;
      if (root.current?.contains(target)) return;
      setOpen(false);
      // After the press has finished moving focus; a press on another control keeps it.
      if (!target.closest('a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])')) setTimeout(() => trigger.current?.focus({ preventScroll: true }), 0);
    };
    const onFocusIn = (e: FocusEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open]);

  const onLogout = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      await logout();
      // A full replace, so no logged-in page is left in this tab's history or cache.
      window.location.replace('/');
    } catch {
      setLeaving(false);
      toast({ title: 'Couldn’t log out', description: 'Check your connection and try again.', tone: 'danger' });
    }
  };

  return (
    <div ref={root} className={cn('relative', className)}>
      <button
        ref={trigger}
        type="button"
        aria-label="Account"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="press-icon flex size-tap items-center justify-center rounded-md hover:bg-surface-sunken aria-expanded:bg-surface-sunken"
      >
        <Icon icon={CircleUserRound} size="lg" />
      </button>
      {open && (
        <div
          id={panelId}
          data-testid="account-menu"
          className={cn(
            'absolute z-(--z-menu) w-64 max-w-[calc(100vw-2*var(--spacing-gutter))] animate-fade-in rounded-lg bg-surface-raised p-1.5 shadow-md',
            placement === 'down' ? 'top-full right-0 mt-1.5' : 'bottom-full left-0 mb-1.5',
            panelClassName,
          )}
        >
          <p title={email} className="truncate px-3 py-2 type-meta text-ink-muted">
            {email}
          </p>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className={ROW}>
              {l.label}
            </Link>
          ))}
          <div className="mx-3 my-1 h-px bg-line" aria-hidden="true" />
          <button type="button" onClick={onLogout} aria-busy={leaving || undefined} className={ROW}>
            {leaving ? 'Logging out...' : 'Log out'}
          </button>
        </div>
      )}
    </div>
  );
}
