# Contributing to Shelfie

Thanks for helping. Small, focused pull requests are easiest to review.

## Setup

```bash
# Node 22 or newer
npm install
cp .env.example .env   # PayPal SANDBOX keys and an Anthropic key; see the comments in the file
npm run dev            # http://localhost:3000
```

The unit tests need no keys. Use sandbox credentials only, never live ones.

## Checks

Run these before opening a pull request (CI runs the first three):

```bash
npm run typecheck
npm run lint
npm test               # Vitest unit tests, no network
npm run e2e            # Playwright, starts the app on port 3100 (for page and flow changes)
```

`npm run test:sandbox` (real PayPal sandbox calls) and `npm run test:ai` (real Claude calls) need a filled-in `.env`.

## Conventions

- **TypeScript strict** (`tsconfig.json`). Domain types live in `src/lib/domain/types.ts` and `src/lib/paypal/types.ts`.
- **Money is integer cents** (`src/lib/domain/money.ts`), never floats.
- **Prices come only from the server.** The agent door and checkout price orders from the shop's own data; never accept a price, total or payee from a buyer or an agent. Client totals are display-only.
- **Next.js 16 App Router.** `params`, `searchParams` and `cookies()` are async. Route handlers that touch SQLite, sharp or PayPal use `export const runtime = 'nodejs'`.
- **UI primitives** are shadcn-based, in `src/components/ui` (`@/components/ui/button`); merge classes with `cn()` from `@/lib/utils`. Colours come from the tokens in `src/app/globals.css` (see `docs/DESIGN.md`).
- **Motion** uses `m.*` from `motion` (never `motion.*`), and animates only transform and opacity. Respect reduced motion.
- **Tests** go in `tests/` (unit) or `e2e/` (Playwright). Add or update a test with every behaviour change.
- **Secrets** stay in `.env`; never log or commit a key. Add any new environment variable to `.env.example` with a one-line comment.

## Pull requests

- Keep each PR to one change, and describe what changed and how you checked it.
- Include screenshots (390 px and 1440 px) for visible UI changes.
- Security problems: please follow [SECURITY.md](SECURITY.md) instead of opening an issue.

By contributing you agree that your work is licensed under the [MIT License](LICENSE).
