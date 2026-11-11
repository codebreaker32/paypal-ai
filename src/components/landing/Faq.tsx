'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Icon } from '@/components/ui/icon';

const QUESTIONS = [
  {
    q: 'Do I need a website?',
    a: 'No. Your shop gets its own page and link, and a card with a QR code you can print for the counter.',
  },
  {
    q: 'How do payments work?',
    a: 'The buyer approves the total on PayPal, and the payment goes to the PayPal account you add to your shop. The order then shows as paid on your dashboard.',
  },
  {
    q: 'What if I have allergies or special notes?',
    a: 'Add a note to your order, at checkout or through your AI assistant. The seller gets it with the order, and their AI brief flags an allergy that conflicts with an item. Allergen details come from the seller, so ask the shop if you’re unsure.',
  },
  {
    q: 'Is there a fee?',
    a: 'Shelfie runs on the PayPal sandbox today, PayPal’s practice system, so no real money moves and nothing is charged. Fees for real payments haven’t been set.',
  },
  {
    q: 'Do my buyers need an AI assistant?',
    a: 'No. Every shop page has an assistant built in, and buyers can also add items to a cart themselves.',
  },
  {
    q: 'What happens to my photos and orders?',
    a: 'Menu photos go to Anthropic’s Claude to be read, and items and orders go to PayPal to take payment. We don’t sell your data. You can delete your shop or account whenever you like.',
  },
] as const;

/** A solid pomegranate band. The rows are native disclosures; below 768 px the heading folds the whole list away. */
export function Faq() {
  const [open, setOpen] = useState(false);
  return (
    <section id="faq" aria-labelledby="faq-title" className="bg-accent text-on-dark [--focus-ring-color:var(--white)]">
      <noscript>
        <style>{'#faq-list{display:block!important}'}</style>
      </noscript>
      <div className="mx-auto grid w-full max-w-site px-band-gutter py-band md:gap-8 xl:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] xl:gap-10">
        <div className="xl:self-center">
          <h2 id="faq-title" className="type-band">
            <button
              type="button"
              aria-expanded={open}
              aria-controls="faq-list"
              onClick={() => setOpen((value) => !value)}
              className="press-text flex min-h-tap w-full items-center justify-between gap-4 text-left text-2xl leading-tight md:hidden"
            >
              Frequently asked questions
              <Icon icon={ChevronDown} size="lg" className={`shrink-0 transition-[rotate] duration-(--duration-base) ${open ? 'rotate-180' : ''}`} />
            </button>
            <span className="hidden md:block">
              Frequently <br className="max-xl:hidden" />
              asked questions
            </span>
          </h2>
          <span aria-hidden="true" className="mt-4 hidden h-1 w-20 rounded-full bg-on-dark md:block" />
        </div>
        <div id="faq-list" className={open ? 'mt-6 md:mt-0' : 'hidden md:block'}>
          <div className="flex flex-col gap-2">
            {QUESTIONS.map(({ q, a }) => (
              <details key={q} className="group rounded-lg bg-accent-active">
                <summary className="press-text flex min-h-12 list-none items-center justify-between gap-4 rounded-lg px-5 py-2 text-lg font-semibold hover:bg-accent-hover xl:text-xl [&::-webkit-details-marker]:hidden">
                  {q}
                  <Icon icon={ChevronDown} className="shrink-0 transition-[rotate] duration-(--duration-base) group-open:rotate-180" />
                </summary>
                <p className="max-w-[68ch] px-5 pb-5 pt-1 text-base xl:text-lg">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
