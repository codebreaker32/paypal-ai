'use client';

import { useCallback, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, Loader2 } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { cx } from '@/components/ui/cx';
import { ApiError, publish, type PublishEvent } from './api';
import { publishCounts } from './review-model';

export interface PublishRow {
  itemId: string;
  name: string;
  state: 'pending' | 'ok' | 'failed';
  message?: string;
}

export type PublishRun =
  | { phase: 'idle' }
  | { phase: 'running' | 'done'; rows: PublishRow[]; published: number; failed: number; shopStatus?: string }
  | { phase: 'error'; message: string; rows: PublishRow[]; code?: string };

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
      commit({ phase: 'error', message: err instanceof Error ? err.message : String(err), rows, code: err instanceof ApiError ? err.code : undefined });
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
  const { total, added, failed, finished, addedShare, finishedShare } = publishCounts(rows);
  const label =
    run.phase === 'running'
      ? total
        ? `Adding to PayPal… ${finished}/${total}`
        : 'Connecting to PayPal…'
      : run.phase === 'done' && failed === 0
        ? total
          ? `All ${total} ${total === 1 ? 'item is' : 'items are'} in PayPal`
          : 'Your items are in PayPal'
        : run.phase === 'done'
          ? `${added} of ${total} added to PayPal`
          : 'Publishing stopped';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="type-label type-figures" role="status" aria-live="polite">
          {label}
        </p>
        {/* The bar fills with the items PayPal took; the ones it refused show as their own (danger) part after them,
            so "7 of 9 added" never looks complete. Two full-width layers scaled from the left: only transform animates. */}
        <div
          role="progressbar"
          aria-label="Items added to PayPal"
          aria-valuemin={0}
          aria-valuemax={total || 1}
          aria-valuenow={added}
          aria-valuetext={failed ? `${added} of ${total} added, ${failed} not added` : `${added} of ${total} added`}
          className="relative h-2 overflow-hidden rounded-full bg-surface-sunken"
        >
          {failed > 0 && (
            <div
              data-part="failed"
              className="absolute inset-0 origin-left bg-error transition-transform duration-(--duration-base) motion-reduce:transition-none"
              style={{ transform: `scaleX(${finishedShare})` }}
            />
          )}
          <div
            data-part="added"
            className={cx(
              'absolute inset-0 origin-left transition-transform duration-(--duration-base) motion-reduce:transition-none',
              run.phase === 'running' ? 'bg-ink' : 'bg-ok',
            )}
            style={{ transform: `scaleX(${addedShare})` }}
          />
        </div>
      </div>
      {total > 0 && (
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {rows.map((r) => (
            <li key={r.itemId} className="flex items-start gap-3 py-2.5">
              {r.state === 'pending' ? (
                <Icon icon={Loader2} className="mt-0.5 animate-spin text-ink-muted" label="Adding" />
              ) : r.state === 'ok' ? (
                <Icon icon={CircleCheck} className="mt-0.5 text-ok" label="Added" />
              ) : (
                <Icon icon={CircleAlert} className="mt-0.5 text-error" label="Not added" />
              )}
              <span className="flex flex-1 flex-col">
                <span className={cx('[overflow-wrap:anywhere]', r.state === 'pending' && 'text-ink-soft')}>{r.name}</span>
                {r.state === 'failed' && r.message && <span className="text-sm text-error">{r.message}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
