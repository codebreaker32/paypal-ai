import type Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { MODEL_ID, getAnthropic } from './anthropic';
import { MENU_SYSTEM_PROMPT, MENU_USER_PROMPT, pageLabel, retryPrompt } from './prompts';
import { MenuExtractionSchema, type MenuExtraction } from './schemas';

export interface MenuPhoto {
  data: Buffer;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
}

const TIMEOUT_MS = 90_000;

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

async function callOnce(client: Anthropic, photos: MenuPhoto[], prompt: string): Promise<MenuExtraction> {
  const response = await client.messages.parse(
    {
      model: MODEL_ID,
      max_tokens: 16000,
      system: MENU_SYSTEM_PROMPT,
      output_config: { format: zodOutputFormat(MenuExtractionSchema), effort: 'medium' },
      messages: [{ role: 'user', content: buildContent(photos, prompt) }],
    },
    { timeout: TIMEOUT_MS },
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
  try {
    return await callOnce(client, photos, MENU_USER_PROMPT);
  } catch (err) {
    if (!isParseFailure(err)) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    return await callOnce(client, photos, retryPrompt(msg));
  }
}

/** API errors carry an HTTP status and connection/timeout errors are not worth a re-prompt. */
function isParseFailure(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (typeof (err as { status?: unknown }).status === 'number') return false;
  return !/timed? ?out|connection|ECONN|fetch failed|abort/i.test(err.message);
}
