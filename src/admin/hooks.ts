import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  eventsToCsv,
  subscribeAnalytics,
  summarize,
  type AnalyticsEvent,
  type AnalyticsSummary,
  type RangeKey,
} from '@/admin/services/analytics'
import { subscribeMessages, type ContactMessage } from '@/lib/messages'

/** Surfaced verbatim: a Firestore `failed-precondition` message carries the
 *  console URL that creates the missing index, so hiding it hides the fix. */
export interface AnalyticsError {
  code: string
  message: string
}

export interface UseAnalyticsResult {
  events: AnalyticsEvent[]
  summary: AnalyticsSummary
  loading: boolean
  error: AnalyticsError | null
  range: RangeKey
  setRange: (next: RangeKey) => void
  /** Downloads the raw events for the current window as CSV. */
  exportCsv: () => void
}

/**
 * Live analytics for the selected window.
 *
 * The subscription is re-created when the range changes, because the range is
 * part of the Firestore query rather than a client-side filter — that is what
 * keeps the read count proportional to what is actually being looked at.
 */
export function useAnalytics(initialRange: RangeKey = '30d'): UseAnalyticsResult {
  const [range, setRange] = useState<RangeKey>(initialRange)
  const [events, setEvents] = useState<AnalyticsEvent[] | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [error, setError] = useState<AnalyticsError | null>(null)

  useEffect(() => {
    let cancelled = false
    const unsubscribe = subscribeAnalytics(
      range,
      (feed) => {
        if (cancelled) return
        setEvents(feed.events)
        setTruncated(feed.truncated)
        setError(null)
      },
      (cause) => {
        if (cancelled) return
        setError({
          code: (cause as { code?: string }).code ?? 'unknown',
          message: cause.message,
        })
        // Resolve the loading state too, or the page shows the error banner
        // *and* an endless spinner — which is what it did the first time.
        setEvents([])
      },
    )
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [range])

  const loaded = useMemo(() => events ?? [], [events])

  const summary = useMemo(
    () => summarize(loaded, range, { truncated }),
    [loaded, range, truncated],
  )

  const exportCsv = useCallback(() => {
    const csv = eventsToCsv(loaded)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `marcusboni-analytics-${range}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [loaded, range])

  return {
    events: loaded,
    summary,
    loading: events === null,
    error,
    range,
    setRange,
    exportCsv,
  }
}

export function useMessages(): {
  messages: ContactMessage[]
  unread: number
  loading: boolean
} {
  const [messages, setMessages] = useState<ContactMessage[] | null>(null)

  useEffect(() => {
    const unsubscribe = subscribeMessages(setMessages)
    return unsubscribe
  }, [])

  const loaded = useMemo(() => messages ?? [], [messages])
  const unread = useMemo(
    () => loaded.filter((message) => !message.read).length,
    [loaded],
  )

  return { messages: loaded, unread, loading: messages === null }
}
