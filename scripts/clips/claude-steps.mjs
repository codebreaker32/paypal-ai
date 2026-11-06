#!/usr/bin/env node
// Reads Claude Code's `--output-format stream-json --verbose` on stdin and prints one readable line per step, for the
// discovery clip (05) of the demo video: what Claude Code says, each curl it runs (the URL, or the MCP method and tool
// it sends to the agent door), a one-line summary of each answer, then its final answer with the PayPal link.
//
//   claude --bare -p "…" --output-format stream-json --verbose | steps
//
// Plain Node, no dependencies, so it runs inside the clip's bare environment. It never prints a raw tool result (only
// the summaries below), and it blanks anything shaped like an Anthropic key, so no secret reaches the screen.
import readline from 'node:readline';

const WIDTH = 100;
const C = { reset: '\x1b[0m', bold: '\x1b[1m', muted: '\x1b[90m', ok: '\x1b[32m', warn: '\x1b[33m', call: '\x1b[34m', bad: '\x1b[31m' };
const scrub = (s) => String(s).replace(/sk-ant-[\w-]+/g, 'sk-ant-…');

function wrap(text, indent, width = WIDTH) {
  const out = [];
  for (const para of scrub(text).split('\n')) {
    let line = '';
    for (const word of para.split(/(\s+)/)) {
      if ((line + word).length > width - indent.length && line.trim()) {
        out.push(indent + line.trimEnd());
        line = word.trimStart();
      } else line += word;
    }
    out.push(indent + line.trimEnd());
  }
  return out.join('\n');
}
const say = (s) => process.stdout.write(`${s}\n`);
const short = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const path = (url) => url.replace(/^https?:\/\/[^/]+/, '') || '/';

/** One line per curl in a Bash command: the page it fetches, or the JSON-RPC method (and tool) it posts. */
function describeCommand(cmd) {
  const parts = cmd.split(/(?=\bcurl\s)/).filter((p) => /^curl\s/.test(p.trim()));
  if (!parts.length) return [`$ ${short(cmd.replace(/\s+/g, ' '), 90)}`];
  return parts.map((part) => {
    const url = part.match(/https?:\/\/[^\s'"]+/)?.[0] ?? '';
    const body = part.match(/-d\s+'([^']*)'/)?.[1] ?? part.match(/--data(?:-raw)?\s+'([^']*)'/)?.[1];
    let rpc = null;
    try {
      rpc = body ? JSON.parse(body) : null;
    } catch {
      rpc = null;
    }
    if (rpc?.method === 'tools/call') {
      const args = JSON.stringify(rpc.params?.arguments ?? {});
      return `MCP ${rpc.params?.name} ${C.muted}${short(args === '{}' ? '' : args, 70)}${C.reset}${C.call}  → POST ${path(url)}`;
    }
    if (rpc?.method) return `MCP ${rpc.method}  → POST ${path(url)}`;
    return `curl ${url}`;
  });
}

/** A one-line summary of what came back: never the raw page or JSON. */
function describeResult(content) {
  const text = Array.isArray(content) ? content.map((c) => c.text ?? '').join('\n') : String(content ?? '');
  if (/requires? approval|permission|not allowed/i.test(text) && !text.trim().startsWith('{')) {
    return [`${C.warn}✗ refused: only plain curl is pre-approved${C.reset}`];
  }
  if (/<html|<!doctype/i.test(text)) {
    const door = text.match(/<link rel="alternate"[^>]*title="Agent door \(MCP\)"[^>]*>/)?.[0];
    return [door ? `the shop page; its <head> has ${C.reset}${short(door, 120)}` : `the shop page (${text.length.toLocaleString('en-US')} characters)`];
  }
  const lines = [];
  for (const raw of text.split('\n').filter((l) => l.trim().startsWith('{'))) {
    let msg;
    try {
      msg = JSON.parse(raw.replace(/^data:\s*/, ''));
    } catch {
      continue;
    }
    const r = msg.result ?? {};
    if (Array.isArray(r.tools)) {
      lines.push(`tools: ${r.tools.map((t) => t.name).join(', ')}`);
      continue;
    }
    let inner = r.structuredContent;
    if (!inner && r.content?.[0]?.text) {
      try {
        inner = JSON.parse(r.content[0].text);
      } catch {
        inner = null;
      }
    }
    if (!inner) lines.push(short(JSON.stringify(msg), 90));
    else if (inner.error) lines.push(`${C.bad}${inner.error.code}: ${inner.error.message}${C.reset}`);
    else if (inner.order_number)
      lines.push(`${C.ok}${inner.order_number} · ${inner.status} · total $${inner.total}${C.reset}`, `approval_url ${inner.approval_url}`);
    else if (inner.shop_name) lines.push(`${inner.shop_name} · ${(inner.fulfillment?.modes ?? []).join(' or ')}${inner.accepting_orders ? ' · taking orders' : ''}`);
    else if (inner.sections) {
      const items = inner.sections.flatMap((s) => s.items).map((i) => `${i.name} $${i.options?.[0]?.price ?? '?'}`);
      lines.push(short(items.join(', '), 90));
    } else lines.push(short(JSON.stringify(inner), 90));
  }
  return lines.length ? lines : [short(text.replace(/\s+/g, ' '), 90)];
}

/** Short remarks print as they come; the long final answer prints once, from the result event. */
const NARRATION_MAX = 300;
const rl = readline.createInterface({ input: process.stdin });
for await (const line of rl) {
  let ev;
  try {
    ev = JSON.parse(line);
  } catch {
    continue;
  }
  if (ev.type === 'system' && ev.subtype === 'init') {
    const mcp = ev.mcp_servers?.length ? ev.mcp_servers.map((s) => s.name).join(', ') : 'none';
    say(`${C.muted}● Claude Code (${ev.model}) · MCP servers configured: ${mcp} · it has only the shop's web address${C.reset}\n`);
  } else if (ev.type === 'assistant') {
    for (const block of ev.message?.content ?? []) {
      const text = block.type === 'text' ? block.text.trim() : '';
      if (text && text.length <= NARRATION_MAX) say(`${C.bold}${wrap(text, '  ').trimStart()}${C.reset}`);
      if (block.type === 'tool_use') {
        const cmd = block.input?.command ?? JSON.stringify(block.input ?? {});
        for (const d of describeCommand(scrub(cmd))) say(`${C.call}▸ ${d}${C.reset}`);
      }
    }
  } else if (ev.type === 'user') {
    for (const block of ev.message?.content ?? []) {
      if (block.type === 'tool_result') for (const d of describeResult(block.content)) say(`${C.muted}  ← ${scrub(d)}${C.reset}`);
    }
  } else if (ev.type === 'result') {
    say(`\n${C.muted}── Claude Code's answer (${((ev.duration_ms ?? 0) / 1000).toFixed(1)} s, ${ev.num_turns ?? '?'} turns) ──${C.reset}`);
    say(wrap(String(ev.result ?? '').replace(/\*\*/g, ''), ''));
  }
}
