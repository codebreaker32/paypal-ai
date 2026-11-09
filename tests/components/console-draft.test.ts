import { describe, expect, it } from 'vitest';
import { composerHeight, draftWithItem, MAX_MESSAGE_CHARS, sendsOnEnter } from '@/components/shop/console-draft';

describe('draftWithItem', () => {
  it('starts an order draft', () => {
    expect(draftWithItem('', 'Almond croissant', true)).toBe('I’d like the Almond croissant');
  });

  it('starts a question when the shop is not taking orders', () => {
    expect(draftWithItem('', 'Almond croissant', false)).toBe('Tell me about the Almond croissant');
  });

  it('appends to a draft that exists', () => {
    expect(draftWithItem('I’d like the Almond croissant', 'Seeded rye', true)).toBe('I’d like the Almond croissant, and the Seeded rye');
    expect(draftWithItem('Tell me about the Almond croissant', 'Seeded rye', false)).toBe('Tell me about the Almond croissant, and the Seeded rye');
  });

  it('appends to what the buyer typed, without a space before the comma', () => {
    expect(draftWithItem('two of the cookies  \n', 'Seeded rye', true)).toBe('two of the cookies, and the Seeded rye');
  });

  it('treats a blank box as no draft', () => {
    expect(draftWithItem('  \n ', 'Seeded rye', true)).toBe('I’d like the Seeded rye');
  });

  it('allows an append that lands exactly on the limit', () => {
    const name = 'Rye';
    const current = 'x'.repeat(MAX_MESSAGE_CHARS - ', and the Rye'.length);
    expect(draftWithItem(current, name, true)).toHaveLength(MAX_MESSAGE_CHARS);
  });

  it('ignores an append that would pass the limit', () => {
    const current = 'x'.repeat(MAX_MESSAGE_CHARS - ', and the Rye'.length + 1);
    expect(draftWithItem(current, 'Rye', true)).toBe(current);
  });

  it('ignores a first draft that would pass the limit', () => {
    expect(draftWithItem('', 'y'.repeat(MAX_MESSAGE_CHARS), true)).toBe('');
  });

  it('the limit is 500 characters', () => {
    expect(MAX_MESSAGE_CHARS).toBe(500);
  });
});

describe('sendsOnEnter', () => {
  const key = (over: Partial<Parameters<typeof sendsOnEnter>[0]> = {}) => ({ key: 'Enter', shiftKey: false, isComposing: false, keyCode: 13, ...over });

  it('Enter sends', () => {
    expect(sendsOnEnter(key())).toBe(true);
  });

  it('Shift+Enter is a new line', () => {
    expect(sendsOnEnter(key({ shiftKey: true }))).toBe(false);
  });

  it('Enter that confirms an input-method composition does not send', () => {
    expect(sendsOnEnter(key({ isComposing: true }))).toBe(false);
  });

  it('Safari reports that same Enter with key code 229 after composition ends', () => {
    expect(sendsOnEnter(key({ keyCode: 229 }))).toBe(false);
  });

  it('other keys do not send', () => {
    expect(sendsOnEnter(key({ key: 'a', keyCode: 65 }))).toBe(false);
  });
});

describe('composerHeight', () => {
  // The composer's own metrics: 24 px lines, 11 px padding top and bottom, 1 px borders.
  const box = (scrollHeight: number) => composerHeight({ scrollHeight, lineHeight: 24, paddingY: 22, borderY: 2 });

  it('fits one line: 48 px, nothing to scroll', () => {
    expect(box(46)).toEqual({ height: 48, scrolls: false });
  });

  it('grows with the text', () => {
    expect(box(70)).toEqual({ height: 72, scrolls: false });
  });

  it('holds four lines without scrolling', () => {
    expect(box(118)).toEqual({ height: 120, scrolls: false });
  });

  it('stops at four lines and scrolls the rest', () => {
    expect(box(142)).toEqual({ height: 120, scrolls: true });
  });
});
