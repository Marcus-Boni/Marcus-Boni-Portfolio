import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { usePosts } from '@/admin/PostsContext'
import { MarkdownEditor } from '@/admin/components/MarkdownEditor'
import { MediaUploader } from '@/admin/components/MediaUploader'
import { SeoPreview } from '@/admin/components/SeoPreview'
import { TagInput } from '@/admin/components/TagInput'
import { useConfirm } from '@/admin/components/overlays'
import { useToast } from '@/admin/components/toast'
import {
  AdminButton,
  Badge,
  Banner,
  ButtonLink,
  Card,
  CopyButton,
  Field,
  IconButton,
  Kbd,
  PageHeader,
  SectionHeader,
  Segmented,
  Select,
  Spinner,
  StatusDot,
  TextArea,
  TextInput,
  Toggle,
  focusRing,
} from '@/admin/components/ui'
import { useHotkey } from '@/admin/hooks'
import { publishChecklist } from '@/admin/lib/health'
import { clearDraft, readDraft, writeDraft } from '@/admin/lib/local-drafts'
import { PostBody } from '@/blog/components/PostBody'
import { autoExcerpt, readingMinutes, slugify } from '@/blog/lib/text'
import {
  emptyPost,
  type MediaRef,
  type Post,
  type PostLocaleMeta,
  type PostStatus,
} from '@/blog/types'
import type { Locale } from '@/i18n/translations'
import { isFirebaseConfigured } from '@/lib/firebase'
import { cn } from '@/lib/utils'
import { BLOG_LOCALES, postPath } from '../../../netlify/lib/blog-locale'

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

const ARTICLE_STARTERS = [
  {
    label: 'Explicação',
    hint: 'Apresente uma ideia com exemplos claros.',
    pt: '## O que é\n\n[Explique o conceito em linguagem simples.]\n\n## Como funciona\n\n[Mostre um exemplo concreto.]\n\n## Quando usar\n\n[Descreva os casos de uso e os limites.]\n',
    en: '## What it is\n\n[Explain the concept in plain language.]\n\n## How it works\n\n[Show a concrete example.]\n\n## When to use it\n\n[Describe use cases and limitations.]\n',
  },
  {
    label: 'Tutorial',
    hint: 'Conduza o leitor do preparo ao resultado.',
    pt: '## O que você vai construir\n\n[Descreva o resultado.]\n\n## Antes de começar\n\n[Liste os pré-requisitos.]\n\n## Passo a passo\n\n[Escreva as etapas.]\n\n## Próximos passos\n\n[Mostre como evoluir.]\n',
    en: '## What you will build\n\n[Describe the outcome.]\n\n## Before you start\n\n[List prerequisites.]\n\n## Step by step\n\n[Write the steps.]\n\n## Next steps\n\n[Show where to go next.]\n',
  },
  {
    label: 'Estudo de caso',
    hint: 'Conte uma decisão e o que ela mudou.',
    pt: '## Contexto\n\n[Apresente a situação.]\n\n## Desafio\n\n[Explique a restrição principal.]\n\n## Decisão\n\n[Conte o que foi feito e por quê.]\n\n## Resultado e aprendizados\n\n[Separe evidência de interpretação.]\n',
    en: '## Context\n\n[Introduce the situation.]\n\n## Challenge\n\n[Explain the main constraint.]\n\n## Decision\n\n[Describe what you did and why.]\n\n## Outcome and lessons\n\n[Separate evidence from interpretation.]\n',
  },
] as const

const EMPTY_LOCALE_META: PostLocaleMeta = {
  title: '',
  subtitle: '',
  excerpt: '',
  tags: [],
  readingMinutes: 0,
}

