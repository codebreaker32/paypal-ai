import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Icon } from './icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'paypal';
export type ButtonSize = 'md' | 'lg';

// shadcn's button pattern (cva variants, data-slot), with Shelfie's pills and heights.
const BASE =
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-(--button-radius) font-semibold ' +
  'select-none transition-[background-color,border-color,color,box-shadow,transform] duration-(--duration-fast) ease-out ' +
  'active:translate-y-px disabled:pointer-events-none aria-disabled:pointer-events-none';

const VARIANT = {
  primary:
    'border-(length:--button-border-w) border-(--button-primary-border) bg-(--button-primary-bg) text-(--button-primary-fg) ' +
    'hover:bg-(--button-primary-bg-hover) active:bg-(--button-primary-bg-active)',
  secondary:
    'border-(length:--button-border-w) border-(--button-secondary-border) bg-(--button-secondary-bg) ' +
    'text-(--button-secondary-fg) hover:bg-(--button-secondary-bg-hover)',
  ghost: 'text-(--button-ghost-fg) hover:bg-(--button-ghost-bg-hover) underline-offset-4',
  paypal:
    'bg-(--button-paypal-bg) text-(--button-paypal-fg) shadow-xs hover:bg-(--button-paypal-bg-hover) ' +
    'active:bg-(--button-paypal-bg-active)',
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
    fullWidth: { true: 'w-full', false: '' },
    // A loading button keeps full colour (it is busy, not unavailable); anything else dims when disabled.
    loading: { true: '', false: 'disabled:opacity-50 aria-disabled:opacity-50' },
  },
  defaultVariants: { variant: 'primary', size: 'md', fullWidth: false, loading: false },
});

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** A loading button keeps full colour (it is busy, not unavailable). */
  loading?: boolean;
  className?: string;
}

/** Class list for anything that should look like a button (e.g. a link). */
export function buttonClasses({ variant = 'primary', size = 'md', fullWidth, loading, className }: ButtonStyleOptions = {}) {
  return cn(buttonVariants({ variant, size, fullWidth: !!fullWidth, loading: !!loading }), className);
}

interface ContentProps {
  icon?: LucideIcon;
  iconEnd?: LucideIcon;
  loading?: boolean;
  size: ButtonSize;
  children: ReactNode;
}

function ButtonContent({ icon, iconEnd, loading, size, children }: ContentProps) {
  const iconSize = size === 'lg' ? 'lg' : 'md';
  return (
    <>
      {loading ? (
        <Icon icon={Loader2} size={iconSize} className="animate-spin" />
      ) : (
        icon && <Icon icon={icon} size={iconSize} />
      )}
      <span>{children}</span>
      {iconEnd && !loading && <Icon icon={iconEnd} size={iconSize} />}
    </>
  );
}

export interface ButtonProps extends Omit<ComponentProps<'button'>, 'children'>, ButtonStyleOptions {
  /** Shows a spinner, keeps the label (or loadingLabel) and blocks clicks. */
  loading?: boolean;
  /** Label to show while loading, e.g. "Uploading 2 photos". */
  loadingLabel?: string;
  icon?: LucideIcon;
  iconEnd?: LucideIcon;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  loading = false,
  loadingLabel,
  icon,
  iconEnd,
  className,
  disabled,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      data-slot="button"
      data-variant={variant}
      type={type}
      className={buttonClasses({ variant, size, fullWidth, loading, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <ButtonContent icon={icon} iconEnd={iconEnd} loading={loading} size={size}>
        {loading && loadingLabel ? loadingLabel : children}
      </ButtonContent>
    </button>
  );
}

export interface ButtonLinkProps extends Omit<ComponentProps<typeof Link>, 'children'>, ButtonStyleOptions {
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
