import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { onFirstInteraction } from '@/lib/defer'
import { isFirebaseConfigured } from '@/lib/firebase-config'

import { cloneDefaultContent } from './defaults'
import type { SiteContent } from './types'

interface SiteContentValue {
  content: SiteContent
  loading: boolean
  /** `live` once Firestore has answered; `static` when Firebase is off. */
  source: 'live' | 'static'
}

const SiteContentContext = createContext<SiteContentValue | null>(null)

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<SiteContent>(cloneDefaultContent)
  const [loading, setLoading] = useState(isFirebaseConfigured)

  useEffect(() => {
    if (!isFirebaseConfigured) return
    let unsubscribe = () => {}
    let cancelled = false
    // The bundled defaults render instantly; the live Firestore copy only
    // matters once someone is actually reading, so the SDK download + connect
    // waits for the first interaction and stays out of the load window.
    const cancelDefer = onFirstInteraction(() => {
      void import('./service').then(({ subscribeSiteContent }) => {
        if (cancelled) return
        unsubscribe = subscribeSiteContent(
          (next) => {
            setContent(next)
            setLoading(false)
          },
          () => setLoading(false),
        )
      })
    })
    return () => {
      cancelled = true
      cancelDefer()
      unsubscribe()
    }
  }, [])

  const value = useMemo<SiteContentValue>(
    () => ({
      content,
      loading,
      source: isFirebaseConfigured ? 'live' : 'static',
    }),
    [content, loading],
  )

  return (
    <SiteContentContext.Provider value={value}>
      {children}
    </SiteContentContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSiteContent(): SiteContentValue {
  const context = useContext(SiteContentContext)
  if (!context) {
    throw new Error('useSiteContent must be used inside <SiteContentProvider>')
  }
  return context
}
