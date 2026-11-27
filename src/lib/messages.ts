import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore'

import { db, isFirebaseConfigured } from '@/lib/firebase'

export interface ContactMessage {
  id: string
  name: string
  email: string
  message: string
  locale: string
  read: boolean
  createdAt: Date | null
  referrerHost?: string
  country?: string
}

export interface MessageDraft {
  name: string
  email: string
  message: string
  locale: string
  referrerHost?: string
  country?: string
}

const SUBMIT_COOLDOWN_MS = 10_000
let lastSubmitAt = 0

/** Public submit from the contact form. Returns false if Firebase is off or throttled. */
export async function submitMessage(draft: MessageDraft): Promise<boolean> {
  if (!isFirebaseConfigured || !db) return false
  const now = Date.now()
  if (now - lastSubmitAt < SUBMIT_COOLDOWN_MS) return false

  const name = draft.name.trim().slice(0, 120)
  const email = draft.email.trim().slice(0, 200)
  const message = draft.message.trim().slice(0, 5000)
  const locale = draft.locale === 'en' ? 'en' : 'pt'
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !message) return false

  const payload: Record<string, unknown> = {
    name,
    email,
    message,
    locale,
    read: false,
    createdAt: serverTimestamp(),
  }
  if (typeof draft.referrerHost === 'string' && draft.referrerHost.trim()) {
    payload.referrerHost = draft.referrerHost.trim().slice(0, 120)
  }
  if (typeof draft.country === 'string' && draft.country.trim()) {
    payload.country = draft.country.trim().slice(0, 80)
  }

  await addDoc(collection(db, 'messages'), payload)
  lastSubmitAt = now
  return true
}

interface MessageDoc {
  name?: string
  email?: string
  message?: string
  locale?: string
  read?: boolean
  createdAt?: Timestamp | null
  referrerHost?: string
  country?: string
}

/** Admin: live list of messages, newest first. */
export function subscribeMessages(
  onData: (messages: ContactMessage[]) => void,
): () => void {
  if (!isFirebaseConfigured || !db) {
    onData([])
    return () => {}
  }
  const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    onData(
      snap.docs.map((d) => {
        const data = d.data() as MessageDoc
        return {
          id: d.id,
          name: data.name ?? '',
          email: data.email ?? '',
          message: data.message ?? '',
          locale: data.locale ?? 'pt',
          read: Boolean(data.read),
          createdAt: data.createdAt?.toDate() ?? null,
          referrerHost: data.referrerHost,
          country: data.country,
        }
      }),
    )
  })
}

export async function markMessageRead(id: string, read: boolean): Promise<void> {
  if (!db) return
  await updateDoc(doc(db, 'messages', id), { read })
}

export async function deleteMessage(id: string): Promise<void> {
  if (!db) return
  await deleteDoc(doc(db, 'messages', id))
}
