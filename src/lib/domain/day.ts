/** A date as a person writes it, "8 Nov 2026". With no time zone, the runtime's own. */
export function dayLabel(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { timeZone, day: 'numeric', month: 'short', year: 'numeric' });
}
