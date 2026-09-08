import {
  Timestamp,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore'

import { db, isFirebaseConfigured } from '@/lib/firebase'

/**
 * Aggregation layer for the first-party analytics.
 *
 * Two things here are load-bearing and easy to get wrong:
 *
 *  1. **Days are bucketed in the site's timezone, not UTC.** `toISOString()`
 *     slices at UTC midnight, so for a UTC-3 reader every event between 21:00
 *     and midnight landed on *tomorrow* — "visits today" was wrong for an
 *     eighth of every day.
 *  2. **The query is bounded by date, not by a bare `limit`.** Reading "the
 *     last N events" silently caps every total once the site outgrows N, with
 *     no indication that the number stopped being true. The range is explicit
 *     and `truncated` says so when the safety cap still bites.
 */

/* ─── Ranges ────────────────────────────────────────────────────────────── */

export type RangeKey = '24h' | '7d' | '30d' | '90d'

export const RANGES: Record<RangeKey, { label: string; days: number }> = {
  '24h': { label: '24 horas', days: 1 },
  '7d': { label: '7 dias', days: 7 },
  '30d': { label: '30 dias', days: 30 },
  '90d': { label: '90 dias', days: 90 },
}

/** Everything is reported in the site's own timezone. */
export const SITE_TZ = 'America/Sao_Paulo'

/**
 * Documents read per subscription.
 *
 * 10.000 is not a taste choice: it is Firestore's hard maximum for `limit` in a
 * structured query. Going over it does not degrade — the whole subscription
 * fails with `invalid-argument` before rules are even evaluated. Do not raise
 * it; to cover more history, pre-aggregate into daily rollups instead (see
 * docs/ANALYTICS.md).
 */
const MAX_EVENTS = 10000

/* ─── Event shape ───────────────────────────────────────────────────────── */

export interface AnalyticsEvent {
  id: string
  type: string
  path: string
  visitorId: string
  sessionId: string
  isNewVisitor: boolean
  device: string
  browser: string
  os: string
  referrerHost: string
  country: string
  language: string
  section?: string
  label?: string
  /** Blog events carry the post slug. */
  slug?: string
  /** `post_share` carries the destination. */
  channel?: string
  createdAt: Date | null
}

export interface NamedCount {
  name: string
  count: number
  /** Same dimension in the preceding window, for the delta column. */
  previous?: number
}

export interface DayPoint {
  /** `YYYY-MM-DD` in `SITE_TZ`. */
  date: string
  views: number
  visitors: number
  /** Same slot in the preceding window, aligned for the comparison line. */
  previousViews: number
}

/** A number plus the same number over the preceding window of equal length. */
export interface Metric {
  current: number
  previous: number
}

export interface PostPerformance {
  slug: string
  views: number
  reads: number
  /** Share of openers that reached 75% depth. */
  readRate: number
  shares: number
}

export interface AnalyticsSummary {
  hasData: boolean
  /** True when the cost cap trimmed the window — totals are then a floor. */
  truncated: boolean
  rangeStart: Date
  rangeEnd: Date

  pageviews: Metric
  visitors: Metric
  sessions: Metric
  viewsPerSession: Metric
  /** Percentage 0–100. */
  bounceRate: Metric
  /** Seconds. */
  avgSessionSeconds: Metric

  newVisitors: number
  returningVisitors: number

  cvDownloads: Metric
  contactSubmits: Metric
  outboundClicks: Metric
  postShares: Metric

  byDay: DayPoint[]
  byPath: NamedCount[]
  byDevice: NamedCount[]
  byBrowser: NamedCount[]
  byOs: NamedCount[]
  byCountry: NamedCount[]
  byReferrer: NamedCount[]
  bySection: NamedCount[]
  topOutbound: NamedCount[]
  /** `[weekday 0–6][hour 0–23]` in `SITE_TZ`. */
  byWeekdayHour: number[][]
  posts: PostPerformance[]
}

/* ─── Timezone-correct date helpers ─────────────────────────────────────── */

// `en-CA` formats as YYYY-MM-DD, which is exactly the key format we want and
// avoids hand-assembling parts.
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SITE_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: SITE_TZ,
  weekday: 'short',
  hour: '2-digit',
  hour12: false,
})

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

