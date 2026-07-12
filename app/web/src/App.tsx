import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { isSupabaseConfigured } from './lib/supabase'
import SetupNeeded from './components/SetupNeeded'
import AppLayout from './components/layout/AppLayout'
import CrmLayout from './components/layout/CrmLayout'
import Landing from './pages/marketing/Landing'
import Signup from './pages/marketing/Signup'
import AppHome from './pages/app/AppHome'
import AppStub from './pages/app/AppStub'
import CrmHome from './pages/crm/CrmHome'
import CrmStub from './pages/crm/CrmStub'

export default function App() {
  // Blank/missing Supabase env must never render a white screen (T-003 acceptance
  // check #2) — show a friendly setup screen instead of the router entirely.
  if (!isSupabaseConfigured) {
    return <SetupNeeded />
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public: marketing/landing */}
        <Route path="/" element={<Landing />} />

        {/* Public: hub owner self-serve signup */}
        <Route path="/signup" element={<Signup />} />

        {/* Hub surface — mobile-first PWA (owner + staff); auth guard lands in T-006 */}
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<AppHome />} />
          <Route path="roster" element={<AppStub title="Roster" lands="T-007" />} />
          <Route path="attendance" element={<AppStub title="Check-in" lands="T-008" />} />
          <Route path="more" element={<AppStub title="More" lands="a later task" />} />
        </Route>

        {/* Internal CRM — desktop-first, platform staff only; auth guard lands in T-011 */}
        <Route path="/crm" element={<CrmLayout />}>
          <Route index element={<CrmHome />} />
          <Route path="hubs" element={<CrmStub title="Hubs pipeline" lands="T-011" />} />
        </Route>

        {/* Catch-all: unknown paths redirect home rather than showing a blank page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
