import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { usePosts } from '@/admin/PostsContext'
import { useConfirm } from '@/admin/components/overlays'
import { useToast } from '@/admin/components/toast'
import {
  AdminButton,
  Badge,
  Banner,
  Card,
  EmptyState,
  IconButton,
  PageHeader,
  SearchInput,
  Segmented,
  Select,
  SkeletonRows,
  focusRing,
} from '@/admin/components/ui'
import { useDebounced } from '@/admin/hooks'
import { clearDraft, listDrafts } from '@/admin/lib/local-drafts'
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

type Sort = 'recent' | 'title' | 'oldest'

/**
 * Every post, drafts included — the editor's front door.
 *
 * Two additions carry the page. Publishing no longer requires opening the
 * editor: the status button writes the batch directly, which is what you want
 * when a draft is finished and you are looking at the list. And local drafts
 * (the editor's `localStorage` crash guard) finally surface — they used to be
 * written and never read, so a tab closed before the first save was gone with
 * no way to know it had ever existed.
 */
export function BlogList() {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const { posts, counts, loading, error, reload, setStatus, duplicate, remove } = usePosts()

  const [rawQuery, setQuery] = useState('')
  const query = useDebounced(rawQuery)
  const [statusFilter, setStatusFilter] = useState<PostStatus | 'all'>('all')
  const [sort, setSort] = useState<Sort>('recent')
  const [busy, setBusy] = useState<string | null>(null)
  const [drafts, setDrafts] = useState(() => listDrafts())

  /** Local drafts with no matching post: a session that never reached save. */
  const orphanDrafts = useMemo(
    () =>
      drafts.filter(
        (draft) => draft.slug === 'new' || !posts.some((post) => post.slug === draft.slug),
      ),
    [drafts, posts],
  )

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = posts.filter(
      (post) =>
        (statusFilter === 'all' || post.status === statusFilter) &&
        (!needle ||
          post.title.toLowerCase().includes(needle) ||
          post.slug.includes(needle) ||
          post.tags.some((tag) => tag.toLowerCase().includes(needle))),
    )
    return [...filtered].sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, 'pt-BR')
      const left = a.publishedAt ?? a.updatedAt
      const right = b.publishedAt ?? b.updatedAt
      return sort === 'oldest' ? left.localeCompare(right) : right.localeCompare(left)
    })
  }, [posts, statusFilter, query, sort])

  const onRemove = async (post: PostMeta) => {
    const yes = await confirm({
      title: `Excluir “${post.title}”?`,
      description:
        'O post e o corpo em Markdown são apagados. As imagens continuam no Storage — limpe a pasta em Mídia depois.',
      confirmLabel: 'Excluir post',
      tone: 'danger',
    })
    if (!yes) return
    setBusy(post.slug)
    try {
      await remove(post.slug)
      toast.success('Post excluído.')
    } catch {
      toast.error('Falha ao excluir o post.')
    } finally {
      setBusy(null)
    }
  }

  const onToggleStatus = async (post: PostMeta) => {
    const next: PostStatus = post.status === 'published' ? 'draft' : 'published'
    if (next === 'published') {
      const yes = await confirm({
        title: `Publicar “${post.title}”?`,
        description:
          'Entra no índice, no RSS e no sitemap, e fica indexável. Você pode voltar para rascunho depois.',
        confirmLabel: 'Publicar',
        tone: 'neutral',
      })
      if (!yes) return
    }
    setBusy(post.slug)
    try {
      await setStatus(post.slug, next)
      toast.success(next === 'published' ? 'Post publicado.' : 'Post volta a rascunho.')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Falha ao mudar o status.')
    } finally {
      setBusy(null)
    }
  }

  const onDuplicate = async (post: PostMeta) => {
    setBusy(post.slug)
    try {
      const slug = await duplicate(post.slug)
      toast.success('Cópia criada como rascunho.', {
        action: { label: 'Abrir', onClick: () => navigate(`/admin/blog/${slug}`) },
      })
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Falha ao duplicar.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Blog"
        subtitle="Estudos, bastidores de projeto e notas técnicas. Rascunhos ficam invisíveis no site; “não listado” abre por link direto, mas fica fora do índice, do RSS e do sitemap."
        meta={
          <span className="font-mono text-[10px] tracking-[0.16em] text-smoke uppercase">
            {counts.published} publicado(s) · {counts.unlisted} não listado(s) ·{' '}
            {counts.draft} rascunho(s)
          </span>
        }
        actions={
          <>
            <AdminButton variant="subtle" onClick={reload} disabled={loading}>
              ↻ Recarregar
            </AdminButton>
            <AdminButton variant="solid" onClick={() => navigate('/admin/blog/new')}>
              Novo post
            </AdminButton>
          </>
        }
      />

      {!isFirebaseConfigured && (
        <div className="mb-6">
          <Banner tone="warn" title="Firebase não configurado">
            O blog precisa das variáveis{' '}
            <code className="text-ember">VITE_FIREBASE_*</code> e do plano Blaze para o
            Storage de mídia.
          </Banner>
        </div>
      )}

      {error && (
        <div className="mb-6">
          <Banner
            tone="error"
            action={
              <AdminButton variant="ghost" size="sm" onClick={reload}>
                Tentar de novo
              </AdminButton>
            }
          >
            {error}
          </Banner>
        </div>
      )}

      {orphanDrafts.length > 0 && (
        <div className="mb-6">
          <Banner tone="warn" title="Rascunhos salvos só neste navegador">
            <ul className="mt-1 flex flex-col gap-2">
              {orphanDrafts.map((draft) => (
                <li key={draft.key} className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {draft.title}
                    <span className="ml-2 font-mono text-[10px] text-smoke">
                      {draft.savedAt
                        ? new Date(draft.savedAt).toLocaleString('pt-BR')
                        : 'sem data'}
                    </span>
                  </span>
                  <Link
                    to={draft.slug === 'new' ? '/admin/blog/new' : `/admin/blog/${draft.slug}`}
                    className={cn(
                      'font-mono text-[10px] tracking-[0.16em] text-ember uppercase hover:underline',
                      focusRing,
                    )}
                  >
                    Recuperar
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      clearDraft(draft.slug)
                      setDrafts(listDrafts())
                      toast.info('Rascunho local descartado.')
                    }}
                    className={cn(
                      'font-mono text-[10px] tracking-[0.16em] text-smoke uppercase hover:text-ember',
                      focusRing,
                    )}
                  >
                    Descartar
                  </button>
                </li>
              ))}
            </ul>
          </Banner>
        </div>
      )}

      <Card className="mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <SearchInput
            value={rawQuery}
            onChange={setQuery}
            placeholder="Buscar por título, slug ou tag…"
            className="lg:max-w-xs lg:flex-1"
          />
          <Segmented
            label="Filtrar por status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'Todos', count: counts.all },
              { value: 'published', label: STATUS_LABEL.published, count: counts.published },
              { value: 'unlisted', label: STATUS_LABEL.unlisted, count: counts.unlisted },
              { value: 'draft', label: STATUS_LABEL.draft, count: counts.draft },
            ]}
          />
          <Select
            aria-label="Ordenar"
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
            className="lg:ml-auto lg:w-48"
          >
            <option value="recent">Mais recentes</option>
            <option value="oldest">Mais antigos</option>
            <option value="title">Título (A–Z)</option>
          </Select>
        </div>
      </Card>

      {loading ? (
        <SkeletonRows rows={5} height="h-20" />
      ) : visible.length === 0 ? (
        <EmptyState
          title={posts.length === 0 ? 'Nenhum post ainda' : 'Nada com esse filtro'}
          description={
            posts.length === 0
              ? 'Comece pelo primeiro registro — pode ser o resumo de um estudo recente.'
              : undefined
          }
          action={
            posts.length === 0 ? (
              <AdminButton variant="solid" onClick={() => navigate('/admin/blog/new')}>
                Escrever o primeiro
              </AdminButton>
            ) : undefined
          }
        />
      ) : (
        <ul className="border-t border-line">
          {visible.map((post) => (
            <li
              key={post.slug}
              className={cn(
                'flex flex-col gap-3 border-b border-line py-4 md:flex-row md:items-center md:gap-5',
                busy === post.slug && 'opacity-50',
              )}
            >
              <div className="hidden size-14 shrink-0 overflow-hidden border border-line bg-ink-soft md:block">
                {post.cover ? (
                  <img
                    src={post.cover.variants[0]?.url ?? post.cover.src}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center font-mono text-[9px] text-smoke uppercase">
                    s/capa
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <Link
                  to={`/admin/blog/${post.slug}`}
                  className={cn(
                    'block truncate font-display text-xl text-bone transition-colors hover:text-ember',
                    focusRing,
                  )}
                >
                  {post.title || '(sem título)'}
                </Link>
                <p className="mt-0.5 truncate font-mono text-[10px] tracking-[0.14em] text-smoke">
                  /blog/{post.slug}
                  {post.tags.length > 0 && ` · ${post.tags.join(' · ')}`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STATUS_TONE[post.status]}>{STATUS_LABEL[post.status]}</Badge>
                <Badge>{post.lang.toUpperCase()}</Badge>
                <span
                  className="font-mono text-[10px] tracking-[0.14em] text-smoke uppercase"
                  title={`Atualizado em ${formatPostDate(post.updatedAt, 'pt')}`}
                >
                  {post.publishedAt
                    ? formatPostDate(post.publishedAt, 'pt')
                    : `ed. ${formatPostDate(post.updatedAt, 'pt')}`}
                </span>
                <span className="font-mono text-[10px] text-smoke">
                  {post.readingMinutes} min
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <AdminButton
                  size="sm"
                  variant={post.status === 'published' ? 'subtle' : 'outline'}
                  disabled={busy !== null}
                  onClick={() => void onToggleStatus(post)}
                  title={
                    post.status === 'published'
                      ? 'Volta para rascunho e sai do índice'
                      : 'Publica e entra no índice, RSS e sitemap'
                  }
                >
                  {post.status === 'published' ? 'Despublicar' : 'Publicar'}
                </AdminButton>
                {post.status !== 'draft' && (
                  <IconButton
                    size="sm"
                    label="Abrir no site"
                    onClick={() => window.open(`/blog/${post.slug}`, '_blank', 'noopener')}
                  >
                    ↗
                  </IconButton>
                )}
                <IconButton
                  size="sm"
                  label="Duplicar"
                  disabled={busy !== null}
                  onClick={() => void onDuplicate(post)}
                >
                  ⧉
                </IconButton>
                <IconButton
                  size="sm"
                  label="Excluir"
                  variant="danger"
                  disabled={busy !== null}
                  onClick={() => void onRemove(post)}
                >
                  ✕
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
