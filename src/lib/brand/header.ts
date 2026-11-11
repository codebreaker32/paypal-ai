// What the public header shows (brief WP6, Header): the table of states as one pure function, so the page only draws it.

export interface HeaderInput {
  pathname: string;
  account: { email: string } | null;
  /** Unattached shops this browser holds a valid owner cookie for. */
  ownerShopIds: string[];
}

export type HeaderView =
  | { kind: 'bare'; logoHref: string }
  | { kind: 'account'; logoHref: '/shops'; email: string }
  | { kind: 'public'; logoHref: '/'; dashboardHref: string | null };

const BUYER_PAGE = /^\/(s|o)(\/|$)/;

/** Log in, sign up and recovery: the logo alone. Each form carries its own way to the other door, under its button (owner, run 15). */
const AUTH_PAGES = new Set(['/login', '/signup', '/recover']);

/** One owner cookie opens that shop; several are listed on the start page, so there the link would go nowhere. */
function dashboardHref(pathname: string, shopIds: string[]): string | null {
  if (shopIds.length === 0) return null;
  if (shopIds.length === 1) return `/shops/${shopIds[0]}`;
  return pathname === '/' ? null : '/';
}

export function headerView({ pathname, account, ownerShopIds }: HeaderInput): HeaderView {
  if (BUYER_PAGE.test(pathname)) return { kind: 'bare', logoHref: account ? '/shops' : '/' };
  if (account) return { kind: 'account', logoHref: '/shops', email: account.email };
  if (AUTH_PAGES.has(pathname)) return { kind: 'bare', logoHref: '/' };
  return { kind: 'public', logoHref: '/', dashboardHref: dashboardHref(pathname, ownerShopIds) };
}
