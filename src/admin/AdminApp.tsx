import { Navigate, Route, Routes } from 'react-router-dom'

import { AdminContentProvider } from '@/admin/AdminContentContext'
import { AuthProvider } from '@/admin/AuthContext'
import { AdminLayout } from '@/admin/components/AdminLayout'
import { ProtectedRoute } from '@/admin/components/ProtectedRoute'
import { Analytics } from '@/admin/pages/Analytics'
import { Dashboard } from '@/admin/pages/Dashboard'
import { Experience } from '@/admin/pages/Experience'
import { Login } from '@/admin/pages/Login'
import { Messages } from '@/admin/pages/Messages'
import { Profile } from '@/admin/pages/Profile'
import { Projects } from '@/admin/pages/Projects'
import { Settings } from '@/admin/pages/Settings'

/** Content provider wrapped around the authenticated admin shell. */
function AdminShell() {
  return (
    <AdminContentProvider>
      <AdminLayout />
    </AdminContentProvider>
  )
}

/**
 * Self-contained admin router. Mounted under `/admin/*` so every route here is
 * relative to it. Auth lives only inside this subtree — the public site never
 * pays for it.
 */
export default function AdminApp() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AdminShell />}>
            <Route index element={<Dashboard />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="messages" element={<Messages />} />
            <Route path="projects" element={<Projects />} />
            <Route path="experience" element={<Experience />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AuthProvider>
  )
}
