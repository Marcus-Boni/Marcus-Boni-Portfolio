import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, describe, expect, it } from 'vitest'

import { SeoPreview } from '../src/admin/components/SeoPreview'
import { postIssues, publishChecklist } from '../src/admin/lib/health'
import { emptyPost, type MediaRef, type Post } from '../src/blog/types'

function article(changes: Partial<Post> = {}): Post {
  return {
    ...emptyPost('pt'),
    title: 'React',
    slug: 'react',
    excerpt: 'Um exemplo útil.',
    body: '## Exemplo\n\nUma resposta curta e útil. [Portfólio](/).',
    tags: ['react'],
    ...changes,
  }
}

const check = (post: Post, label: string) => publishChecklist(post).find((item) => item.label === label)!
const image: MediaRef = {
  src: 'https://example.com/diagram.webp',
  variants: [],
  lqip: '',
  width: 1200,
  height: 630,
  alt: 'Diagrama de componentes React',
}

describe('editor SEO guidance', () => {
  it('accepts a useful short article without arbitrary title, excerpt or word minimums', () => {
    expect(publishChecklist(article()).every((item) => item.ok)).toBe(true)
    expect(check(article(), 'Conteúdo escrito para responder à dúvida do leitor').hint).toContain('Não há mínimo para SEO')
    expect(check(article(), 'Título claro e específico').hint).toContain('pode reescrever')
  })

  it('warns for blank title, summary and content independently', () => {
    const post = article({ title: ' ', excerpt: '\n', body: '' })
    expect(check(post, 'Título claro e específico').ok).toBe(false)
    expect(check(post, 'Resumo específico para este artigo').ok).toBe(false)
    expect(check(post, 'Conteúdo escrito para responder à dúvida do leitor').ok).toBe(false)
  })

  it.each(['React', 'react--hooks', '-react', 'react-', 'react/hooks', 'notas-técnicas', ''])('flags a noncanonical slug: %s', (slug) => {
    expect(check(article({ slug }), 'URL legível, em minúsculas e com hífens').ok).toBe(false)
  })

  it.each(['react-hooks', 'react18', '2026-react'])('accepts a stable lowercase hyphenated slug: %s', (slug) => {
    expect(check(article({ slug }), 'URL legível, em minúsculas e com hífens').ok).toBe(true)
  })

  it('recognizes the existing default social image instead of reporting no image', () => {
    const post = article({ status: 'published' })
    expect(check(post, 'Imagem de compartilhamento disponível').ok).toBe(true)
    expect(check(post, 'Imagem de compartilhamento disponível').hint).toContain('imagem padrão')
    expect(postIssues([post])).toEqual([])
  })

  it('warns when a custom cover has no alternative description', () => {
    const post = article({ status: 'published', cover: { ...image, alt: '' } })
    expect(check(post, 'Imagem de compartilhamento disponível').ok).toBe(false)
    expect(postIssues([post])[0]?.label).toContain('capa sem texto alternativo')
  })

  it.each(['# Outro título', 'Outro título\n===', '   # Outro título'])('warns about a body H1: %s', (body) => {
    expect(check(article({ body }), 'Título principal reservado ao cabeçalho do artigo').ok).toBe(false)
  })

  it('ignores heading, image and link examples inside fenced or inline code', () => {
    const body = '## Texto\n\n```md\n# Exemplo\n![](https://example.com/image.png)\n[Outro](/blog/outro)\n```\n\n~~~md\n# Exemplo\n~~~\n\n`# Exemplo ![](media:a) [Outro](/blog/outro)`'
    const post = article({ body })
    expect(check(post, 'Título principal reservado ao cabeçalho do artigo').ok).toBe(true)
    expect(check(post, 'Imagens do corpo com descrição alternativa').ok).toBe(true)
    expect(check(post, 'Links internos úteis ao leitor').ok).toBe(false)
  })

  it('does not mistake code-only examples for article prose or sections', () => {
    const post = article({ body: '```md\n## Exemplo\nEscreva algo.\n```' })
    expect(check(post, 'Conteúdo escrito para responder à dúvida do leitor').ok).toBe(false)
    expect(check(post, 'Seções organizadas com subtítulos').ok).toBe(false)
  })

  it('uses the uploaded media alt fallback, matching the public renderer', () => {
    const post = article({ body: '## Exemplo\n\n![](media:diagram)', media: { diagram: image } })
    expect(check(post, 'Imagens do corpo com descrição alternativa').ok).toBe(true)
  })

  it('resolves uploaded alt text in reference-style Markdown images', () => {
    const post = article({ body: '![][diagram]\n\n[diagram]: media:diagram', media: { diagram: image } })
    expect(check(post, 'Imagens do corpo com descrição alternativa').ok).toBe(true)
  })

  it.each(['![](https://example.com/image.png)', '![](media:missing)', '![][diagram]\n\n[diagram]: https://example.com/image.png'])('finds images without alternative descriptions: %s', (body) => {
    expect(check(article({ body }), 'Imagens do corpo com descrição alternativa').ok).toBe(false)
  })

  it.each(['[Outro artigo](/blog/outro)', '[Portfólio](https://marcusboni.com.br/)', '[Portfólio](<https://marcusboni.com.br/>)', '[Outro artigo][outro]\n\n[outro]: /blog/outro'])('recognizes a useful internal link: %s', (body) => {
    expect(check(article({ body }), 'Links internos úteis ao leitor').ok).toBe(true)
  })

  it.each(['![Imagem](/image.png)', '[Fonte](https://example.com/)', '[Falso](https://marcusboni.com.br.example.com/)', '[Externo](//example.com/)'])('does not count an image or external site as an internal link: %s', (body) => {
    expect(check(article({ body }), 'Links internos úteis ao leitor').ok).toBe(false)
  })
})

