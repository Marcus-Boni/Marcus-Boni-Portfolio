import type { FitReport } from '@/agent/types'
import type { Locale } from '@/i18n/translations'

/**
 * Dependency-free editorial one-pager PDF / print generator for `/fit` role
 * analyses.
 *
 * Uses a temporary hidden `<iframe>` with `srcdoc` so printing works identically
 * whether triggered inside the `⌘K` overlay drawer or fullscreen `/ask`, with
 * zero page-chrome bleed, zero popup blockers, and zero external PDF libs.
 */

export interface FitPrintOptions {
  locale: Locale
  profileName: string
  role: string
  location: string
  email: string
  origin?: string
}

export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Generates a self-contained, A4-formatted Signal & Ink light-paper HTML
 * document ready for native browser Print / Save as PDF.
 */
export function buildFitPrintHtml(
  report: FitReport,
  options: FitPrintOptions,
): string {
  const { locale, profileName, role, location, email } = options
  const isPt = locale === 'pt'
  const origin = (options.origin ?? 'https://marcusboni.com.br').replace(/\/$/, '')
  const sourceUrl = `${origin}${isPt ? '/ask' : '/en/ask'}`
  const dateLabel = new Intl.DateTimeFormat(isPt ? 'pt-BR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date())

  const matchedRows =
    report.matched.length > 0
      ? report.matched
          .map(
            (item) => `
            <tr>
              <td class="skill">${escapeHtml(item.skill)}</td>
              <td class="proofs">${item.proofs
                .map((p) => `<span class="proof">${escapeHtml(p.label)}</span>`)
                .join(' · ')}</td>
            </tr>`,
          )
          .join('')
      : `<tr><td colspan="2" class="muted">${escapeHtml(
          isPt
            ? 'Nenhum requisito técnico específico extraído.'
            : 'No specific technical requirements extracted.',
        )}</td></tr>`

  const gapItems =
    report.gaps.length > 0
      ? `<ul class="gaps">${report.gaps
          .map(
            (gap) => `
            <li>
              <span class="gap-term">${escapeHtml(gap.term)}</span>
              ${
                gap.adjacent.length > 0
                  ? `<span class="muted">${escapeHtml(
                      isPt ? 'Experiência adjacente' : 'Adjacent experience',
                    )}: ${escapeHtml(gap.adjacent.join(', '))}</span>`
                  : ''
              }
            </li>`,
          )
          .join('')}</ul>`
      : `<p class="muted">${escapeHtml(
          isPt
            ? 'Nenhuma tecnologia fora do dossiê público foi detectada.'
            : 'No unlisted technologies were detected in this role.',
        )}</p>`

  const engagementsBlock =
    report.relevantEngagements.length > 0
      ? `
        <section class="block">
          <h2>${escapeHtml(isPt ? 'Entregas em produção relevantes' : 'Relevant production deliveries')}</h2>
          <ul class="highlights">
            ${report.relevantEngagements
              .slice(0, 4)
              .map(
                (eng) => `
              <li>
                <strong>${escapeHtml(eng.client)}</strong>
                <span class="meta">(${escapeHtml(eng.sector)} — ${escapeHtml(eng.title)})</span>:
                ${escapeHtml(eng.scope)}
              </li>`,
              )
              .join('')}
          </ul>
        </section>`
      : ''

  const projectsBlock =
    report.relevantProjects.length > 0
      ? `
        <section class="block">
          <h2>${escapeHtml(isPt ? 'Projetos públicos relevantes' : 'Relevant public projects')}</h2>
          <ul class="highlights">
            ${report.relevantProjects
              .slice(0, 4)
              .map(
                (proj) => `
              <li>
                <strong>${escapeHtml(proj.title)}</strong>
                <span class="meta">(${escapeHtml(proj.matchedTerms.join(', '))})</span> —
                ${escapeHtml(proj.summary)}
              </li>`,
              )
              .join('')}
          </ul>
        </section>`
      : ''

  const titleText = report.roleHint
    ? `${isPt ? 'Briefing de Evidências' : 'Evidence Fit Brief'} — ${report.roleHint}`
    : `${isPt ? 'Briefing de Evidências' : 'Evidence Fit Brief'} — ${profileName}`

  return `<!doctype html>
<html lang="${isPt ? 'pt-BR' : 'en'}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(titleText)}</title>
  <style>
    @page { size: A4; margin: 15mm 16mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #f4efe6;
      color: #161412;
      font-family: "Archivo", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 10.5pt;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media print {
      html, body { background: #ffffff; }
    }
    .sheet {
      max-width: 180mm;
      margin: 0 auto;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
      border-bottom: 1.5px solid #161412;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .brand {
      font-family: "Instrument Serif", Georgia, serif;
      font-style: italic;
      font-size: 22pt;
      line-height: 1;
      letter-spacing: -0.02em;
    }
    .brand .dot { color: #e95111; }
    .eyebrow {
      font-family: "Fragment Mono", ui-monospace, monospace;
      font-size: 7.5pt;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #6b635a;
      margin-bottom: 4px;
    }
    .identity {
      text-align: right;
      font-size: 8.5pt;
      color: #4b453e;
    }
    .identity strong { color: #161412; }
    h1 {
      font-family: "Instrument Serif", Georgia, serif;
      font-weight: 400;
      font-size: 19pt;
      line-height: 1.15;
      margin: 0 0 8px 0;
      color: #161412;
    }
    .pills {
      display: flex;
      gap: 8px;
      margin-bottom: 14px;
      font-family: "Fragment Mono", ui-monospace, monospace;
      font-size: 8pt;
    }
    .pill-verified {
      background: #fbe4d8;
      color: #b83a07;
      padding: 3px 9px;
      border-radius: 999px;
    }
    .pill-gap {
      border: 1px solid #d5cdc2;
      color: #5b544c;
      padding: 2px 9px;
      border-radius: 999px;
    }
    .block {
      margin-bottom: 14px;
      break-inside: avoid;
    }
    h2 {
      font-family: "Fragment Mono", ui-monospace, monospace;
      font-size: 7.5pt;
      font-weight: 600;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #6b635a;
      border-bottom: 1px solid #dcd4c8;
      padding-bottom: 4px;
      margin: 0 0 8px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    tr { border-bottom: 1px solid #e7e0d5; }
    tr:last-child { border-bottom: 0; }
    td { padding: 5px 4px; vertical-align: top; font-size: 9.5pt; }
    td.skill {
      width: 30%;
      font-family: "Fragment Mono", ui-monospace, monospace;
      font-weight: 600;
      font-size: 8.8pt;
      color: #161412;
    }
    td.proofs { color: #3d3832; }
    ul.gaps, ul.highlights {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    ul.gaps li {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 4px 0;
      border-bottom: 1px solid #ece6dc;
      font-size: 9.2pt;
    }
    ul.gaps li:last-child { border-bottom: 0; }
    .gap-term {
      font-family: "Fragment Mono", ui-monospace, monospace;
      font-weight: 600;
      font-size: 8.8pt;
    }
    ul.highlights li {
      padding: 4px 0;
      font-size: 9.2pt;
      color: #3d3832;
    }
    ul.highlights strong { color: #161412; }
    .meta { color: #6b635a; font-size: 8.5pt; }
    .muted { color: #6b635a; font-size: 8.8pt; }
    footer {
      margin-top: 16px;
      padding-top: 8px;
      border-top: 1px solid #d5cdc2;
      display: flex;
      justify-content: space-between;
      font-family: "Fragment Mono", ui-monospace, monospace;
      font-size: 7.5pt;
      color: #6b635a;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <header>
      <div>
        <p class="eyebrow">${escapeHtml(isPt ? 'Dossiê de Evidências · /fit' : 'Evidence Fit Dossier · /fit')}</p>
        <div class="brand">mb<span class="dot">.</span></div>
      </div>
      <div class="identity">
        <div><strong>${escapeHtml(profileName)}</strong> · ${escapeHtml(role)}</div>
        <div>${escapeHtml(location)} · ${escapeHtml(email)}</div>
      </div>
    </header>

    <h1>${escapeHtml(report.roleHint || (isPt ? 'Análise de aderência por evidências' : 'Evidence-based role fit analysis'))}</h1>

    <div class="pills">
      <span class="pill-verified">${report.matched.length} ${escapeHtml(isPt ? 'comprovados' : 'verified')}</span>
      <span class="pill-gap">${report.gaps.length} ${escapeHtml(isPt ? 'fora do dossiê' : 'unlisted')}</span>
    </div>

    <section class="block">
      <h2>${escapeHtml(isPt ? 'Evidências reais verificadas' : 'Verified production & project evidence')}</h2>
      <table><tbody>${matchedRows}</tbody></table>
    </section>

    <section class="block">
      <h2>${escapeHtml(isPt ? 'Não registrado no dossiê (lacunas honestas)' : 'Not listed in public dossier (honest gaps)')}</h2>
      ${gapItems}
    </section>

    ${engagementsBlock}
    ${projectsBlock}

    <footer>
      <span>${escapeHtml(sourceUrl)}</span>
      <span>${escapeHtml(dateLabel)}</span>
    </footer>
  </div>
</body>
</html>`
}

/**
 * Triggers native browser Print / Save as PDF for the executive `/fit`
 * one-pager using a temporary hidden iframe.
 */
export function printFitBrief(
  report: FitReport,
  options: FitPrintOptions,
): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false
  try {
    const html = buildFitPrintHtml(report, {
      ...options,
      origin: options.origin ?? window.location.origin,
    })

    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    // Never allow scripts inside the print iframe (defense-in-depth alongside HTML escaping)
    iframe.setAttribute('sandbox', 'allow-modals allow-same-origin')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.style.visibility = 'hidden'
    document.body.appendChild(iframe)

    const cleanup = () => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
    }

    const fallbackTimer = window.setTimeout(cleanup, 60_000)

    iframe.onload = () => {
      const win = iframe.contentWindow
      if (!win) {
        window.clearTimeout(fallbackTimer)
        cleanup()
        return
      }
      const handleAfterPrint = () => {
        window.clearTimeout(fallbackTimer)
        win.removeEventListener('afterprint', handleAfterPrint)
        window.setTimeout(cleanup, 250)
      }
      win.addEventListener('afterprint', handleAfterPrint)
      win.focus()
      win.print()
    }

    iframe.srcdoc = html
    return true
  } catch {
    return false
  }
}
