import { MAX_PRICE_CENTS, MAX_VARIANTS } from '@/lib/catalog/rules';
import { formatUSD, parseAmountToCents } from '@/lib/domain/money';
import type {
  DraftCatalog,
  DraftItem,
  DraftVariant,
  IssueCode,
  SkippedLine,
  UnreadableMenu,
} from '@/lib/domain/types';
import type { ExtractedItem, MenuExtraction, Problem } from './schemas';

const MAX_NAME = 127;
const MAX_DESCRIPTION = 256;
const MAX_SOURCE = 500;

// Spec §9. Matched against name, description and source text.
const INSTRUCTION_RE = /ignore (all|previous)|instructions|system prompt|you are|assistant:/i;
// Something on the menu was crossed out or struck through ("cross-out", "crossout", "strikes",
// "striked", "scored out", "scratched out"). Whole words only: "across" and a "hot cross bun" are not.
const CROSSED_RE =
  /\b(crossed|cross(es|ing)?[\s-]?outs?|struck|strik(e|es|ed|ing)|strikethrough|(scored|scratched) (out|through))\b/i;
// Notes that mean the reading itself is shaky, even when the model felt "medium" about it.
const SHAKY_NOTE_RE = /blur|smudg|illegib|unclear|unsure|guess|hard to read|faded|obscur/i;
const isShakyNote = (note: string) => CROSSED_RE.test(note) || SHAKY_NOTE_RE.test(note);

const TIPS: Partial<Record<Problem, string>> = {
  blurry: 'Hold steady and tap to focus',
  glare: "Tilt the phone so the light doesn’t bounce off",
  cropped: 'Fit the whole menu in the frame, or add another photo',
  dark: 'Move closer to a light',
  handwriting_hard: 'Move closer so the writing is easy to read',
  not_a_menu: "This doesn’t look like a menu or price list",
};
const TIP_ORDER: Problem[] = ['blurry', 'glare', 'cropped', 'dark', 'handwriting_hard', 'not_a_menu'];
const FALLBACK_TIP = 'Try another photo in good light';

export function retakeTipFor(problems: Problem[]): string {
  const tips = TIP_ORDER.filter((p) => problems.includes(p)).map((p) => TIPS[p]!);
  return tips.length ? tips.join('. ') : FALLBACK_TIP;
}

