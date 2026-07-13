import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Button from '../../components/ui/Button'

/** Public marketing/landing route tree — stub. Real copy/design lands with T-005. */
export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 gap-4 bg-background">
      <h1 className="text-3xl font-bold text-foreground">Amityx</h1>
      <p className="text-base text-muted-foreground max-w-sm">
        Booking, roster, and check-in for toddler &amp; preschool activity hubs.
      </p>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Route stub: <code>/</code> marketing
      </p>
      <Link to="/signup">
        <Button icon={ArrowRight} className="mt-2">
          Start your hub
        </Button>
      </Link>
    </div>
  )
}
