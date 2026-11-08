'use client';

/* eslint-disable @next/next/no-img-element -- data-URL crops and a local preview, not optimisable */
import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Loader2 } from 'lucide-react';
import { Button, buttonClasses } from '@/components/ui/button';
import { Stagger, StaggerItem } from '@/components/motion/reveal';
import { Icon } from '@/components/ui/icon';
import { Sheet } from '@/components/ui/sheet';
import { cx } from '@/components/ui/cx';
import { FILE_INPUT, PHOTO_ACCEPT, pickOne, usePickedBeforeHydration } from '@/components/setup/PhotoPicker';
import { ApiError } from '@/lib/client/http';
import { dataUrlToBlob, proposeFromCounter, uploadItemPhoto, type CounterProposal } from '@/lib/client/item-photos';
import { useAction } from '@/lib/feedback/use-action';

export const NONE_FOUND = 'We couldn’t match any items. Try a closer photo.';

type Run =
  | { phase: 'idle' }
  | { phase: 'reading'; preview: string }
  | { phase: 'done'; proposals: CounterProposal[] }
  | { phase: 'error'; message: string };

type Choice = 'used' | 'skipped';

/** The Use button says "Kept" this long before the row settles on its kept line. */
const KEPT_HOLD_MS = 1200;

/** Use and Skip for one found photo. Keeping it uploads the crop as the item's photo. */
function ProposalActions({
  shopId,
  proposal,
  replace,
  onKept,
  onSkip,
}: {
  shopId: string;
  proposal: CounterProposal;
  replace: boolean;
  onKept: (photoUrl: string) => void;
  onSkip: () => void;
}) {
  const { status, run, error } = useAction(() => uploadItemPhoto(shopId, proposal.itemId, dataUrlToBlob(proposal.image)));
  const keep = async () => {
    const url = await run();
    if (url) onKept(url);
  };
  return (
    <>
      <div className="flex gap-1.5">
        <Button className="flex-1 px-3" status={status} successLabel="Kept" onClick={() => void keep()} aria-label={`${replace ? 'Replace' : 'Use'}: ${proposal.name}`}>
          {replace ? 'Replace' : 'Use'}
        </Button>
        <Button variant="ghost" className="px-3" disabled={status !== 'idle'} onClick={onSkip} aria-label={`Skip: ${proposal.name}`}>
          Skip
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-error">
          {error}
        </p>
      )}
    </>
  );
}

/**
 * "Snap your counter" (spec §4b, stretch): one photo of the display case; Claude proposes a crop for each menu item it
 * can see, and the seller keeps (Use) or skips each one. Nothing is stored until Use uploads the crop as the item's photo.
 */
export function CounterSnap({
  shopId,
  hasPhoto,
  onPhoto,
}: {
  shopId: string;
  /** Whether an item already has a photo: its button says Replace instead of Use. */
  hasPhoto: (itemId: string) => boolean;
  onPhoto: (itemId: string, photoUrl: string) => void;
}) {
  const [run, setRun] = useState<Run>({ phase: 'idle' });
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  // Each reading has a number; closing the sheet or starting another one moves it on, so a late answer is dropped.
  const current = useRef(0);
  const preview = run.phase === 'reading' ? run.preview : null;
  useEffect(() => (preview ? () => URL.revokeObjectURL(preview) : undefined), [preview]);

  const start = async (files: FileList | null) => {
    const picked = pickOne(files);
    if (!picked) return;
    const id = ++current.current;
    setChoices({});
    if ('error' in picked) return setRun({ phase: 'error', message: picked.error });
    setRun({ phase: 'reading', preview: URL.createObjectURL(picked.file) });
    try {
      const proposals = await proposeFromCounter(shopId, picked.file);
      if (id === current.current) setRun({ phase: 'done', proposals });
    } catch (e) {
      const message = e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong. Try again.';
      if (id === current.current) setRun({ phase: 'error', message });
    }
  };

  const close = () => {
    current.current++;
    setRun({ phase: 'idle' });
  };

  const kept = (itemId: string, url: string) => {
    onPhoto(itemId, url);
    setTimeout(() => setChoices((c) => ({ ...c, [itemId]: 'used' })), KEPT_HOLD_MS);
  };

  const input = useRef<HTMLInputElement>(null);
  usePickedBeforeHydration(input, (files) => void start(files));

  const shown = run.phase === 'done' ? run.proposals.filter((p) => choices[p.itemId] !== 'skipped') : [];

  return (
    <>
      <label className={buttonClasses({ variant: 'primary', className: 'cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus' })}>
        <input
          ref={input}
          type="file"
          accept={PHOTO_ACCEPT}
          aria-label="Snap your counter"
          className={FILE_INPUT}
          onChange={(e) => {
            void start(e.currentTarget.files);
            e.currentTarget.value = '';
          }}
        />
        <Icon icon={Camera} />
        <span aria-hidden="true">Snap your counter</span>
      </label>

      <Sheet
        open={run.phase !== 'idle'}
        onClose={close}
        title="Snap your counter"
        footer={
          <Button fullWidth variant="secondary" onClick={close}>
            Done
          </Button>
        }
      >
        {run.phase === 'reading' && (
          <div className="flex flex-col gap-4" role="status">
            <div className="relative overflow-hidden rounded-(--photo-radius)">
              <img src={run.preview} alt="" className="aspect-[4/3] w-full object-cover opacity-70" />
              <span className="absolute inset-0 animate-shimmer bg-[linear-gradient(100deg,transparent_30%,rgb(var(--white-rgb)/0.55)_50%,transparent_70%)] bg-[length:200%_100%]" />
            </div>
            <p className="flex items-center gap-2 font-semibold">
              <Icon icon={Loader2} className="animate-spin" /> Finding your items…
            </p>
          </div>
        )}

        {run.phase === 'error' && (
          <p role="alert" className="font-medium text-error">
            {run.message}
          </p>
        )}

        {run.phase === 'done' && run.proposals.length === 0 && <p role="status">{NONE_FOUND}</p>}

        {run.phase === 'done' && run.proposals.length > 0 && (
          // The crops arrive together after Claude answers: they rise in one after another.
          <Stagger>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-5" aria-label="Photos found">
            {shown.map((p) => {
              const choice = choices[p.itemId];
              const replace = hasPhoto(p.itemId) && choice !== 'used';
              return (
                <li key={p.itemId} className="flex flex-col" data-proposal={p.name}>
                <StaggerItem className="flex flex-col gap-2">
                  <img src={p.image} alt={p.name} className={cx('aspect-[4/3] w-full rounded-(--thumb-radius) object-cover', choice === 'used' && 'opacity-60')} />
                  <span className="font-semibold leading-5 [overflow-wrap:anywhere]">{p.name}</span>
                  {choice === 'used' ? (
                    <span className="inline-flex min-h-tap items-center gap-2 text-sm font-semibold text-ok" role="status">
                      <Icon icon={Check} size="sm" /> Kept
                    </span>
                  ) : (
                    <ProposalActions
                      shopId={shopId}
                      proposal={p}
                      replace={replace}
                      onKept={(url) => kept(p.itemId, url)}
                      onSkip={() => setChoices((c) => ({ ...c, [p.itemId]: 'skipped' }))}
                    />
                  )}
                </StaggerItem>
                </li>
              );
            })}
          </ul>
          </Stagger>
        )}
        {run.phase === 'done' && run.proposals.length > 0 && shown.length === 0 && <p>All skipped. Snap again any time.</p>}
      </Sheet>
    </>
  );
}
