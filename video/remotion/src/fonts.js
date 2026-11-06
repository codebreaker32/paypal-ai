import { continueRender, delayRender } from "remotion";
import { FIGTREE_WOFF2 } from "./fonts/figtree-woff2.js";

/**
 * Figtree (SIL Open Font License 1.1, src/fonts/OFL.txt), embedded in the bundle
 * as data: URIs in an @font-face stylesheet: no Google Fonts request and no
 * fetch from the render server.
 *
 * Call ensureFigtree() from a component (DemoVideo does), NOT at module top
 * level: the bundle holds two copies of `remotion` (the ESM build, and the
 * CommonJS one @remotion/transitions requires), and the second one to load
 * empties window.remotion_delayRenderHandles. A handle taken at module level
 * was dropped that way, so its continueRender() never cleared its timeout and
 * the render failed after the delayRender timeout, every time.
 */
const MAX_WAIT_MS = 8000;
let started = false;

export function ensureFigtree() {
  if (started || typeof document === "undefined") return;
  started = true;
  const weights = Object.keys(FIGTREE_WOFF2);
  const style = document.createElement("style");
  style.id = "figtree-faces";
  style.textContent = weights
    .map(
      (w) =>
        `@font-face{font-family:"Figtree";font-style:normal;font-weight:${w};font-display:block;` +
        `src:url(data:font/woff2;base64,${FIGTREE_WOFF2[w]}) format("woff2");}`
    )
    .join("\n");
  document.head.appendChild(style);

  const handle = delayRender("Loading the embedded Figtree faces");
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    continueRender(handle);
  };
  Promise.all(weights.map((w) => document.fonts.load(`${w} 40px Figtree`)))
    .catch((err) => console.error("Figtree failed to load:", err))
    .finally(finish);
  setTimeout(finish, MAX_WAIT_MS); // never hold a render on a font
}
