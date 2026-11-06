import type { MetadataRoute } from 'next';
import { PWA, PWA_ICONS } from '@/lib/brand/pwa';

// Installable on a phone (spec §4c). There is deliberately no service worker: order, payment and dashboard pages are
// never served from a cache, because a stale payment page is worse than none.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PWA.name,
    short_name: PWA.shortName,
    description: PWA.description,
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: PWA.background,
    theme_color: PWA.theme,
    categories: ['business', 'food', 'shopping'],
    icons: PWA_ICONS.map((i) => ({ ...i })),
  };
}
