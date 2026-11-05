'use client';

import { useCallback, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, Loader2 } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/components/ui/cx';
import { publish, type PublishEvent } from './api';

export interface PublishRow {
  itemId: string;
  name: string;
  state: 'pending' | 'ok' | 'failed';
  message?: string;
}

export type PublishRun =
  | { phase: 'idle' }
  | { phase: 'running' | 'done'; rows: PublishRow[]; published: number; failed: number; shopStatus?: string }
  | { phase: 'error'; message: string; rows: PublishRow[] };

/** Runs a publish and keeps a row per item as PayPal answers. Calling start() again is the retry. */
export function usePublish(shopId: string) {
  const [run, setRun] = useState<PublishRun>({ phase: 'idle' });
  const busy = useRef(false);

  const start = useCallback(async (): Promise<PublishRun> => {
    if (busy.current) return run;
    busy.current = true;
    let rows: PublishRow[] = [];
    let last: PublishRun = { phase: 'running', rows, published: 0, failed: 0 };
    const commit = (r: PublishRun) => {
      last = r;
      setRun(r);
    };
    commit(last);
    try {
      await publish(shopId, (e: PublishEvent) => {
        if (e.type === 'start') {
          rows = e.items.map((i) => ({ itemId: i.itemId, name: i.name, state: 'pending' }));
        } else if (e.type === 'item') {
          rows = rows.map((r) => (r.itemId === e.itemId ? { ...r, state: e.ok ? 'ok' : 'failed', message: e.ok ? undefined : e.message } : r));
        }
        const published = rows.filter((r) => r.state === 'ok').length;
        const failed = rows.filter((r) => r.state === 'failed').length;
        if (e.type === 'done') commit({ phase: 'done', rows, published, failed, shopStatus: e.shop.status });
        else if (e.type === 'error') commit({ phase: 'error', message: e.message, rows });
        else commit({ phase: 'running', rows, published, failed });
      });
      if (last.phase === 'running') commit({ phase: 'error', message: 'The connection dropped before publishing finished. Try again.', rows });
    } catch (err) {
      commit({ phase: 'error', message: err instanceof Error ? err.message : String(err), rows });
    } finally {
      busy.current = false;
    }
    return last;
  }, [shopId, run]);

  return { run, start, reset: () => setRun({ phase: 'idle' }) };
}

/** "Adding to PayPal… 6/10", a progress bar, and one line per item with its result. */
export function PublishProgress({ run }: { run: Exclude<PublishRun, { phase: 'idle' }> }) {
  const rows = run.rows;
  const total = rows.length;
  const finished = rows.filter((r) => r.state !== 'pending').length;
  const label =
    run.phase === 'running'
      ? total
        ? `Adding to PayPal… ${finished}/${total}`
        : 'Connecting to PayPal…'
      : run.phase === 'done' && run.failed === 0
        ? `All ${total} ${total === 1 ? 'item is' : 'items are'} in PayPal`
        : run.phase === 'done'
          ? `${run.published} of ${total} added to PayPal`
          : 'Publishing stopped';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="type-label type-price" role="status" aria-live="polite">
          {label}
        </p>
        <div
          role="progressbar"
          aria-label="Items added to PayPal"
          aria-valuemin={0}
          aria-valuemax={total || 1}
          aria-valuenow={finished}
          className="h-2 overflow-hidden rounded-full bg-surface-sunken"
        >
          <div
            className={cx(
              'h-full w-full origin-left rounded-full transition-transform duration-(--duration-base)',
              run.phase === 'done' && run.failed === 0 ? 'bg-ok' : 'bg-accent',
            )}
            style={{ transform: `scaleX(${total ? finished / total : 0})` }}
          />
        </div>
      </div>
      {total > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line-strong bg-surface-raised px-4">
          {rows.map((r) => (
            <li key={r.itemId} className="flex items-start gap-3 py-2.5">
              {r.state === 'pending' ? (
                <Icon icon={Loader2} className="mt-0.5 animate-spin text-ink-muted" label="Adding" />
              ) : r.state === 'ok' ? (
                <Icon icon={CircleCheck} className="mt-0.5 text-ok" label="Added" />
              ) : (
                <Icon icon={CircleAlert} className="mt-0.5 text-danger" label="Not added" />
              )}
              <span className="flex flex-1 flex-col">
                <span className={cx('[overflow-wrap:anywhere]', r.state === 'pending' && 'text-ink-soft')}>{r.name}</span>
                {r.state === 'failed' && r.message && <span className="text-sm text-danger">{r.message}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
