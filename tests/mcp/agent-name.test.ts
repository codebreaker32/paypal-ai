// The agent door is stateless, so the MCP clientInfo.name sent at initialize is gone by create_order. Without
// `?agent=`, the order's agent name comes from the User-Agent: a friendly name for known clients, never the raw string.
import { describe, expect, it } from 'vitest';
import { agentFromUserAgent, agentLabel } from '@/lib/mcp/agent-name';

describe('agentFromUserAgent', () => {
  it.each([
    ['claude-code/2.0.14', 'Claude Code'],
    ['claude-cli/1.0.98 (external, cli)', 'Claude Code'],
    ['Claude-User', 'Claude'],
    ['mcp-remote/0.1.29', 'an MCP client'],
    ['mcp-inspector/0.16.0', 'MCP Inspector'],
    ['Mozilla/5.0 MCP Inspector', 'MCP Inspector'],
    ['Cursor/1.4.2', 'Cursor'],
    ['node', 'an AI assistant'],
    ['undici', 'an AI assistant'],
    ['ExampleAgent/2.1', 'an AI assistant'],
    ['python-httpx/0.27.0', 'an AI assistant'],
    ['<script>alert(1)</script>', 'an AI assistant'],
  ])('%s → %s', (ua, name) => {
    expect(agentFromUserAgent(ua)).toBe(name);
  });

  it('has no name when there is no User-Agent', () => {
    expect(agentFromUserAgent(null)).toBeNull();
    expect(agentFromUserAgent('   ')).toBeNull();
  });
});

describe('agentLabel (the ?agent= name)', () => {
  it('is printable, single-spaced and capped at 60 characters', () => {
    expect(agentLabel('  claude\u0000-desktop \n v2 ')).toBe('claude -desktop v2');
    expect(agentLabel('x'.repeat(80))).toHaveLength(60);
    expect(agentLabel('')).toBeNull();
    expect(agentLabel(null)).toBeNull();
  });
});
