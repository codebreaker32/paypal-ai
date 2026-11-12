// What the public footer shows: the table of pages, so the component only draws it.

export type FooterKind = 'site' | 'buyer' | 'compact';

/** The repository the README clones. */
export const REPO_URL = 'https://github.com/codebreaker32/paypal-ai';

export interface FooterLink {
  label: string;
  href: string;
  /** Not a page of this app (a route handler or another site), so it is a plain `<a>`. */
  native?: boolean;
}

const SITE_PAGE = /^\/(browse|help|terms|privacy)?\/?$/;
const BUYER_PAGE = /^\/(s|o)(\/|$)/;

/** Everything not listed above (log in, sign up, setup, a 404) gets the one-row footer, as the seller's pages do. */
export function footerKind(pathname: string): FooterKind {
  if (BUYER_PAGE.test(pathname)) return 'buyer';
  return SITE_PAGE.test(pathname) ? 'site' : 'compact';
}

/** A titled column of the public site's footer. */
export interface FooterGroup {
  title: string;
  links: FooterLink[];
}

/** The public site's link columns, in reading order. */
export const FOOTER_GROUPS: FooterGroup[] = [
  {
    title: 'Shelfie',
    links: [
      { label: 'Browse shops', href: '/browse' },
      { label: 'How it works', href: '/#how-it-works' },
      { label: 'FAQ', href: '/#faq' },
      { label: 'Help', href: '/help' },
    ],
  },
  {
    title: 'For AI assistants',
    links: [
      { label: 'agents.txt', href: '/agents.txt', native: true },
      { label: 'llms.txt', href: '/llms.txt', native: true },
    ],
  },
  {
    title: 'The project',
    links: [
      { label: 'Terms', href: '/terms' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Open source on GitHub', href: REPO_URL, native: true },
    ],
  },
];

/** One line under the logo: what Shelfie is. */
export const FOOTER_BLURB = 'A photo of your price list becomes a shop that people and AI assistants can order from, paid through PayPal.';

/** The links beside the sentence on buyer pages. */
export const BUYER_LINKS: FooterLink[] = [
  { label: 'Terms', href: '/terms' },
  { label: 'Privacy', href: '/privacy' },
];

/** The links beside the sentence on the one-row footer. */
export const COMPACT_LINKS: FooterLink[] = [{ label: 'Help', href: '/help' }, ...BUYER_LINKS];
