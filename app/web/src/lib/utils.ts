/** Joins class names, dropping falsy values. No deps — usage here is simple enough
 * that clsx/tailwind-merge would be extra weight for no real benefit. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
