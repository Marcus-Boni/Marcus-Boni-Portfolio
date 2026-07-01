import { initializeApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

import { firebaseConfig, isFirebaseConfigured } from '@/lib/firebase-config'

/**
 * Firebase is wired entirely through Vite env vars (see `.env.example`). When
 * the keys are absent the whole admin surface degrades gracefully: the public
 * site falls back to the static `profile.ts` data and analytics/auth become
 * no-ops. Nothing here throws on a missing config — callers check
 * `isFirebaseConfigured` first.
 *
 * Importing this module pulls in the Firebase SDK, so public code should branch
 * on `isFirebaseConfigured` (from `firebase-config.ts`) and `import()` this
 * lazily instead of importing it at the top level.
 */
export { isFirebaseConfigured }

let authInstance: Auth | null = null
let dbInstance: Firestore | null = null

if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig)
  authInstance = getAuth(app)
  dbInstance = getFirestore(app)
}

/** Auth instance, or `null` when Firebase is not configured. */
export const auth = authInstance
/** Firestore instance, or `null` when Firebase is not configured. */
export const db = dbInstance

/** Narrowing helper for call sites that must have a live Firestore. */
export function requireDb(): Firestore {
  if (!dbInstance) {
    throw new Error(
      'Firestore is not configured. Set the VITE_FIREBASE_* env vars.',
    )
  }
  return dbInstance
}

/** Narrowing helper for call sites that must have a live Auth. */
export function requireAuth(): Auth {
  if (!authInstance) {
    throw new Error(
      'Firebase Auth is not configured. Set the VITE_FIREBASE_* env vars.',
    )
  }
  return authInstance
}
