import { doc, getDoc, setDoc } from 'firebase/firestore'

import { db, isFirebaseConfigured } from '@/lib/firebase'

import {
  cloneDefaultKnowledgeNotes,
  defaultDossierKnowledgeConfig,
  mergeDossierKnowledge,
  type DossierKnowledgeConfig,
} from './dossier-cms'
import type { KnowledgeNote } from './knowledge'

/**
 * Firestore persistence for the editable Dossier editorial knowledge base.
 *
 * Stored at `content/dossier` — reusing the existing `match /content/{docId}`
 * security rule (`allow read: if true; allow write: if isAdmin();`) while
 * keeping Home's `content/site` payload untouched and lazy-loaded only when
 * `/ask`, `⌘K`, or `/admin/dossier` opens.
 */

const DOSSIER_PATH = ['content', 'dossier'] as const

let sessionCache: DossierKnowledgeConfig | null = null

export function clearDossierKnowledgeCache(): void {
  sessionCache = null
}

/** One-shot read of `content/dossier` with in-memory session cache and static fallback. */
export async function fetchDossierKnowledge(
  options?: { forceRefresh?: boolean },
): Promise<DossierKnowledgeConfig> {
  if (!options?.forceRefresh && sessionCache) return sessionCache
  if (!isFirebaseConfigured || !db) {
    return defaultDossierKnowledgeConfig()
  }
  try {
    const snap = await getDoc(doc(db, ...DOSSIER_PATH))
    const merged = mergeDossierKnowledge(
      snap.exists() ? (snap.data() as Partial<DossierKnowledgeConfig>) : undefined,
    )
    sessionCache = merged
    return merged
  } catch {
    return defaultDossierKnowledgeConfig()
  }
}

/** Persists the editorial knowledge notes to `content/dossier` (admin only). */
export async function saveDossierKnowledge(
  notes: KnowledgeNote[],
): Promise<DossierKnowledgeConfig> {
  if (!db) throw new Error('Firestore not configured')
  const normalized = mergeDossierKnowledge({ notes })
  const payload: DossierKnowledgeConfig = {
    notes: normalized.notes,
    updatedAt: new Date().toISOString(),
  }
  await setDoc(doc(db, ...DOSSIER_PATH), payload)
  sessionCache = payload
  return payload
}

/** Restores `content/dossier` to the built-in defaults from `knowledge.ts`. */
export async function resetDossierKnowledge(): Promise<DossierKnowledgeConfig> {
  return saveDossierKnowledge(cloneDefaultKnowledgeNotes())
}
