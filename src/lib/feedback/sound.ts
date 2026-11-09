import { isFeedbackOn, subscribeFeedback } from './prefs';

/*
 * Every sound is drawn with an OscillatorNode and a GainNode, so there are no files to load. Browsers only let audio
 * start from a user gesture, so nothing here makes an AudioContext before the first pointerdown or keydown. Sound is an
 * extra on top of the visual response: if any of it fails, the failure stops here.
 */

export type SoundName = 'tick' | 'add' | 'order';

const ATTACK_S = 0.006;
/** Exponential ramps can't reach zero. This is 80 dB down, which is silence. */
const SILENT = 0.0001;

const MIN_GAP_MS: Partial<Record<SoundName, number>> = { tick: 60, order: 1200 };
/** A sound still waiting on a blocked context after this long would no longer match what caused it. */
const STALE_MS = 250;

const CAPTURE = { capture: true };

const CHIME_NOTES = [
  { hz: 659.25, delay: 0 },
  { hz: 880, delay: 0.09 },
];
const CHIME_PEAK = 0.14;
const CHIME_PARTIAL = 0.25;
const CHIME_NOTE_S = 0.36;

interface Voice {
  at: number;
  from: number;
  to?: number;
  seconds: number;
  peak: number;
}

function playVoice(context: AudioContext, { at, from, to, seconds, peak }: Voice): void {
  const end = at + seconds;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(from, at);
  if (to !== undefined) oscillator.frequency.exponentialRampToValueAtTime(to, end);

  gain.gain.setValueAtTime(SILENT, at);
  gain.gain.linearRampToValueAtTime(peak, at + ATTACK_S);
  gain.gain.exponentialRampToValueAtTime(SILENT, end);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(at);
  oscillator.stop(end + 0.01);
}

function render(context: AudioContext, name: SoundName): void {
  const at = context.currentTime;
  if (name === 'tick') {
    playVoice(context, { at, from: 1400, to: 900, seconds: 0.045, peak: 0.04 });
  } else if (name === 'add') {
    playVoice(context, { at, from: 900, to: 650, seconds: 0.06, peak: 0.05 });
  } else {
    for (const { hz, delay } of CHIME_NOTES) {
      const note = { at: at + delay, seconds: CHIME_NOTE_S };
      playVoice(context, { ...note, from: hz, peak: CHIME_PEAK });
      playVoice(context, { ...note, from: hz * 2, peak: CHIME_PEAK * CHIME_PARTIAL });
    }
  }
}

function newContext(): AudioContext | null {
  try {
    (navigator as Navigator & { audioSession?: { type: string } }).audioSession!.type = 'ambient';
  } catch {
    // Most browsers don't have an audio session to set. The context works without one.
  }
  const scope = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  const Context = scope.AudioContext ?? scope.webkitAudioContext;
  return Context ? new Context() : null;
}

function resume(context: AudioContext): Promise<void> {
  return Promise.resolve(context.resume());
}

export function createSound() {
  let context: AudioContext | null = null;
  let gestured = false;
  const lastPlayedAt: Partial<Record<SoundName, number>> = {};

  /** Makes or wakes the context. Only for use inside a user gesture. */
  function unlock(): void {
    if (!isFeedbackOn()) return;
    try {
      context ??= newContext();
      if (context && context.state !== 'running') void resume(context).catch(() => {});
    } catch {
      // No audio on this device. Everything else carries on.
    }
  }

  function wake(): void {
    if (context) unlock();
  }

  function renderSafely(active: AudioContext, name: SoundName): void {
    try {
      render(active, name);
    } catch {
      // A sound that can't be drawn is simply not heard.
    }
  }

  function play(name: SoundName): void {
    if (!context || !isFeedbackOn()) return;
    const now = performance.now();
    const gap = MIN_GAP_MS[name];
    const last = lastPlayedAt[name];
    if (gap !== undefined && last !== undefined && now - last < gap) return;
    lastPlayedAt[name] = now;

    const active = context;
    if (active.state === 'running') {
      renderSafely(active, name);
      return;
    }
    // A first touch reaches here before the browser counts it as a gesture, so wait for the release to wake the context.
    try {
      void resume(active)
        .then(() => {
          if (performance.now() - now <= STALE_MS) renderSafely(active, name);
        })
        .catch(() => {});
    } catch {
      // Same as above: not heard, and nothing else affected.
    }
  }

  /** Listens for the gestures that allow audio. Returns the function that stops listening. */
  function connect(): () => void {
    if (typeof window === 'undefined') return () => {};
    const onGesture = () => {
      gestured = true;
      unlock();
    };
    const creating = ['pointerdown', 'keydown'];
    // A touch only counts as a gesture once it lifts, so a context made on its pointerdown is still suspended.
    const waking = ['pointerup', 'click'];
    for (const type of creating) window.addEventListener(type, onGesture, CAPTURE);
    for (const type of waking) window.addEventListener(type, wake, CAPTURE);
    const unsubscribe = subscribeFeedback(() => {
      if (gestured) unlock();
    });
    return () => {
      for (const type of creating) window.removeEventListener(type, onGesture, CAPTURE);
      for (const type of waking) window.removeEventListener(type, wake, CAPTURE);
      unsubscribe();
    };
  }

  return { unlock, play, connect };
}

export const sound = createSound();
