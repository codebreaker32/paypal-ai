import { ArrowLeft } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';

export default function ShopNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-measure flex-col gap-4 px-gutter pt-12 pb-section">
      <h1 className="type-display">No shop here</h1>
      <p className="type-lead text-ink-soft">
        This shop doesn’t exist, or it hasn’t opened yet. Check the link you were given.
      </p>
      <div>
        <ButtonLink href="/" variant="primary" icon={ArrowLeft}>
          Go to Shelfie
        </ButtonLink>
      </div>
    </div>
  );
}
