import { type HTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

export type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'destructive'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  /** Optional status icon — status is always dual-encoded (icon + word), never
   * color/hue alone, so it still reads correctly for color-blind users. */
  icon?: LucideIcon
}

// Solid fills, not translucent tints — every pair below is the exact contrast-checked
// combination from app/DESIGN.md §2 (translucent tints drift out of AA at small sizes).
const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-accent text-accent-foreground',
  success: 'bg-success text-success-foreground',
  warning: 'bg-warning text-warning-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
}

export default function Badge({ variant = 'neutral', icon: Icon, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-medium',
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {children}
    </span>
  )
}
