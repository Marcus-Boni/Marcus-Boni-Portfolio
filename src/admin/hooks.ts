import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  eventsToCsv,
  subscribeAnalytics,
  summarize,
  type AnalyticsEvent,
  type AnalyticsSummary,
  type RangeKey,
} from '@/admin/services/analytics'

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

/* ─── Keyboard ──────────────────────────────────────────────────────────── */

export interface HotkeySpec {
  /** Compared case-insensitively against `event.key`. */
  key: string
  /** Requires Ctrl on Windows/Linux or ⌘ on macOS. */
  mod?: boolean
  shift?: boolean
}

/**
 * Window-level shortcut.
 *
 * Two details matter. The handler lives in a ref so a shortcut registered with
 * an inline closure does not tear down and re-bind on every render. And typing
 * inside a field never triggers a bare letter shortcut — only modified ones —
 * so `?` in a message body stays a question mark.
 */
export function useHotkey(
  spec: HotkeySpec,
  handler: (event: KeyboardEvent) => void,
  enabled = true,
): void {
  // The handler lives in a ref, written in its own effect: assigning during
  // render is what `react-hooks/refs` forbids, and re-binding the listener on
  // every render is what the ref exists to avoid.
  const latest = useRef(handler)
  useEffect(() => {
    latest.current = handler
  }, [handler])

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== spec.key.toLowerCase()) return
      const mod = event.ctrlKey || event.metaKey
      if (Boolean(spec.mod) !== mod) return
      if (Boolean(spec.shift) !== event.shiftKey) return

      if (!spec.mod) {
        const target = event.target as HTMLElement | null
        const tag = target?.tagName
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target?.isContentEditable
        ) {
          return
        }
      }

      event.preventDefault()
      latest.current(event)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [spec.key, spec.mod, spec.shift, enabled])
}

/* ─── Small utilities ───────────────────────────────────────────────────── */

/**
 * State mirrored into `localStorage`.
 *
 * Used for the preferences that are annoying to re-set on every visit — the
 * remembered login e-mail, whether editor cards start collapsed, the last
 * analytics window. Reads are wrapped because Safari's private mode throws on
 * access rather than returning null.
 */
export function useStoredState<T>(
  key: string,
  initial: T,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? initial : (JSON.parse(raw) as T)
    } catch {
      return initial
    }
  })

  const update = useCallback(
    (next: T) => {
      setValue(next)
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        /* storage unavailable — the in-memory value still works */
      }
    },
    [key],
  )

  return [value, update]
}

/** Debounced mirror of a fast-changing value (search fields, mostly). */
export function useDebounced<T>(value: T, delay = 180): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(id)
  }, [value, delay])
  return debounced
}
