/**
 * The `cn` helper - the one piece of infrastructure the shadcn/ui CLI
 * expects every component to import.
 *
 * Two jobs, in order:
 *   1. `clsx` turns anything conditional into a class string: strings,
 *      arrays, and `{ 'is-open': isOpen }` objects.
 *   2. `tailwind-merge` resolves conflicts between Tailwind utilities, so
 *      the LAST one wins: `cn('p-2', isBig && 'p-6')` is `p-6`, not
 *      `p-2 p-6` (which is a CSS error - padding set twice).
 *
 * Without this, a component that takes a `className` prop cannot let the
 * caller override its own padding, and the caller has to know the
 * component's internals.
 *
 * The app's own components predate shadcn and do not use `cn`; they pass
 * class strings directly. This helper exists for the shadcn folder.
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
