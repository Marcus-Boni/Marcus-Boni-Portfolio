import { Link } from 'react-router-dom'

import { useAdminContent } from '@/admin/AdminContentContext'
import { AreaChart, BarList, Donut } from '@/admin/components/charts'
import {
  Banner,
  Card,
  PageHeader,
  SectionLabel,
  Spinner,
  Stat,
} from '@/admin/components/ui'
import { useAnalytics, useMessages } from '@/admin/hooks'
import { isFirebaseConfigured } from '@/lib/firebase'

function trend(today: number, avgPrev: number): string {
  if (avgPrev <= 0) return today > 0 ? '+100%' : '—'
  const delta = Math.round(((today - avgPrev) / avgPrev) * 100)
  return `${delta >= 0 ? '+' : ''}${delta}% vs. média`
}

export function Dashboard() {
  const { summary, loading } = useAnalytics()
  const { messages, unread } = useMessages()
  const { draft } = useAdminContent()

  const avgDaily =
    summary.byDay.length > 0
      ? summary.byDay.reduce((s, d) => s + d.views, 0) / summary.byDay.length
      : 0

  return (
    <>
      <PageHeader
        title="Painel"
        subtitle="Visão geral em tempo real da audiência e do conteúdo do portfólio."
      />

      {!isFirebaseConfigured && (
        <div className="mb-8">
          <Banner tone="warn">
            Modo demonstração — Firebase não configurado. As métricas aparecerão
            assim que você conectar um projeto Firebase (veja{' '}
            <span className="font-mono">ADMIN_SETUP.md</span>).
          </Banner>
        </div>
      )}

      {loading ? (
        <Spinner label="Carregando métricas" />
      ) : (
        <div className="flex flex-col gap-6">
          {/* ─── KPI row ──────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-px bg-line md:grid-cols-4">
            <Stat
              label="Visitas hoje"
              value={summary.viewsToday}
              hint={trend(summary.viewsToday, avgDaily)}
              accent
            />
            <Stat
              label="Visitantes únicos"
              value={summary.uniqueVisitors}
              hint={`${summary.newVisitors} novos · ${summary.returningVisitors} recorrentes`}
            />
            <Stat
              label="Visitas (7 dias)"
              value={summary.viewsLast7}
              hint={`${summary.avgViewsPerSession} págs./sessão`}
            />
            <Stat
              label="Mensagens"
              value={messages.length}
              hint={unread > 0 ? `${unread} não lida(s)` : 'tudo lido'}
              accent={unread > 0}
            />
          </div>

          {/* ─── Traffic chart ────────────────────────────────── */}
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <SectionLabel>Tráfego — últimos 14 dias</SectionLabel>
              <Link
                to="/admin/analytics"
                className="font-mono text-[10px] tracking-[0.2em] text-ember uppercase hover:underline"
              >
                Detalhes →
              </Link>
            </div>
            <AreaChart data={summary.byDay} />
          </Card>

          {/* ─── Breakdown row ────────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <SectionLabel>Dispositivos</SectionLabel>
              <Donut data={summary.byDevice} />
            </Card>
            <Card>
              <SectionLabel>Países (por fuso)</SectionLabel>
              <BarList data={summary.byCountry} />
            </Card>
            <Card>
              <SectionLabel>Origem do tráfego</SectionLabel>
              <BarList data={summary.byReferrer} />
            </Card>
          </div>

          {/* ─── Engagement + content snapshot ────────────────── */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <SectionLabel>Seções mais vistas</SectionLabel>
              <BarList
                data={summary.bySection}
                emptyLabel="Sem dados de rolagem ainda"
              />
            </Card>
            <Card>
              <SectionLabel>Conteúdo publicado</SectionLabel>
              <ul className="flex flex-col divide-y divide-line">
                <ContentRow to="/admin/projects" label="Projetos" value={draft.projects.length} />
                <ContentRow to="/admin/experience" label="Experiências" value={draft.experience.projects.length} />
                <ContentRow to="/admin/profile" label="Tecnologias" value={draft.techStack.length} />
                <ContentRow to="/admin/profile" label="Redes sociais" value={draft.socials.length} />
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="font-mono text-[10px] tracking-[0.18em] text-smoke uppercase">
                  CV baixado {summary.cvDownloads}× · contato {summary.contactSubmits}×
                </span>
              </div>
            </Card>
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
}: {
  to: string
  label: string
  value: number
}) {
  return (
    <li className="flex items-center justify-between py-3">
      <Link
        to={to}
        className="text-sm text-bone-dim transition-colors hover:text-ember"
      >
        {label}
      </Link>
      <span className="font-display text-2xl text-bone">{value}</span>
    </li>
  )
}
