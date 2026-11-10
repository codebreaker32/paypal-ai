# Footer, run 8: before and after

The owner: "There's an extra vacant space in footer." Measured with Playwright (`getBoundingClientRect`, scrolled to the
end, viewport height 900, home page with `?chat=0`) on `/`, `/help`, `/terms` and `/privacy` at 390, 768, 1024, 1440 and
1920 px. `/terms` and `/privacy` measure exactly like `/help`, so they are folded into its rows.

Columns: **height** of the footer; **top** = footer top to the first row's 44 px targets; **bottom** = last control's
bottom to the footer's end (the empty charcoal under the content); **between** = space above / below the divider;
**nav off-centre** = centre of Product · Help · Legal · Open Source minus the page centre; **GitHub inset** = how far the
drawn GitHub mark stops short of the content edge the logo and the Sound switch line up with.

| Page | Width | Height (before → after) | Top | Bottom | Between | Nav off-centre | GitHub inset |
|---|---|---|---|---|---|---|---|
| `/` | 390 | 281 → 213 | 12 → 12 | **104 → 12** | 12/8 → 12/12 | 38 → 42 (*) | 8 → 0 |
| `/` | 768 | 277 → 189 | 20 → 16 | **104 → 16** | 20/8 → 16/16 | 47 → 0 | 8 → 0 |
| `/` | 1024 | 253 → 153 | 20 → 16 | **116 → 16** | 20/8 → 16/16 | 47 → 0 | 8 → 0 |
| `/` | 1440 | 253 → 153 | 20 → 16 | **116 → 16** | 20/8 → 16/16 | 47 → 0 | 8 → 0 |
| `/` | 1920 | 253 → 153 | 20 → 16 | **116 → 16** | 20/8 → 16/16 | 47 → 0 | 8 → 0 |
| `/help` (`/terms`, `/privacy`) | 390 | 185 → 193 | 12 → 12 | 8 → 12 | 12/8 → 12/12 | 38 → 42 (*) | 8 → 0 |
| `/help` | 768 | 181 → 189 | 20 → 16 | 8 → 16 | 20/8 → 16/16 | 47 → 0 | 8 → 0 |
| `/help` | 1024 | 145 → 153 | 20 → 16 | 8 → 16 | 20/8 → 16/16 | 47 → 0 | 8 → 0 |
| `/help` | 1440 | 145 → 153 | 20 → 16 | 8 → 16 | 20/8 → 16/16 | 47 → 0 | 8 → 0 |
| `/help` | 1920 | 145 → 153 | 20 → 16 | 8 → 16 | 20/8 → 16/16 | 47 → 0 | 8 → 0 |

(*) Under 768 px the main row stays logo · links · GitHub spaced between (the four links cannot centre on the page beside
a 118 px logo at 390), so the off-centre number there is by design.

What was wrong, and what changed:

1. **~100 px of empty charcoal on `/`.** The band carried `padding-bottom: launcher + bottom offset + edge` (104 to
   116 px) so the fixed chat launcher would not cover the Sound switch, across the full width, where the launcher only
   occupies a 60 px corner. Now only that corner is kept clear (`home-chat.css`): from 640 px the last row stops short
   of the launcher (`padding-inline-end`, 61 px at 1440, 0 at 1920 where the content edge already clears it), and the
   launcher rests beside the Sound switch at the end of the row. Under 640 px the row is full, so the test-mode sentence
   (now the last line on phones) narrows beside the launcher and is centred on it: 20 px taller than on `/help`
   at 390, the only height the home page still adds, and the launcher fills it.
2. **Uneven padding.** 20 px above the first row and 20 px above the divider, but 8 px below it and 8 px at the end.
   Now one value, `--footer-pad` (12 px under 768, 16 px from 768, both on the 4 px scale), above, either side of the
   divider and below.
3. **Links off-centre.** `justify-between` with a 138 px logo and a 44 px GitHub target put the links 47 px right of
   the page's centre. From 768 px the row is a `1fr auto 1fr` grid, so they sit on the centre.
4. **GitHub mark 8 px inside the content edge** (a 28 px mark in a 44 px target); `-mr-2` lines it up with the Sound
   switch below and the hero's content edge (`max-w-site` + `px-band-gutter`; logo at 35 px and right edge at
   1405 px at 1440, unchanged).
5. **768 px wrapped badly**: the sentence and the links shared a flex row that did not fit (737 px in 728), so the
   links fell under the sentence, left-aligned. Under 1024 px the links and Sound switch are now one line (switch at
   the right edge) and the sentence sits under them.

## Fix round (after the check)

Measured the same way on a dev server, scrolled to the end. **Text gap** = the test-mode sentence's last line to the
footer's end; **text centre / launcher centre** = their heights above the footer's end.

| Page, width | Text gap (before → after) | Text centre / launcher centre | Sound right / content edge | GitHub mark right / target |
|---|---|---|---|---|
| `/` 390 | 42 → 32 | 62 → 51 / 48 | 370 / 370 | 370 / 44 px |
| `/` 480 | 42 → 32 (2 lines) | 62 → 51 / 48 | 460 / 460 | 460 / 44 px |
| `/` 639 | 62 → 42 (1 line) | 72 → 51 / 48 | 619 / 619 | 619 / 44 px |
| `/` and `/help` 360 | unchanged | (home) 51 / 48 | **349 → 340** / 340 | **343 → 340** / **39 → 44 px** |
| `/` 768 to 1920 | unchanged (16 px under the last row) | — | 680, 928, 1344, 1640 (launcher beside it from 640 to ~1550, kept) | on the edge |

- Under 640 px the sentence is now centred on the launcher (`display: flex; align-items: center` in its reserved
  height), so the launcher and the words are one row and the lowest thing drawn, the launcher, sits 20 px from the end,
  as the logo glyph sits 22 px from the top. The reserved height cannot shrink: it is what keeps the Sound row above
  the launcher's top.
- The reserve reads the footer's own width (`cqw`) and `env(safe-area-inset-right)`, so a classic scrollbar no longer
  eats into the 12 px gap beside the switch.
- At 360 the rows' gaps tighten (12 px between the small links, 8 px in the main row), so the switch and GitHub mark end
  on the content edge and GitHub keeps its 44 px target. The page's 16 px overflow at 360 and 375 is the header's menu
  button (`BandHeader`), not the footer.
- Kept: the switch stops short of the right content edge on `/` from 640 to ~1550 px, because the launcher rests there
  (the alternative is the padded band the owner called vacant space). The 8 px between a 28 px logo and its 44 px row
  at the top is the tap targets' height, mirrored by the Sound pill's 44 px at the bottom.

Checked in `e2e/home-chat.spec.ts`: scrolled to the end at 1440 and 390, every footer link and button is hit at its
centre (none is under the launcher); at 1440 the last row ends exactly one band padding above the footer's end, and at
390 the sentence's centre is within 4 px of the launcher's.

Screenshots: `docs/preview/footer-390.png`, `docs/preview/footer-1440.png` (production build, `/`, scrolled to the end).
