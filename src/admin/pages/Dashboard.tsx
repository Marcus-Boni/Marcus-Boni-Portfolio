import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { useAdminContent } from '@/admin/AdminContentContext'
import { ChartCard, MetricTile } from '@/admin/components/analytics-ui'
import { BarList, TimeSeries } from '@/admin/components/charts'
import { Banner, PageHeader, Spinner } from '@/admin/components/ui'
import { useAnalytics, useMessages } from '@/admin/hooks'
import { isFirebaseConfigured } from '@/lib/firebase'

/**
 * The at-a-glance view. Deliberately narrower than `/admin/analytics`: the
 * seven-day window, the headline numbers, and the two breakdowns worth acting
 * on. Anything that needs a filter row lives on the Audiência page.
 */
export function Dashboard() {
  const { summary, loading, error } = useAnalytics('7d')
  const { messages, unread } = useMessages()
  const { draft } = useAdminContent()

  const viewsTrend = useMemo(
    () => summary.byDay.map((d) => d.views),
    [summary.byDay],
  )

  return (
    <>
      <PageHeader
        title="Painel"
        subtitle="Os últimos 7 dias, comparados com os 7 anteriores."
        actions={
          <Link
            to="/admin/analytics"
            className="font-mono text-[10px] tracking-[0.2em] text-ember uppercase hover:underline"
          >
            Audiência completa →
          </Link>
        }
      />

      {!isFirebaseConfigured && (
        <div className="mb-8">
          <Banner tone="warn">
            Modo demonstração — Firebase não configurado. As métricas aparecem
            assim que você conectar um projeto.
          </Banner>
        </div>
      )}

      {error && (
        <div className="mb-8">
          <Banner tone="error">
            <p className="font-mono text-[11px] tracking-[0.16em] uppercase">
              Falha ao carregar as métricas · {error.code}
            </p>
            <p className="mt-1.5 text-xs text-bone-dim">
              O diagnóstico completo, com o link de correção quando houver, está
              em{' '}
              <Link to="/admin/analytics" className="text-ember hover:underline">
                Audiência
              </Link>
              .
            </p>
          </Banner>
        </div>
      )}

      {loading ? (
        <Spinner label="Carregando métricas" />
      ) : (
        <div className="flex flex-col gap-6">
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

          <ChartCard
            title="Visitas por dia — 7 dias"
            hint="A linha cinza é a semana anterior."
            table={{
              columns: ['Dia', 'Visitas', 'Visitantes', 'Semana anterior'],
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
                  label="Posts do blog"
                  value={summary.posts.length}
                  hint="com visitas no período"
                />
                <ContentRow
                  to="/admin/projects"
                  label="Projetos"
                  value={draft.projects.length}
                />
                <ContentRow
                  to="/admin/experience"
                  label="Experiências"
                  value={draft.experience.projects.length}
                />
                <ContentRow
                  to="/admin/profile"
                  label="Tecnologias"
                  value={draft.techStack.length}
                />
              </ul>
              <p className="mt-4 font-mono text-[10px] tracking-[0.16em] text-smoke uppercase">
                CV baixado {summary.cvDownloads.current}× · contato{' '}
                {summary.contactSubmits.current}×
              </p>
            </ChartCard>
          </div>
        </div>
      )}
    </>
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
        className="text-sm text-bone-dim transition-colors hover:text-ember"
      >
        {label}
        {hint && <span className="ml-1 text-xs text-smoke">({hint})</span>}
      </Link>
      <span className="font-display text-2xl text-bone">{value}</span>
    </li>
  )
}
