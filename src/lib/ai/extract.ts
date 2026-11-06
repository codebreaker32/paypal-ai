import type Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { MODEL_ID, getAnthropic } from './anthropic';
import { MENU_SYSTEM_PROMPT, MENU_USER_PROMPT, pageLabel, retryPrompt } from './prompts';
import { MenuExtractionSchema, type MenuExtraction } from './schemas';

export interface MenuPhoto {
  data: Buffer;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
}

/** One HTTP attempt. */
const TIMEOUT_MS = 90_000;
/** One SDK retry per call: covers a dropped connection or an overloaded API without doubling the bill twice. */
const MAX_RETRIES = 1;
/**
 * The whole reading (every SDK attempt, its backoff and the re-prompt on a parse failure) is
 * abandoned after this long. The setup page treats a reading still running after
 * READING_STALE_MS (src/lib/catalog/setup.ts, derived from this) as dead, so a live one must
 * always finish first; otherwise "Try again" would start a second paid reading beside it.
 */
export const READING_DEADLINE_MS = 180_000;

function buildContent(photos: MenuPhoto[], prompt: string): Anthropic.ContentBlockParam[] {
  const content: Anthropic.ContentBlockParam[] = [];
  photos.forEach((p, i) => {
    content.push({ type: 'text', text: pageLabel(i + 1) });
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: p.mediaType, data: p.data.toString('base64') },
    });
  });
  content.push({ type: 'text', text: prompt });
  return content;
}

async function callOnce(
  client: Anthropic,
  photos: MenuPhoto[],
  prompt: string,
  signal: AbortSignal,
): Promise<MenuExtraction> {
  const response = await client.messages.parse(
    {
      model: MODEL_ID,
      max_tokens: 16000,
      system: MENU_SYSTEM_PROMPT,
      output_config: { format: zodOutputFormat(MenuExtractionSchema), effort: 'medium' },
      messages: [{ role: 'user', content: buildContent(photos, prompt) }],
    },
    { timeout: TIMEOUT_MS, maxRetries: MAX_RETRIES, signal },
  );
  const parsed = response.parsed_output;
  if (!parsed) throw new Error('Model returned no structured output');
  return parsed;
}

/** Reads 1-4 menu photos in one call. One retry (with the validation error) on a parse failure. */
export async function extractMenu(
  photos: MenuPhoto[],
  deps: { client?: Anthropic } = {},
): Promise<MenuExtraction> {
  if (photos.length < 1 || photos.length > 4) throw new Error('extractMenu needs 1 to 4 photos');
  const client = deps.client ?? getAnthropic();
  // A plain setTimeout (not AbortSignal.timeout) so the deadline is testable with fake timers.
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), READING_DEADLINE_MS);
  try {
    return await callOnce(client, photos, MENU_USER_PROMPT, deadline.signal);
  } catch (err) {
    if (!isParseFailure(err)) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    return await callOnce(client, photos, retryPrompt(msg), deadline.signal);
  } finally {
    clearTimeout(timer);
  }
}

/** API errors carry an HTTP status and connection/timeout errors are not worth a re-prompt. */
function isParseFailure(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (typeof (err as { status?: unknown }).status === 'number') return false;
  return !/timed? ?out|connection|ECONN|fetch failed|abort/i.test(err.message);
}
