// /help's contact: SUPPORT_EMAIL when set, else GitHub Issues.
import { describe, expect, it } from 'vitest';
import { contactFor } from '@/lib/brand/contact';

describe('contactFor', () => {
  it('uses the support address when one is set', () => {
    expect(contactFor('help@shelfie.example')).toEqual({
      kind: 'email',
      href: 'mailto:help@shelfie.example',
      label: 'help@shelfie.example',
    });
  });

  it.each([undefined, null, ''])('falls back to GitHub Issues without an address (%j)', (email) => {
    expect(contactFor(email)).toEqual({
      kind: 'issues',
      href: 'https://github.com/codebreaker32/paypal-ai/issues',
      label: 'GitHub Issues',
    });
  });
});
