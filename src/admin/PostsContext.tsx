import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import type { PostMeta, PostStatus } from '@/blog/types'
import { isFirebaseConfigured } from '@/lib/firebase'

/**
 * The post index, loaded once per admin session.
 *
 * The blog list, the dashboard's "needs attention" panel and the command
 * palette all want the same list of posts. Fetching it here means one read
 * instead of three, and it is what lets the palette jump straight to a post by
 * title.
 *
 * Everything that touches Firestore is behind a dynamic `import()` of
 * `@/blog/service`, so the Firestore SDK still only loads when the admin
 * actually opens a page that needs it.
 */

interface PostsValue {
  posts: PostMeta[]
  loading: boolean
  error: string | null
  counts: Record<PostStatus | 'all', number>
  reload: () => void
  /** Publishes / unpublishes without opening the editor. */
  setStatus: (slug: string, status: PostStatus) => Promise<void>
  /** Copies a post into a fresh draft and returns the new slug. */
  duplicate: (slug: string) => Promise<string>
  remove: (slug: string) => Promise<void>
}

const PostsContext = createContext<PostsValue | null>(null)

export function PostsProvider({ children }: { children: ReactNode }) {
  const [posts, setPosts] = useState<PostMeta[] | null>(isFirebaseConfigured ? null : [])
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!isFirebaseConfigured) return
    let cancelled = false

    void import('@/blog/service')
      .then(({ fetchAllPosts }) => fetchAllPosts())
      .then((result) => {
        if (!cancelled) {
          setPosts(result)
          setError(null)
        }
      })
      .catch(() => {
        if (cancelled) return
        setError('Não foi possível carregar os posts.')
        setPosts([])
      })

    return () => {
      cancelled = true
    }
  }, [nonce])

  const loaded = useMemo(() => posts ?? [], [posts])

  const counts = useMemo(() => {
    const base: Record<PostStatus | 'all', number> = {
      all: loaded.length,
      draft: 0,
      unlisted: 0,
      published: 0,
    }
    for (const post of loaded) base[post.status] += 1
    return base
  }, [loaded])

  const reload = useCallback(() => {
    setPosts(null)
    setError(null)
    setNonce((value) => value + 1)
  }, [])

  /** Status lives on both the meta and the body doc, so the change has to go
   *  through `savePost` — which writes the pair in one batch. */
  const setStatus = useCallback(async (slug: string, status: PostStatus) => {
    const service = await import('@/blog/service')
    const post = await service.fetchPost(slug)
    if (!post) throw new Error('Post não encontrado.')
    await service.savePost({ ...post, status })
    setPosts((current) =>
      (current ?? []).map((item) =>
        item.slug === slug
          ? {
              ...item,
              status,
              // `savePost` stamps `publishedAt` on the first publish; mirror
              // that here so the list does not need a refetch to look right.
              publishedAt:
                status === 'draft' ? item.publishedAt : (item.publishedAt ?? new Date().toISOString()),
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    )
  }, [])

  const duplicate = useCallback(async (slug: string) => {
    const service = await import('@/blog/service')
    const post = await service.fetchPost(slug)
    if (!post) throw new Error('Post não encontrado.')

    // `-copia`, `-copia-2`, … until the slug is free. Checking is cheap and the
    // alternative is silently overwriting the previous copy.
    let candidate = `${slug}-copia`
    let attempt = 2
    while (await service.slugExists(candidate)) {
      candidate = `${slug}-copia-${attempt}`
      attempt += 1
    }

    const copy = {
      ...post,
      slug: candidate,
      title: `${post.title} (cópia)`,
      status: 'draft' as PostStatus,
      publishedAt: null,
    }
    await service.savePost(copy)
    setPosts((current) => [{ ...copy }, ...(current ?? [])])
    return candidate
  }, [])

  const remove = useCallback(async (slug: string) => {
    const { deletePost } = await import('@/blog/service')
    await deletePost(slug)
    setPosts((current) => (current ?? []).filter((item) => item.slug !== slug))
  }, [])

  const value = useMemo<PostsValue>(
    () => ({
      posts: loaded,
      loading: posts === null,
      error,
      counts,
      reload,
      setStatus,
      duplicate,
      remove,
    }),
    [loaded, posts, error, counts, reload, setStatus, duplicate, remove],
  )

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePosts(): PostsValue {
  const context = useContext(PostsContext)
  if (!context) {
    throw new Error('usePosts must be used inside <PostsProvider>')
  }
  return context
}
