import { doc, onSnapshot, setDoc } from 'firebase/firestore'

import { db, isFirebaseConfigured } from '@/lib/firebase'

/**
 * Admin-managed analytics hygiene preferences (`settings/analytics`).
 *
 * Stores anonymous random `visitorId` UUIDs belonging to the site owner's own
 * devices (notebook, phone, work browser) so historical events recorded before
 * browser-level exclusion was enabled are filtered out across every device the
 * owner opens `/admin` from. Contains zero PII.
 */

export interface AnalyticsSettings {
  excludedVisitorIds: string[]
  updatedAt?: string
}

const SETTINGS_PATH = ['settings', 'analytics'] as const
const LOCAL_MIRROR_KEY = 'mb-admin-excluded-visitors'

function readLocal(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_MIRROR_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : []
  } catch {
    return []
  }
}

function writeLocal(ids: string[]): void {
  try {
    localStorage.setItem(LOCAL_MIRROR_KEY, JSON.stringify(ids))
  } catch {
    /* ignore storage errors */
  }
}

function normalizeIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  const seen = new Set<string>()
  for (const item of ids) {
    if (typeof item === 'string') {
      const clean = item.trim().slice(0, 80)
      if (clean.length >= 4) seen.add(clean)
    }
  }
  return [...seen].slice(0, 50)
}

export function subscribeAnalyticsSettings(
  onData: (settings: AnalyticsSettings) => void,
): () => void {
  const localIds = readLocal()
  if (!isFirebaseConfigured || !db) {
    onData({ excludedVisitorIds: localIds })
    return () => {}
  }

  return onSnapshot(
    doc(db, ...SETTINGS_PATH),
    (snap) => {
      const data = snap.data() as Partial<AnalyticsSettings> | undefined
      const remoteIds = normalizeIds(data?.excludedVisitorIds)
      const merged = normalizeIds([...remoteIds, ...localIds])
      writeLocal(merged)
      onData({
        excludedVisitorIds: merged,
        updatedAt: typeof data?.updatedAt === 'string' ? data.updatedAt : undefined,
      })
    },
    () => {
      onData({ excludedVisitorIds: localIds })
    },
  )
}

export async function saveExcludedVisitorIds(ids: string[]): Promise<string[]> {
  const clean = normalizeIds(ids)
  writeLocal(clean)
  if (!isFirebaseConfigured || !db) return clean
  await setDoc(
    doc(db, ...SETTINGS_PATH),
    {
      excludedVisitorIds: clean,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )
  return clean
}
