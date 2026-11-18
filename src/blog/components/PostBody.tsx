import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Markdown, { defaultUrlTransform, type Components } from 'react-markdown'
import rehypeSlug from 'rehype-slug'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'

import { BlogFigure } from '@/blog/components/BlogImage'
import { CodeBlock, InlineCode } from '@/blog/components/CodeBlock'
import {
  Callout,
  Gallery,
  MarginNote,
  PullQuote,
  RepoCard,
  Takeaways,
  Video,
  YouTube,
} from '@/blog/components/directives'
import { Step, Steps, StepsNotes, StepsPane, StepsStage } from '@/blog/components/steps'
import { articleHeadings } from '@/blog/lib/article-headings'
import { BodyContext, useBodyLabels } from '@/blog/lib/body-context'
import { rehypeSidenotes } from '@/blog/lib/rehype-sidenotes'
import { remarkBlogDirectives } from '@/blog/lib/remark-blog'
import type { MediaRef } from '@/blog/types'
import { translations, type Locale } from '@/i18n/translations'

interface PostBodyProps {
  markdown: string
  /** Uploaded images keyed by id, referenced as `![alt](media:{id})`. */
  media?: Record<string, MediaRef>
  /** Language the post was written in; the labels inside the body follow it. */
  lang?: Locale
  /** The page around the body has a margin column for notes and wide blocks. */
  margin?: boolean
}

/** Plugin arrays are stable module constants so react-markdown can memoise. */
const REMARK_PLUGINS = [remarkGfm, remarkDirective, remarkBlogDirectives]
const REHYPE_PLUGINS = [rehypeSlug, articleHeadings, rehypeSidenotes]

/**
 * `media:` is our own scheme for images uploaded through the admin — it is
 * resolved to a real `MediaRef` by the `img` component below. react-markdown's
 * default sanitiser only allows http/https/mailto/tel and rewrites anything
 * else to an empty string, which would silently blank every uploaded image.
 * Everything that is *not* `media:` still goes through that sanitiser, so
 * `javascript:` and friends stay blocked.
 */
function urlTransform(url: string): string {
  return url.startsWith('media:') ? url : defaultUrlTransform(url)
}

/**
 * Renders a post's Markdown.
 *
 * `react-markdown` never evaluates raw HTML (there is no `rehype-raw` here, on
 * purpose), so a post body cannot inject markup even though the admin is the
 * only author. Every rich embed goes through a typed directive component.
 */
export function PostBody({ markdown, media, lang = 'pt', margin = false }: PostBodyProps) {
  const components = useMemo(() => buildComponents(media ?? {}), [media])
  const environment = useMemo(() => ({ lang, margin }), [lang, margin])
  // Names the list of notes that could not move to the margin (see
  // `rehypeSidenotes`); a note made of plain text never reaches it.
  const footnotes = useMemo(
    () => ({
      footnoteLabel: translations[lang].blog.body.notes,
      footnoteLabelProperties: { className: ['sr-only'] },
    }),
    [lang],
  )

  return (
    <BodyContext value={environment}>
      <div className="post-prose">
        <Markdown
          remarkPlugins={REMARK_PLUGINS}
          rehypePlugins={REHYPE_PLUGINS}
          remarkRehypeOptions={footnotes}
          urlTransform={urlTransform}
          components={components}
        >
          {markdown}
        </Markdown>
      </div>
    </BodyContext>
  )
}

/**
 * A section title that carries its own address. On an `h2` the link is the
 * section number (drawn by a CSS counter, so it always matches the rail and
 * the index); on an `h3` it is a small mark after the text. Following it puts
 * the section in the URL and copies that URL.
 */
function ArticleHeading({
  level: Tag,
  id,
  children,
}: {
  level: 'h2' | 'h3'
  id?: string
  children?: ReactNode
}) {
  const labels = useBodyLabels()
  const [copied, setCopied] = useState(false)
  const timeout = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timeout.current), [])

  if (!id) return <Tag>{children}</Tag>

  const copy = () => {
    navigator.clipboard
      ?.writeText(`${location.origin}${location.pathname}#${id}`)
      .then(() => {
        setCopied(true)
        timeout.current = window.setTimeout(() => setCopied(false), 1800)
      })
      .catch(() => {
        /* clipboard unavailable — the address bar still has the link */
      })
  }

  const anchor = (
    <a href={`#${id}`} className="heading-anchor" aria-label={labels.sectionLink} onClick={copy}>
      {Tag === 'h3' && (
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M6 8.2a2.8 2.8 0 0 0 4 0l1.8-1.8a2.8 2.8 0 0 0-4-4l-.8.8" />
          <path d="M8 5.8a2.8 2.8 0 0 0-4 0L2.2 7.6a2.8 2.8 0 0 0 4 4l.8-.8" />
        </svg>
      )}
      <span className="heading-copied" aria-live="polite">
        {copied ? labels.copied : ''}
      </span>
    </a>
  )

  return (
    <Tag id={id}>
      {Tag === 'h2' && anchor}
      {children}
      {Tag === 'h3' && anchor}
    </Tag>
  )
}

