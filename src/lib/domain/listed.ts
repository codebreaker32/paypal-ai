import type { ItemStatus } from './types';

/** What a shop lists to buyers: its public page and the agent door show live items and "ask in person" ones. */
export const LISTED_STATUSES = ['live', 'in_person'] as const satisfies readonly ItemStatus[];

const LISTED: ReadonlySet<ItemStatus> = new Set(LISTED_STATUSES);

export const isListed = (item: { status: ItemStatus }): boolean => LISTED.has(item.status);

/**
 * The items on the shop's public page, in the order given. The shop's picture (`shopAvatar`) is drawn from these
 * wherever it shows, so the seller's dashboard, live step and start page show the picture buyers see.
 */
export const listedItems = <T extends { status: ItemStatus }>(items: readonly T[]): T[] => items.filter(isListed);
