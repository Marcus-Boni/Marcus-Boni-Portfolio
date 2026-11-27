import { motion } from 'framer-motion'
import { useState } from 'react'

import { printFitBrief } from '@/agent/print-brief'
import {
  buildShareableAskUrl,
  downloadMarkdownFile,
  slugifyBriefFilename,
} from '@/agent/share'
import type { AgentLens, FitReport } from '@/agent/types'
import { useSiteContent } from '@/content/SiteContentContext'
import { useLanguage } from '@/i18n/LanguageContext'
import { trackEvent } from '@/lib/analytics'

import {
  IconArrowUpRight,
  IconCheck,
  IconCopy,
  IconDownload,
  IconLink,
  IconPrinter,
} from './icons'

const EASE_OUT = [0.23, 1, 0.32, 1] as const

function safeExternalHref(raw: string): string {
  try {
    const parsed = new URL(raw)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : '#'
  } catch {
    return '#'
  }
}

/**
 * Refined Signal & Ink evidence ledger for `/fit` role matching.
 *
 * Clean rounded-2xl surface, calm hierarchy, zero fake percentage gauges:
 * pairs each matched skill with concrete production/project evidence and lists
 * gaps transparently alongside adjacent experience. Includes 1-click Markdown
 * copy, `.md` download, and shareable deep-link export.
 */
