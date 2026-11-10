# Home chat proportions, run 8 (10 Nov 2026)

The owner: "Improve bot split up (not good ratio in desktop)." Before (run 7, `docs/preview/chat-1440.png` at 85a7b8c): a
380 x 560 panel whose log was bottom-anchored, so the greeting and three full-width starter rows sat on the composer under
a ~130 px empty band; header padding 10/20 px, log and footer 20 px.

After: a 400 x 520 panel (`min(32.5rem, viewport - header - launcher - gaps)` tall), log top-aligned while the
conversation is short (a long one scrolls as before), starters as wrapping chips, 16 px inset on every side of header,
log and footer, the message box and a 48 px Send on one row. The phone bottom sheet is unchanged.

Measured on a production build (`next start`), panel opened from the launcher on `/?chat=0`, with
`/tmp/r8chat/shots.mjs` (Playwright, `getBoundingClientRect`). Edges are distances from the viewport's right/bottom
edges. Paddings are top/right/bottom/left. "Greeting gap" is the greeting's top minus the log's top (the log's own
padding). The h1 rect is its box (`w-fit` since this run, so it is the text's extent).

| Viewport | Panel w x h | Header / log / footer h | Padding header · log · footer | Greeting gap | Starter chips (w/lines) | Box + Send | Right/bottom edges | h1 rect vs panel |
|---|---|---|---|---|---|---|---|---|
| 1280x800 | 400 x 520 | 79 / 358 / 81 | 16px · 16px · 16px (all sides) | 16 | 366 px/2 lines, 204 px/1 line, 290 px/1 line | 251x48 + 107x48, one row: yes | panel 24/96, launcher 24/24 | 31..479 x 115..223: clear |
| 1440x900 | 400 x 520 | 79 / 358 / 81 | 16px · 16px · 16px (all sides) | 16 | 366 px/2 lines, 204 px/1 line, 290 px/1 line | 251x48 + 107x48, one row: yes | panel 24/96, launcher 24/24 | 35..538 x 120..241: clear |
| 1920x1080 | 400 x 520 | 79 / 358 / 81 | 16px · 16px · 16px (all sides) | 16 | 366 px/2 lines, 204 px/1 line, 290 px/1 line | 251x48 + 107x48, one row: yes | panel 24/96, launcher 24/24 | 280..783 x 120..241: clear |
| 1366x657 | 400 x 441 | 79 / 279 / 81 | 16px · 16px · 16px (all sides) | 16 | 366 px/2 lines, 204 px/1 line, 290 px/1 line | 251x48 + 107x48, one row: yes | panel 24/96, launcher 24/24 | 33..512 x 119..234: clear |
| 1024x768 | 400 x 520 | 79 / 358 / 81 | 16px · 16px · 16px (all sides) | 16 | 366 px/2 lines, 204 px/1 line, 290 px/1 line | 251x48 + 107x48, one row: yes | panel 24/96, launcher 24/24 | 25..492 x 105..217: clear |
| 390x844 | 390 x 717 | 85 / 559 / 73 | 10px/20px/10px/20px · 16px/20px/16px/20px · 12px/20px/12px/20px | 291 | 335 px/2 lines, 335 px/1 line, 335 px/1 line | 235x48 + 107x44, one row: yes | panel 0/0, launcher 20/20 | 20..343 x 92..170: overlaps |

Notes:

- Right edges: panel and launcher are both 24 px from the right at every desktop width. Bottom: the launcher is 24 px
  from the bottom; the panel ends 12 px above the launcher's top (24 + 60 + 12 = 96), so the two share one column.
- 1366 x 657: the panel is shortened to 441 px so it stays under the sticky header (its top is 120, header bottom 64);
  it does not auto-open on a screen under 700 px tall (unchanged).
- 1024 x 768: before `w-fit` the h1 box spanned 25..1000 and met the panel, though its text ended at 492; now clear.
- Proportions: header 15 %, log 69 %, footer 16 % of the 520 px panel.
- 390 x 844 is the phone bottom sheet, unchanged by design (it is a modal sheet over the hero, so the h1 overlap is
  expected; its log stays bottom-anchored near the thumb).
- With a conversation (recorded first turn replayed), the log scrolls (scrollHeight 562 in a 296 px viewport) and the
  composer stays on one row.

Checks in `e2e/home-chat.spec.ts` (`expectBalancedPanel`): 400 x 520 at 1024, 1280, 1440 and 1920; panel clear of the
h1; greeting within 20 px of the header; right edges equal; box and Send bottom-aligned on one row; Send at least 44 px;
no starter chip taller than 60 px.

Screens: `docs/preview/chat-1280.png`, `chat-1440.png`, `chat-1920.png`, `chat-390.png` (production build).

## Fix round (after the independent check)

The checker found 12 px vertical padding in the header and footer (brief: 16 to 20 px) and a 89 px header because the
subtitle wrapped. Now the header and footer pad 16 px on every side and the desktop subtitle is "Marigold Bakehouse ·
example shop" on one line: header 89 -> 79 px, footer 77 -> 81 px, log 352 -> 358 px (273 -> 279 px at 1366x657, where
the content is now 280 px in a 279 px log, a sub-pixel difference instead of 7 px clipped). The table above is the
re-measured state (production build, `/tmp/r8fix/m.mjs`). Unchanged and deliberate: the panel ends 96 px from the
bottom, stacked 12 px above the launcher (shared right edge, 24 px); it covers the lower part of the hero's step chain
at 1024 to 1440 px (not the h1), as the old panel did. Phone sheet (390x844): unchanged (header 85, Send 44).
