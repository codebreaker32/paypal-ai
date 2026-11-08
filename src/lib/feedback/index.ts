import { vibrate, type VibrationEvent } from './haptics';
import { sound, type SoundName } from './sound';

export type FeedbackEvent = 'tick' | 'add' | 'flip' | 'success' | 'error' | 'order';

const SOUNDS: Partial<Record<FeedbackEvent, SoundName>> = { tick: 'tick', add: 'add', order: 'order' };
const VIBRATIONS: Partial<Record<FeedbackEvent, VibrationEvent>> = {
  add: 'add',
  flip: 'flip',
  success: 'success',
  error: 'error',
  order: 'order',
};

/** Announces a result to whoever listens for `shelfie:feedback`. Safe to call on the server, where it does nothing. */
export function feedback(event: FeedbackEvent): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('shelfie:feedback', { detail: { event } }));
}

/** Plays `shelfie:feedback` events as sound and vibration. Returns the function that stops it. Mounted once, by Tactile. */
export function connectFeedback(): () => void {
  if (typeof window === 'undefined') return () => {};
  const onFeedback = (e: Event) => {
    const { event } = (e as CustomEvent<{ event: FeedbackEvent }>).detail;
    const soundName = SOUNDS[event];
    const vibration = VIBRATIONS[event];
    if (soundName) sound.play(soundName);
    if (vibration) vibrate(vibration);
  };
  window.addEventListener('shelfie:feedback', onFeedback);
  const stopGestures = sound.connect();
  return () => {
    window.removeEventListener('shelfie:feedback', onFeedback);
    stopGestures();
  };
}
