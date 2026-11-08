import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { Check, Loader2, type LucideIcon } from 'lucide-react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { LAYERED, layerClass, preventClick, type ButtonStatus } from './button-status';
import { Icon } from './icon';

export type { ButtonStatus };

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'paypal';
export type ButtonSize = 'md' | 'lg';

// shadcn's button pattern (cva variants, data-slot), with Shelfie's pills and heights.
const BASE =
  'press relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-(--button-radius) font-semibold ' +
  'select-none';

const VARIANT = {
  primary:
    'border-(length:--button-border-w) border-(--button-primary-border) bg-(--button-primary-bg) text-(--button-primary-fg) ' +
    'hover:bg-(--button-primary-bg-hover) active:bg-(--button-primary-bg-active) data-pressed:bg-(--button-primary-bg-active)',
  secondary:
    'border-(length:--button-border-w) border-(--button-secondary-border) bg-(--button-secondary-bg) ' +
    'text-(--button-secondary-fg) hover:bg-(--button-secondary-bg-hover) active:bg-(--button-secondary-bg-active) ' +
    'data-pressed:bg-(--button-secondary-bg-active)',
  ghost:
    'text-(--button-ghost-fg) hover:bg-(--button-ghost-bg-hover) active:bg-(--button-ghost-bg-active) ' +
    'data-pressed:bg-(--button-ghost-bg-active) underline-offset-4',
  paypal:
    'bg-(--button-paypal-bg) text-(--button-paypal-fg) shadow-xs hover:bg-(--button-paypal-bg-hover) ' +
    'active:bg-(--button-paypal-bg-active) data-pressed:bg-(--button-paypal-bg-active)',
} satisfies Record<ButtonVariant, string>;

const SIZE = {
  md: 'min-h-(--button-h-md) px-(--button-px-md) text-base',
  lg: 'min-h-(--button-h-lg) px-(--button-px-lg) text-lg',
} satisfies Record<ButtonSize, string>;

/** The cva recipe behind every button-looking element. Prefer `buttonClasses()`, which also merges a className. */
export const buttonVariants = cva(BASE, {
  variants: {
    variant: VARIANT,
    size: SIZE,
    // A wide button shrinks by less: .96 of a full-width pill is a big move.
    fullWidth: { true: 'w-full [--press-local:var(--press-scale-wide)]', false: '' },
    // A busy button keeps full colour (it is busy, not unavailable); anything else dims and refuses.
    loading: { true: 'cursor-progress', false: 'disabled:opacity-50 aria-disabled:opacity-50 aria-disabled:cursor-not-allowed' },
    layered: { true: LAYERED, false: '' },
  },
  defaultVariants: { variant: 'primary', size: 'md', fullWidth: false, loading: false, layered: false },
});

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** A loading button keeps full colour (it is busy, not unavailable). */
  loading?: boolean;
  /** Its children are status layers sharing one grid cell (`layerClass`) rather than a row of icon and label. */
  layered?: boolean;
  className?: string;
}

/** Class list for anything that should look like a button (e.g. a link). */
export function buttonClasses({ variant = 'primary', size = 'md', fullWidth, loading, layered, className }: ButtonStyleOptions = {}) {
  return cn(buttonVariants({ variant, size, fullWidth: !!fullWidth, loading: !!loading, layered: !!layered }), className);
}

interface ContentProps {
  icon?: LucideIcon;
  iconEnd?: LucideIcon;
  size: ButtonSize;
  children: ReactNode;
}

function ButtonContent({ icon, iconEnd, size, children }: ContentProps) {
  const iconSize = size === 'lg' ? 'lg' : 'md';
  return (
    <>
      {icon && <Icon icon={icon} size={iconSize} />}
      <span>{children}</span>
      {iconEnd && <Icon icon={iconEnd} size={iconSize} />}
    </>
  );
}

/**
 * What a loading or success layer says next to its glyph: its own label, else the button's. A bare button (no icon) has
 * nowhere to put a glyph without growing, so there the glyph stands alone and the label is kept for screen readers.
 */
function StateLabel({ own, active, hasIcon, children }: { own?: string; active: boolean; hasIcon: boolean; children: ReactNode }) {
  if (own) return <span>{own}</span>;
  if (!active) return null;
  return <span className={hasIcon ? undefined : 'sr-only'}>{children}</span>;
}

export interface ButtonProps extends Omit<ComponentProps<'button'>, 'children'>, Omit<ButtonStyleOptions, 'layered'> {
  /** `loading` shows a spinner after --pending-delay; `success` a tick. Either blocks clicks and keeps focus. */
  status?: ButtonStatus;
  /** The same as status="loading". */
  loading?: boolean;
  /** Label to show while loading, e.g. "Uploading 2 photos". */
  loadingLabel?: string;
  /** Label to show on success, e.g. "Saved". */
  successLabel?: string;
  icon?: LucideIcon;
  iconEnd?: LucideIcon;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  status: statusProp,
  loading = false,
  loadingLabel,
  successLabel,
  icon,
  iconEnd,
  className,
  disabled,
  type = 'button',
  onClick,
  'aria-disabled': ariaDisabled,
  children,
  ...rest
}: ButtonProps) {
  const status: ButtonStatus = statusProp ?? (loading ? 'loading' : 'idle');
  const idle = status === 'idle';
  const iconSize = size === 'lg' ? 'lg' : 'md';
  // Server components render it idle, with no handler at all: only a busy button needs the guard.
  const guarded = !idle || ariaDisabled === true || ariaDisabled === 'true';
  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-status={status}
      type={type}
      className={buttonClasses({ variant, size, fullWidth, loading: !idle, layered: true, className })}
      // Native disabled would drop focus mid-action, so it is only for buttons that can't be used at all.
      disabled={idle ? disabled : undefined}
      aria-disabled={idle ? ariaDisabled : true}
      aria-busy={status === 'loading' || undefined}
      onClick={guarded ? preventClick : onClick}
      {...rest}
    >
      <span data-layer="idle" className={layerClass('idle', status)}>
        <ButtonContent icon={icon} iconEnd={iconEnd} size={size}>
          {children}
        </ButtonContent>
      </span>
      <span data-layer="loading" className={layerClass('loading', status)}>
        <Icon icon={Loader2} size={iconSize} className={status === 'loading' ? 'animate-spin' : undefined} />
        <StateLabel own={loadingLabel} active={status === 'loading'} hasIcon={!!icon}>
          {children}
        </StateLabel>
      </span>
      <span data-layer="success" className={layerClass('success', status)}>
        <Icon icon={Check} size={iconSize} className={status === 'success' ? 'animate-pop' : undefined} />
        <StateLabel own={successLabel} active={status === 'success'} hasIcon={!!icon}>
          {children}
        </StateLabel>
      </span>
    </button>
  );
}

export interface ButtonLinkProps extends Omit<ComponentProps<typeof Link>, 'children'>, Omit<ButtonStyleOptions, 'layered'> {
  icon?: LucideIcon;
  iconEnd?: LucideIcon;
  children: ReactNode;
}

/** Navigation styled as a button. Use for "Open your dashboard", "Back to shop" and the like. */
export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  fullWidth,
  icon,
  iconEnd,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link data-slot="button" data-variant={variant} className={buttonClasses({ variant, size, fullWidth, className })} {...rest}>
      <ButtonContent icon={icon} iconEnd={iconEnd} size={size}>
        {children}
      </ButtonContent>
    </Link>
  );
}
