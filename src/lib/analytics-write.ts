import { addDoc, collection, serverTimestamp } from 'firebase/firestore'

import { db, isFirebaseConfigured } from '@/lib/firebase'

/**
 * Isolated Firestore write for analytics events. Kept apart from the tracker so
 * the tracker stays trivially testable and the Firestore import sits behind the
 * `isFirebaseConfigured` guard.
 */
export async function writeAnalyticsEvent(
  data: Record<string, unknown>,
): Promise<void> {
  if (!isFirebaseConfigured || !db) return
  await addDoc(collection(db, 'analytics'), {
    ...data,
    createdAt: serverTimestamp(),
  })
}
