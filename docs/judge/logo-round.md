# Logo round: six concepts for the Shelfie mark and wordmark

Judge: a fresh subagent. Inputs: `docs/JUDGING.md`, `docs/DESIGN.md` and the SVGs in `docs/judge/logo/concepts/{A,B}/{A1..B3}/` (the concept sheets were not trusted; every image below was rendered by the judge).

## Method

- Every `mark.svg` and `mark-mono.svg` was rasterised by sharp at exactly 16, 32, 64 and 256 px, on white and on `#141414`. Each mark is shown in five versions: the colour file as shipped, the colour file on dark as shipped, the colour file on dark with `#141414` swapped to white, mono ink, and mono white. At 16 and 32 px the same pixels are also shown enlarged (nearest neighbour).
- Each 16 px favicon in a mock Chrome tab strip between PayPal, GitHub, Gmail-red and Claude-orange favicons, light and dark.
- `icon-512` in a launcher tile and at 48 px, plus `icon-maskable` with a circle mask and the 80% safe circle drawn on it.
- Each lockup at 32 px in a 64 px header at 1440 and 390 px wide, white and `#141414`, next to Figtree nav text and the ink "Open my shop" button.
- A mock counter card (lockup, shop name, QR stand-in), with the mark and the lockup next to a PayPal-blue `#0070e0` pill "Approve $27.00 on PayPal".
- The wordmarks at 120, 56 and 18 px next to Figtree 700.

Scripts: `docs/judge/logo/compare/render.mjs`, `render2.mjs` (run with the concepts directory as the only argument; output goes to `/tmp/judge-logo/out`).

## Comparison PNGs (all six side by side, like with like)

| File | What it shows |
|---|---|
| `docs/judge/logo/compare/marks-16px.png` | Marks at 16 px, five versions, with ×6 enlargements |
| `docs/judge/logo/compare/marks-32px.png` | The same at 32 px (×3) |
| `docs/judge/logo/compare/marks-64px.png` | The same at 64 px |
| `docs/judge/logo/compare/marks-256px.png` | The same at 256 px |
| `docs/judge/logo/compare/favicon-tabstrip.png`, `favicon-tabstrip-x2.png` | 16 px favicon among real-style neighbours, light and dark tab strips |
| `docs/judge/logo/compare/app-icons.png`, `maskable-safe-zone.png` | 512 launcher tile, 48 px icon, maskable circle and 80% safe zone |
| `docs/judge/logo/compare/header-1440.png`, `header-390.png` | Lockup in a 64 px header, light and dark |
| `docs/judge/logo/compare/counter-card-paypal.png` | Counter card, and the mark and lockup beside the PayPal pill |
| `docs/judge/logo/compare/wordmarks.png`, `wordmarks-large.png` | Wordmark at 120, 56 and 18 px, against Figtree 700, and on dark |

## Scores (1 to 5)

