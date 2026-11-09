// TEMPLATE FOR HUMAN REVIEW: this policy is an early-access draft, not advice from a lawyer. It lists what the code
// stores and sends today; re-check it against the code, and have someone qualified read it, before real use.
import type { Metadata } from 'next';
import { DocLink, DocList, DocPage, DocSection } from '@/components/brand/DocPage';

export const metadata: Metadata = { title: 'Privacy · Shelfie' };

export default function PrivacyPage() {
  return (
    <DocPage title="Privacy" subtitle="Early-access draft, last updated 8 November 2026">
      <DocSection title="What we keep">
        <DocList>
          <li>Your account: your email, a hash of your password, a hash of your recovery key, and when your sessions started and expire. We never keep the password or key itself.</li>
          <li>Your shop: its name, your PayPal email, and the photos you upload.</li>
          <li>Orders: the buyer’s and payer’s name and email, the ship-to address, and any note. The seller who took the order sees these.</li>
          <li>Conversations with the shop assistant: what a buyer types and what the assistant answers, kept with the shop until the shop is deleted.</li>
          <li>A hashed caller id, which limits how many unpaid orders one caller can hold.</li>
        </DocList>
      </DocSection>

      <DocSection title="Who else sees it">
        <DocList>
          <li>Anthropic’s Claude reads your photos, the order text for briefs, and assistant chats.</li>
          <li>PayPal receives your catalog and orders, and takes payment.</li>
          <li>Pexels receives the words used to search for example photos, on deployments where that search is switched on.</li>
        </DocList>
        <p>We don’t sell your data.</p>
      </DocSection>

      <DocSection title="Cookies">
        <DocList>
          <li>A session cookie keeps you logged in.</li>
          <li>A returning cookie remembers that this browser has had an account, so a shop link shows the login page.</li>
          <li>An owner cookie opens a shop from its owner link.</li>
        </DocList>
        <p>Shelfie has no analytics and no ads.</p>
      </DocSection>

      <DocSection title="Deleting your data">
        <p>
          To delete your shop or account,{' '}
          <DocLink href="/help#contact">contact us</DocLink>
          .
        </p>
      </DocSection>
    </DocPage>
  );
}
