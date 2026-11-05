// Short seller-provided labels (shop and item names) appear in text that AI agents read: server instructions and
// error messages. Make them single-line and visible: no control, line-separator, zero-width or bidi characters.

/** Zero-width and bidi-control characters: removed outright (they are invisible, so they never separate words). */
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
/** C0/C1 controls (incl. newlines and tabs) and Unicode line/paragraph separators: become spaces. */
const CONTROLS = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g;

export function sanitizeLabel(s: string, max: number): string {
  return s
    .replace(INVISIBLE, '')
    .replace(CONTROLS, ' ')
    .replace(/"/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trimEnd();
}
