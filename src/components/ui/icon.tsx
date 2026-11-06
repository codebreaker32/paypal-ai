import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type IconSize = 'sm' | 'md' | 'lg';

const SIZE: Record<IconSize, string> = {
  sm: 'size-(--icon-sm)',
  md: 'size-(--icon-md)',
  lg: 'size-(--icon-lg)',
};

export interface IconProps {
  icon: LucideIcon;
  size?: IconSize;
  /** Give a label only when the icon carries meaning on its own. Without one it is hidden from screen readers. */
  label?: string;
  className?: string;
}

/** The one way to draw an icon: lucide-react glyphs at token sizes and one stroke weight. */
export function Icon({ icon: Glyph, size = 'md', label, className }: IconProps) {
  return (
    <Glyph
      className={cn('shrink-0 [stroke-width:var(--icon-stroke)]', SIZE[size], className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable="false"
    />
  );
}
