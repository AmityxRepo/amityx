import { Link } from 'react-router-dom'

/** Public marketing/landing route tree — stub. Real copy/design lands with T-004/T-005. */
export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 gap-4">
      <h1 className="text-3xl font-semibold text-brand-700">Amityx</h1>
      <p className="text-gray-600 max-w-sm">
        Booking, roster, and check-in for toddler &amp; preschool activity hubs.
      </p>
      <p className="text-xs uppercase tracking-wide text-gray-400">
        Route stub: <code>/</code> marketing
      </p>
      <Link
        to="/signup"
        className="mt-2 inline-flex items-center justify-center rounded-lg bg-brand-600 text-white px-5 py-2.5 text-sm font-medium min-h-[44px]"
      >
        Start your hub
      </Link>
    </div>
  )
}
