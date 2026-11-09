import { ButtonLink } from '@/components/ui/button';

export function Closing() {
  return (
    <section aria-labelledby="landing-close" className="mx-auto w-full max-w-page px-gutter pt-section pb-section">
      <div className="flex flex-col gap-5 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="landing-close" className="type-display">
          Put your counter online today.
        </h2>
        <ButtonLink href="/signup" variant="primary" size="lg" className="w-full shrink-0 sm:w-auto">
          Add your shop
        </ButtonLink>
      </div>
    </section>
  );
}
