# WP1b notes: sound and vibration

## Core (src/lib/feedback/{prefs,sound,haptics,index}.ts)

Built to the addendum's Click sounds section and S2. `feedback()` still only dispatches `shelfie:feedback`; `connectFeedback()` is what makes sound and vibration listen, and `Tactile` mounts it.

Deviations and gaps in the brief, smallest choice taken:

- **`add` vibration has no pattern in S2.** The addendum vibrates on add to order but S2 lists only flip, success, error and order. `add` uses flip's single 10 ms.
- **Audio is also woken on `pointerup` and `click`.** The rule says create or resume on the first `pointerdown` or `keydown`, and that is where the context is made. Browsers do not count a touch `pointerdown` as a gesture, so on a phone that context stays suspended until the finger lifts. `pointerup` and `click` only resume a context that already exists; they never make one.
- **A sound asked for while the context is suspended** waits for the resume and is dropped if that takes over 250 ms, so a stale chime can't play on a later tap.
- **No context while the switch is off.** Turning the switch on after a gesture makes one straight away, so a chime doesn't need a second tap.
- **Vibration skips a page with no gesture yet** (`navigator.userActivation.hasBeenActive === false`), where Chrome refuses the call and logs an intervention.
- `tick` and `add` have separate limits: only `tick` (60 ms) and `order` (1.2 s) are limited, as specified.

`success` and `error` reach the vibration channel through `useAction` and `TrackingForm`.

## Wiring (ticks, switches, the chime)

- **Tick:** `Tactile` passes `press: () => feedback('tick')` to the press machine. One per press, nothing on hover, focus or a disabled control (those never reach the machine).
- **Deviation, for touch and pen only: the tick fires on lift, not when `data-pressed` is applied.** The addendum says both "at the moment `data-pressed` is applied" and "never on scroll", and on touch they conflict. A finger shows as pressed after resting 50 ms, and the browser only cancels the pointer once it has moved far enough to scroll, so a finger that rests and then scrolls would tick on every row and tile it starts on. Measured: with the tick on `apply`, the e2e test `none for a finger that rests before it scrolls` fails with a tick on the scroll; with this change it passes. Mouse and keyboard tick with `apply`, as specified. The visual press timing is unchanged. The cost: on a long touch hold, the tick comes at release.
- `press` is a new optional effect on `press-machine.ts`, so the timing rule is unit-tested. It also counts a second mouse click while the first press still shows, which doesn't re-apply `data-pressed`.
- A press on a `label[for]` of a text field ticks, because that label already gets `data-pressed`.
- **Chime:** `Dashboard.applyOrders` fires `feedback('order')` once when a poll finds any newly paid order.
- **`flip`** fires from `Switch` after `onChange`, and from the footer toggle after the change. So turning the setting off is silent and turning it on buzzes (Android).
- **Footer toggle:** `src/components/brand/SoundToggle.tsx`, in `SiteFooter` in the root layout, so it is on every page. `py-6` on the footer became `py-3` so the 44 px button doesn't grow the footer much.
- **Settings:** the `Sound and vibration` section sits after `Where you get paid` inside `SettingsPanel`. The switch's label is `Play sounds and vibrate` (the brief names only the section), and the description is S2's line.
- **Not wired: the `add` sound and vibration.** No add control exists until WP3b. WP3b should call `feedback('add')` on add. The press has already ticked by then, so that press gets both sounds unless WP3b suppresses one (the spec calls the add sound a warmer tick, so one sound was probably meant).

## Tests

No existing assertion was edited. `tests/ui/press-machine.test.ts` gained a new `describe` for the `press` effect. New: `tests/ui/feedback-{prefs,sound,haptics,channels}.test.ts`, `e2e/sounds.spec.ts`.

Checked once in real Chromium with a throwaway spec (not committed): zero `AudioContext` and zero oscillator starts before a gesture, even after a `tick` event; one context after a click, state `running`; `tick` then `order` gave 5 oscillator starts; none after writing the off value to storage.

`e2e/tactile.spec.ts`: 15 of 16 passed in the run with the throwaway spec while other worktrees were busy. The failure was line 214 (held response width); that test then passed 3 of 3 on its own.

Final wiring: `npm test` 1353 passed, typecheck and lint clean. `e2e/sounds.spec.ts` 20 of 20 and `e2e/tactile.spec.ts` 15 of 15, each run once. After those runs one test's path list lost a `/help` entry (no such route in this branch), and that test passed again on its own.
