// GET /agents.txt: what an agent door is, how to order through one, and every live shop's door, as plain
// fields. The same in Markdown at /llms.txt.
import { getConfig } from '@/lib/config';
import { getDb } from '@/lib/db';
import { listOrderableForIndex } from '@/lib/db/repos/shops';
import { INDEX_LIMIT, discoveryIndex } from '@/lib/discovery/index-file';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  const text = discoveryIndex(listOrderableForIndex(getDb(), INDEX_LIMIT), getConfig().appUrl, 'agents');
  return new Response(text, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
