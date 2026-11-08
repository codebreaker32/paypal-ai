import type { Metadata, Viewport } from 'next';
import { Suspense, type ReactNode } from 'react';
import { Figtree } from 'next/font/google';
import { SiteFooter } from '@/components/brand/SiteFooter';
import { SiteHeader } from '@/components/brand/SiteHeader';
import { MotionProvider } from '@/components/motion/provider';
import { Tactile } from '@/components/motion/tactile';
import { ToastProvider } from '@/components/ui/toast';
import { PWA } from '@/lib/brand/pwa';
import { getConfig } from '@/lib/config';
import './globals.css';

// One family for everything: a modern grotesk with a real weight range (400 to 800).
const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
  display: 'swap',
});

// generateMetadata (not a static object) so metadataBase is the running app's URL: the og:image tag Next adds for
// src/app/opengraph-image.png (scripts/make-og-image.mjs) must be absolute on the deployed host.
export const generateMetadata = (): Metadata => ({
  metadataBase: new URL(getConfig().appUrl),
  title: 'Shelfie: your price list, open to AI shoppers',
  description:
    'Snap a photo of your paper price list. Shelfie reads it, lists it with PayPal, and opens an agent door any AI assistant can order and pay through.',
  applicationName: PWA.name,
  // Installable on a phone (spec §4c): Next adds apple-mobile-web-app-capable and the status-bar style from this.
  appleWebApp: { capable: true, title: PWA.shortName, statusBarStyle: 'default' },
});

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: PWA.theme,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={figtree.variable}>
      <body className="flex min-h-dvh flex-col bg-surface text-ink">
        <a
          href="#main"
          data-site-chrome=""
          className="sr-only rounded-md bg-ink px-4 py-3 font-semibold text-surface focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-(--z-toast)"
        >
          Skip to content
        </a>
        <MotionProvider>
          <ToastProvider>
            <SiteHeader />
            <main id="main" className="flex flex-1 flex-col">
              {children}
            </main>
            <SiteFooter />
          </ToastProvider>
        </MotionProvider>
        <Suspense fallback={null}>
          <Tactile />
        </Suspense>
      </body>
    </html>
  );
}
