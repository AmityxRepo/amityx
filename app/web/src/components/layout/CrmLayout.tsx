import { NavLink, Outlet } from 'react-router-dom'

/** Desktop-first internal surface shell (platform staff only, gated behind crm_admins). */
const NAV = [
  { to: '/crm', label: 'Dashboard', end: true },
  { to: '/crm/hubs', label: 'Hubs pipeline', end: false },
]

export default function CrmLayout() {
  return (
    <div className="min-h-screen flex bg-muted">
      <aside className="hidden md:flex flex-col w-56 bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0">
        <div className="px-4 py-5 border-b border-sidebar-foreground/10">
          <span className="font-semibold">Amityx CRM</span>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-1">
          {NAV.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium min-h-[44px] flex items-center ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-sidebar-foreground/80 hover:text-sidebar-foreground'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 md:ml-56 p-6">
        <Outlet />
      </main>
    </div>
  )
}
