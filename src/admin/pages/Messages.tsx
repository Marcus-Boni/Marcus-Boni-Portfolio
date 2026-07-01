import { useState } from 'react'

import {
  AdminButton,
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
} from '@/admin/components/ui'
import { useMessages } from '@/admin/hooks'
import { deleteMessage, markMessageRead } from '@/lib/messages'

function formatDate(date: Date | null): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function Messages() {
  const { messages, unread, loading } = useMessages()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [busy, setBusy] = useState<string | null>(null)

  const visible =
    filter === 'unread' ? messages.filter((m) => !m.read) : messages

  const onToggleRead = async (id: string, read: boolean) => {
    setBusy(id)
    try {
      await markMessageRead(id, read)
    } finally {
      setBusy(null)
    }
  }

  const onDelete = async (id: string) => {
    if (!window.confirm('Excluir esta mensagem permanentemente?')) return
    setBusy(id)
    try {
      await deleteMessage(id)
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Mensagens"
        subtitle="Tudo que chega pelo formulário de contato do site."
        actions={
          <div className="flex items-center gap-2">
            <AdminButton
              variant={filter === 'all' ? 'solid' : 'outline'}
              onClick={() => setFilter('all')}
            >
              Todas {messages.length}
            </AdminButton>
            <AdminButton
              variant={filter === 'unread' ? 'solid' : 'outline'}
              onClick={() => setFilter('unread')}
            >
              Não lidas {unread}
            </AdminButton>
          </div>
        }
      />

      {loading ? (
        <Spinner label="Carregando mensagens" />
      ) : visible.length === 0 ? (
        <EmptyState
          title={filter === 'unread' ? 'Nada não lido' : 'Caixa vazia'}
          description="As mensagens enviadas pelo formulário de contato aparecem aqui."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {visible.map((m) => (
            <li key={m.id}>
              <Card className={m.read ? 'opacity-80' : 'border-ember/40'}>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-display text-2xl text-bone">
                        {m.name || 'Sem nome'}
                      </span>
                      {!m.read && <Badge tone="ember">novo</Badge>}
                      <Badge tone="muted">{m.locale.toUpperCase()}</Badge>
                      {m.country && <Badge tone="muted">{m.country}</Badge>}
                    </div>
                    <a
                      href={`mailto:${m.email}`}
                      className="mt-1 inline-block font-mono text-xs text-ember hover:underline"
                    >
                      {m.email}
                    </a>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-bone-dim">
                      {m.message}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-start gap-3 md:items-end">
                    <span className="font-mono text-[10px] tracking-[0.18em] text-smoke uppercase">
                      {formatDate(m.createdAt)}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <AdminButton
                        variant="ghost"
                        disabled={busy === m.id}
                        onClick={() => onToggleRead(m.id, !m.read)}
                      >
                        {m.read ? 'Marcar não lida' : 'Marcar lida'}
                      </AdminButton>
                      <AdminButton variant="outline" disabled={busy === m.id}>
                        <a href={`mailto:${m.email}`}>Responder</a>
                      </AdminButton>
                      <AdminButton
                        variant="danger"
                        disabled={busy === m.id}
                        onClick={() => onDelete(m.id)}
                      >
                        Excluir
                      </AdminButton>
                    </div>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
