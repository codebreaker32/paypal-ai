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

## Other pages step
- Built: `src/app/not-found.tsx` (logged-in and logged-out actions), `src/app/error.tsx` (`Try again` calls `retry`), `src/app/global-error.tsx` (own `<html>`/`<body>`, inline styles, system font, `Reload`), the `/claim/<bad>` 404 HTML, `/help`, `/terms`, `/privacy`. Terms and Privacy carry a code comment flagging them as templates for human review; governing law is omitted.
- Shared: `src/components/brand/DocPage.tsx` (the three reading pages), `src/lib/brand/contact.ts` (SUPPORT_EMAIL, else GitHub Issues built from `REPO_URL`, which came from the README's clone command).
- Tests added: `tests/brand/contact.test.ts`, `tests/auth/claim-not-found.test.ts`, `e2e/other-pages.spec.ts` (axe and no sideways scroll at 390 and 1440 for Help, Terms, Privacy, 404).
- Forced failures, checked once on a production build with temporary code that is not committed: a page that throws rendered `error.tsx` inside the header and footer, and `Try again` recovered it (acceptance 5); a root layout that throws answered 500 with `global-error.tsx`, and `Reload` reloaded. No committed e2e covers these two, because a test-only route that throws would ship.

### Choices the brief left open
- `#get-paid` has no copy in the brief. Written from the payee rules in CLAUDE.md (paid to the shop's PayPal email, a change affects new orders only, an email with no PayPal account stays pending).
- `/terms` and `/privacy` headings: the H1 is the page name with `Early-access draft, last updated 8 November 2026` on its own line inside the same heading, so each page has one H1 and the draft line is still a heading.
- `global-error.tsx`'s heading repeats `That page didn’t load`; the brief gives only the `Reload` label. `Reload` is a full page reload, not `retry`, because the root layout itself failed.
- `global-error.tsx`'s button has the `press` class so `tests/ui/press-coverage.test.ts` passes unedited. It has no effect when the stylesheet is gone.
- `/claim/<bad>` also sends `referrer-policy: no-referrer` and `noindex`, since a mistyped owner link is close to a real token. Its page is a constant, so it never repeats the token.
- Copy uses typographic apostrophes, matching the rest of the app; the brief's straight ones are markdown.
- `#delete` and the Privacy deletion line stay `contact us` because `/account` has no deletion yet (S1).
- The impeccable skill's interview has no PRODUCT.md and no user in this subagent: the brief and `docs/DESIGN.md` were used instead.

## Review round 1
- **Setup's exits.** `Cancel`, `Start over` and `Try a sample menu instead` pointed at `/`, which now redirects a seller back to the same draft. They go to `/shops/new` (`src/lib/brand/add-shop.ts`, TDD in `tests/brand/add-shop.test.ts`; `e2e/account-publish.spec.ts` clicks all three).
- **Deviation:** the brief shows samples on `/shops/new` "with zero shops only". `Try a sample menu instead` goes to `/shops/new?samples=1`, which shows them on any account. Reason: that link has to show a sample, and an account in setup always has one shop already (its draft). A plain `/shops/new` is unchanged.
- The abandoned draft stays and is listed on `/shops` as `Not published yet`; nothing removes it. `Cancel` does not stop a reading already running, as before. A guest draft (harness only) is sent on to `/login` by these links.
- **Footer:** list ids are built from the group's index, so `For AI assistants` has a working name (`e2e/other-pages.spec.ts`).
- **Privacy:** `What we keep` now lists assistant conversations, kept with the shop until it is deleted.
- **Acceptance 6:** `e2e/account-publish.spec.ts` signs up through the form, publishes the sample (real sandbox catalog; the reading is written directly, so no Claude), then opens the dashboard through `/`, `/shops` and the shop page.
- **Acceptance 7:** `e2e/other-pages.spec.ts` writes full-page screenshots to `test-results/wp7-*-{390,1440}.png` for Help, Terms, Privacy and 404. They are run artefacts and not committed.

## Tests edited
- `e2e/other-pages.spec.ts`: added a screenshot in the loop, a footer list-name test and one required Privacy phrase. No assertion removed. (The first two steps edited no test file.)
- `e2e/account-publish.spec.ts` and `tests/brand/add-shop.test.ts` are new.

## Open for the coordinator
- **Gate not flipped, e2e not moved (as instructed).** `/` no longer has the photo input or sample chips, so the specs that use them from `/` (`e2e/{start,flow,recordings,screenshots}.spec.ts`) and `scripts/clips/record.ts` need the planned move to `/shops/new`. Those specs were not run here.
- **FAQ sentence for S1:** `You can delete your shop or account whenever you like.` is not appended, because `/account` has no deletion yet.
- **Several owner cookies:** `dashboardHref` in `src/lib/brand/header.ts` returns `/` for a browser holding 2+ unattached owner cookies, and null on `/`, on the grounds that the start page lists them. With `WelcomeBack` gone it no longer does, so that link leads nowhere (seed and harness browsers only). `tests/brand/header.test.ts` asserts the current behaviour, so it was left alone.
- `StartActions` props `samples="chips"` and `liveLink` now have no caller; left for the step that moves the e2e specs.
