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

- **PayPal logo** (`public/brand/paypal/paypal-color.svg`, `paypal-mark-color.svg`; copies for the video in `video/project/assets/paypal/`): PayPal's official artwork, downloaded from PayPal's own CDN for its UI logos, https://www.paypalobjects.com/paypal-ui/logos/svg/paypal-color.svg and https://www.paypalobjects.com/paypal-ui/logos/svg/paypal-mark-color.svg (byte-identical to those URLs, checked 10 Nov 2026). Used unmodified, per PayPal's brand guidelines, only to show PayPal as the payment method (no recolouring, stretching, rotation or effects; clear space kept; at least 60 px wide; colour logo on white only). PayPal and the PayPal logo are trademarks of PayPal, Inc.; their use is not an endorsement of Shelfie by PayPal. Not covered by this repository's licence.

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

## Tía Lupe's Tacos (tia-lupe-chalkboard)

Same processing as above (items 800×600 quality 74, cover 1600×720 quality 72, mozjpeg, progressive). Several also appear in the example photo library below. The "Jarritos" item shows an unbranded glass of fruit soda, not the branded bottle; `guac-chips.jpg` is a hand crop that leaves out a printed paper liner. Licence for all: Pexels License (free to use, no attribution required; credited anyway).

| File | Shows | Pexels page | Photographer | Licence |
| --- | --- | --- | --- | --- |
| `public/demo/tia-lupe-chalkboard/cover.jpg` | Overhead spread of a burrito, tacos, elote, chips, salsas and drinks on clay plates | https://www.pexels.com/photo/mexican-restaurant-27365272/ | [Snappr](https://www.pexels.com/@snappr/) | Pexels License |
| `public/demo/tia-lupe-chalkboard/al-pastor.jpg` | Two al pastor tacos with cilantro and lime on a dark plate | https://www.pexels.com/photo/delicious-tacos-al-pastor-with-fresh-garnish-34289264/ | [Abner Velázquez](https://www.pexels.com/@abner-velazquez-1035709527/) | Pexels License |
| `public/demo/tia-lupe-chalkboard/carnitas.jpg` | Close-up of shredded meat tacos with onion and cilantro | https://www.pexels.com/photo/mouthwatering-tacos-in-macro-shot-photography-5454019/ | [Jeswin Thomas](https://www.pexels.com/@jeswin/) | Pexels License |
| `public/demo/tia-lupe-chalkboard/pollo-asado.jpg` | Chicken tacos with slaw and lime on a blue plate | https://www.pexels.com/photo/a-mouthwatering-tacos-on-a-ceramic-plate-7041784/ | [Styves Exantus](https://www.pexels.com/@styves-exantus-7162424/) | Pexels License |
| `public/demo/tia-lupe-chalkboard/hongos-veg.jpg` | Blue corn veggie tacos with avocado and pickled onion | https://www.pexels.com/photo/delicious-tacos-with-fresh-guacamole-and-cilantro-36498698/ | [DΛVΞ GΛRCIΛ](https://www.pexels.com/@davegarcia/) | Pexels License |
| `public/demo/tia-lupe-chalkboard/guac-chips.jpg` | Guacamole in a stone molcajete with tortilla chips | https://www.pexels.com/photo/authentic-mexican-food-27603308/ | [Snappr](https://www.pexels.com/@snappr/) | Pexels License |
| `public/demo/tia-lupe-chalkboard/elote.jpg` | Mexican street corn with cheese and chilli | https://www.pexels.com/photo/mexican-food-on-plate-6133872/ | [Daniela Velarde](https://www.pexels.com/@daniela-velarde-3787727/) | Pexels License |
| `public/demo/tia-lupe-chalkboard/burrito-grande.jpg` | A large burrito cut open showing rice, chicken and peppers | https://www.pexels.com/photo/sushirrito-cut-in-half-5337516/ | [ROMAN ODINTSOV](https://www.pexels.com/@roman-odintsov/) | Pexels License |
| `public/demo/tia-lupe-chalkboard/bean-cheese.jpg` | A bean and cheese burrito cut in half on a clay plate | https://www.pexels.com/photo/authentic-mexican-food-27603260/ | [Snappr](https://www.pexels.com/@snappr/) | Pexels License |
| `public/demo/tia-lupe-chalkboard/horchata.jpg` | A glass of iced horchata from above | https://www.pexels.com/photo/iced-coffee-and-wheat-bunch-on-cork-surface-37603065/ | [azra melek](https://www.pexels.com/@melek/) | Pexels License |
| `public/demo/tia-lupe-chalkboard/jarritos.jpg` | A glass of bright yellow fruit soda (no bottle, no label) | https://www.pexels.com/photo/clear-drinking-glass-with-yellow-liquid-12987271/ | [Srattha Nualsate](https://www.pexels.com/@srattha-nualsate-2695613/) | Pexels License |
| `public/demo/tia-lupe-chalkboard/agua-fresca-del-dia.jpg` | Glasses of colourful fruit juices on a plate | https://www.pexels.com/photo/vibrant-assortment-of-fresh-fruit-juices-31823004/ | [Allan González](https://www.pexels.com/@allanglezg/) | Pexels License |

