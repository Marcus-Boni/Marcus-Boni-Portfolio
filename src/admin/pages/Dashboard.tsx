import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAdminContent } from '@/admin/AdminContentContext'
import { useInbox } from '@/admin/InboxContext'
import { usePosts } from '@/admin/PostsContext'
import { ChartCard, MetricTile } from '@/admin/components/analytics-ui'
import { BarList, TimeSeries } from '@/admin/components/charts'
import { useToast } from '@/admin/components/toast'
import {
  AdminButton,
  Badge,
  Banner,
  ButtonLink,
  Card,
  PageHeader,
  SectionHeader,
  Skeleton,
  StatusDot,
  focusRing,
} from '@/admin/components/ui'
import { useAnalytics } from '@/admin/hooks'
import { exportContentJson } from '@/admin/lib/backup'
import { postIssues, siteIssues, type Issue } from '@/admin/lib/health'
import { isFirebaseConfigured } from '@/lib/firebase'
import { cn } from '@/lib/utils'

/**
 * The at-a-glance view.
 *
 * It answers two questions in order. First "preciso fazer algo?" — unread
 * messages, open drafts, and every content gap that would reach a visitor, each
 * row a link to the field that fixes it. Only then the numbers: the seven-day
 * window and the two breakdowns worth acting on. Anything needing a filter row
 * lives on the Audiência page.
 */
