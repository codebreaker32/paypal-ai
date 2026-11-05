// The agent name shown to the seller ("via Claude Code"). The door is stateless, so the clientInfo.name an MCP client
// sends at initialize is gone by create_order: the name comes from `?agent=`, or else from the User-Agent, mapped to a
// friendly name for known clients. A raw User-Agent string is never shown.

/** Known clients by User-Agent, most specific first. */
const KNOWN: { pattern: RegExp; name: string }[] = [
  { pattern: /claude-code|claude-cli/i, name: 'Claude Code' },
  { pattern: /inspector/i, name: 'MCP Inspector' },
  { pattern: /mcp-remote/i, name: 'an MCP client' },
  { pattern: /cursor/i, name: 'Cursor' },
  { pattern: /claude/i, name: 'Claude' },
];

export const UNKNOWN_AGENT = 'an AI assistant';

/** Printable, single-spaced and at most `max` characters, or null. */
function printable(raw: string | null, max: number): string | null {
  const s = raw?.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  return s || null;
}

/** A short, printable label (the `?agent=` name), or null. */
export function agentLabel(raw: string | null): string | null {
  return printable(raw, 60);
}

/**
 * A friendly name for a known client's User-Agent; any other client (node, undici, …) is "an AI assistant". Matched on
 * the first 256 characters, since client tokens often come late (an Electron UA ending in "Cursor/1.4").
 */
export function agentFromUserAgent(userAgent: string | null): string | null {
  const ua = printable(userAgent, 256);
  if (!ua) return null;
  return KNOWN.find((k) => k.pattern.test(ua))?.name ?? UNKNOWN_AGENT;
}
