import {
  Timestamp,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore'

import {
  CHANNEL_LABEL,
  isInternalOrEmptyHost,
  isLocalOrPreviewHost,
  normalizeAnalyticsPath,
  resolveAttribution,
  type TrafficChannel,
} from '@/lib/analytics-attribution'
import { db, isFirebaseConfigured } from '@/lib/firebase'

/**
 * Aggregation layer for the first-party analytics.
 *
 * Key guarantees:
 *
 *  1. **Days are bucketed in the site's timezone, not UTC (`America/Sao_Paulo`).**
 *  2. **The query is bounded by date, not by a bare `limit`**, with Firestore's
 *     hard 10.000 structured-query ceiling respected and `truncated` surfaced.
 *  3. **Acquisition (Canais, Origens, Campanhas, Landing pages) is attributed
 *     once per SESSION**, never inflated per pageview and never polluted by
 *     `Internal` navigation. Legacy events with raw hosts (`lnkd.in`,
 *     `l.instagram.com`, `www.google.com.br`) are normalized automatically.
 *  4. **Owner, admin-route, and localhost noise** can be filtered cleanly both
 *     for past and live events, while surfacing exact filtered counts.
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
 * 10.000 is Firestore's hard maximum for `limit` in a structured query.
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
  referrer?: string
  referrerHost: string
  /** Normalized source name (optional on legacy fixtures; resolved automatically in `collect`). */
  source?: string
  /** Traffic channel OR legacy share/handoff target string (`'linkedin'`, `'firestore'`, etc.). */
  channel?: TrafficChannel | string
  landingPath?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  country: string
  language: string
  /** Post view language (`pt` | `en`). */
  lang?: string
  section?: string
  label?: string
  /** Blog events carry the post slug. */
  slug?: string
  /** `post_share` or `agent_handoff` carries the destination channel. */
  channelTarget?: string
  /** Dossier console metadata (`agent_open`, `agent_query`, `agent_fit`, `agent_share`). */
  intent?: string
  lens?: string
  surface?: string
  runtime?: string
  provider?: string
  fallback?: string
  matched?: number
  gaps?: number
  kind?: string
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
  sessions: number
  visitors: number
  /** Same slot in the preceding window, aligned for the comparison line. */
  previousViews: number
  previousSessions: number
}

/** A number plus the same number over the preceding window of equal length. */
export interface Metric {
  current: number
  previous: number
}

export interface PostPerformance {
  slug: string
  views: number
  viewsPt: number
  viewsEn: number
  reads: number
  /** Share of openers that reached 75% depth. */
  readRate: number
  shares: number
}

export interface SessionSummary {
  sessionId: string
  visitorId: string
  startedAt: Date
  durationSeconds: number
  channel: TrafficChannel
  channelLabel: string
  source: string
  campaign?: string
  landingPath: string
  pages: string[]
  pageviews: number
  engaged: boolean
  actions: string[]
  device: string
  browser: string
  os: string
  country: string
  isNewVisitor: boolean
  isOwner: boolean
}

export interface AgentPerformance {
  opens: Metric
  queries: Metric
  fitRuns: Metric
  handoffs: Metric
  shares: Metric
  avgFitMatched: number
  avgFitGaps: number
  byIntent: NamedCount[]
  byLens: NamedCount[]
  byProvider: NamedCount[]
  bySurface: NamedCount[]
}

export interface AnalyticsSummary {
  hasData: boolean
  /** True when the cost cap trimmed the window — totals are then a floor. */
  truncated: boolean
  /** Number of owner/dev/admin events excluded in the selected window. */
  filteredEvents: number
  /** Number of owner/dev/admin sessions excluded in the selected window. */
  filteredSessions: number
  rangeStart: Date
  rangeEnd: Date

  pageviews: Metric
  visitors: Metric
  sessions: Metric
  viewsPerSession: Metric
  /** Percentage 0–100. */
  bounceRate: Metric
  /** Percentage 0–100 (`100 - bounceRate` when sessions exist). */
  engagementRate: Metric
  /** Seconds. */
  avgSessionSeconds: Metric

  newVisitors: number
  returningVisitors: number

  cvDownloads: Metric
  contactSubmits: Metric
  outboundClicks: Metric
  postShares: Metric

