/**
 * Lightweight Firebase config — holds only env values and the "is it
 * configured?" flag. Critically, this module imports NONE of the Firebase SDK,
 * so public code can branch on `isFirebaseConfigured` without pulling the heavy
 * SDK into the initial bundle. The actual SDK lives in `firebase.ts` and is
 * loaded on demand via dynamic import.
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
)
