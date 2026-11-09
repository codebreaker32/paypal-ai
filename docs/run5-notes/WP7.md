# WP7 notes (landing and footer step)

## Done
- `src/app/page.tsx` rewritten: four `main > section` parts (`src/components/landing/{Hero,HowItWorks,Faq,Closing}.tsx`). `WelcomeBack` and its fetch are gone. A logged-in visitor redirects to `landingPath`.
- `src/components/brand/SiteFooter.tsx` draws three kinds from `src/lib/brand/footer.ts` (`footerKind`, TDD in `tests/brand/footer.test.ts`). The Sound toggle stays in all three, at 44 px.
- `e2e/landing.spec.ts` added. `LANDING_SHOTS=<dir>` also writes screenshots.

## Choices the brief left open
- Pages the brief does not list (`/login`, `/signup`, `/recover`, setup, 404) get the one-row footer.
- The FAQ has no visible heading because the brief gives none. The section has `aria-label="Common questions"`.
- Footer page links use `prefetch={false}`: buyers on phones should not fetch the legal pages.
- `agents.txt` and `llms.txt` are the visible link text for those two routes.

## Tests edited
None. No existing test file was changed.

## Open for the coordinator
- **Not built in this step:** `/help`, `/terms`, `/privacy`. The footer links to them, so they 404 until those pages land.
- **Gate not flipped, e2e not moved (as instructed).** `/` no longer has the photo input or sample chips, so the specs that use them from `/` (`e2e/{start,flow,recordings,screenshots}.spec.ts`) and `scripts/clips/record.ts` need the planned move to `/shops/new`. Those specs were not run here.
- **FAQ sentence for S1:** `You can delete your shop or account whenever you like.` is not appended, because `/account` has no deletion yet.
- **Several owner cookies:** `dashboardHref` in `src/lib/brand/header.ts` returns `/` for a browser holding 2+ unattached owner cookies, and null on `/`, on the grounds that the start page lists them. With `WelcomeBack` gone it no longer does, so that link leads nowhere (seed and harness browsers only). `tests/brand/header.test.ts` asserts the current behaviour, so it was left alone.
- `StartActions` props `samples="chips"` and `liveLink` now have no caller; left for the step that moves the e2e specs.
