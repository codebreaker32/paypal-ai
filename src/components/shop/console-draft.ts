/** The most a buyer can send in one message (the composer's `maxLength`; `send` also cuts to it). */
export const MAX_MESSAGE_CHARS = 500;

const MAX_COMPOSER_LINES = 4;

/**
 * The message box after picking an item: a new draft, or `, and the {name}` on what is already there. An item that
 * doesn't fit in one message leaves the box as it is.
 */
export function draftWithItem(current: string, name: string, takesOrders: boolean): string {
  const kept = current.trimEnd();
  const next = kept ? `${kept}, and the ${name}` : `${takesOrders ? 'I’d like the' : 'Tell me about the'} ${name}`;
  return next.length > MAX_MESSAGE_CHARS ? current : next;
}

/**
 * Enter sends; Shift+Enter is a new line. An Enter that confirms an input-method composition only confirms it: most
 * browsers mark it `isComposing`, and Safari ends the composition first and reports key code 229.
 */
export function sendsOnEnter(e: { key: string; shiftKey: boolean; isComposing: boolean; keyCode: number }): boolean {
  return e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229;
}

/** The composer's border-box height for its text, measured with `height: auto`: up to four lines, then it scrolls. */
export function composerHeight(m: { scrollHeight: number; lineHeight: number; paddingY: number; borderY: number }): { height: number; scrolls: boolean } {
  const wanted = m.scrollHeight + m.borderY;
  const most = m.lineHeight * MAX_COMPOSER_LINES + m.paddingY + m.borderY;
  return { height: Math.min(wanted, most), scrolls: wanted > most };
}
