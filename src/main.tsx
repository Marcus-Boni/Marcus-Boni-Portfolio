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
