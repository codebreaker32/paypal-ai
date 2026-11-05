'use client';

import { useState } from 'react';
import { PackageCheck } from 'lucide-react';
import { Button, type ButtonVariant } from '@/components/ui/Button';
import { FieldError } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import type { Order } from '@/lib/domain/types';
import { markPickedUp } from './api';

export function MarkPickedUpButton({
  shopId,
  order,
  onDone,
  variant = 'secondary',
  fullWidth,
}: {
  shopId: string;
  order: Pick<Order, 'id' | 'number'>;
  onDone: (order: Order) => void;
  variant?: ButtonVariant;
  fullWidth?: boolean;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const { order: updated } = await markPickedUp(shopId, order.id);
      toast({ title: `${order.number} picked up`, description: 'Moved to Done.', tone: 'ok' });
      onDone(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={fullWidth ? 'flex flex-col gap-2' : 'flex flex-col gap-2 sm:items-start'}>
      <Button
        variant={variant}
        icon={PackageCheck}
        loading={busy}
        loadingLabel="Saving…"
        onClick={run}
        fullWidth={fullWidth}
        className={fullWidth ? undefined : 'w-full sm:w-auto'}
      >
        Mark picked up
      </Button>
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}
