# WP4 notes

## Step 1: the no-visual route-group move

URLs are unchanged: `(app)` and `(dashboard)` are route groups. `(app)/layout.tsx` is a pass-through that calls `requireOwner`; `AppShell` arrives in a later step.

Edited tests:
- `tests/discovery/card-page.test.ts`: import path only, the counter card page moved to `src/app/shops/[id]/(app)/card/page`.
