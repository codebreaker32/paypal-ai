import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Joins class names (clsx) and lets a later Tailwind class win over an earlier one of the same kind (tailwind-merge),
 * so a caller's `className` overrides a primitive's default: cn('px-4', 'px-6') is 'px-6'.
 * Our own utilities (type-*, rule-dashed ...) are unknown to tailwind-merge and are always kept.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
