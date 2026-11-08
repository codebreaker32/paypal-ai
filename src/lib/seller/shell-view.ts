// The seller shell's pure rules. Safe in the browser: `shell.ts` holds the server-only read.
import type { ShopStatus } from '@/lib/domain/types';

export type ShellSection = 'orders' | 'menu' | 'share' | 'settings';

export const SECTIONS: readonly ShellSection[] = ['orders', 'menu', 'share', 'settings'];

const LABEL: Record<ShellSection, string> = { orders: 'Orders', menu: 'Menu', share: 'Share', settings: 'Settings' };

export const sectionLabel = (section: ShellSection): string => LABEL[section];

/** The browser tab while a section is open. */
export const sectionTitle = (section: ShellSection, shopName: string): string => `${LABEL[section]} · ${shopName} · Shelfie`;

/** Which section `?tab=` means. Anything unknown is the dashboard's first section. */
export function sectionFromTab(tab: string | null | undefined): ShellSection {
  return tab === 'menu' || tab === 'share' || tab === 'settings' ? tab : 'orders';
}

export function sectionHref(shopId: string, section: ShellSection): string {
  return section === 'orders' ? `/shops/${shopId}` : `/shops/${shopId}?tab=${section}`;
}

/** The nav link to mark on this page: order detail belongs to Orders, the counter card to Share, setup to none. */
export function activeSection(shopId: string, pathname: string, tab: string | null): ShellSection | null {
  const base = `/shops/${shopId}`;
  if (pathname === base) return sectionFromTab(tab);
  if (pathname.startsWith(`${base}/orders`)) return 'orders';
  if (pathname.startsWith(`${base}/card`)) return 'share';
  return null;
}

export type ShellBanner = 'paypal-down' | 'payee-missing' | 'paused' | 'recovery-key';

/** One slot, one banner, in priority order. A draft isn't taking orders yet, so it isn't told to add a payee here. */
export function pickBanner(v: { paypalDown: boolean; payeeMissing: boolean; status: ShopStatus; recoveryUnsaved: boolean }): ShellBanner | null {
  if (v.paypalDown) return 'paypal-down';
  if (v.payeeMissing && v.status !== 'draft') return 'payee-missing';
  if (v.status === 'paused') return 'paused';
  if (v.recoveryUnsaved) return 'recovery-key';
  return null;
}

/** The line under the Menu heading: how many items, how many of them have the seller's own photo, how many an example. */
export function menuSummary({ total, own, examples }: { total: number; own: number; examples: number }): string {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return `${plural(total, 'item', 'items')} · ${plural(own, 'your photo', 'your photos')} · ${plural(examples, 'example', 'examples')}`;
}
