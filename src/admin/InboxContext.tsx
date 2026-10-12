import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  deleteMessage,
  markMessageRead,
  subscribeMessages,
  type ContactMessage,
} from '@/lib/messages'

/**
 * The contact inbox, subscribed once for the whole admin.
 *
 * It used to be a hook, which meant the dashboard and the inbox page each
 * opened their own `onSnapshot` — two live listeners over the same collection,
 * billed twice. Hoisting it also gives the sidebar its unread badge for free:
 * the count is already in memory, so the nav can show it without a second read.
 */

interface InboxValue {
  messages: ContactMessage[]
  unread: number
  loading: boolean
  /** Newest first, unread pulled to the top — the order the page renders. */
  sorted: ContactMessage[]
  markRead: (id: string, read: boolean) => Promise<void>
  markAllRead: () => Promise<void>
  remove: (id: string) => Promise<void>
  /** Restores a locally deleted message is impossible — see `remove`. */
  exportCsv: () => void
}

const InboxContext = createContext<InboxValue | null>(null)

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function InboxProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ContactMessage[] | null>(null)

  useEffect(() => subscribeMessages(setMessages), [])

  const loaded = useMemo(() => messages ?? [], [messages])
  const unread = useMemo(() => loaded.filter((m) => !m.read).length, [loaded])

  const sorted = useMemo(
    () =>
      [...loaded].sort((a, b) => {
        if (a.read !== b.read) return a.read ? 1 : -1
        return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
      }),
    [loaded],
  )

  const markRead = useCallback(async (id: string, read: boolean) => {
    await markMessageRead(id, read)
  }, [])

  const markAllRead = useCallback(async () => {
    // Sequential on purpose: a personal inbox never has enough unread messages
    // for the parallelism to matter, and one failure should not leave the rest
    // in an unknown state.
    for (const message of loaded) {
      if (!message.read) await markMessageRead(message.id, true)
    }
  }, [loaded])

  const remove = useCallback(async (id: string) => {
    await deleteMessage(id)
  }, [])

  const exportCsv = useCallback(() => {
    const header = ['data', 'nome', 'email', 'idioma', 'pais', 'lida', 'mensagem']
    const rows = sorted.map((m) =>
      [
        m.createdAt ? m.createdAt.toISOString() : '',
        m.name,
        m.email,
        m.locale,
        m.country ?? '',
        m.read ? 'sim' : 'nao',
        m.message,
      ]
        .map(csvCell)
        .join(','),
    )
    const csv = [header.join(','), ...rows].join('\n')
    // The BOM is what makes Excel open a UTF-8 CSV with accents intact.
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `marcusboni-mensagens-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [sorted])

  const value = useMemo<InboxValue>(
    () => ({
      messages: loaded,
      sorted,
      unread,
      loading: messages === null,
      markRead,
      markAllRead,
      remove,
      exportCsv,
    }),
    [loaded, sorted, unread, messages, markRead, markAllRead, remove, exportCsv],
  )

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useInbox(): InboxValue {
  const context = useContext(InboxContext)
  if (!context) {
    throw new Error('useInbox must be used inside <InboxProvider>')
  }
  return context
}