## Ravi's Bike Repair (ravi-bike-repair)

<!-- ravi credits -->

## Example photo library (Part A3)

Real photos of common item types (`public/library/<id>.webp`, catalogue in `src/lib/library/catalog.ts`), shown as a labelled *example* until the seller adds their own photo. Every photo is under the [Pexels License](https://www.pexels.com/license/) (free to use, no attribution required; credited anyway). Each one was viewed before it went in: we kept only photos with no visible brand, logo, readable label or recognisable face, and dropped ones that did not clearly show the item (rejected: branded tyre sidewalls, a branded brake caliper, a branded kids' trike, engraved spanners, a branded churro basket liner, a glass jar with embossed lettering, labelled soda bottles). `guacamole-1` is a hand crop that leaves out a printed paper liner. Processing (with `sharp`): auto-rotated, metadata stripped, cover-cropped (attention strategy) to 800×600, WebP quality 74.

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
| `cookie-1` | Chocolate chip cookies on a baking tray | https://www.pexels.com/photo/close-up-view-of-cookies-with-chocolate-10243944/ | [Диана Дунаева](https://www.pexels.com/@1434506/) | Pexels License |
| `cookie-2` | A pile of oat and raisin cookies close up | https://www.pexels.com/photo/selective-focus-photography-of-chocolate-cookies-1775283/ | [Tina Nord](https://www.pexels.com/@nord6/) | Pexels License |
| `cookie-3` | Jam-filled heart and star shortbread cookies dusted with sugar | https://www.pexels.com/photo/heart-and-star-shaped-festive-christmas-cookies-40687778/ | [Ralf Ruppert](https://www.pexels.com/@ralf-ruppert-2165046205/) | Pexels License |
| `brownie-1` | A stack of brownies on a wooden plate beside a plant | https://www.pexels.com/photo/brownies-on-wooden-plate-near-green-plant-13072133/ | [Vija Rindo Pratama](https://www.pexels.com/@vjapratama/) | Pexels License |
| `brownie-2` | Two chocolate brownies stacked on a white plate | https://www.pexels.com/photo/delicious-chocolate-brownies-on-white-plate-30353753/ | [Giovanna Kamimura](https://www.pexels.com/@giovanna-kamimura-399616174/) | Pexels License |
| `brownie-3` | Marbled brownie squares on a cooling rack | https://www.pexels.com/photo/sweet-cake-with-chocolate-14565949/ | [Taha Samet Arslan](https://www.pexels.com/@tahaasamett/) | Pexels License |
| `coffee-1` | A cup of black coffee on a teal saucer, from above | https://www.pexels.com/photo/teal-ceramic-mug-on-saucer-1011292/ | [Julia Sakelli](https://www.pexels.com/@juliasakelli/) | Pexels License |
| `coffee-2` | A cup of coffee on a dark table scattered with coffee beans | https://www.pexels.com/photo/turkish-coffee-on-a-cup-11429424/ | [Hatice Esma DEMİREL](https://www.pexels.com/@esma98/) | Pexels License |
| `coffee-3` | A white cup of black coffee on a white saucer | https://www.pexels.com/photo/close-up-photo-of-cup-of-coffee-7542875/ | [Daniel Dan](https://www.pexels.com/@daniel-dan-47825192/) | Pexels License |
| `latte-1` | A latte with heart latte art in a blue cup and saucer | https://www.pexels.com/photo/cup-of-coffee-on-saucer-459489/ | [Pixabay](https://www.pexels.com/@pixabay/) | Pexels License |
| `latte-2` | A latte with rosetta art in a pink cup, from above | https://www.pexels.com/photo/top-view-of-latte-art-in-pink-cup-36094445/ | [Paul T.](https://www.pexels.com/@paul-t-2159274622/) | Pexels License |
| `latte-3` | Two lattes with latte art on a wooden table | https://www.pexels.com/photo/artistic-latte-art-on-wooden-cafe-table-37034128/ | [Yunus Tuğ](https://www.pexels.com/@yunustug/) | Pexels License |
| `tea-1` | A glass teapot of tea outdoors | https://www.pexels.com/photo/close-up-of-glass-teapot-with-tea-8329955/ | [Anna Pou](https://www.pexels.com/@anna-pou/) | Pexels License |
| `tea-2` | A bowl of green tea beside a red clay teapot | https://www.pexels.com/photo/aesthetic-japanese-teapot-with-green-tea-scene-35042573/ | [Travel with Lenses](https://www.pexels.com/@travel-with-lenses-734723610/) | Pexels License |
| `tea-3` | A small teapot and teacups on a table | https://www.pexels.com/photo/clear-glass-teapot-near-teacups-on-table-selective-focus-photography-219897/ | [Pixabay](https://www.pexels.com/@pixabay/) | Pexels License |
| `tea-4` | A cup of tea set down beside a white teapot and herbs | https://www.pexels.com/photo/a-hand-holding-a-saucer-with-cup-of-coffee-12898335/ | [Jana Ohajdova](https://www.pexels.com/@jankao/) | Pexels License |
| `lemonade-1` | Glasses of lemonade with lemon slices and straws | https://www.pexels.com/photo/a-clear-drinking-glass-with-lemon-juice-12931442/ | [beytlik](https://www.pexels.com/@beytlik/) | Pexels License |
| `lemonade-2` | A tall glass of lemonade by the sea | https://www.pexels.com/photo/drink-with-lemon-slice-12652901/ | [iam luisao](https://www.pexels.com/@iamluisao/) | Pexels License |
| `lemonade-3` | A glass of lemonade with a lemon slice on white | https://www.pexels.com/photo/a-close-up-shot-of-a-glass-of-lemonade-6411492/ | [César Guel](https://www.pexels.com/@cesar-guel-16870142/) | Pexels License |
| `lemonade-4` | Orange juice poured into a glass beside oranges | https://www.pexels.com/photo/photo-of-pouring-lemon-juice-into-a-glass-18490285/ | [Oben Kural](https://www.pexels.com/@obenkural/) | Pexels License |
| `agua-fresca-1` | Glasses of colourful fruit juices on a plate | https://www.pexels.com/photo/vibrant-assortment-of-fresh-fruit-juices-31823004/ | [Allan González](https://www.pexels.com/@allanglezg/) | Pexels License |
| `agua-fresca-2` | Three iced fruit drinks with straws on a board | https://www.pexels.com/photo/three-different-drinks-on-a-wooden-tray-with-straws-15523621/ | [JEFERSON GOMES](https://www.pexels.com/@jeferson-gomes-24831766/) | Pexels License |
| `agua-fresca-3` | A cup of iced watermelon drink with mint | https://www.pexels.com/photo/mint-leaves-garnished-on-a-fruit-juice-4871285/ | [ROMAN ODINTSOV](https://www.pexels.com/@roman-odintsov/) | Pexels License |
| `agua-fresca-4` | Two iced fruit drinks on a table | https://www.pexels.com/photo/refreshing-trio-of-colorful-fruit-juices-in-seattle-cafe-29990906/ | [Tiarra Sorte](https://www.pexels.com/@tiarrasorte/) | Pexels License |
| `horchata-1` | A glass of iced horchata from above | https://www.pexels.com/photo/iced-coffee-and-wheat-bunch-on-cork-surface-37603065/ | [azra melek](https://www.pexels.com/@melek/) | Pexels License |
| `horchata-2` | Horchata in a jar with rice and cinnamon on a small table | https://www.pexels.com/photo/cinnamon-rice-milk-with-raw-rice-on-wooden-table-34488752/ | [Omar Tapia](https://www.pexels.com/@omar-tapia-129681804/) | Pexels License |
| `soda-1` | A glass of cola with ice on a dark background | https://www.pexels.com/photo/glass-of-soda-with-ice-cubes-8880742/ | [Ron Lach](https://www.pexels.com/@ron-lach/) | Pexels License |
| `soda-2` | Cola being poured into a glass | https://www.pexels.com/photo/refreshing-splash-of-cola-in-glass-28948768/ | [Beyzanur K.](https://www.pexels.com/@thefullonmonet/) | Pexels License |
| `soda-3` | A glass of purple fizzy soda with ice | https://www.pexels.com/photo/a-glass-of-purple-drink-in-close-up-shot-12987520/ | [Srattha Nualsate](https://www.pexels.com/@srattha-nualsate-2695613/) | Pexels License |
| `taco-al-pastor-1` | Two al pastor tacos with cilantro and lime on a dark plate | https://www.pexels.com/photo/delicious-tacos-al-pastor-with-fresh-garnish-34289264/ | [Abner Velázquez](https://www.pexels.com/@abner-velazquez-1035709527/) | Pexels License |
| `taco-al-pastor-2` | Al pastor tacos with onion and cilantro beside a red salsa | https://www.pexels.com/photo/cooked-food-on-brown-wooden-tray-7388095/ | [Amy Farías](https://www.pexels.com/@amfaru/) | Pexels License |
| `taco-al-pastor-3` | A plate of four street tacos on a red checked cloth | https://www.pexels.com/photo/homemade-tacos-on-a-table-17429140/ | [Jonathan Reynaga](https://www.pexels.com/@jonathan-reynaga-861774/) | Pexels License |
| `taco-chicken-1` | Chicken tacos with slaw and lime on a blue plate | https://www.pexels.com/photo/a-mouthwatering-tacos-on-a-ceramic-plate-7041784/ | [Styves Exantus](https://www.pexels.com/@styves-exantus-7162424/) | Pexels License |
| `taco-chicken-2` | Crispy chicken tacos on a plate | https://www.pexels.com/photo/close-up-of-tacos-15801925/ | [Eduardo Krajan](https://www.pexels.com/@eduardo-krajan-424982200/) | Pexels License |
| `taco-chicken-3` | A chicken taco with pickled onion and salsa on a board | https://www.pexels.com/photo/cooked-food-on-brown-wooden-tray-4958774/ | [ROMAN ODINTSOV](https://www.pexels.com/@roman-odintsov/) | Pexels License |
| `taco-mushroom-1` | Blue corn veggie tacos with avocado and pickled onion | https://www.pexels.com/photo/delicious-tacos-with-fresh-guacamole-and-cilantro-36498698/ | [DΛVΞ GΛRCIΛ](https://www.pexels.com/@davegarcia/) | Pexels License |
| `taco-mushroom-2` | Vegetable tacos with lime and chilli flakes, from above | https://www.pexels.com/photo/cooked-food-on-the-table-4958522/ | [ROMAN ODINTSOV](https://www.pexels.com/@roman-odintsov/) | Pexels License |
| `taco-mushroom-3` | A veggie taco on a small plate | https://www.pexels.com/photo/scrumptious-tacos-on-a-plate-5848703/ | [Polina Tankilevitch](https://www.pexels.com/@polina-tankilevitch/) | Pexels License |
| `taco-carnitas-1` | Close-up of shredded meat tacos with onion and cilantro | https://www.pexels.com/photo/mouthwatering-tacos-in-macro-shot-photography-5454019/ | [Jeswin Thomas](https://www.pexels.com/@jeswin/) | Pexels License |
| `taco-carnitas-2` | A carnitas taco with crumbled cheese on a blue plate | https://www.pexels.com/photo/authentic-mexican-food-27603306/ | [Snappr](https://www.pexels.com/@snappr/) | Pexels License |
| `taco-carnitas-3` | Meat tacos with onion and cilantro on a stone plate | https://www.pexels.com/photo/close-up-photograph-of-a-plate-with-tacos-3264572/ | [Chitokan C.](https://www.pexels.com/@chitokan/) | Pexels License |
| `taco-carnitas-4` | Two meat tacos on a patterned clay plate | https://www.pexels.com/photo/authentic-mexican-food-27603257/ | [Snappr](https://www.pexels.com/@snappr/) | Pexels License |
| `burrito-1` | A large burrito cut open showing rice, chicken and peppers | https://www.pexels.com/photo/sushirrito-cut-in-half-5337516/ | [ROMAN ODINTSOV](https://www.pexels.com/@roman-odintsov/) | Pexels License |
| `burrito-2` | A bean and cheese burrito cut in half on a clay plate | https://www.pexels.com/photo/authentic-mexican-food-27603260/ | [Snappr](https://www.pexels.com/@snappr/) | Pexels License |
| `burrito-3` | A grilled burrito cut in half with fries on a blue plate | https://www.pexels.com/photo/tortilla-wrap-and-fries-on-a-plate-14866628/ | [Nadin Sh](https://www.pexels.com/@nadin-sh-78971847/) | Pexels License |
| `burrito-4` | Two halves of a burrito on a tray with dipping sauces | https://www.pexels.com/photo/delicious-breakfast-burrito-with-salsa-and-sour-cream-29333173/ | [Connor Scott McManus](https://www.pexels.com/@connorscottmcmanus/) | Pexels License |
| `quesadilla-1` | Quesadilla wedges with salsa and dips | https://www.pexels.com/photo/bread-and-sauces-on-plate-5836439/ | [ROMAN ODINTSOV](https://www.pexels.com/@roman-odintsov/) | Pexels License |
| `quesadilla-2` | Quesadilla triangles on a white platter with a dip | https://www.pexels.com/photo/delicious-cheese-quesadillas-with-salsa-and-dip-28443135/ | [Tiwi Riders](https://www.pexels.com/@tiwi-riders-1256368688/) | Pexels License |
| `quesadilla-3` | Grilled quesadillas with a cream drizzle close up | https://www.pexels.com/photo/close-up-shot-of-a-delicious-dish-5836442/ | [ROMAN ODINTSOV](https://www.pexels.com/@roman-odintsov/) | Pexels License |
| `guacamole-1` | Guacamole in a stone molcajete with tortilla chips | https://www.pexels.com/photo/authentic-mexican-food-27603308/ | [Snappr](https://www.pexels.com/@snappr/) | Pexels License |
| `guacamole-2` | A bowl of guacamole with tortilla chips on white | https://www.pexels.com/photo/a-flatlay-of-chips-beside-a-bowl-of-guacamole-7227467/ | [Suzy Hazelwood](https://www.pexels.com/@suzyhazelwood/) | Pexels License |
| `guacamole-3` | Guacamole in a wooden bowl with tortilla chips | https://www.pexels.com/photo/tortilla-crisps-with-vegetables-7613677/ | [Los Muertos Crew](https://www.pexels.com/@cristian-rojas/) | Pexels License |
| `guacamole-4` | A platter of tortilla chips with guacamole and dips | https://www.pexels.com/photo/tortilla-chips-with-choice-of-dips-6399996/ | [alleksana](https://www.pexels.com/@alleksana/) | Pexels License |
| `salsa-1` | A bowl of red salsa with tortilla chips | https://www.pexels.com/photo/delicious-tortilla-chips-with-fresh-salsa-28956908/ | [Janine Speidel](https://www.pexels.com/@janine-speidel-1933619854/) | Pexels License |
| `salsa-2` | Tortilla chips beside a bowl of dark salsa | https://www.pexels.com/photo/a-close-p-photo-of-nachos-and-salsa-7613435/ | [Los Muertos Crew](https://www.pexels.com/@cristian-rojas/) | Pexels License |
| `salsa-3` | Tortilla chips with small bowls of salsa and peppers | https://www.pexels.com/photo/nachos-and-peppers-flat-lay-with-dip-39799125/ | [Jahra Tasfia Reza](https://www.pexels.com/@jahratreza/) | Pexels License |
| `elote-1` | Mexican street corn with cheese and chilli | https://www.pexels.com/photo/mexican-food-on-plate-6133872/ | [Daniela Velarde](https://www.pexels.com/@daniela-velarde-3787727/) | Pexels License |
| `elote-2` | An elote covered in cheese on a clay plate | https://www.pexels.com/photo/authentic-mexican-food-27626495/ | [Snappr](https://www.pexels.com/@snappr/) | Pexels License |
| `elote-3` | Two grilled corn cobs in a bowl, from above | https://www.pexels.com/photo/elotes-asados-27551936/ | [Leonardo Aquino](https://www.pexels.com/@leonardo-aquino-246345118/) | Pexels License |
| `elote-4` | Grilled corn with chilli sauce and lime | https://www.pexels.com/photo/corn-and-lime-17582268/ | [J E](https://www.pexels.com/@j-e-22471780/) | Pexels License |
| `rice-beans-1` | Mexican rice and black beans with cheese on a clay plate | https://www.pexels.com/photo/authentic-mexican-food-27603315/ | [Snappr](https://www.pexels.com/@snappr/) | Pexels License |
| `rice-beans-2` | A steaming plate of rice and beans | https://www.pexels.com/photo/close-up-shot-of-rice-on-a-plate-9700896/ | [Zig Fotografia](https://www.pexels.com/@zig-fotografia-102048118/) | Pexels License |
| `rice-beans-3` | Bowls of rice, beans and stew from above | https://www.pexels.com/photo/meals-in-frying-pans-on-wooden-table-19781592/ | [Lucas Andrade](https://www.pexels.com/@lucasandrade/) | Pexels License |
| `flan-1` | A caramel flan topped with a prune | https://www.pexels.com/photo/delicious-flan-with-caramel-and-prune-topping-36616786/ | [Caio Niceas](https://www.pexels.com/@caio-niceas-2148806704/) | Pexels License |
| `flan-2` | A small flan with caramel sauce on a white plate | https://www.pexels.com/photo/delicious-caramel-flan-with-mint-garnish-on-white-plate-33674417/ | [pedro furtado](https://www.pexels.com/@pedrofurtadoo/) | Pexels License |
| `flan-3` | A flan with cream in a glass dish | https://www.pexels.com/photo/a-delicious-dessert-in-a-bowl-8911292/ | [SpotwizardLee](https://www.pexels.com/@spotwizardlee-35777904/) | Pexels License |
| `churros-1` | Churros in a paper cone with chocolate sauce | https://www.pexels.com/photo/delicious-churros-with-chocolate-dip-on-plate-36361401/ | [Çiğdem Bilgin](https://www.pexels.com/@cigdem-bilgin-2154409770/) | Pexels License |
| `ice-cream-1` | Scoops of berry and chocolate ice cream on a wooden tray | https://www.pexels.com/photo/gourmet-ice-cream-assortment-on-wooden-plate-37696167/ | [Max Parada](https://www.pexels.com/@max-parada-2653378/) | Pexels License |
| `ice-cream-2` | Bowls of vanilla and chocolate ice cream | https://www.pexels.com/photo/close-up-of-scoops-of-ice-cream-in-bowls-7491892/ | [minchephoto photography](https://www.pexels.com/@minchephoto/) | Pexels License |
| `ice-cream-3` | A double scoop ice cream cone held up | https://www.pexels.com/photo/person-holding-chocolate-ice-cream-cone-126790/ | [Markus Spiske](https://www.pexels.com/@markusspiske/) | Pexels License |
| `ice-cream-4` | Pink and yellow ice cream scoops in a white dish | https://www.pexels.com/photo/ice-cream-on-a-bowl-with-spoon-13010794/ | [NGSOFT IT](https://www.pexels.com/@ngsoft/) | Pexels License |
| `sandwich-1` | A toasted sandwich cut in half with picks | https://www.pexels.com/photo/a-close-up-shot-of-a-sliced-sandwich-8478395/ | [Sergey Meshkov](https://www.pexels.com/@19x14/) | Pexels License |
| `sandwich-2` | Toasted pressed sandwiches stacked on a rack | https://www.pexels.com/photo/close-up-shot-of-sandwiches-8023677/ | [Mateusz Feliksik](https://www.pexels.com/@mateusz-feliksik-1896604/) | Pexels License |
| `sandwich-3` | A sandwich with salad leaves beside a glass of coffee | https://www.pexels.com/photo/clear-glass-cup-on-brown-wooden-surface-263103/ | [Pixabay](https://www.pexels.com/@pixabay/) | Pexels License |
| `salad-1` | A salad bowl with beans, corn and cheese | https://www.pexels.com/photo/cooked-food-on-white-ceramic-plate-6065181/ | [Alesia Kozik](https://www.pexels.com/@alesiakozik/) | Pexels License |
| `salad-2` | A mixed salad in a dark bowl | https://www.pexels.com/photo/fresh-mixed-salad-with-cherry-tomatoes-and-nuts-33323285/ | [Aleson Padilha](https://www.pexels.com/@aleson-padilha-945919991/) | Pexels License |
| `salad-3` | A green salad in a bowl | https://www.pexels.com/photo/round-stainless-steel-bowl-with-cooked-meat-and-vegetables-842545/ | [Valeria Boltneva](https://www.pexels.com/@valeriya/) | Pexels License |
| `soup-1` | Bowls of pumpkin and cream soup with bread | https://www.pexels.com/photo/close-up-shot-of-soup-in-a-bowl-beside-a-bread-7780032/ | [Denys Gromov](https://www.pexels.com/@jdgromov/) | Pexels License |
| `soup-2` | A bowl of tomato soup with croutons on a tray | https://www.pexels.com/photo/a-yellow-soup-decorated-with-leaves-in-a-bowl-beside-a-bowl-of-croutons-8743888/ | [Farhad Ibrahimzade](https://www.pexels.com/@farhad/) | Pexels License |
| `soup-3` | A bowl of orange soup with herbs | https://www.pexels.com/photo/a-soup-in-white-ceramic-bowl-13422406/ | [Mateusz Feliksik](https://www.pexels.com/@mateusz-feliksik-1896604/) | Pexels License |
| `bike-tire-1` | Hands pumping up a mountain bike tyre | https://www.pexels.com/photo/a-man-pumping-air-into-the-bike-tire-8926730/ | [Anastasia Shuraeva](https://www.pexels.com/@anastasia-shuraeva/) | Pexels License |
| `bike-tire-2` | A chunky bicycle tyre on gravel, close up | https://www.pexels.com/photo/flat-tire-of-a-motorcycle-8718524/ | [Erik Mclean](https://www.pexels.com/@introspectivedsgn/) | Pexels License |
| `bike-tire-3` | Hands working on a mountain bike tyre | https://www.pexels.com/photo/photo-of-a-man-s-hands-fixing-a-bike-tire-8926729/ | [Anastasia Shuraeva](https://www.pexels.com/@anastasia-shuraeva/) | Pexels License |
| `bike-chain-1` | A bicycle chainring, chain and pedal close up | https://www.pexels.com/photo/close-up-photo-of-chain-link-on-sprocket-5235164/ | [hans middendorp](https://www.pexels.com/@hansmiddendorp/) | Pexels License |
| `bike-chain-2` | An old bike's chain and pedal by a river bed | https://www.pexels.com/photo/black-and-brown-bicycle-wheel-6578133/ | [Chris K](https://www.pexels.com/@chris-k-13634249/) | Pexels License |
| `bike-brakes-1` | Flat handlebars with brake levers, close up | https://www.pexels.com/photo/black-and-blue-bicycle-handle-bar-210893/ | [Markus Spiske](https://www.pexels.com/@markusspiske/) | Pexels License |
| `bike-brakes-2` | A bicycle brake lever on a handlebar with brown grips | https://www.pexels.com/photo/vintage-bicycle-handlebar-detail-with-stone-wall-30901555/ | [Markus Winkler](https://www.pexels.com/@markus-winkler-1430818/) | Pexels License |
| `bike-brakes-3` | Road bike handlebars with brake levers and cables | https://www.pexels.com/photo/black-and-silver-bluetooth-earphones-1081031/ | [Markus Spiske](https://www.pexels.com/@markusspiske/) | Pexels License |
| `bike-wheel-1` | A bicycle wheel leaning on a wooden wall | https://www.pexels.com/photo/vintage-bicycle-wheel-on-wooden-wall-35167164/ | [Marek Ruczaj](https://www.pexels.com/@marek-ruczaj-1534625/) | Pexels License |
| `bike-wheel-2` | A bicycle front hub and spokes close up | https://www.pexels.com/photo/close-up-of-wet-bicycle-wheel-with-red-frame-36398681/ | [Brent Singleton](https://www.pexels.com/@brentsingletonphoto/) | Pexels License |
| `bike-wheel-3` | A bicycle rear wheel and derailleur | https://www.pexels.com/photo/close-up-photograph-of-a-bicycle-wheel-4828817/ | [Ivan S](https://www.pexels.com/@ivan-s/) | Pexels License |
| `bike-repair-1` | A hand tightening a wheel nut with a spanner | https://www.pexels.com/photo/person-holding-box-end-wrench-1154089/ | [Julia Schmidt](https://www.pexels.com/@julia-schmidt-431283/) | Pexels License |
| `bike-repair-2` | Bicycles with saddles up on a repair stand in a workshop | https://www.pexels.com/photo/bike-business-close-up-daylight-545000/ | [Burst](https://www.pexels.com/@burst/) | Pexels License |
| `bike-repair-3` | A road bike in a workshop with tools on the wall | https://www.pexels.com/photo/black-road-bicycle-inside-room-132682/ | [Alexander Dummer](https://www.pexels.com/@alexander-dummer-37646/) | Pexels License |
| `bike-repair-4` | Bicycles hanging in a repair workshop window | https://www.pexels.com/photo/bicycle-workshop-view-through-amsterdam-window-31452612/ | [Mathias Reding](https://www.pexels.com/@matreding/) | Pexels License |
| `kids-bike-1` | A small child in a helmet riding a balance bike on grass | https://www.pexels.com/photo/young-child-riding-balance-bike-at-park-31332929/ | [Sarla's Eye Photography](https://www.pexels.com/@sarla-s-eye-photography-2150399839/) | Pexels License |
| `kids-bike-2` | A small pink children's bike with a basket | https://www.pexels.com/photo/colorful-children-s-bicycle-in-urban-park-setting-34878695/ | [Sóc Năng Động](https://www.pexels.com/@soc-nang-d-ng-2150345854/) | Pexels License |
| `kids-bike-3` | Two children's bikes against a blue door | https://www.pexels.com/photo/children-s-bicycles-in-front-of-blue-garage-door-28506741/ | [Jan van der Wolf](https://www.pexels.com/@jan-van-der-wolf-11680885/) | Pexels License |
| `hand-tools-1` | Spanners laid out in a circle on a dark surface | https://www.pexels.com/photo/close-up-shot-of-assorted-wrenches-6789021/ | [Dmitry Demidov](https://www.pexels.com/@dmitry-demidov-515774/) | Pexels License |
| `hand-tools-2` | Steel spanners close up on a dark surface | https://www.pexels.com/photo/close-up-shot-of-assorted-wrenches-6789020/ | [Dmitry Demidov](https://www.pexels.com/@dmitry-demidov-515774/) | Pexels License |
| `hand-tools-3` | A heap of assorted hand tools | https://www.pexels.com/photo/close-up-shot-of-assorted-tools-5194769/ | [Şahin Sezer Dinçer](https://www.pexels.com/@sahinsezerdincer/) | Pexels License |
| `ceramics-1` | Stacked terracotta and white ceramic mugs and plates | https://www.pexels.com/photo/ceramic-cups-and-plates-6611421/ | [Yan Krukau](https://www.pexels.com/@yankrukov/) | Pexels License |
| `ceramics-2` | Speckled white handmade cups and bowls | https://www.pexels.com/photo/close-up-of-handmade-pottery-on-table-6611426/ | [Yan Krukau](https://www.pexels.com/@yankrukov/) | Pexels License |
| `ceramics-3` | Handmade cream stoneware mugs and vases on a shelf | https://www.pexels.com/photo/display-of-clay-mugs-8063803/ | [ROMAN ODINTSOV](https://www.pexels.com/@roman-odintsov/) | Pexels License |
| `candle-1` | Lit cream pillar candles on a dark background | https://www.pexels.com/photo/yellow-candles-on-black-surface-8617327/ | [Pedro Nollet-Sumida](https://www.pexels.com/@pedro-nollet-sumida-76906080/) | Pexels License |
| `candle-2` | Lit orange candles on a dark background | https://www.pexels.com/photo/assorted-candles-glowing-in-the-dark-39853162/ | [Jahra Tasfia Reza](https://www.pexels.com/@jahratreza/) | Pexels License |
| `candle-3` | Pillar candles, one with a red pattern, lit on a table | https://www.pexels.com/photo/a-red-and-white-lighted-candles-14284269/ | [Aliaksei Semirski](https://www.pexels.com/@asemirski/) | Pexels License |
| `soap-1` | A stack of handmade soap bars | https://www.pexels.com/photo/stack-of-natural-soaps-placed-on-table-6621497/ | [Monstera Production](https://www.pexels.com/@gabby-k/) | Pexels License |
| `soap-2` | A row of marbled handmade soap bars on a towel | https://www.pexels.com/photo/a-variety-of-artisanal-soaps-7173554/ | [Sydnee More](https://www.pexels.com/@sydnee-more-30355262/) | Pexels License |
| `soap-3` | Handmade soap bars in a wicker tray with eucalyptus | https://www.pexels.com/photo/green-leaves-and-soaps-on-brown-woven-basket-10155373/ | [Feyza Yıldırım](https://www.pexels.com/@feyzayildirimphoto/) | Pexels License |
| `plant-1` | Potted succulents in terracotta pots | https://www.pexels.com/photo/colorful-succulent-arrangement-in-pots-36620948/ | [Natalia Sevruk](https://www.pexels.com/@natalia-sevruk-636238602/) | Pexels License |
| `plant-2` | A flowering succulent in a white pot | https://www.pexels.com/photo/close-up-of-plants-with-delicate-flowers-in-the-pots-25462388/ | [성진 김](https://www.pexels.com/@593117282/) | Pexels License |
| `plant-3` | Small potted plants on a window sill | https://www.pexels.com/photo/potted-plants-on-window-sill-19770575/ | [Michaela St](https://www.pexels.com/@michaela-st-3448542/) | Pexels License |
| `tote-1` | A plain white canvas tote bag held out at arm's length | https://www.pexels.com/photo/a-person-holding-a-tote-bag-6787035/ | [Artem Podrez](https://www.pexels.com/@artempodrez/) | Pexels License |
| `tote-2` | A rainbow-striped canvas tote bag carried on the shoulder | https://www.pexels.com/photo/a-person-holding-a-rainbow-tote-bag-8669455/ | [Mikhail Nilov](https://www.pexels.com/@mikhail-nilov/) | Pexels License |
| `tote-3` | A patterned canvas tote bag carried on the shoulder | https://www.pexels.com/photo/side-view-of-a-person-walking-with-a-tote-bag-7735446/ | [Duygu Dolanbay](https://www.pexels.com/@duygu-dolanbay-49216457/) | Pexels License |

## Home page photographs (`public/demo/home/`)

All under the [Pexels License](https://www.pexels.com/license/), resized and compressed to WebP. No visible brand, label or face.

| File | Shows | Pexels page | Processing | Licence |
|---|---|---|---|---|
| `hero.webp` | A bakery display case of croissants and pastries | https://www.pexels.com/photo/19498989/ (Valeria Boltneva, the same source as `public/samples/counter-case.jpg`) | Cropped, heavily blurred, brightened | Pexels License |
| `closing.webp` | A row of frosted cupcakes on a counter | https://www.pexels.com/photo/photo-of-cupcakes-1028704/ (Acharaporn Kamornboonyarush) | Cropped, saturation raised | Pexels License |
| `cupcake.webp` | A cupcake topped with a raspberry | https://www.pexels.com/photo/photograph-of-chocolate-cupcake-with-red-strawberry-toppings-1055272/ | Cropped square | Pexels License |

## How it works step images (`public/landing/`)

Our own screenshots of Shelfie, not third-party assets, except step 1: `step-read.webp` is the handwritten price list photo below, alone. Then `step-order.webp` (the demo shop's assistant panel: its create_order call, reply and Approve on PayPal card, replayed turns; the "Tell me once you've approved" line is cut out) and `step-paid.webp` (the seller's paid order header and its AI brief). Taken with Playwright at device scale 2 and a 500 px viewport on the e2e database (seeded demo shop, labelled fixture orders, fake PayPal ids), cropped to one focal region of about 480 CSS px and saved as 960×720 WebP (q80) with sharp. Food photos inside them are the demo shop's (credited above). No owner links, tokens or emails are in frame.

## Handwritten price list photo (`public/landing/paper-menu.webp`, step 1, video)

A real photograph, chosen in run 8 over five other Pexels/Unsplash candidates (`docs/judge/menu-photo-r8.md`). No brand, logo or face is in frame; the café is not named anywhere in it.

| File | Shows | Source | Processing | Licence |
|---|---|---|---|---|
| `public/landing/paper-menu.webp` (480×640) | A handwritten coffee price list in black ink on cream paper (Americano 4.0, Caffe Latte 4.5, ...) | Photo by Bundo Kim on Unsplash, https://unsplash.com/photos/white-printer-paper-CWxfAzPs2T8 (file `images.unsplash.com/photo-1557633405-a29f480936d5`) | Cropped 3:4 to the right-hand sheet, CLAHE to even out the hard window light, brightness +35%, WebP q74 | [Unsplash License](https://unsplash.com/license) |
| `public/landing/step-read.webp` (960×720) | The same sheet, wider | Same photo | Cropped 4:3, same toning, nothing drawn on top, WebP q74 | Unsplash License |
| `video/project/assets/paper-menu.jpg` (1920×1080) | Both sheets of the same list, full frame for the demo video | Same photo | Cropped 16:9, gentler CLAHE, JPEG q84 | Unsplash License |
| `video/project/assets/slides/menu-photo.jpg` (480×640) | The title slide's first chain card | Same photo | `public/landing/paper-menu.webp` re-encoded as JPEG | Unsplash License |

