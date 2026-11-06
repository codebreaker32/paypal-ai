'use client';

import { useState, type ReactNode } from 'react';
import { Check, CircleDollarSign, Copy, Hand, Merge, MessageSquareText, Pencil, Trash2, TriangleAlert, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, TextInput } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import type { IssueCode, ItemWithVariants } from '@/lib/domain/types';
import { cardKindFor, parsePriceInput, priceInputValue } from '@/lib/catalog/rules';
import type { ItemUpdate } from './api';
import { PRICE_ERROR, PriceInput } from './PriceInput';
import { ISSUE_LABEL, priceSummary, type Card as CardModel } from './review-model';

export type OnUpdate = (u: ItemUpdate, opts?: { resolved?: boolean }) => void;

const ISSUE_ICON: Record<IssueCode, LucideIcon> = {
  MISSING_PRICE: CircleDollarSign,
  MARKET_PRICE: Hand,
  CHECK: TriangleAlert,
  DUPLICATE: Copy,
};

/** Price fields for each option of an item, validated on blur, turned into cents on save. */
function usePriceFields(item: ItemWithVariants) {
  const [texts, setTexts] = useState(() => item.variants.map((v) => priceInputValue(v.priceCents)));
  const [touched, setTouched] = useState<boolean[]>(() => item.variants.map(() => false));
  const cents = texts.map(parsePriceInput);
  const valid = cents.every((c) => c !== null);
  const fields = (
    <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
      {item.variants.map((v, i) => (
        <PriceInput
          key={i}
          label={v.label ? `${v.label} price` : 'Price'}
          value={texts[i]}
          onValueChange={(t) => setTexts((all) => all.map((x, j) => (j === i ? t : x)))}
          onBlur={() => setTouched((all) => all.map((x, j) => (j === i ? true : x)))}
          error={touched[i] && cents[i] === null ? PRICE_ERROR : null}
        />
      ))}
    </div>
  );
  const variants = item.variants.map((v, i) => ({ label: v.label, priceCents: cents[i] }));
  const showErrors = () => setTouched(item.variants.map(() => true));
  return { fields, valid, variants, showErrors };
}

function CardShell({
  id,
  name,
  section,
  issue,
  children,
}: {
  id: string;
  name: string;
  section: string | null;
  issue: IssueCode;
  children: ReactNode;
}) {
  return (
    <Card as="article" aria-labelledby={`${id}-name`} className="flex flex-col gap-4 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-col">
          <h3 id={`${id}-name`} tabIndex={-1} className="type-heading [overflow-wrap:anywhere] focus:outline-none focus-visible:outline-2">
            {name}
          </h3>
          {section && <p className="type-meta text-ink-muted">{section}</p>}
        </div>
        <Badge tone="warn" icon={ISSUE_ICON[issue]}>
          {ISSUE_LABEL[issue]}
        </Badge>
      </div>
      {children}
    </Card>
  );
}

/** "We read: …" and the reader's own note: what the seller compares against the photo. */
function AsRead({ item, showPrice }: { item: ItemWithVariants; showPrice?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-md bg-surface-sunken px-3.5 py-2.5">
        <p className="type-meta text-ink-muted">We read</p>
        <p className="font-display text-lg leading-7 italic [overflow-wrap:anywhere]">“{item.sourceText}”</p>
        {showPrice && (
          <p className="mt-1.5 flex items-baseline gap-2 rule-dashed pt-1.5">
            <span className="type-meta text-ink-muted">Price</span>
            <span className="type-price font-semibold">{priceSummary(item)}</span>
          </p>
        )}
      </div>
      {item.issueDetail && (
        <p className="flex items-start gap-2 text-sm text-ink-soft">
          <Icon icon={MessageSquareText} size="sm" className="mt-0.5 text-ink-muted" />
          <span>{item.issueDetail}</span>
        </p>
      )}
    </div>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

function RemoveButton({ item, onUpdate }: { item: ItemWithVariants; onUpdate: OnUpdate }) {
  return (
    <Button variant="ghost" icon={Trash2} onClick={() => onUpdate({ itemId: item.id, status: 'removed' }, { resolved: true })}>
      Remove
    </Button>
  );
}

/** MISSING_PRICE: type the price on the keypad. */
function PriceCard({ id, item, onUpdate }: { id: string; item: ItemWithVariants; onUpdate: OnUpdate }) {
  const price = usePriceFields(item);
  const save = () => {
    if (!price.valid) return price.showErrors();
    onUpdate({ itemId: item.id, status: 'draft', variants: price.variants, resolveIssues: true }, { resolved: true });
  };
  return (
    <CardShell id={id} name={item.name} section={item.section} issue="MISSING_PRICE">
      <AsRead item={item} />
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {price.fields}
        <Actions>
          <Button type="submit" variant="secondary" icon={Check}>
            Save price
          </Button>
          <RemoveButton item={item} onUpdate={onUpdate} />
        </Actions>
      </form>
    </CardShell>
  );
}

/** MARKET_PRICE: set today's price, or keep it as "ask in person". */
function MarketCard({ id, item, onUpdate }: { id: string; item: ItemWithVariants; onUpdate: OnUpdate }) {
  const [setting, setSetting] = useState(false);
  const price = usePriceFields(item);
  return (
    <CardShell id={id} name={item.name} section={item.section} issue="MARKET_PRICE">
      <AsRead item={item} />
      <p className="text-sm text-ink-soft">The price changes, so it’s listed on your shop and people ask you in person. Or set today’s price so assistants can order it.</p>
      {setting ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!price.valid) return price.showErrors();
            onUpdate({ itemId: item.id, status: 'draft', variants: price.variants, resolveIssues: true }, { resolved: true });
          }}
        >
          {price.fields}
          <Actions>
            <Button type="submit" variant="secondary" icon={Check}>
              Save today’s price
            </Button>
            <Button variant="ghost" onClick={() => setSetting(false)}>
              Cancel
            </Button>
          </Actions>
        </form>
      ) : (
        <Actions>
          <Button variant="secondary" icon={CircleDollarSign} onClick={() => setSetting(true)}>
            Set today’s price
          </Button>
          <Button
            variant="secondary"
            icon={Hand}
            onClick={() => onUpdate({ itemId: item.id, status: 'in_person', resolveIssues: true }, { resolved: true })}
          >
            Ask in person
          </Button>
        </Actions>
      )}
    </CardShell>
  );
}

