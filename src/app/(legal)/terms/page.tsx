// TEMPLATE FOR HUMAN REVIEW: these terms are an early-access draft, not advice from a lawyer. Have someone qualified
// read them before Shelfie takes real payments. Governing law is left out on purpose until that happens.
import type { Metadata } from 'next';
import { DocPage, DocSection } from '@/components/brand/DocPage';
import { TextLink } from '@/components/ui/text-link';

export const metadata: Metadata = { title: 'Terms · Shelfie' };

export default function TermsPage() {
  return (
    <DocPage title="Terms" subtitle="Early-access draft, last updated 8 November 2026">
      <DocSection title="Early access">
        <p>Shelfie is in early access. Features can change or stop, and these terms can change too. When they do, the date above changes.</p>
      </DocSection>

      <DocSection title="Test mode">
        <p>
          Shelfie runs on the PayPal sandbox, PayPal’s practice system for payments. Orders and payments are practice runs and no real money moves. Don’t hand over goods
          against a test order.
        </p>
      </DocSection>

      <DocSection title="Your account">
        <p>Keep your password and recovery key safe. You’re responsible for what is done with your account, and for only adding shops you’re allowed to run.</p>
      </DocSection>

      <DocSection title="Your menu">
        <p>
          You’re responsible for your menu being accurate: names, prices, descriptions, availability and allergens. Claude reads your photos and can make mistakes, so check every
          item before you publish it. Pictures marked as example photos aren’t pictures of what you sell.
        </p>
      </DocSection>

      <DocSection title="PayPal">
        <p>Orders are paid through PayPal into the PayPal account you name. PayPal’s own terms apply to that account and to every payment.</p>
      </DocSection>

      <DocSection title="No warranty">
        <p>Shelfie is provided as it is and as available, with no warranty of any kind. It may be interrupted, it may contain errors, and data may be lost.</p>
      </DocSection>

      <DocSection title="Closing an account">
        <p>
          You can close your account by{' '}
          <TextLink href="/help#contact" className="font-normal min-h-0">
            contacting us
          </TextLink>
          . We may close or suspend an account or shop that misuses Shelfie, breaks the law or harms buyers.
        </p>
      </DocSection>
    </DocPage>
  );
}
