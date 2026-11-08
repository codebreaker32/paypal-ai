import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSound } from '@/lib/feedback/sound';

const KEY = 'shelfie:feedback:v1';

type ParamEvent = [kind: 'set' | 'linear' | 'exponential', value: number, at: number];

function fakeParam() {
  const events: ParamEvent[] = [];
  return {
    events,
    setValueAtTime: (value: number, at: number) => void events.push(['set', value, at]),
    linearRampToValueAtTime: (value: number, at: number) => void events.push(['linear', value, at]),
    exponentialRampToValueAtTime: (value: number, at: number) => void events.push(['exponential', value, at]),
  };
}

class FakeContext {
  static made: FakeContext[] = [];
  static initialState = 'running';
  state = FakeContext.initialState;
  currentTime = 5;
  destination = { name: 'speakers' };
  oscillators: ReturnType<FakeContext['createOscillator']>[] = [];
  gains: ReturnType<FakeContext['createGain']>[] = [];
  resume = vi.fn(async () => {
    this.state = 'running';
  });

  constructor() {
    FakeContext.made.push(this);
  }

  createOscillator() {
    const oscillator = {
      type: 'square',
      frequency: fakeParam(),
      connectedTo: null as unknown,
      started: [] as number[],
      stopped: [] as number[],
      connect(node: unknown) {
        this.connectedTo = node;
      },
      start(at: number) {
        this.started.push(at);
      },
      stop(at: number) {
        this.stopped.push(at);
      },
    };
    this.oscillators.push(oscillator);
    return oscillator;
  }

  createGain() {
    const node = {
      gain: fakeParam(),
      connectedTo: null as unknown,
      connect(target: unknown) {
        this.connectedTo = target;
      },
    };
    this.gains.push(node);
    return node;
  }
}

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

/** Holds the page's event listeners so a test can fire a gesture at them. */
function stubWindow() {
  const target = new EventTarget();
  vi.stubGlobal('window', target);
  return target;
}

const peakOf = (gain: FakeContext['gains'][number]) => Math.max(...gain.gain.events.map(([, value]) => value));

