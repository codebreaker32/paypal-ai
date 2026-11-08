'use client';

import Image from 'next/image';
import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Camera, Loader2, Plus, ScanText, X } from 'lucide-react';
import { beginNavigation } from '@/components/motion/tactile';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { TextLink } from '@/components/ui/text-link';
import { cx } from '@/components/ui/cx';
import {
  StartError,
  startErrorMessage,
  startFromPhotos,
  startFromSample,
  type SampleId,
  type StartErrorKind,
} from '@/lib/client/api';
import { MAX_PHOTOS, checkNewPhotos } from '@/lib/client/photos';
import { LIVE_SHOP_HREF, SAMPLE_MENUS } from './samples';

interface PickedPhoto {
  key: number;
  file: File;
  url: string;
}

type Busy = null | { kind: 'photos' } | { kind: 'sample'; id: SampleId };
type ErrorState = null | { area: 'photos' | 'samples'; kind: StartErrorKind };

const plural = (n: number) => `${n} photo${n === 1 ? '' : 's'}`;

/** Snap (primary), try a sample (secondary), see a live shop (tertiary). */
export function StartActions() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const nextKey = useRef(1);
  const hintId = useId();
  const samplesLabelId = useId();
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<ErrorState>(null);

  // Release preview URLs when photos are removed or the page is left.
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const openPicker = () => inputRef.current?.click();

  const onPick = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (inputRef.current) inputRef.current.value = ''; // let the same photo be picked again
    if (files.length === 0) return;
    const check = checkNewPhotos(photos.length, files);
    if (!check.ok) {
      setError({ area: 'photos', kind: check.kind });
      return;
    }
    setError(null);
    setPhotos((prev) => [
      ...prev,
      ...check.files.map((file) => ({ key: nextKey.current++, file, url: URL.createObjectURL(file) })),
    ]);
  };

  const remove = (key: number, why?: StartErrorKind) => {
    setPhotos((prev) => {
      const gone = prev.find((p) => p.key === key);
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter((p) => p.key !== key);
    });
    setError(why ? { area: 'photos', kind: why } : null);
  };

  const fail = (area: 'photos' | 'samples', e: unknown) => {
    setBusy(null);
    setError({ area, kind: e instanceof StartError ? e.kind : 'server' });
  };

  const readMenu = async () => {
    setBusy({ kind: 'photos' });
    setError(null);
    try {
      const { shopId } = await startFromPhotos(photos.map((p) => p.file));
      beginNavigation();
      router.push(`/shops/${shopId}/setup`);
    } catch (e) {
      fail('photos', e);
    }
  };

  const trySample = async (id: SampleId) => {
    setBusy({ kind: 'sample', id });
    setError(null);
    try {
      const { shopId } = await startFromSample(id);
      beginNavigation();
      router.push(`/shops/${shopId}/setup`);
    } catch (e) {
      fail('samples', e);
    }
  };

  const hasPhotos = photos.length > 0;
  const uploading = busy?.kind === 'photos';

  return (
    <div className="flex flex-col gap-8">
      {/* Primary: photos of the seller's own price list */}
      <div className="flex flex-col gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="photo-input"
          onChange={(e) => onPick(e.currentTarget.files)}
        />

        {hasPhotos && (
          <ul aria-label="Photos to read" className="flex flex-wrap gap-3">
            {photos.map((p, i) => (
              <li key={p.key} className="relative">
                <Image
                  src={p.url}
                  alt={`Page ${i + 1}: ${p.file.name}`}
                  width={72}
                  height={96}
                  unoptimized
                  onError={() => remove(p.key, 'bad_file')}
                  className="h-24 w-18 rounded-md object-cover shadow-(--card-shadow)"
                />
                {!uploading && (
                  <button
                    type="button"
                    onClick={() => remove(p.key)}
                    aria-label={`Remove page ${i + 1}`}
                    className="press-icon absolute -top-3 -right-3 inline-flex size-tap items-center justify-center rounded-full"
                  >
                    <span className="inline-flex size-7 items-center justify-center rounded-full bg-surface-raised text-ink shadow-(--card-shadow)">
                      <Icon icon={X} size="sm" />
                    </span>
                  </button>
                )}
              </li>
            ))}
            {photos.length < MAX_PHOTOS && (
              <li>
                <button
                  type="button"
                  onClick={openPicker}
                  disabled={uploading}
                  className="press inline-flex h-24 w-18 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-control text-ink-soft hover:border-ink hover:text-ink disabled:opacity-50"
                >
                  <Icon icon={Plus} />
                  <span className="type-meta font-semibold">Add page</span>
                </button>
              </li>
            )}
          </ul>
        )}

        {hasPhotos ? (
          <Button
            size="lg"
            icon={ScanText}
            loading={uploading}
            loadingLabel={`Uploading ${plural(photos.length)}…`}
            disabled={busy !== null}
            onClick={readMenu}
            aria-describedby={hintId}
            className="sm:w-auto sm:self-start"
            fullWidth
          >
            Read my menu
          </Button>
        ) : (
          <Button
            size="lg"
            icon={Camera}
            disabled={busy !== null}
            onClick={openPicker}
            aria-describedby={hintId}
            className="sm:w-auto sm:self-start"
            fullWidth
          >
            Snap your price list
          </Button>
        )}

        <p id={hintId} className="type-meta text-ink-muted" aria-live="polite">
          {hasPhotos
            ? `${plural(photos.length)} ready. Add up to ${MAX_PHOTOS} if your list runs over several pages.`
            : `Take a photo or choose one. Up to ${MAX_PHOTOS} photos, JPG or PNG.`}
        </p>
        {error?.area === 'photos' && <FieldError>{startErrorMessage(error.kind)}</FieldError>}
      </div>

      {/* Secondary: a sample menu, for anyone without a price list at hand */}
      <div role="group" aria-labelledby={samplesLabelId} className="flex flex-col gap-3">
        <h2 id={samplesLabelId} className="type-label text-ink-muted">
          Or try a sample menu
        </h2>
        <ul className="flex flex-wrap gap-2">
          {SAMPLE_MENUS.map((s) => {
            const loading = busy?.kind === 'sample' && busy.id === s.id;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => trySample(s.id)}
                  disabled={busy !== null}
                  aria-busy={loading || undefined}
                  className={cx(
                    'press group flex min-h-tap items-center gap-2.5 rounded-full bg-surface-sunken py-1 pr-4 pl-1 text-left hover:bg-line',
                    'disabled:cursor-not-allowed',
                    busy !== null && !loading && 'opacity-50',
                  )}
                >
                  <span className="relative block size-9 shrink-0 overflow-hidden rounded-full bg-surface">
                    <Image
                      src={s.image}
                      alt=""
                      width={240}
                      height={180}
                      sizes="36px"
                      className="size-full object-cover"
                    />
                    {loading && (
                      <span className="absolute inset-0 flex items-center justify-center bg-surface/80">
                        <Icon icon={Loader2} size="sm" className="animate-spin text-ink" />
                      </span>
                    )}
                  </span>
                  <span className="flex flex-col">
                    <span className="sr-only">Try the sample menu from </span>
                    <span className="text-sm leading-5 font-semibold text-ink">
                      {s.name}
                    </span>
                    {loading && <span className="type-meta text-ink-muted">Opening…</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {error?.area === 'samples' && <FieldError>{startErrorMessage(error.kind)}</FieldError>}
      </div>

      {/* Tertiary: see what a finished shop looks like */}
      <TextLink href={LIVE_SHOP_HREF} className="-my-2 self-start text-sm text-ink-soft hover:text-ink">
        See a live shop
        <Icon icon={ArrowRight} size="sm" />
      </TextLink>
    </div>
  );
}
