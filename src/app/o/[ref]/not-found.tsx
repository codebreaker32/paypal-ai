import { ArrowLeft, SearchX } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

// Same frame as the receipt (page.tsx + Receipt.tsx): status tile, display heading, lead, then the way back.
export default function OrderNotFound() {
  return (
    <div className="mx-auto w-full max-w-measure px-gutter pt-8 pb-section lg:pt-12">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col items-start gap-4">
          <span className="inline-flex size-12 items-center justify-center rounded-md bg-surface-sunken text-ink-soft">
            <Icon icon={SearchX} size="lg" />
          </span>
          <h1 className="type-display">We couldn’t find that order</h1>
          <p className="type-lead text-ink-soft">Check the link, or go back to the shop you ordered from.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/" variant="primary" icon={ArrowLeft}>
            Go to Shelfie
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
