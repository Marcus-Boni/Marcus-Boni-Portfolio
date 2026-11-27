import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { ChartCard, MetricTile, RangeFilter } from '@/admin/components/analytics-ui'
import { BarList, HeatMap, TimeSeries } from '@/admin/components/charts'
import { useToast } from '@/admin/components/toast'
import {
  AdminButton,
  Badge,
  Banner,
  Card,
  CopyButton,
  EmptyState,
  Field,
  PageHeader,
  SectionHeader,
  Segmented,
  Select,
  Spinner,
  StatusDot,
  TextInput,
  focusRing,
} from '@/admin/components/ui'
import { useAnalytics, useStoredState } from '@/admin/hooks'
import {
  RANGES,
  SITE_TZ,
  type NamedCount,
  type SessionSummary,
} from '@/admin/services/analytics'
import {
  getTrackingBlockReason,
  isOwnTrafficIgnored,
  setIgnoreOwnTraffic,
} from '@/lib/analytics'
import { isFirebaseConfigured } from '@/lib/firebase'
import { cn } from '@/lib/utils'

type AnalyticsTab =
  | 'overview'
  | 'acquisition'
  | 'content'
  | 'dossier'
  | 'audience'
  | 'sessions'

type EventFilter = 'all' | 'pageview' | 'blog' | 'conversion' | 'dossier'

const TYPE_LABEL: Record<string, string> = {
  pageview: 'Página',
  section_view: 'Seção',
  outbound_click: 'Link externo',
  cv_download: 'Download CV',
  contact_submit: 'Contato',
  language_change: 'Idioma',
  blog_index_view: 'Blog — índice',
  post_view: 'Post aberto',
  post_read: 'Post lido (75%)',
  post_share: 'Post compartilhado',
  agent_open: 'Dossiê aberto',
  agent_query: 'Consulta Dossiê',
  agent_fit: 'Análise /fit',
  agent_handoff: 'Handoff Dossiê',
  agent_share: 'Briefing compartilhado',
}

const LENS_LABEL: Record<string, string> = {
  recruiter: 'Recrutador',
  engineer: 'Técnico / CTO',
  client: 'Cliente',
}

const INTENT_LABEL: Record<string, string> = {
  fit: 'Análise de vaga (/fit)',
  stack: 'Stack técnico',
  projects: 'Projetos públicos',
  experience: 'Entregas (Optsolv)',
  ai_work: 'IA aplicada & MCP',
  posts: 'Diário / blog',
  profile: 'Perfil geral',
  availability: 'Disponibilidade',
  contact: 'Contato / handoff',
  cv: 'Currículo PDF',
  api: 'Arquitetura & API',
  out_of_scope: 'Fora do escopo',
  general: 'Consulta geral',
}

const PROVIDER_LABEL: Record<string, string> = {
  groq: 'Groq (Free)',
  nvidia: 'NVIDIA NIM (Free)',
  openrouter: 'OpenRouter (Free)',
  gemini: 'Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  local: 'Local determinístico',
  'edge-llm': 'Edge LLM',
}

const UTM_PRESETS = [
  { label: 'LinkedIn (perfil)', source: 'linkedin', medium: 'profile', campaign: 'portfolio' },
  { label: 'LinkedIn (post)', source: 'linkedin', medium: 'social', campaign: 'post' },
  { label: 'Currículo PDF', source: 'cv', medium: 'pdf', campaign: 'curriculo' },
  { label: 'GitHub README', source: 'github', medium: 'readme', campaign: 'profile' },
  { label: 'WhatsApp', source: 'whatsapp', medium: 'dm', campaign: 'compartilhamento' },
  { label: 'Instagram Bio', source: 'instagram', medium: 'bio', campaign: 'perfil' },
  { label: 'Assinatura E-mail', source: 'email', medium: 'email', campaign: 'assinatura' },
] as const

const DESTINATION_OPTIONS = [
  { value: '/', label: '/ (Página inicial)' },
  { value: '/blog', label: '/blog (Diário PT)' },
  { value: '/en/blog', label: '/en/blog (Journal EN)' },
  { value: '/ask', label: '/ask (Dossiê IA)' },
  { value: '/kit/front-end', label: '/kit/front-end (Kit)' },
] as const

