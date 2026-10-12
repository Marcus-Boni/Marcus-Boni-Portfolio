import { createElement as h, type ReactNode } from 'react'
// The browser entry avoids Node streams in Netlify's Deno runtime.
import { renderToStaticMarkup } from 'react-dom/server.browser'
import Markdown, { defaultUrlTransform, type Components } from 'react-markdown'
import rehypeSlug from 'rehype-slug'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'

import { remarkBlogDirectives } from '../../src/blog/lib/remark-blog.ts'
import { articleHeadings } from '../../src/blog/lib/article-headings.ts'
import { postUrl, safeImage, SITE_URL, validDate } from './blog-seo.ts'
import { escapeHtml, type EdgePost, type EdgeMedia } from './firestore.ts'

type BodyMedia = Record<string, EdgeMedia>
type DirectiveProps = { children?: ReactNode; [key: string]: unknown }

function trustedVideo(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.startsWith('//')) return undefined
  if (value.startsWith('/')) return new URL(value, SITE_URL).origin === SITE_URL ? value : undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && (url.hostname === 'firebasestorage.googleapis.com' ||
      url.hostname.endsWith('.firebasestorage.app')) ? url.href : undefined
  } catch { return undefined }
}

/** Render the same Markdown vocabulary as PostBody; raw HTML and unsafe URLs stay inert. */
export function renderMarkdown(body: string, media: BodyMedia = {}): string {
  const standard: Components = {
    p: ({ node, children }) => {
      const kids = node?.children ?? []
      const elements = kids.filter((child) => child.type === 'element')
      const imagesOnly = elements.length > 0 && !kids.some((child) => child.type === 'text' && child.value.trim()) &&
        elements.every((child) => child.tagName === 'img')
      return imagesOnly ? h('div', null, children) : h('p', null, children)
    },
    img: ({ src, alt, title }) => {
      const url = typeof src === 'string' ? src : ''
      const ref = url.startsWith('media:') ? media[url.slice(6)] : undefined
      const safe = safeImage(ref?.src ?? (url.startsWith('media:') ? undefined : url))
      const caption = title || ref?.caption
      return safe ? h('figure', null, h('img', { src: safe, alt: alt || ref?.alt || '',
        width: ref?.width && ref.width > 0 ? ref.width : undefined,
        height: ref?.height && ref.height > 0 ? ref.height : undefined,
        loading: 'lazy', decoding: 'async' }), caption ? h('figcaption', null, caption) : null) :
        h('span', null, `Imagem não encontrada: ${alt ?? ''}`)
    },
    a: ({ href, children }) => h('a', { href: href?.startsWith('media:') ? undefined : href }, children),
  }
  const directives = {
    'x-callout': ({ children, title, type }: DirectiveProps) => h('aside', null,
      h('p', null, h('strong', null, typeof title === 'string' ? title :
        type === 'tip' ? 'Dica' : type === 'warn' ? 'Atenção' : type === 'danger' ? 'Cuidado' : 'Nota')), children),
    'x-quote': ({ children, cite }: DirectiveProps) => h('figure', null,
      h('blockquote', null, children), typeof cite === 'string' ? h('figcaption', null, cite) : null),
    'x-gallery': ({ children }: DirectiveProps) => h('div', null, children),
    'x-youtube': ({ id, title }: DirectiveProps) => typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id)
      ? h('figure', null, h('a', { href: `https://www.youtube.com/watch?v=${id}` },
        h('img', { src: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, alt: typeof title === 'string' ? title : 'YouTube', loading: 'lazy' }),
        typeof title === 'string' ? title : 'YouTube')) : h('p', null, 'Vídeo do YouTube com id inválido.'),
    'x-video': ({ src, poster, caption }: DirectiveProps) => trustedVideo(src)
      ? h('figure', null, h('video', { src: trustedVideo(src), poster: trustedVideo(poster), controls: true, preload: 'none' }),
        typeof caption === 'string' ? h('figcaption', null, caption) : null)
      : h('p', null, 'Vídeo com endereço inválido ou não permitido.'),
    'x-repo': ({ owner, name, desc }: DirectiveProps) => typeof owner === 'string' && typeof name === 'string' &&
      /^[A-Za-z0-9._-]{1,100}$/.test(owner) && /^[A-Za-z0-9._-]{1,100}$/.test(name)
      ? h('p', null, h('a', { href: `https://github.com/${owner}/${name}` }, `${owner}/${name}`),
        typeof desc === 'string' ? ` — ${desc}` : null)
      : h('p', null, 'Repositório inválido.'),
  }
  return renderToStaticMarkup(h(Markdown, {
    remarkPlugins: [remarkGfm, remarkDirective, remarkBlogDirectives], rehypePlugins: [rehypeSlug, articleHeadings],
    urlTransform: (url: string) => url.startsWith('media:') ? url : defaultUrlTransform(url),
    components: { ...standard, ...directives } as Components,
    children: body,
  }))
}

