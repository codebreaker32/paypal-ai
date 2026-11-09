import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sound = vi.hoisted(() => ({ play: vi.fn(), connect: vi.fn(), unlock: vi.fn() }));
const vibrate = vi.hoisted(() => vi.fn());
vi.mock('@/lib/feedback/sound', () => ({ sound }));
vi.mock('@/lib/feedback/haptics', () => ({ vibrate }));

import { connectFeedback, feedback, type FeedbackEvent } from '@/lib/feedback';

describe('feedback channels', () => {
  let stopGestures: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    stopGestures = vi.fn();
    sound.connect.mockReturnValue(stopGestures);
    vi.stubGlobal('window', new EventTarget());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each<[FeedbackEvent, string | null, boolean]>([
    ['tick', 'tick', false],
    ['add', 'add', true],
    ['flip', null, true],
    ['success', null, true],
    ['error', null, true],
    ['order', 'order', true],
  ])('routes %s to the right channels', (event, played, vibrates) => {
    const disconnect = connectFeedback();

    feedback(event);

    expect(sound.play.mock.calls).toEqual(played ? [[played]] : []);
    expect(vibrate.mock.calls).toEqual(vibrates ? [[event]] : []);
    disconnect();
  });

  it('does nothing through the channels until connected', () => {
    feedback('order');
    expect(sound.play).not.toHaveBeenCalled();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('starts listening for the gestures that allow audio', () => {
    const disconnect = connectFeedback();
    expect(sound.connect).toHaveBeenCalledTimes(1);
    disconnect();
  });

  it('stops every channel when disconnected', () => {
    connectFeedback()();

    feedback('order');

    expect(stopGestures).toHaveBeenCalledTimes(1);
    expect(sound.play).not.toHaveBeenCalled();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('ignores an event name it does not know', () => {
    const disconnect = connectFeedback();
    window.dispatchEvent(new CustomEvent('shelfie:feedback', { detail: { event: 'nonsense' } }));
    expect(sound.play).not.toHaveBeenCalled();
    expect(vibrate).not.toHaveBeenCalled();
    disconnect();
  });

  it('connects to nothing on the server', () => {
    vi.unstubAllGlobals();
    expect(typeof window).toBe('undefined');
    expect(() => connectFeedback()()).not.toThrow();
    expect(sound.connect).not.toHaveBeenCalled();
  });
});
