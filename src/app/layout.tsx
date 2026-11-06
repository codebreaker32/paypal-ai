import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { IBM_Plex_Mono, Playfair_Display, Schibsted_Grotesk } from 'next/font/google';
import { SiteFooter } from '@/components/brand/SiteFooter';
import { SiteHeader } from '@/components/brand/SiteHeader';
import { ToastProvider } from '@/components/ui/Toast';
import './globals.css';

// Display: a high-contrast menu serif, roman and italic (menu sections are set in the italic).
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  style: ['normal', 'italic'],
  display: 'swap',
});

// UI text: a newspaper grotesk.
const schibsted = Schibsted_Grotesk({
  subsets: ['latin'],
  variable: '--font-schibsted',
  display: 'swap',
});

// Receipt lines and order numbers.
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-plex-mono',
  weight: ['400', '500', '600'],
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
    <html lang="en" className={`${playfair.variable} ${schibsted.variable} ${plexMono.variable}`}>
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
