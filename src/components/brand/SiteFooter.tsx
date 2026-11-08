import { Frame } from './Frame';
import { SoundToggle } from './SoundToggle';

/** One honest line on every screen while Shelfie runs on PayPal's sandbox, and the sound switch for anyone signed out. */
export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <Frame className="flex items-center justify-between gap-4 py-3 type-meta text-ink-muted">
        <p>Payments run in the PayPal sandbox, so no real money moves.</p>
        <SoundToggle />
      </Frame>
    </footer>
  );
}