describe('search and social preview', () => {
  const render = (changes: Partial<Post> = {}) => renderToStaticMarkup(
    createElement(SeoPreview, { post: article(changes) }),
  )

  it('renders article metadata with the canonical URL and default social image', () => {
    const html = render()
    expect(html).toContain('https://marcusboni.com.br/blog/react')
    expect(html).toContain('React — Marcus Boni')
    expect(html).toContain('https://marcusboni.com.br/og-image.jpg')
    expect(html).toContain('É uma simulação')
    expect(html).toContain('Rascunho: esta prévia é local')
  })

  it('prefers the deliberate summary and custom cover', () => {
    const html = render({ excerpt: 'Resumo específico.', body: 'Texto do corpo.', cover: image })
    expect(html).toContain('Resumo específico.')
    expect(html.includes('Texto do corpo.')).toBe(false)
    expect(html).toContain(image.src)
    expect(html).toContain(image.alt)
  })

  it('shows a plain-text body fallback when the summary is empty', () => {
    const html = render({ excerpt: '', body: '**Conteúdo** com [fonte](https://example.com).' })
    expect(html).toContain('Conteúdo com fonte.')
    expect(html).toContain('O resumo exibido foi extraído do corpo.')
  })

  it.each([
    ['unlisted', 'instrução para não indexar'],
    ['published', 'A indexação depende dos mecanismos de busca'],
  ] as const)('explains %s publication status', (status, expected) => {
    expect(render({ status })).toContain(expected)
  })
})

/** Optional local visual fixture, generated from the actual component after a build. */
afterAll(() => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const assets = path.join(root, 'dist/assets')
  if (!existsSync(assets)) return
  const stylesheet = readdirSync(assets).find((file) => file.startsWith('index-') && file.endsWith('.css'))
  if (!stylesheet) return
  const css = readFileSync(path.join(assets, stylesheet), 'utf8').replace(
    /url\(["']?([^"')]+)["']?\)/g,
    (match, url: string) => {
      if (/^(?:data:|https?:)/.test(url)) return match
      const file = path.join(assets, path.basename(url))
      if (!existsSync(file)) return match
      const mime = file.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream'
      return `url(data:${mime};base64,${readFileSync(file).toString('base64')})`
    },
  )
  const preview = createElement(SeoPreview, {
    post: article({
      title: 'Como organizar componentes React para projetos que crescem',
      slug: 'componentes-react-projetos-que-crescem',
      excerpt: 'Aprenda a separar responsabilidades, criar componentes claros e evoluir uma aplicação React com exemplos de decisões tomadas em projetos reais.',
      status: 'draft',
    }),
  })
  let markup = renderToStaticMarkup(createElement('main', {
    className: 'bg-ink-soft text-bone',
    style: { maxWidth: '1100px', margin: '32px auto', padding: '24px' },
  }, preview))
  const ogFile = path.join(root, 'public/og-image.jpg')
  if (existsSync(ogFile)) {
    markup = markup.replace('src="https://marcusboni.com.br/og-image.jpg"',
      `src="data:image/png;base64,${readFileSync(ogFile).toString('base64')}"`)
  }
  const fixtureDir = path.join(root, 'node_modules/.cache/seo-qa')
  mkdirSync(fixtureDir, { recursive: true })
  writeFileSync(path.join(fixtureDir, 'editor-preview.html'),
    `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Prévia editorial de SEO</title><style>${css}</style></head><body class="bg-ink text-bone">${markup}</body></html>`,
    'utf8')
})
