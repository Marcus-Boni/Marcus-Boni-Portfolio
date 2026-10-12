import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { usePosts } from '@/admin/PostsContext'
import { useConfirm } from '@/admin/components/overlays'
import { useToast } from '@/admin/components/toast'
import {
  AdminButton,
  Badge,
  Banner,
  Card,
  CopyButton,
  EmptyState,
  IconButton,
  PageHeader,
  SectionHeader,
  Skeleton,
  focusRing,
} from '@/admin/components/ui'
import {
  deleteUpload,
  formatBytes,
  listFolderUploads,
  listMediaFolders,
  type MediaFolder,
  type MediaUpload,
} from '@/admin/lib/storage'
import { isFirebaseConfigured } from '@/lib/firebase'
import { cn } from '@/lib/utils'

/**
 * The media library — the page the admin was missing entirely.
 *
 * Images could be uploaded and never seen again: variants live under
 * `blog/{slug}/{id}/`, and deleting a post left its images in the bucket
 * (deliberately — the delete dialog says so). That orphaned weight was
 * invisible and billed. Here each folder is matched against the post index, so
 * a folder with no post is labelled *órfã* and can be cleared in two clicks.
 */
export function Media() {
  const { posts, loading: postsLoading } = usePosts()
  const confirm = useConfirm()
  const toast = useToast()

  // `null` means "not fetched yet", which is what the skeleton reads from — no
  // synchronous state write inside the effect.
  const [folders, setFolders] = useState<MediaFolder[] | null>(
    isFirebaseConfigured ? null : [],
  )
  const [error, setError] = useState<string | null>(null)
  const [openFolder, setOpenFolder] = useState<string | null>(null)
  const [uploads, setUploads] = useState<Record<string, MediaUpload[] | 'loading'>>({})
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!isFirebaseConfigured) return
    let cancelled = false

    listMediaFolders()
      .then((result) => {
        if (!cancelled) setFolders(result)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setFolders([])
        setError(
          cause instanceof Error ? cause.message : 'Não foi possível listar o Storage.',
        )
      })

    return () => {
      cancelled = true
    }
  }, [nonce])

  /** Re-reads the bucket from scratch, dropping every cached folder listing. */
  const reload = useCallback(() => {
    if (!isFirebaseConfigured) return
    setFolders(null)
    setError(null)
    setUploads({})
    setOpenFolder(null)
    setNonce((value) => value + 1)
  }, [])

  const openInto = async (folder: MediaFolder) => {
    if (openFolder === folder.path) {
      setOpenFolder(null)
      return
    }
    setOpenFolder(folder.path)
    if (uploads[folder.path]) return

    setUploads((current) => ({ ...current, [folder.path]: 'loading' }))
    try {
      const items = await listFolderUploads(folder.path)
      setUploads((current) => ({ ...current, [folder.path]: items }))
    } catch (cause) {
      setUploads((current) => {
        const next = { ...current }
        delete next[folder.path]
        return next
      })
      toast.error(
        cause instanceof Error ? cause.message : 'Falha ao abrir a pasta.',
      )
    }
  }

  const onDelete = async (folder: MediaFolder, upload: MediaUpload) => {
    const yes = await confirm({
      title: 'Excluir este arquivo?',
      description: `${upload.variants.length} variante(s) · ${formatBytes(upload.bytes)}. Posts que ainda usam esta imagem passam a exibi-la quebrada.`,
      confirmLabel: 'Excluir do Storage',
      tone: 'danger',
    })
    if (!yes) return

    try {
      await deleteUpload(upload)
      setUploads((current) => ({
        ...current,
        [folder.path]: (current[folder.path] === 'loading'
          ? []
          : (current[folder.path] as MediaUpload[])
        ).filter((item) => item.path !== upload.path),
      }))
      setFolders(
        (current) =>
          current?.map((item) =>
            item.path === folder.path
              ? { ...item, uploads: Math.max(0, item.uploads - 1) }
              : item,
          ) ?? null,
      )
      toast.success(`Liberado ${formatBytes(upload.bytes)} no Storage.`)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Falha ao excluir.')
    }
  }

  const slugs = useMemo(() => new Set(posts.map((post) => post.slug)), [posts])

  const totals = useMemo(() => {
    const list = folders ?? []
    const orphans = postsLoading
      ? 0
      : list.filter((folder) => folder.name !== 'library' && !slugs.has(folder.name)).length
    return { folders: list.length, orphans }
  }, [folders, slugs, postsLoading])

  return (
    <>
      <PageHeader
        title="Mídia"
        subtitle="Tudo que já subiu para o Storage, agrupado por post. Cada imagem tem três variantes WebP geradas no navegador."
        meta={
          <span className="font-mono text-[10px] tracking-[0.16em] text-smoke uppercase">
            {folders === null ? 'carregando…' : `${totals.folders} pasta(s)`}
            {totals.orphans > 0 ? ` · ${totals.orphans} órfã(s)` : ''}
          </span>
        }
        actions={
          <AdminButton variant="subtle" onClick={reload} disabled={folders === null}>
            ↻ Recarregar
          </AdminButton>
        }
      />

      {!isFirebaseConfigured && (
        <div className="mb-6">
          <Banner tone="warn" title="Storage indisponível">
            O upload de mídia precisa das variáveis{' '}
            <span className="font-mono">VITE_FIREBASE_*</span> e do plano Blaze no
            Firebase.
          </Banner>
        </div>
      )}

      {error && (
        <div className="mb-6">
          <Banner
            tone="error"
            title="Falha ao listar o Storage"
            action={
              <AdminButton variant="ghost" size="sm" onClick={reload}>
                Tentar de novo
              </AdminButton>
            }
          >
            <p className="font-mono text-[10px] break-words text-smoke">{error}</p>
          </Banner>
        </div>
      )}

      {totals.orphans > 0 && (
        <div className="mb-6">
          <Banner tone="warn" title={`${totals.orphans} pasta(s) sem post correspondente`}>
            Provavelmente sobraram de posts excluídos. Abrir e limpar libera espaço
            pago no bucket.
          </Banner>
        </div>
      )}

      {folders === null ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-14" />
          ))}
        </div>
      ) : folders.length === 0 ? (
        <EmptyState
          title="Nenhuma mídia"
          description="As imagens enviadas pelo editor de posts aparecem aqui, agrupadas pelo slug do post."
          action={
            <Link
              to="/admin/blog/new"
              className={cn(
                'inline-flex h-10 items-center justify-center bg-ember px-4 font-mono text-[11px] tracking-[0.18em] text-ink uppercase transition-colors hover:bg-bone',
                focusRing,
              )}
            >
              Escrever um post
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {folders.map((folder) => {
            const orphan =
              !postsLoading && folder.name !== 'library' && !slugs.has(folder.name)
            const content = uploads[folder.path]
            const expanded = openFolder === folder.path

            return (
              <li key={folder.path}>
                <Card
                  className={cn('p-0 md:p-0', orphan && 'border-ember/40')}
                >
                  <button
                    type="button"
                    onClick={() => void openInto(folder)}
                    aria-expanded={expanded}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-3.5 text-left md:px-5',
                      focusRing,
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'font-mono text-xs text-smoke transition-transform duration-200',
                        expanded && 'rotate-90',
                      )}
                    >
                      ▸
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-sm text-bone">
                      {folder.name === 'library' ? 'library (corpo dos posts)' : folder.name}
                    </span>
                    {orphan && <Badge tone="warn">órfã</Badge>}
                    {folder.name !== 'library' && slugs.has(folder.name) && (
                      <Badge tone="muted">post existe</Badge>
                    )}
                    <span className="shrink-0 font-mono text-[10px] text-smoke tabular-nums">
                      {folder.uploads} item(s)
                    </span>
                  </button>

                  {expanded && (
                    <div className="border-t border-line px-4 py-5 md:px-5">
                      {content === 'loading' || content === undefined ? (
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                          {Array.from({ length: 4 }, (_, index) => (
                            <Skeleton key={index} className="aspect-square" />
                          ))}
                        </div>
                      ) : content.length === 0 ? (
                        <p className="text-sm text-smoke">Pasta vazia.</p>
                      ) : (
                        <>
                          <SectionHeader
                            label={`${content.length} arquivo(s) · ${formatBytes(
                              content.reduce((total, item) => total + item.bytes, 0),
                            )}`}
                            action={
                              folder.name !== 'library' && slugs.has(folder.name) ? (
                                <Link
                                  to={`/admin/blog/${folder.name}`}
                                  className={cn(
                                    'font-mono text-[10px] tracking-[0.16em] text-ember uppercase hover:underline',
                                    focusRing,
                                  )}
                                >
                                  Abrir post →
                                </Link>
                              ) : undefined
                            }
                          />
                          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                            {content.map((upload) => (
                              <li
                                key={upload.path}
                                className="flex flex-col border border-line bg-ink"
                              >
                                <div className="relative aspect-square overflow-hidden bg-ink-soft">
                                  {upload.thumbUrl ? (
                                    <img
                                      src={upload.thumbUrl}
                                      alt=""
                                      loading="lazy"
                                      className="size-full object-cover"
                                    />
                                  ) : (
                                    <span className="flex size-full items-center justify-center font-mono text-[10px] text-smoke uppercase">
                                      {upload.variants[0]?.contentType.split('/')[1] ?? 'arquivo'}
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                                  <p className="truncate font-mono text-[10px] text-smoke">
                                    {upload.id}
                                  </p>
                                  <p className="font-mono text-[10px] text-bone-dim tabular-nums">
                                    {formatBytes(upload.bytes)}
                                    {upload.variants.length > 1
                                      ? ` · ${upload.variants
                                          .map((variant) => variant.width)
                                          .filter(Boolean)
                                          .join('/')}px`
                                      : ''}
                                  </p>
                                  <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                                    {upload.thumbUrl && (
                                      <CopyButton
                                        value={upload.thumbUrl}
                                        label="copiar url"
                                      />
                                    )}
                                    <IconButton
                                      size="sm"
                                      label="Excluir do Storage"
                                      variant="danger"
                                      onClick={() => void onDelete(folder, upload)}
                                    >
                                      ✕
                                    </IconButton>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
