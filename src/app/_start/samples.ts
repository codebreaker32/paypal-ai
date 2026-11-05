import type { SampleId } from '@/lib/client/api';

export interface SampleMenu {
  id: SampleId;
  name: string;
  /** What kind of seller this is, in a few words. */
  kind: string;
  image: string;
}

/** The three original sample menus shipped in public/samples. */
export const SAMPLE_MENUS: readonly SampleMenu[] = [
  { id: 'marigold-bakehouse', name: 'Marigold Bakehouse', kind: 'Home bakery', image: '/samples/marigold-bakehouse.jpg' },
  { id: 'tia-lupe-chalkboard', name: 'Tía Lupe’s Tacos', kind: 'Taco stand', image: '/samples/tia-lupe-chalkboard.jpg' },
  { id: 'ravi-bike-repair', name: 'Ravi’s Bike Repair', kind: 'Repair shop', image: '/samples/ravi-bike-repair.jpg' },
];

/** The published demo shop (scripts/seed-demo.ts creates it from the Marigold menu). */
export const LIVE_SHOP_HREF = '/s/marigold-bakehouse';
