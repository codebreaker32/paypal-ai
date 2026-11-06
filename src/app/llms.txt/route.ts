// GET /llms.txt (spec §10a, llmstxt.org layout): what an agent door is, how to order through one, and every live
// shop's door, in Markdown. The same as plain fields at /agents.txt.
import { getConfig } from '@/lib/config';
import { getDb } from '@/lib/db';
import { discoveryIndex, liveShopsForIndex } from '@/lib/discovery/index-file';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  const text = discoveryIndex(liveShopsForIndex(getDb()), getConfig().appUrl, 'llms');
  return new Response(text, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
