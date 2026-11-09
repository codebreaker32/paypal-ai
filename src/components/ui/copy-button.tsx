'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button, type ButtonSize } from './button';
import { Icon } from './icon';
import { IconButton } from './icon-button';
import { useToast, type ToastInput } from './toast';
import { cx } from './cx';

const COPIED_MS = 2000;

const COPY_FAILED: ToastInput = { title: 'Couldn’t copy', description: 'Select the text and copy it yourself.', tone: 'danger' };

/** Puts `text` on the clipboard. Success needs no toast (the button says so); a refused clipboard does. */
export async function copyAndReport(
  text: string,
  toast: (t: ToastInput) => void,
  write: (text: string) => Promise<void> = (t) => navigator.clipboard.writeText(t),
): Promise<boolean> {
  try {
    await write(text);
    return true;
  } catch {
    toast(COPY_FAILED);
    return false;
  }
}

export interface CopyButtonProps {
  text: string;
  /** What gets copied: names the button ("Copy {what}") and the confirmation ("{what} copied"). */
  what: string;
  /** Replaces "Copy" with the whole action ("Copy agent door link"), which then also names the button. */
  label?: string;
  /** A spoken name that differs from the visible one. */
  ariaLabel?: string;
  iconOnly?: boolean;
  /** The screen's one filled button. */
  primary?: boolean;
  /** A quieter button with no fill, for a group that already has a primary. */
  ghost?: boolean;
  /** Runs after a successful copy (the recovery key notes that it was saved). */
  onCopied?: () => void;
  size?: ButtonSize;
  /** The id of the element showing the text being copied. */
  describedBy?: string;
  className?: string;
}

/** Both labels stay in one grid cell so the button keeps the width of the longer one. */
function CopyLabel({ copied, label, size }: { copied: boolean; label: string; size: ButtonSize }) {
  const iconSize = size === 'lg' ? 'lg' : 'md';
  return (
    <span className="grid place-items-center [&>*]:[grid-area:1/1]">
      <span className={cx('inline-flex items-center gap-2', copied && 'invisible opacity-0')}>
        <Icon icon={Copy} size={iconSize} />
        {label}
      </span>
      <span className={cx('inline-flex items-center gap-2', !copied && 'invisible opacity-0')}>
        <Icon icon={Check} size={iconSize} className={copied ? 'animate-pop' : undefined} />
        Copied
      </span>
    </span>
  );
}

/**
 * One copy control for the whole app, labelled or icon-only. It confirms in place for 2 s and stays usable: copying the
 * same thing twice is fine, and a busy cursor or `aria-disabled` would claim otherwise. Announces through its own status
 * region; only a failure shows a toast.
 */
export function CopyButton({ text, what, label, ariaLabel, iconOnly, primary, ghost, onCopied, size = 'md', describedBy, className }: CopyButtonProps) {
  const toast = useToast();
  // A counter, not a boolean: copying again while it says Copied restarts the 2 s.
  const [copies, setCopies] = useState(0);
  const copied = copies > 0;

  useEffect(() => {
    if (copies === 0) return;
    const t = setTimeout(() => setCopies(0), COPIED_MS);
    return () => clearTimeout(t);
  }, [copies]);

  const onCopy = async () => {
    if (await copyAndReport(text, toast)) {
      setCopies((n) => n + 1);
      onCopied?.();
    }
  };

  const done = `${what} copied`;
  const status = (
    <span role="status" className="sr-only">
      {copied ? done : ''}
    </span>
  );

  if (iconOnly) {
    return (
      <>
        <IconButton
          icon={copied ? Check : Copy}
          iconClassName={copied ? 'animate-pop' : undefined}
          label={copied ? done : `Copy ${what}`}
          aria-describedby={describedBy}
          onClick={onCopy}
          className={className}
        />
        {status}
      </>
    );
  }
  return (
    <>
      <Button
        variant={primary ? 'primary' : ghost ? 'ghost' : 'secondary'}
        size={size}
        onClick={onCopy}
        className={className}
        aria-describedby={describedBy}
        // After a copy the visible "Copied" alone would lose which link it was: say it in full.
        aria-label={copied ? done : (ariaLabel ?? (label ? undefined : `Copy ${what}`))}
      >
        <CopyLabel copied={copied} label={label ?? 'Copy'} size={size} />
      </Button>
      {status}
    </>
  );
}
