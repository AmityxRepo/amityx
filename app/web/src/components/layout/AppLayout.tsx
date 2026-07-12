import { NavLink, Outlet } from 'react-router-dom'
import InstallPrompt from '../InstallPrompt'

/**
 * Mobile-first hub surface shell (owner + staff). D-012/P.9: bottom nav is capped at
 * 4 tabs max — future screens DISPLACE one of these, they never get a 5th added.
 */
const TABS = [
  { to: '/app', label: 'Home', end: true },
  { to: '/app/roster', label: 'Roster', end: false },
  { to: '/app/attendance', label: 'Check-in', end: false },
  { to: '/app/more', label: 'More', end: false },
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
        {TABS.map(({ to, label, end }) => (
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
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
