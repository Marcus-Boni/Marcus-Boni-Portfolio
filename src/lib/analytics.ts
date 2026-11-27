import {
  isBotUserAgent,
  isInternalOrEmptyHost,
  isLocalOrPreviewHost,
  normalizeAnalyticsPath,
  resolveAttribution,
  type Attribution,
  type TrafficChannel,
} from '@/lib/analytics-attribution'
import { isFirebaseConfigured } from '@/lib/firebase-config'

/**
 * Lightweight, privacy-respecting first-party analytics. No cookies, no third
 * parties — just anonymous event docs in Firestore that the admin dashboard
 * aggregates. A random visitor id lives in localStorage; a session id and its
 * entry attribution live in sessionStorage and expire when the tab closes.
 *
 * Quality guards:
 *  • Admin routes (`/admin*`) are never tracked.
 *  • Localhost and deploy-preview hosts are ignored by default.
 *  • Automated crawlers, link scrapers, and `navigator.webdriver` are ignored.
 *  • The site owner's browser is automatically excluded when signed into
 *    `/admin` (or via `?ignore_me=1`), and can be toggled in the panel.
 *  • Identical-path pageviews within 5 seconds are deduplicated.
 */

export type AnalyticsEventType =
  | 'pageview'
  | 'section_view'
  | 'outbound_click'
  | 'cv_download'
  | 'contact_submit'
  | 'language_change'
  // Blog. `post_read` fires once at 75% scroll depth, so the dashboard can
  // separate "opened it" from "actually read it".
  | 'blog_index_view'
  | 'post_view'
  | 'post_read'
  | 'post_share'
  // Interactive dossier console (`/ask` and `⌘K` drawer).
  | 'agent_open'
  | 'agent_query'
  | 'agent_fit'
  | 'agent_handoff'
  | 'agent_share'

export interface AnalyticsContext {
  visitorId: string
  sessionId: string
  isNewVisitor: boolean
  isNewSession: boolean
  device: 'mobile' | 'tablet' | 'desktop'
  browser: string
  os: string
  referrer: string
  referrerHost: string
  source: string
  channel: TrafficChannel
  landingPath: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  timezone: string
  country: string
  language: string
  screen: string
}

const VISITOR_KEY = 'mb-visitor-id'
const SESSION_KEY = 'mb-session-id'
const ATTRIBUTION_KEY = 'mb-session-attribution'
const IGNORE_KEY = 'mb-analytics-ignore'
const DEV_OVERRIDE_KEY = 'mb-analytics-track-dev'

const PAGEVIEW_DEDUPE_MS = 5_000

function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function safeStorageGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function safeStorageSet(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value)
  } catch {
    /* private browsing or storage disabled */
  }
}

function safeStorageRemove(storage: Storage, key: string): void {
  try {
    storage.removeItem(key)
  } catch {
    /* ignore */
  }
}

/* ─── Owner exclusion & environment guards ──────────────────────────────── */

/**
 * Checks whether this browser is flagged as the site owner (`mb-analytics-ignore`).
 * `'1'` = excluded; `'0'` = explicitly opted in by owner for testing; `null` = regular visitor.
 */
export function isOwnTrafficIgnored(): boolean {
  if (typeof window === 'undefined') return false
  return safeStorageGet(localStorage, IGNORE_KEY) === '1'
}

/** Explicit value saved for this browser (`true` excluded, `false` opted-in, `null` unset). */
export function getOwnTrafficPreference(): boolean | null {
  if (typeof window === 'undefined') return null
  const raw = safeStorageGet(localStorage, IGNORE_KEY)
  if (raw === '1') return true
  if (raw === '0') return false
  return null
}

/** Toggle owner exclusion on this browser (used by Admin Settings & Analytics). */
export function setIgnoreOwnTraffic(ignore: boolean): void {
  if (typeof window === 'undefined') return
  safeStorageSet(localStorage, IGNORE_KEY, ignore ? '1' : '0')
}

/**
 * Called automatically when an admin session is verified: activates owner
 * exclusion unless the owner explicitly opted back in (`'0'`) to test tracking.
 */
export function markAdminBrowserExcluded(): void {
  if (typeof window === 'undefined') return
  if (getOwnTrafficPreference() === null) {
    setIgnoreOwnTraffic(true)
  }
}

/** Returns this browser's anonymous visitor id (or null if none was created yet). */
export function getOwnVisitorId(): string | null {
  if (typeof window === 'undefined') return null
  return safeStorageGet(localStorage, VISITOR_KEY)
}

/** Ensures a visitor id exists on this browser and returns it (used to register device exclusion). */
export function ensureOwnVisitorId(): string {
  if (typeof window === 'undefined') return ''
  let id = safeStorageGet(localStorage, VISITOR_KEY)
  if (!id) {
    id = uid()
    safeStorageSet(localStorage, VISITOR_KEY, id)
  }
  return id
}

