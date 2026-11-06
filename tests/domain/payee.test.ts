import { describe, expect, it } from 'vitest';
import { PAYEE_EMAIL_MESSAGE, PAYEE_REQUIRED_MESSAGE, RESERVED_SLUG, isDemoShop, maskEmail, parsePayeeEmail } from '@/lib/domain/payee';

describe('parsePayeeEmail', () => {
  it.each([
    ['rosa@example.com', 'rosa@example.com'],
    ['  Rosa.Baker@Example.COM ', 'rosa.baker@example.com'],
    ['sb-abc123@business.example.com', 'sb-abc123@business.example.com'],
    ['first+shop@mail.co.uk', 'first+shop@mail.co.uk'],
    [`${'a'.repeat(64)}@${'b'.repeat(180)}.com`, `${'a'.repeat(64)}@${'b'.repeat(180)}.com`],
    ["o'brien@example.com", "o'brien@example.com"],
    ['rosa_b@my-shop.example.com', 'rosa_b@my-shop.example.com'],
    ['r@e.io', 'r@e.io'],
    ['rosa@xn--bcher-kva.example', 'rosa@xn--bcher-kva.example'],
    ['rosa@123.example.com', 'rosa@123.example.com'],
  ])('accepts %j as %j', (raw, email) => {
    expect(parsePayeeEmail(raw)).toEqual({ ok: true, email });
  });

  it.each([
    ['', 'empty'],
    ['   ', 'only spaces'],
    ['rosa', 'no @'],
    ['rosa@', 'no domain'],
    ['@example.com', 'no local part'],
    ['rosa@example', 'no dot in the domain'],
    ['rosa@example.', 'domain ends with a dot'],
    ['rosa@.example', 'domain starts with a dot'],
    ['rosa@@example.com', 'two @'],
    ['ro@sa@example.com', 'two @ apart'],
    ['rosa baker@example.com', 'a space inside'],
    ['rosa@exa mple.com', 'a space in the domain'],
    ['rosa@exam\tple.com', 'a tab'],
    [`${'a'.repeat(250)}@x.com`, 'over 254 characters'],
    // Addresses PayPal refuses (422 on every order), so Shelfie refuses them first.
    ['a,b@x.y', 'a comma, and a one-letter ending'],
    ['a,b@example.com', 'a comma in the name part'],
    ['"<x>"@a.b', 'quotes and angle brackets'],
    ['"rosa"@example.com', 'a quoted name part'],
    ['<rosa>@example.com', 'angle brackets'],
    ['rosa(x)@example.com', 'brackets'],
    ['rosa;x@example.com', 'a semicolon'],
    ['ro\\sa@example.com', 'a backslash'],
    ['.rosa@example.com', 'name part starts with a dot'],
    ['rosa.@example.com', 'name part ends with a dot'],
    ['ro..sa@example.com', 'two dots in a row in the name part'],
    ['rosa@-.-', 'domain of hyphens'],
    ['rosa@-example.com', 'domain label starts with a hyphen'],
    ['rosa@example-.com', 'domain label ends with a hyphen'],
    ['rosa@exa_mple.com', 'an underscore in the domain'],
    ['rosa@exa!mple.com', 'punctuation in the domain'],
    ['rosa@[127.0.0.1]', 'an IP address for a domain'],
    ['rosa@127.0.0.1', 'a bare IP address'],
    ['rosa@example.c', 'a one-letter ending'],
    ['rosa@example.c0m', 'a digit in the ending'],
    ['rosa@example.co-', 'a hyphen in the ending'],
    [null, 'null'],
    [undefined, 'undefined'],
    [42, 'a number'],
    [{ email: 'rosa@example.com' }, 'an object'],
  ] as [unknown, string][])('refuses %j (%s) with the seller message', (raw) => {
    expect(parsePayeeEmail(raw)).toEqual({ ok: false, message: PAYEE_EMAIL_MESSAGE });
  });

  it('says what to type, with an example', () => {
    expect(PAYEE_EMAIL_MESSAGE).toBe('Enter the email you use to log in to PayPal, like rosa@example.com.');
  });

  it('has one wording for "publishing needs it", shared by the publish gate and the setup screen', () => {
    expect(PAYEE_REQUIRED_MESSAGE).toBe('Add your PayPal email to publish.');
  });
});

describe('maskEmail', () => {
  it.each([
    ['rosa@example.com', 'r•••@example.com'],
    ['r@example.com', 'r•••@example.com'],
    ['sb-47abc@business.example.com', 's•••@business.example.com'],
    ['Rosa@Example.com', 'R•••@Example.com'],
  ])('%j → %j', (email, masked) => {
    expect(maskEmail(email)).toBe(masked);
  });

  it('never returns the local part beyond its first character', () => {
    expect(maskEmail('secretname@example.com')).not.toContain('ecretname');
  });

  it('masks something that is not an email at all', () => {
    expect(maskEmail('nonsense')).toBe('n•••');
  });
});

describe('isDemoShop', () => {
  it('is true only for the reserved demo slug', () => {
    expect(RESERVED_SLUG).toBe('marigold-bakehouse');
    expect(isDemoShop({ slug: 'marigold-bakehouse' })).toBe(true);
    expect(isDemoShop({ slug: 'marigold-bakehouse-2' })).toBe(false);
    expect(isDemoShop({ slug: 'tia-lupe-tacos' })).toBe(false);
    expect(isDemoShop({ slug: 'draft-abcdefgh' })).toBe(false);
  });
});