/** `2026-09-12T14:30` — the shape `datetime-local` expects, in local time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

function getLocaleMeta(post: Post, lang: Locale): PostLocaleMeta {
  const stored = post.locales?.[lang]
  if (stored) return stored
  if (lang === post.lang) {
    return {
      title: post.title,
      subtitle: post.subtitle ?? '',
      excerpt: post.excerpt,
      tags: post.tags,
      readingMinutes: post.readingMinutes,
    }
  }
  return EMPTY_LOCALE_META
}

function getLocaleBody(post: Post, lang: Locale): string {
  if (post.bodies?.[lang] !== undefined) return post.bodies[lang]!
  return lang === post.lang ? post.body : ''
}

function localeFilled(post: Post, lang: Locale): boolean {
  const meta = getLocaleMeta(post, lang)
  const body = getLocaleBody(post, lang)
  return Boolean(meta.title.trim() || body.trim())
}

function localeReady(post: Post, lang: Locale): boolean {
  const meta = getLocaleMeta(post, lang)
  const body = getLocaleBody(post, lang)
  return Boolean(meta.title.trim() && body.trim())
}

/** Keeps top-level legacy mirror fields aligned with the primary populated language. */
function syncPrimaryMirror(post: Post): Post {
  const ptMeta = post.locales?.pt
  const enMeta = post.locales?.en
  const ptBody = post.bodies?.pt ?? ''
  const enBody = post.bodies?.en ?? ''
  const hasPt = Boolean(ptMeta?.title.trim() || ptBody.trim())
  const hasEn = Boolean(enMeta?.title.trim() || enBody.trim())
  const primary: Locale = hasPt ? 'pt' : hasEn ? 'en' : post.lang
  const primaryMeta = post.locales?.[primary] ?? EMPTY_LOCALE_META
  const primaryBody = post.bodies?.[primary] ?? ''

  return {
    ...post,
    lang: primary,
    title: primaryMeta.title,
    subtitle: primaryMeta.subtitle ?? '',
    excerpt: primaryMeta.excerpt,
    tags: primaryMeta.tags,
    readingMinutes: primaryBody.trim() ? readingMinutes(primaryBody) : 0,
    body: primaryBody,
  }
}

