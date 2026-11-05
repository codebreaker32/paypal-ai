// Carriers for Add tracking and the input check. Pure (no PayPal toolkit), so the tracking form can use it too.

/** What the seller picks, in the order shown. `id` is the PayPal carrier code. */
export const CARRIERS = [
  { id: 'USPS', label: 'USPS' },
  { id: 'UPS', label: 'UPS' },
  { id: 'FEDEX', label: 'FedEx' },
  { id: 'DHL', label: 'DHL' },
  { id: 'OTHER', label: 'Other' },
] as const;
export type CarrierId = (typeof CARRIERS)[number]['id'];

export interface TrackingInput {
  carrier: CarrierId;
  trackingNumber: string;
  /** Required for OTHER: the carrier's name as the buyer knows it. */
  carrierName: string | null;
}

const TRACKING_NUMBER = /^[A-Za-z0-9-]{5,40}$/;
const KEYS = new Set(['carrier', 'trackingNumber', 'carrierName']);

export function parseTrackingInput(body: unknown): { ok: true; value: TrackingInput } | { ok: false; message: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, message: 'Send { carrier, trackingNumber }.' };
  const b = body as Record<string, unknown>;
  const extra = Object.keys(b).find((k) => !KEYS.has(k));
  if (extra) return { ok: false, message: `"${extra.slice(0, 40)}" is not accepted.` };
  const carrier = CARRIERS.find((c) => c.id === b.carrier)?.id;
  if (!carrier) return { ok: false, message: 'Pick a carrier: USPS, UPS, FedEx, DHL or Other.' };
  const trackingNumber = typeof b.trackingNumber === 'string' ? b.trackingNumber.replace(/\s+/g, '') : '';
  if (!TRACKING_NUMBER.test(trackingNumber)) {
    return { ok: false, message: 'Enter the tracking number from the label: 5 to 40 letters and digits.' };
  }
  let carrierName: string | null = null;
  if (carrier === 'OTHER') {
    carrierName = typeof b.carrierName === 'string' ? b.carrierName.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
    if (!carrierName) return { ok: false, message: 'Enter the name of the carrier.' };
  }
  return { ok: true, value: { carrier, trackingNumber, carrierName } };
}

/** The carrier as shown to the seller and the buyer (get_order_status reads it back from our tracker row). */
export function carrierLabel(input: Pick<TrackingInput, 'carrier' | 'carrierName'>): string {
  if (input.carrier === 'OTHER') return input.carrierName ?? 'Other';
  return CARRIERS.find((c) => c.id === input.carrier)!.label;
}
