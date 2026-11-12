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
  // The closest example photo from the bundled library (an id from the prompt's list), or null. A plain string, since
  // the library may be empty and an enum cannot be; normalize.ts keeps it only when the id is in the library.
  example_photo: z.string().nullable(),
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
  // ISO 4217 code of the printed prices ("USD", "INR", "EUR"), or null when the menu shows no currency at all.
  currency: z.string().nullable(),
  items: z.array(ItemSchema),
  skipped_lines: z.array(SkippedSchema),
});

export type MenuExtraction = z.infer<typeof MenuExtractionSchema>;
export type ExtractedItem = MenuExtraction['items'][number];

/** Item fields added after readings were first stored: an older reading gets null for each one it lacks. */
const LATER_FIELDS = ['category', 'example_photo'] as const;

/**
 * A reading stored before items had a category or an example photo (the recorded samples, extractions saved by
 * earlier runs) gets null for the missing fields.
 */
function withCategories(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { items?: unknown }).items)) return raw;
  const r = raw as { items: unknown[]; currency?: unknown };
  return {
    ...r,
    // Readings stored before the currency field: they were all read as US dollars.
    currency: 'currency' in r ? r.currency : null,
    items: r.items.map((it) => {
      if (!it || typeof it !== 'object') return it;
      const missing = LATER_FIELDS.filter((f) => !(f in it));
      return missing.length ? { ...it, ...Object.fromEntries(missing.map((f) => [f, null])) } : it;
    }),
  };
}

/** Validates a stored model reading against the live schema, tolerating readings older than the later item fields. */
export function parseStoredReading(raw: unknown) {
  return MenuExtractionSchema.safeParse(withCategories(raw));
}
