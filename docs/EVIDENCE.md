# Evidence for the Shelfie pitch

All sources were fetched on 2026-11-05.

## Safe to say in the pitch

1. PayPal launched Agent Ready for "the millions of existing PayPal merchants", and Store Sync makes merchants' "product catalogs" discoverable through integrations with Wix, Cymbio, BigCommerce/Feedonomics and Shopware (PayPal newsroom, 28 Oct 2025).
2. PayPal's WebMCP agent checkout "is limited to Store Sync customers today", for merchants "using their existing website storefronts" (PayPal Developer blog, 16 Sep 2026).
3. PayPal plans to bring "the product catalogs of small businesses" to ChatGPT in 2026 (PayPal newsroom, 28 Oct 2025).
4. In PayPal's survey of 498 US merchants (Feb–Mar 2026), almost 95% report at least partial visibility of AI-agent traffic, but only about one in five have 80% or more of their catalog as structured, machine-readable data (PayPal Agentic Commerce Pulse Report, 27 Apr 2026).
5. 45% of US employer firms reported having no website, and 47% in accommodation and food services (Census Bureau, Annual Survey of Entrepreneurs, data year 2016).
6. The US had 12,487 food truck and cart businesses with paid staff in 2023 (Census County Business Patterns, NAICS 722330).
7. USDA listed 8,771 farmers markets in 2019 (USDA AMS directory).
8. Among 775 surveyed cottage food producers, 83% were women, median sales were $2,000 a year, and only 15% sold online or by phone (Institute for Justice, *Flour Power*, 2017).

## Detail

| # | Claim | Date | Source | Verdict |
|---|---|---|---|---|
| 1a | Agent ready "instantly unlocks for the millions of existing PayPal merchants the ability to accept payments on AI surfaces"; it "will become available in early 2026". | 28 Oct 2025 | https://newsroom.paypal-corp.com/2025-10-28-PayPal-Launches-Agentic-Commerce-Services-to-Power-AI-Driven-Shopping | Verified (primary) |
| 1b | "Merchants' product catalogs will seamlessly become discoverable and purchasable through integrations with our strategic partners Wix, Cymbio, Commerce (BigCommerce & Feedonomics), and Shopware." Footnote: "Check with your e-commerce solution provider about availability." | 28 Oct 2025 | same | Verified (primary) |
| 1c | Agent Ready is a "Simple integration built on your existing PayPal account". Store Sync: "Sign up to speak to our sales team". | current | https://paypal.ai/ | Verified (primary) |
| 1d | Store Sync merchants live on Copilot and Perplexity: "Abercrombie & Fitch, Fabletics, Ashley Furniture, Newegg, and Adorama". | 22 Jan 2026 | https://newsroom.paypal-corp.com/2026-01-22-PayPal-to-Acquire-Cymbio,-Accelerating-Agentic-Commerce-Capabilities | Verified (primary) |
| 1e | "While this capability is limited to Store Sync customers today..."; "...using their existing website storefronts." | 16 Sep 2026 | https://developer.paypal.com/community/blog/WebMCP_PayPal_Agent_Ready/ (quoted from a rendered fetch) | Verified (primary) |
| 1f | "ACP will bring in 2026 the product catalogs of small businesses ... via PayPal's ACP server". | 28 Oct 2025 | https://newsroom.paypal-corp.com/2025-10-28-OpenAI-and-PayPal-Team-Up-to-Power-Instant-Checkout-and-Agentic-Commerce-in-ChatGPT | Verified (primary) |
| 2 | "almost 95% reporting at least partial visibility" (only "nearly half" actively track it); "Only about one in five have 80% or more of their product catalog available as structured, machine-readable data." Online survey of 498 US merchants, 23 Feb – 3 Mar 2026. | 27 Apr 2026 | https://www.paypal.com/us/brc/article/agentic-commerce-pulse-report-findings | Verified (primary). It's an article, not a newsroom release. Say "at least partial visibility", not "see agent traffic". There is no small-business breakdown. The page's segment sizes (166 + 243 + 189) add up to 598, not 498. |
| 3a | 1,569,461 of 3,484,503 reporting employer firms (45.0%) "did not have a website". Food services: 47.2%. Sample of about 290,000 firms. | data 2016 | Census ASE table SE1600CSCB22, https://www2.census.gov/programs-surveys/ase/data/2016/SE1600CSCB22.zip | Verified (primary). The data is old, and one-person firms are excluded. |
| 3b | "83% of small businesses now have a website ... 17% remain offline". | 21 Aug 2025 | https://clutch.co/press-releases/smb-websites-2025 | Primary but weak: no sample, dates or country, and the full report link is 404. |
| 4a | 12,487 mobile food services (NAICS 722330) employer establishments, 10,062 of them with fewer than 5 staff. | 2023 | https://www2.census.gov/programs-surveys/cbp/datasets/2023/cbp23us.zip | Verified (primary). Trucks with no employees are excluded, and the Census publishes no food-truck-only count for them. |
| 4b | 8,771 farmers market listings, "voluntary and self-reported". | 2019 | https://www.ams.usda.gov/sites/default/files/media/NationalCountofFarmersMarketDirectoryListings082019.pdf | Verified (primary). Counts markets, not vendors. |
| 4c | 25,418 registered cottage food producers in the 25 states sampled. No national count. | 2017 | https://ij.org/wp-content/uploads/2017/12/Cottage-Foods-Report-Sep-2018.pdf | Verified (primary) |
| 5a | Sales venues: farmers markets 49%, home 33%, online/by phone 15%. n=775, phone survey, Mar–Apr 2017. | 2017 | same IJ report, Figure 9 | Verified (primary) |
| 5b | Sellers take orders by DM or phone and lose money to no-shows. | — | — | Not found (no credible US source) |

