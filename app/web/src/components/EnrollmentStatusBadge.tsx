import { CheckCircle2, Clock, XCircle, CircleCheck } from 'lucide-react'
import Badge from './ui/Badge'
import type { EnrollmentStatus } from '../repository/schema'

const CONFIG: Record<EnrollmentStatus, { label: string; variant: 'success' | 'warning' | 'neutral'; icon: typeof CheckCircle2 }> = {
  active: { label: 'Signed up', variant: 'success', icon: CheckCircle2 },
  waitlisted: { label: 'Waitlisted', variant: 'warning', icon: Clock },
  completed: { label: 'Completed', variant: 'neutral', icon: CircleCheck },
  cancelled: { label: 'Cancelled', variant: 'neutral', icon: XCircle },
}

export default function EnrollmentStatusBadge({ status }: { status: EnrollmentStatus }) {
  const { label, variant, icon } = CONFIG[status]
  return (
    <Badge variant={variant} icon={icon}>
      {label}
    </Badge>
  )
}
