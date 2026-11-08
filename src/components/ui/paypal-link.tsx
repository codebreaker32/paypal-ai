'use client';

import { useEffect, useState, type ComponentProps, type MouseEvent, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { layerClass } from './button-status';
import { buttonClasses, type ButtonSize } from './button';
import { Icon } from './icon';

type ClickModifiers = Pick<MouseEvent, 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>;

/** Whether a click on the link takes this tab to PayPal (a modified or new-tab click leaves this page where it is). */
export function leavesThisPage(click: ClickModifiers, target?: string): boolean {
  if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return false;
  return !target || target === '_self';
}

/** How long "Opening PayPal…" can stand if the browser never leaves (Stop pressed, a blocked navigation). */
const GIVE_UP_MS = 10_000;

export interface PayPalLinkProps extends Omit<ComponentProps<'a'>, 'children'> {
  href: string;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: ReactNode;
}

/**
 * The link out to PayPal. A real anchor, so it works before hydration and in a new tab. On a click that leaves this page
 * the label becomes "Opening PayPal…" with a spinner (the width holds), reset on `pageshow` for a return from PayPal.
 */
export function PayPalLink({ href, size = 'md', fullWidth, className, onClick, target, children, ...rest }: PayPalLinkProps) {
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (!opening) return;
    const reset = () => setOpening(false);
    window.addEventListener('pageshow', reset);
    const giveUp = setTimeout(reset, GIVE_UP_MS);
    return () => {
      window.removeEventListener('pageshow', reset);
      clearTimeout(giveUp);
    };
  }, [opening]);

  const status = opening ? 'loading' : 'idle';
  const iconSize = size === 'lg' ? 'lg' : 'md';
  return (
    <a
      data-slot="button"
      data-variant="paypal"
      data-status={status}
      href={href}
      target={target}
      className={buttonClasses({ variant: 'paypal', size, fullWidth, layered: true, className })}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented && leavesThisPage(e, target)) setOpening(true);
      }}
      {...rest}
    >
      <span data-layer="idle" className={layerClass('idle', status, { delayed: false })}>
        <span>{children}</span>
      </span>
      <span data-layer="loading" className={layerClass('loading', status, { delayed: false })}>
        <Icon icon={Loader2} size={iconSize} className={opening ? 'animate-spin' : undefined} />
        <span>Opening PayPal…</span>
      </span>
    </a>
  );
}
