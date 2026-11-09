import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Shelfie home page preview',
  robots: { index: false, follow: false },
};

// A direction draws its own header and footer, so the site's are switched off for this route only. The skip link stays.
const HIDE_SITE_CHROME = 'body:has([data-preview]) header[data-site-chrome],body:has([data-preview]) footer[data-site-chrome]{display:none}';

/** The three home page directions under review. They live only on the run-6-home branch. */
export default function PreviewLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{HIDE_SITE_CHROME}</style>
      <div data-preview="" className="flex flex-1 flex-col">
        {children}
      </div>
    </>
  );
}