export function Dashboard() {
  const { summary, loading, error } = useAnalytics('7d')
  const { sorted: messages, unread } = useInbox()
  const { posts, counts, loading: postsLoading } = usePosts()
  const { draft, savedAt, loading: contentLoading } = useAdminContent()
  const toast = useToast()
  const [showAllIssues, setShowAllIssues] = useState(false)

  const viewsTrend = useMemo(() => summary.byDay.map((d) => d.views), [summary.byDay])

  const issues = useMemo<Issue[]>(() => {
    if (contentLoading) return []
    return [...siteIssues(draft), ...postIssues(posts)]
  }, [draft, posts, contentLoading])

  const blockers = issues.filter((issue) => issue.severity === 'blocker').length
  const visibleIssues = showAllIssues ? issues : issues.slice(0, 5)

  const lastUpdated = draft.updatedAt ? new Date(draft.updatedAt) : null

  return (
    <>
      <PageHeader
        title="Painel"
        subtitle="Os últimos 7 dias, comparados com os 7 anteriores — e o que está pendente."
        meta={
          <>
            <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-smoke uppercase">
              <StatusDot tone={isFirebaseConfigured ? 'live' : 'off'} pulse={isFirebaseConfigured} />
              {isFirebaseConfigured ? 'dados ao vivo' : 'modo demo'}
            </span>
            <span className="font-mono text-[10px] tracking-[0.16em] text-smoke uppercase">
              conteúdo ·{' '}
              {savedAt
                ? `salvo às ${savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                : lastUpdated
                  ? `atualizado ${lastUpdated.toLocaleDateString('pt-BR')}`
                  : 'nunca publicado'}
            </span>
          </>
        }
        actions={
          <>
            <AdminButton
              variant="subtle"
              onClick={() => {
                const name = exportContentJson(draft)
                toast.success(`Backup gerado — ${name}`)
              }}
              title="Baixa todo o conteúdo editável como JSON"
            >
              ↓ Backup
            </AdminButton>
            <ButtonLink href="/" external variant="subtle">
              ↗ Ver site
            </ButtonLink>
            <Link
              to="/admin/blog/new"
              className={cn(
                'inline-flex h-10 shrink-0 items-center justify-center gap-2 bg-ember px-4 font-mono text-[11px] tracking-[0.18em] text-ink uppercase transition-colors duration-200 hover:bg-bone',
                focusRing,
              )}
            >
              Novo post
            </Link>
          </>
        }
      />

      {!isFirebaseConfigured && (
        <div className="mb-8">
          <Banner tone="warn" title="Modo demonstração">
            Firebase não configurado. As métricas, as mensagens e o blog aparecem
            assim que você conectar um projeto —{' '}
            <Link to="/admin/settings" className="text-ember hover:underline">
              conferir em Ajustes
            </Link>
            .
          </Banner>
        </div>
      )}

      {error && (
        <div className="mb-8">
          <Banner tone="error" title={`Falha ao carregar as métricas · ${error.code}`}>
            <p className="text-xs text-bone-dim">
              O diagnóstico completo, com o link de correção quando houver, está em{' '}
              <Link to="/admin/analytics" className="text-ember hover:underline">
                Audiência
              </Link>
              .
            </p>
          </Banner>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {/* ─── Pendências ─────────────────────────────────────── */}
        <Card className={cn(blockers > 0 && 'border-ember/50')}>
          <SectionHeader
            label="Precisa de atenção"
            hint={
              issues.length === 0 && unread === 0 && counts.draft === 0
                ? undefined
                : 'Cada linha leva direto ao campo que resolve.'
            }
            action={
              issues.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllIssues((value) => !value)}
                  className={cn(
                    'font-mono text-[10px] tracking-[0.16em] text-smoke uppercase transition-colors hover:text-ember',
                    focusRing,
                  )}
                >
                  {showAllIssues ? 'Ver menos' : `Ver todas (${issues.length})`}
                </button>
              )
            }
          />

          <div className="flex flex-col divide-y divide-line">
            {unread > 0 && (
              <AttentionRow
                to="/admin/messages"
                severity="blocker"
                label={`${unread} mensagem(ns) não lida(s) na caixa de entrada`}
              />
            )}
            {counts.draft > 0 && (
              <AttentionRow
                to="/admin/blog"
                severity="info"
                label={`${counts.draft} rascunho(s) de post aguardando publicação`}
              />
            )}
            {visibleIssues.map((issue) => (
              <AttentionRow
                key={issue.id}
                to={issue.to}
                severity={issue.severity}
                label={issue.label}
              />
            ))}

            {issues.length === 0 && unread === 0 && counts.draft === 0 && (
              <p className="py-3 text-sm text-bone-dim">
                Nada pendente. Conteúdo completo, caixa vazia e nenhum rascunho
                parado — o site está exatamente como você deixou.
              </p>
            )}
          </div>
        </Card>

        {/* ─── Números ────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-2 gap-px bg-line lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="bg-ink-soft/60 p-5">
                <Skeleton className="h-2.5 w-24" />
                <Skeleton className="mt-5 h-10 w-20" />
                <Skeleton className="mt-3 h-2 w-28" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-px bg-line lg:grid-cols-4">
            <MetricTile label="Visitas" metric={summary.pageviews} trend={viewsTrend} accent />
            <MetricTile
              label="Visitantes únicos"
              metric={summary.visitors}
              hint={`${summary.newVisitors} novos · ${summary.returningVisitors} recorrentes`}
            />
            <MetricTile
              label="Taxa de rejeição"
              metric={summary.bounceRate}
              unit="percent"
              higherIsBetter={false}
            />
            <MetricTile
              label="Mensagens"
              metric={{ current: messages.length, previous: messages.length }}
              hint={unread > 0 ? `${unread} não lida(s)` : 'tudo lido'}
              accent={unread > 0}
            />
          </div>
        )}

        {!loading && (
          <ChartCard
            title="Visitas por dia — 7 dias"
            hint="A linha cinza é a semana anterior."
            table={{
              columns: ['Dia', 'Visitas', 'Visitantes', 'Semana anterior'],
              rows: summary.byDay.map((d) => [d.date, d.views, d.visitors, d.previousViews]),
            }}
          >
            <TimeSeries data={summary.byDay} />
          </ChartCard>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <ChartCard title="Páginas mais vistas">
            <BarList
              data={summary.byPath}
              max={5}
              formatName={(name) => (name === '/' ? '/ (home)' : name)}
            />
          </ChartCard>
          <ChartCard title="Origem do tráfego">
            <BarList data={summary.byReferrer} max={5} />
          </ChartCard>
          <ChartCard title="Conteúdo publicado">
            <ul className="flex flex-col divide-y divide-line">
              <ContentRow
                to="/admin/blog"
                label="Posts publicados"
                value={counts.published}
                hint={counts.draft > 0 ? `+${counts.draft} rascunho(s)` : undefined}
              />
              <ContentRow to="/admin/projects" label="Projetos" value={draft.projects.length} />
              <ContentRow
                to="/admin/experience"
                label="Experiências"
                value={draft.experience.projects.length}
              />
              <ContentRow to="/admin/profile" label="Tecnologias" value={draft.techStack.length} />
            </ul>
            <p className="mt-4 font-mono text-[10px] tracking-[0.16em] text-smoke uppercase">
              CV baixado {summary.cvDownloads.current}× · contato{' '}
              {summary.contactSubmits.current}×
            </p>
          </ChartCard>
        </div>

        {/* ─── Atalhos de conteúdo ────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <SectionHeader
              label="Últimas mensagens"
              action={
                <Link
                  to="/admin/messages"
                  className={cn(
                    'font-mono text-[10px] tracking-[0.16em] text-ember uppercase hover:underline',
                    focusRing,
                  )}
                >
                  Abrir caixa →
                </Link>
              }
            />
            {messages.length === 0 ? (
              <p className="py-3 text-sm text-smoke">
                Nenhuma mensagem ainda. O formulário de contato do site cai aqui.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {messages.slice(0, 3).map((message) => (
                  <li key={message.id} className="py-3">
                    <Link
                      to="/admin/messages"
                      className={cn('group flex items-baseline gap-2', focusRing)}
                    >
                      <span className="truncate text-sm text-bone transition-colors group-hover:text-ember">
                        {message.name || 'Sem nome'}
                      </span>
                      {!message.read && <Badge tone="ember">novo</Badge>}
                      <span className="ml-auto shrink-0 font-mono text-[10px] text-smoke">
                        {message.createdAt?.toLocaleDateString('pt-BR') ?? '—'}
                      </span>
                    </Link>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-smoke">
                      {message.message}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionHeader
              label="Últimos posts"
              action={
                <Link
                  to="/admin/blog"
                  className={cn(
                    'font-mono text-[10px] tracking-[0.16em] text-ember uppercase hover:underline',
                    focusRing,
                  )}
                >
                  Abrir blog →
                </Link>
              }
            />
            {postsLoading ? (
              <Skeleton className="h-24" />
            ) : posts.length === 0 ? (
              <p className="py-3 text-sm text-smoke">
                Nenhum post. Comece pelo resumo de um estudo recente.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {posts.slice(0, 3).map((post) => (
                  <li key={post.slug} className="flex items-center gap-3 py-3">
                    <Link
                      to={`/admin/blog/${post.slug}`}
                      className={cn(
                        'min-w-0 flex-1 truncate text-sm text-bone-dim transition-colors hover:text-ember',
                        focusRing,
                      )}
                    >
                      {post.title || post.slug}
                    </Link>
                    <Badge tone={post.status === 'published' ? 'ember' : 'muted'}>
                      {post.status === 'published'
                        ? 'publicado'
                        : post.status === 'draft'
                          ? 'rascunho'
                          : 'não listado'}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}

function AttentionRow({
  to,
  label,
  severity,
}: {
  to: string
  label: string
  severity: Issue['severity']
}) {
  return (
    <Link
      to={to}
      className={cn(
        'group flex items-center gap-3 py-3 transition-colors hover:text-bone',
        focusRing,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          severity === 'blocker' ? 'bg-ember' : severity === 'warn' ? 'bg-bone-dim' : 'bg-line',
        )}
      />
      <span className="min-w-0 flex-1 text-sm text-bone-dim group-hover:text-bone">
        {label}
      </span>
      <span
        aria-hidden
        className="shrink-0 font-mono text-[10px] text-smoke transition-colors group-hover:text-ember"
      >
        resolver →
      </span>
    </Link>
  )
}

function ContentRow({
  to,
  label,
  value,
  hint,
}: {
  to: string
  label: string
  value: number
  hint?: string
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <Link
        to={to}
        className={cn('text-sm text-bone-dim transition-colors hover:text-ember', focusRing)}
      >
        {label}
        {hint && <span className="ml-1 text-xs text-smoke">{hint}</span>}
      </Link>
      <span className="font-display text-2xl text-bone">{value}</span>
    </li>
  )
}
