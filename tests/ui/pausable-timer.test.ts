import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPausableTimer } from '@/lib/feedback/pausable-timer';

describe('createPausableTimer (a toast waits while you read it)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires once after its duration', () => {
    const fire = vi.fn();
    createPausableTimer(fire, 1000).start();
    vi.advanceTimersByTime(999);
    expect(fire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fire).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000);
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it('does not count while held', () => {
    const fire = vi.fn();
    const timer = createPausableTimer(fire, 1000);
    timer.start();
    vi.advanceTimersByTime(400);
    timer.hold('hover');
    vi.advanceTimersByTime(5000);
    expect(fire).not.toHaveBeenCalled();
  });

  it('runs only the remaining time after release', () => {
    const fire = vi.fn();
    const timer = createPausableTimer(fire, 1000);
    timer.start();
    vi.advanceTimersByTime(400);
    timer.hold('hover');
    vi.advanceTimersByTime(5000);
    timer.release('hover');
    vi.advanceTimersByTime(599);
    expect(fire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it('stays held until every reason is released (pointer left, focus still inside)', () => {
    const fire = vi.fn();
    const timer = createPausableTimer(fire, 1000);
    timer.start();
    timer.hold('hover');
    timer.hold('focus');
    timer.release('hover');
    vi.advanceTimersByTime(5000);
    expect(fire).not.toHaveBeenCalled();
    timer.release('focus');
    vi.advanceTimersByTime(1000);
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it('treats a repeated hold or a stray release as nothing', () => {
    const fire = vi.fn();
    const timer = createPausableTimer(fire, 1000);
    timer.start();
    timer.release('focus');
    vi.advanceTimersByTime(300);
    timer.hold('hover');
    timer.hold('hover');
    vi.advanceTimersByTime(300);
    timer.release('hover');
    vi.advanceTimersByTime(699);
    expect(fire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it('stop() cancels it for good', () => {
    const fire = vi.fn();
    const timer = createPausableTimer(fire, 1000);
    timer.start();
    timer.stop();
    vi.advanceTimersByTime(5000);
    expect(fire).not.toHaveBeenCalled();
  });

  it('a hold before start keeps it from counting until released', () => {
    const fire = vi.fn();
    const timer = createPausableTimer(fire, 1000);
    timer.hold('hover');
    timer.start();
    vi.advanceTimersByTime(5000);
    expect(fire).not.toHaveBeenCalled();
    timer.release('hover');
    vi.advanceTimersByTime(1000);
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it('a stray release after it fired does nothing', () => {
    const fire = vi.fn();
    const timer = createPausableTimer(fire, 100);
    timer.start();
    vi.advanceTimersByTime(100);
    timer.hold('hover');
    timer.release('hover');
    vi.advanceTimersByTime(1000);
    expect(fire).toHaveBeenCalledTimes(1);
  });
});
