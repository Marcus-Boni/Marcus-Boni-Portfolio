import { useEffect, useMemo, useState } from 'react'

import {
  subscribeAnalytics,
  summarize,
  type AnalyticsEvent,
  type AnalyticsSummary,
} from '@/admin/services/analytics'
import {
  subscribeMessages,
  type ContactMessage,
} from '@/lib/messages'

export function useAnalytics(): {
  events: AnalyticsEvent[]
  summary: AnalyticsSummary
  loading: boolean
} {
  const [events, setEvents] = useState<AnalyticsEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = subscribeAnalytics((next) => {
      setEvents(next)
      setLoading(false)
    })
    return unsub
  }, [])

  const summary = useMemo(() => summarize(events), [events])
  return { events, summary, loading }
}

export function useMessages(): {
  messages: ContactMessage[]
  unread: number
  loading: boolean
} {
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = subscribeMessages((next) => {
      setMessages(next)
      setLoading(false)
    })
    return unsub
  }, [])

  const unread = useMemo(
    () => messages.filter((m) => !m.read).length,
    [messages],
  )
  return { messages, unread, loading }
}
