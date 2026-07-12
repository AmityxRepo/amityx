import { forwardRef, type LabelHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
}

const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { className, required, children, ...props },
  ref,
) {
  return (
    <label ref={ref} className={cn('block text-sm font-medium text-foreground', className)} {...props}>
      {children}
      {required && (
        <span className="text-destructive" aria-hidden="true">
          {' '}
          *
        </span>
      )}
    </label>
  )
})

export default Label
