'use client';

/* eslint-disable @next/next/no-img-element -- this page replaces the root layout, so it can lean on nothing but one static file */

/**
 * The root layout itself failed, so nothing from it survives: no stylesheet, no font, no header. Inline styles and the
 * system font, on purpose. `press` only answers if the stylesheet happens to still be loaded.
 */
export default function GlobalError() {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#ffffff', color: '#111214', fontFamily: 'system-ui, sans-serif' }}>
        <title>That page didn’t load · Shelfie</title>
        <main style={{ maxWidth: '36rem', padding: '48px 20px', boxSizing: 'border-box' }}>
          <img src="/brand/lockup.svg" alt="Shelfie" width={118} height={24} />
          <h1 style={{ margin: '32px 0 24px', fontSize: 30, lineHeight: 1.2, fontWeight: 800 }}>That page didn’t load</h1>
          <button
            type="button"
            className="press"
            onClick={() => window.location.reload()}
            style={{
              minHeight: 44,
              padding: '0 24px',
              border: 0,
              borderRadius: 999,
              background: '#111214',
              color: '#ffffff',
              font: 'inherit',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
