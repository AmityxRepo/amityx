import { type ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/Card'

interface WizardShellProps {
  stepNumber: number
  totalSteps: number
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}

/** Shared frame for every signup step: a warm centered card, a progress bar, one
 * clear title (the screen's single job — P.9 rule 1/2), and a footer for the
 * primary/secondary actions. Mobile-first at 375px. */
export default function WizardShell({
  stepNumber,
  totalSteps,
  title,
  description,
  children,
  footer,
}: WizardShellProps) {
  const pct = Math.round((stepNumber / totalSteps) * 100)
  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <span className="font-semibold text-primary text-lg">Amityx</span>
          <span className="text-sm text-muted-foreground">
            Step {stepNumber} of {totalSteps}
          </span>
        </div>

        <div
          className="mb-6 h-1.5 w-full rounded-pill bg-muted overflow-hidden"
          role="progressbar"
          aria-valuenow={stepNumber}
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-label="Signup progress"
        >
          <div className="h-full rounded-pill bg-primary transition-all duration-150" style={{ width: `${pct}%` }} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{title}</CardTitle>
            {description && <CardDescription className="text-base">{description}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-5">{children}</CardContent>
          {footer && <div className="px-5 pb-5 pt-1 flex flex-col gap-2">{footer}</div>}
        </Card>
      </div>
    </div>
  )
}