export function dayKey(date: Date): string {
  return dayFormatter.format(date)
}

/** Weekday (0 = Sunday) and hour, both in `SITE_TZ`. */
function weekdayHour(date: Date): { weekday: number; hour: number } {
  let weekday = 0
  let hour = 0
  for (const part of partsFormatter.formatToParts(date)) {
    if (part.type === 'weekday') weekday = WEEKDAY_INDEX[part.value] ?? 0
    // `hour12: false` can yield "24" at midnight in some engines.
    if (part.type === 'hour') hour = Number(part.value) % 24
  }
  return { weekday, hour }
}

/** `YYYY-MM-DD` keys covering `[start, end]` inclusive, in `SITE_TZ`. */
function dayKeysBetween(start: Date, end: Date): string[] {
  const keys: string[] = []
  const cursor = new Date(start)
  cursor.setHours(12, 0, 0, 0) // midday avoids DST edge cases when stepping
  const last = dayKey(end)
  for (let guard = 0; guard < 400; guard++) {
    const key = dayKey(cursor)
    keys.push(key)
    if (key >= last) break
    cursor.setDate(cursor.getDate() + 1)
  }
  return keys
}

/* ─── Aggregation ───────────────────────────────────────────────────────── */

function bump(map: Map<string, number>, key: string | undefined) {
  if (!key) return
  map.set(key, (map.get(key) ?? 0) + 1)
}

