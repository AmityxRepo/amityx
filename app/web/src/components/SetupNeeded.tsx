/**
 * Rendered instead of the router whenever Supabase env vars are missing/blank.
 * Prevents a white screen for anyone who runs the app before `.env.local` is filled
 * in (T-003 acceptance check #2).
 */
export default function SetupNeeded() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-brand-100 p-8 text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold text-lg">
          A
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Setup needed</h1>
        <p className="text-sm text-gray-600 mb-4">
          Amityx can&apos;t reach Supabase yet. Copy{' '}
          <code className="px-1 py-0.5 rounded bg-gray-100 text-gray-800">.env.example</code>{' '}
          to <code className="px-1 py-0.5 rounded bg-gray-100 text-gray-800">.env.local</code> in{' '}
          <code className="px-1 py-0.5 rounded bg-gray-100 text-gray-800">app/web</code> and fill in:
        </p>
        <ul className="text-left text-sm text-gray-700 bg-gray-50 rounded-lg p-3 mb-4 space-y-1 font-mono">
          <li>VITE_SUPABASE_URL</li>
          <li>VITE_SUPABASE_ANON_KEY</li>
        </ul>
        <p className="text-xs text-gray-500">
          Restart <code>npm run dev</code> after saving. Values come from the Supabase
          project dashboard — never commit them.
        </p>
      </div>
    </div>
  )
}
