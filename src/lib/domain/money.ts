// Money is integer cents everywhere. PayPal amount strings come only from toPayPalValue.

const AMOUNT = /^\$?(\d{1,6})(?:[.,](\d{1,2}))?\s*(?:ea|each)?$/i;

/** "4.5" → 450, "$10.50" → 1050, "4,50" → 450, "4.50ea" → 450. Anything ambiguous → null. */
export function parseAmountToCents(raw: string): number | null {
  const s = raw.trim().replace(/^\$\s+/, '$');
  const m = AMOUNT.exec(s);
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = m[2] ? Number(m[2].padEnd(2, '0')) : 0;
  return whole * 100 + frac;
}

export function toPayPalValue(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) throw new Error(`Invalid cents value: ${cents}`);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

export function formatUSD(cents: number): string {
  return `$${toPayPalValue(cents)}`;
}
