// Every other 404 (an unknown path, or a dashboard or order the visitor doesn't own): the site's own page, not Next's default.
import type { Metadata } from 'next';
import { unstable_rethrow } from 'next/navigation';
import { ButtonLink } from '@/components/ui/button';
import { currentAccount } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Not found · Shelfie', robots: { index: false } };

/** A 404 must render even if storage is down: then the visitor is simply treated as logged out. */
async function isLoggedIn(): Promise<boolean> {
  try {
    return (await currentAccount()) !== null;
  } catch (err) {
    unstable_rethrow(err); // let Next's own signals (dynamic rendering) through
    console.error('Not-found page: could not read the session', err instanceof Error ? err.message : err);
    return false;
  }
}

export default async function NotFound() {
  const loggedIn = await isLoggedIn();
  return (
    <div className="mx-auto flex w-full max-w-page flex-col *:max-w-measure items-start gap-4 px-gutter pt-12 pb-section lg:pt-16">
      <h1 className="type-display">We can’t find that page</h1>
      <p className="type-lead text-ink-soft">It may have moved, or it may belong to a shop you’re not logged in to.</p>
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        {loggedIn ? (
          <ButtonLink href="/shops" variant="primary">
            Your shops
          </ButtonLink>
        ) : (
          <>
            <ButtonLink href="/" variant="primary">
              Go to Shelfie
            </ButtonLink>
            <ButtonLink href="/login" variant="secondary">
              Log in
            </ButtonLink>
          </>
        )}
      </div>
    </div>
  );
}
