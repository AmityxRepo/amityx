export function slugify(name: string): string
export function isValidSlug(slug: string): boolean
export function withSuffix(base: string, n: number): string
export function nextAvailableSlug(
  base: string,
  isTaken: (slug: string) => boolean,
  max?: number,
): string
