import type { Post } from '@/blog/types'

/**
 * Browser-local post drafts.
 *
 * The editor has always written the in-progress post to `localStorage` every
 * 800ms as a crash guard — but nothing ever read it back, so the guard saved a
 * copy nobody could reach. These helpers close that loop: the editor offers to
 * restore a newer local copy on open, and the blog list surfaces orphaned
 * drafts (a tab closed on a post that was never saved to Firestore).
 */

const PREFIX = 'mb-blog-draft:'

export interface LocalDraft {
  key: string
  /** `new` for a post that never had a slug. */
  slug: string
  title: string
  savedAt: number
  post: Post
}

export function draftKey(slug: string): string {
  return `${PREFIX}${slug || 'new'}`
}

export function writeDraft(slug: string, post: Post): void {
  try {
    localStorage.setItem(
      draftKey(slug),
      JSON.stringify({ savedAt: Date.now(), post }),
    )
  } catch {
    /* storage full or blocked — the explicit save is the real one */
  }
}

export function clearDraft(slug: string): void {
  try {
    localStorage.removeItem(draftKey(slug))
  } catch {
    /* nothing to do */
  }
}

export function readDraft(slug: string): LocalDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(slug))
    if (!raw) return null
    return parse(draftKey(slug), raw)
  } catch {
    return null
  }
}

/** Every local draft, newest first. Drives the "recuperar" row in the list. */
export function listDrafts(): LocalDraft[] {
  const drafts: LocalDraft[] = []
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (!key?.startsWith(PREFIX)) continue
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const draft = parse(key, raw)
      if (draft) drafts.push(draft)
    }
  } catch {
    return []
  }
  return drafts.sort((a, b) => b.savedAt - a.savedAt)
}

/**
 * Older builds stored the bare post without a wrapper. Both shapes are read so
 * a draft written before this change is not silently dropped.
 */
function parse(key: string, raw: string): LocalDraft | null {
  const parsed = JSON.parse(raw) as
    | { savedAt?: number; post?: Post }
    | (Post & { savedAt?: never })
  const post = 'post' in parsed && parsed.post ? parsed.post : (parsed as Post)
  if (!post || typeof post.body !== 'string') return null
  return {
    key,
    slug: key.slice(PREFIX.length),
    title: post.title?.trim() || '(sem título)',
    savedAt: ('savedAt' in parsed && parsed.savedAt) || 0,
    post,
  }
}
