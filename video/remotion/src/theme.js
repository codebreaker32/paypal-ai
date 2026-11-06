/**
 * Brand tokens, filled in from demo.json's `brand` block at render time.
 * Defaults are Shelfie's "Storefront" look (docs/DESIGN.md): a white page,
 * near-black ink, one pomegranate accent, Figtree (bundled, see fonts.js).
 * No gradients, glow or glass anywhere in this template.
 */
export const defaultTheme = {
  primary: "#c21a4b", // pomegranate, the one accent
  bg: "#ffffff",
  text: "#111214", // ink-900
  muted: "#5e636c", // ink-600
  surface: "#f4f5f7", // grey-50
  line: "#e2e4e8", // grey-200
  font: "Figtree, system-ui, sans-serif",
};

/**
 * Type sizes in the template were tuned against a 1080px short side. This factor
 * keeps them honest at other resolutions: exactly 1 for both 1920x1080 and
 * 1080x1920 (so existing landscape renders are pixel-identical), smaller for the
 * low-res selftest fixtures.
 */
export const typeScale = (width, height) => Math.min(width, height) / 1080;

export function themeFrom(brand = {}) {
  return {
    ...defaultTheme,
    ...(brand.colors || {}),
    font: brand.font ? `${brand.font}, ${defaultTheme.font}` : defaultTheme.font,
  };
}
