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

/** Public submit from the contact form. Returns false if Firebase is off. */
export async function submitMessage(draft: MessageDraft): Promise<boolean> {
  if (!isFirebaseConfigured || !db) return false
  await addDoc(collection(db, 'messages'), {
    ...draft,
    read: false,
    createdAt: serverTimestamp(),
  })
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
