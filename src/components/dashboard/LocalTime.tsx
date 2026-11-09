'use client';

import { useSyncExternalStore } from 'react';
import { dayLabel } from '@/lib/domain/day';

const subscribe = () => () => {};

/** True after hydration. The server render and the first client render agree (false), so times never mismatch. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

function format(iso: string, timeZone?: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toLocaleDateString('en-US', { timeZone }) === now.toLocaleDateString('en-US', { timeZone });
  return d.toLocaleString('en-US', {
    timeZone,
    ...(sameDay ? {} : { month: 'short', day: 'numeric' }),
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** A timestamp in the viewer's own time zone: "2:14 PM" today, "Nov 5, 2:14 PM" otherwise. */
export function LocalTime({ iso, className }: { iso: string; className?: string }) {
  const hydrated = useHydrated();
  return (
    <time dateTime={iso} className={className}>
      {format(iso, hydrated ? undefined : 'UTC')}
    </time>
  );
}

/** A date in the viewer's own time zone: "8 Nov 2026". */
export function LocalDay({ iso, className }: { iso: string; className?: string }) {
  const hydrated = useHydrated();
  return (
    <time dateTime={iso} className={className}>
      {dayLabel(iso, hydrated ? undefined : 'UTC')}
    </time>
  );
}
