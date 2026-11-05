// POST /api/assistant/[slug] { sessionId?, text } → application/x-ndjson stream of ConsoleEvents (the buyer console).
import { z } from 'zod';
import { CONSOLE_AGENT_NAME, runBuyerConsoleTurn, type ConsoleEvent } from '@/lib/agent/buyer-console';
import { getConfig } from '@/lib/config';
import { getDb } from '@/lib/db';
import * as shopsRepo from '@/lib/db/repos/shops';
import { clientIp } from '@/lib/http/client-ip';
import { jsonError } from '@/lib/http/json-error';
import { allow } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/** 20 console turns per IP per hour (spec §15: Anthropic spend). */
const CONSOLE_RATE = { limit: 20, windowMs: 60 * 60_000 } as const;

const Body = z
  .object({
    sessionId: z.string().min(1).max(64).optional(),
    text: z.string().trim().min(1).max(500),
  })
  .strict();

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await ctx.params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = null;
  }
  const body = Body.safeParse(raw);
  if (!body.success) return jsonError(400, 'INVALID_MESSAGE', 'Write a message of 1 to 500 characters.');

  const shop = shopsRepo.bySlug(getDb(), slug);
  if (!shop || shop.status === 'draft') return jsonError(404, 'SHOP_NOT_FOUND', 'There is no shop at this address.');

  const buyerIp = clientIp(req);
  if (!allow(`assistant:${buyerIp}`, CONSOLE_RATE.limit, CONSOLE_RATE.windowMs)) {
    return jsonError(429, 'RATE_LIMITED', "You've sent a lot of messages in the last hour. Try again later.");
  }

  // A closed tab stops the turn: no more Claude calls and no orders for a buyer who has gone. Either the request is
  // closed, or the response stream is cancelled.
  const gone = new AbortController();
  const stop = () => gone.abort();
  req.signal.addEventListener('abort', stop, { once: true });
  if (req.signal.aborted) stop();

  const mcpUrl = `${getConfig().appUrl}/s/${encodeURIComponent(shop.slug)}/mcp?agent=${CONSOLE_AGENT_NAME}`;
  const events = runBuyerConsoleTurn({
    shopSlug: shop.slug,
    sessionId: body.data.sessionId ?? null,
    userText: body.data.text,
    mcpUrl,
    buyerIp,
    signal: gone.signal,
  });
  return new Response(ndjson(events, stop), {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    },
  });
}

/**
 * One JSON object per line, flushed as each event happens. A failure mid-stream becomes a last `error` line. Once the
 * reader cancels (tab closed), the turn is stopped and nothing more is written.
 */
function ndjson(events: AsyncGenerator<ConsoleEvent>, stop: () => void): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const line = (e: ConsoleEvent) => encoder.encode(`${JSON.stringify(e)}\n`);
  let finished = false;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await events.next();
        if (finished) return;
        if (next.done) {
          finished = true;
          controller.close();
        } else controller.enqueue(line(next.value));
      } catch (e) {
        if (finished) return;
        finished = true;
        console.error(`[shelfie] buyer console stream failed: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
        controller.enqueue(line({ type: 'error', message: "The shop didn't answer. Try again." }));
        controller.close();
      }
    },
    async cancel() {
      finished = true;
      stop();
      await events.return(undefined).catch(() => {});
    },
  });
}
