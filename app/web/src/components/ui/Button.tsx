import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
export type ButtonSize = 'md' | 'sm'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Optional leading icon. `children` (the verb-phrase label) is always required —
   * P.9 rule 5: "Icon + word label for every primary action, never icon-only." This
   * component has no icon-only mode, so that rule can't be broken by using it. */
  icon?: LucideIcon
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80',
  secondary: 'bg-accent text-accent-foreground hover:bg-accent/80 active:bg-accent/70',
  outline: 'border border-input bg-transparent text-foreground hover:bg-muted active:bg-muted/80',
  ghost: 'bg-transparent text-foreground hover:bg-muted active:bg-muted/80',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  // Both sizes keep the 44px floor (P.9 rule 9); `sm` is only narrower, never shorter.
  md: 'min-h-[44px] px-4 text-base gap-2',
  sm: 'min-h-[44px] px-3 text-sm gap-1.5',
}

/** The one button component for the app — see app/DESIGN.md §5. Verb-phrase labels
 * only ("Check in", "Send to families"), never "Submit"/"OK"/"Process". */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { icon: Icon, variant = 'primary', size = 'md', className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium',
        'transition-colors duration-150 motion-reduce:transition-none',
        'disabled:opacity-50 disabled:pointer-events-none',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      {Icon && <Icon className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} aria-hidden="true" />}
      <span>{children}</span>
    </button>
  )
})

export default Button
