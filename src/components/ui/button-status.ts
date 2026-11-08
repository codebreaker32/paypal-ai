import type { MouseEvent } from 'react';
import { cn } from '@/lib/utils';

export type ButtonStatus = 'idle' | 'loading' | 'success';

/** On the control: its status layers share one grid cell, so the widest layer holds the width in every status. */
export const LAYERED = 'inline-grid place-items-center [&>*]:[grid-area:1/1]';

const LAYER = 'inline-flex items-center justify-center gap-2 transition-[opacity,visibility] duration-(--duration-fast) ease-out';
const HIDDEN = 'invisible opacity-0';

/**
 * The classes for one status layer. Going into `loading`, the outgoing label and the spinner both wait for
 * --pending-delay, so a response inside it shows no spinner at all. `delayed: false` swaps straight away.
 */
export function layerClass(layer: ButtonStatus, status: ButtonStatus, { delayed = true }: { delayed?: boolean } = {}) {
  const waits = delayed && status === 'loading' && (layer === 'idle' || layer === 'loading');
  return cn(LAYER, layer !== status && HIDDEN, waits && 'delay-(--pending-delay)');
}

/**
 * A busy control keeps focus and `aria-disabled`, so unlike a native disabled one it still receives clicks: this drops
 * them. preventDefault also stops the submit from a click, or from Enter in the button's form.
 */
export function preventClick(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
}
