import { StorePreview } from '@/app/_start/StorePreview';
import { ButtonLink } from '@/components/ui/button';
import { TextLink } from '@/components/ui/text-link';
import { TEST_MODE_LINE } from '@/lib/brand/test-mode';

export function Hero() {
  return (
    <section
      aria-labelledby="landing-title"
      className="mx-auto grid w-full max-w-page items-start gap-12 px-gutter pt-8 lg:grid-cols-12 lg:items-center lg:gap-10 lg:pt-14"
    >
      <div className="lg:col-span-6">
        <h1 id="landing-title" className="type-hero max-w-[12ch]">
          Your price list, open to AI shoppers.
        </h1>
        <p className="mt-5 max-w-[30rem] type-lead text-ink-soft">
          Snap the paper menu on your counter. Shelfie turns it into a PayPal shop any AI assistant can order from.
        </p>
        <div className="mt-8 flex flex-col items-center gap-x-6 gap-y-1 sm:flex-row">
          <ButtonLink href="/signup" variant="primary" size="lg" className="w-full sm:w-auto">
            Add your shop
          </ButtonLink>
          <TextLink href="/login">Log in</TextLink>
        </div>
        <p className="mt-4 type-meta text-ink-muted">{TEST_MODE_LINE}</p>
      </div>

      <div className="lg:col-span-6">
        <StorePreview />
      </div>
    </section>
  );
}
