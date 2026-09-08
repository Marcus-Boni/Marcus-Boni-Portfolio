import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import {
  AdminButton,
  Badge,
  Banner,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
  TextInput,
} from '@/admin/components/ui'
import { formatPostDate } from '@/blog/lib/text'
import type { PostMeta, PostStatus } from '@/blog/types'
import { isFirebaseConfigured } from '@/lib/firebase'
import { cn } from '@/lib/utils'

const STATUS_LABEL: Record<PostStatus, string> = {
  draft: 'Rascunho',
  unlisted: 'Não listado',
  published: 'Publicado',
}

const STATUS_TONE: Record<PostStatus, 'neutral' | 'ember' | 'muted'> = {
  draft: 'muted',
  unlisted: 'neutral',
  published: 'ember',
}

/** Every post, drafts included — the editor's front door. */
export function BlogList() {
  const navigate = useNavigate()
  // `posts === null` means "not fetched yet", which is what `loading` is
  // derived from — no synchronous state write inside the effect.
  const [posts, setPosts] = useState<PostMeta[] | null>(
    isFirebaseConfigured ? null : [],
  )
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<PostStatus | 'all'>('all')
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => {
    setPosts(null)
    setError(null)
    setNonce((value) => value + 1)
  }, [])

  useEffect(() => {
    if (!isFirebaseConfigured) return
    let cancelled = false

    void import('@/blog/service')
      .then(({ fetchAllPosts }) => fetchAllPosts())
      .then((result) => {
        if (!cancelled) setPosts(result)
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

  const loading = posts === null
  const loaded = useMemo(() => posts ?? [], [posts])

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    return loaded.filter(
      (post) =>
        (statusFilter === 'all' || post.status === statusFilter) &&
        (!needle ||
          post.title.toLowerCase().includes(needle) ||
          post.slug.includes(needle) ||
          post.tags.some((tag) => tag.toLowerCase().includes(needle))),
    )
  }, [loaded, filter, statusFilter])

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

  const remove = async (post: PostMeta) => {
    const confirmed = window.confirm(
      `Excluir "${post.title}" definitivamente? As imagens no Storage não são removidas.`,
    )
    if (!confirmed) return
    try {
      const { deletePost } = await import('@/blog/service')
      await deletePost(post.slug)
      setPosts((current) => (current ?? []).filter((item) => item.slug !== post.slug))
    } catch {
      setError('Falha ao excluir o post.')
    }
  }

  return (
    <>
      <PageHeader
        title="Blog"
        subtitle="Estudos, bastidores de projeto e notas técnicas. Rascunhos ficam invisíveis no site; “não listado” abre por link direto, mas fica fora do índice, do RSS e do sitemap."
        actions={
          <AdminButton variant="solid" onClick={() => navigate('/admin/blog/new')}>
            Novo post
          </AdminButton>
        }
      />

      {!isFirebaseConfigured && (
        <div className="mb-6">
          <Banner tone="warn">
            Firebase não configurado — o blog precisa das variáveis
            <code className="mx-1 text-ember">VITE_FIREBASE_*</code>
            e do plano Blaze para o Storage de mídia.
          </Banner>
        </div>
      )}

      {error && (
        <div className="mb-6">
          <Banner tone="error">
            <span className="flex flex-wrap items-center justify-between gap-3">
              {error}
              <button
                type="button"
                onClick={reload}
                className="font-mono text-[10px] tracking-[0.18em] text-ember uppercase hover:underline"
              >
                Tentar novamente
              </button>
            </span>
          </Banner>
        </div>
      )}

      <Card className="mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <TextInput
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Buscar por título, slug ou tag…"
            className="md:max-w-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'published', 'unlisted', 'draft'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={cn(
                  'border px-2.5 py-1 font-mono text-[10px] tracking-[0.16em] uppercase transition-colors',
                  statusFilter === key
                    ? 'border-ember text-ember'
                    : 'border-line text-smoke hover:text-bone-dim',
                )}
              >
                {key === 'all' ? 'Todos' : STATUS_LABEL[key]} ({counts[key]})
              </button>
            ))}
          </div>
        </div>
      </Card>

      {loading ? (
        <Spinner label="Carregando posts" />
      ) : visible.length === 0 ? (
        <EmptyState
          title={loaded.length === 0 ? 'Nenhum post ainda' : 'Nada com esse filtro'}
          description={
            loaded.length === 0
              ? 'Comece pelo primeiro registro — pode ser o resumo de um estudo recente.'
              : undefined
          }
        />
      ) : (
        <ul className="border-t border-line">
          {visible.map((post) => (
            <li
              key={post.slug}
              className="flex flex-col gap-3 border-b border-line py-4 md:flex-row md:items-center md:gap-6"
            >
              <div className="min-w-0 flex-1">
                <Link
                  to={`/admin/blog/${post.slug}`}
                  className="block truncate font-display text-xl text-bone transition-colors hover:text-ember"
                >
                  {post.title || '(sem título)'}
                </Link>
                <p className="mt-1 truncate font-mono text-[10px] tracking-[0.14em] text-smoke">
                  /blog/{post.slug}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STATUS_TONE[post.status]}>
                  {STATUS_LABEL[post.status]}
                </Badge>
                <Badge>{post.lang.toUpperCase()}</Badge>
                <span className="font-mono text-[10px] tracking-[0.14em] text-smoke uppercase">
                  {post.publishedAt
                    ? formatPostDate(post.publishedAt, 'pt')
                    : `ed. ${formatPostDate(post.updatedAt, 'pt')}`}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {post.status !== 'draft' && (
                  <a
                    href={`/blog/${post.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[10px] tracking-[0.16em] text-smoke uppercase transition-colors hover:text-ember"
                  >
                    Ver
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => void remove(post)}
                  className="font-mono text-[10px] tracking-[0.16em] text-smoke uppercase transition-colors hover:text-ember"
                >
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
