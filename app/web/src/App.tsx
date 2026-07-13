import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { isSupabaseConfigured } from './lib/supabase'
import { AuthProvider } from './auth/AuthProvider'
import RequireAuth from './auth/RequireAuth'
import RequireCrmAdmin from './auth/RequireCrmAdmin'
import SetupNeeded from './components/SetupNeeded'
import AppLayout from './components/layout/AppLayout'
import CrmLayout from './components/layout/CrmLayout'
import Landing from './pages/marketing/Landing'
import HubPage from './pages/marketing/HubPage'
import Signup from './pages/marketing/Signup'
import Login from './pages/marketing/Login'
import ResetPassword from './pages/marketing/ResetPassword'
import AcceptInvite from './pages/marketing/AcceptInvite'
import AppHome from './pages/app/AppHome'
import Roster from './pages/app/Roster'
import AddChild from './pages/app/AddChild'
import ChildDetail from './pages/app/ChildDetail'
import Requests from './pages/app/Requests'
import More from './pages/app/More'
import SessionDetail from './pages/app/SessionDetail'
import Kiosk from './pages/app/Kiosk'
import CrmHome from './pages/crm/CrmHome'
import CrmHubs from './pages/crm/CrmHubs'
import CrmHubDetail from './pages/crm/CrmHubDetail'
import KitchenSink from './pages/dev/KitchenSink'

export default function App() {
  return (
    <BrowserRouter>
      {/* AuthProvider mirrors the supabase-js session into React (T-006). It is
       * safe when Supabase is unconfigured (client null -> no session). */}
      <AuthProvider>
        <Routes>
          {/* Dev-only design-system reference (T-004). Static components, no Supabase
           * data — always reachable so the design system can be reviewed without
           * env setup, even though every other route is gated below. */}
          <Route path="/dev/kitchen-sink" element={<KitchenSink />} />

          {!isSupabaseConfigured ? (
            // Blank/missing Supabase env must never render a white screen (T-003
            // acceptance check #2) — show a friendly setup screen instead.
            <Route path="*" element={<SetupNeeded />} />
          ) : (
            <>
              {/* Public: marketing/landing */}
              <Route path="/" element={<Landing />} />

              {/* Public: per-hub booking/waitlist page (T-010) — single scroll, no
                  nav (P.9 rule 6), curated anon read via get_public_hub_page RPC. */}
              <Route path="/h/:slug" element={<HubPage />} />

              {/* Public: hub owner self-serve signup + auth (T-006) */}
              <Route path="/signup" element={<Signup />} />
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              {/* Staff invite landing — invitee creates/uses their own account here */}
              <Route path="/accept-invite" element={<AcceptInvite />} />

              {/* Hub surface — mobile-first PWA (owner + staff); signed-in only (T-006).
                  Nav = 4 bottom tabs max (Today/Roster/Requests/More, P.9 rule 6).
                  Kiosk mode (T-007) renders full-screen OUTSIDE AppLayout — no header,
                  no bottom nav — so there's nothing for a parent to navigate away with. */}
              <Route element={<RequireAuth />}>
                <Route path="/app" element={<AppLayout />}>
                  <Route index element={<AppHome />} />
                  <Route path="roster" element={<Roster />} />
                  <Route path="roster/new" element={<AddChild />} />
                  <Route path="roster/:childId" element={<ChildDetail />} />
                  <Route path="requests" element={<Requests />} />
                  <Route path="more" element={<More />} />
                  <Route path="classes/:sessionId" element={<SessionDetail />} />
                </Route>
                <Route path="/app/classes/:sessionId/kiosk" element={<Kiosk />} />
              </Route>

              {/* Internal CRM — desktop-first, platform staff only. TWO-layer gate
               * (T-008): RequireCrmAdmin (UX) + RLS on every crm_* table (real
               * boundary) — hub_owner/hub_staff are denied identically to a
               * stranger, since neither has a crm_admins row. */}
              <Route element={<RequireCrmAdmin />}>
                <Route path="/crm" element={<CrmLayout />}>
                  <Route index element={<CrmHome />} />
                  <Route path="hubs" element={<CrmHubs />} />
                  <Route path="hubs/:hubId" element={<CrmHubDetail />} />
                </Route>
              </Route>

              {/* Catch-all: unknown paths redirect home rather than showing a blank page */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
