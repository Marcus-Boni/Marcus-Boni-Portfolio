import { useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Components behind the Markdown directives (see `lib/remark-blog.ts`).
 *
 * Every one of these takes plain string attributes straight from the Markdown
 * source, so each validates its own input: a mistyped YouTube id or an
 * off-domain video `src` renders a visible, harmless fallback instead of
 * injecting whatever the attribute happened to contain.
 */

/* ─── Callout ───────────────────────────────────────────────────────────── */

type CalloutTone = 'info' | 'tip' | 'warn' | 'danger'

const CALLOUT_TONES: Record<CalloutTone, { bar: string; label: string; glyph: string }> = {
  info: { bar: 'border-l-bone-dim', label: 'text-bone-dim', glyph: 'i' },
  tip: { bar: 'border-l-ember', label: 'text-ember', glyph: '*' },
  warn: { bar: 'border-l-ember', label: 'text-ember', glyph: '!' },
  danger: { bar: 'border-l-ember-deep', label: 'text-ember', glyph: 'x' },
}

const CALLOUT_TITLES: Record<CalloutTone, string> = {
  info: 'Nota',
  tip: 'Dica',
  warn: 'Atenção',
  danger: 'Cuidado',
}

export function Callout({
  type,
  title,
  children,
}: {
  type?: string
  title?: string
  children?: ReactNode
}) {
  const tone: CalloutTone =
    type === 'tip' || type === 'warn' || type === 'danger' ? type : 'info'
  const styles = CALLOUT_TONES[tone]

  return (
    <aside
      className={cn(
        'my-10 border border-line border-l-2 bg-ink-soft/50 px-5 py-4',
        styles.bar,
      )}
    >
      <p
        className={cn(
          'mb-2 flex items-center gap-2 font-mono text-[10px] tracking-[0.22em] uppercase',
          styles.label,
        )}
      >
        <span aria-hidden className="opacity-60">
          {styles.glyph}
        </span>
        {title ?? CALLOUT_TITLES[tone]}
      </p>
      <div className="callout-body text-[0.95em] leading-relaxed text-bone-dim">
        {children}
      </div>
    </aside>
  )
}

/* ─── Pull quote ────────────────────────────────────────────────────────── */

export function PullQuote({
  cite,
  children,
}: {
  cite?: string
  children?: ReactNode
}) {
  return (
    <figure className="my-14 border-y border-line py-8">
      <blockquote className="font-display text-[clamp(1.5rem,3.2vw,2.25rem)] leading-[1.25] text-bone">
        {children}
      </blockquote>
      {cite && (
        <figcaption className="mt-4 font-mono text-[11px] tracking-[0.18em] text-smoke uppercase">
          — {cite}
        </figcaption>
      )}
    </figure>
  )
}

/* ─── Gallery ───────────────────────────────────────────────────────────── */

export function Gallery({
  columns,
  children,
}: {
  columns?: string
  children?: ReactNode
}) {
  const count = columns === '3' ? 3 : 2
  // `gallery-grid` carries two CSS rules (see index.css): it flattens the
  // wrapping <p> Markdown puts around consecutive images — without it a gallery
  // written on adjacent lines becomes one paragraph, so the grid gets a single
  // child and the images stack — and it strips the figures' own margins.
  return (
    <div
      className={cn(
        'gallery-grid my-12 grid gap-3',
        count === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
      )}
    >
      {children}
    </div>
  )
}

/* ─── YouTube ───────────────────────────────────────────────────────────── */

/** YouTube ids are exactly 11 chars of `[A-Za-z0-9_-]`. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

export function YouTube({ id, title }: { id?: string; title?: string }) {
  const [playing, setPlaying] = useState(false)

  if (!id || !YOUTUBE_ID.test(id)) {
    return <DirectiveError>Vídeo do YouTube com id inválido.</DirectiveError>
  }

  // Facade pattern: until the reader clicks, this is one thumbnail — not the
  // ~1 MB of scripts and cookies a YouTube iframe pulls on sight. `nocookie`
  // keeps it out of ad targeting once it does load.
  return (
    <figure className="my-12">
      <div className="relative aspect-video overflow-hidden border border-line bg-ink-soft">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
            title={title ?? 'YouTube'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            data-cursor="view"
            className="group absolute inset-0 h-full w-full"
            aria-label={title ? `Reproduzir: ${title}` : 'Reproduzir vídeo'}
          >
            <img
              src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover opacity-70 transition-opacity duration-500 group-hover:opacity-100"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex size-16 items-center justify-center border border-bone/40 bg-ink/70 backdrop-blur transition-colors duration-300 group-hover:border-ember group-hover:bg-ember">
                <span className="ml-1 block size-0 border-y-[9px] border-l-[14px] border-y-transparent border-l-bone transition-colors group-hover:border-l-ink" />
              </span>
            </span>
          </button>
        )}
      </div>
      {title && (
        <figcaption className="mt-3 font-mono text-[11px] tracking-[0.08em] text-smoke">
          {title}
        </figcaption>
      )}
    </figure>
  )
}

/* ─── Self-hosted clip ──────────────────────────────────────────────────── */

/** Only same-origin paths and Firebase Storage URLs are embeddable. */
function isTrustedMediaUrl(src: string): boolean {
  if (src.startsWith('/')) return true
  try {
    const url = new URL(src)
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'firebasestorage.googleapis.com' ||
        url.hostname.endsWith('.firebasestorage.app'))
    )
  } catch {
    return false
  }
}

