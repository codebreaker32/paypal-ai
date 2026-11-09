/** The key in `history.state` that marks an entry the assistant pushed itself, so Back from it stays in the shop. */
const OWN_ENTRY = 'shelfieAssistantEntry';

const asRecord = (state: unknown): Record<string, unknown> | null => (state && typeof state === 'object' ? (state as Record<string, unknown>) : null);

export const isOwnEntry = (state: unknown): boolean => asRecord(state)?.[OWN_ENTRY] === true;

export const withOwnMark = (state: unknown): Record<string, unknown> => ({ ...asRecord(state), [OWN_ENTRY]: true });

/** An entry with no state stays that way: a section tab's entry has none, and Next ignores such an entry on Back. */
export function withoutOwnMark(state: unknown): unknown {
  const record = asRecord(state);
  if (!record || !(OWN_ENTRY in record)) return state;
  const rest = { ...record };
  delete rest[OWN_ENTRY];
  return rest;
}

/**
 * The URL with its panel params saying what the page shows. `router.refresh()` writes back the URL Next last knew, and
 * Next never hears about these params (they go through the browser's own `history` methods), so they must be put back.
 */
export function urlWithPanels(href: string, panels: { assistant: boolean; order: string | null; item: string | null }): URL {
  const url = new URL(href);
  const put = (name: string, value: string | null) => (value === null ? url.searchParams.delete(name) : url.searchParams.set(name, value));
  put('assistant', panels.assistant ? '1' : null);
  put('order', panels.order);
  put('item', panels.item);
  return url;
}

export interface HistoryMove {
  /** This page called `history.back()` to close the assistant, and this is the move it asked for. */
  closing: boolean;
  /** From 1024 px, where the assistant is a dock beside the page. */
  docked: boolean;
  /** The entry just reached has `?assistant=1`. */
  inUrl: boolean;
  /** The entry just reached was pushed by the assistant. */
  ownMark: boolean;
  open: boolean;
}

export interface HistoryStep {
  open: boolean;
  /** Closing this assistant may step Back, because the entry was pushed by it. */
  ownEntry: boolean;
  /** The entry's URL no longer says what the assistant shows, so rewrite it. */
  fixUrl: boolean;
}

/**
 * What a Back or Forward does to the assistant. A modal form belongs to its history entry, so it follows the URL. The
 * dock sits beside the page and its entries are section tabs and the like: moving among them never opens or closes it.
 */
export function afterHistoryMove({ closing, docked, inUrl, ownMark, open }: HistoryMove): HistoryStep {
  if (closing) return { open: false, ownEntry: false, fixUrl: inUrl };
  if (docked) return { open, ownEntry: false, fixUrl: inUrl !== open };
  return { open: inUrl, ownEntry: inUrl && ownMark, fixUrl: false };
}
