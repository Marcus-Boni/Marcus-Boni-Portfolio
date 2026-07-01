import { AreaChart, BarList, Donut, HourBars } from '@/admin/components/charts'
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  SectionLabel,
  Spinner,
  Stat,
} from '@/admin/components/ui'
import { useAnalytics } from '@/admin/hooks'

const TYPE_LABEL: Record<string, string> = {
  pageview: 'Visita',
  section_view: 'Seção',
  outbound_click: 'Link externo',
  cv_download: 'Download CV',
  contact_submit: 'Contato',
  language_change: 'Idioma',
}

function timeAgo(date: Date | null): string {
  if (!date) return '—'
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h`
  return `${Math.floor(hours / 24)} d`
}

export function Analytics() {
  const { summary, events, loading } = useAnalytics()

  return (
    <>
      <PageHeader
        title="Audiência"
        subtitle="Quem acessa o portfólio, de onde, em quais dispositivos e o que faz por lá."
      />

      {loading ? (
        <Spinner label="Carregando eventos" />
      ) : summary.totalEvents === 0 ? (
        <EmptyState
          title="Nenhum evento ainda"
          description="Os dados de audiência aparecem aqui assim que o site público começar a receber visitas."
        />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-px bg-line md:grid-cols-4">
            <Stat label="Total de visitas" value={summary.pageviews} accent />
            <Stat label="Visitantes únicos" value={summary.uniqueVisitors} />
            <Stat label="Sessões" value={summary.uniqueSessions} />
            <Stat
              label="Págs./sessão"
              value={summary.avgViewsPerSession}
              hint={`${summary.outboundClicks} cliques externos`}
            />
          </div>

          <Card>
            <SectionLabel>Visitas por dia — últimos 14 dias</SectionLabel>
            <AreaChart data={summary.byDay} />
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <SectionLabel>Dispositivos</SectionLabel>
              <Donut data={summary.byDevice} />
            </Card>
            <Card>
              <SectionLabel>Navegadores</SectionLabel>
              <Donut data={summary.byBrowser} />
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <SectionLabel>Sistemas operacionais</SectionLabel>
              <BarList data={summary.byOs} />
            </Card>
            <Card>
              <SectionLabel>Países (por fuso horário)</SectionLabel>
              <BarList data={summary.byCountry} />
            </Card>
            <Card>
              <SectionLabel>Origem do tráfego</SectionLabel>
              <BarList data={summary.byReferrer} />
            </Card>
          </div>

          <Card>
            <SectionLabel>Atividade por hora do dia</SectionLabel>
            <div className="px-1 pb-6 pt-2">
              <HourBars data={summary.byHour} />
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <SectionLabel>Seções mais vistas</SectionLabel>
              <BarList
                data={summary.bySection}
                emptyLabel="Sem dados de rolagem ainda"
              />
            </Card>
            <Card>
              <SectionLabel>Links externos mais clicados</SectionLabel>
              <BarList
                data={summary.topOutbound}
                emptyLabel="Nenhum clique externo ainda"
              />
            </Card>
          </div>

          <Card>
            <SectionLabel>Atividade recente</SectionLabel>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line font-mono text-[10px] tracking-[0.2em] text-smoke uppercase">
                    <th className="py-2 pr-4 font-normal">Quando</th>
                    <th className="py-2 pr-4 font-normal">Evento</th>
                    <th className="py-2 pr-4 font-normal">Local</th>
                    <th className="py-2 pr-4 font-normal">Dispositivo</th>
                    <th className="py-2 font-normal">Origem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {events.slice(0, 30).map((e) => (
                    <tr key={e.id} className="text-bone-dim">
                      <td className="py-2.5 pr-4 font-mono text-xs text-smoke">
                        {timeAgo(e.createdAt)}
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge tone={e.type === 'pageview' ? 'ember' : 'neutral'}>
                          {TYPE_LABEL[e.type] ?? e.type}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-4">{e.country}</td>
                      <td className="py-2.5 pr-4 capitalize">
                        {e.device} · {e.browser}
                      </td>
                      <td className="py-2.5 truncate">{e.referrerHost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