export function Video({
  src,
  poster,
  caption,
  loop,
}: {
  src?: string
  poster?: string
  caption?: string
  loop?: string
}) {
  if (!src || !isTrustedMediaUrl(src)) {
    return <DirectiveError>Vídeo com endereço inválido ou não permitido.</DirectiveError>
  }

  // Short UI clips read as animated figures: muted + loop + inline, so they
  // never hijack the page with sound.
  const isLoop = loop !== 'false'
  return (
    <figure className="my-12">
      <video
        src={src}
        poster={poster && isTrustedMediaUrl(poster) ? poster : undefined}
        controls
        muted
        playsInline
        loop={isLoop}
        preload="none"
        className="w-full border border-line bg-ink-soft"
      />
      {caption && (
        <figcaption className="mt-3 border-l border-ember/50 pl-3 font-mono text-[11px] leading-relaxed tracking-[0.08em] text-smoke">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

/* ─── GitHub repository card ────────────────────────────────────────────── */

const GH_SEGMENT = /^[A-Za-z0-9._-]{1,100}$/

export function RepoCard({
  owner,
  name,
  desc,
  lang,
}: {
  owner?: string
  name?: string
  desc?: string
  lang?: string
}) {
  if (!owner || !name || !GH_SEGMENT.test(owner) || !GH_SEGMENT.test(name)) {
    return <DirectiveError>Repositório inválido.</DirectiveError>
  }

  return (
    <a
      href={`https://github.com/${owner}/${name}`}
      target="_blank"
      rel="noreferrer"
      data-cursor="link"
      className="group my-10 flex items-start justify-between gap-6 border border-line bg-ink-soft/40 px-5 py-4 no-underline transition-colors duration-300 hover:border-ember/60"
    >
      <span className="min-w-0">
        <span className="block font-mono text-[10px] tracking-[0.22em] text-smoke uppercase">
          github · {owner}
        </span>
        <span className="mt-1.5 block truncate font-display text-2xl text-bone transition-colors duration-300 group-hover:text-ember">
          {name}
        </span>
        {desc && (
          <span className="mt-1 block text-sm leading-relaxed text-bone-dim">
            {desc}
          </span>
        )}
        {lang && (
          <span className="mt-3 inline-flex items-center gap-1 border border-line px-2 py-0.5 font-mono text-[9px] tracking-[0.18em] text-smoke uppercase">
            {lang}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className="shrink-0 font-display-italic text-2xl text-smoke transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ember"
      >
        ↗
      </span>
    </a>
  )
}

/* ─── Shared fallback ───────────────────────────────────────────────────── */

function DirectiveError({ children }: { children: ReactNode }) {
  return (
    <p className="my-8 border border-dashed border-ember/40 px-4 py-3 font-mono text-[11px] tracking-[0.1em] text-ember">
      {children}
    </p>
  )
}
