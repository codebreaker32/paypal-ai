// The text of the downloaded recovery key, and how the key is laid out on screen. Pure.

export const RECOVERY_FILE_NAME = 'shelfie-recovery-key.txt';

export function recoveryFileText({ email, recoveryKey, appUrl }: { email: string; recoveryKey: string; appUrl: string }): string {
  return [
    'Shelfie recovery key',
    '',
    `Account: ${email}`,
    `Recovery key: ${recoveryKey}`,
    '',
    `If you forget your password, go to ${appUrl.replace(/\/+$/, '')}/recover and enter this key.`,
    'Shelfie doesn’t send email yet, so this is the only way back in. Keep it somewhere safe.',
    '',
  ].join('\n');
}

/** The groups of `XXXXX-XXXXX-XXXXX-XXXXX`. */
export const keyGroups = (recoveryKey: string): string[] => recoveryKey.split('-');
