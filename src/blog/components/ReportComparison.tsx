import { useContext, useId, useState, type CSSProperties, type ReactNode } from 'react'

import { BodyContext } from '@/blog/lib/body-context'
import './report-comparison.css'

const copy = {
  pt: {
    title: 'A mesma exportação, duas interfaces',
    hint: 'Arraste a divisão ou use as setas do teclado.',
    slider: 'Divisão entre a tela anterior e a revisada',
    before: 'Antes',
    compare: 'Comparar',
    after: 'Depois',
    allBefore: 'Tela anterior inteira',
    allAfter: 'Tela revisada inteira',
    beforeShare: (value: number) => `${value}% da tela anterior`,
    area: 'Financeiro',
    section: 'Fechamento do mês',
    reports: 'Relatórios',
    report: 'Relatório financeiro',
    date: 'Data',
    period: 'Período do relatório',
    month: 'Novembro de 2026',
    shortMonth: '11/2026',
    results: '48 lançamentos',
    oldExport: 'Exportar',
    ready: 'Arquivo pronto',
    file: 'Lançamentos de novembro',
    download: 'Baixar CSV',
  },
  en: {
    title: 'The same export, two interfaces',
    hint: 'Drag the divider or use the arrow keys.',
    slider: 'Split between the original and revised screens',
    before: 'Before',
    compare: 'Compare',
    after: 'After',
    allBefore: 'Full original screen',
    allAfter: 'Full revised screen',
    beforeShare: (value: number) => `${value}% original screen`,
    area: 'Finance',
    section: 'Month-end close',
    reports: 'Reports',
    report: 'Financial report',
    date: 'Date',
    period: 'Report period',
    month: 'November 2026',
    shortMonth: '11/2026',
    results: '48 entries',
    oldExport: 'Export',
    ready: 'File ready',
    file: 'November entries',
    download: 'Download CSV',
  },
}

function ReportScreen({ labels, before = false }: { labels: typeof copy.pt; before?: boolean }) {
  return (
    <div className={`report-comparison__screen${before ? ' report-comparison__screen--before' : ''}`} aria-hidden="true">
      <div className="report-comparison__bar">
        <span>{labels.area}</span>
        {!before && <span>{labels.section}</span>}
      </div>
      <div className="report-comparison__content">
        <div className="report-comparison__details">
          <span className="report-comparison__screen-title">{before ? labels.reports : labels.report}</span>
          <span className="report-comparison__field">
            <span>{before ? labels.date : labels.period}</span>
            <span>{before ? labels.shortMonth : labels.month}</span>
          </span>
          {!before && <span className="report-comparison__results">{labels.results}</span>}
        </div>
        {before ? (
          <div className="report-comparison__unavailable">{labels.oldExport}</div>
        ) : (
          <div className="report-comparison__status">
            <span className="report-comparison__state"><span>✓</span> {labels.ready}</span>
            <span>{labels.file}</span>
            <span className="report-comparison__download">{labels.download}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function ReportComparison({ children }: { children?: ReactNode }) {
  const labels = copy[useContext(BodyContext).lang]
  const titleId = useId()
  const hintId = useId()
  const captionId = useId()
  const [split, setSplit] = useState(50)
  const fullView = split === 0 || split === 100
  const valueLabel = split === 0 ? labels.allAfter : split === 100 ? labels.allBefore : labels.beforeShare(split)

  return (
    <figure className="report-comparison" aria-labelledby={titleId} aria-describedby={children ? captionId : undefined}>
      <div className="report-comparison__toolbar">
        <span id={titleId}>{labels.title}</span>
        <div className="report-comparison__presets">
          <button type="button" aria-pressed={split === 100} onClick={() => setSplit(100)}>{labels.before}</button>
          <button type="button" aria-pressed={split === 50} onClick={() => setSplit(50)}>{labels.compare}</button>
          <button type="button" aria-pressed={split === 0} onClick={() => setSplit(0)}>{labels.after}</button>
        </div>
      </div>
      <div className="report-comparison__stage" data-full-view={fullView} style={{ '--report-split': `${split}%` } as CSSProperties}>
        <ReportScreen labels={labels} />
        <ReportScreen labels={labels} before />
        <span className="report-comparison__divider" aria-hidden="true" />
        <span className="report-comparison__handle" aria-hidden="true">‹ ›</span>
        <input
          type="range"
          min={0}
          max={100}
          value={split}
          aria-label={labels.slider}
          aria-describedby={hintId}
          aria-valuetext={valueLabel}
          onChange={(event) => setSplit(event.currentTarget.valueAsNumber)}
        />
      </div>
      <figcaption id={captionId} className="report-comparison__caption">
        {children}
        <span id={hintId}>{labels.hint}</span>
      </figcaption>
    </figure>
  )
}
