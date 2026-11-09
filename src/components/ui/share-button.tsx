'use client';

import { useRef, useSyncExternalStore } from 'react';
import { Share2 } from 'lucide-react';
import { Button } from './button';
import { COPY_FAILED } from './copy-button';
import { useToast, type ToastInput } from './toast';

const COARSE = '(pointer: coarse)';

interface ShareData {
  title: string;
  url: string;
}

/** A desktop browser can have `navigator.share` too, but copying is the better move there, so a touch screen is required. */
export function canNativeShare(nav: { share?: unknown }, coarsePointer: boolean): boolean {
  return typeof nav.share === 'function' && coarsePointer;
}

/**
 * Opens the share sheet. Closing it arrives as an AbortError, which is the seller's choice, not a failure. `inFlight`
 * drops a second tap while the first share is open: the browser would refuse it with an InvalidStateError, and nothing
 * has gone wrong for the seller.
 */
export async function shareAndReport(
  data: ShareData,
  toast: (t: ToastInput) => void,
  share: (data: ShareData) => Promise<void> = (d) => navigator.share(d),
  inFlight: { current: boolean } = { current: false },
): Promise<void> {
  if (inFlight.current) return;
  inFlight.current = true;
  try {
    await share(data);
  } catch (error) {
    if ((error as { name?: unknown } | null | undefined)?.name !== 'AbortError') toast(COPY_FAILED);
  } finally {
    inFlight.current = false;
  }
}

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(COARSE);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/** False on the server and during hydration, so the server's HTML has no button and the two always match. */
function useCanNativeShare(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => canNativeShare(navigator, window.matchMedia(COARSE).matches),
    () => false,
  );
}

/** `Share…` opens the phone's share sheet. Renders nothing where there isn't one. */
export function ShareButton({ title, url, describedBy, className }: ShareData & { describedBy?: string; className?: string }) {
  const toast = useToast();
  const inFlight = useRef(false);
  if (!useCanNativeShare()) return null;
  return (
    <Button variant="secondary" icon={Share2} className={className} aria-describedby={describedBy} onClick={() => void shareAndReport({ title, url }, toast, undefined, inFlight)}>
      Share…
    </Button>
  );
}
