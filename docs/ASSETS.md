# Third-party assets

The demo shops in `public/demo/<shop-slug>/` use real food photos from [Pexels](https://www.pexels.com/), so the storefront looks like a real shop in the demo and the screenshots. They are only used by the seeded demo shop and the design fixtures; a real seller uploads their own photos (`/i/<file>`).

## Licence

Every photo below is under the [Pexels License](https://www.pexels.com/license/): free to use for commercial and non-commercial purposes, no attribution required, and modification is allowed. We credit each photographer anyway. The licence does not allow selling unaltered copies or implying endorsement by the people or brands shown, so we picked photos with no visible brand, logo, product label, legible shop sign or identifiable face.

Processing (with `sharp`): auto-rotated, metadata stripped, cover-cropped to 1200×900 for items and 2000×900 for covers, JPEG quality 78, progressive; then (run 3, for page weight) scaled to 800×600 for items (quality 74) and 1600×720 for covers (quality 72), mozjpeg, progressive.

## Marigold Bakehouse (marigold-bakehouse, the seeded demo shop)

| File | Shows | Pexels page | Photographer | Licence |
| --- | --- | --- | --- | --- |
| `public/demo/marigold-bakehouse/cover.jpg` | Artisan loaves on wooden bakery shelves | https://www.pexels.com/photo/rustic-bread-display-on-wooden-shelves-35993723/ | [wal_ 172619](https://www.pexels.com/@wal_-172619-2156618639/) | Pexels License |
| `public/demo/marigold-bakehouse/country-sourdough-loaf.jpg` | Scored, floured round sourdough loaf on a cooling rack | https://www.pexels.com/photo/fresh-bread-with-crispy-crust-on-net-5764079/ | [Elle Hughes](https://www.pexels.com/@elletakesphotos/) | Pexels License |
| `public/demo/marigold-bakehouse/seeded-rye.jpg` | Slices of seed-topped dark rye bread on linen | https://www.pexels.com/photo/rye-bread-in-close-up-photography-11214698/ | [Nadin Sh](https://www.pexels.com/@nadin-sh-78971847/) | Pexels License |
| `public/demo/marigold-bakehouse/focaccia-rosemary-sea-salt.jpg` | Close-up of golden focaccia with rosemary and an open crumb | https://www.pexels.com/photo/close-up-of-freshly-baked-focaccia-bread-30666814/ | [Natalia Olivera](https://www.pexels.com/@nataliaolivera/) | Pexels License |
| `public/demo/marigold-bakehouse/butter-croissant.jpg` | Plain butter croissants piled on a plate | https://www.pexels.com/photo/close-up-shot-of-croissants-6202224/ | [Claudio Segovia](https://www.pexels.com/@claudio-segovia-11921273/) | Pexels License |
| `public/demo/marigold-bakehouse/almond-croissant.jpg` | Almond croissant topped with flaked almonds on a plate | https://www.pexels.com/photo/delicious-almond-croissant-on-rustic-plate-40664188/ | [sasif awan](https://www.pexels.com/@sasif-awan-520122311/) | Pexels License |
| `public/demo/marigold-bakehouse/cardamom-bun.jpg` | A knotted Swedish cardamom bun on a plain grey surface | https://www.pexels.com/photo/bun-bread-roll-on-a-grey-plain-background-4828333/ | [Polina Tankilevitch](https://www.pexels.com/@polina-tankilevitch/) | Pexels License |
| `public/demo/marigold-bakehouse/pain-au-chocolat.jpg` | Pains au chocolat on plates beside a mug of coffee | https://www.pexels.com/photo/croissants-and-a-cup-of-coffee-8909319/ | [Skyler Ewing](https://www.pexels.com/@skyler-ewing-266953/) | Pexels License |
| `public/demo/marigold-bakehouse/olive-oil-citrus-cake-8.jpg` | Round orange cake topped with glazed citrus slices | https://www.pexels.com/photo/orange-pie-10400526/ | [Jana Ohajdova](https://www.pexels.com/@jankao/) | Pexels License |
| `public/demo/marigold-bakehouse/seasonal-fruit-galette.jpg` | Rustic peach galette with blueberries on parchment | https://www.pexels.com/photo/cake-with-fruit-slices-19910615/ | [Beyza](https://www.pexels.com/@beyza-555707524/) | Pexels License |
| `public/demo/marigold-bakehouse/drip-coffee.jpg` | Mug of black coffee on linen beside a croissant | https://www.pexels.com/photo/teal-ceramic-mug-filled-with-coffee-near-baked-bread-1411948/ | [Lisa Fotios](https://www.pexels.com/@fotios-photos/) | Pexels License |

## Snap your counter (demo input)

| File | Shows | Pexels page | Photographer | Licence |
| --- | --- | --- | --- | --- |
| `public/samples/counter-case.jpg` | A bakery display case: croissants, almond croissants, filled pastries and a chocolate cake, with plain price cards (product names and "2.50", no shop name or logo) | https://www.pexels.com/photo/19498989/ | [Valeria Boltneva](https://www.pexels.com/@valeriya/) | Pexels License |

Used as the display-case photo for "Snap your counter" in the demo clip and the live check (`docs/AI_TOOLS.md` row 7); it is not shown on any shop. 1600×1067, as downloaded.

## Other assets

- Item illustrations (`public/illustrations.svg`, 12 drawings) and their contact sheet `docs/judge/evidence/illustrations.png`: drawn for Shelfie in this repository (run 3), no third-party source; same licence as the code.

- Fonts: Figtree, from Google Fonts via `next/font`, SIL Open Font License.

## UI components and motion (run 3)

- **shadcn/ui** (https://ui.shadcn.com, MIT): the component base. Its pattern (`components.json`, `cva` variants, `cn()`) is used, and the primitives in `src/components/ui/` are our own, written onto that pattern in the Storefront tokens. Built with `class-variance-authority` (Apache-2.0), `clsx` (MIT) and `tailwind-merge` (MIT).
- **motion** (https://motion.dev, formerly Framer Motion, MIT): all animation, through `src/components/motion/`.
- **lucide-react** (ISC): icons.
- **Skiper UI** (https://skiper-ui.com): **ideas only; no code, markup, styles or assets copied.** Its free tier names no licence and its terms forbid redistribution (DECISIONS, run 3, session 1). The kinds of interaction we looked at there and then wrote from scratch in our own tokens: a number that rolls to its new value (`CountUp`), a shimmer sweep on loading text and skeletons, a card that lifts on hover and presses on tap (`Pressable`), and a list that rises in one item after another (`Stagger`).

## Demo video

- **Voice-over:** synthesised locally on the CPU with [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (`hexgrad/Kokoro-82M`, open weights under the **Apache License 2.0**), through the `kokoro` Python package 0.9.4 (Apache-2.0) and its `misaki` grapheme-to-phoneme library. Voice **`af_heart`** (American English, female; graded A, the highest grade, in the model's `VOICES.md`). No cloud text-to-speech service, no voice cloning, no real person's voice. Script: `video/voice/kokoro_tts.py`; output: `video/project/audio/`.
- **Video font:** Figtree (SIL Open Font License 1.1), the latin subset, weights 400 to 800, from `@fontsource/figtree` 5.3.0, embedded in the Remotion bundle as base64 (`video/remotion/src/fonts/figtree-woff2.js`, licence beside it in `OFL.txt`).
- **Compositor:** the Remotion template comes from the demoday plugin, restyled; Remotion 4.0.499 (its own licence: free for individuals and small teams).
- **No music** and no sound effects.

## Ravi's Bike Repair (ravi-bike-repair)

<!-- ravi credits -->
