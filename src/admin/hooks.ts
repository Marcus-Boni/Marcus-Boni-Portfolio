import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  eventsToCsv,
  isNoiseEvent,
  subscribeAnalytics,
  summarize,
  type AnalyticsEvent,
  type AnalyticsSummary,
  type RangeKey,
} from '@/admin/services/analytics'
import {
  saveExcludedVisitorIds,
  subscribeAnalyticsSettings,
} from '@/admin/services/analytics-settings'
import { getOwnVisitorId } from '@/lib/analytics'

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
  /** True when owner devices, `/admin`, and local preview noise are excluded. */
  excludeOwner: boolean
  setExcludeOwner: (next: boolean) => void
  /** All visitor IDs flagged as owner devices (synced with Firestore + this browser). */
  excludedVisitorIds: string[]
  ownVisitorId: string | null
  excludeVisitor: (visitorId: string) => Promise<void>
  unexcludeVisitor: (visitorId: string) => Promise<void>
  /** Downloads the active (filtered when `excludeOwner` is on) events as CSV. */
  exportCsv: () => void
}

/**
 * Live analytics for the selected window, with owner-device hygiene built in.
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
  const [excludeOwner, setExcludeOwner] = useStoredState('mb-admin-exclude-owner', true)
  const [storedExcludedIds, setStoredExcludedIds] = useState<string[]>([])
  const ownVisitorId = useMemo(() => getOwnVisitorId(), [])

  useEffect(() => {
    return subscribeAnalyticsSettings((settings) => {
      setStoredExcludedIds(settings.excludedVisitorIds)
    })
  }, [])

  const excludedSet = useMemo(() => {
    const set = new Set(storedExcludedIds)
    if (ownVisitorId) set.add(ownVisitorId)
    return set
  }, [storedExcludedIds, ownVisitorId])

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
        setEvents([])
      },
    )
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [range])

  const loaded = useMemo(() => events ?? [], [events])

  const visibleEvents = useMemo(
    () =>
      excludeOwner
        ? loaded.filter((event) => !isNoiseEvent(event, excludedSet))
        : loaded,
    [loaded, excludeOwner, excludedSet],
  )

  const summary = useMemo(
    () =>
      summarize(loaded, range, {
        truncated,
        excludeOwner,
        excludedVisitorIds: excludedSet,
      }),
    [loaded, range, truncated, excludeOwner, excludedSet],
  )

  const excludeVisitor = useCallback(
    async (visitorId: string) => {
      if (!visitorId.trim()) return
      const next = await saveExcludedVisitorIds([...storedExcludedIds, visitorId])
      setStoredExcludedIds(next)
    },
    [storedExcludedIds],
  )

  const unexcludeVisitor = useCallback(
    async (visitorId: string) => {
      const next = await saveExcludedVisitorIds(
        storedExcludedIds.filter((id) => id !== visitorId),
      )
      setStoredExcludedIds(next)
    },
    [storedExcludedIds],
  )

  const exportCsv = useCallback(() => {
    const csv = eventsToCsv(visibleEvents)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `marcusboni-analytics-${range}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [visibleEvents, range])

  return {
    events: visibleEvents,
    summary,
    loading: events === null,
    error,
    range,
    setRange,
    excludeOwner,
    setExcludeOwner,
    excludedVisitorIds: [...excludedSet],
    ownVisitorId,
    excludeVisitor,
    unexcludeVisitor,
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

export function useHotkey(
  spec: HotkeySpec,
  handler: (event: KeyboardEvent) => void,
  enabled = true,
): void {
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
