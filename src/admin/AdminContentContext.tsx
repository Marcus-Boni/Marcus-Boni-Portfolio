import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { cloneDefaultContent } from '@/content/defaults'
import {
  fetchSiteContent,
  resetSiteContent,
  saveSiteContent,
} from '@/content/service'
import type { SiteContent } from '@/content/types'

interface AdminContentValue {
  draft: SiteContent
  loading: boolean
  saving: boolean
  dirty: boolean
  /** Mutate a copy of the draft immutably. */
  update: (mutator: (draft: SiteContent) => SiteContent) => void
  save: () => Promise<void>
  /** Discard local edits, restoring the last loaded server state. */
  revert: () => void
  /** Overwrite everything with the static defaults (and persist). */
  resetToDefaults: () => Promise<void>
}

const AdminContentContext = createContext<AdminContentValue | null>(null)

export function AdminContentProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<SiteContent>(cloneDefaultContent)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const serverRef = useRef<SiteContent>(cloneDefaultContent())

  useEffect(() => {
    let active = true
    fetchSiteContent()
      .then((content) => {
        if (!active) return
        serverRef.current = content
        setDraft(content)
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const update = useCallback(
    (mutator: (draft: SiteContent) => SiteContent) => {
      setDraft((prev) => mutator(structuredClone(prev)))
      setDirty(true)
    },
    [],
  )

  const save = useCallback(async () => {
    setSaving(true)
    try {
      await saveSiteContent(draft)
      serverRef.current = structuredClone(draft)
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }, [draft])

  const revert = useCallback(() => {
    setDraft(structuredClone(serverRef.current))
    setDirty(false)
  }, [])

  const resetToDefaults = useCallback(async () => {
    setSaving(true)
    try {
      await resetSiteContent()
      const fresh = cloneDefaultContent()
      serverRef.current = fresh
      setDraft(fresh)
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }, [])

  const value = useMemo<AdminContentValue>(
    () => ({ draft, loading, saving, dirty, update, save, revert, resetToDefaults }),
    [draft, loading, saving, dirty, update, save, revert, resetToDefaults],
  )

  return (
    <AdminContentContext.Provider value={value}>
      {children}
    </AdminContentContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdminContent(): AdminContentValue {
  const context = useContext(AdminContentContext)
  if (!context) {
    throw new Error('useAdminContent must be used inside <AdminContentProvider>')
  }
  return context
}
