/**
 * A child’s tile avatar: initials-in-a-circle. Photo upload/storage is T-011's
 * scope (D-011 media staging) — this renders the same visual slot so a photo can
 * drop in later without a layout change; today it’s always the initials fallback.
 */
export default function ChildAvatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
  const dims = size === 'lg' ? 'h-16 w-16 text-2xl' : 'h-11 w-11 text-base'
  return (
    <div
      className={`flex ${dims} shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-accent-foreground`}
      aria-hidden="true"
    >
      {initials || '?'}
    </div>
  )
}
