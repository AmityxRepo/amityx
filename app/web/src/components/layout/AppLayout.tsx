import { NavLink, Outlet } from 'react-router-dom'
import { CalendarDays, Users, Inbox, MoreHorizontal } from 'lucide-react'
import InstallPrompt from '../InstallPrompt'

/**
 * Mobile-first hub surface shell (owner + staff). D-012/P.9: bottom nav is capped at
 * 4 tabs max, one navigation pattern, never changing (rule 6) — future screens
 * DISPLACE one of these, they never get a 5th added. Check-in/kiosk is reached
 * CONTEXTUALLY from Today -> a class, not its own tab (T-007 spec).
 */
const TABS = [
  { to: '/app', label: 'Today', end: true, icon: CalendarDays },
  { to: '/app/roster', label: 'Roster', end: false, icon: Users },
  { to: '/app/requests', label: 'Requests', end: false, icon: Inbox },
  { to: '/app/more', label: 'More', end: false, icon: MoreHorizontal },
]

export default function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="h-14 flex items-center px-4 border-b border-border">
        <span className="font-semibold text-primary">Amityx</span>
      </header>

      <main className="flex-1 pb-20">
        <Outlet />
      </main>

      <InstallPrompt />

      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border flex">
        {TABS.map(({ to, label, end, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[44px] text-xs font-medium ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