/** Handles one-tap `?ignore_me=1` / `?ignore_me=0` and `?track_dev=1` URL flags cleanly. */
function applyUrlFlags(): void {
  if (typeof window === 'undefined' || !location.search) return
  try {
    const params = new URLSearchParams(location.search)
    let dirty = false
    const ignoreMe = params.get('ignore_me')
    if (ignoreMe === '1' || ignoreMe === 'true') {
      setIgnoreOwnTraffic(true)
      params.delete('ignore_me')
      dirty = true
    } else if (ignoreMe === '0' || ignoreMe === 'false') {
      setIgnoreOwnTraffic(false)
      params.delete('ignore_me')
      dirty = true
    }
    const trackDev = params.get('track_dev')
    if (trackDev === '1' || trackDev === 'true') {
      safeStorageSet(sessionStorage, DEV_OVERRIDE_KEY, '1')
      params.delete('track_dev')
      dirty = true
    } else if (trackDev === '0' || trackDev === 'false') {
      safeStorageRemove(sessionStorage, DEV_OVERRIDE_KEY)
      params.delete('track_dev')
      dirty = true
    }
    if (dirty && typeof history !== 'undefined' && history.replaceState) {
      const qs = params.toString()
      const next = `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`
      history.replaceState(null, '', next)
    }
  } catch {
    /* ignore malformed query strings */
  }
}

export type BlockReason = 'admin' | 'owner' | 'local' | 'bot' | null

/** Reports why tracking is paused in the current browser context, if at all. */
export function getTrackingBlockReason(): BlockReason {
  if (typeof window === 'undefined') return 'bot'
  if (location.pathname.startsWith('/admin')) return 'admin'
  if (isOwnTrafficIgnored()) return 'owner'
  const devOverride = safeStorageGet(sessionStorage, DEV_OVERRIDE_KEY) === '1'
  if (!devOverride && isLocalOrPreviewHost(location.hostname)) return 'local'
  if (isBotUserAgent(navigator.userAgent, Boolean(navigator.webdriver))) return 'bot'
  return null
}

/* ─── Device & environment parsing ──────────────────────────────────────── */

function detectDevice(ua: string): AnalyticsContext['device'] {
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return 'tablet'
  if (/Mobi|Android|iPhone|iPod|Windows Phone/i.test(ua)) return 'mobile'
  return 'desktop'
}

function detectBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return 'Edge'
  if (/OPR\/|Opera/.test(ua)) return 'Opera'
  if (/Firefox\//.test(ua)) return 'Firefox'
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return 'Chrome'
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return 'Safari'
  return 'Other'
}

function detectOS(ua: string): string {
  if (/Windows NT/.test(ua)) return 'Windows'
  if (/Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua)) return 'macOS'
  if (/Android/.test(ua)) return 'Android'
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Other'
}

/** Rough country guess from the IANA timezone (no IP geolocation needed). */
function countryFromTimezone(tz: string): string {
  const map: Record<string, string> = {
    'America/Sao_Paulo': 'Brazil',
    'America/Bahia': 'Brazil',
    'America/Fortaleza': 'Brazil',
    'America/Recife': 'Brazil',
    'America/Manaus': 'Brazil',
    'America/Belem': 'Brazil',
    'America/Cuiaba': 'Brazil',
    'America/Campo_Grande': 'Brazil',
    'America/Porto_Velho': 'Brazil',
    'America/New_York': 'United States',
    'America/Chicago': 'United States',
    'America/Los_Angeles': 'United States',
    'America/Denver': 'United States',
    'Europe/London': 'United Kingdom',
    'Europe/Lisbon': 'Portugal',
    'Europe/Madrid': 'Spain',
    'Europe/Paris': 'France',
    'Europe/Berlin': 'Germany',
    'Asia/Tokyo': 'Japan',
    'Asia/Kolkata': 'India',
    'Australia/Sydney': 'Australia',
  }
  if (map[tz]) return map[tz]
  // fall back to the continent prefix so the dashboard still buckets sanely
  const region = tz.split('/')[0]
  return region ? region.replace(/_/g, ' ') : 'Unknown'
}

/* ─── Session-persistent acquisition attribution ────────────────────────── */

function readSessionAttribution(): Attribution | null {
  const raw = safeStorageGet(sessionStorage, ATTRIBUTION_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<Attribution>
    if (parsed.source && parsed.channel && parsed.referrerHost) {
      return parsed as Attribution
    }
  } catch {
    /* ignore corrupted session value */
  }
  return null
}

function syncSessionAttribution(): Attribution {
  const currentPath = normalizeAnalyticsPath(location.pathname)
  const fresh = resolveAttribution({
    referrer: document.referrer || '',
    search: location.search || '',
    currentHost: location.host,
    landingPath: currentPath,
  })
  const existing = readSessionAttribution()

  // Update the session's attribution only when:
  //  • no attribution has been recorded in this session yet, OR
  //  • a fresh UTM campaign / explicit external referrer arrived mid-session
  //    (e.g. clicking a shared LinkedIn link in an existing tab).
  const hasFreshExternalSignal =
    Boolean(fresh.utmSource) ||
    (!isInternalOrEmptyHost(fresh.referrerHost, location.host) && fresh.channel !== 'direct')

  if (!existing || hasFreshExternalSignal) {
    const next: Attribution = {
      ...fresh,
      landingPath: existing?.landingPath && !hasFreshExternalSignal ? existing.landingPath : currentPath,
    }
    safeStorageSet(sessionStorage, ATTRIBUTION_KEY, JSON.stringify(next))
    return next
  }

  return existing
}

