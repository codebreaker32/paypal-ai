import { ChevronDown } from 'lucide-react';
import { Icon } from '@/components/ui/icon';

const QUESTIONS = [
  {
    q: 'Do I need a website?',
    a: 'No. Your shop gets its own page and link, and a card with a QR code you can print for the counter.',
  },
  {
    q: 'Do my buyers need an AI assistant?',
    a: 'No. Every shop page has an assistant built in.',
  },
  {
    q: 'Can I take real payments today?',
    a: 'Not yet. Shelfie runs on the PayPal sandbox, PayPal’s practice system for payments, so orders are practice runs and no real money moves. You can set everything up now.',
  },
  {
    q: 'What happens to my photos and orders?',
    a: 'Menu photos go to Anthropic’s Claude to be read, and items and orders go to PayPal to take payment. We don’t sell your data.',
  },
  {
    q: 'What if I forget my password?',
    a: 'You save a recovery key when you sign up. It lets you set a new password. Shelfie doesn’t send email yet, so keep it somewhere safe.',
  },
] as const;

/** Native disclosures, so they work before hydration and need no script. */
export function Faq() {
  return (
    <section aria-label="Common questions" className="mx-auto w-full max-w-page px-gutter pt-section">
      <div className="max-w-measure divide-y divide-line">
        {QUESTIONS.map(({ q, a }) => (
          <details key={q} className="group">
            <summary className="group/summary press-text flex min-h-tap list-none items-center justify-between gap-4 rounded-sm py-4 type-heading [&::-webkit-details-marker]:hidden">
              {q}
              <Icon
                icon={ChevronDown}
                className="shrink-0 text-ink-muted transition-[rotate,color] duration-(--duration-base) group-open:rotate-180 group-hover/summary:text-ink"
              />
            </summary>
            <p className="pb-5 type-body text-ink-soft">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
