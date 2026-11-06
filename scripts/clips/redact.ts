// What the clips must never show (docs/DEMO.md, video/clips/README.md): the sandbox logins and owner links.
import fs from 'node:fs';
import path from 'node:path';
import { maskEmail } from '@/lib/domain/payee';

const clean = (logins: (string | null | undefined)[]) => [...new Set(logins.filter((l): l is string => Boolean(l)).map((l) => l.trim().toLowerCase()))];

/** The init script for a clip's browser: every login in `logins` is shown as the app's own masked form (r•••@…). */
export function redactorScript(logins: (string | null | undefined)[]): string {
  const pairs = clean(logins).map((l) => [l, maskEmail(l)]);
  const fn = fs.readFileSync(path.resolve('scripts/clips/redact.browser.js'), 'utf8');
  return `(${fn.replace(/^\s*\/\/.*$/gm, '').trim()})(${JSON.stringify(pairs)});`;
}

/** True when `text` holds a login or an owner link token: the check before this script prints anything it was given. */
export function leaks(text: string, logins: (string | null | undefined)[]): boolean {
  const lower = text.toLowerCase();
  return clean(logins).some((l) => lower.includes(l)) || /\/claim\/[A-Za-z0-9_-]{20,}/.test(text);
}
