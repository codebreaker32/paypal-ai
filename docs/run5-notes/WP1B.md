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

Not in this step: firing `tick` from `Tactile`, `add` from the add controls, `flip` from switches, `order` from the Dashboard poll, the Settings section and the footer toggle. `success` and `error` already reach the vibration channel through `useAction` and `TrackingForm`.

## Tests

No existing test was edited. New: `tests/ui/feedback-{prefs,sound,haptics,channels}.test.ts`.

Checked once in real Chromium with a throwaway spec (not committed): zero `AudioContext` and zero oscillator starts before a gesture, even after a `tick` event; one context after a click, state `running`; `tick` then `order` gave 5 oscillator starts; none after writing the off value to storage.

`e2e/tactile.spec.ts`: 15 of 16 passed in the run with the throwaway spec while other worktrees were busy. The failure was line 214 (held response width); that test then passed 3 of 3 on its own.
