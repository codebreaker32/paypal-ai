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

## Example photo library (Part A3)

Real photos of common item types (`public/library/<id>.webp`, catalogue in `src/lib/library/catalog.ts`), shown as a labelled *example* until the seller adds their own photo. Every photo is under the [Pexels License](https://www.pexels.com/license/); we picked ones with no visible brand, logo, readable label or identifiable face. Processing (with `sharp`): auto-rotated, metadata stripped, cover-cropped (attention strategy) to 800×600, WebP quality 74.

| Id | Shows | Pexels page | Photographer | Licence |
| --- | --- | --- | --- | --- |
| `croissant-1` | Golden butter croissants piled on a silver tray | https://www.pexels.com/photo/close-up-of-croissants-11675765/ | [Jana Ohajdova](https://www.pexels.com/@jankao/) | Pexels License |
| `croissant-2` | Rows of freshly baked croissants close up | https://www.pexels.com/photo/freshly-baked-artisan-croissants-in-berlin-bakery-30853716/ | [Manish Jain](https://www.pexels.com/@manish-jain-1176829519/) | Pexels License |
| `croissant-3` | A few croissants on a pale blue plate | https://www.pexels.com/photo/close-up-shot-of-croissants-6202224/ | [Claudio Segovia](https://www.pexels.com/@claudio-segovia-11921273/) | Pexels License |
| `croissant-4` | Croissants cooling on a wire rack | https://www.pexels.com/photo/freshly-made-croissants-20002837/ | [Arda Kaykısız](https://www.pexels.com/@arda-kaykisiz-672105204/) | Pexels License |
| `pain-au-chocolat-1` | Pains au chocolat on small plates beside a mug of coffee | https://www.pexels.com/photo/croissants-and-a-cup-of-coffee-8909319/ | [Skyler Ewing](https://www.pexels.com/@skyler-ewing-266953/) | Pexels License |
| `pain-au-chocolat-2` | Two pains au chocolat with muffins on a paper-lined tray | https://www.pexels.com/photo/croissants-and-muffins-served-in-a-bakery-19328373/ | [Luis Felipe Pérez](https://www.pexels.com/@luis-felipe-perez-817377805/) | Pexels License |
| `pain-au-chocolat-3` | Rows of glossy pains au chocolat close up | https://www.pexels.com/photo/freshly-baked-chocolate-croissants-in-bakery-30926134/ | [Manish Jain](https://www.pexels.com/@manish-jain-1176829519/) | Pexels License |
| `sourdough-1` | A floured round sourdough loaf with a crackled crust | https://www.pexels.com/photo/a-delicious-bread-in-close-up-photography-11042699/ | [Lucian Anton](https://www.pexels.com/@lucian-anton-1479659/) | Pexels License |
| `sourdough-2` | A rustic scored sourdough boule on a wooden board | https://www.pexels.com/photo/fresh-artisan-sourdough-bread-on-rustic-board-30632198/ | [Natalia Olivera](https://www.pexels.com/@nataliaolivera/) | Pexels License |
| `sourdough-3` | A sourdough loaf cut into slices showing the open crumb | https://www.pexels.com/photo/bread-on-brown-wooden-chopping-board-3851002/ | [ready made](https://www.pexels.com/@readymade/) | Pexels License |
| `sourdough-4` | A golden round sourdough loaf on a dark board | https://www.pexels.com/photo/crusty-freshly-baked-round-bread-on-wooden-board-38531158/ | [Giovanna Kamimura](https://www.pexels.com/@giovanna-kamimura-399616174/) | Pexels License |
| `rye-1` | A seeded rye loaf and rolls on a wooden table | https://www.pexels.com/photo/assorted-bread-and-buns-on-table-5869670/ | [Nikita Belokhonov](https://www.pexels.com/@traveliving/) | Pexels License |
| `rye-2` | Slices of dark seeded rye bread, one buttered | https://www.pexels.com/photo/close-up-shot-of-yummy-bread-11214699/ | [Nadin Sh](https://www.pexels.com/@nadin-sh-78971847/) | Pexels License |
| `rye-3` | Slices of rye bread beside ears of grain | https://www.pexels.com/photo/sliced-bread-on-brown-wooden-tray-8709687/ | [Vilnis Husko](https://www.pexels.com/@vhusko/) | Pexels License |
| `baguette-1` | Crusty baguettes lined up side by side | https://www.pexels.com/photo/freshly-baked-crisp-french-baguettes-up-close-38597841/ | [Ilo Frey](https://www.pexels.com/@couleur/) | Pexels License |
| `baguette-2` | Two scored baguettes on a cloth beside brown paper | https://www.pexels.com/photo/freshly-baked-artisan-baguettes-in-paper-bag-30926137/ | [Manish Jain](https://www.pexels.com/@manish-jain-1176829519/) | Pexels License |
| `baguette-3` | Two baguettes on a dark background | https://www.pexels.com/photo/rustic-artisan-baguettes-on-black-background-30926135/ | [Manish Jain](https://www.pexels.com/@manish-jain-1176829519/) | Pexels License |
| `focaccia-1` | A dimpled herb focaccia in a parchment-lined tin | https://www.pexels.com/photo/fresh-homemade-focaccia-with-rosemary-and-onion-38860516/ | [George Piskov](https://www.pexels.com/@george-piskov-289673052/) | Pexels License |
| `focaccia-2` | Focaccia topped with cherry tomatoes on a board | https://www.pexels.com/photo/rustic-focaccia-bread-with-cherry-tomatoes-and-olives-36928508/ | [Christina & Peter](https://www.pexels.com/@christina99999/) | Pexels License |
| `focaccia-3` | A tall golden focaccia cut open to show the crumb | https://www.pexels.com/photo/focaccia-on-paper-in-close-up-view-18453904/ | [Lucie Liz](https://www.pexels.com/@lulizler/) | Pexels License |
| `sweet-bun-1` | Glazed cinnamon rolls topped with nuts | https://www.pexels.com/photo/delicious-cinnamon-rolls-with-sugar-crystals-34661986/ | [Paulina Kłys](https://www.pexels.com/@paulina-klys-2155606640/) | Pexels License |
| `sweet-bun-2` | A swirled sweet bun on an orange napkin beside a glass of tea | https://www.pexels.com/photo/cinnamon-roll-near-cup-of-tea-7332877/ | [Evgeniy Alekseyev](https://www.pexels.com/@shliftik/) | Pexels License |
| `sweet-bun-3` | A cinnamon roll on a white plate beside a cup of coffee | https://www.pexels.com/photo/coffee-and-cinnamon-roll-on-marble-table-35827211/ | [Raj Pillay](https://www.pexels.com/@raj-pillay-272302/) | Pexels License |
| `pan-dulce-1` | A concha (Mexican sweet bread) on a yellow background | https://www.pexels.com/photo/delicious-concha-bread-on-vibrant-yellow-background-35152909/ | [AGUSTIN MERCADO](https://www.pexels.com/@mercadoa20/) | Pexels License |
| `pan-dulce-2` | A strawberry-filled concha held out on a white plate | https://www.pexels.com/photo/person-holding-a-concha-bread-on-white-plate-13185298/ | [Amar  Preciado](https://www.pexels.com/@amar/) | Pexels License |
| `muffin-1` | Chocolate chip muffins in paper cases, from above | https://www.pexels.com/photo/close-up-photo-of-cupcakes-on-white-surface-10509256/ | [Sara](https://www.pexels.com/@sarahpictures/) | Pexels License |
| `muffin-2` | Chocolate muffins in white paper cases | https://www.pexels.com/photo/delicious-homemade-chocolate-muffins-on-display-34657337/ | [Paulina Kłys](https://www.pexels.com/@paulina-klys-2155606640/) | Pexels License |
| `muffin-3` | Sugar-dusted muffins on a wooden board with apples | https://www.pexels.com/photo/homemade-sweet-muffins-with-apples-on-table-6625812/ | [TIVASEE .](https://www.pexels.com/@tivasee-17374727/) | Pexels License |
| `scone-1` | Fruit scones on a white scalloped plate | https://www.pexels.com/photo/freshly-baked-scones-in-decorative-bowl-35675924/ | [Wendy Wei](https://www.pexels.com/@wendywei/) | Pexels License |
| `scone-2` | A wedge-shaped scone on a small plate | https://www.pexels.com/photo/sunlit-scone-on-wooden-table-for-breakfast-34642142/ | [James Collington](https://www.pexels.com/@james-collington-2147687246/) | Pexels License |
| `scone-3` | A tray of golden round scones | https://www.pexels.com/photo/top-view-of-brown-breads-9392839/ | [Mustafa Akın](https://www.pexels.com/@msaimakin/) | Pexels License |
| `danish-1` | A blueberry danish dusted with icing sugar | https://www.pexels.com/photo/brown-and-purple-bread-on-white-surface-792406/ | [Mick Victor](https://www.pexels.com/@mick-victor-259435/) | Pexels License |
| `danish-2` | Assorted danish pastries with fruit and savoury toppings | https://www.pexels.com/photo/croissants-with-toppings-19499003/ | [Valeria Boltneva](https://www.pexels.com/@valeriya/) | Pexels License |
| `danish-3` | A cherry danish beside a cup of coffee | https://www.pexels.com/photo/close-up-of-a-croissant-and-a-cup-of-coffee-7367955/ | [Evgeniy Alekseyev](https://www.pexels.com/@shliftik/) | Pexels License |
| `fruit-tart-1` | Strawberry and blueberry tartlets on a lace doily | https://www.pexels.com/photo/delicious-fruit-tarts-with-fresh-berries-on-display-33335365/ | [Gonzalo 8a](https://www.pexels.com/@elmedionoob/) | Pexels License |
| `fruit-tart-2` | Two small berry tarts on a marble stand | https://www.pexels.com/photo/small-cakes-with-berries-15249752/ | [Ludovic Delot](https://www.pexels.com/@delot/) | Pexels License |
| `fruit-tart-3` | A fruit tartlet piled with strawberries and berries | https://www.pexels.com/photo/berry-tart-on-table-with-plates-6425988/ | [Pegah Sharifi](https://www.pexels.com/@peg1997/) | Pexels License |
| `fruit-tart-4` | A large fruit tart with fanned peaches, strawberries and kiwi | https://www.pexels.com/photo/tart-with-slices-of-fresh-fruits-4748367/ | [Regina Ferraz](https://www.pexels.com/@reginaferraz/) | Pexels License |
| `cake-slice-1` | Slices of chocolate layer cake on a white board | https://www.pexels.com/photo/close-up-of-chocolate-cakes-10249461/ | [Nishant Sharma](https://www.pexels.com/@nishant-sharma-77755298/) | Pexels License |
| `cake-slice-2` | A slice of cheesecake-style cake with cherries and chocolate sauce | https://www.pexels.com/photo/white-chocolate-cake-on-white-ceramic-plate-14107/ | [Valeria Boltneva](https://www.pexels.com/@valeriya/) | Pexels License |
| `cake-slice-3` | A slice of cream sponge layer cake on a plate | https://www.pexels.com/photo/sliced-delectable-cake-on-top-of-white-textile-5426057/ | [Nataliya Vaitkevich](https://www.pexels.com/@n-voitkevich/) | Pexels License |
| `cake-whole-1` | A whole chocolate drip cake being topped with strawberries | https://www.pexels.com/photo/hand-placing-fruit-on-cake-18613262/ | [Anete Lusina](https://www.pexels.com/@anete-lusina/) | Pexels License |
| `cake-whole-2` | A lemon tart with a slice cut, among lemons on a pink cloth | https://www.pexels.com/photo/delicious-lemon-tart-on-pink-background-with-fresh-lemons-31111197/ | [Angelica Britto](https://www.pexels.com/@angelicabritto/) | Pexels License |
| `cake-whole-3` | A round chocolate cake cut into wedges | https://www.pexels.com/photo/slices-of-chocolate-cake-on-a-board-6612671/ | [Pavel Danilyuk](https://www.pexels.com/@pavel-danilyuk/) | Pexels License |
| `chocolate-cake-1` | A slice of chocolate layer cake beside muffins | https://www.pexels.com/photo/a-slice-of-chocolate-cake-and-scattered-cardamom-11333387/ | [Ali Hussein](https://www.pexels.com/@ali-hussein-183843258/) | Pexels License |
| `cheesecake-1` | A slice of cheesecake with berry sauce and fresh fruit | https://www.pexels.com/photo/delicious-berry-cheesecake-with-fresh-fruits-29653160/ | [Valeria Boltneva](https://www.pexels.com/@valeriya/) | Pexels License |
| `cheesecake-2` | A slice of cheesecake with a chocolate and nut top | https://www.pexels.com/photo/decadent-chocolate-hazelnut-cheesecake-slice-38134571/ | [Visen Group](https://www.pexels.com/@visen-group-2161585898/) | Pexels License |
| `cheesecake-3` | A slice of cheesecake with cherries and red drizzle | https://www.pexels.com/photo/delicious-cherry-cheesecake-slice-on-plate-38495630/ | [Valeria Boltneva](https://www.pexels.com/@valeriya/) | Pexels License |
| `cupcake-1` | Cupcakes with colourful swirled frosting in a display case | https://www.pexels.com/photo/close-up-photo-of-sweet-cupcakes-4981623/ | [Wilson Ren](https://www.pexels.com/@wanxianren/) | Pexels License |
| `cupcake-2` | Chocolate and pink rose-piped cupcakes | https://www.pexels.com/photo/close-up-shot-of-cupcakes-10699891/ | [Kiril Gruev](https://www.pexels.com/@kiril-gruev-2644795/) | Pexels License |
| `cupcake-3` | A row of frosted cupcakes on a counter | https://www.pexels.com/photo/photo-of-cupcakes-1028704/ | [Acharaporn Kamornboonyarush](https://www.pexels.com/@feelartfeelant/) | Pexels License |
