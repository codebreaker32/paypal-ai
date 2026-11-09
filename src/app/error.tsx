'use client';

import { Button } from '@/components/ui/button';

/** Any public page that fails while the header and footer still render. `retry` re-fetches the page from the server. */
export default function RootError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div role="alert" className="mx-auto flex w-full max-w-page flex-col items-start gap-4 px-gutter pt-12 pb-section lg:pt-16">
      <h1 className="type-display">That page didn’t load</h1>
      <Button onClick={() => retry()}>Try again</Button>
    </div>
  );
}
