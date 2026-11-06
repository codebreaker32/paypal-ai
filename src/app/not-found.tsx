// Every other 404 (an unknown path, or a dashboard or order the visitor doesn't own): the site's own page, not Next's default.
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Not found · Shelfie', robots: { index: false } };

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-page flex-col *:max-w-measure items-start gap-4 px-gutter pt-12 pb-section lg:pt-16">
      <h1 className="type-display">Nothing here</h1>
      <p className="type-lead text-ink-soft">This page doesn’t exist, or it belongs to someone else’s shop. Check the link you were given.</p>
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <ButtonLink href="/" variant="primary" icon={ArrowLeft}>
          Go to Shelfie
        </ButtonLink>
      </div>
    </div>
  );
}
