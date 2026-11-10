# A real paper menu for the home page (run 8)

The owner asked for "a real menu written on paper instead of AI gen image" for the hero chain's first card and How it works step 1. The brief: a licensed photo (Pexels or Unsplash licence only) of a handwritten paper menu or price list, black marker or ink on cream or off-white paper, items with prices beside them, legible, warm, no brand names, faces or trademarks. The owner's style reference was used as inspiration only and is not in the repo.

Searched: Pexels "handwritten menu", "handwritten price list", "paper menu", "handwritten menu paper", "handwritten list notebook", "menu clipboard", "handwritten menu bakery", "hand written menu on paper", "menu written by hand", "handwritten coffee menu"; Unsplash "handwritten-menu", "hand-written-menu", "paper-menu", "handwritten-price-list", "menu-handwritten", "handwritten-cafe-menu". About 140 results screened from thumbnails; most were chalkboards, printed menus or blank clipboards. Six real candidates were downloaded (`/tmp/menu-cands/1..6`) and compared side by side in `docs/judge/menu-candidates.jpg`.

| # | Photo | Photographer | Licence | One line |
|---|---|---|---|---|
| 1 | https://unsplash.com/photos/white-printer-paper-CWxfAzPs2T8 | Bundo Kim (@bundo) | Unsplash License (page: "Free to use under the Unsplash License") | A handwritten coffee price list in black ink on cream paper, prices beside each item (Americano 4.0, Caffe Latte 4.5), taped notes, warm window light. **Picked.** |
| 2 | https://www.pexels.com/photo/vintage-style-cafe-menu-with-floral-design-32481981/ | peterdanthy (Pexels) | Pexels License | A beautiful hand-lettered menu with ink doodles on kraft paper, but in Vietnamese, very dense and hung with a big ribbon: unreadable at card size. |
| 3 | https://unsplash.com/photos/white-printer-paper-on-brown-wooden-table-jDPwHvkkwT0 | Nguyen Dang Hoang Nhu | Unsplash License | A handwritten Vietnamese tea list on a clipboard on a dark table; the heading reads as the place's name and the prices are tiny. |
| 4 | https://www.pexels.com/photo/menu-on-grey-paper-on-cafe-wall-and-leaflets-in-baskets-5864222/ | Rachel Claire | Pexels License | A kraft-paper roll menu on a café wall; the writing is too small and the frame is mostly wall. |
| 5 | https://www.pexels.com/photo/close-up-of-writing-on-a-notebook-8716167/ | Katya Wolf | Pexels License | A hand writing an ingredients list in gold pen; a list, not a menu, no prices, and the hand dominates. |
| 6 | https://www.pexels.com/photo/hand-written-checklist-16791349/ | Alina Rossoshanska | Pexels License | A handwritten checklist in warm light; blurred, faint blue ink, no prices. |

Pexels photographer names for 2 and 4 to 6 are as shown on their pages' download names; only the pick's licence page was checked in full.

**Pick: 1 (Bundo Kim).** It is the closest to the reference's qualities: a casual, real, hand-written list in black ink on cream paper with a price beside every item, in English, with nothing that names the café. It is shot at an angle in a dark room rather than from above, and it has no doodles; the hard window light is evened out with CLAHE so the ink reads at the hero card's ~230 px. Crops: 3:4 on the right-hand sheet for the hero card (`public/landing/paper-menu.webp`), 4:3 under Shelfie's "We read" card for step 1 (`public/landing/step-read.webp`), 16:9 full frame for the video (`video/project/assets/paper-menu.jpg`). Credits in `docs/ASSETS.md`.