export function BlogEditor() {
  const { slug: routeSlug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const { posts, reload } = usePosts()
  const isNew = !routeSlug || routeSlug === 'new'

  const [post, setPost] = useState<Post>(() => emptyPost('pt'))
  const [activeLang, setActiveLang] = useState<Locale>('pt')
  const [loading, setLoading] = useState(!isNew && isFirebaseConfigured)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [autosavedAt, setAutosavedAt] = useState<number | null>(null)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(
    null,
  )
  const [pane, setPane] = useState<Pane>(isNew ? 'write' : 'split')
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [showCover, setShowCover] = useState(false)
  const [showBodyUploader, setShowBodyUploader] = useState(false)
  const [showChecklist, setShowChecklist] = useState(false)
  /**
   * A newer copy found in `localStorage` — offered, never applied silently.
   * For a new post the check runs in the initialiser: a blank editor that then
   * flips to "há um rascunho" is a worse first frame than showing it at once.
   */
  const [recovery, setRecovery] = useState<{ post: Post; savedAt: number } | null>(
    () => {
      if (!isNew) return null
      const local = readDraft('new')
      const hasBody = Boolean(
        local?.post.body.trim() ||
          local?.post.bodies?.pt?.trim() ||
          local?.post.bodies?.en?.trim(),
      )
      return local && hasBody ? { post: local.post, savedAt: local.savedAt } : null
    },
  )
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
          setActiveLang(result.lang)
          originalSlug.current = result.slug

          const local = readDraft(routeSlug)
          if (local && local.savedAt > new Date(result.updatedAt).getTime() + 1000) {
            setRecovery({ post: local.post, savedAt: local.savedAt })
          }
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
      writeDraft(isNew ? 'new' : post.slug, post)
      setAutosavedAt(Date.now())
    }, 800)
    return () => window.clearTimeout(id)
  }, [post, dirty, isNew])

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

  const patchLocale = useCallback(
    (
      lang: Locale,
      changes: Partial<PostLocaleMeta> & { body?: string; slug?: string },
    ) => {
      setPost((current) => {
        const existingMeta = getLocaleMeta(current, lang)
        const existingBody = getLocaleBody(current, lang)
        const nextBody = changes.body !== undefined ? changes.body : existingBody
        const nextMeta: PostLocaleMeta = {
          ...existingMeta,
          ...(changes.title !== undefined ? { title: changes.title } : {}),
          ...(changes.subtitle !== undefined ? { subtitle: changes.subtitle } : {}),
          ...(changes.excerpt !== undefined ? { excerpt: changes.excerpt } : {}),
          ...(changes.tags !== undefined ? { tags: changes.tags } : {}),
          ...(changes.coverAlt !== undefined ? { coverAlt: changes.coverAlt } : {}),
          ...(changes.coverCaption !== undefined ? { coverCaption: changes.coverCaption } : {}),
          readingMinutes: nextBody.trim() ? readingMinutes(nextBody) : 0,
        }
        const updated: Post = {
          ...current,
          ...(changes.slug !== undefined ? { slug: changes.slug } : {}),
          locales: {
            ...(current.locales ?? {}),
            [lang]: nextMeta,
          },
          bodies: {
            ...(current.bodies ?? {}),
            [lang]: nextBody,
          },
        }
        return syncPrimaryMirror(updated)
      })
      setDirty(true)
    },
    [],
  )

  const clearLocaleVersion = async (lang: Locale) => {
    const label = lang === 'en' ? 'em inglês' : 'em português'
    const yes = await confirm({
      title: `Remover versão ${label}?`,
      description:
        'O título, resumo, tags e texto deste idioma serão removidos desta publicação ao salvar.',
      confirmLabel: 'Remover versão',
      tone: 'danger',
    })
    if (!yes) return
    const other: Locale = lang === 'pt' ? 'en' : 'pt'
    setPost((current) => {
      const nextLocales = { ...(current.locales ?? {}) }
      const nextBodies = { ...(current.bodies ?? {}) }
      delete nextLocales[lang]
      delete nextBodies[lang]
      return syncPrimaryMirror({
        ...current,
        locales: nextLocales,
        bodies: nextBodies,
      })
    })
    setActiveLang(other)
    setDirty(true)
  }

  const currentMeta = getLocaleMeta(post, activeLang)
  const currentBody = getLocaleBody(post, activeLang)
  const ptFilled = localeFilled(post, 'pt')
  const enFilled = localeFilled(post, 'en')
  const bilingual = ptFilled && enFilled

  /* Slug follows the primary title until edited by hand — after that it is
     yours, because changing it silently would break a published URL. */
  const onTitleChange = (title: string) => {
    const shouldGenerateSlug =
      !slugTouched && (activeLang === 'pt' || !ptFilled)
    patchLocale(activeLang, shouldGenerateSlug ? { title, slug: slugify(title) } : { title })
  }

  const minutes = useMemo(() => readingMinutes(currentBody), [currentBody])
  const checklist = useMemo(() => publishChecklist(post, activeLang), [post, activeLang])
  const pending = checklist.filter((check) => !check.ok).length

  /** Tags already used across the blog in this language, offered as one-click chips. */
  const tagSuggestions = useMemo(() => {
    const all = new Set<string>()
    for (const item of posts) {
      const localeTags = item.locales?.[activeLang]?.tags ?? (item.lang === activeLang ? item.tags : [])
      localeTags.forEach((tag) => all.add(tag))
    }
    for (const tag of currentMeta.tags) all.delete(tag)
    return [...all].sort()
  }, [posts, activeLang, currentMeta.tags])

  const insertMedia = (media: MediaRef) => {
    const id = crypto.randomUUID().slice(0, 8)
    const nextBody = `${currentBody}${currentBody.endsWith('\n') || !currentBody ? '' : '\n'}\n![${
      media.alt
    }](media:${id})\n`
    patch({ media: { ...(post.media ?? {}), [id]: media } })
    patchLocale(activeLang, { body: nextBody })
  }

  /** Upload path for an image pasted or dropped into the textarea. */
  const uploadInline = async (file: File) => {
    if (!isFirebaseConfigured) {
      toast.error('Configure o Firebase para enviar imagens.')
      return
    }
    toast.info('Enviando imagem…', { duration: 2000 })
    try {
      const { uploadImage } = await import('@/blog/lib/media')
      const media = await uploadImage(file, { folder: post.slug || 'library', alt: '' })
      insertMedia(media)
      toast.success('Imagem enviada. Descreva-a no alt do Markdown.')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Falha no upload.')
    }
  }

  const save = useCallback(async () => {
    if (!isFirebaseConfigured || saving) return

    const synced = syncPrimaryMirror(post)
    const ptMeta = getLocaleMeta(synced, 'pt')
    const enMeta = getLocaleMeta(synced, 'en')
    const ptBody = getLocaleBody(synced, 'pt')
    const enBody = getLocaleBody(synced, 'en')
    const hasPt = Boolean(ptMeta.title.trim() || ptBody.trim())
    const hasEn = Boolean(enMeta.title.trim() || enBody.trim())

    const primaryTitle = ptMeta.title.trim() || enMeta.title.trim()
    const slug = synced.slug || slugify(primaryTitle)
    if (!slug) {
      setMessage({ tone: 'error', text: 'Defina um título ou um slug antes de salvar.' })
      return
    }
    if (!primaryTitle) {
      setMessage({
        tone: 'error',
        text: 'A publicação precisa de título em pelo menos um idioma (Português ou English).',
      })
      return
    }

    // Prevent half-finished translations from going live silently.
    if (synced.status !== 'draft') {
      if (hasPt && (!ptMeta.title.trim() || !ptBody.trim())) {
        setActiveLang('pt')
        setMessage({
          tone: 'error',
          text: 'A versão em português precisa de título e texto antes de publicar (ou remova a aba em português).',
        })
        return
      }
      if (hasEn && (!enMeta.title.trim() || !enBody.trim())) {
        setActiveLang('en')
        setMessage({
          tone: 'error',
          text: 'A versão em inglês precisa de título e texto antes de publicar (ou remova a aba em inglês).',
        })
        return
      }
    }

    setSaving(true)
    setMessage(null)
    try {
      const service = await import('@/blog/service')

      const renaming = originalSlug.current !== null && originalSlug.current !== slug
      if ((renaming || isNew) && (await service.slugExists(slug))) {
        setMessage({ tone: 'error', text: `Já existe um post com o slug "${slug}".` })
        setSaving(false)
        return
      }

      const nextLocales: NonNullable<Post['locales']> = {}
      const nextBodies: NonNullable<Post['bodies']> = {}
      for (const loc of BLOG_LOCALES) {
        const meta = getLocaleMeta(synced, loc)
        const body = getLocaleBody(synced, loc)
        if (!meta.title.trim() && !body.trim() && !meta.subtitle?.trim() && !meta.excerpt.trim() && meta.tags.length === 0) {
          continue
        }
        nextLocales[loc] = {
          ...meta,
          title: meta.title.trim(),
          subtitle: meta.subtitle?.trim() ?? '',
          excerpt: meta.excerpt.trim() || (body.trim() ? autoExcerpt(body) : ''),
          readingMinutes: body.trim() ? readingMinutes(body) : 1,
        }
        nextBodies[loc] = body
      }

      const payload = syncPrimaryMirror({
        ...synced,
        slug,
        locales: nextLocales,
        bodies: nextBodies,
      })

      await service.savePost(payload)
      if (renaming && originalSlug.current) {
        await service.deletePost(originalSlug.current)
      }

      clearDraft(isNew ? 'new' : post.slug)
      clearDraft(slug)
      originalSlug.current = slug
      setPost(payload)
      setDirty(false)
      setAutosavedAt(null)
      reload()
      toast.success(
        payload.status === 'published' ? 'Publicação salva e publicada.' : 'Publicação salva.',
      )
      if (isNew || renaming) navigate(`/admin/blog/${slug}`, { replace: true })
    } catch (cause) {
      setMessage({
        tone: 'error',
        text: cause instanceof Error ? cause.message : 'Falha ao salvar.',
      })
      toast.error('Não foi possível salvar a publicação.')
    } finally {
      setSaving(false)
    }
  }, [post, isNew, navigate, reload, saving, toast])

  useHotkey({ key: 's', mod: true }, () => void save())

  const leave = async () => {
    if (dirty) {
      const yes = await confirm({
        title: 'Sair sem salvar?',
        description:
          'O rascunho fica guardado neste navegador e aparece como recuperável, mas não vai para o site.',
        confirmLabel: 'Sair',
        tone: 'danger',
      })
      if (!yes) return
    }
    navigate('/admin/blog')
  }

  if (loading) return <Spinner label="Carregando post" />

  const statusHint = STATUS_OPTIONS.find((option) => option.value === post.status)?.hint
  const activeCoverAlt =
    activeLang === post.lang
      ? (post.cover?.alt ?? '')
      : (currentMeta.coverAlt ?? post.cover?.alt ?? '')
  const activeCoverCaption =
    activeLang === post.lang
      ? (post.cover?.caption ?? '')
      : (currentMeta.coverCaption ?? post.cover?.caption ?? '')
  const viewOnSiteHref = post.slug ? postPath(post, activeLang) : ''

  return (
    <>
      <PageHeader
        title={isNew ? 'Nova publicação' : 'Editar publicação'}
        documentTitle={currentMeta.title || post.title || (isNew ? 'Nova publicação' : 'Editar publicação')}
        subtitle={
          post.slug ? (
            <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="flex items-center gap-2">
                <span className="font-mono text-xs">/blog/{post.slug}</span>
                <CopyButton
                  value={`${window.location.origin}/blog/${post.slug}`}
                  label={bilingual ? 'copiar PT' : 'copiar link'}
                />
              </span>
              {bilingual && (
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs text-ember">/en/blog/{post.slug}</span>
                  <CopyButton
                    value={`${window.location.origin}/en/blog/${post.slug}`}
                    label="copiar EN"
                  />
                </span>
              )}
            </span>
          ) : (
            'Uma única publicação — preencha Português, English ou ambos na mesma tela.'
          )
        }
        meta={
          <>
            <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-smoke uppercase">
              <StatusDot tone={dirty ? 'idle' : 'live'} pulse={saving} />
              {saving
                ? 'salvando…'
                : dirty
                  ? autosavedAt
                    ? `rascunho local às ${new Date(autosavedAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}`
                    : 'alterações não salvas'
                  : 'salvo'}
            </span>
            <Badge tone={bilingual ? 'ember' : 'neutral'}>
              {bilingual ? 'PT · EN' : ptFilled ? 'PT' : enFilled ? 'EN' : activeLang.toUpperCase()}
            </Badge>
            <span className="font-mono text-[10px] tracking-[0.16em] text-smoke uppercase">
              {minutes} min ({activeLang.toUpperCase()})
            </span>
            {pending > 0 && currentBody.trim() && (
              <Badge tone="warn" title="Itens do checklist de publicação">
                {pending} item(ns) do checklist
              </Badge>
            )}
          </>
        }
        actions={
          <>
            <Segmented
              size="sm"
              label="Modo de edição"
              value={pane}
              onChange={setPane}
              options={[
                { value: 'write', label: 'Escrever' },
                { value: 'split', label: 'Dividido' },
                { value: 'preview', label: 'Preview' },
              ]}
            />
            {post.status !== 'draft' && viewOnSiteHref && (
              <ButtonLink
                href={viewOnSiteHref}
                external
                variant="subtle"
                title="Abrir no site"
              >
                ↗ Ver ({activeLang.toUpperCase()})
              </ButtonLink>
            )}
            <AdminButton variant="ghost" onClick={() => void leave()}>
              Voltar
            </AdminButton>
            <AdminButton
              variant="solid"
              onClick={() => void save()}
              loading={saving}
              disabled={!isFirebaseConfigured}
            >
              {saving ? 'Salvando' : post.status === 'published' ? 'Salvar e publicar' : 'Salvar'}
            </AdminButton>
          </>
        }
      />

      {recovery && (
        <div className="mb-6">
          <Banner
            tone="warn"
            title="Há uma versão mais recente salva neste navegador"
            action={
              <div className="flex shrink-0 gap-2">
                <AdminButton
                  size="sm"
                  variant="solid"
                  onClick={() => {
                    setPost(recovery.post)
                    setDirty(true)
                    setRecovery(null)
                    toast.info('Rascunho local restaurado. Salve para publicar.')
                  }}
                >
                  Restaurar
                </AdminButton>
                <AdminButton
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    clearDraft(isNew ? 'new' : post.slug)
                    setRecovery(null)
                  }}
                >
                  Descartar
                </AdminButton>
              </div>
            }
          >
            Autosave de{' '}
            {new Date(recovery.savedAt).toLocaleString('pt-BR')} — “
            {recovery.post.title || 'sem título'}”.
          </Banner>
        </div>
      )}

      {message && (
        <div className="mb-6">
          <Banner
            tone={message.tone === 'success' ? 'success' : 'error'}
            onDismiss={() => setMessage(null)}
          >
            {message.text}
          </Banner>
        </div>
      )}

      {/* ─── Language tabs + Title + Visibility ────────────────── */}
      <Card className="mb-6 border-bone/20 bg-ink-soft/80">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              size="sm"
              label="Idioma da publicação"
              value={activeLang}
              onChange={setActiveLang}
              options={[
                { value: 'pt', label: ptFilled ? 'Português ✓' : 'Português' },
                { value: 'en', label: enFilled ? 'English ✓' : 'English' },
              ]}
            />
            <span className="text-xs text-smoke">
              {bilingual
                ? 'Publicação bilíngue: o leitor alterna entre PT e EN no mesmo artigo.'
                : activeLang === 'en' && !enFilled
                  ? 'Preencha esta aba para liberar a leitura em inglês na mesma publicação.'
                  : activeLang === 'pt' && !ptFilled
                    ? 'Preencha esta aba para liberar a leitura em português na mesma publicação.'
                    : 'Você pode adicionar o outro idioma na aba ao lado sem criar outro post.'}
            </span>
          </div>

          {bilingual && (
            <button
              type="button"
              onClick={() => void clearLocaleVersion(activeLang)}
              className={cn(
                'font-mono text-[10px] tracking-[0.16em] text-smoke uppercase transition-colors hover:text-ember',
                focusRing,
              )}
            >
              Remover versão {activeLang.toUpperCase()}
            </button>
          )}
        </div>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_13rem] md:items-end">
          <div>
            <Field
              label={activeLang === 'en' ? 'Title (English)' : 'Título (Português)'}
              required={!(activeLang === 'en' ? localeReady(post, 'pt') : localeReady(post, 'en'))}
              hint={
                activeLang === 'en'
                  ? 'Claro, específico e em inglês. Compartilha o mesmo slug e capa da publicação.'
                  : 'Claro, específico e em português. O Google pode ajustar a exibição na busca.'
              }
            >
              <TextInput
                value={currentMeta.title}
                onChange={(event) => onTitleChange(event.target.value)}
                placeholder={
                  activeLang === 'en'
                    ? 'Give the English version a clear title'
                    : 'Dê um título à sua publicação'
                }
              />
            </Field>
          </div>

          <Field label="Visibilidade" hint={statusHint}>
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
        </div>
      </Card>

      {/* ─── Write / preview ───────────────────────────────────── */}
      {!currentBody.trim() && pane !== 'preview' && (
        <div className="mb-4 border-l-2 border-ember bg-ink-soft/50 px-5 py-4">
          <p className="font-display text-xl text-bone">
            {activeLang === 'en' ? 'Start the English version' : 'Comece do seu jeito'}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-bone-dim">
            Escreva livremente ou insira uma estrutura em{' '}
            {activeLang === 'en' ? 'inglês' : 'português'}. Os trechos entre colchetes são
            sugestões para substituir antes de publicar.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {ARTICLE_STARTERS.map((starter) => (
              <button
                key={starter.label}
                type="button"
                onClick={() => patchLocale(activeLang, { body: starter[activeLang] })}
                className={cn(
                  'border border-line px-3 py-3 text-left transition-colors hover:border-ember hover:bg-ink-soft',
                  focusRing,
                )}
              >
                <span className="block font-mono text-[10px] tracking-[0.16em] text-ember uppercase">
                  {starter.label}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-bone-dim">
                  {starter.hint}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className={cn('grid gap-6', pane === 'split' && 'lg:grid-cols-2')}>
        {pane !== 'preview' && (
          <MarkdownEditor
            key={`editor:${activeLang}`}
            value={currentBody}
            onChange={(body) => patchLocale(activeLang, { body })}
            onRequestImage={() => setShowBodyUploader(true)}
            onDropImage={(file) => void uploadInline(file)}
          />
        )}

        {pane !== 'write' && (
          <div className="min-w-0 border border-line bg-ink px-5 py-6 md:px-8">
            <p className="mb-6 border-b border-line pb-3 font-mono text-[10px] tracking-[0.2em] text-smoke uppercase">
              Preview ({activeLang.toUpperCase()}) — mesmo CSS do post publicado
            </p>
            <PostBody markdown={currentBody} media={post.media} lang={activeLang} />
          </div>
        )}
      </div>

      {showBodyUploader && (
        <Card className="mt-6">
          <SectionHeader
            label="Inserir imagem no corpo"
            hint="Entra no Markdown como ![alt](media:id), com srcset e blur-up — a mesma imagem pode ser reutilizada em PT e EN."
            action={
              <button
                type="button"
                onClick={() => setShowBodyUploader(false)}
                className={cn(
                  'font-mono text-[10px] tracking-[0.16em] text-smoke uppercase hover:text-ember',
                  focusRing,
                )}
              >
                Fechar
              </button>
            }
          />
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

      {/* ─── Metadata ──────────────────────────────────────────── */}
      <details className="mt-6 mb-6 border border-line bg-ink-soft/60">
        <summary className={cn('cursor-pointer px-5 py-4 md:px-6', focusRing)}>
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[11px] tracking-[0.16em] text-bone uppercase">
              Detalhes da publicação ({activeLang.toUpperCase()} + compartilhados)
            </span>
            <span className="text-xs text-smoke">Resumo, tags, capa, URL e data</span>
          </span>
        </summary>
        <div className="border-t border-line p-5 md:p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label={`Subtítulo (${activeLang.toUpperCase()})`}
              hint="A linha editorial sob o título neste idioma. Opcional."
            >
              <TextInput
                value={currentMeta.subtitle ?? ''}
                onChange={(event) => patchLocale(activeLang, { subtitle: event.target.value })}
              />
            </Field>

            <Field
              label="Slug (único para PT e EN)"
              hint={
                bilingual
                  ? 'Define /blog/{slug} (PT) e /en/blog/{slug} (EN). Mudar depois de publicar quebra links.'
                  : 'Define /blog/{slug}. Mudar depois de publicar quebra links.'
              }
              error={
                post.status === 'published' && slugTouched && !isNew
                  ? 'Este post já está publicado — renomear cria um endereço quebrado.'
                  : null
              }
            >
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
                label={`Resumo (${activeLang.toUpperCase()})`}
                counter={[currentMeta.excerpt.length, 200]}
                hint="Cards, meta description e RSS neste idioma. Cerca de 150–160 caracteres é uma referência. Vazio usa o corpo."
              >
                <TextArea
                  value={currentMeta.excerpt}
                  maxLength={200}
                  onChange={(event) => patchLocale(activeLang, { excerpt: event.target.value })}
                />
              </Field>
            </div>

            <div className="md:col-span-2">
              <Field
                label={`Tags (${activeLang.toUpperCase()})`}
                hint="Enter ou vírgula para adicionar."
              >
                <TagInput
                  values={currentMeta.tags}
                  suggestions={tagSuggestions}
                  transform={(value) => value.toLowerCase()}
                  onChange={(tags) => patchLocale(activeLang, { tags })}
                  placeholder={activeLang === 'en' ? 'react, performance…' : 'react, arquitetura…'}
                />
              </Field>
            </div>

            <Field
              label="Data de publicação (compartilhada)"
              hint={
                post.publishedAt
                  ? 'Ordena o índice e o RSS. Ajuste para antedatar um estudo antigo.'
                  : 'Preenchida automaticamente no primeiro publish.'
              }
            >
              <TextInput
                type="datetime-local"
                value={toLocalInput(post.publishedAt)}
                onChange={(event) =>
                  patch({
                    publishedAt: event.target.value
                      ? new Date(event.target.value).toISOString()
                      : null,
                  })
                }
              />
            </Field>

            <div className="flex items-end gap-6">
              <Toggle
                checked={post.featured ?? false}
                onChange={(next) => patch({ featured: next })}
                label="Destaque"
                hint="Fixa a publicação no topo do índice do diário."
              />
            </div>
          </div>

          {/* ─── Cover ───────────────────────────────────────────── */}
          <div className="mt-6 border-t border-line pt-5">
            <SectionHeader
              label="Capa (compartilhada)"
              hint="Vira a imagem do card social nos dois idiomas. Você pode adaptar o texto alternativo na aba ativa."
              action={
                <div className="flex items-center gap-3">
                  {post.cover && (
                    <Badge tone={activeCoverAlt.trim() ? 'ember' : 'warn'}>
                      {activeCoverAlt.trim() ? 'definida' : 'sem alt'}
                    </Badge>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowCover((value) => !value)}
                    className={cn(
                      'font-mono text-[10px] tracking-[0.16em] text-bone-dim uppercase hover:text-ember',
                      focusRing,
                    )}
                  >
                    {showCover ? 'Fechar' : post.cover ? 'Trocar' : 'Enviar'}
                  </button>
                  {post.cover && (
                    <IconButton
                      size="sm"
                      label="Remover capa"
                      variant="danger"
                      onClick={() => patch({ cover: undefined })}
                    >
                      ✕
                    </IconButton>
                  )}
                </div>
              }
            />

            {post.cover && (
              <div className="grid gap-4 md:grid-cols-[12rem_1fr] md:items-start">
                <img
                  src={post.cover.variants[0]?.url ?? post.cover.src}
                  alt=""
                  className="w-full border border-line"
                />
                <div>
                  <Field
                    label={`Texto alternativo (${activeLang.toUpperCase()})`}
                    required
                    error={activeCoverAlt.trim() ? null : 'Descreva a imagem'}
                    hint="Leitores de tela e o card social usam este texto."
                  >
                    <TextInput
                      value={activeCoverAlt}
                      invalid={!activeCoverAlt.trim()}
                      onChange={(event) => {
                        const value = event.target.value
                        if (activeLang === post.lang) {
                          patch({ cover: { ...post.cover!, alt: value } })
                        } else {
                          patchLocale(activeLang, { coverAlt: value })
                        }
                      }}
                    />
                  </Field>
                  <Field
                    label={`Legenda (${activeLang.toUpperCase()})`}
                    className="mt-4"
                    hint="Opcional, exibida sob a imagem."
                  >
                    <TextInput
                      value={activeCoverCaption}
                      onChange={(event) => {
                        const value = event.target.value
                        if (activeLang === post.lang) {
                          patch({ cover: { ...post.cover!, caption: value } })
                        } else {
                          patchLocale(activeLang, { coverCaption: value })
                        }
                      }}
                    />
                  </Field>
                  <p className="mt-3 font-mono text-[10px] text-smoke">
                    {post.cover.width}×{post.cover.height}px ·{' '}
                    {post.cover.variants.map((variant) => variant.width).join('/')}px em WebP
                  </p>
                </div>
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
          <SeoPreview post={post} lang={activeLang} />
        </div>
      </details>

      {/* ─── Checklist ─────────────────────────────────────────── */}
      <Card className="mb-6">
        <SectionHeader
          label={
            pending === 0
              ? `Checklist (${activeLang.toUpperCase()}) sem pontos pendentes`
              : `Checklist (${activeLang.toUpperCase()}) — ${pending} ponto(s) para revisar`
          }
          hint="Recomendações editoriais; não bloqueiam salvar e não garantem posição na busca. Revise clareza, fontes e utilidade antes de publicar."
          action={
            <button
              type="button"
              onClick={() => setShowChecklist((value) => !value)}
              className={cn(
                'font-mono text-[10px] tracking-[0.16em] text-smoke uppercase hover:text-ember',
                focusRing,
              )}
            >
              {showChecklist ? 'Recolher' : 'Ver'}
            </button>
          }
        />
        {showChecklist && (
          <ul className="flex flex-col divide-y divide-line">
            {checklist.map((check) => (
              <li key={check.label} className="flex items-start gap-3 py-2.5">
                <span
                  aria-hidden
                  className={cn(
                    'mt-0.5 font-mono text-xs',
                    check.ok ? 'text-ember' : 'text-smoke',
                  )}
                >
                  {check.ok ? '✓' : '○'}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn('block text-sm', check.ok ? 'text-bone-dim' : 'text-bone')}
                  >
                    {check.label}
                  </span>
                  {check.hint && (
                    <span className="mt-0.5 block text-xs text-smoke">{check.hint}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ─── Sticky save ───────────────────────────────────────── */}
      <div className="sticky bottom-4 z-20 mt-8">
        <div
          className={cn(
            'flex flex-col gap-3 border bg-ink-soft/95 px-5 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between',
            dirty ? 'border-ember/50' : 'border-line',
          )}
        >
          <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-smoke uppercase">
            <StatusDot tone={saving ? 'live' : dirty ? 'idle' : 'live'} pulse={saving} />
            {!isFirebaseConfigured
              ? 'Modo demo — nada é gravado'
              : saving
                ? 'Salvando…'
                : dirty
                  ? 'Alterações não salvas'
                  : 'Tudo salvo'}
          </span>
          <div className="flex items-center gap-2">
            <span className="mr-1 hidden items-center gap-1 font-mono text-[9px] tracking-[0.16em] text-smoke/70 uppercase lg:flex">
              <Kbd>Ctrl</Kbd>
              <Kbd>S</Kbd>
            </span>
            <AdminButton variant="ghost" onClick={() => void leave()}>
              Voltar
            </AdminButton>
            <AdminButton
              variant="solid"
              onClick={() => void save()}
              loading={saving}
              disabled={!isFirebaseConfigured}
            >
              {saving ? 'Salvando' : post.status === 'published' ? 'Salvar e publicar' : 'Salvar'}
            </AdminButton>
          </div>
        </div>
      </div>
    </>
  )
}
