import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      // text-base (16px) keeps iOS Safari from auto-zooming on focus, and meets the
      // ≥16px body-text floor (P.9 rule 9). min-h-[44px] meets the tap-target floor.
      className={cn(
        'block w-full min-h-[44px] rounded-md border bg-card px-3 text-base text-foreground',
        'placeholder:text-muted-foreground',
        invalid ? 'border-destructive' : 'border-input',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
})

export default Input
