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
- **Acceptance 9:** Lighthouse on `/s/marigold-bakehouse` (mobile preset, simulated throttling, production build of this branch, freshly seeded scratch DB, five runs at load about 2): 88, 90, 87, 90, 91, median **90** (LCP 2.9 s, TBT 250 ms, CLS 0). That meets the bar with no margin; the recorded baseline was median 91 over 89 to 92, so the difference is within the run-to-run spread and shows neither a regression nor its absence. Worth re-measuring on the final branch after the gate flip. `npx lighthouse@13` ran from a temporary directory, so no dependency was added. `docs/judge/evidence/lighthouse-shop-mobile.json` is not replaced.

## Tests edited
- `e2e/other-pages.spec.ts`: added a screenshot in the loop, a footer list-name test and one required Privacy phrase. No assertion removed. (The first two steps edited no test file.)
- `e2e/account-publish.spec.ts` and `tests/brand/add-shop.test.ts` are new.

## Open for the coordinator
- **Gate not flipped, e2e not moved (as instructed).** `/` no longer has the photo input or sample chips, so the specs that use them from `/` (`e2e/{start,flow,recordings,screenshots}.spec.ts`) and `scripts/clips/record.ts` need the planned move to `/shops/new`. Those specs were not run here.
- **FAQ sentence for S1:** `You can delete your shop or account whenever you like.` is not appended, because `/account` has no deletion yet.
- **Several owner cookies:** `dashboardHref` in `src/lib/brand/header.ts` returns `/` for a browser holding 2+ unattached owner cookies, and null on `/`, on the grounds that the start page lists them. With `WelcomeBack` gone it no longer does, so that link leads nowhere (seed and harness browsers only). `tests/brand/header.test.ts` asserts the current behaviour, so it was left alone.
- `StartActions` props `samples="chips"` and `liveLink` now have no caller; left for the step that moves the e2e specs.

## Flip the gate step
- `guestShopsAllowed()` reads `SHELFIE_ALLOW_GUEST_SHOPS=1`, still false on Render (SR20; two more unit tests: no flag, value other than `1`). Set in `tests/setup.ts`, `playwright.config.ts`, `scripts/screenshots-prod.sh`, `scripts/clips/app.ts`. `.env.example` gained `SHELFIE_ALLOW_GUEST_SHOPS` and `SUPPORT_EMAIL`. `scripts/measure-photo-to-live.ts` starts drafts with no account, so its usage line now sets the flag.
- `StartActions`: `samples="chips"` and `liveLink` had no caller left, so they are gone (and `samples` is now required).
- **Deviation (smallest):** the brief says `scripts/clips/record.ts:216` opens `/shops/new`. That page needs an account, so the scene first makes a throwaway one with `page.request.post('/api/auth/signup')` (random password, never stored or printed). Not recorded here (no clips run); the Live screen of that clip now belongs to an account, so check the recovery-key banner does not cover anything when clips are re-recorded.

### Test files edited (routes and selectors only, no assertion removed)
- `e2e/helpers.ts`: new `signUpForShops`, because `/shops/new` requires an account.
- `e2e/start.spec.ts`: the four tests that use the photo input, sample buttons or `Snap your price list` move to `/shops/new` after signing up. The axe, 44 px and hero-story tests stay on `/`.
- `e2e/flow.spec.ts`: signs up, opens `/shops/new`, then picks the Marigold sample.
- `e2e/screenshots.spec.ts`: `start`, `start-photos-ready`, `start-bad-file` move to `/shops/new`; the `alert` is scoped to `#main` (the `start-title` section no longer exists); `start-returning-owner` expects the `Dashboard` header link.
- `tests/auth/guest.test.ts`: two tests added.
- `e2e/recordings.spec.ts`: not edited. Its only `/` visit records the hero, which is still on `/`; it does not use the photo input or sample buttons. `e2e/sounds.spec.ts` likewise uses only the footer and header on `/`. Neither was run.

### Acceptance coverage (`e2e/landing.spec.ts`, 25 tests)
- 1, 3 already there. 2: adds no demo login on `/`, `/login`, `/signup`. 4: adds the buyer header check on `/s/<slug>` and `/o/<ref>`; `/terms`, `/privacy`, `/help` are in `e2e/other-pages.spec.ts`. 5: new, with no test-only route (one item row gets unreadable JSON, the shop page throws, `error.tsx` shows, the row is repaired, `Try again` loads the page). 6: `e2e/account-publish.spec.ts`. 7: adds sign-up, login, recover, the recovery step, Your shops, Add a shop, Account (axe, no sideways scroll, a screenshot in `test-results/wp7-*`); landing, Help, Terms, Privacy and 404 were already covered. 8: new, at both widths: buyer shop page, receipt, dashboard tabs, counter card, order detail, setup draft. 9 is the Lighthouse run recorded above.

### Worth knowing
- A hand-started dev server with two Playwright processes attached (`E2E_REUSE_SERVER=1`) put every page into a reload loop (`Compiled in Nms` then a full reload, repeating), which failed specs for no real reason. The cause was not established: it kept looping for a moment after one process finished. The same specs passed one process at a time on Playwright's own server, so run them that way.
- `dashboardHref` with 2+ unattached owner cookies, noted above, stays as it was.
