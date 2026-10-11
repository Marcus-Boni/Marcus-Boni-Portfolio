import { Navigate, Route, Routes } from 'react-router-dom'

import { AdminContentProvider } from '@/admin/AdminContentContext'
import { AuthProvider } from '@/admin/AuthContext'
import { InboxProvider } from '@/admin/InboxContext'
import { PostsProvider } from '@/admin/PostsContext'
import { AdminLayout } from '@/admin/components/AdminLayout'
import { ProtectedRoute } from '@/admin/components/ProtectedRoute'
import { ConfirmProvider } from '@/admin/components/overlays'
import { ToastProvider } from '@/admin/components/toast'
import { Analytics } from '@/admin/pages/Analytics'
import { BlogEditor } from '@/admin/pages/BlogEditor'
import { BlogList } from '@/admin/pages/BlogList'
import { Dashboard } from '@/admin/pages/Dashboard'
import { Experience } from '@/admin/pages/Experience'
import { Login } from '@/admin/pages/Login'
import { Media } from '@/admin/pages/Media'
import { Messages } from '@/admin/pages/Messages'
import { Profile } from '@/admin/pages/Profile'
import { Projects } from '@/admin/pages/Projects'
import { Settings } from '@/admin/pages/Settings'

/**
 * Data providers for the authenticated shell.
 *
 * All three are session-scoped and shared: the content draft (so a half-edited
 * project survives a jump to another page), the inbox subscription (one
 * listener feeding the badge, the dashboard and the inbox), and the post index
 * (one read feeding the list, the dashboard and the command palette).
 */
function AdminShell() {
  return (
    <AdminContentProvider>
      <InboxProvider>
        <PostsProvider>
          <AdminLayout />
        </PostsProvider>
      </InboxProvider>
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
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <Routes>
            <Route path="login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AdminShell />}>
                <Route index element={<Dashboard />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="messages" element={<Messages />} />
                <Route path="blog" element={<BlogList />} />
                <Route path="blog/new" element={<BlogEditor />} />
                <Route path="blog/:slug" element={<BlogEditor />} />
                <Route path="media" element={<Media />} />
                <Route path="projects" element={<Projects />} />
                <Route path="experience" element={<Experience />} />
                <Route path="profile" element={<Profile />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  )
}
