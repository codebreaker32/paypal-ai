'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { feedback, type FeedbackEvent } from './index';

export type ActionStatus = 'idle' | 'loading' | 'success';

export interface ActionState {
  status: ActionStatus;
  /** The failure of the last run, in a sentence a person can read. Cleared when the next run starts. */
  error: string | null;
}

const IDLE: ActionState = { status: 'idle', error: null };

const messageOf = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Try again.');

/** The part of useAction that doesn't need React, so its timing can be tested without a DOM. */
export function createActionRunner<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  { successMs, notify }: { successMs: number; notify: (event: FeedbackEvent) => void },
) {
  let current = { fn, successMs };
  let state = IDLE;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();

  const set = (next: ActionState) => {
    state = next;
    for (const listener of listeners) listener();
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    getSnapshot: () => state,
    /** Swaps in the newest props; the next run uses them. */
    update(nextFn: (...args: A) => Promise<R>, nextSuccessMs: number) {
      current = { fn: nextFn, successMs: nextSuccessMs };
    },
    /** Cancels the pending return to idle (the component is going away). */
    stop: () => clearTimeout(timer),
    /** Resolves with the action's result, or undefined when it failed or one was already running. Never rejects. */
    async run(...args: A): Promise<R | undefined> {
      if (inFlight) return undefined;
      inFlight = true;
      clearTimeout(timer);
      set({ status: 'loading', error: null });
      try {
        const result = await current.fn(...args);
        set({ status: 'success', error: null });
        notify('success');
        timer = setTimeout(() => set(IDLE), current.successMs);
        return result;
      } catch (e) {
        set({ status: 'idle', error: messageOf(e) });
        notify('error');
        return undefined;
      } finally {
        inFlight = false;
      }
    },
  };
}

/**
 * Runs an async action and tracks it for a Button: pass `status` to the Button and show `error` next to it.
 * `run` is stable and ignores a second call while the first is in flight. Calls feedback('success' | 'error').
 */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>, { successMs = 1400 }: { successMs?: number } = {}) {
  const [runner] = useState(() => createActionRunner(fn, { successMs, notify: feedback }));
  useEffect(() => runner.update(fn, successMs));
  const { status, error } = useSyncExternalStore(runner.subscribe, runner.getSnapshot, runner.getSnapshot);
  useEffect(() => runner.stop, [runner]);
  return { status, run: runner.run, error };
}
