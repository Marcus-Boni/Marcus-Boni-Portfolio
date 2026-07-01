import { Navigate, Outlet } from 'react-router-dom'

import { useAuth } from '@/admin/AuthContext'
import { Spinner } from '@/admin/components/ui'

/** Gates the admin shell behind a signed-in Firebase user. */
export function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-ink">
        <Spinner label="Verificando sessão" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />
  }

  return <Outlet />
}
