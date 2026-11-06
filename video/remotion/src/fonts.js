import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Figtree (SIL Open Font License 1.1, video/project/assets/fonts/LICENSE), the
// latin subset from @fontsource/figtree 5.3.0, kept in the project folder so the
// render needs no Google Fonts request. loadFont holds the render (delayRender)
// until each face is ready, so no frame is drawn in a fallback font.
for (const weight of [400, 500, 600, 700, 800]) {
  loadFont({
    family: "Figtree",
    url: staticFile(`assets/fonts/figtree-latin-${weight}-normal.woff2`),
    weight: String(weight),
    format: "woff2",
  });
}
