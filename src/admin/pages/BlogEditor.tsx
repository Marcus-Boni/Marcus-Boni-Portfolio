import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { MarkdownEditor } from '@/admin/components/MarkdownEditor'
import { MediaUploader } from '@/admin/components/MediaUploader'
import {
  AdminButton,
  Badge,
  Banner,
  Card,
  Field,
  PageHeader,
  Select,
  Spinner,
  TextArea,
  TextInput,
  Toggle,
} from '@/admin/components/ui'
import { PostBody } from '@/blog/components/PostBody'
import { autoExcerpt, readingMinutes, slugify } from '@/blog/lib/text'
import { emptyPost, type MediaRef, type Post, type PostStatus } from '@/blog/types'
import { isFirebaseConfigured } from '@/lib/firebase'
import { cn } from '@/lib/utils'

type Pane = 'split' | 'write' | 'preview'

const STATUS_OPTIONS: { value: PostStatus; label: string; hint: string }[] = [
  { value: 'draft', label: 'Rascunho', hint: 'Invisível no site. Só você enxerga.' },
  {
    value: 'unlisted',
    label: 'Não listado',
    hint: 'Abre por link direto, fora do índice, do RSS e do sitemap.',
  },
  { value: 'published', label: 'Publicado', hint: 'Visível para todos e indexável.' },
]

/** Crash guard: the draft survives a reload even before the first save. */
const localKey = (slug: string) => `mb-blog-draft:${slug || 'new'}`