function timeAgo(date: Date | null): string {
  if (!date) return '—'
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h`
  return `${Math.floor(hours / 24)} d`
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '< 1s'
  if (seconds < 60) return `${seconds}s`
  const min = Math.floor(seconds / 60)
  const rem = seconds % 60
  return `${min}m ${String(rem).padStart(2, '0')}s`
}

function prettyPath(path: string): string {
  return path === '/' ? '/ (home)' : path
}

function errorHint(code: string): string {
  switch (code) {
    case 'failed-precondition':
      return 'A consulta precisa de um índice que ainda não existe. A mensagem abaixo traz o link que cria o índice com um clique no console do Firebase.'
    case 'permission-denied':
      return 'As regras do Firestore recusaram a leitura da coleção `analytics`. Confirme que `firestore.rules` foi publicado e que você está autenticado.'
    case 'unavailable':
      return 'O Firestore está inacessível. Normalmente é conexão — tente novamente em instantes.'
    case 'resource-exhausted':
      return 'A cota do projeto foi excedida. Verifique o uso no console do Firebase.'
    case 'invalid-argument':
      return 'A consulta é inválida — normalmente um limite acima do máximo de 10.000 do Firestore.'
    default:
      return 'Erro inesperado ao abrir a assinatura de eventos.'
  }
}

function toTable(data: NamedCount[], nameColumn: string, countColumn = 'Sessões') {
  return {
    columns: [nameColumn, countColumn, 'Anterior'],
    rows: data.map((d) => [d.name, d.count, d.previous ?? 0]),
  }
}

function matchesEventFilter(type: string, filter: EventFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'pageview') return type === 'pageview'
  if (filter === 'blog') {
    return ['blog_index_view', 'post_view', 'post_read', 'post_share'].includes(type)
  }
  if (filter === 'conversion') {
    return ['cv_download', 'contact_submit', 'outbound_click', 'agent_handoff'].includes(type)
  }
  if (filter === 'dossier') return type.startsWith('agent_')
  return true
}

export function Analytics() {
  const {
    summary,
    events,
    loading,
    error,
    range,
    setRange,
    excludeOwner,
    setExcludeOwner,
    excludedVisitorIds,
    excludeVisitor,
    unexcludeVisitor,
    exportCsv,
  } = useAnalytics('30d')
  const toast = useToast()

  const [tab, setTab] = useStoredState<AnalyticsTab>('mb-admin-analytics-tab', 'overview')
  const [chartMetric, setChartMetric] = useState<'sessions' | 'views'>('sessions')
  const [logMode, setLogMode] = useState<'sessions' | 'events'>('sessions')
  const [eventFilter, setEventFilter] = useState<EventFilter>('all')
  const [showAllRows, setShowAllRows] = useState(false)
  const [browserIgnored, setBrowserIgnored] = useState(() => isOwnTrafficIgnored())

  const blockReason = getTrackingBlockReason()

  const sessionsTrend = useMemo(
    () => summary.byDay.map((d) => d.sessions),
    [summary.byDay],
  )
  const visitorsTrend = useMemo(
    () => summary.byDay.map((d) => d.visitors),
    [summary.byDay],
  )

  const filteredRawEvents = useMemo(
    () => events.filter((event) => matchesEventFilter(event.type, eventFilter)),
    [events, eventFilter],
  )

  const visibleEvents = showAllRows ? filteredRawEvents.slice(0, 200) : filteredRawEvents.slice(0, 30)
  const visibleSessions = showAllRows
    ? summary.recentSessions
    : summary.recentSessions.slice(0, 20)

  const rangeLabel = RANGES[range].label
  const totalConversions =
    summary.cvDownloads.current +
    summary.contactSubmits.current +
    summary.agent.handoffs.current

  const toggleBrowserExclusion = () => {
    const next = !browserIgnored
    setIgnoreOwnTraffic(next)
    setBrowserIgnored(next)
    toast.success(
      next
        ? 'Este navegador foi excluído das métricas.'
        : 'Rastreamento reativado neste navegador (modo teste).',
    )
  }

  const onMarkVisitorAsOwner = async (session: SessionSummary) => {
    if (!session.visitorId) return
    try {
      if (session.isOwner) {
        await unexcludeVisitor(session.visitorId)
        toast.info('Dispositivo removido da lista de exclusão.')
      } else {
        await excludeVisitor(session.visitorId)
        toast.success('Dispositivo marcado como seu — acessos ocultados do histórico.')
      }
    } catch {
      toast.error('Não foi possível atualizar a lista de dispositivos excluídos.')
    }
  }

  return (
    <>
      <PageHeader
        title="Audiência"
        subtitle={`Visitas reais ao portfólio e ao blog agrupadas por sessão, com origens normalizadas e filtro dos seus próprios acessos (${SITE_TZ}).`}
        meta={
          <>
            <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-smoke uppercase">
              <StatusDot tone={browserIgnored || blockReason === 'local' ? 'live' : 'idle'} />
              {browserIgnored
                ? 'este navegador ignorado'
                : blockReason === 'local'
                  ? 'ambiente local ignorado'
                  : 'rastreando este navegador'}
            </span>
            <span className="font-mono text-[10px] tracking-[0.16em] text-smoke uppercase">
              {excludedVisitorIds.length} dispositivo(s) próprio(s) na lista de exclusão
            </span>
          </>
        }
        actions={
          <AdminButton variant="subtle" size="sm" onClick={toggleBrowserExclusion}>
            {browserIgnored ? '✓ Meus acessos pausados aqui' : 'Ignorar este navegador'}
          </AdminButton>
        }
      />

      <RangeFilter
        value={range}
        onChange={setRange}
        onExport={exportCsv}
        live={isFirebaseConfigured && !error}
        excludeOwner={excludeOwner}
        onToggleExcludeOwner={setExcludeOwner}
        filteredCount={summary.filteredEvents}
      />

      {!isFirebaseConfigured && (
        <div className="mb-6">
          <Banner tone="warn">
            Modo demonstração — Firebase não configurado, então não há eventos para exibir.
          </Banner>
        </div>
      )}

      {error && (
        <div className="mb-6">
          <Banner tone="error">
            <p className="mb-2 font-mono text-[11px] tracking-[0.16em] uppercase">
              Falha ao carregar os eventos · {error.code}
            </p>
            <p className="mb-2 text-xs leading-relaxed text-bone-dim">
              {errorHint(error.code)}
            </p>
            <p className="font-mono text-[10px] leading-relaxed break-words text-smoke">
              {error.message}
            </p>
          </Banner>
        </div>
      )}

      {summary.truncated && (
        <div className="mb-6">
          <Banner tone="warn">
            O período selecionado excedeu o limite de leitura de 10.000 eventos. Os números abaixo
            são um piso — use um período menor para totais exatos.
          </Banner>
        </div>
      )}

      {excludeOwner && summary.filteredEvents > 0 && !loading && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-line bg-ink-soft/40 px-4 py-2.5 text-xs text-bone-dim">
          <span>
            Higiene ativa:{' '}
            <strong className="font-mono text-bone">{summary.filteredEvents}</strong> evento(s)
            {summary.filteredSessions > 0 && (
              <> ({summary.filteredSessions} sessão(ões))</>
            )}{' '}
            dos seus dispositivos ou testes locais foram removidos desta janela.
          </span>
          <Link
            to="/admin/settings"
            className={cn(
              'font-mono text-[10px] tracking-[0.16em] text-ember uppercase hover:underline',
              focusRing,
            )}
          >
            Gerenciar dispositivos →
          </Link>
        </div>
      )}

      {loading ? (
        <Spinner label="Carregando audiência" />
      ) : !summary.hasData ? (
        <div className="flex flex-col gap-6">
          <EmptyState
            title={
              excludeOwner && summary.filteredEvents > 0
                ? 'Apenas acessos próprios neste período'
                : 'Nenhuma visita externa no período'
            }
            description={
              excludeOwner && summary.filteredEvents > 0
                ? `${summary.filteredEvents} evento(s) seus foram filtrados para manter as métricas limpas. Desative “Ocultar meus acessos” acima se quiser inspecioná-los.`
                : 'Os dados aparecem aqui assim que visitantes externos acessarem o portfólio ou o blog.'
            }
          />
          <UtmBuilderCard />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* ─── Top KPI strip (always visible, coherent terminology) ─── */}
          <div className="grid grid-cols-2 gap-px bg-line lg:grid-cols-4">
            <MetricTile
              label="Visitantes únicos"
              metric={summary.visitors}
              trend={visitorsTrend}
              hint={`${summary.newVisitors} novos · ${summary.returningVisitors} recorrentes`}
            />
            <MetricTile
              label="Sessões (visitas)"
              metric={summary.sessions}
              trend={sessionsTrend}
              hint={`média ${summary.viewsPerSession.current} pág./sessão`}
              accent
            />
            <MetricTile
              label="Visualizações de página"
              metric={summary.pageviews}
              hint={`duração média ${formatDuration(summary.avgSessionSeconds.current)}`}
            />
            <MetricTile
              label="Taxa de engajamento"
              metric={summary.engagementRate}
              unit="percent"
              hint={`rejeição ${summary.bounceRate.current}% · ${totalConversions} conversão(ões)`}
            />
          </div>

          {/* ─── Organized section navigation ────────────────────────── */}
          <div className="border-b border-line pb-4">
            <Segmented
              label="Seções de audiência"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'overview', label: 'Visão geral' },
                { value: 'acquisition', label: 'Origens & UTM' },
                { value: 'content', label: 'Blog & Conteúdo' },
                { value: 'dossier', label: 'Dossiê IA', count: summary.agent.queries.current || undefined },
                { value: 'audience', label: 'Público & Ritmo' },
                { value: 'sessions', label: 'Sessões & Log', count: summary.recentSessions.length || undefined },
              ]}
            />
          </div>

          {/* ─── TAB 1: VISÃO GERAL ─────────────────────────────────── */}
          {tab === 'overview' && (
            <div className="flex flex-col gap-6">
              <ChartCard
                title={`${chartMetric === 'sessions' ? 'Sessões (visitas)' : 'Visualizações'} por dia — ${rangeLabel}`}
                hint="A linha cinza é o período imediatamente anterior, de mesma duração."
                action={
                  <Segmented
                    size="sm"
                    label="Métrica do gráfico"
                    value={chartMetric}
                    onChange={setChartMetric}
                    options={[
                      { value: 'sessions', label: 'Sessões' },
                      { value: 'views', label: 'Visualizações' },
                    ]}
                  />
                }
                table={{
                  columns: ['Dia', 'Sessões', 'Visualizações', 'Visitantes', 'Período anterior'],
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

              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard
                  title="Canais de aquisição"
                  hint="Contagem por sessão — cada visita é atribuída uma única vez ao canal de entrada."
                  table={toTable(summary.byChannel, 'Canal', 'Sessões')}
                >
                  <BarList data={summary.byChannel} emptyLabel="Sem dados de canal" />
                </ChartCard>

                <ChartCard
                  title="Principais fontes"
                  hint="Origens normalizadas (Google, LinkedIn, GitHub, ChatGPT…) sem ruído de navegação interna."
                  table={toTable(summary.bySource, 'Fonte', 'Sessões')}
                >
                  <BarList data={summary.bySource} max={6} emptyLabel="Sem fontes registradas" />
                </ChartCard>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard
                  title="Páginas mais vistas"
                  hint="Total de visualizações em cada rota do portfólio e do blog."
                  table={toTable(summary.byPath, 'Página', 'Visualizações')}
                >
                  <BarList data={summary.byPath} max={6} formatName={prettyPath} />
                </ChartCard>

                <Card>
                  <SectionHeader
                    label="Conversões e ações relevantes"
                    hint="Sinais reais de interesse de recrutadores, clientes e leitores."
                  />
                  <div className="grid grid-cols-2 gap-px bg-line">
                    <MetricTile label="Downloads CV" metric={summary.cvDownloads} />
                    <MetricTile label="Mensagens" metric={summary.contactSubmits} accent />
                    <MetricTile label="Consultas Dossiê" metric={summary.agent.queries} />
                    <MetricTile label="Compart. blog" metric={summary.postShares} />
                  </div>
                </Card>
              </div>

              <ChartCard
                title="Sessões recentes"
                hint="Cada linha resume uma visita real com sua origem, páginas percorridas e ações."
                action={
                  <button
                    type="button"
                    onClick={() => setTab('sessions')}
                    className={cn(
                      'font-mono text-[10px] tracking-[0.16em] text-ember uppercase hover:underline',
                      focusRing,
                    )}
                  >
                    Ver todas ({summary.recentSessions.length}) →
                  </button>
                }
              >
                <SessionTable
                  sessions={summary.recentSessions.slice(0, 6)}
                  onToggleOwner={onMarkVisitorAsOwner}
                />
              </ChartCard>
            </div>
          )}

          {/* ─── TAB 2: ORIGENS & UTM ───────────────────────────────── */}
          {tab === 'acquisition' && (
            <div className="flex flex-col gap-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard
                  title="Canais de aquisição (por sessão)"
                  hint="Agrupa busca orgânica, redes sociais, IA, comunidades de código, campanhas UTM e acesso direto."
                  table={toTable(summary.byChannel, 'Canal', 'Sessões')}
                >
                  <BarList data={summary.byChannel} emptyLabel="Sem sessões no período" />
                </ChartCard>

                <ChartCard
                  title="Fontes detalhadas (por sessão)"
                  hint="Links de apps (lnkd.in, l.instagram.com, t.co, android-app://) são unificados sob a marca correta."
                  table={toTable(summary.bySource, 'Fonte', 'Sessões')}
                >
                  <BarList data={summary.bySource} emptyLabel="Sem fontes registradas" />
                </ChartCard>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard
                  title="Páginas de entrada (Landing pages)"
                  hint="Qual endereço trouxe o visitante para dentro do site pela primeira vez na sessão."
                  table={toTable(summary.byLandingPath, 'Entrada', 'Sessões')}
                >
                  <BarList
                    data={summary.byLandingPath}
                    formatName={prettyPath}
                    emptyLabel="Sem páginas de entrada"
                  />
                </ChartCard>

                <ChartCard
                  title="Campanhas & links marcados (UTM)"
                  hint="Sessões vindas de links com ?utm_source= ou ?ref=. Resolve o tráfego de WhatsApp, PDF e apps que ocultam referrer."
                  table={toTable(summary.byCampaign, 'Campanha', 'Sessões')}
                >
                  <BarList
                    data={summary.byCampaign}
                    emptyLabel="Nenhuma visita com UTM ainda — gere um link abaixo para LinkedIn, currículo ou WhatsApp."
                  />
                </ChartCard>
              </div>

              <UtmBuilderCard />
            </div>
          )}

          {/* ─── TAB 3: BLOG & CONTEÚDO ─────────────────────────────── */}
          {tab === 'content' && (
            <div className="flex flex-col gap-6">
              <ChartCard
                title="Desempenho dos artigos do blog"
                hint="“Leituras” dispara a 75% de rolagem — separa quem só abriu de quem realmente leu."
                table={{
                  columns: ['Post', 'Aberturas', 'PT', 'EN', 'Leituras (75%)', 'Taxa', 'Compart.'],
                  rows: summary.posts.map((p) => [
                    p.slug,
                    p.views,
                    p.viewsPt,
                    p.viewsEn,
                    p.reads,
                    `${p.readRate}%`,
                    p.shares,
                  ]),
                }}
              >
                {summary.posts.length === 0 ? (
                  <p className="py-8 text-center text-sm text-smoke">
                    Nenhum artigo visitado neste período.
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y divide-line">
                    {summary.posts.slice(0, 12).map((post) => (
                      <li
                        key={post.slug}
                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <a
                            href={`/blog/${post.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate text-sm text-bone-dim transition-colors hover:text-ember"
                          >
                            /blog/{post.slug}
                          </a>
                          {(post.viewsPt > 0 || post.viewsEn > 0) && (
                            <span className="font-mono text-[10px] text-smoke">
                              PT: {post.viewsPt} · EN: {post.viewsEn}
                              {post.shares > 0 && ` · ${post.shares} compart.`}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 font-mono text-[11px] text-smoke tabular-nums">
                          <span title="Aberturas">{post.views} ab.</span>
                          <span title="Leituras (75% de rolagem)">{post.reads} lid.</span>
                          <span
                            className={cn(
                              'w-12 text-right',
                              post.readRate >= 50 ? 'text-ember' : 'text-smoke',
                            )}
                            title="Taxa de leitura"
                          >
                            {post.readRate}%
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </ChartCard>

              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard
                  title="Páginas mais vistas"
                  table={toTable(summary.byPath, 'Página', 'Visualizações')}
                >
                  <BarList data={summary.byPath} formatName={prettyPath} />
                </ChartCard>

                <ChartCard
                  title="Seções da home mais alcançadas"
                  hint="Quanto da página inicial cada visitante realmente rola."
                  table={toTable(summary.bySection, 'Seção', 'Visualizações')}
                >
                  <BarList data={summary.bySection} emptyLabel="Sem dados de rolagem ainda" />
                </ChartCard>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard
                  title="Links externos mais clicados"
                  table={toTable(summary.topOutbound, 'Destino', 'Cliques')}
                >
                  <BarList data={summary.topOutbound} emptyLabel="Nenhum clique externo ainda" />
                </ChartCard>

                <ChartCard title="Compartilhamentos do blog">
                  <div className="flex h-full flex-col justify-center gap-4 py-4">
                    <div className="flex items-baseline gap-3">
                      <span className="font-display text-5xl leading-none text-bone">
                        {summary.postShares.current}
                      </span>
                      <span className="font-mono text-[10px] tracking-[0.16em] text-smoke uppercase">
                        compartilhamentos · {summary.postShares.previous} no período anterior
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-smoke">
                      Contabiliza cliques em LinkedIn, X e “copiar link” no rodapé de cada post.
                    </p>
                  </div>
                </ChartCard>
              </div>
            </div>
          )}

          {/* ─── TAB 4: DOSSIÊ IA ───────────────────────────────────── */}
          {tab === 'dossier' && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-px bg-line lg:grid-cols-4">
                <MetricTile
                  label="Aberturas do dossiê"
                  metric={summary.agent.opens}
                  hint={
                    summary.agent.bySurface.length > 0
                      ? summary.agent.bySurface.map((s) => `${s.name}: ${s.count}`).join(' · ')
                      : 'drawer ⌘K e /ask'
                  }
                />
                <MetricTile label="Consultas ao dossiê" metric={summary.agent.queries} accent />
                <MetricTile
                  label="Análises de vaga (/fit)"
                  metric={summary.agent.fitRuns}
                  hint={
                    summary.agent.fitRuns.current > 0
                      ? `média ${summary.agent.avgFitMatched} matches · ${summary.agent.avgFitGaps} lacunas`
                      : 'cole uma vaga em /ask'
                  }
                />
                <MetricTile
                  label="Handoffs & briefings"
                  metric={{
                    current: summary.agent.handoffs.current + summary.agent.shares.current,
                    previous: summary.agent.handoffs.previous + summary.agent.shares.previous,
                  }}
                  hint={`${summary.agent.handoffs.current} envios · ${summary.agent.shares.current} cópias/links`}
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <ChartCard
                  title="Intenções mais consultadas"
                  hint="O que recrutadores, CTOs e clientes perguntam ao dossiê."
                  table={toTable(summary.agent.byIntent, 'Intenção', 'Consultas')}
                >
                  <BarList
                    data={summary.agent.byIntent}
                    formatName={(name) => INTENT_LABEL[name] ?? name}
                    emptyLabel="Nenhuma consulta no período"
                  />
                </ChartCard>

                <ChartCard
                  title="Lente selecionada"
                  hint="Perfil de leitura escolhido no console."
                  table={toTable(summary.agent.byLens, 'Lente', 'Consultas')}
                >
                  <BarList
                    data={summary.agent.byLens}
                    formatName={(name) => LENS_LABEL[name] ?? name}
                    emptyLabel="Sem dados de lente ainda"
                  />
                </ChartCard>

                <ChartCard
                  title="Motor / provedor de IA"
                  hint="Distribuição do waterfall gratuito vs motor determinístico local."
                  table={toTable(summary.agent.byProvider, 'Motor', 'Consultas')}
                >
                  <BarList
                    data={summary.agent.byProvider}
                    formatName={(name) => PROVIDER_LABEL[name] ?? name}
                    emptyLabel="Sem execuções registradas"
                  />
                </ChartCard>
              </div>
            </div>
          )}

          {/* ─── TAB 5: PÚBLICO & RITMO ─────────────────────────────── */}
          {tab === 'audience' && (
            <div className="flex flex-col gap-6">
              <div className="grid gap-6 lg:grid-cols-3">
                <ChartCard
                  title="Dispositivos (por sessão)"
                  table={toTable(summary.byDevice, 'Dispositivo', 'Sessões')}
                >
                  <BarList
                    data={summary.byDevice}
                    formatName={(name) => (name ? name[0].toUpperCase() + name.slice(1) : '—')}
                  />
                </ChartCard>
                <ChartCard
                  title="Navegadores (por sessão)"
                  table={toTable(summary.byBrowser, 'Navegador', 'Sessões')}
                >
                  <BarList data={summary.byBrowser} />
                </ChartCard>
                <ChartCard
                  title="Sistemas operacionais"
                  table={toTable(summary.byOs, 'Sistema', 'Sessões')}
                >
                  <BarList data={summary.byOs} />
                </ChartCard>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard
                  title="Países (estimado por fuso)"
                  hint="Estimado pelo fuso horário do navegador — sem geolocalização por IP."
                  table={toTable(summary.byCountry, 'País', 'Sessões')}
                >
                  <BarList data={summary.byCountry} />
                </ChartCard>

                <ChartCard
                  title="Taxa de rejeição e permanência"
                  hint="Sessões engajadas têm ≥2 páginas, ≥3 seções vistas ou alguma ação relevante."
                >
                  <div className="grid grid-cols-2 gap-px bg-line">
                    <MetricTile
                      label="Taxa de rejeição"
                      metric={summary.bounceRate}
                      unit="percent"
                      higherIsBetter={false}
                    />
                    <MetricTile
                      label="Duração média"
                      metric={summary.avgSessionSeconds}
                      unit="duration"
                    />
                  </div>
                </ChartCard>
              </div>

              <ChartCard
                title="Quando as visitas acontecem"
                hint="Dia da semana × hora, em horário de Brasília. Útil para escolher quando publicar no blog."
                table={{
                  columns: ['Dia', 'Hora', 'Visualizações'],
                  rows: summary.byWeekdayHour.flatMap((row, weekday) =>
                    row
                      .map((value, hour) => [
                        ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][weekday],
                        `${String(hour).padStart(2, '0')}:00`,
                        value,
                      ])
                      .filter((cells) => (cells[2] as number) > 0),
                  ),
                }}
              >
                <HeatMap data={summary.byWeekdayHour} />
              </ChartCard>
            </div>
          )}

          {/* ─── TAB 6: SESSÕES & LOG ───────────────────────────────── */}
          {tab === 'sessions' && (
            <ChartCard
              title={logMode === 'sessions' ? 'Jornadas por sessão' : 'Eventos crus'}
              hint={
                logMode === 'sessions'
                  ? 'Cada linha agrupa uma visita inteira. Se reconhecer um acesso antigo do seu celular ou outro navegador, marque como “Meu acesso” para ocultá-lo permanentemente.'
                  : 'Registro bruto dos eventos gravados no Firestore na janela selecionada.'
              }
              action={
                <div className="flex flex-wrap items-center gap-3">
                  <Segmented
                    size="sm"
                    label="Modo de exibição"
                    value={logMode}
                    onChange={setLogMode}
                    options={[
                      { value: 'sessions', label: 'Sessões', count: summary.recentSessions.length },
                      { value: 'events', label: 'Eventos crus', count: filteredRawEvents.length },
                    ]}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAllRows((value) => !value)}
                    className={cn(
                      'font-mono text-[10px] tracking-[0.16em] text-smoke uppercase transition-colors hover:text-ember',
                      focusRing,
                    )}
                  >
                    {showAllRows ? 'Ver menos' : 'Ver mais'}
                  </button>
                </div>
              }
            >
              {logMode === 'sessions' ? (
                <SessionTable
                  sessions={visibleSessions}
                  onToggleOwner={onMarkVisitorAsOwner}
                />
              ) : (
                <div className="flex flex-col gap-4">
                  <Segmented
                    size="sm"
                    label="Filtrar eventos"
                    value={eventFilter}
                    onChange={setEventFilter}
                    options={[
                      { value: 'all', label: 'Todos' },
                      { value: 'pageview', label: 'Páginas' },
                      { value: 'blog', label: 'Blog' },
                      { value: 'conversion', label: 'Conversões' },
                      { value: 'dossier', label: 'Dossiê IA' },
                    ]}
                  />

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[660px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-line font-mono text-[10px] tracking-[0.2em] text-smoke uppercase">
                          <th className="py-2 pr-4 font-normal">Quando</th>
                          <th className="py-2 pr-4 font-normal">Evento</th>
                          <th className="py-2 pr-4 font-normal">Onde</th>
                          <th className="py-2 pr-4 font-normal">Origem</th>
                          <th className="py-2 pr-4 font-normal">País</th>
                          <th className="py-2 font-normal">Dispositivo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {visibleEvents.map((event) => (
                          <tr key={event.id} className="text-bone-dim">
                            <td className="py-2.5 pr-4 font-mono text-xs text-smoke tabular-nums">
                              {timeAgo(event.createdAt)}
                            </td>
                            <td className="py-2.5 pr-4">
                              <Badge tone={event.type === 'pageview' ? 'ember' : 'neutral'}>
                                {TYPE_LABEL[event.type] ?? event.type}
                              </Badge>
                            </td>
                            <td className="max-w-52 truncate py-2.5 pr-4 font-mono text-xs">
                              {event.slug
                                ? `/blog/${event.slug}`
                                : event.type === 'agent_query' && event.intent
                                  ? `${event.intent}${event.provider ? ` · ${event.provider}` : ''}`
                                  : event.type === 'agent_fit' && event.matched !== undefined
                                    ? `/fit · ${event.matched}↑ ${event.gaps ?? 0}↓`
                                    : prettyPath(event.path)}
                            </td>
                            <td className="max-w-44 truncate py-2.5 pr-4 text-xs">
                              {event.source ?? event.referrerHost}
                              {event.utmCampaign && (
                                <span className="ml-1 font-mono text-[10px] text-ember">
                                  ({event.utmCampaign})
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 pr-4 text-xs">{event.country}</td>
                            <td className="py-2.5 text-xs capitalize">
                              {event.device} · {event.browser}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </ChartCard>
          )}
        </div>
      )}
    </>
  )
}

/* ─── Session journeys table ────────────────────────────────────────────── */

function SessionTable({
  sessions,
  onToggleOwner,
}: {
  sessions: SessionSummary[]
  onToggleOwner: (session: SessionSummary) => void
}) {
  if (sessions.length === 0) {
    return <p className="py-8 text-center text-sm text-smoke">Nenhuma sessão registrada.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[740px] text-left text-sm">
        <thead>
          <tr className="border-b border-line font-mono text-[10px] tracking-[0.2em] text-smoke uppercase">
            <th className="py-2 pr-4 font-normal">Quando</th>
            <th className="py-2 pr-4 font-normal">Origem</th>
            <th className="py-2 pr-4 font-normal">Jornada</th>
            <th className="py-2 pr-4 font-normal">Engajamento</th>
            <th className="py-2 pr-4 font-normal">Duração</th>
            <th className="py-2 pr-4 font-normal">Dispositivo</th>
            <th className="py-2 text-right font-normal">Higiene</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sessions.map((session) => (
            <tr key={session.sessionId} className="text-bone-dim">
              <td className="py-3 pr-4 align-top font-mono text-xs whitespace-nowrap text-smoke tabular-nums">
                {timeAgo(session.startedAt)}
              </td>
              <td className="py-3 pr-4 align-top">
                <span className="block text-sm text-bone">{session.source}</span>
                <span className="font-mono text-[10px] text-smoke">
                  {session.channelLabel}
                  {session.campaign && ` · ${session.campaign}`}
                </span>
              </td>
              <td className="max-w-64 py-3 pr-4 align-top">
                <span
                  className="block truncate font-mono text-xs text-bone-dim"
                  title={session.pages.join(' → ')}
                >
                  {session.pages.slice(0, 3).map(prettyPath).join(' → ')}
                  {session.pages.length > 3 && ` (+${session.pages.length - 3})`}
                </span>
                <span className="font-mono text-[10px] text-smoke">
                  {session.pageviews} pág. · {session.isNewVisitor ? 'novo' : 'recorrente'}
                </span>
              </td>
              <td className="py-3 pr-4 align-top">
                <div className="flex flex-wrap gap-1">
                  {session.actions.length > 0 ? (
                    session.actions.slice(0, 3).map((action) => (
                      <Badge key={action} tone="ember">
                        {action}
                      </Badge>
                    ))
                  ) : (
                    <Badge tone={session.engaged ? 'neutral' : 'muted'}>
                      {session.engaged ? 'engajado' : 'rápido'}
                    </Badge>
                  )}
                </div>
              </td>
              <td className="py-3 pr-4 align-top font-mono text-xs whitespace-nowrap text-smoke tabular-nums">
                {formatDuration(session.durationSeconds)}
              </td>
              <td className="py-3 pr-4 align-top text-xs whitespace-nowrap">
                <span className="block capitalize">
                  {session.device} · {session.browser}
                </span>
                <span className="font-mono text-[10px] text-smoke">{session.country}</span>
              </td>
              <td className="py-3 text-right align-top">
                {session.visitorId && (
                  <button
                    type="button"
                    onClick={() => onToggleOwner(session)}
                    title={
                      session.isOwner
                        ? 'Remover da lista de dispositivos próprios'
                        : 'Marcar este visitorId como seu para excluir do histórico'
                    }
                    className={cn(
                      'font-mono text-[10px] tracking-[0.14em] uppercase transition-colors',
                      focusRing,
                      session.isOwner
                        ? 'text-ember hover:underline'
                        : 'text-smoke hover:text-ember',
                    )}
                  >
                    {session.isOwner ? 'Meu ✓' : 'É meu'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ─── UTM Link Builder ──────────────────────────────────────────────────── */

function UtmBuilderCard() {
  const [path, setPath] = useState('/')
  const [source, setSource] = useState('linkedin')
  const [medium, setMedium] = useState('profile')
  const [campaign, setCampaign] = useState('portfolio')

  const generatedUrl = useMemo(() => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    const url = new URL(cleanPath, 'https://marcusboni.com.br')
    if (source.trim()) url.searchParams.set('utm_source', source.trim().toLowerCase())
    if (medium.trim()) url.searchParams.set('utm_medium', medium.trim().toLowerCase())
    if (campaign.trim()) url.searchParams.set('utm_campaign', campaign.trim().toLowerCase())
    return url.toString()
  }, [path, source, medium, campaign])

  return (
    <Card>
      <SectionHeader
        label="Gerador de link rastreado (UTM)"
        hint="Apps como WhatsApp, LinkedIn mobile, Instagram e PDFs removem o referrer do navegador. Use estes links na bio, currículo e posts para saber exatamente de onde cada visita veio."
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {UTM_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => {
              setSource(preset.source)
              setMedium(preset.medium)
              setCampaign(preset.campaign)
            }}
            className={cn(
              'border px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] uppercase transition-colors',
              focusRing,
              source === preset.source && medium === preset.medium
                ? 'border-ember bg-ember/10 text-ember'
                : 'border-line text-smoke hover:border-bone/40 hover:text-bone-dim',
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Página de destino">
          <Select value={path} onChange={(e) => setPath(e.target.value)}>
            {DESTINATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="utm_source" hint="Ex.: linkedin, cv, whatsapp">
          <TextInput value={source} onChange={(e) => setSource(e.target.value)} />
        </Field>
        <Field label="utm_medium" hint="Ex.: profile, pdf, social, dm">
          <TextInput value={medium} onChange={(e) => setMedium(e.target.value)} />
        </Field>
        <Field label="utm_campaign" hint="Opcional (ex.: vaga-rust)">
          <TextInput value={campaign} onChange={(e) => setCampaign(e.target.value)} />
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-line bg-ink px-4 py-3">
        <code className="min-w-0 flex-1 font-mono text-xs break-all text-bone">
          {generatedUrl}
        </code>
        <CopyButton value={generatedUrl} label="Copiar link" />
      </div>
    </Card>
  )
}
