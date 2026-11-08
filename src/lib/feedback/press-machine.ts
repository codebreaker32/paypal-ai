/*
 * The timing of one control's pressed look. No DOM here: Tactile (components/motion/tactile.tsx) feeds it input events
 * and it answers through `apply` and `clear`.
 *
 * A mouse or key means the person chose this control, so the press shows at once. A finger might be starting a scroll,
 * so it waits a moment: only a touch still resting after ARM_MS is treated as a press. A tap too quick for that shows on
 * lift, and every press stays visible for MIN_HOLD_MS or it would be a flicker nobody sees.
 */

export const ARM_MS = 50;
export const MIN_HOLD_MS = 110;

export type PressInput = 'mouse' | 'touch' | 'pen' | 'keyboard';

export interface PressEffects {
  apply: () => void;
  clear: () => void;
}

export interface PressMachine {
  down: (input: PressInput) => void;
  /** The finger, button or key came up: the press happened. */
  up: () => void;
  /** The press did not happen (the finger started a scroll, the window lost focus). */
  cancel: () => void;
}

export function createPressMachine({ apply, clear }: PressEffects): PressMachine {
  let phase: 'idle' | 'armed' | 'held' | 'lingering' = 'idle';
  let appliedAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const stopTimer = () => {
    clearTimeout(timer);
    timer = undefined;
  };

  const hold = () => {
    apply();
    appliedAt = Date.now();
    phase = 'held';
  };

  const finish = () => {
    stopTimer();
    phase = 'idle';
    clear();
  };

  return {
    down(input) {
      stopTimer();
      if (phase === 'held' || phase === 'lingering') {
        // Already showing as pressed: keep it up, and count the hold from this press.
        appliedAt = Date.now();
        phase = 'held';
        return;
      }
      if (input === 'mouse' || input === 'keyboard') {
        hold();
        return;
      }
      phase = 'armed';
      timer = setTimeout(hold, ARM_MS);
    },

    up() {
      if (phase === 'armed') {
        stopTimer();
        hold();
      }
      if (phase !== 'held') return;
      const remaining = appliedAt + MIN_HOLD_MS - Date.now();
      if (remaining <= 0) {
        finish();
        return;
      }
      phase = 'lingering';
      timer = setTimeout(finish, remaining);
    },

    cancel() {
      if (phase === 'idle') return;
      if (phase === 'armed') {
        stopTimer();
        phase = 'idle';
        return;
      }
      finish();
    },
  };
}
