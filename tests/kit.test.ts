import { describe, expect, it } from 'vitest'

import {
  KIT_DOWNLOADS,
  KIT_PATH,
  KIT_SHELVES,
  KIT_SKILLS_COMMAND,
  kitBookmarks,
  kitHost,
  kitMarkdown,
  kitPage,
  kitTools,
  type KitLocale,
} from '../netlify/lib/kit.ts'

/**
 * The front-end kit is generated: these snapshots write the static page and
 * the downloads under `public/`, so the committed files are the assertion.
 * After editing netlify/lib/kit.ts, regenerate with
 * `pnpm exec vitest run tests/kit.test.ts -u`.
 */

const LOCALES: KitLocale[] = ['pt', 'en']

describe('front-end kit — generated files', () => {
  for (const locale of LOCALES) {
    it(`writes the ${locale} page and downloads`, async () => {
      await expect(kitPage(locale)).toMatchFileSnapshot(`../public${KIT_PATH[locale]}.html`)
      await expect(kitBookmarks(locale)).toMatchFileSnapshot(`../public${KIT_DOWNLOADS[locale].bookmarks}`)
      await expect(kitMarkdown(locale)).toMatchFileSnapshot(`../public${KIT_DOWNLOADS[locale].markdown}`)
    })
  }
})

describe('front-end kit — content', () => {
  const tools = kitTools()

  it('lists the seventeen tools of the journal entry once each, over https', () => {
    expect(tools).toHaveLength(17)
    expect(new Set(tools.map((tool) => tool.url)).size).toBe(17)
    for (const tool of tools) expect(new URL(tool.url).protocol).toBe('https:')
  })

  it('describes every tool and shelf in both languages', () => {
    for (const shelf of KIT_SHELVES) {
      expect(shelf.title.pt && shelf.title.en).toBeTruthy()
      for (const tool of shelf.tools) {
        expect(tool.description.pt.length).toBeGreaterThan(20)
        expect(tool.description.en.length).toBeGreaterThan(20)
        expect(tool.license.pt && tool.license.en).toBeTruthy()
      }
    }
  })

  for (const locale of LOCALES) {
    it(`carries every link into the ${locale} page, bookmarks and Markdown`, () => {
      const page = kitPage(locale)
      const bookmarks = kitBookmarks(locale)
      const markdown = kitMarkdown(locale)
      for (const tool of tools) {
        expect(page).toContain(`href="${tool.url}"`)
        expect(bookmarks).toContain(`<A HREF="${tool.url}">`)
        expect(markdown).toContain(`(${tool.url})`)
      }
    })
  }

  it('writes a bookmark file browsers import: one folder per shelf, balanced lists', () => {
    const file = kitBookmarks('pt')
    expect(file.startsWith('<!DOCTYPE NETSCAPE-Bookmark-file-1>')).toBe(true)
    expect(file.match(/<DT><H3>/g)).toHaveLength(KIT_SHELVES.length + 1)
    expect(file.match(/<DL><p>/g)?.length).toBe(file.match(/<\/DL><p>/g)?.length)
  })

  it('pairs the two pages with hreflang and gives each its own canonical', () => {
    for (const locale of LOCALES) {
      const page = kitPage(locale)
      expect(page).toContain(`<link rel="canonical" href="https://marcusboni.com.br${KIT_PATH[locale]}" />`)
      expect(page).toContain('hreflang="pt-BR"')
      expect(page).toContain('hreflang="en"')
      expect(page.match(/<h1\b/g)).toHaveLength(1)
    }
    expect(kitPage('pt')).toContain('<html lang="pt-BR">')
    expect(kitPage('en')).toContain('<html lang="en">')
  })

  it('shows the repository on GitHub links, where the host alone says nothing', () => {
    expect(kitHost('https://github.com/mattpocock/skills/tree/main/skills/engineering/research')).toBe(
      'github.com/mattpocock/skills',
    )
    expect(kitHost('https://www.tasteskill.dev/')).toBe('tasteskill.dev')
  })

  it('installs each skill on the list, one per line', () => {
    const lines = KIT_SKILLS_COMMAND.split('\n')
    expect(lines).toHaveLength(6)
    for (const line of lines) expect(line).toMatch(/^npx skills@latest add \S+/)
  })
})
