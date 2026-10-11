import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '@/admin/AuthContext'
import { Spinner } from '@/admin/components/ui'

/**
 * Gates the admin shell behind a signed-in Firebase user.
 *
 * The requested path travels along in `state.from`, so a session that expires
 * on `/admin/blog/meu-post` comes back to that post after logging in instead of
 * dumping you on the dashboard to navigate again.
 */
export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-ink">
        <Spinner label="Verificando sessão" />
      </div>
    )
  }

  if (!user) {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  return <Outlet />
}
