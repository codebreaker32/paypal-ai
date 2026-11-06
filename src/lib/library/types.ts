import type { ItemCategory } from '@/lib/domain/category';

/**
 * One photo of the bundled example-photo library (`public/library/<id>.webp`, 800x600 WebP; sources and licences in
 * docs/ASSETS.md). A library photo is an *example* of what an item looks like, never the seller's product: the seller
 * sees "Example photo, replace with yours", buyers a small "Example photo" note, and agents and the JSON-LD never get it.
 */
export interface LibraryPhoto {
  /** Stable slug, also the file name: `croissant-1` → `/library/croissant-1.webp`. Stored in `items.example_photo`. */
  id: string;
  /** Site-relative URL of the WebP. */
  file: string;
  /** The item type it shows, e.g. `croissant`, `sourdough`, `taco`, `bike-chain`; several photos share a type. */
  type: string;
  /** The drawing category it belongs to (a food photo never matches a bike shop's item and the reverse). */
  category: ItemCategory;
  /** Lower-case words or phrases an item's name, description or section can match: `['croissant', 'butter croissant']`. */
  tags: string[];
  /** One plain line on what the photo shows (also given to Claude when it picks a photo, and used for alt text). */
  shows: string;
  /** The photo's page on Pexels or Unsplash. */
  source: string;
  photographer: string;
  licence: 'Pexels License' | 'Unsplash License';
}
