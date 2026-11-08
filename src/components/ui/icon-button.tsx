import type { ComponentProps } from 'react';
import { Check, Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LAYERED, layerClass, preventClick, type ButtonStatus } from './button-status';
import { Icon, type IconSize } from './icon';

export interface IconButtonProps extends Omit<ComponentProps<'button'>, 'children' | 'aria-label'> {
  icon: LucideIcon;
  /** Its accessible name: an icon-only button has no text of its own. */
  label: string;
  /** `loading` swaps the icon for a spinner after --pending-delay; `success` for a tick. Either blocks clicks and keeps focus. */
  status?: ButtonStatus;
  iconSize?: IconSize;
  /** Classes for the glyph, e.g. the copy tick's `animate-pop`. */
  iconClassName?: string;
}

/** A round 44 px icon-only button. Stays server-safe: no hooks, the press comes from CSS and Tactile. */
export function IconButton({
  icon,
  label,
  status = 'idle',
  iconSize = 'sm',
  iconClassName,
  className,
  disabled,
  type = 'button',
  onClick,
  ...rest
}: IconButtonProps) {
  const idle = status === 'idle';
  return (
    <button
      data-slot="icon-button"
      data-status={status}
      type={type}
      aria-label={label}
      disabled={idle ? disabled : undefined}
      aria-disabled={idle ? undefined : true}
      aria-busy={status === 'loading' || undefined}
      onClick={idle ? onClick : preventClick}
      className={cn(
        'press-icon size-tap shrink-0 rounded-full text-ink-soft',
        LAYERED,
        idle && !disabled && 'hover:bg-surface-sunken hover:text-ink',
        idle ? 'disabled:opacity-50' : 'cursor-progress',
        className,
      )}
      {...rest}
    >
      <span data-layer="idle" className={layerClass('idle', status)}>
        <Icon icon={icon} size={iconSize} className={iconClassName} />
      </span>
      <span data-layer="loading" className={layerClass('loading', status)}>
        <Icon icon={Loader2} size={iconSize} className={status === 'loading' ? 'animate-spin' : undefined} />
      </span>
      <span data-layer="success" className={layerClass('success', status)}>
        <Icon icon={Check} size={iconSize} className={status === 'success' ? 'animate-pop' : undefined} />
      </span>
    </button>
  );
}
