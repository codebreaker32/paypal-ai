import { LOCKUP, MARK, WORDMARK } from '@/components/brand/logo-paths';

/**
 * The Awning logo for any ground (docs/DESIGN.md, "Logo"). `tone`:
 * - `full`: pomegranate awning and i-dot, ink print and letters, on white or a very light ground;
 * - `reverse`: pomegranate awning and i-dot, white print and letters, on dark;
 * - `white`: everything white, on pomegranate, a strong colour or a photo.
 */
type Tone = 'full' | 'reverse' | 'white';

const POMEGRANATE = '#c21a4b';
const INK = '#141414';
const WHITE = '#ffffff';

const colours = (tone: Tone) => ({
  awning: tone === 'white' ? WHITE : POMEGRANATE,
  ink: tone === 'full' ? INK : WHITE,
});

export function PreviewLogo({ tone = 'full', className, label = 'Shelfie' }: { tone?: Tone; className?: string; label?: string }) {
  const { awning, ink } = colours(tone);
  return (
    <svg viewBox={LOCKUP.viewBox} role="img" aria-label={label} focusable="false" className={className}>
      <g transform={LOCKUP.mark}>
        <path d={MARK.awning} fill={awning} />
        <path d={MARK.print} fill={ink} fillRule="evenodd" />
      </g>
      <g transform={LOCKUP.word}>
        {WORDMARK.ink.map((d) => (
          <path key={d} d={d} fill={ink} />
        ))}
        <path d={WORDMARK.dot} fill={awning} />
      </g>
    </svg>
  );
}

export function PreviewMark({ tone = 'full', className }: { tone?: Tone; className?: string }) {
  const { awning, ink } = colours(tone);
  return (
    <svg viewBox={MARK.viewBox} aria-hidden="true" focusable="false" className={className}>
      <path d={MARK.awning} fill={awning} />
      <path d={MARK.print} fill={ink} fillRule="evenodd" />
    </svg>
  );
}
