import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getSupabaseClient } from '../lib/supabase'

/**
 * App-wide auth state (T-006). Wraps supabase-js session handling: reads the
 * persisted session on load and subscribes to auth changes (sign-in via password,
 * email-link confirmation, sign-out, background token refresh). supabase-js keeps
 * the session in localStorage and auto-refreshes it — this provider just mirrors
 * that into React so guards/screens react to it. (No @supabase/ssr: this is a
 * static SPA with no server; see lib/supabase.ts.)
 */
interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = getSupabaseClient()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!client) {
      setLoading(false)
      return
    }
    let active = true
    client.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return
        setSession(data.session)
        setLoading(false)
      })
      .catch(() => active && setLoading(false))

    const { data: sub } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [client])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signOut: async () => {
        await client?.auth.signOut()
      },
      refresh: async () => {
        if (!client) return
        const { data } = await client.auth.getSession()
        setSession(data.session)
      },
    }),
    [session, loading, client],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
