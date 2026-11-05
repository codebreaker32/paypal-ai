'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import { readingStatus, startReading, type ExtractResult } from './api';
import { MenuPhoto } from './MenuPhotos';
import { StepHeader } from './StepHeader';

const LINES = [
  'Looking at your photo',
  'Finding the prices',
  'Matching prices to items',
  'Checking sizes and options',
  'Looking for anything unclear',
  'Writing up your menu',
];
const LINE_MS = 2800;
const SLOW_MS = 20_000;
const POLL_MS = 2500;

/**
 * "Reading your menu…": starts the reading (or joins one already running after a refresh), shows
 * the photo with a calm scan and plain status lines, then refreshes the page into the next step.
 */
export function ReadingStep({
  shopId,
  photoCount,
  running,
  upload,
  onUploadFailed,
}: {
  shopId: string;
  photoCount: number;
  /** A reading is already going on the server: only watch it. */
  running: boolean;
  /** New photos from the retake screen, sent with the request that starts the reading. */
  upload?: { files: File[]; mode: 'replace' | 'add' };
  onUploadFailed?: (message: string) => void;
}) {
  const router = useRouter();
  const [line, setLine] = useState(0);
  const [slow, setSlow] = useState(false);
  // The scan: a band sweeping down the photo, slow and calm. Off entirely with reduced motion.
  const scan = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = scan.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const sweep = el.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(84%)' }], {
      duration: 2800,
      iterations: Infinity,
      direction: 'alternate',
      easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
    });
    return () => sweep.cancel();
  }, []);

  // One request per mount, shared if React runs the effect twice.
  const request = useRef<Promise<ExtractResult> | null>(null);
  // A retaken photo is still uploading: show the local copy, not the old page.
  const preview = useMemo(() => {
    const file = upload?.mode === 'replace' ? upload.files[0] : undefined;
    return file ? URL.createObjectURL(file) : undefined;
  }, [upload]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  // Rotate the status lines, and admit it when it takes a while.
  useEffect(() => {
    const tick = setInterval(() => setLine((l) => Math.min(l + 1, LINES.length - 1)), LINE_MS);
    const late = setTimeout(() => setSlow(true), SLOW_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(late);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      if (cancelled) return;
      try {
        const status = await readingStatus(shopId);
        if (cancelled) return;
        if (status === 'running') timer = setTimeout(poll, POLL_MS);
        else router.refresh();
      } catch {
        timer = setTimeout(poll, POLL_MS * 2);
      }
    };

    if (running) {
      // Already going on the server (say, the page was refreshed mid-run): watch it.
      timer = setTimeout(poll, POLL_MS);
    } else {
      request.current ??= startReading(shopId, upload);
      void request.current.then((r) => {
        if (cancelled) return;
        if (r.kind === 'running') timer = setTimeout(poll, POLL_MS);
        else if (r.kind === 'failed' && upload && onUploadFailed) onUploadFailed(r.message);
        else router.refresh();
      });
    }
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [shopId, running, upload, onUploadFailed, router]);

  return (
    <div className="mx-auto grid w-full max-w-page grid-cols-1 gap-6 px-gutter pt-8 pb-section lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:gap-x-12 lg:gap-y-8 lg:pt-12">
      <div className="flex flex-col gap-6 lg:col-span-6 lg:col-start-1 lg:row-start-1 lg:gap-8 lg:pt-6">
        <StepHeader
          step={1}
          title="Reading your menu…"
          lead="Claude is reading every line of your photo. Nothing goes live until you check it."
        />
        <div className="flex flex-col gap-2" aria-live="polite">
          <p className="flex items-center gap-2.5 type-lead font-semibold">
            <Icon icon={Loader2} className="animate-spin text-accent" />
            <span>{LINES[line]}</span>
          </p>
          {slow ? (
            <p className="text-ink-soft">Long menus take up to a minute. You can keep this page open.</p>
          ) : (
            <p className="text-ink-muted">This usually takes about 10 seconds.</p>
          )}
        </div>
      </div>

      <div className="lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1">
        <MenuPhoto
          shopId={shopId}
          page={1}
          src={preview}
          priority
          sizes="(min-width: 1024px) 34vw, 100vw"
          className="mx-auto aspect-[4/5] w-full max-w-md lg:max-w-none"
        >
          <span ref={scan} aria-hidden="true" className="pointer-events-none absolute inset-0 motion-reduce:hidden">
            <span className="absolute inset-x-0 top-[calc(8%-3rem)] h-12 bg-[linear-gradient(to_bottom,transparent,color-mix(in_srgb,var(--color-accent)_18%,transparent))]" />
            <span className="absolute inset-x-0 top-[8%] h-0.5 bg-accent shadow-xs" />
          </span>
        </MenuPhoto>
        {photoCount > 1 && <p className="mt-3 type-meta text-ink-muted">Reading all {photoCount} pages together.</p>}
      </div>

      <Link
        href="/"
        className="-my-2 inline-flex min-h-tap items-center self-start justify-self-start font-semibold text-accent-ink underline decoration-accent/40 hover:decoration-accent lg:col-span-6 lg:col-start-1 lg:row-start-2"
      >
        Cancel
      </Link>
    </div>
  );
}
