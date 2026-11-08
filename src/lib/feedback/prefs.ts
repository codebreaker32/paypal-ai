'use client';

import { useSyncExternalStore } from 'react';

/*
 * One switch per device for sound and vibration, on unless turned off. Storage can be missing or blocked (private
 * browsing, a full quota), and that must never get in the way of a press.
 */

const KEY = 'shelfie:feedback:v1';

const listeners = new Set<() => void>();

/** A choice that couldn't be saved. It holds for this page, and storage takes over again after a successful save. */
let unsaved: boolean | null = null;

export function isFeedbackOn(): boolean {
  if (unsaved !== null) return unsaved;
  try {
    return localStorage.getItem(KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setFeedbackOn(on: boolean): void {
  try {
    localStorage.setItem(KEY, String(on));
    unsaved = null;
  } catch {
    unsaved = on;
  }
  for (const listener of listeners) listener();
}

/** Calls `listener` when the switch changes, here or in another tab. */
export function subscribeFeedback(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: Event) => {
    const { key } = event as StorageEvent;
    if (key === KEY || key === null) listener();
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

const onServer = () => true;

export function useFeedbackOn(): boolean {
  return useSyncExternalStore(subscribeFeedback, isFeedbackOn, onServer);
}
