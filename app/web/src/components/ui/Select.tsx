import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
}

/** A native <select> styled to match Input (same border/height/text-size tokens —
 * DESIGN.md §5 doesn’t have a dedicated Select yet; this follows Input’s exact
 * classes rather than inventing a one-off look, per §10's agent note. */
const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        'block w-full min-h-[44px] rounded-md border bg-card px-3 text-base text-foreground',
        invalid ? 'border-destructive' : 'border-input',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  )
})

export default Select
