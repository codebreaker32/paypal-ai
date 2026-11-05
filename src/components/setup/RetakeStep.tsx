'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { Camera, ImagePlus, Lightbulb, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FieldError } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { startErrorMessage } from '@/lib/client/api';
import { MAX_PHOTOS, checkNewPhotos } from '@/lib/client/photos';
import { PhotoStrip } from './MenuPhotos';
import { StepHeader } from './StepHeader';

const TITLES: Record<string, string> = {
  not_a_menu: "This doesn't look like a price list",
  unreadable: "We couldn't read this photo",
  no_items: "We couldn't find any prices",
};

// The reader's tip for "not a menu" restates the problem; say what to photograph instead.
const NOT_A_MENU_TIP = 'Point the camera at your price list, menu board or price card, with the prices in the frame.';

export type RetakeUpload = { files: File[]; mode: 'replace' | 'add' };

/** Reading gave up on the photo: say why, give the tip for that problem, and keep the photos. */
export function RetakeStep({
  shopId,
  photoCount,
  reason,
  tip,
  error,
  onUpload,
}: {
  shopId: string;
  photoCount: number;
  reason: string;
  tip: string;
  error?: string | null;
  onUpload: (u: RetakeUpload) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const mode = useRef<'replace' | 'add'>('replace');
  const [problem, setProblem] = useState<string | null>(null);
  const canAdd = photoCount < MAX_PHOTOS && reason !== 'not_a_menu';

  const pick = (m: 'replace' | 'add') => {
    mode.current = m;
    input.current?.click();
  };
  const onPick = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (input.current) input.current.value = '';
    if (!files.length) return;
    const check = checkNewPhotos(mode.current === 'add' ? photoCount : 0, files);
    if (!check.ok) return setProblem(startErrorMessage(check.kind));
    setProblem(null);
    onUpload({ files: check.files, mode: mode.current });
  };

  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-8 px-gutter pt-8 pb-section lg:pt-12">
      <StepHeader step={1} title={TITLES[reason] ?? TITLES.unreadable} lead="Your photos are saved. Try another one and we'll read it again." />

      <Card as="section" aria-labelledby="tip-title" className="flex max-w-measure items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-warn-soft text-warn">
          <Icon icon={Lightbulb} />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id="tip-title" className="type-label">
            Tip for the next photo
          </h2>
          <p>{reason === 'not_a_menu' ? NOT_A_MENU_TIP : /[.!?]$/.test(tip) ? tip : `${tip}.`}</p>
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="type-label">What we tried to read</h2>
        <PhotoStrip shopId={shopId} count={photoCount} />
      </div>

      <div className="flex flex-col gap-3">
        <input
          ref={input}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="retake-input"
          onChange={(e) => onPick(e.currentTarget.files)}
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg" icon={Camera} onClick={() => pick('replace')}>
            Retake photo
          </Button>
          {canAdd && (
            <Button size="lg" variant="secondary" icon={ImagePlus} onClick={() => pick('add')}>
              Add a page
            </Button>
          )}
        </div>
        {(problem || error) && <FieldError>{problem ?? error}</FieldError>}
        <Link
          href="/"
          className="-my-1 inline-flex min-h-tap items-center self-start font-semibold text-accent-ink underline decoration-accent/40 hover:decoration-accent"
        >
          Try a sample menu instead
        </Link>
      </div>
    </div>
  );
}

/** Reading failed (timeout, model error, no key): say so plainly and offer to try again. */
export function FailedStep({ shopId, photoCount, message, onRetry }: { shopId: string; photoCount: number; message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-8 px-gutter pt-8 pb-section lg:pt-12">
      <StepHeader step={1} title="Reading didn’t finish" lead={message} />
      <PhotoStrip shopId={shopId} count={photoCount} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button size="lg" icon={RotateCcw} onClick={onRetry}>
          Try again
        </Button>
        <Link
          href="/"
          className="inline-flex min-h-tap items-center self-start font-semibold text-accent-ink underline decoration-accent/40 hover:decoration-accent sm:self-auto"
        >
          Start over
        </Link>
      </div>
    </div>
  );
}
