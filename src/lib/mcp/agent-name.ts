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

/** A short, printable label (the `?agent=` name), or null. */
export function agentLabel(raw: string | null): string | null {
  const s = raw?.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  return s || null;
}

/** A friendly name for a known client's User-Agent; any other client (node, undici, …) is "an AI assistant". */
export function agentFromUserAgent(userAgent: string | null): string | null {
  const ua = agentLabel(userAgent);
  if (!ua) return null;
  return KNOWN.find((k) => k.pattern.test(ua))?.name ?? UNKNOWN_AGENT;
}
