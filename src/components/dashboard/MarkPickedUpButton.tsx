'use client';

import { PackageCheck } from 'lucide-react';
import { Button, type ButtonVariant } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import type { Order } from '@/lib/domain/types';
import { useAction } from '@/lib/feedback/use-action';
import { markPickedUp } from './api';

/** The button says "Picked up" this long before the row moves to Done. */
const PICKED_UP_HOLD_MS = 500;

export function MarkPickedUpButton({
  shopId,
  order,
  onDone,
  variant = 'secondary',
  fullWidth,
  compact,
}: {
  shopId: string;
  order: Pick<Order, 'id' | 'number'>;
  onDone: (order: Order) => void;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  /** In an order row: only as wide as its label at every width, right-aligned. */
  compact?: boolean;
}) {
  const toast = useToast();
  // Holds past onDone, so a page that refreshes slowly doesn't flip back to "Mark picked up" before the row goes away.
  const { status, run, error } = useAction(() => markPickedUp(shopId, order.id), { successMs: 3000 });

  const pickUp = async () => {
    const done = await run();
    if (!done) return;
    setTimeout(() => {
      toast({ title: `${order.number} picked up`, description: 'Moved to Done.', tone: 'ok' });
      onDone(done.order);
    }, PICKED_UP_HOLD_MS);
  };

  return (
    <div className={fullWidth ? 'flex flex-col gap-2' : compact ? 'flex flex-col items-end gap-2' : 'flex flex-col gap-2 sm:items-start'}>
      <Button
        variant={variant}
        icon={PackageCheck}
        status={status}
        loadingLabel="Saving…"
        successLabel="Picked up"
        onClick={pickUp}
        fullWidth={fullWidth}
        className={fullWidth || compact ? undefined : 'w-full sm:w-auto'}
      >
        Mark picked up
      </Button>
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}
