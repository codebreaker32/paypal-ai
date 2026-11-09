import { isFeedbackOn } from './prefs';

export type VibrationEvent = 'add' | 'flip' | 'success' | 'error' | 'order';

const PATTERNS: Record<VibrationEvent, number | number[]> = {
  add: 10,
  flip: 10,
  success: [10, 40, 14],
  error: [20, 40, 20],
  order: [16, 60, 24],
};

type VibrateNavigator = Navigator & { userActivation?: { hasBeenActive: boolean } };

/** Vibrates where the device can. iPhones have no vibration API, so nothing happens there. */
export function vibrate(event: VibrationEvent): void {
  if (!isFeedbackOn()) return;
  try {
    const device = navigator as VibrateNavigator;
    if (device.userActivation?.hasBeenActive === false) return;
    device.vibrate?.(PATTERNS[event]);
  } catch {
    // Vibration is an extra. Without it the press still answers on screen.
  }
}
