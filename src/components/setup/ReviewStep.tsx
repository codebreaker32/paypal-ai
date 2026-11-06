'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CircleAlert, CircleCheck, History, Loader2, RotateCcw, Send, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { cx } from '@/components/ui/cx';
import type { ItemWithVariants, SkippedLine } from '@/lib/domain/types';
import type { ReviewShop } from '@/lib/catalog/setup';
import { isPendingPublish, needsSeller } from '@/lib/catalog/rules';
import { PAYEE_REQUIRED_MESSAGE, canBePaid } from '@/lib/domain/payee';
import { addItem, type ItemUpdate } from './api';
import { IssueCard, PhotoContext, type OnUpdate } from './IssueCards';
import { Disclosure, InPersonList, ReadyList, RemovedList, SkippedList } from './ItemLists';
import { MenuPhoto, PhotoStrip } from './MenuPhotos';
import { PublishProgress, usePublish } from './Publishing';
import { PAYEE_FIELD_ID, ShopDetails } from './ShopDetails';
import { StepHeader } from './StepHeader';
import { Reveal } from '@/components/motion/reveal';
import { applyLocal, cardId, flaggedCards, openSkipped } from './review-model';
import { useAutosave, type SaveState } from './useAutosave';

export interface ReviewProps {
  shopId: string;
  photoCount: number;
  shop: ReviewShop;
  items: ItemWithVariants[];
  skipped: SkippedLine[];
  warnings: string[];
  nonUsd: boolean;
  recorded: boolean;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function SaveStatus({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  const busy = state.status === 'pending' || state.status === 'saving';
  // The status region stays mounted through every state (empty while idle or on an error), so screen readers announce
  // "Saving…" when it appears, including after Retry.
  return (
    <>
      {state.status === 'error' && (
        <span className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-error" role="alert">
          <Icon icon={CircleAlert} size="sm" />
          {state.retryable ? "Couldn’t save your last change." : state.message}
          {state.retryable && (
            <Button variant="ghost" icon={RotateCcw} onClick={onRetry} className="-my-1">
              Retry
            </Button>
          )}
        </span>
      )}
      <span className="flex items-center gap-1.5 type-meta text-ink-muted" role="status">
        {(busy || state.status === 'saved') && (
          <>
            <Icon icon={busy ? Loader2 : CircleCheck} size="sm" className={cx(busy && 'animate-spin', !busy && 'text-ok')} />
            {busy ? 'Saving…' : 'Saved'}
          </>
        )}
      </span>
    </>
  );
}

/** Review: flagged cards first, then the ready menu, then everything set aside, then the shop details. */
export function ReviewStep(props: ReviewProps) {
  const { shopId, photoCount } = props;
  const router = useRouter();
  const [items, setItems] = useState(props.items);
  // A save the server refused reloads the page's data (router.refresh()). Adopt the server's menu and
  // details, and remount the cards and lists (keyed by `synced`) so their fields show what was saved.
  const [server, setServer] = useState({ items: props.items, shop: props.shop });
  const [synced, setSynced] = useState(0);
  // Whether the shop can be paid as the PayPal email field stands: publishing needs that, with the server's rule
  // (`canBePaid`: a valid email, or the demo shop, which may leave it empty; spec §8a).
  const [payeeReady, setPayeeReady] = useState(canBePaid(props.shop));
  if (server.items !== props.items || server.shop !== props.shop) {
    setServer({ items: props.items, shop: props.shop });
    setItems(props.items);
    setPayeeReady(canBePaid(props.shop));
    setSynced((n) => n + 1);
  }
  const [skipped] = useState(props.skipped);
  const [announce, setAnnounce] = useState('');
  // Where keyboard focus goes after a card is fixed (set while updating, used after the render).
  const focusNext = useRef<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const resync = useCallback(() => router.refresh(), [router]);
  const autosave = useAutosave(shopId, { onRejected: resync });
  const { queueItem } = autosave;
  const { run, start, reset } = usePublish(shopId);

  const cards = useMemo(() => flaggedCards(items), [items]);
  const live = items.filter((i) => i.status !== 'removed');
  const needYou = items.filter(needsSeller).length;
  const ready = items.filter((i) => i.status === 'draft' && i.issues.length === 0);
  const inPerson = items.filter((i) => i.status === 'in_person' && i.issues.length === 0);
  const removed = items.filter((i) => i.status === 'removed');
  const toPublish = items.filter(isPendingPublish).length;
  // A publish that broke after its items reached PayPal leaves nothing to send: publishing again only opens the shop.
  const inPayPal = items.filter((i) => i.paypalProductId).length;
  const finishOnly = toPublish === 0 && inPayPal > 0;
  const lines = openSkipped(skipped, items);

  // After a card is fixed, keep the keyboard where the work is: the next card, or the ready list.
  // The sticky publish bar must never hide the field that has keyboard focus.
  useEffect(() => {
    const html = document.documentElement;
    html.style.scrollPaddingBottom = '9rem';
    return () => {
      html.style.scrollPaddingBottom = '';
    };
  }, []);

  useEffect(() => {
    if (!focusNext.current) return;
    document.getElementById(focusNext.current)?.focus();
    focusNext.current = null;
  }, [items]);

  const onUpdate: OnUpdate = useCallback(
    (u: ItemUpdate, opts = {}) => {
      setItems((all) => {
        const next = all.map((it) => (it.id === u.itemId ? applyLocal(it, u) : it));
        if (opts.resolved) {
          const before = flaggedCards(all);
          const at = before.findIndex((c) => (c.kind === 'single' ? c.item.id === u.itemId : c.items.some((i) => i.id === u.itemId)));
          const after = flaggedCards(next);
          const following = after[Math.min(Math.max(at, 0), after.length - 1)];
          focusNext.current = following ? `${cardId(following)}-name` : 'ready-title';
          const name = all.find((i) => i.id === u.itemId)?.name ?? 'Item';
          const left = next.filter(needsSeller).length;
          setAnnounce(`${name} saved. ${left ? `${plural(left, 'item')} still need you.` : 'Nothing else needs you.'}`);
        }
        return next;
      });
      // Taps save at once; typing (names, prices) waits for a pause.
      queueItem(u, { immediate: Boolean(opts.resolved) || u.status !== undefined || Boolean(u.resolveIssues || u.resolveDuplicate) });
    },
    [queueItem],
  );

  // A photo is saved the moment it uploads (no autosave): only our copy of the item needs it.
  const onPhoto = useCallback((itemId: string, photoUrl: string | null) => {
    setItems((all) => all.map((it) => (it.id === itemId ? { ...it, photoUrl } : it)));
  }, []);

  const photoContext = useMemo(() => ({ shopId, onPhoto }), [shopId, onPhoto]);

  const makeItem = useCallback(
    async (input: { name: string; priceCents: number | null; sourceText: string }) => {
      const item = await addItem(shopId, input);
      setItems((all) => [...all, item]);
      setAnnounce(`${item.name} added to your menu.`);
    },
    [shopId],
  );

  const doPublish = async () => {
    setPublishError(null);
    try {
      await autosave.flush();
    } catch {
      setPublishError("Some changes didn’t save, so we didn’t publish. Check your connection and try again.");
      return;
    }
    window.scrollTo({ top: 0 });
    const result = await start();
    if (result.phase === 'error' && result.code === 'NOTHING_TO_PUBLISH') {
      // An earlier run (say, one whose connection dropped) already finished: let the server show where things stand.
      reset();
      router.refresh();
    } else if (result.phase === 'done' && result.failed === 0) {
      // A beat to see every line turn green, then the live screen.
      setTimeout(() => router.refresh(), 900);
    }
  };

  // ───────────── Publishing (step 3) ─────────────
  if (run.phase !== 'idle') {
    const done = run.phase === 'done';
    const failed = done ? run.failed : run.phase === 'error' ? run.rows.filter((r) => r.state !== 'ok').length : 0;
    const anyLive = done && run.shopStatus !== 'draft';
    return (
      <div className="mx-auto flex w-full max-w-page flex-col gap-8 px-gutter pt-8 pb-section lg:pt-12">
        <StepHeader
          step={3}
          title={done && failed === 0 ? 'Your menu is in PayPal' : done || run.phase === 'error' ? 'Almost there' : 'Adding your menu to PayPal'}
          lead={
            run.phase === 'running'
              ? 'Each item becomes a product in your PayPal catalog. Prices stay with Shelfie.'
              : done && failed === 0
                ? 'Opening your shop…'
                : run.phase === 'error'
                  ? run.message
                  : `${plural(failed, 'item')} didn’t reach PayPal. The rest are in.`
          }
        />
        <div className="max-w-measure">
          <PublishProgress run={run} />
        </div>
        {(failed > 0 || run.phase === 'error') && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button size="lg" icon={RotateCcw} onClick={() => void doPublish()}>
              {failed > 0 ? `Retry ${plural(failed, 'item')}` : 'Try again'}
            </Button>
            {anyLive ? (
              <Button size="lg" variant="secondary" onClick={() => router.refresh()}>
                Continue to your live shop
              </Button>
            ) : (
              <Button size="lg" variant="ghost" icon={ArrowLeft} onClick={reset}>
                Back to review
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ───────────── Review (step 2) ─────────────
  const nothingToPublish = toPublish === 0 && !finishOnly;
  const disabledReason = nothingToPublish
    ? needYou > 0
      ? 'Fix an item above, or give one a price, to publish.'
      : 'Give at least one item a price to publish.'
    : !payeeReady
      ? PAYEE_REQUIRED_MESSAGE
      : null;
  // The PayPal email sits at the end of the shop details: the reason takes the seller straight to it.
  const goToPayee = () => {
    const field = document.getElementById(PAYEE_FIELD_ID);
    field?.scrollIntoView({ block: 'center' });
    field?.querySelector('input')?.focus({ preventScroll: true });
  };

  return (
    <div className="flex w-full flex-1 flex-col">
      <div className="mx-auto w-full max-w-page px-gutter pt-8 pb-12 lg:pt-12">
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div key={synced} className="flex min-w-0 flex-col gap-10 lg:col-span-7">
          <StepHeader
            step={2}
            title="Check your menu"
            lead={
              <span className="type-figures" role="status">
                {plural(live.length, 'item')} · {needYou ? `${needYou} need${needYou === 1 ? 's' : ''} you` : 'all clear'}
              </span>
            }
          />

          <PhotoStrip shopId={shopId} count={photoCount} className="shrink-0 lg:hidden" />

          {(props.recorded || props.nonUsd) && (
            <div className="flex flex-col gap-3">
              {props.recorded && (
                <p className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                  <Badge tone="info" icon={History}>
                    Recorded reading
                  </Badge>
                  This is Claude’s saved reading of the sample photo, made earlier, so there was no wait.
                </p>
              )}
              {props.nonUsd && (
                <p className="flex items-start gap-2 rounded-md bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
                  <Icon icon={TriangleAlert} size="sm" className="mt-0.5" />
                  <span>
                    <strong>Shelfie charges in USD.</strong> Your menu doesn’t look like it’s in dollars, so check each price.
                  </span>
                </p>
              )}
            </div>
          )}

          {cards.length > 0 ? (
            <Reveal>
              <section aria-labelledby="needs-title" className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h2 id="needs-title" className="type-title">
                    Needs you
                  </h2>
                  <p className="text-ink-soft">Fix these, or leave them: they stay off your shop until you do.</p>
                </div>
                <PhotoContext value={photoContext}>
                  <ul className="flex flex-col gap-4">
                    {cards.map((c) => (
                      <li key={cardId(c)}>
                        <IssueCard card={c} id={cardId(c)} onUpdate={onUpdate} />
                      </li>
                    ))}
                  </ul>
                </PhotoContext>
              </section>
            </Reveal>
          ) : (
            <p className="flex items-center gap-2 rounded-md bg-ok-soft px-3.5 py-3 font-semibold text-ok">
              <Icon icon={CircleCheck} />
              Nothing needs you. Every item is checked.
            </p>
          )}

          <Reveal>
            <section aria-labelledby="ready-title" className="flex flex-col gap-4">
              <h2 id="ready-title" tabIndex={-1} className="type-title focus:outline-none focus-visible:outline-2">
                Ready for PayPal <span className="type-figures text-ink-muted">({ready.length})</span>
              </h2>
              {ready.length ? (
                <ReadyList items={ready} onUpdate={onUpdate} shopId={shopId} onPhoto={onPhoto} />
              ) : (
                <p className="text-ink-muted">Nothing yet. Fix an item above and it moves here.</p>
              )}
            </section>
          </Reveal>

          {inPerson.length > 0 && (
            <Reveal>
              <section aria-labelledby="inperson-title" className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h2 id="inperson-title" className="type-title">
                    Ask in person
                  </h2>
                  <p className="text-ink-soft">On your shop without a price. Assistants can’t order them.</p>
                </div>
                <InPersonList items={inPerson} onUpdate={onUpdate} shopId={shopId} onPhoto={onPhoto} />
              </section>
            </Reveal>
          )}

          <div className="flex flex-col gap-3">
            {lines.length > 0 && (
              <Disclosure title="Lines we skipped" count={lines.length}>
                <SkippedList lines={lines} onMake={makeItem} />
              </Disclosure>
            )}
            {removed.length > 0 && (
              <Disclosure title="Removed" count={removed.length}>
                <RemovedList items={removed} onUpdate={onUpdate} />
              </Disclosure>
            )}
            {props.warnings.length > 0 && (
              <Disclosure title="Notes from the reading" count={props.warnings.length}>
                <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink-soft">
                  {props.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </Disclosure>
            )}
          </div>

          <ShopDetails shop={server.shop} onChange={autosave.queueShop} onPayeeChange={setPayeeReady} />
        </div>

        <aside aria-label="Your menu photo" className="hidden lg:col-span-5 lg:block">
          <div className="sticky top-6 flex flex-col gap-3">
            <MenuPhoto shopId={shopId} page={1} className="aspect-[4/5] w-full" sizes="34vw" />
            {photoCount > 1 && <PhotoStrip shopId={shopId} count={photoCount} />}
            <p className="type-meta text-ink-muted">Your photo, to compare with what we read.</p>
          </div>
        </aside>
      </div>

      </div>

      {/* Sticky publish bar: the one primary action, with the save status beside it. */}
      <div data-publish-bar className="sticky bottom-0 z-(--z-header) mt-auto bg-surface-raised pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_var(--color-line),0_-8px_24px_-12px_rgb(var(--ink-rgb)/0.18)]">
        <div className="mx-auto flex w-full max-w-page flex-col gap-2 px-gutter py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="flex flex-col gap-0.5 sm:order-1">
            <SaveStatus state={autosave.state} onRetry={() => void autosave.flush().catch(() => {})} />
            {(disabledReason || publishError) && (
              <span id="publish-reason" className="text-sm text-ink-soft">
                {publishError ? (
                  <FieldError>{publishError}</FieldError>
                ) : disabledReason === PAYEE_REQUIRED_MESSAGE ? (
                  <button
                    type="button"
                    onClick={goToPayee}
                    className="inline-flex min-h-tap items-center text-left font-medium text-ink underline decoration-ink-faint decoration-2 underline-offset-4 hover:decoration-ink"
                  >
                    {PAYEE_REQUIRED_MESSAGE}
                  </button>
                ) : (
                  disabledReason
                )}
              </span>
            )}
            {finishOnly && !publishError && (
              <span className="text-sm text-ink-soft">
                {plural(inPayPal, 'item')} {inPayPal === 1 ? 'is' : 'are'} already in PayPal. Open your shop to finish.
              </span>
            )}
            {!disabledReason && !finishOnly && !publishError && needYou > 0 && (
              <span className="hidden text-sm text-ink-soft sm:block">
                {needYou === 1 ? '1 item that needs you stays' : `${needYou} items that need you stay`} off your shop for now.
              </span>
            )}
          </div>
          <Button
            size="lg"
            icon={Send}
            onClick={() => void doPublish()}
            disabled={nothingToPublish || !payeeReady}
            aria-describedby={disabledReason || publishError ? 'publish-reason' : undefined}
            className="sm:order-2"
          >
            {finishOnly ? 'Open your shop' : `Publish ${plural(toPublish, 'item')} to PayPal`}
          </Button>
        </div>
      </div>
    </div>
  );
}
