import { describe, expect, it } from 'vitest';
import { RECOVERY_FILE_NAME, keyGroups, recoveryFileText } from '@/lib/client/recovery-file';

const KEY = 'ABCDE-FGHJK-LMNPQ-RSTUV';

describe('the recovery key file', () => {
  it('has the agreed name', () => {
    expect(RECOVERY_FILE_NAME).toBe('shelfie-recovery-key.txt');
  });

  it('names Shelfie, the email, the key and where to use it', () => {
    const text = recoveryFileText({ email: 'rosa@example.com', recoveryKey: KEY, appUrl: 'https://shelfie.example' });
    expect(text).toContain('Shelfie');
    expect(text).toContain('rosa@example.com');
    expect(text).toContain(KEY);
    expect(text).toContain('https://shelfie.example/recover');
  });

  it('copes with an app URL ending in a slash', () => {
    const text = recoveryFileText({ email: 'a@b.co', recoveryKey: KEY, appUrl: 'http://localhost:3000/' });
    expect(text).toContain('http://localhost:3000/recover');
    expect(text).not.toContain('//recover');
  });

  it('never contains an em dash', () => {
    expect(recoveryFileText({ email: 'a@b.co', recoveryKey: KEY, appUrl: 'http://x' })).not.toMatch(/—/);
  });
});

describe('keyGroups', () => {
  it('splits on dashes for the 2x2 well', () => {
    expect(keyGroups(KEY)).toEqual(['ABCDE', 'FGHJK', 'LMNPQ', 'RSTUV']);
  });
});
