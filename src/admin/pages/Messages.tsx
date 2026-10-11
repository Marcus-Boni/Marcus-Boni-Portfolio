import { useEffect, useMemo, useState } from 'react'

import { useInbox } from '@/admin/InboxContext'
import { useConfirm } from '@/admin/components/overlays'
import { useToast } from '@/admin/components/toast'
import {
  AdminButton,
  Badge,
  ButtonLink,
  Card,
  CopyButton,
  EmptyState,
  PageHeader,
  SearchInput,
  Segmented,
  SkeletonRows,
  focusRing,
} from '@/admin/components/ui'
import { useDebounced } from '@/admin/hooks'
import type { ContactMessage } from '@/lib/messages'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'unread' | 'read'

function formatShort(date: Date | null): string {
  if (!date) return '—'
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  return new Intl.DateTimeFormat('pt-BR',
    sameDay
      ? { hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: 'short' },
  ).format(date)
}

function formatFull(date: Date | null): string {
  if (!date) return 'data desconhecida'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(date)
}

/**
 * The contact inbox, as an inbox.
 *
 * It used to be a stack of cards with the full message body in every one, so
 * finding a name meant scrolling past everything anyone had ever written. Now
 * it is a list on the left and the selected message on the right — searchable,
 * with the reply already addressed and the subject line pre-written, because
 * every reply starts the same way.
 */
