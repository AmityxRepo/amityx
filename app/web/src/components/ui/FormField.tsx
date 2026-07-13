import { type ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'
import Label from './Label'

export interface FormFieldProps {
  label: string
  htmlFor: string
  required?: boolean
  /** Plain-language help shown under the control (P.9 rule 7: defaults work, but
   * hints are always visible — never hidden behind a "?" tooltip, rule 10). */
  hint?: string
  /** Plain-language error: what happened + what to do next (P.9 rule 8). */
  error?: string
  children: ReactNode
}

/** Label + control + hint/error, wired together — the one form-field pattern. */
export default function FormField({ label, htmlFor, required, hint, error, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {children}
      {error ? (
        <p className="flex items-start gap-1.5 text-sm text-destructive" role="alert">
          <CircleAlert className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}
