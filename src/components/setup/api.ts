// Browser-side calls for the setup screens. Every route answers errors as { error: { code, message } }.
import type { ItemWithVariants, ShopFulfillment } from '@/lib/domain/types';
import { ApiError, NETWORK_MESSAGE, call, errorFrom } from '@/lib/client/http';

export { ApiError };

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

// ───────────── Reading ─────────────

export type ExtractResult =
  | { kind: 'done' }
  | { kind: 'running' }
  | { kind: 'unreadable'; reason: string; tip: string }
  | { kind: 'failed'; message: string };

/** Starts (or joins) the reading. With photos, swaps or adds pages first (the retake screen). */
export async function startReading(shopId: string, upload?: { files: File[]; mode: 'replace' | 'add' }): Promise<ExtractResult> {
  let init: RequestInit = { method: 'POST' };
  if (upload) {
    const form = new FormData();
    for (const f of upload.files) form.append('photos', f, f.name);
    form.append('mode', upload.mode);
    init = { method: 'POST', body: form };
  }
  try {
    const { status, body } = await call<{ unreadable?: { reason: string; tip: string } }>(`/api/shops/${shopId}/extract`, init);
    if (status === 202) return { kind: 'running' };
    if (body.unreadable) return { kind: 'unreadable', ...body.unreadable };
    return { kind: 'done' };
  } catch (e) {
    if (e instanceof ApiError && e.code === 'NETWORK') return { kind: 'running' }; // the server keeps going; poll it
    return { kind: 'failed', message: e instanceof Error ? e.message : String(e) };
  }
}

export async function readingStatus(shopId: string): Promise<'none' | 'running' | 'finished'> {
  const { body } = await call<{ status: string }>(`/api/shops/${shopId}/extract`, { method: 'GET' });
  return body.status === 'running' ? 'running' : body.status === 'none' ? 'none' : 'finished';
}

// ───────────── Review edits ─────────────

export interface ItemUpdate {
  itemId: string;
  name?: string;
  description?: string | null;
  section?: string | null;
  status?: 'draft' | 'in_person' | 'removed';
  soldOut?: boolean;
  /** Clears every issue: the seller answered the item's card. */
  resolveIssues?: boolean;
  /** Clears only "listed twice": an item's own question (an unusual price, a deal) gets its own card next. */
  resolveDuplicate?: boolean;
  variants?: { label: string | null; priceCents: number | null }[];
}

export async function patchItems(shopId: string, updates: ItemUpdate[]): Promise<ItemWithVariants[]> {
  const { body } = await call<{ items: ItemWithVariants[] }>(`/api/shops/${shopId}/items`, json('PATCH', { updates }));
  return body.items;
}

export async function addItem(
  shopId: string,
  input: { name: string; section?: string | null; priceCents?: number | null; sourceText: string },
): Promise<ItemWithVariants> {
  const { body } = await call<{ item: ItemWithVariants }>(`/api/shops/${shopId}/items`, json('POST', input));
  return body.item;
}

export interface ShopPatch {
  name?: string;
  about?: string;
  pickupNotes?: string;
  fulfillment?: ShopFulfillment;
  shippingFeeCents?: number;
}

export async function patchShop(shopId: string, patch: ShopPatch): Promise<void> {
  await call(`/api/shops/${shopId}`, json('PATCH', patch));
}

// ───────────── Publish (NDJSON stream) ─────────────

export type PublishEvent =
  | { type: 'start'; items: { itemId: string; name: string }[] }
  | { type: 'item'; itemId: string; ok: true; paypalProductId: string }
  | { type: 'item'; itemId: string; ok: false; message: string }
  | { type: 'done'; published: number; failed: { itemId: string; message: string }[]; shop: { status: string; slug: string } }
  | { type: 'error'; message: string };

/** Runs a publish and calls onEvent for every line of progress. Throws ApiError if it can't start. */
export async function publish(shopId: string, onEvent: (e: PublishEvent) => void): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/shops/${shopId}/publish`, { method: 'POST', cache: 'no-store' });
  } catch {
    throw new ApiError(0, 'NETWORK', NETWORK_MESSAGE);
  }
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    throw errorFrom(res.status, body, { fallbackMessage: () => 'Publishing failed. Try again.' });
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += value;
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) onEvent(JSON.parse(line) as PublishEvent);
    }
    if (done) break;
  }
}
