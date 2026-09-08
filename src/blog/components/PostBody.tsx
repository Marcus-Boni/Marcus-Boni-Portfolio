import { useMemo } from 'react'
import Markdown, { defaultUrlTransform, type Components } from 'react-markdown'
import rehypeSlug from 'rehype-slug'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'

import { BlogFigure } from '@/blog/components/BlogImage'
import { CodeBlock, InlineCode } from '@/blog/components/CodeBlock'
import {
  Callout,
  Gallery,
  PullQuote,
  RepoCard,
  Video,
  YouTube,
} from '@/blog/components/directives'
import { remarkBlogDirectives } from '@/blog/lib/remark-blog'
import type { MediaRef } from '@/blog/types'

interface PostBodyProps {
  markdown: string
  /** Uploaded images keyed by id, referenced as `![alt](media:{id})`. */
  media?: Record<string, MediaRef>
}

/** Plugin arrays are stable module constants so react-markdown can memoise. */
const REMARK_PLUGINS = [remarkGfm, remarkDirective, remarkBlogDirectives]
const REHYPE_PLUGINS = [rehypeSlug]

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
export function PostBody({ markdown, media }: PostBodyProps) {
  const components = useMemo(() => buildComponents(media ?? {}), [media])

  return (
    <div className="post-prose">
      <Markdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        urlTransform={urlTransform}
        components={components}
      >
        {markdown}
      </Markdown>
    </div>
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
  }

  return { ...standard, ...directives } as unknown as Components
}