/** CHECK: the reading was shaky (crossed out, blurred, a deal, an odd price). Confirm or fix. */
function CheckCard({ id, item, onUpdate }: { id: string; item: ItemWithVariants; onUpdate: OnUpdate }) {
  const [fixing, setFixing] = useState(false);
  const [name, setName] = useState(item.name);
  const price = usePriceFields(item);
  const nameError = name.trim() === '' ? 'Give it a name' : null;
  return (
    <CardShell id={id} name={item.name} section={item.section} issue="CHECK">
      <AsRead item={item} showPrice />
      {fixing ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (nameError) return;
            if (!price.valid) return price.showErrors();
            onUpdate({ itemId: item.id, name: name.trim(), variants: price.variants, resolveIssues: true }, { resolved: true });
          }}
        >
          <Field label="Name" error={nameError}>
            {(c) => <TextInput {...c} value={name} maxLength={127} onChange={(e) => setName(e.currentTarget.value)} />}
          </Field>
          {price.fields}
          <Actions>
            <Button type="submit" variant="secondary" icon={Check}>
              Save
            </Button>
            <Button variant="ghost" onClick={() => setFixing(false)}>
              Cancel
            </Button>
          </Actions>
        </form>
      ) : (
        <Actions>
          <Button variant="secondary" icon={Check} onClick={() => onUpdate({ itemId: item.id, resolveIssues: true }, { resolved: true })}>
            Looks right
          </Button>
          <Button variant="secondary" icon={Pencil} onClick={() => setFixing(true)}>
            Fix
          </Button>
          <RemoveButton item={item} onUpdate={onUpdate} />
        </Actions>
      )}
    </CardShell>
  );
}

/** DUPLICATE: the same name with different prices. Merge into one (pick the price) or keep both. */
function DuplicateCard({ id, items, onUpdate }: { id: string; items: ItemWithVariants[]; onUpdate: OnUpdate }) {
  const [merging, setMerging] = useState(false);
  const keep = (kept: ItemWithVariants) => {
    for (const other of items) if (other.id !== kept.id) onUpdate({ itemId: other.id, status: 'removed', resolveIssues: true });
    onUpdate({ itemId: kept.id, resolveIssues: true }, { resolved: true });
  };
  return (
    <CardShell id={id} name={items[0].name} section={items[0].section} issue="DUPLICATE">
      <p className="text-sm text-ink-soft">Your menu lists this {items.length === 2 ? 'twice' : `${items.length} times`} with different prices.</p>
      <ul className="flex flex-col gap-2">
        {items.map((it) => (
          <li key={it.id} className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-md bg-surface-sunken px-3.5 py-2.5">
            <span className="[overflow-wrap:anywhere]">
              <span className="sr-only">We read </span>“{it.sourceText}”
            </span>
            <span className="type-price font-semibold">{priceSummary(it)}</span>
          </li>
        ))}
      </ul>
      {merging ? (
        <div role="group" aria-label="Which price is right?" className="flex flex-col gap-3">
          <p className="type-label">Which price is right?</p>
          <Actions>
            {items.map((it) => (
              <Button key={it.id} variant="secondary" icon={Check} onClick={() => keep(it)}>
                Keep {priceSummary(it)}
              </Button>
            ))}
            <Button variant="ghost" onClick={() => setMerging(false)}>
              Cancel
            </Button>
          </Actions>
        </div>
      ) : (
        <Actions>
          <Button variant="secondary" icon={Merge} onClick={() => setMerging(true)}>
            Merge
          </Button>
          <Button
            variant="secondary"
            icon={Copy}
            onClick={() => items.forEach((it, i) => onUpdate({ itemId: it.id, resolveIssues: true }, { resolved: i === items.length - 1 }))}
          >
            Keep both
          </Button>
        </Actions>
      )}
    </CardShell>
  );
}

/** One flagged card, with the fix that matches its problem. */
export function IssueCard({ card, id, onUpdate }: { card: CardModel; id: string; onUpdate: OnUpdate }) {
  if (card.kind === 'duplicate') return <DuplicateCard id={id} items={card.items} onUpdate={onUpdate} />;
  const { item } = card;
  switch (cardKindFor(item)) {
    case 'price':
      return <PriceCard id={id} item={item} onUpdate={onUpdate} />;
    case 'market':
      return <MarketCard id={id} item={item} onUpdate={onUpdate} />;
    default:
      return <CheckCard id={id} item={item} onUpdate={onUpdate} />;
  }
}

