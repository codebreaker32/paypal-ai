import { TEST_MODE_LINE } from '@/lib/brand/test-mode';
import { Frame } from './Frame';

/** One honest line on every screen while Shelfie runs on PayPal's sandbox. */
export function SiteFooter() {
  return (
    <footer data-site-chrome="" className="border-t border-line">
      <Frame className="py-6 type-meta text-ink-muted">
        <p>{TEST_MODE_LINE}</p>
      </Frame>
    </footer>
  );
}
