// The installable app's identity (spec §4c). The colours mirror the design tokens in src/app/globals.css (the manifest
// can't read CSS variables): `theme` is the browser/status-bar colour, `background` the splash screen behind the icon.
export const PWA = {
  name: 'Shelfie',
  shortName: 'Shelfie',
  description: 'Snap your price list. Any AI assistant can order from your shop, and buyers pay with PayPal.',
  theme: '#ffffff',
  background: '#ffffff',
} as const;

/** Icons drawn from the brand mark by `scripts/make-icons.ts` into public/icons/. */
export const PWA_ICONS = [
  { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
] as const;
