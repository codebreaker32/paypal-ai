import { parseAmountToCents } from '@/lib/domain/money';
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
const MAX_PRICE_CENTS = 100_000; // $1,000

// Spec §9. Matched against name, description and source text.
const INSTRUCTION_RE = /ignore (all|previous)|instructions|system prompt|you are|assistant:/i;
// Notes that mean the reading itself is shaky, even when the model felt "medium" about it.
const SHAKY_NOTE_RE = /cross|strik|blur|smudg|illegib|unclear|unsure|guess|hard to read|faded|obscur/i;

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
function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

interface Built {
  item: DraftItem;
  key: string;
  signature: string;
}

function buildVariants(it: ExtractedItem, details: string[]): { variants: DraftVariant[]; invalid: boolean } {
  if (it.price_kind === 'market' || it.price_kind === 'missing' || it.prices.length === 0) {
    const labels = it.prices.length ? it.prices.map((p) => cleanOrNull(p.label, 60)) : [null];
    return { variants: labels.map((label) => ({ label, priceCents: null })), invalid: false };
  }
  let invalid = false;
  const variants = it.prices.map((p): DraftVariant => {
    const label = cleanOrNull(p.label, 60);
    let cents = p.amount_cents;
    if (cents == null && /^[\s$]*\d[\d.,]*\s*$/.test(p.raw)) cents = parseAmountToCents(p.raw);
    if (cents != null && (!Number.isInteger(cents) || cents < 0)) {
      invalid = true;
      details.push(`Couldn’t read "${clean(p.raw)}" as a price`);
      return { label, priceCents: null };
    }
    if (cents != null && it.price_kind !== 'deal') {
      const raw = clean(p.raw);
      if (raw !== '' && parseAmountToCents(raw) === null) details.push(`Printed as "${raw}"`);
    }
    return { label, priceCents: cents };
  });
  return { variants, invalid };
}

function buildItem(it: ExtractedItem, kind: DraftItem['kind']): Built | null {
  const name = cleanOrNull(it.name, MAX_NAME);
  if (!name) return null;

  const details: string[] = [];
  const issues = new Set<IssueCode>();
  const { variants, invalid } = buildVariants(it, details);
  const note = cleanOrNull(it.note, 200);

  if (it.price_kind === 'market') {
    issues.add('MARKET_PRICE');
  } else if (invalid) {
    issues.add('CHECK');
  } else if (variants.some((v) => v.priceCents === null)) {
    issues.add('MISSING_PRICE');
  }

  if (variants.some((v) => v.priceCents !== null && (v.priceCents <= 0 || v.priceCents > MAX_PRICE_CENTS))) {
    issues.add('CHECK');
    details.push('Price looks unusual');
  }
  if (it.price_kind === 'deal') {
    issues.add('CHECK');
    const deal = cleanOrNull(it.deal_text, 80) ?? 'a multi-buy deal';
    const unit = variants[0]?.priceCents;
    details.push(unit != null ? `Deal "${deal}": ${dollars(unit)} each?` : `Deal "${deal}"`);
  }
  if (it.confidence === 'low' || (it.confidence === 'medium' && note && SHAKY_NOTE_RE.test(note))) {
    issues.add('CHECK');
  }
  if (details.length) issues.add('CHECK');
  if (note && (issues.has('CHECK') || issues.has('MISSING_PRICE'))) details.push(note);

  const ordered = (['MISSING_PRICE', 'MARKET_PRICE', 'CHECK'] as IssueCode[]).filter((c) => issues.has(c));
  const item: DraftItem = {
    section: cleanOrNull(it.section, 80),
    name,
    description: cleanOrNull(it.description, MAX_DESCRIPTION),
    sourceText: clean(it.source_text).slice(0, MAX_SOURCE),
    confidence: it.confidence,
    kind,
    issues: ordered,
    issueDetail: details.length ? details.join('. ') : null,
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

function dedupe(built: Built[]): DraftItem[] {
  const seen = new Map<string, Built[]>();
  for (const b of built) {
    const group = seen.get(b.key) ?? [];
    if (group.some((g) => g.signature === b.signature)) continue; // exact duplicate: merged
    group.push(b);
    seen.set(b.key, group);
  }
  for (const group of seen.values()) {
    if (group.length > 1) {
      for (const g of group) {
        g.item.issues = [...g.item.issues, 'DUPLICATE'];
        g.item.issueDetail ??= 'Appears more than once with different prices';
      }
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
    warnings: raw.warnings.map(clean).filter((w) => w !== ''),
    nonUsd: raw.problems.includes('non_usd'),
  };
}
