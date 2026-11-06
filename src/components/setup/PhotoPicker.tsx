'use client';

/* eslint-disable @next/next/no-img-element -- site-relative uploads of unknown size, as in ItemPhoto */
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { cx } from '@/components/ui/cx';
import { ItemPhoto } from '@/components/shop/ItemPhoto';
import { startErrorMessage } from '@/lib/client/api';
import { checkNewPhotos } from '@/lib/client/photos';
import { removeCover, removeItemPhoto, uploadCover, uploadItemPhoto } from '@/lib/client/item-photos';

export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';

/** The one photo a picker handed us, checked like the start page's photos; or the plain message for what's wrong. */
export function pickOne(files: FileList | null): { file: File } | { error: string } | null {
  const list = files ? Array.from(files).slice(0, 1) : [];
  if (list.length === 0) return null;
  const check = checkNewPhotos(0, list);
  return check.ok ? { file: check.files[0] } : { error: startErrorMessage(check.kind) };
}

const message = (e: unknown) => (e instanceof Error ? e.message : "Couldn’t save the photo. Try again.");

/** Upload, replace and remove for one photo (an item's or the cover), with busy and error state. */
function usePhotoActions(
  upload: (file: File) => Promise<string>,
  remove: () => Promise<void>,
  onChange: (url: string | null) => void,
  onError?: (message: string | null) => void,
) {
  const [busy, setBusy] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const setError = (m: string | null) => {
    setErrorState(m);
    onError?.(m);
  };
  const run = async (work: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    try {
      onChange(await work());
      return true;
    } catch (e) {
      setError(message(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const pick = (files: FileList | null) => {
    const picked = pickOne(files);
    if (!picked) return Promise.resolve(false);
    if ('error' in picked) {
      setError(picked.error);
      return Promise.resolve(false);
    }
    return run(() => upload(picked.file));
  };
  return { busy, error, pick, remove: () => run(async () => (await remove(), null)) };
}

/**
 * A photo picked before React hydrated. A label opens the native picker before the page's scripts run, so the input's
 * change event is lost and the file stays in it (picking the same photo again fires no change). On mount, the file is
 * handed to `onPick` and the input cleared, as its own change handler would have done.
 */
export function usePickedBeforeHydration(ref: RefObject<HTMLInputElement | null>, onPick: (files: FileList) => void) {
  useEffect(() => {
    const input = ref.current;
    if (!input?.files?.length) return;
    onPick(input.files);
    input.value = '';
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount: later picks go through onChange
  }, []);
}

/** The file input fills its label, invisible: the label's whole area is the input's own tap target. */
export const FILE_INPUT = 'absolute inset-0 z-0 size-full cursor-pointer opacity-0 file:cursor-pointer';

/** A visually hidden file input inside a label styled as a button: the whole label is the tap target. */
function FileLabel({
  label,
  onPick,
  disabled,
  className,
  children,
}: {
  label: string;
  onPick: (files: FileList | null) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  usePickedBeforeHydration(input, onPick);
  return (
    <label
      className={cx(
        'relative has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
        disabled && 'pointer-events-none',
        className,
      )}
    >
      <input
        ref={input}
        type="file"
        accept={PHOTO_ACCEPT}
        aria-label={label}
        disabled={disabled}
        className={FILE_INPUT}
        onChange={(e) => {
          const files = e.currentTarget.files;
          onPick(files);
          e.currentTarget.value = '';
        }}
      />
      {children}
    </label>
  );
}

function Busy({ label }: { label: string }) {
  return (
    <span className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-surface/70" role="status">
      <Icon icon={Loader2} className="animate-spin text-ink" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export interface ItemPhotoPickerProps {
  shopId: string;
  itemId: string;
  name: string;
  photoUrl: string | null;
  /** Menu section index, for the fallback tint. */
  tone?: number;
  onChange: (photoUrl: string | null) => void;
  /** Hears the latest error (or null once a try succeeds), for the row to show with PhotoError. */
  onError?: (message: string | null) => void;
  /** Thumbnail size: `md` 64 px (setup review), `sm` 56 px (Menu tab rows). */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * An item's thumbnail that is also its photo control. Without a photo, a tap opens the camera or library; with one, a
 * sheet shows it large with Replace and Remove. Errors (a refused file, a failed upload) show under the thumbnail's row.
 */
export function ItemPhotoPicker({ shopId, itemId, name, photoUrl, tone = 0, onChange, onError, size = 'md', className }: ItemPhotoPickerProps) {
  const [open, setOpen] = useState(false);
  const actions = usePhotoActions(
    (file) => uploadItemPhoto(shopId, itemId, file),
    () => removeItemPhoto(shopId, itemId),
    onChange,
    onError,
  );
  const box = cx('relative block shrink-0 rounded-(--thumb-radius) bg-surface-sunken', size === 'md' ? 'size-16' : 'size-14', className);

  return (
    <div className="flex flex-col gap-1" data-photo-picker={itemId}>
      {photoUrl ? (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={`Photo of ${name}: replace or remove`}
          onClick={() => setOpen(true)}
          className={cx(box, 'transition-[filter] hover:brightness-95')}
        >
          <img src={photoUrl} alt={name} className="size-full rounded-(--thumb-radius) object-cover" />
          {actions.busy && <Busy label={`Saving the photo of ${name}`} />}
        </button>
      ) : (
        <FileLabel label={`Add a photo of ${name}`} onPick={(f) => void actions.pick(f)} disabled={actions.busy} className={cx(box, 'group')}>
          <ItemPhoto name={name} photoUrl={null} tone={tone} size="sm" decorative className="size-full rounded-(--thumb-radius)" />
          <span className="absolute -right-1.5 -bottom-1.5 flex size-6 items-center justify-center rounded-full bg-surface text-ink shadow-sm transition-transform group-hover:scale-110">
            <Icon icon={ImagePlus} size="sm" />
          </span>
          {actions.busy && <Busy label={`Saving the photo of ${name}`} />}
        </FileLabel>
      )}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={name}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              icon={Trash2}
              loading={actions.busy}
              onClick={async () => {
                if (await actions.remove()) setOpen(false);
              }}
            >
              Remove photo
            </Button>
            <FileLabel
              label={`Replace the photo of ${name}`}
              disabled={actions.busy}
              onPick={async (f) => {
                if (await actions.pick(f)) setOpen(false);
              }}
              className="inline-flex min-h-tap items-center justify-center gap-2 rounded-full bg-ink px-5 font-semibold text-surface hover:bg-ink-hover"
            >
              <Icon icon={ImagePlus} />
              <span aria-hidden="true">Replace photo</span>
            </FileLabel>
          </div>
        }
      >
        {photoUrl && <img src={photoUrl} alt={name} className="aspect-[4/3] w-full rounded-(--photo-radius) object-cover" />}
        {actions.error && (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            {actions.error}
          </p>
        )}
      </Sheet>
    </div>
  );
}

/** The picker's error as its row shows it: the thumbnail itself is too narrow for a sentence. */
export function PhotoError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-sm font-medium text-danger">
      {error}
    </p>
  );
}

export interface CoverPickerProps {
  shopId: string;
  shopName: string;
  coverUrl: string | null;
  onChange: (coverUrl: string | null) => void;
}

/** The shop's cover: a wide photo with Replace and Remove, or an empty frame that asks for one. */
export function CoverPicker({ shopId, shopName, coverUrl, onChange }: CoverPickerProps) {
  const actions = usePhotoActions(
    (file) => uploadCover(shopId, file),
    () => removeCover(shopId),
    onChange,
  );
  return (
    <div className="flex flex-col gap-3" data-cover-picker>
      {coverUrl ? (
        <div className="relative overflow-hidden rounded-(--cover-radius) bg-surface-sunken">
          <img src={coverUrl} alt={`${shopName} cover`} className="aspect-[16/7] w-full object-cover sm:aspect-[3/1]" />
          {actions.busy && <Busy label="Saving your cover" />}
        </div>
      ) : (
        <FileLabel
          label="Add a cover photo"
          onPick={(f) => void actions.pick(f)}
          disabled={actions.busy}
          className="relative flex aspect-[16/7] w-full flex-col sm:aspect-[3/1] items-center justify-center gap-2 overflow-hidden rounded-(--cover-radius) bg-surface-sunken text-ink-soft transition-colors hover:bg-line"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-surface text-ink shadow-xs">
            <Icon icon={ImagePlus} />
          </span>
          <span className="font-semibold text-ink">Add a cover photo</span>
          {actions.busy && <Busy label="Saving your cover" />}
        </FileLabel>
      )}
      {coverUrl && (
        <div className="flex flex-wrap gap-2">
          <FileLabel
            label="Replace the cover photo"
            onPick={(f) => void actions.pick(f)}
            disabled={actions.busy}
            className="inline-flex min-h-tap items-center justify-center gap-2 rounded-full bg-surface-sunken px-5 font-semibold text-ink hover:bg-line"
          >
            <span aria-hidden="true">Replace cover</span>
          </FileLabel>
          <Button variant="ghost" disabled={actions.busy} onClick={() => void actions.remove()}>
            Remove cover
          </Button>
        </div>
      )}
      {actions.error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {actions.error}
        </p>
      )}
    </div>
  );
}
