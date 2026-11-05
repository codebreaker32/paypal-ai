// Tool results for the agent door. Errors are `{ error: { code, message, hint, retryable, ...details } }` (spec §10).
//
// Errors are returned as `isError: true` with the JSON in a text block only, never as structuredContent: the MCP SDK
// client (1.32) validates structuredContent against the tool's outputSchema even on error results, so an error object
// there makes every SDK-based agent throw instead of reading the error.
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ZodError, ZodIssue } from 'zod';
import { OrderError, type OrderErrorCode } from '@/lib/orders/errors';

export type ToolErrorCode = OrderErrorCode | 'INTERNAL_ERROR';

export interface ToolErrorBody {
  error: { code: ToolErrorCode; message: string; hint: string; retryable: boolean; [detail: string]: unknown };
}

export function toolOk(data: Record<string, unknown>): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data };
}

export function toolError(
  code: ToolErrorCode,
  message: string,
  hint: string,
  opts: { retryable?: boolean; details?: Record<string, unknown> } = {},
): CallToolResult {
  const body: ToolErrorBody = { error: { ...snakeKeys(opts.details), code, message, hint, retryable: opts.retryable ?? false } };
  return { isError: true, content: [{ type: 'text', text: JSON.stringify(body) }] };
}

export function fromOrderError(e: OrderError): CallToolResult {
  return toolError(e.code, e.message, e.hint, { retryable: e.retryable, details: e.details });
}

/** Keys an agent might use to try to set a price. */
const PRICE_KEY = /price|amount|cost|total|subtotal|discount|fee|cents|value|currency/i;

const fmtPath = (path: (string | number)[]) =>
  path.reduce<string>((acc, seg) => (typeof seg === 'number' ? `${acc}[${seg}]` : acc ? `${acc}.${seg}` : seg), '');

/**
 * Turns a strict-schema failure into one named error. Unknown keys come first (a `price` key is the attack we care
 * about), then the quantity and line limits, then anything else, always naming the offending argument.
 */
export function fromZodError(err: ZodError, hint: string): CallToolResult {
  const issues = err.issues;

  const unknown = issues.find((i): i is Extract<ZodIssue, { code: 'unrecognized_keys' }> => i.code === 'unrecognized_keys');
  if (unknown) {
    const key = unknown.keys.find((k) => PRICE_KEY.test(k)) ?? unknown.keys[0];
    const path = fmtPath([...unknown.path, key]);
    const message = PRICE_KEY.test(key)
      ? `\`${key}\` is not accepted; prices are set by the shop.`
      : `\`${key}\` is not a recognised argument.`;
    return toolError('INVALID_ARGUMENTS', message, hint, { details: { field: key, path, unknown_keys: unknown.keys } });
  }

  const qty = issues.find((i) => i.path.at(-1) === 'quantity' && (i.code === 'too_big' || i.code === 'too_small' || (i.code === 'invalid_type' && i.received === 'float')));
  if (qty) {
    return toolError('QUANTITY_LIMIT', `\`${fmtPath(qty.path)}\` must be a whole number from 1 to 20.`, 'Lower the quantity. For bigger orders the user should contact the shop directly.', {
      details: { path: fmtPath(qty.path), max_qty_per_line: 20 },
    });
  }

  const lines = issues.find((i) => i.path.length === 1 && i.path[0] === 'items' && i.code === 'too_big');
  if (lines) {
    return toolError('ORDER_TOO_LARGE', 'An order can have at most 15 lines.', 'Combine repeated items into one line with a higher quantity, or split the order in two.', {
      details: { path: 'items', max_lines: 15 },
    });
  }

  const first = issues[0];
  const path = fmtPath(first?.path ?? []);
  const message = path ? `\`${path}\`: ${first.message}.` : `${first?.message ?? 'Invalid arguments'}.`;
  return toolError('INVALID_ARGUMENTS', message, hint, { details: { path: path || null } });
}

function snakeKeys(details?: Record<string, unknown>): Record<string, unknown> {
  if (!details) return {};
  return Object.fromEntries(Object.entries(details).map(([k, v]) => [k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), v]));
}
