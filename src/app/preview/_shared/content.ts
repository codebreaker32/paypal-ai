// What every preview direction says: the same product truth, so the three differ in design and not in claims.
// Claims come from docs/DEMO.md, "Facts we may say". Directions may tighten the wording but may not add a claim.
import { LIVE_SHOP_HREF } from '@/app/_start/samples';
import { formatUSD } from '@/lib/domain/money';

export { TEST_MODE_LINE } from '@/lib/brand/test-mode';
export { FOOTER_GROUPS, type FooterGroup, type FooterLink } from '@/lib/brand/footer';

export const NAV = {
  how: { label: 'How it works', href: '#how-it-works' },
  faq: { label: 'FAQ', href: '#faq' },
  login: { label: 'Log in', href: '/login' },
  signup: { label: 'Add your shop', href: '/signup' },
  example: { label: 'See an example shop', href: LIVE_SHOP_HREF },
} as const;

export const HERO = {
  title: 'Your price list, open to AI shoppers.',
  lead: 'Snap the paper menu on your counter. Shelfie turns it into a PayPal shop any AI assistant can order from.',
} as const;

const DEMO = '/demo/marigold-bakehouse';

/** Marigold Bakehouse as seeded (scripts/seed-demo.ts): the photo of its paper price list, its real prices and photos. */
export const SHOP = {
  name: 'Marigold Bakehouse',
  meta: 'Pickup or shipping · Paid with PayPal',
  paperMenu: '/samples/marigold-bakehouse.jpg',
  cover: `${DEMO}/cover.jpg`,
  items: [
    { name: 'Almond croissant', cents: 500, photo: `${DEMO}/almond-croissant.jpg` },
    { name: 'Country sourdough loaf', cents: 900, photo: `${DEMO}/country-sourdough-loaf.jpg` },
    { name: 'Cardamom bun', cents: 350, photo: `${DEMO}/cardamom-bun.jpg` },
    { name: 'Butter croissant', cents: 425, photo: `${DEMO}/butter-croissant.jpg` },
  ],
} as const;

/** One order, followed through the whole story. */
export const ORDER = {
  ask: '2 almond croissants and a sourdough, shipped',
  ref: 'SHF-K7F2QX',
  buyer: 'Dana R.',
  lines: [
    { qty: 2, name: 'Almond croissant', cents: 500 },
    { qty: 1, name: 'Country sourdough loaf', cents: 900 },
  ],
  shippingCents: 800,
  totalCents: 2700,
  approveLabel: `Approve ${formatUSD(2700)} on PayPal`,
  brief: 'Ships to Austin. The almond croissants contain nuts, so pack them apart from the loaf.',
  /** The one item Claude stops to ask about while reading the paper. */
  question: { item: 'Pain au chocolat', ask: 'Is this $4 or $14?' },
} as const;

/** The four steps. Each caption is at most 12 words. */
export const STEPS = [
  { title: 'Snap your price list', caption: 'One photo of the paper on your counter.' },
  { title: 'Claude reads it', caption: 'It asks about anything unclear, and you check every line.' },
  { title: 'Your shop opens', caption: 'A PayPal shop with an agent door for AI assistants.' },
  { title: 'Orders arrive paid', caption: 'Buyers approve on PayPal. You get a short brief.' },
] as const;

/**
 * Example shops of the demo, in three trades. They are demonstrations and must read as such ("Example shop"): never as
 * customers, logos or testimonials.
 */
export const EXAMPLES = [
  { name: 'Marigold Bakehouse', trade: 'Bakery', cover: '/demo/marigold-bakehouse/cover.jpg', paperMenu: '/samples/marigold-bakehouse.jpg' },
  { name: 'Tía Lupe’s Tacos', trade: 'Taco stand', cover: '/demo/tia-lupe-chalkboard/cover.jpg', paperMenu: '/samples/tia-lupe-chalkboard.jpg' },
  { name: 'Ravi’s Bike Repair', trade: 'Bike repair', cover: '/demo/ravi-bike-repair/cover.jpg', paperMenu: '/samples/ravi-bike-repair.jpg' },
] as const;

/** Only these numbers may appear, each with this wording or tighter, and each with its source line where it is used. */
export const FACTS = {
  photoToLive: { value: '8 to 14 s', label: 'from photo to live shop', note: 'Machine time over 6 measured runs, before your own review.' },
  agentFound: { value: '22.9 s', label: 'for Claude Code to find the door and order', note: 'Given only the shop URL, in one recorded run.' },
  noWebsite: { value: '47%', label: 'of US food-service employer firms had no website', note: 'Census ASE, data year 2016.' },
  sellerPaid: 'Payments go to the seller’s own PayPal account.',
} as const;

export const FAQ_TITLE = 'Frequently asked questions';

export const FAQ = [
  {
    q: 'Do I need a website?',
    a: 'No. Your shop gets its own page and link, and a card with a QR code you can print for the counter.',
  },
  {
    q: 'Do my buyers need an AI assistant?',
    a: 'No. Every shop page has an assistant built in.',
  },
  {
    q: 'How do AI assistants find my shop?',
    a: 'Your shop page points them to its agent door, the address they order through. Given only a shop’s link, Claude Code found the door and placed an order in 22.9 seconds.',
  },
  {
    q: 'Can I take real payments today?',
    a: 'Not yet. Shelfie runs on the PayPal sandbox, PayPal’s practice system for payments, so orders are practice runs and no real money moves. You can set everything up now.',
  },
  {
    q: 'What happens to my photos and orders?',
    a: 'Menu photos go to Anthropic’s Claude to be read, and items and orders go to PayPal to take payment. We don’t sell your data. You can delete your shop or account whenever you like.',
  },
  {
    q: 'What if I forget my password?',
    a: 'You save a recovery key when you sign up. It lets you set a new password. Shelfie doesn’t send email yet, so keep it somewhere safe.',
  },
] as const;

export const CLOSING = 'Put your counter online today.';
