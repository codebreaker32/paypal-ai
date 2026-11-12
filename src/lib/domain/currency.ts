// Menus printed in another currency. Shelfie's PayPal checkout is in US dollars, so a reading in rupees, euros or
// pounds is converted to dollars at an approximate rate and the seller is told so (review step banner). No network:
// the rates are a fixed table, rounded, and labelled approximate everywhere they are shown.

export interface CurrencyInfo {
  code: string;
  /** How the menu writes it ("₹", "€", "Rs"). */
  symbol: string;
  /** The currency's name in a sentence ("Indian rupees"). */
  name: string;
  /** US dollars for one unit (approximate, November 2026). */
  usd: number;
}

const TABLE: CurrencyInfo[] = [
  { code: 'INR', symbol: '₹', name: 'Indian rupees', usd: 0.0113 },
  { code: 'EUR', symbol: '€', name: 'euros', usd: 1.16 },
  { code: 'GBP', symbol: '£', name: 'pounds', usd: 1.33 },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian dollars', usd: 0.72 },
  { code: 'AUD', symbol: 'A$', name: 'Australian dollars', usd: 0.66 },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand dollars', usd: 0.58 },
  { code: 'SGD', symbol: 'S$', name: 'Singapore dollars', usd: 0.77 },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong dollars', usd: 0.128 },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican pesos', usd: 0.054 },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian reais', usd: 0.18 },
  { code: 'JPY', symbol: '¥', name: 'yen', usd: 0.0066 },
  { code: 'CNY', symbol: 'CN¥', name: 'yuan', usd: 0.14 },
  { code: 'KRW', symbol: '₩', name: 'won', usd: 0.00072 },
  { code: 'PHP', symbol: '₱', name: 'Philippine pesos', usd: 0.017 },
  { code: 'THB', symbol: '฿', name: 'baht', usd: 0.03 },
  { code: 'MYR', symbol: 'RM', name: 'ringgit', usd: 0.24 },
  { code: 'IDR', symbol: 'Rp', name: 'rupiah', usd: 0.00006 },
  { code: 'VND', symbol: '₫', name: 'dong', usd: 0.000038 },
  { code: 'PKR', symbol: 'Rs', name: 'Pakistani rupees', usd: 0.0036 },
  { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan rupees', usd: 0.0033 },
  { code: 'NPR', symbol: 'Rs', name: 'Nepalese rupees', usd: 0.0071 },
  { code: 'BDT', symbol: '৳', name: 'taka', usd: 0.0082 },
  { code: 'AED', symbol: 'AED', name: 'dirhams', usd: 0.272 },
  { code: 'ZAR', symbol: 'R', name: 'rand', usd: 0.057 },
  { code: 'NGN', symbol: '₦', name: 'naira', usd: 0.00068 },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan shillings', usd: 0.0077 },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian pounds', usd: 0.02 },
  { code: 'TRY', symbol: '₺', name: 'lira', usd: 0.024 },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss francs', usd: 1.25 },
  { code: 'SEK', symbol: 'kr', name: 'Swedish kronor', usd: 0.105 },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian kroner', usd: 0.099 },
  { code: 'DKK', symbol: 'kr', name: 'Danish kroner', usd: 0.155 },
  { code: 'PLN', symbol: 'zł', name: 'złoty', usd: 0.27 },
  { code: 'COP', symbol: 'COL$', name: 'Colombian pesos', usd: 0.00025 },
  { code: 'CLP', symbol: 'CLP$', name: 'Chilean pesos', usd: 0.00105 },
  { code: 'PEN', symbol: 'S/', name: 'soles', usd: 0.29 },
  { code: 'ARS', symbol: 'AR$', name: 'Argentine pesos', usd: 0.0007 },
];

const BY_CODE = new Map(TABLE.map((c) => [c.code, c]));

/** The table entry for an ISO 4217 code, or null for USD, unknown codes and nonsense. */
export function foreignCurrency(code: string | null | undefined): CurrencyInfo | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  if (c === 'USD') return null;
  return BY_CODE.get(c) ?? null;
}

/** Hundredths of a foreign unit (₹199 is 19900) to US cents, rounded to the cent; at least 1 cent for a price over 0. */
export function toUsdCents(foreignHundredths: number, info: CurrencyInfo): number {
  if (foreignHundredths <= 0) return foreignHundredths;
  return Math.max(1, Math.round(foreignHundredths * info.usd));
}

/** "₹199" or "€4.50": a printed foreign amount from its hundredths. */
export function formatForeign(hundredths: number, info: CurrencyInfo): string {
  const units = hundredths / 100;
  const text = Number.isInteger(units) ? String(units) : units.toFixed(2);
  return /^[A-Z]{2,}$/.test(info.symbol) ? `${info.symbol} ${text}` : `${info.symbol}${text}`;
}

/** What the review step tells a seller whose menu was converted. */
export interface Conversion {
  code: string;
  symbol: string;
  name: string;
  /** US dollars for one unit, as used. */
  usd: number;
}
