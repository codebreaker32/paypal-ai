'use client';

import { Check, Copy, DoorOpen } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';

function CopyButton({ text, label, what }: { text: string; label: string; what: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: `${what} copied`, tone: 'ok' });
    } catch {
      toast({ title: "Couldn’t copy", description: 'Select the text and copy it yourself.', tone: 'danger' });
    }
  };
  return (
    <Button variant="secondary" icon={copied ? Check : Copy} onClick={copy} aria-label={label} className="shrink-0">
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

function Snippet({ code, what }: { code: string; what: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <pre className="min-w-0 flex-1 rounded-md bg-surface-sunken px-3 py-2.5 font-mono text-sm leading-6 whitespace-pre-wrap [overflow-wrap:anywhere]">
        {code}
      </pre>
      <CopyButton text={code} label={`Copy the ${what}`} what={what} />
    </div>
  );
}

export interface AgentDoorProps {
  slug: string;
  shopName: string;
  /** `${APP_URL}/s/<slug>/mcp` */
  url: string;
}

/** The shop’s agent door: the address any MCP-capable assistant can order through, and how to connect one. */
export function AgentDoor({ slug, shopName, url }: AgentDoorProps) {
  const desktopConfig = JSON.stringify({ mcpServers: { [slug]: { command: 'npx', args: ['mcp-remote', url] } } }, null, 2);
  return (
    <section id="agent-door" aria-labelledby="agent-door-title" className="flex scroll-mt-6 flex-col gap-4">
      <h2 id="agent-door-title" className="type-title flex items-center gap-2.5">
        <Icon icon={DoorOpen} size="lg" className="text-accent" />
        Agent door
      </h2>
      <p className="max-w-measure text-ink-soft">
        Any AI assistant that speaks MCP can read {shopName}’s menu and place an order through this address. Prices
        always come from the shop, and the buyer approves every payment on PayPal.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 rounded-md border border-line-strong bg-surface-raised px-3 py-2.5 font-mono text-sm [overflow-wrap:anywhere]">
          {url}
        </code>
        <CopyButton text={url} label="Copy the agent door link" what="Agent door link" />
      </div>
      <Tabs
        label="Connect an assistant"
        items={[
          {
            id: 'claude-code',
            label: 'Claude Code',
            content: <Snippet code={`claude mcp add --transport http ${slug} ${url}`} what="Command" />,
          },
          {
            id: 'claude-desktop',
            label: 'Claude Desktop',
            content: (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-ink-soft">
                  Add this to <code className="font-mono">claude_desktop_config.json</code>, then restart Claude Desktop. It
                  runs <code className="font-mono">npx mcp-remote</code> to reach the door.
                </p>
                <Snippet code={desktopConfig} what="Config" />
              </div>
            ),
          },
          {
            id: 'inspector',
            label: 'Inspector',
            content: (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-ink-soft">
                  Run the Inspector, choose the <strong className="font-semibold">Streamable HTTP</strong> transport and paste
                  the agent door link.
                </p>
                <Snippet code="npx @modelcontextprotocol/inspector" what="Command" />
              </div>
            ),
          },
          {
            id: 'connectors',
            label: 'Connectors',
            content: (
              <p className="max-w-measure text-sm text-ink-soft">
                Custom connectors in the Claude and ChatGPT apps reach the door from the internet, so they need the deployed
                HTTPS address of this shop, not a localhost one. Add the agent door link as a custom connector there.
              </p>
            ),
          },
        ]}
      />
    </section>
  );
}
