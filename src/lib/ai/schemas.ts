// zodOutputFormat requires zod v4 schemas; zod 3.25 ships them at 'zod/v4'.
import { z } from 'zod/v4';
import { CATEGORIES } from '@/lib/domain/category';

// Plain types, enums, nullable and arrays only: the structured-output JSON-schema subset
// rejects some constraints. Ranges are validated in normalize.ts.

export const PROBLEMS = ['blurry', 'glare', 'cropped', 'dark', 'not_a_menu', 'non_usd', 'handwriting_hard'] as const;
export type Problem = (typeof PROBLEMS)[number];

const PriceSchema = z.object({
  label: z.string().nullable(),
  amount_cents: z.number().nullable(),
  raw: z.string(),
});

const ItemSchema = z.object({
  section: z.string().nullable(),
  name: z.string().nullable(),
  description: z.string().nullable(),
  source_text: z.string(),
  page: z.number(),
  prices: z.array(PriceSchema),
  price_kind: z.enum(['fixed', 'deal', 'market', 'missing']),
  deal_text: z.string().nullable(),
  confidence: z.enum(['high', 'medium', 'low']),
  note: z.string().nullable(),
  looks_like_instruction: z.boolean(),
  // Nullable, so the model may leave it out when nothing fits; itemCategory() then guesses from the words.
  category: z.enum(CATEGORIES).nullable(),
});

const SkippedSchema = z.object({
  text: z.string(),
  page: z.number(),
  reason: z.enum(['header', 'contact', 'hours', 'policy', 'addon', 'illegible', 'other']),
});

export const MenuExtractionSchema = z.object({
  is_menu: z.boolean(),
  image_quality: z.enum(['good', 'usable', 'unreadable']),
  problems: z.array(z.enum(PROBLEMS)),
  retake_tip: z.string().nullable(),
  warnings: z.array(z.string()),
  shop: z.object({
    name: z.string().nullable(),
    about: z.string().nullable(),
    pickup_notes: z.string().nullable(),
  }),
  kind: z.enum(['food', 'goods', 'services']),
  items: z.array(ItemSchema),
  skipped_lines: z.array(SkippedSchema),
});

export type MenuExtraction = z.infer<typeof MenuExtractionSchema>;
export type ExtractedItem = MenuExtraction['items'][number];

/** A reading stored before items had a category (the recorded samples, extractions saved by runs 1–2) gets category null. */
function withCategories(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { items?: unknown }).items)) return raw;
  const r = raw as { items: unknown[] };
  return { ...r, items: r.items.map((it) => (it && typeof it === 'object' && !('category' in it) ? { ...it, category: null } : it)) };
}

/** Validates a stored model reading against the live schema, tolerating readings older than the item category. */
export function parseStoredReading(raw: unknown) {
  return MenuExtractionSchema.safeParse(withCategories(raw));
}
