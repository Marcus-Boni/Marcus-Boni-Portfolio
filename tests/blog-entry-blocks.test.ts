import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { PostBody } from '@/blog/components/PostBody'
import { parseFenceMeta, parseLineRanges } from '@/blog/lib/code-meta'
import { locateQuote, parseQuoteHash, quoteHash } from '@/blog/lib/quote-link'
import { readingProgress, rememberProgress } from '@/blog/lib/reading-memory'
import { extractToc } from '@/blog/lib/text'

const render = (markdown: string, lang: 'pt' | 'en' = 'pt') =>
  renderToStaticMarkup(createElement(PostBody, { markdown, lang }))

describe('code fence meta', () => {
  it('expands line lists and ranges, ignoring what is not a number', () => {
    expect([...parseLineRanges('1,3-5')]).toEqual([1, 3, 4, 5])
    expect([...parseLineRanges('x, 2 - 3, -4, 0')]).toEqual([2, 3])
    expect(parseLineRanges('1-999999').size).toBeLessThan(500)
  })

  it('reads title, marks, diff and flags without one leaking into another', () => {
    const meta = parseFenceMeta('title="src/wrap numbers.ts" {2,4-5} add={7} del={6} numbers')
    expect(meta.title).toBe('src/wrap numbers.ts')
    expect([...meta.marked]).toEqual([2, 4, 5])
    expect([...meta.added]).toEqual([7])
    expect([...meta.removed]).toEqual([6])
    expect(meta.numbers).toBe(true)
    // "wrap" appears only inside the title.
    expect(meta.wrap).toBe(false)
    expect(parseFenceMeta(undefined).marked.size).toBe(0)
  })

  it('renders every line as its own element and marks the requested ones', () => {
    const html = render('```ts {2} add={3} numbers\nconst a = 1\nconst b = 2\nconst c = 3\n```')
    expect(html.match(/class="line/g)).toHaveLength(3)
    expect(html).toContain('<span class="line is-marked">const b = 2\n</span>')
    expect(html).toContain('<span class="line is-added">const c = 3\n</span>')
    expect(html).toContain('has-numbers')
    expect(html).toContain('has-diff')
  })
})

describe('margin notes', () => {
  const body = 'Uma frase.[^a] Outra frase.[^b]\n\n[^a]: Nota **simples**.\n[^b]: Nota com lista:\n    - item'

  it('moves a plain footnote beside its sentence and keeps a complex one in the list', () => {
    const html = render(body)
    // The simple note travels with its sentence…
    expect(html).toMatch(/Uma frase\.<span class="note">.*role="note".*Nota <strong>simples<\/strong>\./s)
    expect(html).toContain('aria-label="Nota 1"')
    // …and the one holding a list still has a standard reference to follow.
    expect(html).toContain('data-footnote-ref')
    expect(html.match(/<li id="user-content-fn-/g)).toHaveLength(1)
  })

  it('drops the footnote list once every note has moved', () => {
    const html = render('Texto.[^a]\n\n[^a]: Só esta.')
    expect(html).not.toContain('data-footnotes')
    expect(html).not.toContain('data-footnote-backref')
  })

  it('labels notes in the language of the post', () => {
    expect(render('Text.[^a]\n\n[^a]: Note.', 'en')).toContain('aria-label="Note 1"')
  })
})

describe('walkthrough', () => {
  const body = [
    '::::steps',
    '```ts',
    'const a = 1',
    'const b = 2',
    '```',
    '',
    ':::step{lines=1}',
    'Primeiro.',
    ':::',
    '',
    ':::step{lines=2}',
    '```ts',
    'const c = 3',
    '```',
    'Segundo.',
    ':::',
    '::::',
  ].join('\n')

  it('separates what is pinned from the steps and numbers the steps', () => {
    const html = render(body)
    expect(html.match(/class="steps-pane"/g)).toHaveLength(2)
    expect(html.match(/<li class="step"/g)).toHaveLength(2)
    expect(html).toContain('Passo 1 de 2')
    expect(html).toContain('Linha 2')
    // The stage comes first in the document, the steps after it.
    expect(html.indexOf('steps-stage')).toBeLessThan(html.indexOf('steps-notes'))
    // The second step's own fence left the step for the stage.
    expect(html).toMatch(/<li class="step"[^>]*>(?:(?!<pre).)*Segundo\./s)
  })

  it('opens on the first step, with its lines lit', () => {
    const html = render(body)
    expect(html).toContain('<span class="line is-marked">const a = 1\n</span>')
    expect(html).toContain('<span class="line">const b = 2\n</span>')
    expect(html).toMatch(/<li class="step" data-current="true" aria-current="step">/)
  })

  it('reads as code followed by an ordered list in the server document', async () => {
    // The edge modules read their configuration from Deno at import time.
    vi.stubGlobal('Deno', { env: { get: () => 'demo' } })
    const { renderMarkdown } = await import('../netlify/lib/blog-html.ts')
    const html = renderMarkdown(`${body}\n\n:::takeaways\n- Ideia.\n:::`)
    expect(html).toMatch(/<pre>.*const a = 1.*<\/pre>.*<ol><li>.*Primeiro\./s)
    expect(html).toContain('<strong>Em resumo</strong>')
    expect(html).not.toContain(':::')
  })
})

describe('key ideas and section links', () => {
  it('renders the takeaways block with a label in the language of the post', () => {
    expect(render(':::takeaways\n- Uma ideia.\n:::')).toContain('aria-label="Em resumo"')
    expect(render(':::takeaways\n- An idea.\n:::', 'en')).toContain('aria-label="In short"')
  })

  it('gives each section title a link to itself without changing its id', () => {
    const html = render('## Primeira seção\n\n### Detalhe')
    expect(html).toContain('<h2 id="primeira-seção"><a href="#primeira-seção" class="heading-anchor"')
    expect(html).toContain('<h3 id="detalhe">Detalhe<a href="#detalhe" class="heading-anchor"')
  })

  it('times each section from its title to the next', () => {
    const long = Array.from({ length: 450 }, () => 'palavra').join(' ')
    const toc = extractToc(`## Curta\n\nPouco texto.\n\n### Sub\n\n## Longa\n\n${long}`)
    expect(toc.map((entry) => [entry.text, entry.minutes])).toEqual([
      ['Curta', 1],
      ['Sub', undefined],
      ['Longa', 2],
    ])
  })
})

describe('quote links', () => {
  it('carries a short passage whole and a long one by its edges', () => {
    expect(parseQuoteHash(quoteHash('uma frase curta & direta'))).toEqual({
      start: 'uma frase curta & direta',
      end: null,
    })
    const long = 'um dois três quatro cinco seis sete oito nove dez\n\nonze doze treze catorze quinze dezesseis dezessete dezoito dezenove vinte'
    expect(parseQuoteHash(quoteHash(long))).toEqual({
      start: 'um dois três quatro cinco seis sete oito',
      end: 'treze catorze quinze dezesseis dezessete dezoito dezenove vinte',
    })
  })

  it('does not mistake a heading anchor for a quote', () => {
    expect(parseQuoteHash('#o-problema-de-partida')).toBeNull()
    expect(parseQuoteHash('')).toBeNull()
  })

  it('finds a passage whatever the spacing between its words', () => {
    // Text read from the DOM: no space where one element ends and the next begins.
    const text = 'Antes.A melhor parte (de longe)foi parar  de\nperguntar.Depois.'
    const quote = { start: 'A melhor parte (de longe) foi', end: 'parar de perguntar.' }
    const found = locateQuote(text, quote)
    expect(found && text.slice(...found)).toBe('A melhor parte (de longe)foi parar  de\nperguntar.')
    expect(locateQuote(text, { start: 'não está aqui', end: null })).toBeNull()
  })
})

describe('reading memory', () => {
  it('keeps the latest position and never un-reads a finished entry', () => {
    rememberProgress('um-registro', 40)
    expect(readingProgress('um-registro')).toBe(40)
    rememberProgress('um-registro', 25)
    expect(readingProgress('um-registro')).toBe(25)
    rememberProgress('um-registro', 95)
    expect(readingProgress('um-registro')).toBe(100)
    rememberProgress('um-registro', 10)
    expect(readingProgress('um-registro')).toBe(100)
    expect(readingProgress('nunca-aberto')).toBe(0)
  })
})
