import { SearchX } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

export default function OrderNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-measure flex-col items-start gap-4 px-gutter pt-8 pb-section lg:pt-12">
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-surface-sunken text-ink-soft">
        <Icon icon={SearchX} size="lg" />
      </span>
      <h1 className="type-display">We couldn&apos;t find that order</h1>
      <p className="type-lead text-ink-soft">
        Check the link, or go back to the shop you ordered from.
      </p>
      <ButtonLink href="/" variant="primary">
        Go to Shelfie
      </ButtonLink>
    </div>
  );
}
