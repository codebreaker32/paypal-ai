import type { Metadata } from 'next';
import { DocPage, DocSection } from '@/components/brand/DocPage';
import { TextLink } from '@/components/ui/text-link';
import { contactFor } from '@/lib/brand/contact';
import { getConfig } from '@/lib/config';

export const metadata: Metadata = { title: 'Help · Shelfie' };

const CONTENTS = [
  { href: '#test-mode', label: 'Test mode' },
  { href: '#get-paid', label: 'Getting paid' },
  { href: '#locked-out', label: 'Locked out' },
  { href: '#delete', label: 'Deleting' },
  { href: '#contact', label: 'Contact' },
];

export default function HelpPage() {
  const contact = contactFor(getConfig().supportEmail);
  return (
    <DocPage title="Help">
      <nav aria-label="On this page" className="mt-3 flex flex-wrap gap-x-5">
        {CONTENTS.map((c) => (
          <TextLink key={c.href} href={c.href} className="font-medium text-ink-soft">
            {c.label}
          </TextLink>
        ))}
      </nav>

      <DocSection id="test-mode" title="Test mode">
        <p>Shelfie runs on the PayPal sandbox, PayPal’s practice system for payments. Orders and payments are practice runs and no real money moves.</p>
      </DocSection>

      <DocSection id="get-paid" title="Getting paid">
        <p>Every order pays into the PayPal account you name as your PayPal email when you set up your shop.</p>
        <p>You can change that email in your shop’s Settings. The change applies to new orders; an order that already exists keeps the email it was made with.</p>
        <p>If an email has no PayPal account yet, a payment to it stays pending, and the order says so.</p>
      </DocSection>

      <DocSection id="locked-out" title="Locked out">
        <p>Without your password and recovery key we can’t confirm the account is yours, so we can’t reset it for you yet. Your shop keeps running.</p>
      </DocSection>

      <DocSection id="delete" title="Deleting your shop or account">
        <p>
          To delete your shop or account,{' '}
          <TextLink href="#contact" className="font-normal min-h-0">
            contact us
          </TextLink>
          .
        </p>
      </DocSection>

      <DocSection id="contact" title="Contact">
        <p>
          {contact.kind === 'email' ? 'Write to ' : 'Open an issue on '}
          <a href={contact.href} className="press-text font-semibold underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink">
            {contact.label}
          </a>
          .
        </p>
      </DocSection>
    </DocPage>
  );
}