describe('sound', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    vi.useFakeTimers();
    FakeContext.made = [];
    FakeContext.initialState = 'running';
    store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    });
    vi.stubGlobal('AudioContext', FakeContext);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('getting an AudioContext', () => {
    it('makes none before a gesture, even when asked to play', () => {
      const sound = createSound();
      sound.play('tick');
      sound.play('order');
      expect(FakeContext.made).toHaveLength(0);
    });

    it('makes none just from being connected', () => {
      const page = stubWindow();
      const disconnect = createSound().connect();
      page.dispatchEvent(new Event('pointermove'));
      page.dispatchEvent(new Event('scroll'));
      expect(FakeContext.made).toHaveLength(0);
      disconnect();
    });

    it.each(['pointerdown', 'keydown'])('makes one on the first %s, and only one', (type) => {
      const page = stubWindow();
      const disconnect = createSound().connect();
      page.dispatchEvent(new Event(type));
      page.dispatchEvent(new Event(type));
      expect(FakeContext.made).toHaveLength(1);
      disconnect();
    });

    it('resumes a suspended context on a gesture', () => {
      FakeContext.initialState = 'suspended';
      const page = stubWindow();
      const disconnect = createSound().connect();
      page.dispatchEvent(new Event('pointerdown'));
      expect(FakeContext.made[0].resume).toHaveBeenCalledTimes(1);
      disconnect();
    });

    it.each(['pointerup', 'click'])('resumes on %s, where a touch counts as a gesture, without making a context', (type) => {
      FakeContext.initialState = 'suspended';
      const page = stubWindow();
      const disconnect = createSound().connect();

      page.dispatchEvent(new Event(type));
      expect(FakeContext.made).toHaveLength(0);

      page.dispatchEvent(new Event('pointerdown'));
      FakeContext.made[0].resume.mockClear();
      FakeContext.made[0].state = 'suspended';
      page.dispatchEvent(new Event(type));
      expect(FakeContext.made[0].resume).toHaveBeenCalledTimes(1);
      disconnect();
    });

    it('stops listening once disconnected', () => {
      const page = stubWindow();
      createSound().connect()();
      page.dispatchEvent(new Event('pointerdown'));
      expect(FakeContext.made).toHaveLength(0);
    });

    it('falls back to webkitAudioContext', () => {
      vi.stubGlobal('AudioContext', undefined);
      vi.stubGlobal('webkitAudioContext', FakeContext);
      createSound().unlock();
      expect(FakeContext.made).toHaveLength(1);
    });

    it('asks for the ambient audio session when the browser has one', () => {
      const audioSession = { type: 'auto' };
      vi.stubGlobal('navigator', { audioSession });
      createSound().unlock();
      expect(audioSession.type).toBe('ambient');
      expect(FakeContext.made).toHaveLength(1);
    });

    it('still makes the context when the audio session refuses', () => {
      const audioSession = {
        set type(_: string) {
          throw new Error('not allowed');
        },
      };
      vi.stubGlobal('navigator', { audioSession });
      createSound().unlock();
      expect(FakeContext.made).toHaveLength(1);
    });
  });

  describe('the tick', () => {
    it('is a sine sliding 1400 to 900 Hz over 45 ms, peak 0.04, 6 ms attack, exponential decay', () => {
      const sound = createSound();
      sound.unlock();
      sound.play('tick');

      const context = FakeContext.made[0];
      expect(context.oscillators).toHaveLength(1);
      const [oscillator] = context.oscillators;
      const [gain] = context.gains;

      expect(oscillator.type).toBe('sine');
      expect(oscillator.frequency.events).toEqual([
        ['set', 1400, 5],
        ['exponential', 900, expect.closeTo(5.045, 6)],
      ]);
      expect(oscillator.started).toEqual([5]);
      expect(oscillator.stopped[0]).toBeGreaterThanOrEqual(5.045);
      expect(oscillator.connectedTo).toBe(gain);
      expect(gain.connectedTo).toBe(context.destination);

      const [start, attack, decay] = gain.gain.events;
      expect(start[0]).toBe('set');
      expect(start[2]).toBe(5);
      expect(attack).toEqual(['linear', 0.04, expect.closeTo(5.006, 6)]);
      expect(decay[0]).toBe('exponential');
      expect(decay[1]).toBeGreaterThan(0);
      expect(decay[1]).toBeLessThan(0.001);
      expect(decay[2]).toBeCloseTo(5.045, 6);
    });

    it('plays at most once per 60 ms', () => {
      const sound = createSound();
      sound.unlock();

      sound.play('tick');
      vi.advanceTimersByTime(59);
      sound.play('tick');
      expect(FakeContext.made[0].oscillators).toHaveLength(1);

      vi.advanceTimersByTime(1);
      sound.play('tick');
      expect(FakeContext.made[0].oscillators).toHaveLength(2);
    });
  });

  describe('the add sound', () => {
    it('is a sine sliding 900 to 650 Hz over 60 ms, peak 0.05', () => {
      const sound = createSound();
      sound.unlock();
      sound.play('add');

      const context = FakeContext.made[0];
      const [oscillator] = context.oscillators;
      expect(context.oscillators).toHaveLength(1);
      expect(oscillator.type).toBe('sine');
      expect(oscillator.frequency.events).toEqual([
        ['set', 900, 5],
        ['exponential', 650, expect.closeTo(5.06, 6)],
      ]);
      expect(peakOf(context.gains[0])).toBeCloseTo(0.05, 6);
    });

    it('is not swallowed by a tick just before it', () => {
      const sound = createSound();
      sound.unlock();
      sound.play('tick');
      sound.play('add');
      expect(FakeContext.made[0].oscillators).toHaveLength(2);
    });
  });

  describe('the order chime', () => {
    it('is E5 then A5 at +90 ms, each with an octave partial at 25%, peak 0.14, over about 450 ms', () => {
      const sound = createSound();
      sound.unlock();
      sound.play('order');

      const context = FakeContext.made[0];
      const voices = context.oscillators.map((oscillator, i) => ({
        hz: oscillator.frequency.events[0][1],
        at: oscillator.started[0],
        peak: peakOf(context.gains[i]),
        attackEndsAt: context.gains[i].gain.events[1][2],
        decayEndsAt: context.gains[i].gain.events[2][2],
        decayKind: context.gains[i].gain.events[2][0],
      }));

      expect(voices).toHaveLength(4);
      expect(voices[0]).toMatchObject({ hz: 659.25, at: 5 });
      expect(voices[0].peak).toBeCloseTo(0.14, 6);
      expect(voices[1]).toMatchObject({ hz: 1318.5, at: 5 });
      expect(voices[1].peak).toBeCloseTo(0.035, 6);
      expect(voices[2].hz).toBe(880);
      expect(voices[2].at).toBeCloseTo(5.09, 6);
      expect(voices[2].peak).toBeCloseTo(0.14, 6);
      expect(voices[3].hz).toBe(1760);
      expect(voices[3].at).toBeCloseTo(5.09, 6);
      expect(voices[3].peak).toBeCloseTo(0.035, 6);

      for (const voice of voices) {
        expect(voice.attackEndsAt - voice.at).toBeCloseTo(0.006, 6);
        expect(voice.decayKind).toBe('exponential');
      }
      expect(voices[3].decayEndsAt).toBeCloseTo(5.45, 6);
    });

    it('plays at most once per 1.2 s', () => {
      const sound = createSound();
      sound.unlock();

      sound.play('order');
      vi.advanceTimersByTime(1199);
      sound.play('order');
      expect(FakeContext.made[0].oscillators).toHaveLength(4);

      vi.advanceTimersByTime(1);
      sound.play('order');
      expect(FakeContext.made[0].oscillators).toHaveLength(8);
    });
  });

  describe('a context that is not running yet', () => {
    it('plays once the context resumes, so the first touch is heard', async () => {
      FakeContext.initialState = 'suspended';
      const sound = createSound();
      sound.unlock();
      await flush();
      FakeContext.made[0].state = 'suspended';
      sound.play('tick');
      expect(FakeContext.made[0].oscillators).toHaveLength(0);

      await flush();
      expect(FakeContext.made[0].oscillators).toHaveLength(1);
    });

    it('drops a sound that would arrive late', async () => {
      FakeContext.initialState = 'suspended';
      const sound = createSound();
      sound.unlock();
      await flush();
      const context = FakeContext.made[0];
      context.state = 'suspended';
      let allow = () => {};
      context.resume.mockImplementationOnce(() => new Promise<void>((resolve) => (allow = resolve)));

      sound.play('order');
      vi.advanceTimersByTime(1000);
      allow();
      await flush();

      expect(context.oscillators).toHaveLength(0);
    });
  });

  describe('the off switch', () => {
    it('plays nothing when off', () => {
      const sound = createSound();
      sound.unlock();
      store.set(KEY, 'false');
      sound.play('tick');
      sound.play('add');
      sound.play('order');
      expect(FakeContext.made[0].oscillators).toHaveLength(0);
    });

    it('makes no context on a gesture while off', () => {
      store.set(KEY, 'false');
      const page = stubWindow();
      const disconnect = createSound().connect();
      page.dispatchEvent(new Event('pointerdown'));
      expect(FakeContext.made).toHaveLength(0);
      disconnect();
    });

    it('is ready at once when switched on after a gesture, so a chime needs no second tap', async () => {
      store.set(KEY, 'false');
      const page = stubWindow();
      const { setFeedbackOn } = await import('@/lib/feedback/prefs');
      const disconnect = createSound().connect();
      page.dispatchEvent(new Event('pointerdown'));

      setFeedbackOn(true);

      expect(FakeContext.made).toHaveLength(1);
      disconnect();
    });

    it('makes no context when switched on before any gesture', async () => {
      store.set(KEY, 'false');
      stubWindow();
      const { setFeedbackOn } = await import('@/lib/feedback/prefs');
      const disconnect = createSound().connect();

      setFeedbackOn(true);

      expect(FakeContext.made).toHaveLength(0);
      disconnect();
    });
  });

  describe('when audio fails', () => {
    it('does nothing without Web Audio', () => {
      vi.stubGlobal('AudioContext', undefined);
      const sound = createSound();
      expect(() => sound.unlock()).not.toThrow();
      expect(() => sound.play('tick')).not.toThrow();
    });

    it('survives a context that cannot be made', () => {
      vi.stubGlobal(
        'AudioContext',
        class {
          constructor() {
            throw new Error('too many contexts');
          }
        },
      );
      const sound = createSound();
      expect(() => sound.unlock()).not.toThrow();
      expect(() => sound.play('order')).not.toThrow();
    });

    it('survives a node that cannot be made', () => {
      const sound = createSound();
      sound.unlock();
      FakeContext.made[0].createOscillator = () => {
        throw new Error('no');
      };
      expect(() => sound.play('tick')).not.toThrow();
    });

    it('survives a resume that is refused', async () => {
      FakeContext.initialState = 'suspended';
      const sound = createSound();
      sound.unlock();
      await flush();
      const context = FakeContext.made[0];
      context.state = 'suspended';
      context.resume.mockImplementationOnce(() => Promise.reject(new Error('refused')));
      sound.play('tick');
      await flush();
      expect(context.oscillators).toHaveLength(0);
    });

    it('works on the server, with no window to listen on', () => {
      expect(typeof window).toBe('undefined');
      expect(() => createSound().connect()()).not.toThrow();
    });
  });
});
