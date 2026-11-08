import { createHash, randomBytes } from 'node:crypto';

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';
const ORDER_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1

function randomFrom(alphabet: string, len: number): string {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export type IdPrefix = 'shp' | 'itm' | 'var' | 'ord' | 'evt' | 'ext' | 'asst' | 'img' | 'acc';

/** Unguessable ids, safe to hand to agents: "ord_k7f2qxm4…". */
export function newId(prefix: IdPrefix, len = 16): string {
  return `${prefix}_${randomFrom(BASE32, len)}`;
}

/** Human order number: "SHF-K7F2QX". */
export function orderNumber(): string {
  return `SHF-${randomFrom(ORDER_CHARS, 6)}`;
}

export function slugify(name: string): string {
  const s = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  return s || 'shop';
}

export function ownerToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