  byDay: DayPoint[]
  /** Session-level acquisition channels (Busca orgânica, Redes sociais, Direto, IA…). */
  byChannel: NamedCount[]
  /** Session-level normalized sources (Google, LinkedIn, GitHub, Direto, ChatGPT…). */
  bySource: NamedCount[]
  /** Session-level UTM campaigns (`utm_campaign` or `utm_source / utm_medium`). */
  byCampaign: NamedCount[]
  /** First page visited in each session. */
  byLandingPath: NamedCount[]
  /** Normalized external sources (same as `bySource`, retained for compatibility). */
  byReferrer: NamedCount[]
  byPath: NamedCount[]
  byDevice: NamedCount[]
  byBrowser: NamedCount[]
  byOs: NamedCount[]
  byCountry: NamedCount[]
  bySection: NamedCount[]
  topOutbound: NamedCount[]
  /** `[weekday 0–6][hour 0–23]` in `SITE_TZ`. */
  byWeekdayHour: number[][]
  posts: PostPerformance[]
  recentSessions: SessionSummary[]
  agent: AgentPerformance
}

/* ─── Timezone-correct date helpers ─────────────────────────────────────── */

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
    if (part.type === 'hour') hour = Number(part.value) % 24
  }
  return { weekday, hour }
}

/** `YYYY-MM-DD` keys covering `[start, end]` inclusive, in `SITE_TZ`. */
function dayKeysBetween(start: Date, end: Date): string[] {
  const keys: string[] = []
  const cursor = new Date(start)
  cursor.setHours(12, 0, 0, 0)
  const last = dayKey(end)
  for (let guard = 0; guard < 400; guard++) {
    const key = dayKey(cursor)
    keys.push(key)
    if (key >= last) break
    cursor.setDate(cursor.getDate() + 1)
  }
  return keys
}

/* ─── Filtering & hygiene ───────────────────────────────────────────────── */

