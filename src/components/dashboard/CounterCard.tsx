import { Logo } from '@/components/brand/Logo';
import { cx } from '@/components/ui/cx';
import { cardNameSize } from '@/app/shops/[id]/(app)/card/name-size';

export interface CounterCardProps {
  name: string;
  coverUrl: string | null;
  shopUrl: string;
  doorUrl: string;
  /** The QR code as SVG markup (`qrSvg`, server only), so this component also renders in client panels. */
  qr: string;
  /** The small picture of the card in Share: hidden from assistive tech (its parent names it) and never printed alone. */
  miniature?: boolean;
}

/** The link as people type it: "https://shelfie.example/s/rosa" → "shelfie.example/s/rosa". */
const asTyped = (url: string) => url.replace(/^https?:\/\//, '');

/** The 5 × 7 in card. Every size is a share of its width (cqw), so the page, the miniature and the 5 in print are one layout. */
export function CounterCard({ name, coverUrl, shopUrl, doorUrl, qr, miniature = false }: CounterCardProps) {
  const Root = miniature ? 'div' : 'article';
  const Name = miniature ? 'p' : 'h2';
  const testId = (id: string) => (miniature ? undefined : id);

  return (
    <Root
      data-print-alone={miniature ? undefined : true}
      aria-labelledby={miniature ? undefined : 'card-shop-name'}
      aria-hidden={miniature ? true : undefined}
      className={cx(
        '@container relative flex aspect-[5/7] w-full max-w-card flex-col items-center overflow-hidden border border-line-strong bg-surface-raised text-center [print-color-adjust:exact]',
        miniature ? 'rounded-(--card-radius) shadow-md' : 'rounded-(--radius-2xl) shadow-lg print:shadow-none',
      )}
    >
      {/* The shop's own cover leads the card, as it leads the shop page. */}
      {coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- a site-relative upload or bundled demo photo, printed as is
        <img src={coverUrl} alt="" className="h-[17%] w-full shrink-0 object-cover" />
      )}
      {/* The QR takes the height that's left: a long name makes it smaller, never pushes the footer off the card. */}
      <div className={cx('flex min-h-0 w-full flex-1 flex-col items-center px-[8.3cqw] pb-[5.8cqw]', coverUrl ? 'pt-[5.8cqw]' : 'pt-[10cqw]')}>
        <header className="flex flex-col items-center gap-[2.5cqw]">
          <Name
            id={miniature ? undefined : 'card-shop-name'}
            className={cx('line-clamp-3 font-display leading-[1.04] font-extrabold tracking-display [overflow-wrap:anywhere]', cardNameSize(name))}
          >
            {name}
          </Name>
          <p className="text-[4.15cqw] leading-snug text-ink-soft">
            {/* Each phrase stays on one line where it fits, so the line breaks after the comma. */}
            <span className="inline-block">Order ahead with any AI assistant,</span>{' '}
            <span className="inline-block">pay with PayPal</span>
          </p>
        </header>

        <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-[1.2cqw] py-[3.3cqw]">
          <div className="relative min-h-0 w-full flex-1">
            <div
              role="img"
              aria-label={`QR code that opens ${asTyped(shopUrl)}`}
              data-testid={testId('card-qr')}
              className="absolute inset-0 [&>svg]:block [&>svg]:size-full"
              dangerouslySetInnerHTML={{ __html: qr }}
            />
          </div>
          <p className="mt-[0.8cqw] font-display text-[3.75cqw] leading-snug font-bold">Scan for the menu</p>
          <p className="type-price text-[2.9cqw] text-ink-soft [overflow-wrap:anywhere]" data-testid={testId('card-shop-url')}>
            {asTyped(shopUrl)}
          </p>
        </div>

        <footer className="flex w-full items-end justify-between gap-[3.3cqw] border-t border-line pt-[2.5cqw] text-left text-[2.7cqw] leading-snug">
          <p className="min-w-0 text-ink-soft">
            <span className="font-semibold text-ink">Agent door</span> for AI assistants
            <span className="block type-price text-ink [overflow-wrap:anywhere]" data-testid={testId('card-door-url')}>
              {doorUrl}
            </span>
          </p>
          <Logo size="sm" className={cx('shrink-0', miniature && 'h-[5cqw]')} />
        </footer>
      </div>
    </Root>
  );
}
