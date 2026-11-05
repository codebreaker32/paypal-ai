// Pure helpers for the review screen: applying an edit locally (before the autosave lands),
// grouping, and the words the screen uses for issues and skipped lines.
import type { IssueCode, ItemWithVariants, SkipReason, SkippedLine } from '@/lib/domain/types';
import { formatUSD } from '@/lib/domain/money';
import { cardKindFor, needsSeller } from '@/lib/catalog/rules';
import type { ItemUpdate } from './api';

/** The same change the server will make, applied to our copy right away. */
export function applyLocal(item: ItemWithVariants, u: ItemUpdate): ItemWithVariants {
  const next: ItemWithVariants = { ...item };
  if (u.name !== undefined) next.name = u.name;
  if (u.description !== undefined) next.description = u.description;
  if (u.section !== undefined) next.section = u.section;
  if (u.status !== undefined) next.status = u.status;
  if (u.soldOut !== undefined) next.soldOut = u.soldOut;
  if (u.resolveIssues) next.issues = [];
  if (u.variants) {
    next.variants = u.variants.map((v, i) => ({ id: `${item.id}-v${i}`, itemId: item.id, label: v.label, priceCents: v.priceCents, sort: i }));
  }
  return next;
}

/** Later edits win; nothing undefined is sent. */
export function mergeUpdates(a: ItemUpdate | undefined, b: ItemUpdate): ItemUpdate {
  const clean = Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined)) as ItemUpdate;
  return { ...(a ?? {}), ...clean, resolveIssues: a?.resolveIssues || b.resolveIssues || undefined };
}

export const variantsOf = (it: ItemWithVariants) => it.variants.map((v) => ({ label: v.label, priceCents: v.priceCents }));

/** "S $3.00 · L $4.00", "$4.25", or "No price". */
export function priceSummary(it: Pick<ItemWithVariants, 'variants'>): string {
  const parts = it.variants.map((v) => {
    const price = v.priceCents == null ? 'no price' : formatUSD(v.priceCents);
    return v.label ? `${v.label} ${price}` : price;
  });
  const s = parts.join(' · ');
  return s === 'no price' ? 'No price' : s;
}

export const ISSUE_LABEL: Record<IssueCode, string> = {
  MISSING_PRICE: 'No price',
  MARKET_PRICE: 'Market price',
  CHECK: 'Check this',
  DUPLICATE: 'Listed twice',
};

export const SKIP_REASON: Record<SkipReason, string> = {
  header: 'Heading',
  contact: 'Contact details',
  hours: 'Opening hours',
  policy: 'Shop policy',
  addon: 'Add-on',
  illegible: "Couldn't read it",
  instruction: 'Looked like an instruction, not a menu item',
  other: 'Not something to buy',
};

export type Card =
  | { kind: 'single'; item: ItemWithVariants }
  | { kind: 'duplicate'; key: string; items: ItemWithVariants[] };

/** Flagged items as cards, in menu order. Items listed twice share one card. */
export function flaggedCards(items: ItemWithVariants[]): Card[] {
  const cards: Card[] = [];
  const dupes = new Map<string, Card & { kind: 'duplicate' }>();
  for (const it of items) {
    if (!needsSeller(it)) continue;
    if (cardKindFor(it) === 'duplicate') {
      const key = it.name.trim().toLowerCase();
      const existing = dupes.get(key);
      if (existing) existing.items.push(it);
      else {
        const card = { kind: 'duplicate' as const, key, items: [it] };
        dupes.set(key, card);
        cards.push(card);
      }
    } else {
      cards.push({ kind: 'single', item: it });
    }
  }
  // A "duplicate" whose twin is gone (removed or already fixed) is just a check.
  return cards.map((c) => (c.kind === 'duplicate' && c.items.length === 1 ? { kind: 'single', item: c.items[0] } : c));
}

export const cardId = (c: Card) => `card-${c.kind === 'single' ? c.item.id : c.items[0].id}`;

/** Ready items grouped by their menu section, in menu order. */
export function bySection(items: ItemWithVariants[]): { section: string | null; items: ItemWithVariants[] }[] {
  const groups: { section: string | null; items: ItemWithVariants[] }[] = [];
  for (const it of items) {
    const g = groups.find((x) => x.section === it.section);
    if (g) g.items.push(it);
    else groups.push({ section: it.section, items: [it] });
  }
  return groups;
}

/** Skipped lines the seller hasn't already turned into items. */
export function openSkipped(skipped: SkippedLine[], items: ItemWithVariants[]): SkippedLine[] {
  const used = new Set(items.map((i) => i.sourceText));
  return skipped.filter((s) => !used.has(s.text));
}
