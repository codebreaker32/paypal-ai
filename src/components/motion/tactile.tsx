'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useSyncExternalStore, type CSSProperties } from 'react';
import { connectFeedback } from '@/lib/feedback';
import { createPressMachine, type PressInput, type PressMachine } from '@/lib/feedback/press-machine';
import { createRouteProgress, PROGRESS_MS, startsRouteNavigation, type ProgressPhase } from '@/lib/feedback/route-progress';

/*
 * Makes the app answer the hand: one listener on the window marks whichever control is being pressed with `data-pressed`
 * (the `press*` utilities in globals.css draw it), and shows the route progress bar while a link's page loads. Controls
 * need no props or hooks for this, so server components get it too.
 */

const CONTROLS =
  'a[href],button,summary,[role="button"],[role="tab"],[role="switch"],label[for],label:has(input[type=file]),label:has(input[type=radio])';
const UNAVAILABLE = ':disabled,[aria-disabled="true"]';

/** The element that shows the press for this control, or null if the control can't be used right now. */
function pressedElementFor(control: Element): Element | null {
  if (control.matches(UNAVAILABLE)) return null;
  if (control.matches('[data-stretched-link]')) return control.closest('[data-slot="pressable"]') ?? control;
  if (control instanceof HTMLLabelElement) {
    if (control.control?.matches(UNAVAILABLE)) return null;
    if (control.htmlFor && control.control) return control.control;
  }
  return control;
}

/** The control a Space or Enter keydown presses, or null if that key does nothing to the focused element. */
function controlForKey(target: Element, key: string): Element | null {
  const hiddenInput = target.matches('input[type=file],input[type=radio]');
  const control = hiddenInput ? target.closest('label') : target;
  if (!control?.matches(CONTROLS)) return null;
  if (key === ' ' && control.matches('a[href]')) return null; // Space scrolls the page; it doesn't follow a link.
  if (key === 'Enter' && target.matches('input[type=radio]')) return null; // Enter on a radio submits its form.
  return control;
}

interface Press {
  machine: PressMachine;
  input: PressInput;
  /** Where focus would be for this press: its blur ends the press. */
  source: EventTarget;
  pointerId?: number;
  key?: string;
}

let navigatingControl: Element | null = null;

const progress = createRouteProgress({
  onSettled() {
    navigatingControl?.removeAttribute('data-navigating');
    navigatingControl = null;
  },
});

/** Shows the route progress bar for a navigation started from code (`router.push`). Links are detected on their own. */
export function beginNavigation(): void {
  progress.begin();
}

function listenForPresses(): () => void {
  const machines = new WeakMap<Element, PressMachine>();
  let active: Press | null = null;

  const machineFor = (element: Element) => {
    let machine = machines.get(element);
    if (!machine) {
      machine = createPressMachine({
        apply: () => element.setAttribute('data-pressed', ''),
        clear: () => element.removeAttribute('data-pressed'),
      });
      machines.set(element, machine);
    }
    return machine;
  };

  const startPress = (control: Element, input: PressInput, source: EventTarget, ids: Pick<Press, 'pointerId' | 'key'>) => {
    const element = pressedElementFor(control);
    if (!element) return;
    active?.machine.up(); // a release we never saw
    const machine = machineFor(element);
    active = { machine, input, source, ...ids };
    machine.down(input);
  };

  const endPress = (how: 'up' | 'cancel') => {
    active?.machine[how]();
    active = null;
  };

  const followLink = (event: MouseEvent) => {
    if (event.defaultPrevented || !(event.target instanceof Element)) return;
    const control = event.target.closest(CONTROLS);
    if (!(control instanceof HTMLAnchorElement)) return;
    const element = pressedElementFor(control);
    if (!element) return;
    const navigates = startsRouteNavigation({
      url: control.href,
      current: window.location.href,
      target: control.target,
      download: control.hasAttribute('download'),
      button: event.button,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
    });
    if (!navigates) return;
    progress.begin();
    navigatingControl = element;
    element.setAttribute('data-navigating', '');
  };

  const handle = (event: Event) => {
    switch (event.type) {
      case 'pointerdown': {
        const e = event as PointerEvent;
        // ctrl + click opens the context menu on a Mac, and its pointerup may never arrive.
        if (e.button !== 0 || !e.isPrimary || (e.pointerType === 'mouse' && e.ctrlKey)) return;
        if (!(e.target instanceof Element)) return;
        const control = e.target.closest(CONTROLS);
        if (!control) return;
        const input: PressInput = e.pointerType === 'touch' || e.pointerType === 'pen' ? e.pointerType : 'mouse';
        startPress(control, input, control, { pointerId: e.pointerId });
        return;
      }
      case 'pointerup':
      case 'pointercancel': {
        if (active?.pointerId !== (event as PointerEvent).pointerId) return;
        endPress(event.type === 'pointerup' ? 'up' : 'cancel');
        return;
      }
      case 'keydown': {
        const e = event as KeyboardEvent;
        if (e.repeat || (e.key !== ' ' && e.key !== 'Enter') || !(e.target instanceof Element)) return;
        const control = controlForKey(e.target, e.key);
        if (control) startPress(control, 'keyboard', e.target, { key: e.key });
        return;
      }
      case 'keyup': {
        if (active?.key !== undefined && active.key === (event as KeyboardEvent).key) endPress('up');
        return;
      }
      case 'blur': {
        // Focus moving to a pressed control fires a blur on the control it left: only this control's own blur counts.
        if (!active || (event.target !== window && event.target !== active.source)) return;
        endPress(active.input === 'keyboard' ? 'up' : 'cancel');
        return;
      }
      case 'click': {
        followLink(event as MouseEvent);
        return;
      }
      case 'pageshow': {
        // It also fires at the end of the first load, when a tap may already be under way: only a bfcache return ends one.
        if (!(event as PageTransitionEvent).persisted) return;
        endPress('cancel');
        progress.finish();
        return;
      }
    }
  };

  const types = ['pointerdown', 'pointerup', 'pointercancel', 'keydown', 'keyup', 'blur', 'click', 'pageshow'];
  for (const type of types) window.addEventListener(type, handle, true);
  return () => {
    for (const type of types) window.removeEventListener(type, handle, true);
    endPress('cancel');
  };
}

const BAR: Record<ProgressPhase, CSSProperties> = {
  idle: { opacity: 0, transform: 'scaleX(0)' },
  start: { opacity: 1, transform: 'scaleX(0.7)', transition: `transform ${PROGRESS_MS.run}ms var(--ease-out)` },
  creep: { opacity: 1, transform: 'scaleX(0.92)', transition: `transform ${PROGRESS_MS.creepBy - PROGRESS_MS.run}ms linear` },
  finish: {
    opacity: 0,
    transform: 'scaleX(1)',
    transition: 'transform var(--duration-base) var(--ease-out), opacity var(--duration-base) var(--ease-out) var(--duration-fast)',
  },
};

const serverPhase = (): ProgressPhase => 'idle';

export function Tactile() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const phase = useSyncExternalStore(progress.subscribe, progress.getPhase, serverPhase);

  useEffect(connectFeedback, []); // before the press listener, so a press finds audio already unlocked
  useEffect(listenForPresses, []);
  useEffect(() => progress.finish(), [pathname, search]);

  return (
    <div
      aria-hidden="true"
      data-slot="route-progress"
      data-phase={phase}
      className="pointer-events-none fixed inset-x-0 top-0 z-(--z-toast) h-0.5 origin-left bg-accent print:hidden"
      style={BAR[phase]}
    />
  );
}
