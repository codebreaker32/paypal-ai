import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';
import { Icon } from './Icon';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'paypal';
export type ButtonSize = 'md' | 'lg';

const BASE =
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-(--button-radius) font-semibold ' +
  'select-none transition-[background-color,border-color,color,box-shadow,transform] duration-(--duration-fast) ease-out ' +
  'active:translate-y-px disabled:pointer-events-none aria-disabled:pointer-events-none';

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-(--button-primary-bg) text-(--button-primary-fg) shadow-xs hover:bg-(--button-primary-bg-hover) ' +
    'active:bg-(--button-primary-bg-active)',
  secondary:
    'border border-(--button-secondary-border) bg-(--button-secondary-bg) text-(--button-secondary-fg) ' +
    'hover:bg-(--button-secondary-bg-hover)',
  ghost: 'text-(--button-ghost-fg) hover:bg-(--button-ghost-bg-hover) underline-offset-4',
  paypal:
    'bg-(--button-paypal-bg) text-(--button-paypal-fg) shadow-xs hover:bg-(--button-paypal-bg-hover) ' +
    'active:bg-(--button-paypal-bg-active)',
};

const SIZE: Record<ButtonSize, string> = {
  md: 'min-h-(--button-h-md) px-(--button-px-md) text-base',
  lg: 'min-h-(--button-h-lg) px-(--button-px-lg) text-lg',
};

const DISABLED = 'disabled:opacity-50 aria-disabled:opacity-50';

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
  return cx(BASE, VARIANT[variant], SIZE[size], !loading && DISABLED, fullWidth && 'w-full', className);
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
    <Link className={buttonClasses({ variant, size, fullWidth, className })} {...rest}>
      <ButtonContent icon={icon} iconEnd={iconEnd} size={size}>
        {children}
      </ButtonContent>
    </Link>
  );
}