## Measured: photo → live shop (2026-11-06)

Model `claude-sonnet-5-5`, real PayPal sandbox Catalog, production build (`next build` + `next start`), 2 runs per sample (6 runs total). Machine time only: a seller's own review time is extra.

| Photo | Run | Items read | Flagged | Removed (duplicates) | In person only | Reading | Published to PayPal | Publish | Total | Shop |
|---|---|---|---|---|---|---|---|---|---|---|
| marigold-bakehouse.jpg | 1 | 10 | 4 | 0 | 1 | 9.4 s | 9 | 3.7 s | 13.5 s | live |
| marigold-bakehouse.jpg | 2 | 10 | 4 | 0 | 1 | 9.1 s | 9 | 2.9 s | 12.1 s | live |
| tia-lupe-chalkboard.jpg | 1 | 11 | 1 | 0 | 1 | 9.2 s | 10 | 2.5 s | 11.9 s | live |
| tia-lupe-chalkboard.jpg | 2 | 11 | 1 | 0 | 1 | 8.9 s | 10 | 1.9 s | 10.9 s | live |
| ravi-bike-repair.jpg | 1 | 7 | 2 | 0 | 0 | 6.5 s | 7 | 1.5 s | 8.1 s | live |
| ravi-bike-repair.jpg | 2 | 7 | 2 | 0 | 0 | 6.5 s | 7 | 2.4 s | 8.9 s | live |

Range: 8 to 14 s from upload to live, of which reading is 6.5 to 9.4 s and publishing 1.5 to 3.7 s. Removed and in-person counts come from the run databases (item status after publish): no duplicates were removed in any run, and one item per Marigold and Tía Lupe menu was in person only (items read = published + in person only + removed).

How it was measured: `scripts/measure-photo-to-live.ts` uploads each photo to `POST /api/shops` (not the recorded sample path), runs `POST /extract` (real Claude), resolves every flagged item through `PATCH /items` the way a seller would (fills a missing or market price with $5.00, keeps the first of any duplicate pair, confirms CHECK items), then `POST /publish` and waits for the shop to go `live`. Total includes shop creation and the resolving call, which take well under a second. The app ran with a throwaway `DATABASE_PATH` under `data/measure/`.

The six runs created 52 real sandbox Catalog products (9+9+10+10+7+7). A seller's own prices replace the $5.00 fill used here for missing or market prices; prices stay in Shelfie and are not sent to PayPal's catalog.