function buildComponents(media: Record<string, MediaRef>): Components {
  // Annotated so TypeScript infers each handler's props from react-markdown.
  const standard: Components = {
    /* Block vs inline code is decided by the language class or an embedded
       newline, matching how react-markdown v10 reports fences. */
    code({ node, className, children, ...props }) {
      const text = String(children ?? '')
      const match = /language-(\w+)/.exec(className ?? '')
      const isBlock = Boolean(match) || text.includes('\n')

      if (!isBlock) return <InlineCode {...props}>{children}</InlineCode>

      // `mdast-util-to-hast` parks the fence meta (```ts title="x") here.
      const meta = (node?.data as { meta?: string } | undefined)?.meta
      return (
        <CodeBlock code={text.replace(/\n$/, '')} lang={match?.[1]} meta={meta} />
      )
    },

    h2({ id, children }) {
      return (
        <ArticleHeading level="h2" id={id}>
          {children}
        </ArticleHeading>
      )
    },

    h3({ id, children }) {
      return (
        <ArticleHeading level="h3" id={id}>
          {children}
        </ArticleHeading>
      )
    },

    /* `pre` is unwrapped: CodeBlock renders its own figure and pre, and the
       default wrapper would nest one inside the other. */
    pre({ children }) {
      return <>{children}</>
    },

    /* Markdown wraps a standalone image in a paragraph, but `img` below renders
       a <figure>, and <figure>/<figcaption> inside <p> is invalid — the browser
       silently closes the paragraph early and splits the DOM, which breaks both
       the prose rhythm and the gallery grid. When a paragraph holds nothing but
       images, drop the wrapper. */
    p({ node, children }) {
      const kids = node?.children ?? []
      const elements = kids.filter((child) => child.type === 'element')
      const hasText = kids.some(
        (child) => child.type === 'text' && child.value.trim() !== '',
      )
      const imagesOnly =
        elements.length > 0 &&
        !hasText &&
        elements.every((child) => child.tagName === 'img')

      return imagesOnly ? <>{children}</> : <p>{children}</p>
    },

    img({ src, alt, title }) {
      const url = typeof src === 'string' ? src : ''
      if (url.startsWith('media:')) {
        const resolved = media[url.slice('media:'.length)]
        if (resolved) {
          return (
            <BlogFigure
              media={{
                ...resolved,
                alt: alt || resolved.alt,
                caption: title || resolved.caption,
              }}
            />
          )
        }
        return (
          <span className="my-8 block border border-dashed border-ember/40 px-4 py-3 font-mono text-[11px] text-ember">
            Imagem nao encontrada: {url}
          </span>
        )
      }
      // External image — no known dimensions, so no blur-up and no CLS budget.
      return (
        <img
          src={url}
          alt={alt ?? ''}
          title={title}
          loading="lazy"
          decoding="async"
          className="my-10 w-full border border-line"
        />
      )
    },

    a({ href, children, ...props }) {
      const url = typeof href === 'string' ? href : ''
      const external = /^https?:\/\//.test(url)
      return (
        <a
          href={url}
          data-cursor="link"
          {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
          {...props}
        >
          {children}
        </a>
      )
    },

    /* Tables scroll inside their own container so a wide one never makes the
       page scroll horizontally. */
    table({ children }) {
      return (
        <div className="my-10 overflow-x-auto border border-line">
          <table className="w-full border-collapse text-sm">{children}</table>
        </div>
      )
    },

  }

  /* Directive elements produced by `remarkBlogDirectives`. Their keys are
     custom element names, which `Components` types as known HTML tags only —
     react-markdown resolves them by tagName at runtime, so the cast is
     confined to this object and leaves the handlers above fully typed. */
  const directives = {
    'x-callout': Callout,
    'x-quote': PullQuote,
    'x-gallery': Gallery,
    'x-youtube': YouTube,
    'x-video': Video,
    'x-repo': RepoCard,
    'x-takeaways': Takeaways,
    'x-steps': Steps,
    'x-steps-stage': StepsStage,
    'x-steps-pane': StepsPane,
    'x-steps-notes': StepsNotes,
    'x-step': Step,
    // Not a directive: `rehypeSidenotes` swaps a footnote reference for it.
    'x-note': MarginNote,
  }

  return { ...standard, ...directives } as unknown as Components
}
