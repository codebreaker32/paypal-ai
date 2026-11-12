'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link as LinkIcon, MessageCircle, MessageSquare, Share2 } from 'lucide-react';
import { Button, buttonClasses } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { receiptShare } from '@/lib/orders/receipt-share';

const noSubscribe = () => () => {};
const canShareNow = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';
const serverFalse = () => false;

/**
 * "Keep this receipt": send the receipt link to yourself with the device's own apps. No phone number is asked for or
 * stored, and nothing is sent from Shelfie.
 */
export function KeepReceipt({ appUrl, orderRef, shopName, number }: { appUrl: string; orderRef: string; shopName: string; number: string }) {
  const share = receiptShare({ appUrl, orderRef, shopName, number });
  const canShare = useSyncExternalStore(noSubscribe, canShareNow, serverFalse);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const onShare = async () => {
    try {
      await navigator.share({ title: share.title, text: share.text, url: share.url });
    } catch {
      // Dismissed, or the share sheet failed: nothing to do.
    }
  };
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
    } catch {
      // Clipboard blocked: the other buttons still work.
    }
  };

  const linkClass = buttonClasses({ variant: 'secondary', className: 'gap-2' });
  return (
    <section aria-labelledby="keep-receipt" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="keep-receipt" className="type-title">
          Keep this receipt
        </h2>
        <p className="type-meta text-ink-muted">Send this page’s link to your phone. Shelfie doesn’t ask for your number.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {canShare && (
          <Button variant="secondary" icon={Share2} onClick={onShare}>
            Share
          </Button>
        )}
        <a href={share.whatsappHref} target="_blank" rel="noopener noreferrer" className={linkClass}>
          <Icon icon={MessageCircle} size="sm" />
          WhatsApp
        </a>
        <a href={share.smsHref} className={linkClass}>
          <Icon icon={MessageSquare} size="sm" />
          Text message
        </a>
        <Button variant="secondary" icon={LinkIcon} onClick={onCopy} aria-live="polite">
          {copied ? 'Copied' : 'Copy link'}
        </Button>
      </div>
    </section>
  );
}
