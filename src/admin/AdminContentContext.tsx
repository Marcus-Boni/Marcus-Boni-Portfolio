import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

/** The editable sections, in the order the sidebar lists them. */
const SECTIONS: { key: keyof SiteContent; label: string }[] = [
  { key: 'profile', label: 'Perfil' },
  { key: 'projects', label: 'Projetos' },
  { key: 'experience', label: 'Carreira' },
  { key: 'techStack', label: 'Stack' },
  { key: 'socials', label: 'Redes' },
]

interface AdminContentValue {
  draft: SiteContent
  loading: boolean
  saving: boolean
  dirty: boolean
  /** Human names of the sections that differ from the server copy. */
  changed: string[]
  /** Last successful save in this session, if any. */
  savedAt: Date | null
  error: string | null
  /** Mutate a copy of the draft immutably. */
  update: (mutator: (draft: SiteContent) => SiteContent) => void
  /** Replace the whole draft — used by the JSON import. */
  replace: (next: SiteContent) => void
  /** Resolves to `true` when the write landed. */
  save: () => Promise<boolean>
  /** Discard local edits, restoring the last loaded server state. */
  revert: () => void
  /** Overwrite everything with the static defaults (and persist). */
  resetToDefaults: () => Promise<boolean>
}

const AdminContentContext = createContext<AdminContentValue | null>(null)

export function AdminContentProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<SiteContent>(cloneDefaultContent)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  /**
   * The last known server copy, in state rather than a ref: the diff below is
   * rendered, and a value you render has to be state or React has no reason to
   * re-run the comparison.
   */
  const [server, setServer] = useState<SiteContent>(cloneDefaultContent)

  useEffect(() => {
    let active = true
    fetchSiteContent()
      .then((content) => {
        if (!active) return
        setServer(content)
        setDraft(structuredClone(content))
      })
      .catch((cause: unknown) => {
        if (!active) return
        setError(
          cause instanceof Error
            ? `Falha ao carregar o conteúdo: ${cause.message}`
            : 'Falha ao carregar o conteúdo.',
        )
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  /**
   * `dirty` is derived, not tracked.
   *
   * The old flag was set by `update()` and never cleared until a save, so
   * typing a character and deleting it left the bar claiming unsaved work
   * forever. Comparing against the server copy also gives the save bar
   * something useful to say: *which* sections changed.
   */
  const changed = useMemo(
    () =>
      SECTIONS.filter(
        ({ key }) => JSON.stringify(draft[key]) !== JSON.stringify(server[key]),
      ).map(({ label }) => label),
    [draft, server],
  )

  const dirty = changed.length > 0

  // The browser's own guard. It cannot be styled or worded, but it is the only
  // thing that catches a closed tab — and closing the tab is exactly how an
  // afternoon of edits disappears.
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const update = useCallback((mutator: (draft: SiteContent) => SiteContent) => {
    setDraft((prev) => mutator(structuredClone(prev)))
  }, [])

  const replace = useCallback((next: SiteContent) => {
    setDraft(structuredClone(next))
  }, [])

  const save = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      await saveSiteContent(draft)
      setServer(structuredClone(draft))
      setSavedAt(new Date())
      return true
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível salvar. Tente novamente.',
      )
      return false
    } finally {
      setSaving(false)
    }
  }, [draft])

  const revert = useCallback(() => {
    setDraft(structuredClone(server))
    setError(null)
  }, [server])

  const resetToDefaults = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      await resetSiteContent()
      const fresh = cloneDefaultContent()
      setServer(fresh)
      setDraft(structuredClone(fresh))
      setSavedAt(new Date())
      return true
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Não foi possível restaurar os padrões.',
      )
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  const value = useMemo<AdminContentValue>(
    () => ({
      draft,
      loading,
      saving,
      dirty,
      changed,
      savedAt,
      error,
      update,
      replace,
      save,
      revert,
      resetToDefaults,
    }),
    [
      draft,
      loading,
      saving,
      dirty,
      changed,
      savedAt,
      error,
      update,
      replace,
      save,
      revert,
      resetToDefaults,
    ],
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
