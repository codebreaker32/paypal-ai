import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { SiteFooter } from '@/components/brand/SiteFooter';
import { SiteHeader } from '@/components/brand/SiteHeader';
import { ToastProvider } from '@/components/ui/Toast';
import './globals.css';

/** Display: a grotesk with a width axis, set semi-expanded for headings and totals. */
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  axes: ['wdth'],
  display: 'swap',
});

/** UI: a precise sans with real tabular figures for every price. */
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-plex-sans',
  display: 'swap',
});

/** References: order numbers and PayPal ids. */
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Shelfie: your price list, open to AI shoppers',
  description:
    'Snap a photo of your paper price list. Shelfie reads it, lists it with PayPal, and opens an agent door any AI assistant can order and pay through.',
};

export const viewport: Viewport = {
  colorScheme: 'light',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body className="flex min-h-dvh flex-col bg-surface text-ink">
        <a
          href="#main"
          className="sr-only rounded-md bg-ink px-4 py-3 font-semibold text-surface focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-(--z-toast)"
        >
          Skip to content
        </a>
        <ToastProvider>
          <SiteHeader />
          <main id="main" className="flex flex-1 flex-col">
            {children}
          </main>
          <SiteFooter />
        </ToastProvider>
      </body>
    </html>
  );
}