| Dimension | A1 Shelf in frame | A2 Instant shelf | A3 fi shelf | B1 Awning | B2 Propped print | B3 On the shelf |
|---|---|---|---|---|---|---|
| **16/32 px legibility and distinctness** | **2**: six parts (two corners, jar, loaf, shelf, brackets) turn to a grey smudge at 16 px (`marks-16px.png`); in the tab strip it reads as "something with bars" | **3**: the solid tilted red tile stands out in the tab strip, but the bottle and jar inside are mush at 16 px and read as an "h" even at 32 px | **4**: crisp at 16 px, but it reads as the letters "fi" (a typographic ligature, or a Wi-Fi app), not as a picture | **5**: the clearest of the six at 16 px. Three scallops over a framed window stay sharp in light and dark tab strips and look like no neighbour | **2**: the print is about 7 px and the bun a 3 px dot, with lots of empty space; it is the smallest and faintest in the tab strip | **4**: the "s" in two corners reads at 16 px and is distinct; the lower corner arm thins to 1 px |
| **Says "shelf/storefront meets snapshot" without explanation** | **4**: viewfinder plus goods on a bracketed shelf says it literally, once you're close enough to see it | **3**: an instant photo is clear; that its thick bottom border is a shelf is not | **2**: without the note nobody sees that the crossbar is a shelf; the snapshot square reads as an i-dot | **4**: "shop" is instant (an awning). The "snapshot" (a print's deep chin as the counter) is subtle, though the frame does read as a framed window | **5** (at 64 px and up): a print propped on a shelf beside a bun is literally a shelfie | **3**: crop corners say "photo"; the shelf (the long bottom arm) needs explaining |
| **Real brand, not a generic app icon or clip-art** | **2**: a pictogram assembled from icon-set parts, and it keeps the viewfinder of the mark being replaced; it looks like an icon in a "bakery" icon pack | **3**: a solid pom rounded rectangle is still an app tile, the thing the human objected to; the tilt helps | **3**: letter-marks are brand-like, but "fi" isn't the brand's initial and the lockup reads "fi shelfie" (`header-1440.png`) | **4**: ownable proportions (a deep chin, posts running into the scallops, a pom cap on an ink body). The risk is that awning plus posts sits near the common "storefront" glyph | **4**: an unusual still-life silhouette at large sizes | **4**: wordmark-led, with an editorial crop-corner device; the mark's pinched "s" with knife-edge terminals looks odd at 256 px |
| **Wordmark (spacing, custom detail, harmony with mark and Figtree)** | **3**: the round monoline is even and matches the mark, but it is the lightest of the six and too thin at 18 px; the pom square i-dot is the only custom detail | **4**: heavy and custom (the e's flat cut, the tilted pom snap as the i-dot echoing the mark). Even spacing, but heavier than any Figtree UI weight | **4**: the f's crossbar running on into the i is a real detail no font has, and the pom dot stands on it; good weight beside Figtree | **3**: geometric and well spaced, but close to Futura or Figtree itself; its custom detail, a pom half-circle "scallop" i-dot, reads as a bowl or smile at 56 px and disappears at 18 px | **3**: the lightest B weight, a plain round ink dot, and a nice overshooting f crossbar; otherwise close to a font | **4**: the heaviest B weight, with a square pom dot that matches the corners; inside the corners the lockup gets busy and the bottom bar reads like an underline |
| **One-colour and dark versions** | **3**: mono and lockup-mono files are delivered and work; the colour file on dark loses the frame and shelf | **5**: the only mark that survives the colour file on dark untouched; mono, wordmark-mono and lockup-mono are all delivered | **3**: mono files are delivered; the colour file on dark leaves a lone red square | **3**: the mono mark works in ink and in white; no wordmark-mono or lockup-mono (the judge swapped ink to white); the colour file on dark leaves the awning only | **3**: the mono mark works; no wordmark or lockup mono; on dark the shelf disappears | **3**: the mono mark works; no wordmark or lockup mono; the colour file on dark leaves bare corners |
| **Maskable safe zone** | **5**: well inside the 80% circle | **5**: well inside | **5**: well inside | **4**: the awning's top corners sit exactly on the 80% circle (`maskable-safe-zone.png`) | **4**: both shelf ends touch the 80% circle | **3**: both corner tips sit on the circle, and the whole composition is tight to it |
| **Beside the PayPal-blue pill** | **4**: mostly ink, small red, calm | **3**: a solid red block next to a solid blue pill is the loudest pair, a red-versus-blue flag (`counter-card-paypal.png`) | **4**: ink with one small red square | **5**: a small red cap on an ink body; calm, and clearly a different brand from PayPal's | **4**: calm; a little red | **4**: the red corners frame the whole word, so there is more red next to the blue |
| **Part C (no slop, no emoji, no text tile, not the stock tag logo)** | pass | pass | pass | pass (not a tag; the closeness to a storefront glyph is scored above) | pass | pass |
| **Total /35** | **23** | **26** | **25** | **28** | **25** | **25** |

Part C fails: A1 0, A2 0, A3 0, B1 0, B2 0, B3 0.

## Winner: B1 "Awning"

**Why:** it is the only concept that is unmistakable at 16 px in a tab strip and still says something specific ("a shop") at that size. The scalloped pom awning over an ink window survived every check: light and dark tab strips, the 32 px header at 390 px, the counter card, and beside the PayPal pill, where its small red cap is the calmest pairing. It is a picture of a storefront, not a red app tile and not a pictogram, so it answers the human's "reads as a generic app icon" complaint directly. Its weaknesses are fixable without changing the idea: a font-like wordmark, missing mono and dark files, and a tight maskable crop.

**Runner-up: A2 "Instant shelf"** (26). It has the best dark and one-colour behaviour and the strongest custom wordmark, but its interior is mush at 16 and 32 px and its solid red tile is the closest of the six to an app tile. **Take from the losers:** A3's f-crossbar-into-i join as a wordmark detail, and A2's full set of mono files.

## Refinements for B1 (at most 5)

1. **Make the snapshot visible, and move it further from the stock storefront glyph.** Close the print: lower the window or raise the awning about 3 units so a thin band of the frame's top edge shows under the scallops. The ink shape then reads as a complete instant print (it is now an open "U"). Keep the chin at least 2.5 times the side borders (now 14 to 5).
2. **Give the wordmark one real custom detail and drop the half-circle i-dot.** The dot reads as a bowl at 56 px and disappears at 18 px. Use A3's join, with the f's crossbar running on over the i as a short shelf, and stand a single pom scallop or a small pom print on it as the dot, at least 1.4 times the current dot size.
3. **Bring the wordmark's weight up to the mark's.** Raise the stems about 15% so that at the 32 px lockup the letters match the mark's 5-unit posts; the lockup now looks like a bold mark beside a light word (`header-1440.png`).
4. **Ship the missing one-colour and dark files.** Add `wordmark-mono.svg` and `lockup-mono.svg` with `currentColor`, and a `favicon.svg` with a `prefers-color-scheme: dark` rule that turns the ink body white. As shipped, the window disappears on a dark tab strip and only the awning is left (`marks-16px.png`, row 2).
5. **Pull the maskable composition into the safe zone.** Scale the mark in `app-icon-maskable.svg` to about 90% of its current size, so that the awning's corners sit inside the 80% circle with a margin of about 4% instead of touching it.
