import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { repository } from '../repository'

/**
 * Route guard for /crm/* (T-008). TWO layers gate the CRM, per the spec:
 *   1. THIS guard (UX only) — redirects a signed-out visitor to /login, and a
 *      signed-in NON-admin to /app (never a white screen, never a dead end).
 *   2. RLS on every crm_* table (is_crm_admin(), T-005/T-008 migrations) — the
 *      real security boundary. A user who somehow bypassed this guard would
 *      still get zero rows back from every crm_* query.
 * hub_owner and hub_staff are both non-admins here — neither role has a
 * crm_admins row, so both are denied identically.
 */
export default function RequireCrmAdmin() {
  const { session, loading } = useAuth()
  const location = useLocation()
  const [checked, setChecked] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (loading || !session) return
    let active = true
    setChecked(false)
    ;(async () => {
      const admin = repository ? await repository.isCrmAdmin().catch(() => false) : false
      if (!active) return
      setIsAdmin(admin)
      setChecked(true)
    })()
    return () => {
      active = false
    }
  }, [loading, session])

  if (loading || (session && !checked)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground" role="status">
          Loading…
        </p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  if (!isAdmin) {
    // Signed in but not platform staff — send them to their own surface rather
    // than a dead end (P.9 rule 8: Back/redirects always land somewhere useful).
    return <Navigate to="/app" replace />
  }

  return <Outlet />
}
