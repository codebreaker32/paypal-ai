'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { cx } from '@/components/ui/cx';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** "Copy" with a label, or an icon-only copy button (`what` names it: "Copy PayPal order ID"). */
export function CopyButton({ text, what, iconOnly, className }: { text: string; what: string; iconOnly?: boolean; className?: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const onCopy = async () => {
    if (await copyText(text)) {
      setCopied(true);
      toast({ title: `${what} copied`, tone: 'ok', durationMs: 2500 });
    } else {
      toast({ title: "Couldn’t copy", description: 'Select the text and copy it yourself.', tone: 'danger' });
    }
  };

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={onCopy}
        aria-label={copied ? `${what} copied` : `Copy ${what}`}
        className={cx(
          'inline-flex size-tap shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-surface-sunken hover:text-ink',
          className,
        )}
      >
        <Icon icon={copied ? Check : Copy} size="sm" />
      </button>
    );
  }
  return (
    <Button variant="secondary" icon={copied ? Check : Copy} onClick={onCopy} className={className} aria-label={`Copy ${what}`}>
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}
