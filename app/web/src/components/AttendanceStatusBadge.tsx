import { CircleDashed, LogIn, LogOut } from 'lucide-react'
import Badge from './ui/Badge'
import type { AttendanceStatus } from '../features/attendance/queue'

/** Plain-language, icon+word status (DESIGN.md §3: status is never color alone). */
export default function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  if (status === 'checked_in') {
    return (
      <Badge variant="success" icon={LogIn}>
        Checked in
      </Badge>
    )
  }
  if (status === 'checked_out') {
    return (
      <Badge variant="neutral" icon={LogOut}>
        Checked out
      </Badge>
    )
  }
  return (
    <Badge variant="warning" icon={CircleDashed}>
      Not checked in
    </Badge>
  )
}
