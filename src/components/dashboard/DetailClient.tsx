'use client';

// Client leaves for the order detail page (a server component): refresh while something is pending, and the pickup action.
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { Order } from '@/lib/domain/types';
import { MarkPickedUpButton } from './MarkPickedUpButton';
import { POLL_MS } from './api';

/** Re-renders the page from SQLite every 5 s while the order or its brief is still on the way. */
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [active, router]);
  return null;
}

/**
 * Lands on the URL's #section when the page arrives. `loading.tsx` commits first, and Next's router gives up on a hash its
 * skeleton doesn't contain, so "Add tracking" would otherwise open at the top of the order.
 */
export function ScrollToHash() {
  useEffect(() => {
    if (window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }, []);
  return null;
}

export function PickupAction({ shopId, order }: { shopId: string; order: Pick<Order, 'id' | 'number'> }) {
  const router = useRouter();
  return <MarkPickedUpButton shopId={shopId} order={order} variant="primary" onDone={() => router.refresh()} />;
}