export function FitReportView({
  report,
  sourcePrompt,
  lens = 'recruiter',
  onNavigateInternal,
}: {
  report: FitReport
  sourcePrompt?: string
  lens?: AgentLens
  onNavigateInternal?: (href: string) => void
}) {
  const { locale, t } = useLanguage()
  const { content } = useSiteContent()
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const copyBrief = async () => {
    try {
      await navigator.clipboard.writeText(report.markdownBrief)
      setCopied(true)
      trackEvent('agent_share', { kind: 'fit_markdown' })
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      setCopied(false)
    }
  }

  const downloadBrief = () => {
    const filename = slugifyBriefFilename(report.roleHint)
    if (downloadMarkdownFile(filename, report.markdownBrief)) {
      trackEvent('agent_share', { kind: 'fit_download' })
    }
  }

  const handlePrintPdf = () => {
    const ok = printFitBrief(report, {
      locale,
      profileName: content.profile.name,
      role: content.profile.role,
      location: content.profile.location,
      email: content.profile.email,
    })
    if (ok) {
      trackEvent('agent_share', { kind: 'fit_print' })
    }
  }

  const copyShareLink = async () => {
    if (!sourcePrompt) return
    try {
      const url = buildShareableAskUrl({ locale, lens, prompt: sourcePrompt })
      await navigator.clipboard.writeText(url)
      setLinkCopied(true)
      trackEvent('agent_share', { kind: 'fit_link' })
      window.setTimeout(() => setLinkCopied(false), 2200)
    } catch {
      setLinkCopied(false)
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 6, filter: 'blur(3px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.32, ease: EASE_OUT }}
      aria-label={t.agent.fit.heading}
      className="mt-4 overflow-hidden rounded-2xl border border-line bg-ink-soft/60"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/80 px-4 py-3.5">
        <div className="min-w-0">
          <h3 className="font-display text-xl leading-tight text-bone">
            {report.roleHint || t.agent.fit.heading}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[11px] tabular-nums">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ember/14 px-2.5 py-0.5 text-ember">
              {report.matched.length} {t.agent.fit.verifiedShort}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-smoke">
              {report.gaps.length} {t.agent.fit.gapsShort}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => void copyBrief()}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-ink px-3 font-mono text-[11px] text-bone-dim transition-colors hover:border-ember hover:text-bone focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember"
          >
            {copied ? (
              <>
                <IconCheck className="size-3.5 text-ember" />
                <span className="text-bone">{t.agent.fit.copiedBrief}</span>
              </>
            ) : (
              <>
                <IconCopy className="size-3.5" />
                <span>{t.agent.fit.copyBrief}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={downloadBrief}
            aria-label={t.agent.fit.downloadBrief}
            title={t.agent.fit.downloadBrief}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-ink px-3 font-mono text-[11px] text-bone-dim transition-colors hover:border-ember hover:text-bone focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember"
          >
            <IconDownload className="size-3.5" />
            <span className="hidden sm:inline">{t.agent.fit.downloadBrief}</span>
          </button>

          <button
            type="button"
            onClick={handlePrintPdf}
            aria-label={t.agent.fit.printPdf}
            title={t.agent.fit.printPdf}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-ink px-3 font-mono text-[11px] text-bone-dim transition-colors hover:border-ember hover:text-bone focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember"
          >
            <IconPrinter className="size-3.5" />
            <span className="hidden sm:inline">{t.agent.fit.printPdf}</span>
          </button>

          {sourcePrompt && (
            <button
              type="button"
              onClick={() => void copyShareLink()}
              aria-label={t.agent.fit.shareLink}
              title={t.agent.fit.shareLink}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-ink px-3 font-mono text-[11px] text-bone-dim transition-colors hover:border-ember hover:text-bone focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember"
            >
              {linkCopied ? (
                <>
                  <IconCheck className="size-3.5 text-ember" />
                  <span className="text-bone">{t.agent.fit.copiedLink}</span>
                </>
              ) : (
                <>
                  <IconLink className="size-3.5" />
                  <span className="hidden sm:inline">{t.agent.fit.shareLink}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="divide-y divide-line/80">
        <div className="px-4 py-3.5">
          <p className="font-mono text-[10px] tracking-[0.18em] text-smoke uppercase">
            {t.agent.fit.verifiedLabel}
          </p>

          {report.matched.length === 0 ? (
            <p className="mt-2 text-xs text-smoke">{t.agent.fit.noMatches}</p>
          ) : (
            <ul className="mt-2.5 divide-y divide-line/60" role="list">
              {report.matched.map((item) => (
                <li
                  key={item.skill}
                  className="grid gap-1.5 py-2 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:items-baseline"
                >
                  <span className="font-mono text-xs font-medium text-bone">
                    {item.skill}
                  </span>
                  <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-bone-dim">
                    {item.proofs.map((proof, idx) =>
                      proof.external ? (
                        <a
                          key={idx}
                          href={safeExternalHref(proof.href)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 underline decoration-line underline-offset-4 transition-colors hover:text-ember hover:decoration-ember"
                        >
                          <span>{proof.label}</span>
                          <IconArrowUpRight className="size-3 shrink-0" />
                        </a>
                      ) : (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => onNavigateInternal?.(proof.href)}
                          className="inline-flex items-center gap-1 text-left underline decoration-line underline-offset-4 transition-colors hover:text-ember hover:decoration-ember"
                        >
                          <span>{proof.label}</span>
                        </button>
                      ),
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-4 py-3.5">
          <p className="font-mono text-[10px] tracking-[0.18em] text-smoke uppercase">
            {t.agent.fit.gapsLabel}
          </p>

          {report.gaps.length === 0 ? (
            <p className="mt-2 text-xs text-bone-dim">{t.agent.fit.noGaps}</p>
          ) : (
            <ul className="mt-2.5 space-y-2" role="list">
              {report.gaps.map((gap) => (
                <li
                  key={gap.term}
                  className="flex flex-wrap items-baseline justify-between gap-2 text-xs"
                >
                  <span className="font-mono text-bone">
                    {gap.term}
                    {gap.academic && (
                      <span className="ml-2 font-sans text-smoke">· {t.agent.fit.academicOnly}</span>
                    )}
                  </span>
                  {gap.adjacent.length > 0 && (
                    <span className="text-smoke">
                      {t.agent.fit.adjacentPrefix}:{' '}
                      <span className="text-bone-dim">
                        {gap.adjacent.join(', ')}
                      </span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </motion.section>
  )
}
