// What the public footer shows (brief WP7, Footer): the table of pages, so the component only draws it.

export type FooterKind = 'site' | 'buyer' | 'compact';

/** The repository the README clones. */
export const REPO_URL = 'https://github.com/codebreaker32/paypal-ai';

export interface FooterLink {
  label: string;
  href: string;
  /** Not a page of this app (a route handler or another site), so it is a plain `<a>`. */
  native?: boolean;
}

const SITE_PAGE = /^\/(help|terms|privacy)?\/?$/;
const BUYER_PAGE = /^\/(s|o)(\/|$)/;

/** Everything not listed in the brief (log in, sign up, setup, a 404) gets the one-row footer, as the seller's pages do. */
export function footerKind(pathname: string): FooterKind {
  if (BUYER_PAGE.test(pathname)) return 'buyer';
  return SITE_PAGE.test(pathname) ? 'site' : 'compact';
}

/** The public site's main row. */
export const FOOTER_NAV: FooterLink[] = [
  { label: 'Product', href: '/#how-it-works' },
  { label: 'Help', href: '/help' },
  { label: 'Legal', href: '/terms' },
  { label: 'Open Source', href: REPO_URL, native: true },
];

/** The public site's small row, beside the test-mode sentence. */
export const FOOTER_SMALL: FooterLink[] = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'agents.txt', href: '/agents.txt', native: true },
  { label: 'llms.txt', href: '/llms.txt', native: true },
];

/** The links beside the sentence on buyer pages. */
export const BUYER_LINKS: FooterLink[] = [
  { label: 'Terms', href: '/terms' },
  { label: 'Privacy', href: '/privacy' },
];

/** The links beside the sentence on the one-row footer. */
export const COMPACT_LINKS: FooterLink[] = [{ label: 'Help', href: '/help' }, ...BUYER_LINKS];
