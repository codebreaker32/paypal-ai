import { describe, expect, it } from 'vitest';
import { FOLLOW_WITHIN_PX, nearBottom, noteEntries, scrollCause, scrollTarget } from '@/components/shop/console-scroll';

type E = { kind: 'user' | 'assistant' | 'activity' | 'approval' | 'error'; key: string };
const user = (key: string): E => ({ kind: 'user', key });
const said = (key: string): E => ({ kind: 'assistant', key });
const card = (key: string): E => ({ kind: 'approval', key });

describe('nearBottom', () => {
  it('counts the buyer as following within 96 px of the bottom', () => {
    expect(FOLLOW_WITHIN_PX).toBe(96);
    expect(nearBottom({ scrollHeight: 1000, clientHeight: 400, scrollTop: 600 })).toBe(true);
    expect(nearBottom({ scrollHeight: 1000, clientHeight: 400, scrollTop: 504 })).toBe(true);
    expect(nearBottom({ scrollHeight: 1000, clientHeight: 400, scrollTop: 503 })).toBe(false);
  });
});

describe('scrollCause', () => {
  it('a log shown with entries is restored', () => {
    expect(scrollCause(null, [user('e1'), said('e2')], 0)).toBe('restored');
  });

  it('entries loaded from storage into an empty log are restored', () => {
    expect(scrollCause(noteEntries([]), [user('e1'), said('e2')], 2)).toBe('restored');
  });

  it('the first message in an empty log is a message', () => {
    expect(scrollCause(noteEntries([]), [user('e1')], 0)).toBe('message');
  });

  it('a new buyer message is a message', () => {
    expect(scrollCause(noteEntries([user('e1'), said('e2')]), [user('e1'), said('e2'), user('e3')], 2)).toBe('message');
  });

  it('a new approval card wins over everything else in the same update', () => {
    const before = noteEntries([user('e1')]);
    expect(scrollCause(before, [user('e1'), said('e2'), card('e3')], 0)).toBe('approval');
    expect(scrollCause(before, [user('e1'), user('e2'), card('e3')], 0)).toBe('approval');
  });

  it('an approval card already seen is not news', () => {
    const entries = [user('e1'), card('e2')];
    expect(scrollCause(noteEntries(entries), [...entries, said('e3')], 0)).toBe('stream');
  });

  it('more reply is a stream', () => {
    expect(scrollCause(noteEntries([user('e1')]), [user('e1'), said('e2')], 0)).toBe('stream');
  });

  it('an empty log needs nothing', () => {
    expect(scrollCause(null, [], 0)).toBe('none');
    expect(scrollCause(noteEntries([user('e1')]), [], 0)).toBe('none');
  });
});

describe('scrollTarget', () => {
  const base = { scrollTop: 100, toEnd: 900, toStart: 400, following: true, pastTurnStart: false };

  it('nothing to do', () => {
    expect(scrollTarget('none', base)).toBeNull();
  });

  it('a new message goes to the end, even for a buyer who scrolled away', () => {
    expect(scrollTarget('message', { ...base, following: false })).toBe(900);
  });

  it('a restored log goes to the end', () => {
    expect(scrollTarget('restored', { ...base, following: false })).toBe(900);
  });

  it('a fresh approval card goes to the end, past the start of the turn and for a buyer who scrolled away', () => {
    expect(scrollTarget('approval', { ...base, following: false })).toBe(900);
  });

  it('a stream follows a buyer at the bottom, up to the start of the turn', () => {
    expect(scrollTarget('stream', base)).toBe(400);
    expect(scrollTarget('stream', { ...base, toEnd: 300 })).toBe(300);
  });

  it('a stream leaves a buyer who scrolled away alone', () => {
    expect(scrollTarget('stream', { ...base, following: false })).toBeNull();
  });

  it('a stream never moves up', () => {
    expect(scrollTarget('stream', { ...base, scrollTop: 500 })).toBeNull();
    expect(scrollTarget('stream', { ...base, scrollTop: 400 })).toBeNull();
  });

  it('once the turn start is overridden, a stream follows to the end', () => {
    expect(scrollTarget('stream', { ...base, pastTurnStart: true })).toBe(900);
  });
});
