import { useMemo, useState } from 'react'

import { ChartCard, MetricTile, RangeFilter } from '@/admin/components/analytics-ui'
import { BarList, HeatMap, TimeSeries } from '@/admin/components/charts'
import {
  Badge,
  Banner,
  EmptyState,
  PageHeader,
  Spinner,
} from '@/admin/components/ui'
import { useAnalytics } from '@/admin/hooks'
import { RANGES, SITE_TZ, type NamedCount } from '@/admin/services/analytics'
import { isFirebaseConfigured } from '@/lib/firebase'
import { cn } from '@/lib/utils'

const TYPE_LABEL: Record<string, string> = {
  pageview: 'Visita',
  section_view: 'Seção',
  outbound_click: 'Link externo',
  cv_download: 'Download CV',
  contact_submit: 'Contato',
  language_change: 'Idioma',
  blog_index_view: 'Blog — índice',
  post_view: 'Post aberto',
  post_read: 'Post lido',
  post_share: 'Post compartilhado',
}

function timeAgo(date: Date | null): string {
  if (!date) return '—'
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h`
  return `${Math.floor(hours / 24)} d`
}

/** `/blog/meu-post` reads better than the bare slug in a path list. */
function prettyPath(path: string): string {
  return path === '/' ? '/ (home)' : path
}

/** Turns a Firestore error code into the action that actually fixes it. */
function errorHint(code: string): string {
  switch (code) {
    case 'failed-precondition':
      return 'A consulta precisa de um índice que ainda não existe. A mensagem abaixo traz o link que cria o índice com um clique no console do Firebase — depois de criado, leva um ou dois minutos para ficar pronto.'
    case 'permission-denied':
      return 'As regras do Firestore recusaram a leitura da coleção `analytics`. Confirme que `firestore.rules` foi publicado e que você está autenticado.'
    case 'unavailable':
      return 'O Firestore está inacessível. Normalmente é conexão — tente novamente em instantes.'
    case 'resource-exhausted':
      return 'A cota do projeto foi excedida. Verifique o uso no console do Firebase.'
    case 'invalid-argument':
      // Reached once, when MAX_EVENTS was set above Firestore's 10.000 ceiling.
      return 'A consulta é inválida — normalmente um limite acima do máximo de 10.000 do Firestore. É um bug de código, não de configuração.'
    default:
      return 'Erro inesperado ao abrir a assinatura de eventos.'
  }
}

function toTable(data: NamedCount[], nameColumn: string) {
  return {
    columns: [nameColumn, 'Visitas', 'Anterior'],
    rows: data.map((d) => [d.name, d.count, d.previous ?? 0]),
  }
}

export function Analytics() {
  const { summary, events, loading, error, range, setRange, exportCsv } =
    useAnalytics('30d')
  const [showAllActivity, setShowAllActivity] = useState(false)

  const viewsTrend = useMemo(
    () => summary.byDay.map((d) => d.views),
    [summary.byDay],
  )
  const visitorsTrend = useMemo(
    () => summary.byDay.map((d) => d.visitors),
    [summary.byDay],
  )

  const activity = showAllActivity ? events.slice(0, 200) : events.slice(0, 25)
  const rangeLabel = RANGES[range].label

  return (
    <>
      <PageHeader
        title="Audiência"
        subtitle={`Quem acessa o portfólio e o blog, de onde, em quais dispositivos e o que faz por lá. Datas e horas em horário de Brasília (${SITE_TZ}).`}
      />

      <RangeFilter
        value={range}
        onChange={setRange}
        onExport={exportCsv}
        live={isFirebaseConfigured && !error}
      />

      {!isFirebaseConfigured && (
        <div className="mb-6">
          <Banner tone="warn">
            Modo demonstração — Firebase não configurado, então não há eventos
            para exibir.
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
            {/* The raw message is kept because Firestore puts the
                one-click "create index" console URL inside it. */}
            <p className="font-mono text-[10px] leading-relaxed break-words text-smoke">
              {error.message}
            </p>
          </Banner>
        </div>
      )}

      {summary.truncated && (
        <div className="mb-6">
          <Banner tone="warn">
            O período selecionado excedeu o limite de leitura desta consulta. Os
            números abaixo são um piso, não o total — use um período menor para
            valores exatos.
          </Banner>
        </div>
      )}

      {loading ? (
        <Spinner label="Carregando eventos" />
      ) : !summary.hasData ? (
        <EmptyState
          title="Nenhum evento no período"
          description="Os dados aparecem aqui assim que o site receber visitas. Tente um período maior."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {/* ─── Aquisição ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-px bg-line lg:grid-cols-4">
            <MetricTile
              label="Visitas"
              metric={summary.pageviews}
              trend={viewsTrend}
              accent
            />
            <MetricTile
              label="Visitantes únicos"
              metric={summary.visitors}
              trend={visitorsTrend}
              hint={`${summary.newVisitors} novos · ${summary.returningVisitors} recorrentes`}
            />
            <MetricTile label="Sessões" metric={summary.sessions} />
            <MetricTile
              label="Páginas por sessão"
              metric={summary.viewsPerSession}
              unit="decimal"
            />
          </div>

          <ChartCard
            title={`Visitas por dia — ${rangeLabel}`}
            hint="A linha cinza é o período imediatamente anterior, de mesma duração."
            table={{
              columns: ['Dia', 'Visitas', 'Visitantes', 'Período anterior'],
              rows: summary.byDay.map((d) => [
                d.date,
                d.views,
                d.visitors,
                d.previousViews,
              ]),
            }}
          >
            <TimeSeries data={summary.byDay} />
          </ChartCard>

          {/* ─── Engajamento ───────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-px bg-line lg:grid-cols-4">
            <MetricTile
              label="Taxa de rejeição"
              metric={summary.bounceRate}
              unit="percent"
              higherIsBetter={false}
              hint="sessões sem nenhuma ação relevante"
            />
            <MetricTile
              label="Duração média"
              metric={summary.avgSessionSeconds}
              unit="duration"
              hint="do primeiro ao último evento"
            />
            <MetricTile
              label="Downloads do CV"
              metric={summary.cvDownloads}
            />
            <MetricTile
              label="Mensagens enviadas"
              metric={summary.contactSubmits}
              accent
            />
          </div>

          {/* ─── Conteúdo ──────────────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard
              title="Páginas mais vistas"
              table={toTable(summary.byPath, 'Página')}
            >
              <BarList data={summary.byPath} formatName={prettyPath} />
            </ChartCard>

            <ChartCard
              title="Origem do tráfego"
              hint="De onde a visita veio, pelo referrer do navegador."
              table={toTable(summary.byReferrer, 'Origem')}
            >
              <BarList data={summary.byReferrer} />
            </ChartCard>
          </div>

          {/* ─── Blog ──────────────────────────────────────────── */}
          <ChartCard
            title="Desempenho do blog"
            hint="“Lido” dispara a 75% de rolagem — a taxa separa quem abriu de quem leu."
            table={{
              columns: ['Post', 'Aberturas', 'Leituras', 'Taxa', 'Compart.'],
              rows: summary.posts.map((p) => [
                p.slug,
                p.views,
                p.reads,
                `${p.readRate}%`,
                p.shares,
              ]),
            }}
          >
            {summary.posts.length === 0 ? (
              <p className="py-8 text-center text-sm text-smoke">
                Nenhum post visitado neste período.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {summary.posts.slice(0, 8).map((post) => (
                  <li
                    key={post.slug}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <a
                      href={`/blog/${post.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 truncate text-sm text-bone-dim transition-colors hover:text-ember"
                    >
                      /{post.slug}
                    </a>
                    <div className="flex items-center gap-4 font-mono text-[11px] text-smoke tabular-nums">
                      <span title="Aberturas">{post.views} ab.</span>
                      <span title="Leituras (75% de rolagem)">
                        {post.reads} lid.
                      </span>
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

          {/* ─── Público ───────────────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-3">
            <ChartCard
              title="Dispositivos"
              table={toTable(summary.byDevice, 'Dispositivo')}
            >
              <BarList
                data={summary.byDevice}
                formatName={(name) => name[0].toUpperCase() + name.slice(1)}
              />
            </ChartCard>
            <ChartCard
              title="Navegadores"
              table={toTable(summary.byBrowser, 'Navegador')}
            >
              <BarList data={summary.byBrowser} />
            </ChartCard>
            <ChartCard
              title="Sistemas operacionais"
              table={toTable(summary.byOs, 'Sistema')}
            >
              <BarList data={summary.byOs} />
            </ChartCard>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard
              title="Países"
              hint="Estimado pelo fuso horário do navegador — sem geolocalização por IP."
              table={toTable(summary.byCountry, 'País')}
            >
              <BarList data={summary.byCountry} />
            </ChartCard>
            <ChartCard
              title="Seções mais vistas"
              hint="Quanto da página inicial cada visitante realmente alcança."
              table={toTable(summary.bySection, 'Seção')}
            >
              <BarList
                data={summary.bySection}
                emptyLabel="Sem dados de rolagem ainda"
              />
            </ChartCard>
          </div>

          {/* ─── Ritmo ─────────────────────────────────────────── */}
          <ChartCard
            title="Quando as visitas acontecem"
            hint="Dia da semana × hora, em horário de Brasília. Útil para escolher quando publicar."
            table={{
              columns: ['Dia', 'Hora', 'Visitas'],
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

          {/* ─── Saídas ────────────────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard
              title="Links externos mais clicados"
              table={toTable(summary.topOutbound, 'Destino')}
            >
              <BarList
                data={summary.topOutbound}
                emptyLabel="Nenhum clique externo ainda"
              />
            </ChartCard>

            <ChartCard title="Compartilhamentos do blog">
              <div className="flex h-full flex-col justify-center gap-4 py-4">
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-5xl leading-none text-bone">
                    {summary.postShares.current}
                  </span>
                  <span className="font-mono text-[10px] tracking-[0.16em] text-smoke uppercase">
                    compartilhamentos · {summary.postShares.previous} no período
                    anterior
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-smoke">
                  Contabiliza cliques em LinkedIn, X e “copiar link” no rodapé de
                  cada post.
                </p>
              </div>
            </ChartCard>
          </div>

          {/* ─── Atividade recente ─────────────────────────────── */}
          <ChartCard
            title="Atividade recente"
            action={
              <button
                type="button"
                onClick={() => setShowAllActivity((value) => !value)}
                className="font-mono text-[10px] tracking-[0.16em] text-smoke uppercase transition-colors hover:text-ember"
              >
                {showAllActivity ? 'Ver menos' : 'Ver mais'}
              </button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line font-mono text-[10px] tracking-[0.2em] text-smoke uppercase">
                    <th className="py-2 pr-4 font-normal">Quando</th>
                    <th className="py-2 pr-4 font-normal">Evento</th>
                    <th className="py-2 pr-4 font-normal">Onde</th>
                    <th className="py-2 pr-4 font-normal">País</th>
                    <th className="py-2 pr-4 font-normal">Dispositivo</th>
                    <th className="py-2 font-normal">Origem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {activity.map((event) => (
                    <tr key={event.id} className="text-bone-dim">
                      <td className="py-2.5 pr-4 font-mono text-xs text-smoke tabular-nums">
                        {timeAgo(event.createdAt)}
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge
                          tone={event.type === 'pageview' ? 'ember' : 'neutral'}
                        >
                          {TYPE_LABEL[event.type] ?? event.type}
                        </Badge>
                      </td>
                      <td className="max-w-48 truncate py-2.5 pr-4 font-mono text-xs">
                        {event.slug ? `/blog/${event.slug}` : prettyPath(event.path)}
                      </td>
                      <td className="py-2.5 pr-4">{event.country}</td>
                      <td className="py-2.5 pr-4 capitalize">
                        {event.device} · {event.browser}
                      </td>
                      <td className="truncate py-2.5">{event.referrerHost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </div>
      )}
    </>
  )
}
