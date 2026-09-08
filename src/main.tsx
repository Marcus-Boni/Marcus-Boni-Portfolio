import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import '@/styles/index.css'
import App from '@/App'
import { SiteContentProvider } from '@/content/SiteContentContext'
import { LanguageProvider } from '@/i18n/LanguageContext'

// The admin bundle (Firebase Auth/Firestore + editor UI) is code-split so the
// public site never downloads it. (Entry file — fast-refresh rule N/A.)
// eslint-disable-next-line react-refresh/only-export-components
const AdminApp = lazy(() => import('@/admin/AdminApp'))

// The blog carries its own Markdown renderer and syntax highlighter, neither of
// which the portfolio page has any use for. `App` stays eagerly imported
// because the home route is the LCP-critical one — putting it behind a lazy
// boundary would add a network round-trip before the hero can hydrate.
// eslint-disable-next-line react-refresh/only-export-components
const BlogApp = lazy(() => import('@/blog/BlogApp'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<div className="min-h-svh bg-ink" />}>
              <AdminApp />
            </Suspense>
          }
        />
        <Route
          path="/blog/*"
          element={
            <LanguageProvider>
              <Suspense fallback={<div className="min-h-svh bg-ink" />}>
                <BlogApp />
              </Suspense>
            </LanguageProvider>
          }
        />
        <Route
          path="/*"
          element={
            <LanguageProvider>
              <SiteContentProvider>
                <App />
              </SiteContentProvider>
            </LanguageProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
