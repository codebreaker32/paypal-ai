# WP1 notes (foundation task)

Built: press tokens and utilities in `globals.css`; `src/lib/feedback/{press-machine,route-progress,index,use-action}.ts`; `src/components/motion/tactile.tsx`, mounted in `layout.tsx` inside `<Suspense fallback={null}>`. No component uses the `press*` utilities yet: that is the sweep.

Existing tests edited: none.

Tests added: `tests/ui/press-machine.test.ts`, `tests/ui/route-progress.test.ts`, `tests/ui/feedback.test.ts`, `tests/ui/use-action.test.ts`.

## Deviations and choices the brief left open

| Where | What | Why |
|---|---|---|
| `src/lib/feedback/route-progress.ts` | New module, not in the brief's file list | The bar's timing and the "which click navigates" rule are pure logic, so they are tested without a DOM. |
| `tactile.tsx` listener | Also listens for `click` and `pageshow`, beyond the brief's six press events | Link navigation is detected on `click` (it also covers Enter); the brief ends progress on `pageshow`. Still one function on the window, in capture. |
| `tactile.tsx` `blur` | Only the pressed control's own blur or the window's counts. A keyboard press ends as a release (keeps the 110 ms hold), a pointer press as a cancel | Pressing a control moves focus, which blurs the previous element mid-press. Enter can open a dialog and move focus, and the press should still be seen. |
| `tactile.tsx` pointerdown | ctrl + mouse is not a press | On a Mac it opens the context menu and the pointerup may never arrive. |
| `tactile.tsx` keyboard | Space never presses a link (it scrolls). Focused file and radio inputs press their wrapping label; Enter does not press a radio's label (it submits the form) | Matches what those keys do. |
| `press-text` | Transition list is `color, text-decoration-color, opacity` | "Opacity only" read as the press effect. Dropping `color` would make the hover colour snap once `transition-colors` is replaced. |
| `press-surface` | Transition list also names `translate`; pressed selector is `[data-pressed][data-pressed]` | `Pressable`'s hover lift uses `translate` (the brief's root cause). Tailwind emits `hover:` variants after plain utilities, so at equal specificity `hover:bg-*` would beat the pressed fill; a browser check confirmed the doubled selector shows the fill while hovered. |
| `[data-navigating]` | A delayed CSS animation, unlayered | A delayed transition would also delay the `scale` return on the same element. |
| `useAction` | `error` is a message string or null; `run` never rejects and resolves to `undefined` on failure | Every planned call site turns the error into a sentence for a `FieldError`. |

## For the sweep

- Use a `press*` utility instead of a `transition-*` class on the same element, not beside it: both set the transition list.
- Set `--press-local` only to a token (`var(--press-scale-wide)`), or reduced motion stops applying.
- Next's `Link` always calls `preventDefault`, so `Tactile` cannot tell whether a link's own handler cancelled the navigation. No link does that today; one that did would show the bar until the 10 s failsafe.
- `e2e/tactile.spec.ts` is not written. Tactile was checked with a throwaway page and spec (16 passing, removed): mouse, keyboard, touch tap, swipe that scrolls, disabled, right button, stretched link, `label[for]`, unmount mid-press, reduced motion, soft and document navigation, `beginNavigation`, `useAction`.
