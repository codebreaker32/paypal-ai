import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPressMachine, type PressMachine } from '@/lib/feedback/press-machine';

/** `pressed` is what the control shows; `applied` and `cleared` count the attribute writes. */
function setup(): { machine: PressMachine; log: { pressed: boolean; applied: number; cleared: number } } {
  const log = { pressed: false, applied: 0, cleared: 0 };
  const machine = createPressMachine({
    apply: () => {
      log.pressed = true;
      log.applied += 1;
    },
    clear: () => {
      log.pressed = false;
      log.cleared += 1;
    },
  });
  return { machine, log };
}

describe('press machine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('mouse', () => {
    it('applies immediately on down', () => {
      const { machine, log } = setup();
      machine.down('mouse');
      expect(log.pressed).toBe(true);
    });

    it('keeps a short click visible until 110 ms after it applied', () => {
      const { machine, log } = setup();
      machine.down('mouse');
      vi.advanceTimersByTime(20);
      machine.up();
      expect(log.pressed).toBe(true);
      vi.advanceTimersByTime(89);
      expect(log.pressed).toBe(true);
      vi.advanceTimersByTime(1);
      expect(log.pressed).toBe(false);
    });

    it('clears at once on release after a 300 ms hold', () => {
      const { machine, log } = setup();
      machine.down('mouse');
      vi.advanceTimersByTime(300);
      expect(log.pressed).toBe(true);
      machine.up();
      expect(log.pressed).toBe(false);
    });
  });

  describe.each(['touch', 'pen'] as const)('%s', (input) => {
    it('does not apply before 50 ms and applies at 50 ms', () => {
      const { machine, log } = setup();
      machine.down(input);
      vi.advanceTimersByTime(49);
      expect(log.pressed).toBe(false);
      vi.advanceTimersByTime(1);
      expect(log.pressed).toBe(true);
    });

    it('applies a 20 ms tap on lift and clears it 110 ms later', () => {
      const { machine, log } = setup();
      machine.down(input);
      vi.advanceTimersByTime(20);
      expect(log.pressed).toBe(false);
      machine.up();
      expect(log.pressed).toBe(true);
      vi.advanceTimersByTime(109);
      expect(log.pressed).toBe(true);
      vi.advanceTimersByTime(1);
      expect(log.pressed).toBe(false);
    });

    it('never applies when cancelled before arming', () => {
      const { machine, log } = setup();
      machine.down(input);
      vi.advanceTimersByTime(30);
      machine.cancel();
      vi.advanceTimersByTime(1000);
      expect(log.applied).toBe(0);
      expect(log.pressed).toBe(false);
    });

    it('clears at once on release after a 300 ms hold', () => {
      const { machine, log } = setup();
      machine.down(input);
      vi.advanceTimersByTime(300);
      expect(log.pressed).toBe(true);
      machine.up();
      expect(log.pressed).toBe(false);
    });

    it('measures the hold from apply, not from touch down', () => {
      const { machine, log } = setup();
      machine.down(input);
      vi.advanceTimersByTime(60); // applied at 50, so only 10 ms of the hold has passed
      machine.up();
      expect(log.pressed).toBe(true);
      vi.advanceTimersByTime(99);
      expect(log.pressed).toBe(true);
      vi.advanceTimersByTime(1);
      expect(log.pressed).toBe(false);
    });

    it('clears at once when cancelled after it applied (the finger started a scroll)', () => {
      const { machine, log } = setup();
      machine.down(input);
      vi.advanceTimersByTime(70);
      expect(log.pressed).toBe(true);
      machine.cancel();
      expect(log.pressed).toBe(false);
    });
  });

  describe('keyboard', () => {
    it('applies on key down and holds the 110 ms minimum after a quick key up', () => {
      const { machine, log } = setup();
      machine.down('keyboard');
      expect(log.pressed).toBe(true);
      vi.advanceTimersByTime(30);
      machine.up();
      expect(log.pressed).toBe(true);
      vi.advanceTimersByTime(80);
      expect(log.pressed).toBe(false);
    });

    it('clears at once on key up after the hold', () => {
      const { machine, log } = setup();
      machine.down('keyboard');
      vi.advanceTimersByTime(200);
      machine.up();
      expect(log.pressed).toBe(false);
    });
  });

  describe('repeated presses', () => {
    it('applies and clears exactly once per press', () => {
      const { machine, log } = setup();
      machine.down('touch');
      vi.advanceTimersByTime(60);
      machine.up();
      vi.advanceTimersByTime(500);
      expect(log).toEqual({ pressed: false, applied: 1, cleared: 1 });
    });

    it('stays pressed when a new press lands inside the hold of the last one', () => {
      const { machine, log } = setup();
      machine.down('touch');
      vi.advanceTimersByTime(20);
      machine.up(); // applied, would clear 110 ms from now
      vi.advanceTimersByTime(60);
      machine.down('touch');
      vi.advanceTimersByTime(60); // past the first press's clear time
      expect(log.pressed).toBe(true);
      expect(log.cleared).toBe(0);
      vi.advanceTimersByTime(240);
      machine.up();
      expect(log.pressed).toBe(false);
      expect(log.cleared).toBe(1);
    });

    it('can be pressed again after it has cleared', () => {
      const { machine, log } = setup();
      machine.down('mouse');
      vi.advanceTimersByTime(200);
      machine.up();
      machine.down('mouse');
      expect(log.pressed).toBe(true);
      expect(log.applied).toBe(2);
    });

    it('ignores release and cancel when nothing is pressed', () => {
      const { machine, log } = setup();
      machine.up();
      machine.cancel();
      vi.advanceTimersByTime(500);
      expect(log).toEqual({ pressed: false, applied: 0, cleared: 0 });
    });
  });
});