export function BlogEditor() {
  const { slug: routeSlug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const isNew = !routeSlug || routeSlug === 'new'

  const [post, setPost] = useState<Post>(() => emptyPost('pt'))
  const [loading, setLoading] = useState(!isNew && isFirebaseConfigured)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [pane, setPane] = useState<Pane>('split')
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [showCover, setShowCover] = useState(false)
  const [showBodyUploader, setShowBodyUploader] = useState(false)
  const [tagInput, setTagInput] = useState('')
  /** The slug the post is stored under, so a rename can clean up the old doc. */
  const originalSlug = useRef<string | null>(isNew ? null : (routeSlug ?? null))

  /* ─── Load ────────────────────────────────────────────────── */
  useEffect(() => {
    if (isNew || !isFirebaseConfigured || !routeSlug) return
    let cancelled = false
    void import('@/blog/service')
      .then(({ fetchPost }) => fetchPost(routeSlug))
      .then((result) => {
        if (cancelled) return
        if (result) {
          setPost(result)
          originalSlug.current = result.slug
        } else {
          setMessage({ tone: 'error', text: 'Post não encontrado.' })
        }
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setMessage({ tone: 'error', text: 'Falha ao carregar o post.' })
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [isNew, routeSlug])

  /* ─── Local autosave ──────────────────────────────────────── */
  useEffect(() => {
    if (!dirty) return
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(localKey(post.slug), JSON.stringify(post))
      } catch {
        /* storage full or blocked — the explicit save is the real one */
      }
    }, 800)
    return () => window.clearTimeout(id)
  }, [post, dirty])

  /* ─── Leave guard ─────────────────────────────────────────── */
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const patch = useCallback((changes: Partial<Post>) => {
    setPost((current) => ({ ...current, ...changes }))
    setDirty(true)
  }, [])

  /* Slug follows the title until it is edited by hand — after that it is
     yours, because changing it silently would break a published URL. */
  const onTitleChange = (title: string) => {
    patch(slugTouched ? { title } : { title, slug: slugify(title) })
  }

  const minutes = useMemo(() => readingMinutes(post.body), [post.body])

  const addTag = (raw: string) => {
    const tag = raw.trim().replace(/,$/, '')
    if (!tag || post.tags.includes(tag)) return
    patch({ tags: [...post.tags, tag] })
    setTagInput('')
  }

  const insertMedia = (media: MediaRef) => {
    const id = crypto.randomUUID().slice(0, 8)
    patch({
      media: { ...(post.media ?? {}), [id]: media },
      body: `${post.body}${post.body.endsWith('\n') || !post.body ? '' : '\n'}\n![](media:${id})\n`,
    })
  }

  const save = async () => {
    if (!isFirebaseConfigured) return
    const slug = post.slug || slugify(post.title)
    if (!slug) {
      setMessage({ tone: 'error', text: 'Defina um título ou um slug antes de salvar.' })
      return
    }
    if (!post.title.trim()) {
      setMessage({ tone: 'error', text: 'O post precisa de um título.' })
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      const service = await import('@/blog/service')

      // A slug change on an existing post would otherwise leave the old
      // document behind, still live at the old URL.
      const renaming = originalSlug.current !== null && originalSlug.current !== slug
      if (renaming && (await service.slugExists(slug))) {
        setMessage({ tone: 'error', text: `Já existe um post com o slug "${slug}".` })
        setSaving(false)
        return
      }
      if (isNew && (await service.slugExists(slug))) {
        setMessage({ tone: 'error', text: `Já existe um post com o slug "${slug}".` })
        setSaving(false)
        return
      }

      const payload: Post = {
        ...post,
        slug,
        excerpt: post.excerpt.trim() || autoExcerpt(post.body),
      }
      await service.savePost(payload)
      if (renaming && originalSlug.current) {
        await service.deletePost(originalSlug.current)
      }

      localStorage.removeItem(localKey(post.slug))
      originalSlug.current = slug
      setPost(payload)
      setDirty(false)
      setMessage({ tone: 'success', text: 'Salvo.' })
      if (isNew || renaming) navigate(`/admin/blog/${slug}`, { replace: true })
    } catch (cause) {
      setMessage({
        tone: 'error',
        text: cause instanceof Error ? cause.message : 'Falha ao salvar.',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner label="Carregando post" />

  return (
    <>
      <PageHeader
        title={isNew ? 'Novo post' : 'Editar post'}
        subtitle={post.slug ? `/blog/${post.slug}` : undefined}
        actions={
          <>
            <div className="flex items-center gap-1 border border-line p-0.5">
              {(['write', 'split', 'preview'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPane(value)}
                  className={cn(
                    'px-2.5 py-1 font-mono text-[10px] tracking-[0.16em] uppercase transition-colors',
                    pane === value ? 'bg-ember/15 text-ember' : 'text-smoke hover:text-bone-dim',
                  )}
                >
                  {value === 'write' ? 'Escrever' : value === 'split' ? 'Dividido' : 'Preview'}
                </button>
              ))}
            </div>
            <AdminButton variant="ghost" onClick={() => navigate('/admin/blog')}>
              Voltar
            </AdminButton>
            <AdminButton
              variant="solid"
              onClick={() => void save()}
              disabled={saving || !isFirebaseConfigured}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </AdminButton>
          </>
        }
      />

      {message && (
        <div className="mb-6">
          <Banner tone={message.tone === 'success' ? 'success' : 'error'}>
            {message.text}
          </Banner>
        </div>
      )}

      {/* ─── Metadata ──────────────────────────────────────────── */}
      <Card className="mb-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Título">
              <TextInput
                value={post.title}
                onChange={(event) => onTitleChange(event.target.value)}
                placeholder="O que você aprendeu?"
              />
            </Field>
          </div>

          <Field label="Subtítulo" hint="A linha editorial sob o título. Opcional.">
            <TextInput
              value={post.subtitle ?? ''}
              onChange={(event) => patch({ subtitle: event.target.value })}
            />
          </Field>

          <Field label="Slug" hint="Define a URL. Mudar depois de publicar quebra links.">
            <TextInput
              value={post.slug}
              onChange={(event) => {
                setSlugTouched(true)
                patch({ slug: slugify(event.target.value) })
              }}
            />
          </Field>

          <div className="md:col-span-2">
            <Field
              label="Resumo"
              hint={`Cards, meta description e RSS. ${post.excerpt.length}/200 — vazio gera automático.`}
            >
              <TextArea
                value={post.excerpt}
                maxLength={200}
                onChange={(event) => patch({ excerpt: event.target.value })}
              />
            </Field>
          </div>

          <Field label="Idioma">
            <Select
              value={post.lang}
              onChange={(event) => patch({ lang: event.target.value as 'pt' | 'en' })}
            >
              <option value="pt">Português</option>
              <option value="en">English</option>
            </Select>
          </Field>

          <Field
            label="Status"
            hint={STATUS_OPTIONS.find((option) => option.value === post.status)?.hint}
          >
            <Select
              value={post.status}
              onChange={(event) => patch({ status: event.target.value as PostStatus })}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="md:col-span-2">
            <Field label="Tags" hint="Enter ou vírgula para adicionar.">
              <div className="flex flex-wrap items-center gap-2 border border-line bg-ink px-3 py-2">
                {post.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => patch({ tags: post.tags.filter((item) => item !== tag) })}
                    className="group flex items-center gap-1.5 border border-line px-2 py-0.5 font-mono text-[10px] tracking-[0.14em] text-bone-dim uppercase hover:border-ember/60"
                  >
                    {tag}
                    <span className="text-smoke group-hover:text-ember">×</span>
                  </button>
                ))}
                <input
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ',') {
                      event.preventDefault()
                      addTag(tagInput)
                    } else if (event.key === 'Backspace' && !tagInput && post.tags.length) {
                      patch({ tags: post.tags.slice(0, -1) })
                    }
                  }}
                  onBlur={() => addTag(tagInput)}
                  placeholder={post.tags.length ? '' : 'react, performance…'}
                  className="min-w-32 flex-1 bg-transparent text-sm text-bone placeholder:text-smoke focus:outline-none"
                />
              </div>
            </Field>
          </div>

          <Field
            label="Tradução"
            hint="Slug do post equivalente no outro idioma. Só então gera hreflang."
          >
            <TextInput
              value={post.translationOf ?? ''}
              onChange={(event) => patch({ translationOf: slugify(event.target.value) })}
              placeholder="slug-do-par"
            />
          </Field>

          <div className="flex items-end gap-6">
            <Toggle
              checked={post.featured ?? false}
              onChange={(next) => patch({ featured: next })}
              label="Destaque"
            />
            <span className="pb-1 font-mono text-[10px] tracking-[0.16em] text-smoke uppercase">
              {minutes} min
            </span>
          </div>
        </div>

        {/* ─── Cover ───────────────────────────────────────────── */}
        <div className="mt-6 border-t border-line pt-5">
          <div className="flex items-center justify-between gap-4">
            <span className="font-mono text-[10px] tracking-[0.2em] text-smoke uppercase">
              Capa
            </span>
            <div className="flex items-center gap-3">
              {post.cover && <Badge tone="ember">definida</Badge>}
              <button
                type="button"
                onClick={() => setShowCover((value) => !value)}
                className="font-mono text-[10px] tracking-[0.16em] text-bone-dim uppercase hover:text-ember"
              >
                {showCover ? 'Fechar' : post.cover ? 'Trocar' : 'Enviar'}
              </button>
              {post.cover && (
                <button
                  type="button"
                  onClick={() => patch({ cover: undefined })}
                  className="font-mono text-[10px] tracking-[0.16em] text-smoke uppercase hover:text-ember"
                >
                  Remover
                </button>
              )}
            </div>
          </div>

          {post.cover && (
            <div className="mt-4 grid gap-4 md:grid-cols-[12rem_1fr] md:items-start">
              <img
                src={post.cover.variants[0]?.url ?? post.cover.src}
                alt=""
                className="w-full border border-line"
              />
              <Field label="Texto alternativo" hint="Descreva a imagem para leitores de tela.">
                <TextInput
                  value={post.cover.alt}
                  onChange={(event) =>
                    patch({ cover: { ...post.cover!, alt: event.target.value } })
                  }
                />
              </Field>
            </div>
          )}

          {showCover && (
            <MediaUploader
              className="mt-4"
              folder={post.slug || 'library'}
              label="Imagem de capa"
              onUploaded={(media) => {
                patch({ cover: media })
                setShowCover(false)
              }}
            />
          )}
        </div>
      </Card>

      {/* ─── Write / preview ───────────────────────────────────── */}
      <div
        className={cn(
          'grid gap-6',
          pane === 'split' && 'lg:grid-cols-2',
        )}
      >
        {pane !== 'preview' && (
          <MarkdownEditor
            value={post.body}
            onChange={(body) => patch({ body })}
            onRequestImage={() => setShowBodyUploader(true)}
          />
        )}

        {pane !== 'write' && (
          <div className="min-w-0 border border-line bg-ink px-5 py-6 md:px-8">
            <p className="mb-6 border-b border-line pb-3 font-mono text-[10px] tracking-[0.2em] text-smoke uppercase">
              Preview — mesmo CSS do post publicado
            </p>
            <PostBody markdown={post.body} media={post.media} />
          </div>
        )}
      </div>

      {showBodyUploader && (
        <Card className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-[0.2em] text-smoke uppercase">
              Inserir imagem no corpo
            </span>
            <button
              type="button"
              onClick={() => setShowBodyUploader(false)}
              className="font-mono text-[10px] tracking-[0.16em] text-smoke uppercase hover:text-ember"
            >
              Fechar
            </button>
          </div>
          <MediaUploader
            folder={post.slug || 'library'}
            label="Imagem do corpo"
            onUploaded={(media) => {
              insertMedia(media)
              setShowBodyUploader(false)
            }}
          />
        </Card>
      )}
    </>
  )
}
