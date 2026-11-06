// Browser-side calls for the Start page.
//
// Contract with POST /api/shops (route built in Task 6):
//   - multipart/form-data, one or more "photos" file fields (1 to 4 images)  → 201 { shopId }
//   - application/json { sample: SampleId }                                   → 201 { shopId }
//   - errors: JSON { error: { code, message } }. Codes the Start page understands:
//       BAD_IMAGE (or HTTP 415)              → "We couldn't open that photo. Try a JPG or PNG."
//       TOO_MANY_PHOTOS                      → up to 4 photos
//       PHOTO_TOO_LARGE (or HTTP 413)        → over 15 MB
//       RATE_LIMITED (or HTTP 429)           → too many shops from this address in the last hour
//     Anything else is shown as a generic "try again".

import { MAX_PHOTOS, MAX_PHOTO_BYTES } from './photos';

export type SampleId = 'marigold-bakehouse' | 'tia-lupe-chalkboard' | 'ravi-bike-repair';

export type StartErrorKind = 'bad_file' | 'too_many' | 'too_large' | 'busy' | 'network' | 'server';

export class StartError extends Error {
  readonly kind: StartErrorKind;
  constructor(kind: StartErrorKind, message = startErrorMessage(kind)) {
    super(message);
    this.name = 'StartError';
    this.kind = kind;
  }
}

const MAX_MB = Math.round(MAX_PHOTO_BYTES / (1024 * 1024));

const MESSAGES: Record<StartErrorKind, string> = {
  bad_file: "We couldn’t open that photo. Try a JPG or PNG.",
  too_many: `Shelfie reads up to ${MAX_PHOTOS} photos at a time. Pick the clearest pages.`,
  too_large: `That photo is over ${MAX_MB} MB. Take it again or pick a smaller copy.`,
  busy: 'You’ve started a lot of shops in the last hour. Try again later.',
  network: "We couldn’t reach Shelfie. Check your connection and try again.",
  server: 'Something went wrong on our side. Try again in a moment.',
};

export function startErrorMessage(kind: StartErrorKind): string {
  return MESSAGES[kind];
}

interface CallOptions {
  /** Injected in tests; defaults to the global fetch. */
  fetch?: typeof fetch;
}

const CODE_TO_KIND: Record<string, StartErrorKind> = {
  BAD_IMAGE: 'bad_file',
  TOO_MANY_PHOTOS: 'too_many',
  PHOTO_TOO_LARGE: 'too_large',
  RATE_LIMITED: 'busy',
};

async function readErrorKind(res: Response): Promise<StartErrorKind> {
  let code: unknown;
  try {
    const body = (await res.json()) as { error?: { code?: unknown } };
    code = body?.error?.code;
  } catch {
    code = undefined;
  }
  if (typeof code === 'string' && CODE_TO_KIND[code]) return CODE_TO_KIND[code];
  if (res.status === 413) return 'too_large';
  if (res.status === 415) return 'bad_file';
  if (res.status === 429) return 'busy';
  return 'server';
}

async function postShop(init: RequestInit, opts: CallOptions): Promise<{ shopId: string }> {
  const doFetch = opts.fetch ?? fetch;
  let res: Response;
  try {
    res = await doFetch('/api/shops', { method: 'POST', ...init });
  } catch {
    throw new StartError('network');
  }
  if (!res.ok) throw new StartError(await readErrorKind(res));

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new StartError('server');
  }
  const shopId = (body as { shopId?: unknown })?.shopId;
  if (typeof shopId !== 'string' || shopId === '') throw new StartError('server');
  return { shopId };
}

/** Uploads 1 to 4 menu photos and creates a draft shop. */
export function startFromPhotos(files: File[], opts: CallOptions = {}): Promise<{ shopId: string }> {
  const form = new FormData();
  for (const file of files) form.append('photos', file, file.name);
  return postShop({ body: form }, opts);
}

/** Creates a draft shop from one of the bundled sample menus in public/samples. */
export function startFromSample(sample: SampleId, opts: CallOptions = {}): Promise<{ shopId: string }> {
  return postShop(
    { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sample }) },
    opts,
  );
}