describe('press machine: the press that counts (the tick)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function counted() {
    const log = { presses: 0, pressedWhenCounted: [] as boolean[] };
    let pressed = false;
    const machine = createPressMachine({
      apply: () => {
        pressed = true;
      },
      clear: () => {
        pressed = false;
      },
      press: () => {
        log.presses += 1;
        log.pressedWhenCounted.push(pressed);
      },
    });
    return { machine, log };
  }

  it.each(['mouse', 'keyboard'] as const)('%s counts once, the moment the press shows', (input) => {
    const { machine, log } = counted();
    machine.down(input);
    expect(log.presses).toBe(1);
    expect(log.pressedWhenCounted).toEqual([true]);
    machine.up();
    vi.advanceTimersByTime(500);
    expect(log.presses).toBe(1);
  });

  it('a second click while the first still shows counts too', () => {
    const { machine, log } = counted();
    machine.down('mouse');
    vi.advanceTimersByTime(20);
    machine.up();
    vi.advanceTimersByTime(40);
    machine.down('mouse');
    expect(log.presses).toBe(2);
  });

  describe.each(['touch', 'pen'] as const)('%s', (input) => {
    it('counts a quick tap once, on lift', () => {
      const { machine, log } = counted();
      machine.down(input);
      vi.advanceTimersByTime(20);
      expect(log.presses).toBe(0);
      machine.up();
      expect(log.presses).toBe(1);
    });

    it('does not count a finger still resting after the press shows: it may yet be a scroll', () => {
      const { machine, log } = counted();
      machine.down(input);
      vi.advanceTimersByTime(300);
      expect(log.presses).toBe(0);
      machine.up();
      expect(log.presses).toBe(1);
    });

    it('never counts a finger that turned into a scroll, before or after the press showed', () => {
      const early = counted();
      early.machine.down(input);
      vi.advanceTimersByTime(20);
      early.machine.cancel();

      const late = counted();
      late.machine.down(input);
      vi.advanceTimersByTime(120);
      late.machine.cancel();
      late.machine.up();

      expect([early.log.presses, late.log.presses]).toEqual([0, 0]);
    });

    it('counts a second tap while the first still shows, once each', () => {
      const { machine, log } = counted();
      machine.down(input);
      vi.advanceTimersByTime(60);
      machine.up();
      machine.down(input);
      vi.advanceTimersByTime(20);
      machine.up();
      machine.up();
      expect(log.presses).toBe(2);
    });
  });

  it('works with no press effect', () => {
    const machine = createPressMachine({ apply: () => {}, clear: () => {} });
    expect(() => {
      machine.down('mouse');
      machine.up();
    }).not.toThrow();
  });
});
