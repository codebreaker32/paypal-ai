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

export interface FooterGroup {
  label: string;
  links: FooterLink[];
}

const SITE_PAGE = /^\/(help|terms|privacy)?\/?$/;
const BUYER_PAGE = /^\/(s|o)(\/|$)/;

/** Everything not listed in the brief (log in, sign up, setup, a 404) gets the one-row footer, as the seller's pages do. */
export function footerKind(pathname: string): FooterKind {
  if (BUYER_PAGE.test(pathname)) return 'buyer';
  return SITE_PAGE.test(pathname) ? 'site' : 'compact';
}

export const FOOTER_GROUPS: FooterGroup[] = [
  {
    label: 'Product',
    links: [
      { label: 'Add your shop', href: '/signup' },
      { label: 'Log in', href: '/login' },
    ],
  },
  { label: 'Help', links: [{ label: 'Help', href: '/help' }] },
  {
    label: 'For AI assistants',
    links: [
      { label: 'agents.txt', href: '/agents.txt', native: true },
      { label: 'llms.txt', href: '/llms.txt', native: true },
    ],
  },
  {
    label: 'Legal',
    links: [
      { label: 'Terms', href: '/terms' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Open source on GitHub', href: REPO_URL, native: true },
    ],
  },
];

/** The links beside the sentence on buyer pages. */
export const BUYER_LINKS: FooterLink[] = [
  { label: 'Terms', href: '/terms' },
  { label: 'Privacy', href: '/privacy' },
];

/** The links beside the sentence on the one-row footer. */
export const COMPACT_LINKS: FooterLink[] = [{ label: 'Help', href: '/help' }, ...BUYER_LINKS];
