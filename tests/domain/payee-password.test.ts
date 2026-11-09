// When the Settings form asks for the password (SR18): the same rule the PATCH route enforces.
import { describe, expect, it } from 'vitest';
import { payeeChangeNeedsPassword } from '@/lib/domain/payee';

describe('payeeChangeNeedsPassword', () => {
  it('asks on an account-owned published or paused shop whose email changes', () => {
    expect(payeeChangeNeedsPassword({ accountOwned: true, status: 'live', changes: true })).toBe(true);
    expect(payeeChangeNeedsPassword({ accountOwned: true, status: 'paused', changes: true })).toBe(true);
  });

  it('does not ask for a draft, an owner-link shop or an unchanged email', () => {
    expect(payeeChangeNeedsPassword({ accountOwned: true, status: 'draft', changes: true })).toBe(false);
    expect(payeeChangeNeedsPassword({ accountOwned: false, status: 'live', changes: true })).toBe(false);
    expect(payeeChangeNeedsPassword({ accountOwned: true, status: 'live', changes: false })).toBe(false);
  });
});