export function isNoiseEvent(
  event: AnalyticsEvent,
  excludedVisitorIds: ReadonlySet<string>,
): boolean {
  if (event.path.startsWith('/admin')) return true
  if (event.visitorId && excludedVisitorIds.has(event.visitorId)) return true
  if (
    event.referrerHost &&
    event.referrerHost !== 'Direct' &&
    event.referrerHost !== 'Internal' &&
    event.referrerHost !== 'Unknown' &&
    isLocalOrPreviewHost(event.referrerHost)
  ) {
    return true
  }
  return false
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

const ENGAGEMENT_TYPES = new Set([
  'outbound_click',
  'cv_download',
  'contact_submit',
  'post_read',
  'post_share',
  'agent_query',
  'agent_fit',
  'agent_handoff',
  'agent_share',
])

const ENGAGED_SECTION_VIEWS = 3
const MAX_SESSION_SECONDS = 2 * 60 * 60

interface SessionAccumulator {
  sessionId: string
  visitorId: string
  pageviews: number
  sectionViews: number
  engaged: boolean
  first: number
  last: number
  channel: TrafficChannel
  source: string
  hasExplicitAttribution: boolean
  campaign?: string
  landingPath: string
  pages: string[]
  actions: Set<string>
  device: string
  browser: string
  os: string
  country: string
  isNewVisitor: boolean
}

interface WindowStats {
  pageviews: number
  visitors: Set<string>
  sessions: Map<string, SessionAccumulator>
  newVisitors: Set<string>
  bouncedSessions: number
  totalSessionSeconds: number
  measuredSessions: number
  cvDownloads: number
  contactSubmits: number
  outboundClicks: number
  postShares: number
  agentOpens: number
  agentQueries: number
  agentFits: number
  agentHandoffs: number
  agentShares: number
  fitMatchedSum: number
  fitGapsSum: number
  channel: Map<string, number>
  source: Map<string, number>
  campaign: Map<string, number>
  landingPath: Map<string, number>
  device: Map<string, number>
  browser: Map<string, number>
  os: Map<string, number>
  country: Map<string, number>
  section: Map<string, number>
  path: Map<string, number>
  outbound: Map<string, number>
  agentIntent: Map<string, number>
  agentLens: Map<string, number>
  agentProvider: Map<string, number>
  agentSurface: Map<string, number>
}

function emptyWindow(): WindowStats {
  return {
    pageviews: 0,
    visitors: new Set(),
    sessions: new Map(),
    newVisitors: new Set(),
    bouncedSessions: 0,
    totalSessionSeconds: 0,
    measuredSessions: 0,
    cvDownloads: 0,
    contactSubmits: 0,
    outboundClicks: 0,
    postShares: 0,
    agentOpens: 0,
    agentQueries: 0,
    agentFits: 0,
    agentHandoffs: 0,
    agentShares: 0,
    fitMatchedSum: 0,
    fitGapsSum: 0,
    channel: new Map(),
    source: new Map(),
    campaign: new Map(),
    landingPath: new Map(),
    device: new Map(),
    browser: new Map(),
    os: new Map(),
    country: new Map(),
    section: new Map(),
    path: new Map(),
    outbound: new Map(),
    agentIntent: new Map(),
    agentLens: new Map(),
    agentProvider: new Map(),
    agentSurface: new Map(),
  }
}

function campaignLabel(event: AnalyticsEvent): string | undefined {
  const sourceLabel = event.source ?? event.utmSource ?? 'Campanha'
  if (event.utmCampaign) {
    return event.utmSource ? `${event.utmCampaign} (${sourceLabel})` : event.utmCampaign
  }
  if (event.utmSource && event.utmMedium) {
    return `${sourceLabel} / ${event.utmMedium}`
  }
  if (event.utmSource) {
    return sourceLabel
  }
  return undefined
}

function collect(events: AnalyticsEvent[]): WindowStats {
  const stats = emptyWindow()
  // Process chronologically so each session's landing page and entry source reflect its first event.
  const chronological = [...events].sort(
    (a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0),
  )

  for (const event of chronological) {
    const cleanPath = normalizeAnalyticsPath(event.path)
    if (event.visitorId) stats.visitors.add(event.visitorId)
    if (event.isNewVisitor && event.visitorId) {
      stats.newVisitors.add(event.visitorId)
    }

    const sid = event.sessionId || `anon:${event.id}`
    if (event.createdAt) {
      const time = event.createdAt.getTime()
      const resolvedAttr =
        event.source && event.channel && VALID_CHANNELS.has(event.channel as TrafficChannel)
          ? { source: event.source, channel: event.channel as TrafficChannel }
          : resolveAttribution({
              referrer: event.referrer,
              referrerHost: event.referrerHost,
              utmSource: event.utmSource,
              utmMedium: event.utmMedium,
              utmCampaign: event.utmCampaign,
              landingPath: event.landingPath ?? cleanPath,
            })
      let session = stats.sessions.get(sid)
      const isExternalSignal =
        Boolean(event.utmSource) ||
        (resolvedAttr.channel !== 'direct' && !isInternalOrEmptyHost(event.referrerHost))

      if (!session) {
        session = {
          sessionId: sid,
          visitorId: event.visitorId,
          pageviews: 0,
          sectionViews: 0,
          engaged: false,
          first: time,
          last: time,
          channel: resolvedAttr.channel,
          source: resolvedAttr.source,
          hasExplicitAttribution: isExternalSignal,
          campaign: campaignLabel(event),
          landingPath: normalizeAnalyticsPath(event.landingPath ?? cleanPath),
          pages: [],
          actions: new Set(),
          device: event.device || 'desktop',
          browser: event.browser || 'Other',
          os: event.os || 'Other',
          country: event.country || 'Unknown',
          isNewVisitor: event.isNewVisitor,
        }
        stats.sessions.set(sid, session)
      } else {
        session.first = Math.min(session.first, time)
        session.last = Math.max(session.last, time)
        // Upgrade a Direct session if a later event in the same session reveals the external origin.
        if (!session.hasExplicitAttribution && isExternalSignal) {
          session.channel = resolvedAttr.channel
          session.source = resolvedAttr.source
          session.hasExplicitAttribution = true
        }
        if (!session.campaign) {
          const camp = campaignLabel(event)
          if (camp) session.campaign = camp
        }
      }

      if (event.type === 'pageview') {
        session.pageviews += 1
        if (session.pages[session.pages.length - 1] !== cleanPath) {
          session.pages.push(cleanPath)
        }
      }
      if (event.type === 'section_view') session.sectionViews += 1
      if (ENGAGEMENT_TYPES.has(event.type)) session.engaged = true

      // Record human-readable session highlights
      if (event.type === 'post_read') session.actions.add('Leu artigo')
      else if (event.type === 'post_share') session.actions.add('Compartilhou')
      else if (event.type === 'cv_download') session.actions.add('Baixou CV')
      else if (event.type === 'contact_submit') session.actions.add('Enviou contato')
      else if (event.type === 'agent_fit') session.actions.add('Análise /fit')
      else if (event.type === 'agent_query') session.actions.add('Consultou Dossiê')
      else if (event.type === 'agent_handoff') session.actions.add('Handoff IA')
      else if (event.type === 'outbound_click') session.actions.add('Link externo')
    }

    switch (event.type) {
      case 'pageview':
        stats.pageviews += 1
        bump(stats.path, cleanPath)
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
      case 'agent_open':
        stats.agentOpens += 1
        bump(stats.agentSurface, event.surface)
        break
      case 'agent_query':
        stats.agentQueries += 1
        bump(stats.agentIntent, event.intent)
        bump(stats.agentLens, event.lens)
        bump(
          stats.agentProvider,
          event.provider ??
            (event.runtime === 'edge-llm' ? 'edge-llm' : 'local'),
        )
        break
      case 'agent_fit':
        stats.agentFits += 1
        if (typeof event.matched === 'number') stats.fitMatchedSum += event.matched
        if (typeof event.gaps === 'number') stats.fitGapsSum += event.gaps
        break
      case 'agent_handoff':
        stats.agentHandoffs += 1
        break
      case 'agent_share':
        stats.agentShares += 1
        break
    }
  }

  // Session-level attribution & audience breakdowns (each session counted ONCE!)
  for (const session of stats.sessions.values()) {
    const engaged =
      session.engaged ||
      session.pageviews >= 2 ||
      session.sectionViews >= ENGAGED_SECTION_VIEWS
    session.engaged = engaged
    if (!engaged) stats.bouncedSessions += 1

    const seconds = (session.last - session.first) / 1000
    if (seconds > 0 && seconds <= MAX_SESSION_SECONDS) {
      stats.totalSessionSeconds += seconds
      stats.measuredSessions += 1
    }

    bump(stats.channel, CHANNEL_LABEL[session.channel] ?? CHANNEL_LABEL.direct)
    bump(stats.source, session.source)
    if (session.campaign) bump(stats.campaign, session.campaign)
    bump(stats.landingPath, session.landingPath)
    bump(stats.device, session.device)
    bump(stats.browser, session.browser)
    bump(stats.os, session.os)
    bump(stats.country, session.country)
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

export interface SummarizeOptions {
  now?: Date
  truncated?: boolean
  /** When true (default), removes owner devices, `/admin` paths, and local dev hosts. */
  excludeOwner?: boolean
  excludedVisitorIds?: ReadonlySet<string>
}

/**
 * Splits events into the selected window and the preceding baseline window,
 * optionally filtering out owner/dev noise while preserving exact filtered counts.
 */
export function summarize(
  events: AnalyticsEvent[],
  range: RangeKey,
  options: SummarizeOptions = {},
): AnalyticsSummary {
  const {
    now = new Date(),
    truncated = false,
    excludeOwner = true,
    excludedVisitorIds = new Set<string>(),
  } = options
  const { days } = RANGES[range]
  const spanMs = days * 24 * 60 * 60 * 1000
  const rangeEnd = now
  const rangeStart = new Date(now.getTime() - spanMs)
  const previousStart = new Date(rangeStart.getTime() - spanMs)

  const currentEvents: AnalyticsEvent[] = []
  const previousEvents: AnalyticsEvent[] = []
  let filteredEvents = 0
  const filteredSessionIds = new Set<string>()

  for (const event of events) {
    if (!event.createdAt) continue
    const time = event.createdAt.getTime()
    const inCurrent = time >= rangeStart.getTime()
    const inPrevious = !inCurrent && time >= previousStart.getTime()
    if (!inCurrent && !inPrevious) continue

    if (excludeOwner && isNoiseEvent(event, excludedVisitorIds)) {
      if (inCurrent) {
        filteredEvents += 1
        if (event.sessionId) filteredSessionIds.add(event.sessionId)
      }
      continue
    }

    if (inCurrent) currentEvents.push(event)
    else previousEvents.push(event)
  }

  const cur = collect(currentEvents)
  const prev = collect(previousEvents)

  /* Daily series, aligned slot-for-slot with the preceding window. */
  const dayViews = new Map<string, number>()
  const daySessions = new Map<string, Set<string>>()
  const dayVisitors = new Map<string, Set<string>>()
  for (const event of currentEvents) {
    if (!event.createdAt) continue
    const key = dayKey(event.createdAt)
    if (event.sessionId) {
      let sSet = daySessions.get(key)
      if (!sSet) {
        sSet = new Set()
        daySessions.set(key, sSet)
      }
      sSet.add(event.sessionId)
    }
    if (event.type !== 'pageview') continue
    dayViews.set(key, (dayViews.get(key) ?? 0) + 1)
    let vSet = dayVisitors.get(key)
    if (!vSet) {
      vSet = new Set()
      dayVisitors.set(key, vSet)
    }
    if (event.visitorId) vSet.add(event.visitorId)
  }
  const prevDayViews = new Map<string, number>()
  const prevDaySessions = new Map<string, Set<string>>()
  for (const event of previousEvents) {
    if (!event.createdAt) continue
    const shifted = new Date(event.createdAt.getTime() + spanMs)
    const key = dayKey(shifted)
    if (event.sessionId) {
      let sSet = prevDaySessions.get(key)
      if (!sSet) {
        sSet = new Set()
        prevDaySessions.set(key, sSet)
      }
      sSet.add(event.sessionId)
    }
    if (event.type === 'pageview') {
      prevDayViews.set(key, (prevDayViews.get(key) ?? 0) + 1)
    }
  }

  const byDay: DayPoint[] = dayKeysBetween(rangeStart, rangeEnd).map((date) => ({
    date,
    views: dayViews.get(date) ?? 0,
    sessions: daySessions.get(date)?.size ?? 0,
    visitors: dayVisitors.get(date)?.size ?? 0,
    previousViews: prevDayViews.get(date) ?? 0,
    previousSessions: prevDaySessions.get(date)?.size ?? 0,
  }))

  /* Weekday × hour, in SITE_TZ from server timestamps. */
  const byWeekdayHour: number[][] = Array.from({ length: 7 }, () =>
    new Array<number>(24).fill(0),
  )
  for (const event of currentEvents) {
    if (event.type !== 'pageview' || !event.createdAt) continue
    const { weekday, hour } = weekdayHour(event.createdAt)
    byWeekdayHour[weekday][hour] += 1
  }

  /* Blog performance (including PT vs EN splits). */
  const postViews = new Map<string, number>()
  const postViewsPt = new Map<string, number>()
  const postViewsEn = new Map<string, number>()
  const postReads = new Map<string, number>()
  const postShares = new Map<string, number>()
  for (const event of currentEvents) {
    if (!event.slug) continue
    if (event.type === 'post_view') {
      bump(postViews, event.slug)
      const isEn = event.lang === 'en' || event.path.startsWith('/en/blog/')
      bump(isEn ? postViewsEn : postViewsPt, event.slug)
    }
    if (event.type === 'post_read') bump(postReads, event.slug)
    if (event.type === 'post_share') bump(postShares, event.slug)
  }
  const posts: PostPerformance[] = [...postViews.entries()]
    .map(([slug, views]) => {
      const reads = postReads.get(slug) ?? 0
      return {
        slug,
        views,
        viewsPt: postViewsPt.get(slug) ?? 0,
        viewsEn: postViewsEn.get(slug) ?? 0,
        reads,
        readRate: views > 0 ? Math.min(100, Math.round((reads / views) * 100)) : 0,
        shares: postShares.get(slug) ?? 0,
      }
    })
    .sort((a, b) => b.views - a.views)

  /* Recent sessions (visitor journeys), newest first. */
  const recentSessions: SessionSummary[] = [...cur.sessions.values()]
    .sort((a, b) => b.last - a.last)
    .slice(0, 60)
    .map((session) => {
      const rawSeconds = Math.max(0, Math.round((session.last - session.first) / 1000))
      return {
        sessionId: session.sessionId,
        visitorId: session.visitorId,
        startedAt: new Date(session.first),
        durationSeconds: rawSeconds <= MAX_SESSION_SECONDS ? rawSeconds : 0,
        channel: session.channel,
        channelLabel: CHANNEL_LABEL[session.channel] ?? CHANNEL_LABEL.direct,
        source: session.source,
        campaign: session.campaign,
        landingPath: session.landingPath,
        pages: session.pages.length > 0 ? session.pages : [session.landingPath],
        pageviews: Math.max(session.pageviews, session.pages.length > 0 ? session.pages.length : 1),
        engaged: session.engaged,
        actions: [...session.actions],
        device: session.device,
        browser: session.browser,
        os: session.os,
        country: session.country,
        isNewVisitor: session.isNewVisitor,
        isOwner: Boolean(session.visitorId && excludedVisitorIds.has(session.visitorId)),
      }
    })

  const bounce = (stats: WindowStats) =>
    stats.sessions.size > 0
      ? Math.round((stats.bouncedSessions / stats.sessions.size) * 100)
      : 0
  const engagedPct = (stats: WindowStats) =>
    stats.sessions.size > 0 ? Math.max(0, 100 - bounce(stats)) : 0
  const duration = (stats: WindowStats) =>
    stats.measuredSessions > 0
      ? Math.round(stats.totalSessionSeconds / stats.measuredSessions)
      : 0
  const perSession = (stats: WindowStats) =>
    stats.sessions.size > 0
      ? Math.round((stats.pageviews / stats.sessions.size) * 10) / 10
      : 0

  const bySource = rank(cur.source, prev.source, 10)

  return {
    hasData: currentEvents.length > 0 || previousEvents.length > 0,
    truncated,
    filteredEvents,
    filteredSessions: filteredSessionIds.size,
    rangeStart,
    rangeEnd,

    pageviews: metric(cur.pageviews, prev.pageviews),
    visitors: metric(cur.visitors.size, prev.visitors.size),
    sessions: metric(cur.sessions.size, prev.sessions.size),
    viewsPerSession: metric(perSession(cur), perSession(prev)),
    bounceRate: metric(bounce(cur), bounce(prev)),
    engagementRate: metric(engagedPct(cur), engagedPct(prev)),
    avgSessionSeconds: metric(duration(cur), duration(prev)),

    newVisitors: cur.newVisitors.size,
    returningVisitors: Math.max(cur.visitors.size - cur.newVisitors.size, 0),

    cvDownloads: metric(cur.cvDownloads, prev.cvDownloads),
    contactSubmits: metric(cur.contactSubmits, prev.contactSubmits),
    outboundClicks: metric(cur.outboundClicks, prev.outboundClicks),
    postShares: metric(cur.postShares, prev.postShares),

    byDay,
    byChannel: rank(cur.channel, prev.channel, 8),
    bySource,
    byCampaign: rank(cur.campaign, prev.campaign, 8),
    byLandingPath: rank(cur.landingPath, prev.landingPath, 8),
    byReferrer: bySource,
    byPath: rank(cur.path, prev.path, 10),
    byDevice: rank(cur.device, prev.device, 4),
    byBrowser: rank(cur.browser, prev.browser, 6),
    byOs: rank(cur.os, prev.os, 6),
    byCountry: rank(cur.country, prev.country, 8),
    bySection: rank(cur.section, prev.section, 8),
    topOutbound: rank(cur.outbound, prev.outbound, 6),
    byWeekdayHour,
    posts,
    recentSessions,
    agent: {
      opens: metric(cur.agentOpens, prev.agentOpens),
      queries: metric(cur.agentQueries, prev.agentQueries),
      fitRuns: metric(cur.agentFits, prev.agentFits),
      handoffs: metric(cur.agentHandoffs, prev.agentHandoffs),
      shares: metric(cur.agentShares, prev.agentShares),
      avgFitMatched:
        cur.agentFits > 0
          ? Math.round((cur.fitMatchedSum / cur.agentFits) * 10) / 10
          : 0,
      avgFitGaps:
        cur.agentFits > 0
          ? Math.round((cur.fitGapsSum / cur.agentFits) * 10) / 10
          : 0,
      byIntent: rank(cur.agentIntent, prev.agentIntent, 8),
      byLens: rank(cur.agentLens, prev.agentLens, 4),
      byProvider: rank(cur.agentProvider, prev.agentProvider, 6),
      bySurface: rank(cur.agentSurface, prev.agentSurface, 4),
    },
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
  referrer?: string
  referrerHost?: string
  source?: string
  channel?: string
  channelTarget?: string
  landingPath?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  country?: string
  language?: string
  lang?: string
  section?: string
  label?: string
  slug?: string
  intent?: string
  lens?: string
  surface?: string
  runtime?: string
  provider?: string
  fallback?: string
  matched?: number
  gaps?: number
  kind?: string
  createdAt?: Timestamp | null
}

const VALID_CHANNELS = new Set<TrafficChannel>([
  'organic',
  'social',
  'ai',
  'community',
  'campaign',
  'referral',
  'direct',
])

function decode(id: string, data: EventDoc): AnalyticsEvent {
  const path = normalizeAnalyticsPath(data.path)
  const resolved = resolveAttribution({
    referrer: data.referrer,
    referrerHost: data.referrerHost,
    utmSource: data.utmSource,
    utmMedium: data.utmMedium,
    utmCampaign: data.utmCampaign,
    landingPath: data.landingPath ?? path,
  })
  // Note: legacy `post_share` events stored `channel: 'linkedin' | 'x' | 'copy'`,
  // so only treat `data.channel` as a traffic channel if it matches the known enum.
  const storedTrafficChannel =
    data.channel && VALID_CHANNELS.has(data.channel as TrafficChannel)
      ? (data.channel as TrafficChannel)
      : undefined
  const shareChannelTarget =
    data.channelTarget ??
    (data.channel && !VALID_CHANNELS.has(data.channel as TrafficChannel)
      ? data.channel
      : undefined)

  return {
    id,
    type: data.type ?? 'unknown',
    path,
    visitorId: data.visitorId ?? '',
    sessionId: data.sessionId ?? '',
    isNewVisitor: Boolean(data.isNewVisitor),
    device: data.device ?? 'unknown',
    browser: data.browser ?? 'Other',
    os: data.os ?? 'Other',
    referrer: data.referrer,
    referrerHost: data.referrerHost ?? resolved.referrerHost,
    source: data.source || resolved.source,
    channel: storedTrafficChannel ?? resolved.channel,
    landingPath: data.landingPath ? normalizeAnalyticsPath(data.landingPath) : undefined,
    utmSource: data.utmSource ?? resolved.utmSource,
    utmMedium: data.utmMedium ?? resolved.utmMedium,
    utmCampaign: data.utmCampaign ?? resolved.utmCampaign,
    country: data.country ?? 'Unknown',
    language: data.language ?? 'unknown',
    lang: data.lang,
    section: data.section,
    label: data.label,
    slug: data.slug,
    channelTarget: shareChannelTarget,
    intent: data.intent,
    lens: data.lens,
    surface: data.surface,
    runtime: data.runtime,
    provider: data.provider,
    fallback: data.fallback,
    matched: typeof data.matched === 'number' ? data.matched : undefined,
    gaps: typeof data.gaps === 'number' ? data.gaps : undefined,
    kind: data.kind,
    createdAt: data.createdAt?.toDate() ?? null,
  }
}

export interface AnalyticsFeed {
  events: AnalyticsEvent[]
  truncated: boolean
}

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

/** Flattens the events to CSV so the data is never trapped in this UI. */
export function eventsToCsv(events: AnalyticsEvent[]): string {
  const columns: (keyof AnalyticsEvent)[] = [
    'createdAt',
    'type',
    'path',
    'landingPath',
    'channel',
    'source',
    'utmSource',
    'utmMedium',
    'utmCampaign',
    'referrerHost',
    'slug',
    'lang',
    'section',
    'label',
    'channelTarget',
    'intent',
    'lens',
    'surface',
    'provider',
    'matched',
    'gaps',
    'visitorId',
    'sessionId',
    'isNewVisitor',
    'device',
    'browser',
    'os',
    'country',
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
