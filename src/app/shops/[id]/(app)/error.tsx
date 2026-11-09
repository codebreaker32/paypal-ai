'use client';

import { Button } from '@/components/ui/button';

/** Inside the shell: the sidebar and tabs stay put, so the seller can go somewhere else or try again. */
export default function ShopAppError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div role="alert" className="flex max-w-measure flex-col items-start gap-3 py-6">
      <h1 tabIndex={-1} className="type-page outline-none">
        Something went wrong
      </h1>
      <p className="text-ink-soft">This page didn’t load. Your shop and orders are safe.</p>
      <Button onClick={() => retry()}>Try again</Button>
    </div>
  );
}
