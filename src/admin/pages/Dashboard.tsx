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
  Segmented,
  Skeleton,
  StatusDot,
  focusRing,
} from '@/admin/components/ui'
import { useAnalytics } from '@/admin/hooks'
import { exportContentJson } from '@/admin/lib/backup'
import { blogSeoSummary, postIssues, siteIssues, type Issue } from '@/admin/lib/health'
import { isOwnTrafficIgnored } from '@/lib/analytics'
import { isFirebaseConfigured } from '@/lib/firebase'
import { cn } from '@/lib/utils'

/**
 * The at-a-glance operational view.
 *
 * Answers two questions in order:
 *  1. "Preciso agir em algo agora?" — unread messages, open drafts, and
 *     content/SEO gaps that reach visitors.
 *  2. "Como o portfólio e o blog foram nos últimos 7 dias?" — four coherent
 *     7-day KPIs (all sharing the same window and owner-exclusion filter), the
 *     daily curve, acquisition channels by session, top pages, and SEO health.
 */
export function Dashboard() {
  const { summary, loading, error, excludeOwner } = useAnalytics('7d')
  const { sorted: messages, unread } = useInbox()
  const { posts, counts, loading: postsLoading } = usePosts()
  const { draft, savedAt, loading: contentLoading } = useAdminContent()
  const toast = useToast()
  const [showAllIssues, setShowAllIssues] = useState(false)
  const [chartMetric, setChartMetric] = useState<'sessions' | 'views'>('sessions')

  const sessionsTrend = useMemo(() => summary.byDay.map((d) => d.sessions), [summary.byDay])
  const visitorsTrend = useMemo(() => summary.byDay.map((d) => d.visitors), [summary.byDay])

  const issues = useMemo<Issue[]>(() => {
    if (contentLoading) return []
    return [...siteIssues(draft), ...postIssues(posts)]
  }, [draft, posts, contentLoading])

  const seoSummary = useMemo(() => blogSeoSummary(posts), [posts])

  const blockers = issues.filter((issue) => issue.severity === 'blocker').length
  const visibleIssues = showAllIssues ? issues : issues.slice(0, 5)
  const lastUpdated = draft.updatedAt ? new Date(draft.updatedAt) : null
  const browserIgnored = isOwnTrafficIgnored()

  return (
    <>
      <PageHeader
        title="Painel"
        subtitle="Os últimos 7 dias comparados com os 7 anteriores — com seus próprios acessos filtrados e o que pede atenção."
        meta={
          <>
            <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-smoke uppercase">
              <StatusDot tone={isFirebaseConfigured ? 'live' : 'off'} pulse={isFirebaseConfigured} />
              {isFirebaseConfigured ? 'dados ao vivo' : 'modo demo'}
            </span>
            <Link
              to="/admin/settings"
              className={cn(
                'flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] uppercase transition-colors hover:text-bone-dim',
                browserIgnored ? 'text-smoke' : 'text-ember',
                focusRing,
              )}
            >
              <StatusDot tone={browserIgnored ? 'live' : 'idle'} />
              {browserIgnored ? 'seus acessos ignorados' : 'rastreando este navegador'}
            </Link>
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
            Firebase não configurado. As métricas, as mensagens e o blog aparecem assim que você
            conectar um projeto —{' '}
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
                : 'Mensagens, rascunhos e lacunas de conteúdo ou SEO — cada linha abre o campo certo.'
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
                Nada pendente. Conteúdo e SEO completos, caixa vazia e nenhum rascunho parado.
              </p>
            )}
          </div>
        </Card>

        {/* ─── Números (7 dias coerentes entre si) ────────────── */}
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
            <MetricTile
              label="Visitantes únicos (7d)"
              metric={summary.visitors}
              trend={visitorsTrend}
              hint={`${summary.newVisitors} novos · ${summary.returningVisitors} recorrentes`}
            />
            <MetricTile
              label="Sessões / visitas (7d)"
              metric={summary.sessions}
              trend={sessionsTrend}
              hint={
                excludeOwner && summary.filteredEvents > 0
                  ? `${summary.filteredEvents} evento(s) próprio(s) oculto(s)`
                  : `média ${summary.viewsPerSession.current} pág./sessão`
              }
              accent
            />
            <MetricTile
              label="Visualizações (7d)"
              metric={summary.pageviews}
              hint={`CV ${summary.cvDownloads.current}× · contato ${summary.contactSubmits.current}×`}
            />
            <MetricTile
              label="Engajamento (7d)"
              metric={summary.engagementRate}
              unit="percent"
              hint={`rejeição ${summary.bounceRate.current}% · dossiê ${summary.agent.queries.current}×`}
            />
          </div>
        )}

        {!loading && (
          <ChartCard
            title={`${chartMetric === 'sessions' ? 'Sessões (visitas)' : 'Visualizações'} por dia — 7 dias`}
            hint="A linha cinza é a semana anterior."
            action={
              <div className="flex items-center gap-3">
                <Segmented
                  size="sm"
                  label="Série"
                  value={chartMetric}
                  onChange={setChartMetric}
                  options={[
                    { value: 'sessions', label: 'Sessões' },
                    { value: 'views', label: 'Visualizações' },
                  ]}
                />
                <Link
                  to="/admin/analytics"
                  className={cn(
                    'font-mono text-[10px] tracking-[0.16em] text-ember uppercase hover:underline',
                    focusRing,
                  )}
                >
                  Abrir Audiência →
                </Link>
              </div>
            }
            table={{
              columns: ['Dia', 'Sessões', 'Visualizações', 'Visitantes', 'Semana anterior'],
              rows: summary.byDay.map((d) => [
                d.date,
                d.sessions,
                d.views,
                d.visitors,
                chartMetric === 'sessions' ? d.previousSessions : d.previousViews,
              ]),
            }}
          >
            <TimeSeries data={summary.byDay} metric={chartMetric} />
          </ChartCard>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <ChartCard
            title="De onde vêm as visitas (7d)"
            hint="Agrupado por canal de entrada da sessão."
            action={
              <Link
                to="/admin/analytics"
                className={cn(
                  'font-mono text-[10px] tracking-[0.16em] text-smoke uppercase hover:text-ember',
                  focusRing,
                )}
              >
                UTM →
              </Link>
            }
          >
            <BarList
              data={summary.byChannel}
              max={5}
              emptyLabel="Sem sessões externas nos últimos 7 dias"
            />
          </ChartCard>

          <ChartCard
            title="Páginas mais vistas (7d)"
            hint="Portfólio, blog e dossiê."
          >
            <BarList
              data={summary.byPath}
              max={5}
              formatName={(name) => (name === '/' ? '/ (home)' : name)}
              emptyLabel="Sem visualizações nos últimos 7 dias"
            />
          </ChartCard>

          <ChartCard title="Conteúdo & saúde de SEO">
            <ul className="flex flex-col divide-y divide-line">
              <ContentRow
                to="/admin/blog"
                label="Artigos publicados"
                value={seoSummary.published}
                hint={
                  seoSummary.bilingual > 0
                    ? `${seoSummary.bilingual} bilíngue(s)`
                    : counts.draft > 0
                      ? `+${counts.draft} rascunho(s)`
                      : undefined
                }
              />
              <ContentRow
                to="/admin/blog"
                label="SEO completo no blog"
                value={seoSummary.withCompleteMeta}
                hint={`de ${seoSummary.published}`}
              />
              <ContentRow to="/admin/projects" label="Projetos" value={draft.projects.length} />
              <ContentRow
                to="/admin/experience"
                label="Experiências"
                value={draft.experience.projects.length}
              />
            </ul>
            <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 border-t border-line pt-3 font-mono text-[10px] tracking-[0.14em] text-smoke uppercase">
              <a href="/sitemap.xml" target="_blank" rel="noreferrer" className="hover:text-ember">
                sitemap.xml ↗
              </a>
              <a href="/rss.xml" target="_blank" rel="noreferrer" className="hover:text-ember">
                rss.xml ↗
              </a>
              <a href="/en/rss.xml" target="_blank" rel="noreferrer" className="hover:text-ember">
                en/rss.xml ↗
              </a>
            </div>
          </ChartCard>
        </div>

        {/* ─── Atalhos de conteúdo ────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <SectionHeader
              label={unread > 0 ? `Últimas mensagens · ${unread} nova(s)` : 'Últimas mensagens'}
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
        {hint && <span className="ml-1.5 font-mono text-[10px] text-smoke">{hint}</span>}
      </Link>
      <span className="font-display text-2xl text-bone">{value}</span>
    </li>
  )
}