export function Messages() {
  const { sorted, unread, messages, loading, markRead, markAllRead, remove, exportCsv } =
    useInbox()
  const confirm = useConfirm()
  const toast = useToast()

  const [filter, setFilter] = useState<Filter>('all')
  const [rawQuery, setQuery] = useState('')
  const query = useDebounced(rawQuery)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return sorted.filter((message) => {
      if (filter === 'unread' && message.read) return false
      if (filter === 'read' && !message.read) return false
      if (!needle) return true
      return (
        message.name.toLowerCase().includes(needle) ||
        message.email.toLowerCase().includes(needle) ||
        message.message.toLowerCase().includes(needle)
      )
    })
  }, [sorted, filter, query])

  /**
   * Looked up in the full list, not the filtered one. Opening a message marks
   * it read, which under the "Não lidas" filter drops it from `visible` — and
   * resolving the selection from `visible` made the message you had just
   * clicked disappear from the reading pane.
   */
  const selected = useMemo(
    () => sorted.find((message) => message.id === selectedId) ?? null,
    [sorted, selectedId],
  )

  // Opening a message marks it read — the same contract as every mail client.
  // "Marcar não lida" is right there when you want to keep it flagged.
  useEffect(() => {
    if (selected && !selected.read) void markRead(selected.id, true)
  }, [selected, markRead])

  const onDelete = async (message: ContactMessage) => {
    const yes = await confirm({
      title: 'Excluir esta mensagem?',
      description: `De ${message.name || 'sem nome'} · ${message.email}. A exclusão é permanente — considere exportar o CSV antes.`,
      confirmLabel: 'Excluir',
      tone: 'danger',
    })
    if (!yes) return
    setBusy(true)
    try {
      await remove(message.id)
      setSelectedId(null)
      toast.success('Mensagem excluída.')
    } catch {
      toast.error('Não foi possível excluir a mensagem.')
    } finally {
      setBusy(false)
    }
  }

  const replyHref = (message: ContactMessage) => {
    const subject = encodeURIComponent(`Re: seu contato pelo marcusboni.com.br`)
    const quoted = message.message
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n')
    const body = encodeURIComponent(
      `Olá${message.name ? `, ${message.name.split(' ')[0]}` : ''}!\n\n\n\n---\n${quoted}\n`,
    )
    return `mailto:${message.email}?subject=${subject}&body=${body}`
  }

  return (
    <>
      <PageHeader
        title="Mensagens"
        subtitle="Tudo que chega pelo formulário de contato do site."
        meta={
          <span className="font-mono text-[10px] tracking-[0.16em] text-smoke uppercase">
            {messages.length} no total · {unread} não lida(s)
          </span>
        }
        actions={
          <>
            <AdminButton
              variant="subtle"
              onClick={exportCsv}
              disabled={messages.length === 0}
              title="Baixa todas as mensagens em CSV (abre no Excel)"
            >
              ↓ CSV
            </AdminButton>
            <AdminButton
              variant="outline"
              disabled={unread === 0}
              onClick={() => {
                void markAllRead().then(() => toast.success('Caixa de entrada zerada.'))
              }}
            >
              Marcar tudo como lido
            </AdminButton>
          </>
        }
      />

      <Card className="mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <SearchInput
            value={rawQuery}
            onChange={setQuery}
            placeholder="Buscar por nome, e-mail ou texto…"
            className="md:max-w-sm md:flex-1"
          />
          <Segmented
            label="Filtrar mensagens"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'Todas', count: messages.length },
              { value: 'unread', label: 'Não lidas', count: unread },
              { value: 'read', label: 'Lidas', count: messages.length - unread },
            ]}
          />
        </div>
      </Card>

      {loading ? (
        <SkeletonRows rows={4} height="h-20" />
      ) : visible.length === 0 && !selected ? (
        <EmptyState
          title={
            messages.length === 0
              ? 'Caixa vazia'
              : query
                ? 'Nada com essa busca'
                : 'Nada aqui'
          }
          description={
            messages.length === 0
              ? 'As mensagens enviadas pelo formulário de contato aparecem aqui.'
              : undefined
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[21rem_1fr] lg:items-start">
          {/* ─── Lista ──────────────────────────────────────────── */}
          <ul
            className={cn(
              'divide-y divide-line border border-line bg-ink-soft/40 lg:max-h-[70svh] lg:overflow-y-auto',
              selected && 'hidden lg:block',
            )}
          >
            {visible.map((message) => (
              <li key={message.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(message.id)}
                  aria-current={message.id === selectedId}
                  className={cn(
                    'flex w-full flex-col gap-1 px-4 py-3.5 text-left transition-colors',
                    focusRing,
                    message.id === selectedId
                      ? 'bg-ember/10'
                      : 'hover:bg-ink-soft',
                  )}
                >
                  <span className="flex items-center gap-2">
                    {!message.read && (
                      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-ember" />
                    )}
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate text-sm',
                        message.read ? 'text-bone-dim' : 'font-medium text-bone',
                      )}
                    >
                      {message.name || 'Sem nome'}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-smoke tabular-nums">
                      {formatShort(message.createdAt)}
                    </span>
                  </span>
                  <span className="truncate font-mono text-[10px] text-smoke">
                    {message.email}
                  </span>
                  <span className="line-clamp-2 text-xs leading-relaxed text-smoke">
                    {message.message}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {/* ─── Detalhe ────────────────────────────────────────── */}
          <div className={cn(!selected && 'hidden lg:block')}>
            {selected ? (
              <Card className="lg:sticky lg:top-6">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className={cn(
                    'mb-4 font-mono text-[10px] tracking-[0.16em] text-smoke uppercase transition-colors hover:text-ember lg:hidden',
                    focusRing,
                  )}
                >
                  ← Voltar à lista
                </button>

                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-display text-3xl leading-none text-bone">
                    {selected.name || 'Sem nome'}
                  </h2>
                  {!selected.read && <Badge tone="ember">novo</Badge>}
                  <Badge tone="muted">{selected.locale.toUpperCase()}</Badge>
                  {selected.country && <Badge tone="muted">{selected.country}</Badge>}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <a
                    href={`mailto:${selected.email}`}
                    className={cn(
                      'font-mono text-xs text-ember hover:underline',
                      focusRing,
                    )}
                  >
                    {selected.email}
                  </a>
                  <CopyButton value={selected.email} label="copiar e-mail" />
                </div>

                <p
                  className="mt-1 font-mono text-[10px] tracking-[0.14em] text-smoke uppercase"
                  title={formatFull(selected.createdAt)}
                >
                  {formatFull(selected.createdAt)}
                  {selected.referrerHost ? ` · via ${selected.referrerHost}` : ''}
                </p>

                <p className="mt-6 border-y border-line py-5 text-sm leading-relaxed whitespace-pre-wrap text-bone-dim">
                  {selected.message}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <ButtonLink href={replyHref(selected)} variant="solid">
                    Responder
                  </ButtonLink>
                  <AdminButton
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      void markRead(selected.id, !selected.read)
                    }}
                  >
                    {selected.read ? 'Marcar não lida' : 'Marcar lida'}
                  </AdminButton>
                  <CopyButton
                    value={selected.message}
                    label="copiar mensagem"
                    className="px-2"
                  />
                  <AdminButton
                    variant="danger"
                    className="ml-auto"
                    loading={busy}
                    onClick={() => void onDelete(selected)}
                  >
                    Excluir
                  </AdminButton>
                </div>
              </Card>
            ) : (
              <div className="hidden h-full min-h-[18rem] items-center justify-center border border-dashed border-line lg:flex">
                <p className="max-w-xs px-6 text-center text-sm text-smoke">
                  Escolha uma mensagem na lista para ler, responder ou excluir.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
