import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Timestamp,
} from 'firebase/firestore'

import { db, isFirebaseConfigured } from '@/lib/firebase'

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
  hour: number
  weekday: number
  createdAt: Date | null
}

export interface NamedCount {
  name: string
  count: number
}

export interface DayPoint {
  /** `YYYY-MM-DD`. */
  date: string
  views: number
  visitors: number
}

export interface AnalyticsSummary {
  totalEvents: number
  pageviews: number
  uniqueVisitors: number
  uniqueSessions: number
  newVisitors: number
  returningVisitors: number
  viewsToday: number
  visitorsToday: number
  viewsLast7: number
  avgViewsPerSession: number
  contactSubmits: number
  cvDownloads: number
  outboundClicks: number
  byDay: DayPoint[]
  byDevice: NamedCount[]
  byBrowser: NamedCount[]
  byOs: NamedCount[]
  byCountry: NamedCount[]
  byReferrer: NamedCount[]
  bySection: NamedCount[]
  byHour: number[]
  topOutbound: NamedCount[]
}

function rank(map: Map<string, number>, top = 8): NamedCount[] {
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, top)
}

function bump(map: Map<string, number>, key: string | undefined) {
  if (!key) return
  map.set(key, (map.get(key) ?? 0) + 1)
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Pure aggregation over the raw event list — drives every dashboard widget. */
export function summarize(events: AnalyticsEvent[]): AnalyticsSummary {
  const pageviews = events.filter((e) => e.type === 'pageview')
  const visitors = new Set<string>()
  const sessions = new Set<string>()
  const newVisitorIds = new Set<string>()

  const device = new Map<string, number>()
  const browser = new Map<string, number>()
  const os = new Map<string, number>()
  const country = new Map<string, number>()
  const referrer = new Map<string, number>()
  const section = new Map<string, number>()
  const outbound = new Map<string, number>()
  const byHour = new Array<number>(24).fill(0)

  for (const e of events) {
    if (e.visitorId) visitors.add(e.visitorId)
    if (e.sessionId) sessions.add(e.sessionId)
    if (e.isNewVisitor && e.visitorId) newVisitorIds.add(e.visitorId)
  }

  for (const e of pageviews) {
    bump(device, e.device)
    bump(browser, e.browser)
    bump(os, e.os)
    bump(country, e.country)
    bump(referrer, e.referrerHost)
    if (typeof e.hour === 'number' && e.hour >= 0 && e.hour < 24) byHour[e.hour]++
  }

  for (const e of events) {
    if (e.type === 'section_view') bump(section, e.section ?? e.label)
    if (e.type === 'outbound_click') bump(outbound, e.label)
  }

  // 14-day timeseries
  const dayViews = new Map<string, number>()
  const dayVisitors = new Map<string, Set<string>>()
  for (const e of pageviews) {
    if (!e.createdAt) continue
    const key = dayKey(e.createdAt)
    dayViews.set(key, (dayViews.get(key) ?? 0) + 1)
    let set = dayVisitors.get(key)
    if (!set) {
      set = new Set()
      dayVisitors.set(key, set)
    }
    if (e.visitorId) set.add(e.visitorId)
  }
  const byDay: DayPoint[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = dayKey(d)
    byDay.push({
      date: key,
      views: dayViews.get(key) ?? 0,
      visitors: dayVisitors.get(key)?.size ?? 0,
    })
  }

  const todayKey = dayKey(new Date())
  const viewsLast7 = byDay.slice(-7).reduce((sum, d) => sum + d.views, 0)

  return {
    totalEvents: events.length,
    pageviews: pageviews.length,
    uniqueVisitors: visitors.size,
    uniqueSessions: sessions.size,
    newVisitors: newVisitorIds.size,
    returningVisitors: Math.max(visitors.size - newVisitorIds.size, 0),
    viewsToday: dayViews.get(todayKey) ?? 0,
    visitorsToday: dayVisitors.get(todayKey)?.size ?? 0,
    viewsLast7,
    avgViewsPerSession: sessions.size
      ? Math.round((pageviews.length / sessions.size) * 10) / 10
      : 0,
    contactSubmits: events.filter((e) => e.type === 'contact_submit').length,
    cvDownloads: events.filter((e) => e.type === 'cv_download').length,
    outboundClicks: events.filter((e) => e.type === 'outbound_click').length,
    byDay,
    byDevice: rank(device),
    byBrowser: rank(browser),
    byOs: rank(os),
    byCountry: rank(country),
    byReferrer: rank(referrer),
    bySection: rank(section),
    byHour,
    topOutbound: rank(outbound, 6),
  }
}

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
  hour?: number
  weekday?: number
  createdAt?: Timestamp | null
}

/** Live-subscribe to the most recent events (capped for cost). */
export function subscribeAnalytics(
  onData: (events: AnalyticsEvent[]) => void,
  max = 4000,
): () => void {
  if (!isFirebaseConfigured || !db) {
    onData([])
    return () => {}
  }
  const q = query(
    collection(db, 'analytics'),
    orderBy('createdAt', 'desc'),
    limit(max),
  )
  return onSnapshot(q, (snap) => {
    onData(
      snap.docs.map((d) => {
        const data = d.data() as EventDoc
        return {
          id: d.id,
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
          hour: typeof data.hour === 'number' ? data.hour : 0,
          weekday: typeof data.weekday === 'number' ? data.weekday : 0,
          createdAt: data.createdAt?.toDate() ?? null,
        }
      }),
    )
  })
}