// This style lives inside root and disappears when React mounts. It also keeps
// the document readable when JavaScript or the application stylesheet cannot load.
const fallbackStyle = `<style>.blog-document{max-width:72ch;margin:auto;padding:2rem 1.25rem;font-family:Archivo,system-ui,sans-serif;line-height:1.7}.blog-document nav{font-size:.9rem;margin-bottom:3rem}.blog-document h1{font-family:"Instrument Serif",Georgia,serif;font-size:clamp(2.5rem,7vw,4rem);line-height:1.08;margin-bottom:1.5rem;overflow-wrap:anywhere}.blog-document h2{font-size:1.6rem;line-height:1.3;margin:2rem 0 1rem}.blog-document h3{font-size:1.3rem;margin:1.5rem 0 .75rem}.blog-document p{margin:1rem 0}.blog-document ul,.blog-document ol{padding-left:1.5rem}.blog-document li{margin:1.5rem 0}.blog-document a{text-decoration:underline;text-underline-offset:.2em}.blog-document img,.blog-document video{max-width:100%;height:auto}.blog-document pre{overflow:auto;padding:1rem;background:#191816}.blog-document table{display:block;overflow:auto}.blog-document th,.blog-document td{padding:.5rem}.blog-document aside,.blog-document blockquote{border-left:2px solid #b85c38;padding-left:1rem;margin:1.5rem 0}.blog-document article header{margin-bottom:3rem}</style>`
const navigation = `<nav aria-label="Navegação"><a href="${SITE_URL}">Marcus Boni</a> · <a href="/blog">Blog</a> · <a href="/about">Sobre o autor</a></nav>`

/** Visible dates match the schema: publication always, revision only when it is a later day. */
function dateLine(post: EdgePost): string {
  const published = validDate(post.publishedAt)
  if (!published) return ''
  const modified = validDate(post.updatedAt)
  const revised = modified && modified.slice(0, 10) > published.slice(0, 10)
    ? ` · ${post.lang === 'pt' ? 'Atualizado em' : 'Updated'} <time datetime="${modified}">${modified.slice(0, 10)}</time>` : ''
  return ` · <time datetime="${published}">${published.slice(0, 10)}</time>${revised}`
}

export function renderArticle(post: EdgePost, body: string, media: BodyMedia): string {
  const image = safeImage(post.coverUrl)
  return `${fallbackStyle}<div class="blog-document">${navigation}<main id="main-content">
    <nav aria-label="Breadcrumb"><a href="/">Marcus Boni</a> / <a href="/blog">Blog</a> / <span aria-current="page">${escapeHtml(post.title)}</span></nav>
    <article class="post-prose"><header>
    <h1>${escapeHtml(post.title)}</h1>
    ${post.subtitle ? `<p>${escapeHtml(post.subtitle)}</p>` : ''}
    <p><a rel="author" href="/about">Marcus Boni</a>${dateLine(post)}</p>
    ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(post.coverAlt || post.title)}" fetchpriority="high" />` : ''}
    </header>${renderMarkdown(body, media)}</article><a href="/blog">Todos os artigos</a></main></div>`
}

export function renderBlogIndex(posts: EdgePost[]): string {
  return `${fallbackStyle}<div class="blog-document">${navigation}<main id="main-content"><h1>Blog de engenharia de software</h1>
    <p>Estudos, bastidores de projetos e notas técnicas de Marcus Boni.</p>
    <a href="/rss.xml">Assinar RSS</a>
    ${posts.length ? `<ul>${posts.map((post) => `<li lang="${post.lang === 'pt' ? 'pt-BR' : 'en'}"><article>
      <h2><a href="${escapeHtml(postUrl(post.slug))}">${escapeHtml(post.title)}</a></h2>
      ${validDate(post.publishedAt) ? `<p><time datetime="${validDate(post.publishedAt)}">${validDate(post.publishedAt)!.slice(0, 10)}</time></p>` : ''}
      <p>${escapeHtml(post.excerpt || post.subtitle || '')}</p>
      </article></li>`).join('\n')}</ul>` : '<p>Novos artigos em breve.</p>'}</main></div>`
}