// Control characters, plus zero-width and bidi override characters used to hide text.
const CONTROL_RE = /[\u0000-\u0008\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g;

function clean(s: string): string {
  return s.replace(CONTROL_RE, '').replace(/\s+/g, ' ').trim();
}
function cleanOrNull(s: string | null, max: number): string | null {
  if (s == null) return null;
  const c = clean(s).slice(0, max);
  return c === '' ? null : c;
}
interface Built {
  item: DraftItem;
  key: string;
  signature: string;
}

/** What the reading found odd about an item's prices, turned into seller sentences below. */
interface PriceFlags {
  /** A printed price that came back as an unusable amount (negative, or fractions of a cent). */
  unusable: string | null;
  /** A price printed some other way than a plain amount ("from $20"). */
  printedAs: string | null;
  /** The menu listed more sizes than an item can have; only the first MAX_VARIANTS were kept. */
  tooMany: boolean;
}

function buildVariants(it: ExtractedItem): { variants: DraftVariant[]; flags: PriceFlags } {
  const flags: PriceFlags = { unusable: null, printedAs: null, tooMany: it.prices.length > MAX_VARIANTS };
  const prices = it.prices.slice(0, MAX_VARIANTS);
  if (it.price_kind === 'market' || it.price_kind === 'missing' || prices.length === 0) {
    const labels = prices.length ? prices.map((p) => cleanOrNull(p.label, 60)) : [null];
    return { variants: labels.map((label) => ({ label, priceCents: null })), flags };
  }
  const variants = prices.map((p): DraftVariant => {
    const label = cleanOrNull(p.label, 60);
    let cents = p.amount_cents;
    if (cents == null && /^[\s$]*\d[\d.,]*\s*$/.test(p.raw)) cents = parseAmountToCents(p.raw);
    if (cents != null && (!Number.isInteger(cents) || cents < 0)) {
      flags.unusable ??= clean(p.raw);
      return { label, priceCents: null };
    }
    if (cents != null && it.price_kind !== 'deal') {
      const raw = clean(p.raw);
      if (raw !== '' && parseAmountToCents(raw) === null) flags.printedAs ??= raw;
    }
    return { label, priceCents: cents };
  });
  // A condition printed beside a plain price ("FREE w/ tune-up, else $10" read as $10) is still worth asking about.
  const condition = it.price_kind !== 'deal' && it.deal_text ? clean(it.deal_text) : '';
  if (condition !== '' && parseAmountToCents(condition) === null && variants.some((v) => v.priceCents != null)) flags.printedAs ??= condition;
  return { variants, flags };
}

// ---- Seller-facing issue text ----------------------------------------------------------------
// Fixed, plain sentences filled with the item's own data: each names what was printed and asks
// one question. The model's free-text note never reaches the seller, so no reading can put cents,
// field names or how rows were matched on a card; here it only tells a crossed-out price apart.

/** "The $7 is crossed out; we used $8": a part of the note that is crossed out and names a price. */
function crossedOutPrice(note: string): boolean {
  return note.split(/[;!?]|\.(?=\s|$)|,\s/).some((part) => CROSSED_RE.test(part) && /\$|\d|\bprices?\b/i.test(part));
}
// "2 for $7", "3 for 10", "2x $5": a price per piece is worth saying "each".
const MULTI_BUY_RE = /\b\d+\s*(for|x)\b/i;

const isUnusual = (cents: number) => cents <= 0 || cents > MAX_PRICE_CENTS;

function quoted(text: string, max = 60): string {
  return `“${text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text}”`;
}

/** "a", "a and b", "a, b and c". */
function listOf(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** "$8.00", or "S $3.00 and L $4.00" for an item with sizes (a lone price's label is left out). */
function pricesOf(variants: DraftVariant[]): string {
  return listOf(
    variants.map((v) => {
      const price = v.priceCents == null ? 'no price' : formatUSD(v.priceCents);
      return v.label && variants.length > 1 ? `${v.label} ${price}` : price;
    }),
  );
}

/** The market card explains the two choices (today's price, or ask in person); this says what was printed. */
function marketDetail(it: ExtractedItem): string {
  const printed = clean(it.prices.find((p) => clean(p.raw) !== '')?.raw ?? '');
  return `Your menu says ${printed ? quoted(printed, 40) : 'market price'} instead of a price.`;
}

function missingDetail(it: ExtractedItem, variants: DraftVariant[]): string {
  if (it.price_kind === 'missing' || it.prices.length === 0) return 'No price on the menu. Add one, or leave it off.';
  const unread = variants.filter((v) => v.priceCents === null);
  if (unread.length < variants.length && unread.every((v) => v.label)) {
    return `We couldn’t read the ${listOf(unread.map((v) => v.label!))} price. Add it, or leave the item off.`;
  }
  return 'We couldn’t read the price. Add one, or leave it off.';
}

function dealDetail(it: ExtractedItem, unit: number | null | undefined): string {
  const deal = cleanOrNull(it.deal_text, 80) ?? cleanOrNull(it.prices[0]?.raw ?? null, 80);
  const printed = deal ? `Printed as ${quoted(deal)}.` : 'Printed as a multi-buy deal.';
  const each = !deal || MULTI_BUY_RE.test(deal) ? ' each' : '';
  return unit != null ? `${printed} We set ${formatUSD(unit)}${each}. Is that right?` : `${printed} What does one cost?`;
}

function unusualDetail(variants: DraftVariant[]): string {
  const odd = variants.find((v) => v.priceCents !== null && isUnusual(v.priceCents))!;
  const which = variants.length > 1 && odd.label ? ` for ${quoted(odd.label, 30)}` : '';
  if (odd.priceCents! > MAX_PRICE_CENTS) {
    return `We read ${formatUSD(odd.priceCents!)}${which}. Online orders go up to ${formatUSD(MAX_PRICE_CENTS).replace(/\.00$/, '')}, so set a lower price or remove it.`;
  }
  return `We set ${formatUSD(odd.priceCents!)}${which}, which looks unusual. Is that right?`;
}

interface DetailInput {
  it: ExtractedItem;
  variants: DraftVariant[];
  flags: PriceFlags;
  unusual: boolean;
  shaky: boolean;
  note: string | null;
}

/** The sentences for the item's main problem (the one its review card fixes). */
function issueDetailFor({ it, variants, flags, unusual, shaky, note }: DetailInput): string | null {
  if (it.price_kind === 'market') return marketDetail(it);
  if (it.price_kind === 'deal') return dealDetail(it, variants[0]?.priceCents);
  if (flags.unusable) return `We couldn’t read ${quoted(flags.unusable)} as a price. Add the right one, or leave it off.`;
  if (variants.some((v) => v.priceCents === null)) return missingDetail(it, variants);
  if (unusual) return unusualDetail(variants);
  if (flags.tooMany) return `Your menu lists more than ${MAX_VARIANTS} sizes; we kept the first ${MAX_VARIANTS}. Are they right?`;
  const set = pricesOf(variants);
  if (note && crossedOutPrice(note)) return `A price is crossed out. We set ${set}. Is that right?`;
  if (flags.printedAs) return `Printed as ${quoted(flags.printedAs)}. We set ${set}. Is that right?`;
  if (shaky) return 'Hard to read in the photo. Are the name and price right?';
  return null;
}

// ---- Shop-level notes ("Notes from the reading") ---------------------------------------------
// The model's warnings are shown as written only when they read like a note to the owner. One that
// talks about cents, field names or how the photo was read is dropped; in its place the owner gets
// one fixed sentence, so the point (check this against the photo) survives without the jargon.
// "Match" alone is plain English ("these prices don't match the board"); "matched by row", "matched
// to items" and "in reading order" describe how the photo was read.

const METHOD_TALK_RE =
  /\bcents?\b|\bmatched (by|to|with)\b|\bby (row|position)\b|row position|reading order|unit price|confidence|best reading|amount_cents|price_kind|deal_text|source_text|\bnull\b|\bOCR\b/i;
const CHECK_PHOTO = 'Check the names and prices against your photo before you publish.';

function sellerWarnings(warnings: string[]): string[] {
  const kept: string[] = [];
  let dropped = false;
  for (const w of warnings) {
    const text = clean(w).replace(/([.?!])[.?!]+/g, '$1').replace(/(\p{L})'(\p{L})/gu, '$1’$2');
    if (text === '') continue;
    if (METHOD_TALK_RE.test(text)) dropped = true;
    else if (!kept.includes(text)) kept.push(text);
  }
  return dropped ? [...kept, CHECK_PHOTO] : kept;
}

function duplicateDetail(group: Built[]): string {
  const times = group.length === 2 ? 'twice' : `${group.length} times`;
  return `Listed ${times} with different prices: ${listOf(group.map((g) => pricesOf(g.item.variants)))}.`;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * "Horchata sm / lg" with sizes sm and lg → "Horchata": the sizes are options, so they shouldn't
 * appear in the name as well. Only when every variant has a label, at least two of them end the
 * name (joined by "/", ",", "|" or spaces, optionally in brackets), and something is left.
 */
function withoutSizeWords(name: string, variants: DraftVariant[]): string {
  if (variants.length < 2 || variants.some((v) => !v.label)) return name;
  const labels = [...new Set(variants.map((v) => v.label!))].sort((a, b) => b.length - a.length).map(escapeRe);
  const label = `(?:${labels.join('|')})`;
  const sep = '(?:\\s*[/,|]\\s*|\\s+)';
  // A separator run first, so a label never starts mid-word; the labels then run to the end.
  const group = new RegExp(`[\\s,:(\\[\\-–—]+${label}(?:${sep}${label})+\\s*[)\\]]?\\s*$`, 'iu');
  const match = group.exec(name);
  if (!match) return name;
  const rest = name.slice(0, match.index).trim();
  return rest === '' ? name : rest;
}

function buildItem(it: ExtractedItem, kind: DraftItem['kind']): Built | null {
  const cleaned = cleanOrNull(it.name, MAX_NAME);
  if (!cleaned) return null;

  const issues = new Set<IssueCode>();
  const { variants, flags } = buildVariants(it);
  const name = withoutSizeWords(cleaned, variants);
  const note = cleanOrNull(it.note, 200);

  if (it.price_kind === 'market') {
    issues.add('MARKET_PRICE');
  } else if (flags.unusable) {
    issues.add('CHECK');
  } else if (variants.some((v) => v.priceCents === null)) {
    issues.add('MISSING_PRICE');
  }

  const unusual = variants.some((v) => v.priceCents !== null && isUnusual(v.priceCents));
  const shaky = it.confidence === 'low' || (it.confidence === 'medium' && note !== null && isShakyNote(note));
  if (unusual || it.price_kind === 'deal' || shaky || flags.printedAs || flags.tooMany) issues.add('CHECK');

  const ordered = (['MISSING_PRICE', 'MARKET_PRICE', 'CHECK'] as IssueCode[]).filter((c) => issues.has(c));
  const item: DraftItem = {
    section: cleanOrNull(it.section, 80),
    name,
    description: cleanOrNull(it.description, MAX_DESCRIPTION),
    sourceText: clean(it.source_text).slice(0, MAX_SOURCE),
    confidence: it.confidence,
    kind,
    issues: ordered,
    issueDetail: ordered.length ? issueDetailFor({ it, variants, flags, unusual, shaky, note }) : null,
    status: it.price_kind === 'market' ? 'in_person' : 'draft',
    variants,
  };
  return {
    item,
    key: name.toLowerCase(),
    signature: variants.map((v) => `${(v.label ?? '').toLowerCase()}=${v.priceCents}`).join('|'),
  };
}

function looksLikeInstruction(it: ExtractedItem): boolean {
  if (it.looks_like_instruction) return true;
  return [it.name, it.description, it.source_text].some((t) => t != null && INSTRUCTION_RE.test(clean(t)));
}

/**
 * Two lines are the same item only when the names match and so do the sections, or one section is
 * missing (a heading cut off on another page). "HOT: Latte" and "ICED: Latte" are different items,
 * even at the same price.
 */
function sameSection(a: Built, b: Built): boolean {
  const x = a.item.section?.toLowerCase() ?? null;
  const y = b.item.section?.toLowerCase() ?? null;
  return x === null || y === null || x === y;
}

function dedupe(built: Built[]): DraftItem[] {
  const seen = new Map<string, Built[]>();
  for (const b of built) {
    const group = seen.get(b.key) ?? [];
    if (group.some((g) => g.signature === b.signature && sameSection(g, b))) continue; // exact duplicate: merged
    group.push(b);
    seen.set(b.key, group);
  }
  for (const group of seen.values()) {
    for (const g of group) {
      const twins = group.filter((o) => sameSection(o, g));
      if (twins.length < 2) continue;
      g.item.issues = [...g.item.issues, 'DUPLICATE'];
      // An item with its own question (no price, a deal, an unusual price) keeps it: the twins'
      // card shows every price anyway, and the question still stands once the twin is gone.
      g.item.issueDetail ??= duplicateDetail(twins);
    }
  }
  return built.filter((b) => seen.get(b.key)!.includes(b)).map((b) => b.item);
}

export function normalizeExtraction(raw: MenuExtraction): DraftCatalog | UnreadableMenu {
  if (!raw.is_menu) {
    return { unreadable: true, reason: 'not_a_menu', tip: retakeTipFor(['not_a_menu']) };
  }
  if (raw.image_quality === 'unreadable') {
    const tip = raw.problems.some((p) => TIPS[p]) ? retakeTipFor(raw.problems) : (raw.retake_tip ?? FALLBACK_TIP);
    return { unreadable: true, reason: 'unreadable', tip };
  }

  const kind: DraftItem['kind'] = raw.kind === 'services' ? 'SERVICE' : 'PHYSICAL';
  const skipped: SkippedLine[] = raw.skipped_lines
    .map((s) => ({ text: clean(s.text), page: s.page, reason: s.reason }) as SkippedLine)
    .filter((s) => s.text !== '');
  const built: Built[] = [];

  for (const it of raw.items) {
    if (looksLikeInstruction(it)) {
      const text = clean(it.source_text || it.name || '');
      if (text) skipped.push({ text, page: it.page, reason: 'instruction' });
      continue;
    }
    const b = buildItem(it, kind);
    if (!b) {
      const text = clean(it.source_text);
      if (text) skipped.push({ text, page: it.page, reason: 'illegible' });
      continue;
    }
    built.push(b);
  }

  const items = dedupe(built);
  if (items.length === 0) {
    const tip = "We couldn’t find any items. Make sure the prices are in the frame, or add another photo.";
    return { unreadable: true, reason: 'no_items', tip };
  }

  return {
    shop: {
      name: cleanOrNull(raw.shop.name, MAX_NAME) ?? '',
      about: cleanOrNull(raw.shop.about, 500) ?? '',
      pickupNotes: cleanOrNull(raw.shop.pickup_notes, 500) ?? '',
    },
    kind: raw.kind,
    items,
    skipped,
    needsAttention: items.filter((i) => i.status !== 'removed' && i.issues.length > 0).length,
    warnings: sellerWarnings(raw.warnings),
    nonUsd: raw.problems.includes('non_usd'),
  };
}
