/**
 * Rendered instead of the router whenever Supabase env vars are missing/blank.
 * Prevents a white screen for anyone who runs the app before `.env.local` is filled
 * in (T-003 acceptance check #2).
 */
export default function SetupNeeded() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted px-4">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-card border border-border p-8 text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
          A
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-2">Setup needed</h1>
        <p className="text-base text-muted-foreground mb-4">
          Amityx can&apos;t reach Supabase yet. Copy{' '}
          <code className="px-1 py-0.5 rounded bg-muted text-foreground">.env.example</code>{' '}
          to <code className="px-1 py-0.5 rounded bg-muted text-foreground">.env.local</code> in{' '}
          <code className="px-1 py-0.5 rounded bg-muted text-foreground">app/web</code> and fill in:
        </p>
        <ul className="text-left text-sm text-foreground bg-muted rounded-lg p-3 mb-4 space-y-1 font-mono">
          <li>VITE_SUPABASE_URL</li>
          <li>VITE_SUPABASE_ANON_KEY</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Restart <code>npm run dev</code> after saving. Values come from the Supabase
          project dashboard — never commit them.
        </p>
      </div>
    </div>
  )
}
