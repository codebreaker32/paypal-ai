/** Shelfie's own drawings for the home page: one chunky outline on a 48-unit grid, ink with a pomegranate detail. */
const OUTLINE = { fill: 'none', stroke: 'currentColor', strokeWidth: 3.2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const SVG = { viewBox: '0 0 48 48', 'aria-hidden': true, focusable: false } as const;
const BUBBLE = 'M10 7h28a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6H23l-9 7v-7h-4a6 6 0 0 1-6-6V13a6 6 0 0 1 6-6Z';

/** The assistant in the hero chain: a neutral speech bubble and a spark, nobody's logo. */
export function AssistantMark({ className }: { className?: string }) {
  return (
    <svg {...SVG} className={className}>
      <path {...OUTLINE} d={BUBBLE} />
      <path d="M24 12.5c1 4.6 2.9 6.5 7.5 7.5-4.6 1-6.5 2.9-7.5 7.5-1-4.6-2.9-6.5-7.5-7.5 4.6-1 6.5-2.9 7.5-7.5Z" className="fill-accent" />
    </svg>
  );
}

/** Three hand-drawn strokes beside a heading. */
export function AccentMarks({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false" className={className} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
      <path d="M6 30c5 1.5 9 3 13 5" />
      <path d="M10 8c2.5 6 5 11 8.5 16" />
      <path d="M30 4c-.8 6.5-.8 12 0 18" />
    </svg>
  );
}
