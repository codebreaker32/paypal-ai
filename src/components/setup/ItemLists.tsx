'use client';

import { categoryOf } from '@/lib/domain/category';
import { useId, useState, type ReactNode } from 'react';
import { Check, ChevronDown, CircleDollarSign, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/components/ui/cx';
import { formatUSD } from '@/lib/domain/money';
import type { ItemWithVariants, SkippedLine } from '@/lib/domain/types';
import { firstAmountIn, isPriced, parsePriceInput, priceInputValue } from '@/lib/catalog/rules';
import type { OnUpdate } from './IssueCards';
import { ItemPhotoPicker, PhotoError } from './PhotoPicker';
import { PRICE_ERROR, PriceInput } from './PriceInput';
import { SKIP_REASON, bySection } from './review-model';

/** What a row needs to show and change its photo. */
export interface PhotoProps {
  shopId: string;
  onPhoto: (itemId: string, photoUrl: string | null) => void;
}

/** A dot and a word, the way the dashboard shows status. */
function StatusText({ tone, children }: { tone: 'ok' | 'warn'; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-2 text-sm font-semibold whitespace-nowrap', tone === 'ok' ? 'text-ok' : 'text-warn')}>
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  );
}

/** One ready item: its photo (tap to add one), name and price; Edit opens name, prices and Remove in place. */
function ReadyRow({ item, tone, onUpdate, shopId, onPhoto }: { item: ItemWithVariants; tone: number; onUpdate: OnUpdate } & PhotoProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [texts, setTexts] = useState(() => item.variants.map((v) => priceInputValue(v.priceCents)));
  const [touched, setTouched] = useState<boolean[]>(() => item.variants.map(() => false));
  const [photoError, setPhotoError] = useState<string | null>(null);
  const inPayPal = Boolean(item.paypalProductId);
  const formId = useId();

  const setPrice = (i: number, t: string) => {
    const next = texts.map((x, j) => (j === i ? t : x));
    setTexts(next);
    const cents = next.map(parsePriceInput);
    // Autosave each valid price; an unfinished one ("4.") waits until it parses.
    if (cents.every((c) => c !== null)) {
      onUpdate({ itemId: item.id, variants: item.variants.map((v, j) => ({ label: v.label, priceCents: cents[j] })) });
    }
  };
  const setItemName = (t: string) => {
    setName(t);
    if (t.trim()) onUpdate({ itemId: item.id, name: t.trim() });
  };

  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0" data-item={item.name}>
      <div className="flex items-center gap-3 sm:gap-4">
        <ItemPhotoPicker
          shopId={shopId}
          itemId={item.id}
          name={item.name}
          photoUrl={item.photoUrl}
          category={categoryOf(item)}
          tone={tone}
          onChange={(url) => onPhoto(item.id, url)}
          onError={setPhotoError}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold leading-6 [overflow-wrap:anywhere]">{item.name}</span>
          {isPriced(item) ? (
            <span className="type-price text-ink-soft">
              {item.variants.map((v, i) => (
                <span key={v.id} className="whitespace-nowrap">
                  {i > 0 && <span aria-hidden="true"> · </span>}
                  {v.label && <span className="mr-1 text-ink-muted">{v.label}</span>}
                  {formatUSD(v.priceCents!)}
                </span>
              ))}
            </span>
          ) : (
            <StatusText tone="warn">Needs a price</StatusText>
          )}
        </div>
        {inPayPal ? (
          <StatusText tone="ok">In PayPal</StatusText>
        ) : (
          <Button
            variant="ghost"
            icon={editing ? ChevronDown : Pencil}
            aria-expanded={editing}
            aria-controls={formId}
            onClick={() => setEditing((e) => !e)}
            className="-mr-3 px-3"
          >
            {editing ? 'Done' : 'Edit'}
            <span className="sr-only"> {item.name}</span>
          </Button>
        )}
      </div>
      <PhotoError error={photoError} />
      {editing && (
        <div id={formId} className="mt-1 flex flex-col gap-4 rounded-lg bg-surface-sunken p-4">
          <Field label="Name" error={name.trim() === '' ? 'Give it a name' : undefined}>
            {(c) => <TextInput {...c} value={name} maxLength={127} onChange={(e) => setItemName(e.currentTarget.value)} />}
          </Field>
          <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
            {item.variants.map((v, i) => (
              <PriceInput
                key={i}
                label={v.label ? `${v.label} price` : 'Price'}
                value={texts[i]}
                onValueChange={(t) => setPrice(i, t)}
                onBlur={() => setTouched((all) => all.map((x, j) => (j === i ? true : x)))}
                error={touched[i] && parsePriceInput(texts[i]) === null ? PRICE_ERROR : null}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" icon={Check} onClick={() => setEditing(false)}>
              Done
            </Button>
            <Button variant="ghost" icon={Trash2} onClick={() => onUpdate({ itemId: item.id, status: 'removed' }, { resolved: true })}>
              Remove from menu
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

export function ReadyList({ items, onUpdate, shopId, onPhoto }: { items: ItemWithVariants[]; onUpdate: OnUpdate } & PhotoProps) {
  return (
    <div className="flex flex-col gap-8">
      {bySection(items).map((g, n) => (
        <section key={g.section ?? '—'} aria-label={g.section ?? 'Items'} className="flex flex-col gap-3">
          {g.section && <h3 className="type-heading">{g.section}</h3>}
          <ul className="flex flex-col divide-y divide-line">
            {g.items.map((it) => (
              <ReadyRow key={it.id} item={it} tone={n} onUpdate={onUpdate} shopId={shopId} onPhoto={onPhoto} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** "Ask in person" items: on the shop, not orderable. A price moves them onto the PayPal menu. */
function InPersonRow({ item, onUpdate, shopId, onPhoto }: { item: ItemWithVariants; onUpdate: OnUpdate } & PhotoProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const cents = parsePriceInput(text);
  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0" data-item={item.name}>
      <div className="flex items-center gap-3 sm:gap-4">
        <ItemPhotoPicker
          shopId={shopId}
          itemId={item.id}
          name={item.name}
          photoUrl={item.photoUrl}
          category={categoryOf(item)}
          onChange={(url) => onPhoto(item.id, url)}
          onError={setPhotoError}
        />
        <span className="flex-1 font-semibold [overflow-wrap:anywhere]">{item.name}</span>
        {!open && (
          <Button variant="ghost" icon={CircleDollarSign} onClick={() => setOpen(true)}>
            Set a price<span className="sr-only"> for {item.name}</span>
          </Button>
        )}
      </div>
      <PhotoError error={photoError} />
      {open && (
        <form
          className="mt-1 flex flex-wrap items-end gap-3 rounded-lg bg-surface-sunken p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (cents === null) return setTouched(true);
            onUpdate(
              { itemId: item.id, status: 'draft', variants: item.variants.map((v) => ({ label: v.label, priceCents: cents })), resolveIssues: true },
              { resolved: true },
            );
          }}
        >
          <PriceInput
            label="Today’s price"
            value={text}
            onValueChange={setText}
            onBlur={() => setTouched(true)}
            error={touched && cents === null ? PRICE_ERROR : null}
            className="w-40"
          />
          <Button type="submit" variant="secondary" icon={Check}>
            Save
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </form>
      )}
    </li>
  );
}

export function InPersonList({ items, onUpdate, shopId, onPhoto }: { items: ItemWithVariants[]; onUpdate: OnUpdate } & PhotoProps) {
  return (
    <ul className="flex flex-col divide-y divide-line">
      {items.map((it) => (
        <InPersonRow key={it.id} item={it} onUpdate={onUpdate} shopId={shopId} onPhoto={onPhoto} />
      ))}
    </ul>
  );
}

/** A collapsed list with a count in its summary; native <details>, so it works by keyboard. */
export function Disclosure({ title, count, hint, children, defaultOpen }: { title: string; count: number; hint?: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-lg bg-surface-sunken">
      <summary className="flex min-h-tap list-none items-center gap-3 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
        <span className="flex flex-1 flex-col">
          <span className="font-semibold">
            {title} <span className="type-figures text-ink-muted">({count})</span>
          </span>
          {hint && <span className="type-meta text-ink-muted">{hint}</span>}
        </span>
        <Icon icon={ChevronDown} className="text-ink-soft transition-transform duration-(--duration-fast) group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-3">{children}</div>
    </details>
  );
}

export function RemovedList({ items, onUpdate }: { items: ItemWithVariants[]; onUpdate: OnUpdate }) {
  return (
    <ul className="flex flex-col divide-y divide-line">
      {items.map((it) => (
        <li key={it.id} className="flex min-h-tap items-center gap-3 py-2">
          <span className="flex-1 text-ink-soft line-through decoration-ink-muted [overflow-wrap:anywhere]">{it.name}</span>
          <Button
            variant="ghost"
            icon={RotateCcw}
            onClick={() => onUpdate({ itemId: it.id, status: it.issues.includes('MARKET_PRICE') ? 'in_person' : 'draft' })}
          >
            Put back<span className="sr-only"> {it.name}</span>
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** A skipped line, with "Make it an item" opening a name and price form in place. */
function SkippedRow({
  line,
  showPage,
  onMake,
}: {
  line: SkippedLine;
  showPage: boolean;
  onMake: (input: { name: string; priceCents: number | null; sourceText: string }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(line.text.replace(/^[+\-•·*]\s*/, '').replace(/\$\s?\d+(?:\.\d{1,2})?/, '').trim() || line.text);
  const [text, setText] = useState(() => priceInputValue(firstAmountIn(line.text)));
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cents = text.trim() === '' ? null : parsePriceInput(text);
  const priceBad = text.trim() !== '' && cents === null;

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="[overflow-wrap:anywhere]">“{line.text}”</span>
          <span className="type-meta text-ink-muted">
            {SKIP_REASON[line.reason]}
            {showPage && ` · page ${line.page}`}
          </span>
        </div>
        {!open && (
          <Button variant="ghost" icon={Plus} onClick={() => setOpen(true)}>
            Make it an item
          </Button>
        )}
      </div>
      {open && (
        <form
          className="mt-3 flex flex-col gap-4 rounded-md bg-surface-sunken p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setTouched(true);
            if (!name.trim() || priceBad) return;
            setBusy(true);
            setError(null);
            try {
              await onMake({ name: name.trim(), priceCents: cents, sourceText: line.text });
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
              setBusy(false);
            }
          }}
        >
          <Field label="Name" error={touched && !name.trim() ? 'Give it a name' : undefined}>
            {(c) => <TextInput {...c} value={name} maxLength={127} onChange={(e) => setName(e.currentTarget.value)} />}
          </Field>
          <PriceInput
            label="Price"
            hint="Leave it empty to set it later."
            value={text}
            onValueChange={setText}
            onBlur={() => setTouched(true)}
            error={touched && priceBad ? PRICE_ERROR : null}
            className="w-48"
          />
          {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="secondary" icon={Plus} loading={busy} loadingLabel="Adding…">
              Add to menu
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}

export function SkippedList({
  lines,
  onMake,
}: {
  lines: SkippedLine[];
  onMake: (input: { name: string; priceCents: number | null; sourceText: string }) => Promise<void>;
}) {
  const pages = new Set(lines.map((l) => l.page)).size > 1;
  return (
    <ul className="flex flex-col divide-y divide-line">
      {lines.map((l, i) => (
        <SkippedRow key={`${l.page}-${i}-${l.text}`} line={l} showPage={pages} onMake={onMake} />
      ))}
    </ul>
  );
}

