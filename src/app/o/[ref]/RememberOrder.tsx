'use client';

import { useEffect } from 'react';
import { remember, type MyOrder } from '@/lib/client/my-orders';

/** Adds this receipt to "Your orders" on this device (localStorage only). Draws nothing. */
export function RememberOrder({ order }: { order: MyOrder }) {
  const { ref, shopName, shopSlug, total, createdAt } = order;
  useEffect(() => {
    remember({ ref, shopName, shopSlug, total, createdAt });
  }, [ref, shopName, shopSlug, total, createdAt]);
  return null;
}
