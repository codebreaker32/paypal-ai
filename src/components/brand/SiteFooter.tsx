/** One honest line on every screen while Shelfie runs on PayPal's sandbox. */
export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto w-full max-w-page px-gutter py-6 type-meta text-ink-muted">
        <p>Payments run in the PayPal sandbox, so no real money moves.</p>
      </div>
    </footer>
  );
}