/** Ranks a dimension and attaches the preceding window's count for the delta. */
function rank(
  current: Map<string, number>,
  previous: Map<string, number>,
  top = 8,
): NamedCount[] {
  return [...current.entries()]
    .map(([name, count]) => ({ name, count, previous: previous.get(name) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, top)
}

/**
 * Engagement events — any one of these means the visitor did something beyond
 * landing. Used for the bounce definition, which is otherwise meaningless on a
 * single-page site where every session is one pageview by construction.
 */
const ENGAGEMENT_TYPES = new Set([
  'outbound_click',
  'cv_download',
  'contact_submit',
  'post_read',
  'post_share',
])

/** Section views needed before scrolling alone counts as engagement. */
const ENGAGED_SECTION_VIEWS = 3

/**
 * Sessions longer than this are excluded from the duration average.
 *
 * A session id lives in `sessionStorage`, so a tab left open overnight keeps
 * reporting the same one. Without a plausibility ceiling a single forgotten tab
 * drags the mean into the thousands of minutes — which is exactly what it did
 * the first time this was measured. Excluding is more honest than clamping: a
 * 9-hour "session" is not a 2-hour visit, it is not a visit measurement at all.
 */
const MAX_SESSION_SECONDS = 2 * 60 * 60

interface WindowStats {
  pageviews: number
  visitors: Set<string>
  sessions: Set<string>
  newVisitors: Set<string>
  bouncedSessions: number
  totalSessionSeconds: number
  measuredSessions: number
  cvDownloads: number
  contactSubmits: number
  outboundClicks: number
  postShares: number
  device: Map<string, number>
  browser: Map<string, number>
  os: Map<string, number>
  country: Map<string, number>
  referrer: Map<string, number>
  section: Map<string, number>
  path: Map<string, number>
  outbound: Map<string, number>
}

function emptyWindow(): WindowStats {
  return {
    pageviews: 0,
    visitors: new Set(),
    sessions: new Set(),
    newVisitors: new Set(),
    bouncedSessions: 0,
    totalSessionSeconds: 0,
    measuredSessions: 0,
    cvDownloads: 0,
    contactSubmits: 0,
    outboundClicks: 0,
    postShares: 0,
    device: new Map(),
    browser: new Map(),
    os: new Map(),
    country: new Map(),
    referrer: new Map(),
    section: new Map(),
    path: new Map(),
    outbound: new Map(),
  }
}

interface SessionAccumulator {
  pageviews: number
  sectionViews: number
  engaged: boolean
  first: number
  last: number
}

function collect(events: AnalyticsEvent[]): WindowStats {
  const stats = emptyWindow()
  const sessions = new Map<string, SessionAccumulator>()

  for (const event of events) {
    if (event.visitorId) stats.visitors.add(event.visitorId)
    if (event.sessionId) stats.sessions.add(event.sessionId)
    if (event.isNewVisitor && event.visitorId) {
      stats.newVisitors.add(event.visitorId)
    }

    if (event.sessionId && event.createdAt) {
      const time = event.createdAt.getTime()
      let session = sessions.get(event.sessionId)
      if (!session) {
        session = {
          pageviews: 0,
          sectionViews: 0,
          engaged: false,
          first: time,
          last: time,
        }
        sessions.set(event.sessionId, session)
      }
      session.first = Math.min(session.first, time)
      session.last = Math.max(session.last, time)
      if (event.type === 'pageview') session.pageviews += 1
      if (event.type === 'section_view') session.sectionViews += 1
      if (ENGAGEMENT_TYPES.has(event.type)) session.engaged = true
    }

    switch (event.type) {
      case 'pageview':
        stats.pageviews += 1
        bump(stats.device, event.device)
        bump(stats.browser, event.browser)
        bump(stats.os, event.os)
        bump(stats.country, event.country)
        bump(stats.referrer, event.referrerHost)
        bump(stats.path, event.path)
        break
      case 'section_view':
        bump(stats.section, event.section ?? event.label)
        break
      case 'outbound_click':
        stats.outboundClicks += 1
        bump(stats.outbound, event.label)
        break
      case 'cv_download':
        stats.cvDownloads += 1
        break
      case 'contact_submit':
        stats.contactSubmits += 1
        break
      case 'post_share':
        stats.postShares += 1
        break
    }
  }

  for (const session of sessions.values()) {
    const engaged =
      session.engaged ||
      session.pageviews >= 2 ||
      session.sectionViews >= ENGAGED_SECTION_VIEWS
    if (!engaged) stats.bouncedSessions += 1

    const seconds = (session.last - session.first) / 1000
    // A session with one timestamp has no measurable duration; averaging zeros
    // into the mean would understate every real visit.
    if (seconds > 0 && seconds <= MAX_SESSION_SECONDS) {
      stats.totalSessionSeconds += seconds
      stats.measuredSessions += 1
    }
  }

  return stats
}

function metric(current: number, previous: number): Metric {
  return { current, previous }
}

/** Percentage change, or `null` when there is no baseline to compare against. */
export function deltaPercent(m: Metric): number | null {
  if (m.previous === 0) return m.current === 0 ? 0 : null
  return Math.round(((m.current - m.previous) / m.previous) * 100)
}

/**
 * Splits the events into the selected window and the window of equal length
 * immediately before it, then aggregates both so every figure can be shown
 * against its own baseline.
 */
export function summarize(
  events: AnalyticsEvent[],
  range: RangeKey,
  options: { now?: Date; truncated?: boolean } = {},
): AnalyticsSummary {
  const { now = new Date(), truncated = false } = options
  const { days } = RANGES[range]
  const spanMs = days * 24 * 60 * 60 * 1000
  const rangeEnd = now
  const rangeStart = new Date(now.getTime() - spanMs)
  const previousStart = new Date(rangeStart.getTime() - spanMs)

  const currentEvents: AnalyticsEvent[] = []
  const previousEvents: AnalyticsEvent[] = []
  for (const event of events) {
    if (!event.createdAt) continue
    const time = event.createdAt.getTime()
    if (time >= rangeStart.getTime()) currentEvents.push(event)
    else if (time >= previousStart.getTime()) previousEvents.push(event)
  }

  const cur = collect(currentEvents)
  const prev = collect(previousEvents)

  /* Daily series, aligned slot-for-slot with the preceding window so the
     comparison line overlays instead of running off the end. */
  const dayViews = new Map<string, number>()
  const dayVisitors = new Map<string, Set<string>>()
  for (const event of currentEvents) {
    if (event.type !== 'pageview' || !event.createdAt) continue
    const key = dayKey(event.createdAt)
    dayViews.set(key, (dayViews.get(key) ?? 0) + 1)
    let set = dayVisitors.get(key)
    if (!set) {
      set = new Set()
      dayVisitors.set(key, set)
    }
    if (event.visitorId) set.add(event.visitorId)
  }
  const prevDayViews = new Map<string, number>()
  for (const event of previousEvents) {
    if (event.type !== 'pageview' || !event.createdAt) continue
    // Shift each previous-window event forward by one span so its key lands in
    // the current window and the two series share an x position.
    const shifted = new Date(event.createdAt.getTime() + spanMs)
    const key = dayKey(shifted)
    prevDayViews.set(key, (prevDayViews.get(key) ?? 0) + 1)
  }

  const byDay: DayPoint[] = dayKeysBetween(rangeStart, rangeEnd).map((date) => ({
    date,
    views: dayViews.get(date) ?? 0,
    visitors: dayVisitors.get(date)?.size ?? 0,
    previousViews: prevDayViews.get(date) ?? 0,
  }))

  /* Weekday × hour, both resolved in SITE_TZ from the server timestamp — the
     stored `hour` field is the *visitor's* local hour, which answers a
     different question than "when should I publish". */
  const byWeekdayHour: number[][] = Array.from({ length: 7 }, () =>
    new Array<number>(24).fill(0),
  )
  for (const event of currentEvents) {
    if (event.type !== 'pageview' || !event.createdAt) continue
    const { weekday, hour } = weekdayHour(event.createdAt)
    byWeekdayHour[weekday][hour] += 1
  }

  /* Blog performance. `post_read` fires once at 75% depth, so reads/views is a
     genuine read-through rate rather than a scroll ping. */
  const postViews = new Map<string, number>()
  const postReads = new Map<string, number>()
  const postShares = new Map<string, number>()
  for (const event of currentEvents) {
    if (!event.slug) continue
    if (event.type === 'post_view') bump(postViews, event.slug)
    if (event.type === 'post_read') bump(postReads, event.slug)
    if (event.type === 'post_share') bump(postShares, event.slug)
  }
  const posts: PostPerformance[] = [...postViews.entries()]
    .map(([slug, views]) => {
      const reads = postReads.get(slug) ?? 0
      return {
        slug,
        views,
        reads,
        readRate: views > 0 ? Math.round((reads / views) * 100) : 0,
        shares: postShares.get(slug) ?? 0,
      }
    })
    .sort((a, b) => b.views - a.views)

  const bounce = (stats: WindowStats) =>
    stats.sessions.size > 0
      ? Math.round((stats.bouncedSessions / stats.sessions.size) * 100)
      : 0
  const duration = (stats: WindowStats) =>
    stats.measuredSessions > 0
      ? Math.round(stats.totalSessionSeconds / stats.measuredSessions)
      : 0
  const perSession = (stats: WindowStats) =>
    stats.sessions.size > 0
      ? Math.round((stats.pageviews / stats.sessions.size) * 10) / 10
      : 0

  return {
    hasData: currentEvents.length > 0 || previousEvents.length > 0,
    truncated,
    rangeStart,
    rangeEnd,

    pageviews: metric(cur.pageviews, prev.pageviews),
    visitors: metric(cur.visitors.size, prev.visitors.size),
    sessions: metric(cur.sessions.size, prev.sessions.size),
    viewsPerSession: metric(perSession(cur), perSession(prev)),
    bounceRate: metric(bounce(cur), bounce(prev)),
    avgSessionSeconds: metric(duration(cur), duration(prev)),

    newVisitors: cur.newVisitors.size,
    returningVisitors: Math.max(cur.visitors.size - cur.newVisitors.size, 0),

    cvDownloads: metric(cur.cvDownloads, prev.cvDownloads),
    contactSubmits: metric(cur.contactSubmits, prev.contactSubmits),
    outboundClicks: metric(cur.outboundClicks, prev.outboundClicks),
    postShares: metric(cur.postShares, prev.postShares),

    byDay,
    byPath: rank(cur.path, prev.path, 10),
    byDevice: rank(cur.device, prev.device, 4),
    byBrowser: rank(cur.browser, prev.browser, 6),
    byOs: rank(cur.os, prev.os, 6),
    byCountry: rank(cur.country, prev.country, 8),
    byReferrer: rank(cur.referrer, prev.referrer, 8),
    bySection: rank(cur.section, prev.section, 8),
    topOutbound: rank(cur.outbound, prev.outbound, 6),
    byWeekdayHour,
    posts,
  }
}

/* ─── Firestore subscription ────────────────────────────────────────────── */

interface EventDoc {
  type?: string
  path?: string
  visitorId?: string
  sessionId?: string
  isNewVisitor?: boolean
  device?: string
  browser?: string
  os?: string
  referrerHost?: string
  country?: string
  language?: string
  section?: string
  label?: string
  slug?: string
  channel?: string
  createdAt?: Timestamp | null
}

function decode(id: string, data: EventDoc): AnalyticsEvent {
  return {
    id,
    type: data.type ?? 'unknown',
    path: data.path ?? '/',
    visitorId: data.visitorId ?? '',
    sessionId: data.sessionId ?? '',
    isNewVisitor: Boolean(data.isNewVisitor),
    device: data.device ?? 'unknown',
    browser: data.browser ?? 'Other',
    os: data.os ?? 'Other',
    referrerHost: data.referrerHost ?? 'Direct',
    country: data.country ?? 'Unknown',
    language: data.language ?? 'unknown',
    section: data.section,
    label: data.label,
    slug: data.slug,
    channel: data.channel,
    createdAt: data.createdAt?.toDate() ?? null,
  }
}

export interface AnalyticsFeed {
  events: AnalyticsEvent[]
  truncated: boolean
}

/**
 * Live-subscribes to every event in the selected window *plus the window
 * before it*, since every figure is reported against that baseline.
 *
 * The range filter is what keeps this affordable: the initial snapshot bills
 * one read per document in range, and after that only new events cost
 * anything. Firestore serves `where` + `orderBy` on the same single field from
 * the automatic index, so no composite index is needed.
 */
export function subscribeAnalytics(
  range: RangeKey,
  onData: (feed: AnalyticsFeed) => void,
  onError?: (error: Error) => void,
): () => void {
  if (!isFirebaseConfigured || !db) {
    onData({ events: [], truncated: false })
    return () => {}
  }

  const spanMs = RANGES[range].days * 24 * 60 * 60 * 1000
  // Two spans back: the selected window and its comparison baseline.
  const since = new Date(Date.now() - spanMs * 2)

  const q = query(
    collection(db, 'analytics'),
    where('createdAt', '>=', Timestamp.fromDate(since)),
    orderBy('createdAt', 'desc'),
    limit(MAX_EVENTS),
  )

  return onSnapshot(
    q,
    (snap) => {
      onData({
        events: snap.docs.map((doc) => decode(doc.id, doc.data() as EventDoc)),
        truncated: snap.size >= MAX_EVENTS,
      })
    },
    (error) => onError?.(error),
  )
}

/* ─── Export ────────────────────────────────────────────────────────────── */

/** RFC 4180 quoting — a referrer or label containing a comma must not shift columns. */
function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Flattens the raw events to CSV so the data is never trapped in this UI. */
export function eventsToCsv(events: AnalyticsEvent[]): string {
  const columns: (keyof AnalyticsEvent)[] = [
    'createdAt',
    'type',
    'path',
    'slug',
    'section',
    'label',
    'channel',
    'visitorId',
    'sessionId',
    'isNewVisitor',
    'device',
    'browser',
    'os',
    'country',
    'referrerHost',
    'language',
  ]
  const header = columns.join(',')
  const rows = events.map((event) =>
    columns
      .map((column) =>
        column === 'createdAt'
          ? csvCell(event.createdAt?.toISOString() ?? '')
          : csvCell(event[column]),
      )
      .join(','),
  )
  return [header, ...rows].join('\n')
}