/* ─── Context & event tracking ──────────────────────────────────────────── */

let cached: AnalyticsContext | null = null
let lastPageview: { path: string; at: number } | null = null

/** Test-only reset for in-memory caches between Vitest cases. */
export function _resetAnalyticsStateForTests(): void {
  cached = null
  lastPageview = null
}

export function getAnalyticsContext(): AnalyticsContext {
  const attribution = syncSessionAttribution()
  if (cached) {
    cached = {
      ...cached,
      isNewVisitor: false,
      isNewSession: false,
      referrerHost: attribution.referrerHost,
      source: attribution.source,
      channel: attribution.channel,
      landingPath: attribution.landingPath ?? cached.landingPath,
      utmSource: attribution.utmSource,
      utmMedium: attribution.utmMedium,
      utmCampaign: attribution.utmCampaign,
    }
    return cached
  }

  const ua = navigator.userAgent

  let visitorId = safeStorageGet(localStorage, VISITOR_KEY)
  const isNewVisitor = !visitorId
  if (!visitorId) {
    visitorId = uid()
    safeStorageSet(localStorage, VISITOR_KEY, visitorId)
  }

  let sessionId = safeStorageGet(sessionStorage, SESSION_KEY)
  const isNewSession = !sessionId
  if (!sessionId) {
    sessionId = uid()
    safeStorageSet(sessionStorage, SESSION_KEY, sessionId)
  }

  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown'

  cached = {
    visitorId,
    sessionId,
    isNewVisitor,
    isNewSession,
    device: detectDevice(ua),
    browser: detectBrowser(ua),
    os: detectOS(ua),
    referrer: document.referrer || '',
    referrerHost: attribution.referrerHost,
    source: attribution.source,
    channel: attribution.channel,
    landingPath: attribution.landingPath ?? normalizeAnalyticsPath(location.pathname),
    utmSource: attribution.utmSource,
    utmMedium: attribution.utmMedium,
    utmCampaign: attribution.utmCampaign,
    timezone,
    country: countryFromTimezone(timezone),
    language: navigator.language || 'unknown',
    screen: `${window.screen.width}x${window.screen.height}`,
  }
  return cached
}

/**
 * Fire-and-forget event. Never throws into the UI — analytics must not break
 * the public site. No-ops when Firebase is not configured or when blocked by
 * owner/dev/bot hygiene guards.
 */
export function trackEvent(
  type: AnalyticsEventType,
  meta: Record<string, string | number | boolean> = {},
): void {
  if (typeof window === 'undefined') return
  applyUrlFlags()
  if (!isFirebaseConfigured) return
  if (getTrackingBlockReason() !== null) return

  try {
    const path = normalizeAnalyticsPath(location.pathname)
    if (type === 'pageview') {
      const now = Date.now()
      if (lastPageview && lastPageview.path === path && now - lastPageview.at < PAGEVIEW_DEDUPE_MS) {
        return
      }
      lastPageview = { path, at: now }
    }

    const ctx = getAnalyticsContext()
    // Strip undefined optional fields so Firestore rules' 32-key ceiling is never strained.
    // Keep canonical traffic `channel` intact even when an event (e.g. `post_share`) passes its own `channel`.
    const { channel: metaChannel, ...restMeta } = meta
    const payload: Record<string, string | number | boolean> = {
      type,
      path,
      clientTime: new Date().toISOString(),
      hour: new Date().getHours(),
      weekday: new Date().getDay(),
      visitorId: ctx.visitorId,
      sessionId: ctx.sessionId,
      isNewVisitor: ctx.isNewVisitor,
      isNewSession: ctx.isNewSession,
      device: ctx.device,
      browser: ctx.browser,
      os: ctx.os,
      referrer: ctx.referrer,
      referrerHost: ctx.referrerHost,
      source: ctx.source,
      channel: ctx.channel,
      landingPath: ctx.landingPath,
      timezone: ctx.timezone,
      country: ctx.country,
      language: ctx.language,
      screen: ctx.screen,
      ...restMeta,
    }
    if (typeof metaChannel === 'string' && metaChannel.trim()) {
      payload.channelTarget = metaChannel.trim()
    }
    if (ctx.utmSource) payload.utmSource = ctx.utmSource
    if (ctx.utmMedium) payload.utmMedium = ctx.utmMedium
    if (ctx.utmCampaign) payload.utmCampaign = ctx.utmCampaign

    // Lazy-load the Firestore writer so the SDK stays out of the public bundle
    // until the first event actually fires.
    void import('./analytics-write').then((m) => m.writeAnalyticsEvent(payload))
  } catch {
    /* analytics is best-effort */
  }
}
