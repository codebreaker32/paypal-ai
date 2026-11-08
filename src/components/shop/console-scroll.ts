/** A buyer this close to the bottom at their last scroll is following the reply as it streams in. */
export const FOLLOW_WITHIN_PX = 96;

/** Why the log may need to move: `restored` is a log shown with entries already in it. */
export type ScrollCause = 'restored' | 'message' | 'approval' | 'stream' | 'none';

export interface SeenEntries {
  count: number;
  user: string | null;
  approval: string | null;
}

type Keyed = { kind: string; key: string };

const lastKeyOf = (entries: Keyed[], kind: string) => entries.findLast((e) => e.kind === kind)?.key ?? null;

export function noteEntries(entries: Keyed[]): SeenEntries {
  return { count: entries.length, user: lastKeyOf(entries, 'user'), approval: lastKeyOf(entries, 'approval') };
}

export function nearBottom({ scrollHeight, clientHeight, scrollTop }: { scrollHeight: number; clientHeight: number; scrollTop: number }): boolean {
  return scrollHeight - clientHeight - scrollTop <= FOLLOW_WITHIN_PX;
}

/** What changed since the log was last placed. `restored` is how many entries came back from sessionStorage. */
export function scrollCause(seen: SeenEntries | null, entries: Keyed[], restored: number): ScrollCause {
  if (!entries.length) return 'none';
  if (seen === null || (seen.count === 0 && restored > 0)) return 'restored';
  const now = noteEntries(entries);
  if (now.approval !== null && now.approval !== seen.approval) return 'approval';
  if (now.user !== seen.user) return 'message';
  return 'stream';
}

export interface ScrollPosition {
  scrollTop: number;
  /** The scrollTop that shows the end of the log. */
  toEnd: number;
  /** The scrollTop that puts the latest turn's start at the top of the log. */
  toStart: number;
  /** Near the bottom at the buyer's last scroll. */
  following: boolean;
  /** A restored log or an approval card has already taken the log past the turn's start. */
  pastTurnStart: boolean;
}

/** The scrollTop to move to, or null to leave the buyer's place alone. */
export function scrollTarget(cause: ScrollCause, { scrollTop, toEnd, toStart, following, pastTurnStart }: ScrollPosition): number | null {
  if (cause === 'none') return null;
  if (cause !== 'stream') return toEnd;
  if (!following) return null;
  const target = pastTurnStart ? toEnd : Math.min(toEnd, toStart);
  return target > scrollTop ? target : null;
}
