import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'block w-full min-h-[88px] rounded-md border bg-card px-3 py-2.5 text-base text-foreground',
        'placeholder:text-muted-foreground',
        invalid ? 'border-destructive' : 'border-input',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
})

export default Textarea
