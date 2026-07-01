import { isFirebaseConfigured } from '@/lib/firebase-config'

/**
 * Lightweight, privacy-respecting first-party analytics. No cookies, no third
 * parties — just anonymous event docs in Firestore that the admin dashboard
 * aggregates. A random visitor id lives in localStorage; a session id lives in
 * sessionStorage and expires when the tab closes.
 */

export type AnalyticsEventType =
  | 'pageview'
  | 'section_view'
  | 'outbound_click'
  | 'cv_download'
  | 'contact_submit'
  | 'language_change'

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
  timezone: string
  country: string
  language: string
  screen: string
}

const VISITOR_KEY = 'mb-visitor-id'
const SESSION_KEY = 'mb-session-id'

function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

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

let cached: AnalyticsContext | null = null

export function getAnalyticsContext(): AnalyticsContext {
  if (cached) return { ...cached, isNewVisitor: false, isNewSession: false }

  const ua = navigator.userAgent

  let visitorId = localStorage.getItem(VISITOR_KEY)
  const isNewVisitor = !visitorId
  if (!visitorId) {
    visitorId = uid()
    localStorage.setItem(VISITOR_KEY, visitorId)
  }

  let sessionId = sessionStorage.getItem(SESSION_KEY)
  const isNewSession = !sessionId
  if (!sessionId) {
    sessionId = uid()
    sessionStorage.setItem(SESSION_KEY, sessionId)
  }

  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown'
  const referrer = document.referrer || ''
  let referrerHost = 'Direct'
  if (referrer) {
    try {
      const url = new URL(referrer)
      referrerHost = url.host === location.host ? 'Internal' : url.host
    } catch {
      referrerHost = 'Unknown'
    }
  }

  cached = {
    visitorId,
    sessionId,
    isNewVisitor,
    isNewSession,
    device: detectDevice(ua),
    browser: detectBrowser(ua),
    os: detectOS(ua),
    referrer,
    referrerHost,
    timezone,
    country: countryFromTimezone(timezone),
    language: navigator.language || 'unknown',
    screen: `${window.screen.width}x${window.screen.height}`,
  }
  return cached
}

/**
 * Fire-and-forget event. Never throws into the UI — analytics must not break
 * the public site. No-ops when Firebase is not configured.
 */
export function trackEvent(
  type: AnalyticsEventType,
  meta: Record<string, string | number | boolean> = {},
): void {
  if (!isFirebaseConfigured) return
  try {
    const ctx = getAnalyticsContext()
    const payload = {
      type,
      path: location.pathname,
      clientTime: new Date().toISOString(),
      hour: new Date().getHours(),
      weekday: new Date().getDay(),
      ...ctx,
      ...meta,
    }
    // Lazy-load the Firestore writer so the SDK stays out of the public bundle
    // until the first event actually fires.
    void import('./analytics-write').then((m) => m.writeAnalyticsEvent(payload))
  } catch {
    /* analytics is best-effort */
  }
}
