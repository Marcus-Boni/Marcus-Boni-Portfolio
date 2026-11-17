import { useCallback, useEffect, useState } from 'react'

import type { Post, PostMeta } from '@/blog/types'
import { isFirebaseConfigured } from '@/lib/firebase-config'

type Status = 'loading' | 'ready' | 'error'

/**
 * Development only. `/blog?demo=1` swaps Firestore for the sample entries in
 * `dev-fixtures.ts` (and `?demo=0` swaps it back), so the journal can be
 * designed and reviewed without publishing anything. The flag lives in
 * sessionStorage because the index rewrites its own query string.
 *
 * Call sites test `import.meta.env.DEV` themselves, right beside the dynamic
 * import. That constant is replaced at build time, so the whole branch is dead
 * code in production and the fixtures chunk is never emitted — hiding the
 * check inside this function would leave the bundler unable to prove it.
 */
function demoMode(): boolean {
  if (typeof window === 'undefined') return false
  const flag = new URLSearchParams(window.location.search).get('demo')
  if (flag === '1') window.sessionStorage.setItem('blog-demo', '1')
  if (flag === '0') window.sessionStorage.removeItem('blog-demo')
  return window.sessionStorage.getItem('blog-demo') === '1'
}

/**
 * Blog data loading.
 *
 * The Firestore SDK is reached through a dynamic `import()` of `./service`, the
 * same discipline the rest of the site follows — except the deferral here is
 * only about chunking, not interaction gating: on a blog route the posts *are*
 * the content, so waiting for a user gesture would just be a blank page.
 *
 * `status` is *derived* from what has arrived rather than assigned in the
 * effect. That keeps a slug change showing "loading" for free (the stored
 * result no longer matches the requested slug) instead of needing a
 * synchronous state write on every navigation.
 */

/** The published index. Filtering happens in the page, on the returned array. */
export function usePostList() {
  const [posts, setPosts] = useState<PostMeta[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [nonce, setNonce] = useState(0)

  const retry = useCallback(() => {
    setFailed(false)
    setPosts(null)
    setNonce((value) => value + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    if (import.meta.env.DEV && demoMode()) {
      void import('./dev-fixtures').then(({ fixturePosts }) => {
        if (!cancelled) setPosts(fixturePosts)
      })
      return () => {
        cancelled = true
      }
    }
    if (!isFirebaseConfigured) return

    void import('./service')
      .then(({ fetchPublishedPosts }) => fetchPublishedPosts())
      .then((result) => {
        if (!cancelled) setPosts(result)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [nonce])

  const status: Status = !isFirebaseConfigured
    ? 'ready'
    : failed
      ? 'error'
      : posts
        ? 'ready'
        : 'loading'

  return { posts: posts ?? [], status, retry }
}

/** One post with its body. `null` once loaded means "no such post". */
export function usePost(slug: string | undefined) {
  // Keyed by slug so a stale result never renders under a new URL.
  const [result, setResult] = useState<{ slug: string; post: Post | null } | null>(
    null,
  )
  const [failedSlug, setFailedSlug] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const retry = useCallback(() => {
    setFailedSlug(null)
    setNonce((value) => value + 1)
  }, [])

  useEffect(() => {
    if (!slug) return
    let cancelled = false

    if (import.meta.env.DEV && demoMode()) {
      void import('./dev-fixtures').then(({ fixturePosts }) => {
        const post = fixturePosts.find((candidate) => candidate.slug === slug) ?? null
        if (!cancelled) setResult({ slug, post })
      })
      return () => {
        cancelled = true
      }
    }
    if (!isFirebaseConfigured) return

    void import('./service')
      .then(({ fetchPost }) => fetchPost(slug))
      .then((post) => {
        if (!cancelled) setResult({ slug, post })
      })
      .catch(() => {
        if (!cancelled) setFailedSlug(slug)
      })

    return () => {
      cancelled = true
    }
  }, [slug, nonce])

  // Narrowing through a separate boolean would lose the null check, so keep
  // the comparison on the value itself.
  const current = result && result.slug === slug ? result : null
  const status: Status =
    !isFirebaseConfigured || !slug
      ? 'ready'
      : failedSlug === slug
        ? 'error'
        : current
          ? 'ready'
          : 'loading'

  return { post: current?.post ?? null, status, retry }
}
