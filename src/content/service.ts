import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore'

import { db, isFirebaseConfigured } from '@/lib/firebase'

import { cloneDefaultContent, defaultSiteContent } from './defaults'
import { ensureContentIds } from './ids'
import type { SiteContent } from './types'

const CONTENT_PATH = ['content', 'site'] as const

/**
 * Merge a (possibly partial) Firestore payload over the static defaults so the
 * site never renders with missing fields, even if the stored doc predates a
 * schema addition.
 */
export function mergeContent(partial: Partial<SiteContent> | undefined): SiteContent {
  if (!partial) return cloneDefaultContent()
  const fallback = cloneDefaultContent()
  return ensureContentIds({
    profile: { ...defaultSiteContent.profile, ...partial.profile },
    projects: partial.projects ?? fallback.projects,
    experience: partial.experience ?? fallback.experience,
    techStack: partial.techStack ?? fallback.techStack,
    socials: partial.socials ?? fallback.socials,
    updatedAt: partial.updatedAt,
  })
}

/** Live-subscribe to the content doc. Returns an unsubscribe (no-op if offline). */
export function subscribeSiteContent(
  onData: (content: SiteContent) => void,
  onError?: (error: Error) => void,
): () => void {
  if (!isFirebaseConfigured || !db) {
    onData(cloneDefaultContent())
    return () => {}
  }
  const ref = doc(db, ...CONTENT_PATH)
  return onSnapshot(
    ref,
    (snap) => onData(mergeContent(snap.data() as Partial<SiteContent>)),
    (error) => onError?.(error),
  )
}

/** One-shot read of the content doc, falling back to defaults. */
export async function fetchSiteContent(): Promise<SiteContent> {
  if (!isFirebaseConfigured || !db) return cloneDefaultContent()
  const snap = await getDoc(doc(db, ...CONTENT_PATH))
  return mergeContent(snap.data() as Partial<SiteContent> | undefined)
}

/** Persist the full content payload (admin only). */
export async function saveSiteContent(content: SiteContent): Promise<void> {
  if (!db) throw new Error('Firestore not configured')
  const payload: SiteContent = { ...content, updatedAt: new Date().toISOString() }
  await setDoc(doc(db, ...CONTENT_PATH), payload)
}

/** Overwrite stored content with the static defaults. */
export async function resetSiteContent(): Promise<void> {
  await saveSiteContent(cloneDefaultContent())
}
