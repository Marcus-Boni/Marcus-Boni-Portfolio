/**
 * The front-end kit: the sixteen tools of the journal entry "Minha caixa de
 * ferramentas de front-end", as one page and three downloads.
 *
 * This list is the single source. `tests/kit.test.ts` renders it into the
 * static files under `public/` with `toMatchFileSnapshot`, so the committed
 * files *are* the assertion: edit a tool here without regenerating and the
 * suite fails (regenerate with `pnpm exec vitest run tests/kit.test.ts -u`).
 * `agents.ts` serves `kitMarkdown` as the Markdown twin of the page.
 *
 * Pure module: no Deno globals, no I/O, nothing from `src/`.
 */

export type KitLocale = 'pt' | 'en'

type Localized = Record<KitLocale, string>

export interface KitTool {
  name: string
  url: string
  description: Localized
  license: Localized
}

export interface KitShelf {
  id: string
  title: Localized
  tools: KitTool[]
}

const SITE_URL = 'https://marcusboni.com.br'
const MIT = { pt: 'MIT', en: 'MIT' }

export const KIT_PATH: Record<KitLocale, string> = { pt: '/kit/front-end', en: '/en/kit/front-end' }
export const KIT_ENTRY: Record<KitLocale, string> = {
  pt: '/blog/caixa-de-ferramentas-front-end',
  en: '/en/blog/caixa-de-ferramentas-front-end',
}
export const KIT_DOWNLOADS: Record<KitLocale, { bookmarks: string; markdown: string }> = {
  pt: {
    bookmarks: '/kit/downloads/kit-front-end-favoritos.html',
    markdown: '/kit/downloads/kit-front-end.md',
  },
  en: {
    bookmarks: '/kit/downloads/front-end-kit-bookmarks.html',
    markdown: '/kit/downloads/front-end-kit.md',
  },
}
/** When the links and licenses were last checked against their own pages. */
export const KIT_CHECKED = '2026-11-18'

export const KIT_SHELVES: KitShelf[] = [
  {
    id: 'base',
    title: { pt: 'A base', en: 'The base' },
    tools: [
      {
        name: 'shadcn/ui',
        url: 'https://ui.shadcn.com/',
        description: {
          pt: 'Componentes base copiados para dentro do projeto, e o registro pelo qual as coleções abaixo se instalam.',
          en: 'Base components copied into your project, and the registry the collections below install through.',
        },
        license: MIT,
      },
    ],
  },
  {
    id: 'colecoes',
    title: { pt: 'Coleções de componentes', en: 'Component collections' },
    tools: [
      {
        name: 'React Bits',
        url: 'https://www.reactbits.dev/get-started/introduction',
        description: {
          pt: 'Mais de duzentos componentes animados de texto, fundo e interface, em JS ou TS, CSS ou Tailwind.',
          en: 'Over two hundred animated text, background and interface components, in JS or TS, CSS or Tailwind.',
        },
        license: { pt: 'MIT + Commons Clause', en: 'MIT + Commons Clause' },
      },
      {
        name: 'Skiper UI',
        url: 'https://skiper-ui.com/components',
        description: {
          pt: 'Interações de rolagem e de cursor: barras de progresso, textos que se revelam, pilhas de cartões.',
          en: 'Scroll and cursor interactions: progress bars, text that reveals itself, stacks of cards.',
        },
        license: { pt: 'Gratuita com atribuição', en: 'Free with attribution' },
      },
      {
        name: 'Componentry',
        url: 'https://componentry.dev/docs',
        description: {
          pt: 'Código editável focado em scroll, tipografia cinética e efeitos WebGL.',
          en: 'Editable source focused on scroll, kinetic typography and WebGL effects.',
        },
        license: MIT,
      },
      {
        name: 'KokonutUI',
        url: 'https://kokonutui.com/docs/ai/ai-token-alternatives',
        description: {
          pt: 'Componentes para produtos de IA: seletor de modelo, chamadas de ferramenta, citações, alternativas de token.',
          en: 'Components for AI products: model selector, tool calls, citations, token alternatives.',
        },
        license: MIT,
      },
      {
        name: 'Bklit UI',
        url: 'https://bklit.com/',
        description: {
          pt: 'Gráficos em React com d3 e Motion, da área e da barra ao Sankey e ao mapa coroplético.',
          en: 'React charts on d3 and Motion, from area and bar charts to Sankey and choropleth maps.',
        },
        license: MIT,
      },
    ],
  },
  {
    id: 'movimento',
    title: { pt: 'Movimento', en: 'Motion' },
    tools: [
      {
        name: 'GSAP',
        url: 'https://gsap.com/',
        description: {
          pt: 'Linhas do tempo e animação presa à rolagem com o ScrollTrigger. Gratuito por inteiro, plugins inclusos.',
          en: 'Timelines and scroll-bound animation with ScrollTrigger. Entirely free, plugins included.',
        },
        license: { pt: 'Gratuita, licença própria', en: 'Free, own license' },
      },
      {
        name: 'Lenis',
        url: 'https://lenis.dev/',
        description: {
          pt: 'Rolagem suave que mantém a do navegador: sticky e barra de rolagem continuam funcionando.',
          en: "Smooth scrolling that keeps the browser's own: sticky positioning and the scrollbar still work.",
        },
        license: MIT,
      },
      {
        name: 'Motion',
        url: 'https://motion.dev/docs',
        description: {
          pt: 'O antigo Framer Motion: entrada, saída, layout e gestos a partir do estado do React.',
          en: 'The former Framer Motion: enter, exit, layout and gestures driven by React state.',
        },
        license: MIT,
      },
      {
        name: 'Anime.js',
        url: 'https://animejs.com/documentation/',
        description: {
          pt: 'Motor de animação modular em JavaScript puro, para páginas sem framework.',
          en: 'A modular animation engine in plain JavaScript, for pages with no framework.',
        },
        license: MIT,
      },
    ],
  },
  {
    id: '3d',
    title: { pt: 'Terceira dimensão', en: 'The third dimension' },
    tools: [
      {
        name: 'Three.js',
        url: 'https://github.com/mrdoob/three.js/',
        description: {
          pt: '3D no navegador com WebGL e WebGPU: modelos glTF, cenas, luz e shaders.',
          en: '3D in the browser with WebGL and WebGPU: glTF models, scenes, lighting and shaders.',
        },
        license: MIT,
      },
    ],
  },
  {
    id: 'skills',
    title: { pt: 'Skills para o agente', en: 'Skills for the agent' },
    tools: [
      {
        name: 'Impeccable',
        url: 'https://impeccable.style/docs/impeccable/',
        description: {
          pt: 'Vocabulário de design para o agente, com revisão, polimento e um detector de interface genérica.',
          en: 'A design vocabulary for the agent, with review, polish and a detector for generic interfaces.',
        },
        license: { pt: 'Apache 2.0', en: 'Apache 2.0' },
      },
      {
        name: 'Taste Skill',
        url: 'https://www.tasteskill.dev/',
        description: {
          pt: 'Direção de arte para o agente que cria um site do zero, com referências e conferência no navegador.',
          en: 'Art direction for an agent building a site from scratch, with references and an in-browser check.',
        },
        license: MIT,
      },
      {
        name: 'emilkowalski/skills',
        url: 'https://github.com/emilkowalski/skills',
        description: {
          pt: 'Dezenove skills de animação de interface: criar, revisar, remover e otimizar movimento.',
          en: 'Nineteen interface animation skills: build, review, remove and optimise motion.',
        },
        license: MIT,
      },
    ],
  },
  {
    id: 'pesquisa',
    title: { pt: 'Pesquisa da marca', en: 'Brand research' },
    tools: [
      {
        name: 'research',
        url: 'https://github.com/mattpocock/skills/tree/main/skills/engineering/research',
        description: {
          pt: 'Skill do Matt Pocock que investiga em fontes primárias e salva o resultado, citado, no repositório.',
          en: "Matt Pocock's skill that investigates primary sources and saves a cited result in the repository.",
        },
        license: MIT,
      },
      {
        name: 'Firecrawl',
        url: 'https://www.firecrawl.dev/',
        description: {
          pt: 'Lê sites para o agente e extrai a identidade visual: paleta, fontes, logo e captura de tela.',
          en: 'Reads sites for the agent and extracts the visual identity: palette, fonts, logo and screenshot.',
        },
        license: { pt: 'AGPL-3.0', en: 'AGPL-3.0' },
      },
    ],
  },
]

/**
 * One paste in a terminal installs the skills on the list. Separate lines
 * rather than `&&`, which Windows PowerShell 5.1 does not parse.
 */
export const KIT_SKILLS_COMMAND = [
  'npx skills@latest add pbakaus/impeccable',
  'npx skills@latest add Leonxlnx/taste-skill',
  'npx skills@latest add emilkowalski/skills',
  'npx skills@latest add mattpocock/skills --skill research',
  'npx skills@latest add firecrawl/skills',
].join('\n')

export const kitTools = (): KitTool[] => KIT_SHELVES.flatMap((shelf) => shelf.tools)

/** `ui.shadcn.com`, or `github.com/owner/repo` where the host alone says nothing. */
export function kitHost(url: string): string {
  const { hostname, pathname } = new URL(url)
  const host = hostname.replace(/^www\./, '')
  if (host !== 'github.com') return host
  return `${host}/${pathname.split('/').filter(Boolean).slice(0, 2).join('/')}`
}

const pad = (n: number) => String(n).padStart(2, '0')

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/* ─── Copy ──────────────────────────────────────────────────────────────── */

const COPY = {
  pt: {
    htmlLang: 'pt-BR',
    ogLocale: 'pt_BR',
    title: 'Kit de front-end — Marcus Boni',
    description:
      'Dezesseis ferramentas para construir interfaces em um link só: componentes, movimento, 3D, skills para agentes e pesquisa de marca. Com favoritos para importar e Markdown para baixar.',
    label: 'Kit 01 · Front-end',
    h1: ['Caixa de', 'ferramentas'],
    lead:
      'Os dezesseis endereços que eu abro antes de desenhar uma interface, em seis prateleiras. Todos podem ser usados de graça; a licença está ao lado de cada um.',
    stats: (tools: number, shelves: number) => [`${tools} ferramentas`, `${shelves} prateleiras`, 'Conferido em nov. 2026'],
    bookmarks: 'Baixar favoritos',
    markdown: 'Baixar Markdown',
    copyLinks: 'Copiar todos os links',
    share: 'Compartilhar',
    hint: 'Os favoritos entram no navegador como uma pasta, já separada por prateleira.',
    hintLink: 'Como importar',
    shelvesNav: 'Prateleiras',
    skillsTitle: 'Instalar as skills',
    skillsText:
      'Uma colagem no terminal instala as cinco skills da lista no seu agente de código. Cada linha pergunta em qual agente instalar.',
    copyCommand: 'Copiar comando',
    importTitle: 'Importar os favoritos',
    importSteps: [
      '<strong>Chrome</strong>: menu de favoritos → Importar favoritos e configurações → Arquivo HTML de favoritos.',
      '<strong>Edge</strong>: Configurações → Importar dados do navegador → Arquivo HTML de favoritos.',
      '<strong>Firefox</strong>: Gerenciar favoritos → Importar e fazer backup → Importar favoritos de HTML.',
      '<strong>Safari</strong>: Arquivo → Importar de → Arquivo HTML de favoritos.',
    ],
    entryTitle: 'O porquê de cada uma',
    entryText: 'O registro do Diário explica cada ferramenta, com exemplos tirados deste site e o que conferir antes de copiar.',
    entryLink: 'Ler o registro completo',
    licenseNote:
      'Licenças conferidas nas páginas de cada projeto em 18 de novembro de 2026. Antes de levar um componente para um projeto de cliente, confira a licença dele.',
    otherLang: 'English',
    otherLangLabel: 'Read this kit in English',
    home: 'Início',
    journal: 'Diário',
    skip: 'Pular para a lista',
    opens: 'abre em nova aba',
    copied: 'Links copiados.',
    commandCopied: 'Comando copiado.',
    linkCopied: 'Endereço do kit copiado.',
    copyFailed: 'Não foi possível copiar. Selecione o texto e copie à mão.',
    folder: 'Kit de front-end — Marcus Boni',
    kitPage: 'Página do kit',
    mdIntro:
      'Dezesseis ferramentas que eu abro antes de desenhar uma interface, em seis prateleiras. Todas podem ser usadas de graça; a licença está ao lado de cada uma.',
    mdPage: 'Página do kit',
    mdEntry: 'Registro completo',
    mdChecked: 'Licenças conferidas em',
    mdLicense: 'Licença',
  },
  en: {
    htmlLang: 'en',
    ogLocale: 'en_US',
    title: 'Front-end kit — Marcus Boni',
    description:
      'Sixteen tools for building interfaces in one link: components, motion, 3D, skills for agents and brand research. With bookmarks to import and Markdown to download.',
    label: 'Kit 01 · Front-end',
    h1: ['Front-end', 'toolbox'],
    lead:
      'The sixteen addresses I open before designing an interface, on six shelves. All of them can be used for free; the license sits next to each one.',
    stats: (tools: number, shelves: number) => [`${tools} tools`, `${shelves} shelves`, 'Checked Nov 2026'],
    bookmarks: 'Download bookmarks',
    markdown: 'Download Markdown',
    copyLinks: 'Copy all links',
    share: 'Share',
    hint: 'The bookmarks land in your browser as one folder, already split by shelf.',
    hintLink: 'How to import',
    shelvesNav: 'Shelves',
    skillsTitle: 'Install the skills',
    skillsText:
      'One paste in a terminal installs the five skills on the list into your coding agent. Each line asks which agent to install into.',
    copyCommand: 'Copy command',
    importTitle: 'Import the bookmarks',
    importSteps: [
      '<strong>Chrome</strong>: bookmarks menu → Import bookmarks and settings → Bookmarks HTML file.',
      '<strong>Edge</strong>: Settings → Import browser data → Favorites or bookmarks HTML file.',
      '<strong>Firefox</strong>: Manage bookmarks → Import and Backup → Import Bookmarks from HTML.',
      '<strong>Safari</strong>: File → Import From → Bookmarks HTML File.',
    ],
    entryTitle: 'Why each one',
    entryText: 'The Journal entry explains every tool, with examples taken from this site and what to check before copying.',
    entryLink: 'Read the full entry',
    licenseNote:
      "Licenses checked on each project's own pages on 18 November 2026. Before taking a component into a client project, check its license.",
    otherLang: 'Português',
    otherLangLabel: 'Ler este kit em português',
    home: 'Home',
    journal: 'Journal',
    skip: 'Skip to the list',
    opens: 'opens in a new tab',
    copied: 'Links copied.',
    commandCopied: 'Command copied.',
    linkCopied: 'Kit address copied.',
    copyFailed: 'Could not copy. Select the text and copy it by hand.',
    folder: 'Front-end kit — Marcus Boni',
    kitPage: 'Kit page',
    mdIntro:
      'Sixteen tools I open before designing an interface, on six shelves. All of them can be used for free; the license sits next to each one.',
    mdPage: 'Kit page',
    mdEntry: 'Full entry',
    mdChecked: 'Licenses checked on',
    mdLicense: 'License',
  },
} as const

/* ─── Markdown ──────────────────────────────────────────────────────────── */

/** The downloadable list, and the Markdown representation of the page. */
export function kitMarkdown(locale: KitLocale): string {
  const c = COPY[locale]
  const lines = [
    `# ${c.title}`,
    '',
    c.mdIntro,
    '',
    `- ${c.mdPage}: ${SITE_URL}${KIT_PATH[locale]}`,
    `- ${c.mdEntry}: ${SITE_URL}${KIT_ENTRY[locale]}`,
    `- ${c.mdChecked}: ${KIT_CHECKED}`,
  ]
  for (const shelf of KIT_SHELVES) {
    lines.push('', `## ${shelf.title[locale]}`, '')
    for (const tool of shelf.tools) {
      lines.push(`- [${tool.name}](${tool.url}): ${tool.description[locale]} ${c.mdLicense}: ${tool.license[locale]}.`)
    }
  }
  lines.push('', `## ${c.skillsTitle}`, '', c.skillsText, '', '```bash', KIT_SKILLS_COMMAND, '```', '')
  return lines.join('\n')
}

/* ─── Bookmarks ─────────────────────────────────────────────────────────── */

/**
 * The Netscape bookmark file every major browser imports: one folder for the
 * kit, one subfolder per shelf.
 */
export function kitBookmarks(locale: KitLocale): string {
  const c = COPY[locale]
  const link = (href: string, text: string, indent: string) =>
    `${indent}<DT><A HREF="${escapeHtml(href)}">${escapeHtml(text)}</A>`
  const out = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file. It will be read and overwritten. DO NOT EDIT! -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    `<TITLE>${escapeHtml(c.folder)}</TITLE>`,
    `<H1>${escapeHtml(c.folder)}</H1>`,
    '<DL><p>',
    `    <DT><H3>${escapeHtml(c.folder)}</H3>`,
    '    <DL><p>',
    link(`${SITE_URL}${KIT_PATH[locale]}`, c.kitPage, '        '),
  ]
  for (const shelf of KIT_SHELVES) {
    out.push(`        <DT><H3>${escapeHtml(shelf.title[locale])}</H3>`, '        <DL><p>')
    for (const tool of shelf.tools) out.push(link(tool.url, tool.name, '            '))
    out.push('        </DL><p>')
  }
  out.push('    </DL><p>', '</DL><p>', '')
  return out.join('\n')
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

const FONT_FACES = `
      @font-face { font-family: 'Instrument Serif'; font-style: normal; font-weight: 400; font-display: swap; src: url('/kit/fonts/instrument-serif-400.woff2') format('woff2'); }
      @font-face { font-family: 'Instrument Serif'; font-style: italic; font-weight: 400; font-display: swap; src: url('/kit/fonts/instrument-serif-400-italic.woff2') format('woff2'); }
      @font-face { font-family: 'Archivo Variable'; font-style: normal; font-weight: 100 900; font-stretch: 62% 125%; font-display: swap; src: url('/kit/fonts/archivo-wght.woff2') format('woff2-variations'); }
      @font-face { font-family: 'Fragment Mono'; font-style: normal; font-weight: 400; font-display: swap; src: url('/kit/fonts/fragment-mono-400.woff2') format('woff2'); }`

const STYLES = `
      :root {
        --ink: #0d0c0a; --ink-soft: #161412; --bone: #ece7df; --bone-dim: #b5afa4;
        /* smoke one step lighter than the site token: here it carries small
           mono text, which needs 4.5:1 (4.7:1), not the 4.2:1 of #7a7368. */
        --smoke: #827b70; --ember: #ff4d17; --line: #2a2723;
        --display: 'Instrument Serif', Georgia, serif;
        --sans: 'Archivo Variable', 'Helvetica Neue', Helvetica, Arial, sans-serif;
        --mono: 'Fragment Mono', 'Courier New', monospace;
        --ease: cubic-bezier(0.16, 1, 0.3, 1);
        color-scheme: dark;
      }
      /* Follows the system's scheme; the light values are the site's
         (src/styles/index.css, "Colour scheme"). */
      @supports (color: light-dark(#000, #fff)) {
        :root {
          color-scheme: light dark;
          --ink: light-dark(#f1ede5, #0d0c0a); --ink-soft: light-dark(#e7e1d6, #161412);
          --bone: light-dark(#14120f, #ece7df); --bone-dim: light-dark(#48433b, #b5afa4);
          --smoke: light-dark(#6b655b, #827b70); --ember: light-dark(#c23005, #ff4d17);
          --line: light-dark(#d6cfc2, #2a2723);
        }
      }
      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; }
      body { margin: 0; background: var(--ink); color: var(--bone); font-family: var(--sans); font-size: 16px; line-height: 1.6; -webkit-font-smoothing: antialiased; }
      a { color: inherit; }
      :focus-visible { outline: 1px solid var(--ember); outline-offset: 4px; }
      .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
      .skip { position: absolute; left: 1rem; top: -4rem; padding: .5rem .75rem; background: var(--ember); color: var(--ink); font-family: var(--mono); font-size: .75rem; z-index: 10; }
      .skip:focus { top: 1rem; }
      .mono { font-family: var(--mono); font-size: .6875rem; letter-spacing: .25em; text-transform: uppercase; }
      .wrap { max-width: 76rem; margin: 0 auto; padding: 0 1.25rem; }
      @media (min-width: 48rem) { .wrap { padding: 0 2.5rem; } }

      /* Top bar */
      .top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .5rem 2rem; padding-block: .75rem; }
      .wordmark { font-family: var(--display); font-style: italic; font-size: 1.6rem; line-height: 1; text-decoration: none; }
      .wordmark span { color: var(--ember); }
      .top nav { display: flex; flex-wrap: wrap; gap: 0 1.5rem; }
      .top nav a, .index a { display: inline-block; padding-block: .75rem; }
      .top nav a { color: var(--smoke); text-decoration: none; transition: color .3s; }
      .top nav a:hover, .top nav a[aria-current] { color: var(--bone); }
      .top nav a[hreflang] { color: var(--ember); }

      /* Hero */
      .hero { padding-block: clamp(3rem, 9vw, 7rem) clamp(2.5rem, 6vw, 4.5rem); border-bottom: 1px solid var(--line); }
      .label { margin: 0; color: var(--ember); }
      h1 { margin: 1.5rem 0 0; font-weight: 800; font-stretch: 112%; text-transform: uppercase; letter-spacing: -.02em; line-height: .86; font-size: clamp(3.25rem, 12vw, 10rem); }
      h1 em { display: block; font-family: var(--display); font-style: italic; font-weight: 400; text-transform: none; letter-spacing: -.01em; color: var(--ember); line-height: .95; }
      .lead { max-width: 46ch; margin: 2rem 0 0; color: var(--bone-dim); font-size: clamp(1.0625rem, 1.6vw, 1.25rem); line-height: 1.55; }
      .stats { display: flex; flex-wrap: wrap; gap: .5rem 2rem; margin: 2rem 0 0; padding: 0; list-style: none; color: var(--smoke); }
      .stats li::before { content: '—'; margin-right: .75rem; color: var(--line); }
      .stats li:first-child::before { content: none; }
      .actions { display: flex; flex-wrap: wrap; gap: .75rem; margin-top: 2.75rem; }
      .btn { display: inline-flex; align-items: center; gap: .75rem; min-height: 2.875rem; padding: 0 1.25rem; border: 1px solid var(--line); background: transparent; color: var(--bone); font: inherit; font-family: var(--mono); font-size: .6875rem; letter-spacing: .2em; text-transform: uppercase; text-decoration: none; cursor: pointer; transition: border-color .3s, color .3s, background-color .3s; }
      .btn:hover { border-color: var(--ember); color: var(--ember); }
      .btn.primary { background: var(--ember); border-color: var(--ember); color: var(--ink); }
      .btn.primary:hover { background: var(--bone); border-color: var(--bone); color: var(--ink); }
      .btn svg { width: .875rem; height: .875rem; flex: none; }
      .hint { margin: 1.25rem 0 0; color: var(--smoke); font-size: .875rem; }
      .hint a { display: inline-block; padding-block: .5rem; color: var(--bone-dim); text-underline-offset: .25em; text-decoration-color: var(--line); }
      .hint a:hover { color: var(--ember); text-decoration-color: var(--ember); }
      .status { min-height: 1.5rem; margin: .75rem 0 0; color: var(--ember); }

      /* Shelf index */
      .index { display: flex; flex-wrap: wrap; gap: 0 1.75rem; padding-block: .75rem; border-bottom: 1px solid var(--line); }
      .index a { color: var(--smoke); text-decoration: none; transition: color .3s; }
      .index a b { color: var(--ember); font-weight: 400; margin-right: .5rem; }
      .index a:hover { color: var(--bone); }

      /* Shelves */
      .shelf { display: grid; gap: 1.25rem 3rem; padding-block: 3rem; border-bottom: 1px solid var(--line); scroll-margin-top: 1rem; }
      @media (min-width: 64rem) { .shelf { grid-template-columns: 15rem minmax(0, 1fr); padding-block: 4rem; } }
      .shelf h2 { align-self: start; margin: 0; font-family: var(--display); font-weight: 400; font-size: clamp(2rem, 3.4vw, 2.75rem); line-height: 1; }
      @media (min-width: 64rem) { .shelf h2 { position: sticky; top: 2rem; } }
      .shelf h2 small { display: block; margin-bottom: .875rem; color: var(--ember); }
      .tools { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
      .tool a { position: relative; display: grid; grid-template-columns: 2.5rem minmax(0, 1fr) auto; gap: .25rem 1rem; padding: 1.5rem 0; border-bottom: 1px solid var(--line); text-decoration: none; }
      .tool a::before { content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 1px; background: var(--ember); transform: scaleX(0); transform-origin: left; transition: transform .6s var(--ease); }
      .tool a:hover::before, .tool a:focus-visible::before { transform: scaleX(1); }
      .tool .n { grid-row: span 2; padding-top: .55rem; color: var(--smoke); }
      .tool .name { font-family: var(--display); font-size: clamp(1.75rem, 3vw, 2.5rem); line-height: 1.05; transition: color .3s; }
      .tool a:hover .name, .tool a:focus-visible .name { font-style: italic; color: var(--ember); }
      .tool .arrow { align-self: start; padding-top: .5rem; color: var(--smoke); font-family: var(--display); font-size: 1.5rem; line-height: 1; transition: transform .4s var(--ease), color .3s; }
      .tool a:hover .arrow, .tool a:focus-visible .arrow { color: var(--ember); transform: translate(.2rem, -.2rem); }
      .tool .body { grid-column: 2 / -1; display: grid; gap: .5rem; }
      .tool .desc { max-width: 60ch; color: var(--bone-dim); font-size: .9375rem; }
      .tool .meta { display: flex; flex-wrap: wrap; gap: .25rem 1.5rem; color: var(--smoke); letter-spacing: .18em; }
      .tool .lic { color: var(--bone-dim); }

      /* Skills, import, entry */
      .panel { display: grid; gap: 1.25rem 3rem; padding-block: 4rem; border-bottom: 1px solid var(--line); scroll-margin-top: 1rem; }
      @media (min-width: 64rem) { .panel { grid-template-columns: 15rem minmax(0, 1fr); } }
      .panel h2 { margin: 0; font-family: var(--display); font-weight: 400; font-size: clamp(2rem, 3.4vw, 2.75rem); line-height: 1; }
      .panel p { max-width: 60ch; margin: 0 0 1.25rem; color: var(--bone-dim); }
      .panel ol { margin: 0; padding-left: 1.25rem; color: var(--bone-dim); display: grid; gap: .625rem; }
      .panel ol strong { color: var(--bone); font-weight: 600; }
      .code { position: relative; margin: 0 0 1rem; border: 1px solid var(--line); background: var(--ink-soft); }
      .code pre { margin: 0; padding: 1.25rem 1.25rem; overflow-x: auto; font-family: var(--mono); font-size: .8125rem; line-height: 1.9; color: var(--bone); }
      .entry-link { display: inline-flex; gap: .75rem; align-items: baseline; font-family: var(--display); font-style: italic; font-size: clamp(1.75rem, 3vw, 2.5rem); line-height: 1.1; color: var(--bone); text-decoration: none; transition: color .3s; }
      .entry-link:hover { color: var(--ember); }
      footer { padding-block: 3rem 5rem; color: var(--smoke); font-size: .8125rem; }
      footer p { max-width: 70ch; margin: 0 0 1rem; }

      /* Motion: an entrance for the hero, rows that ink in as they scroll by. */
      @media (prefers-reduced-motion: no-preference) {
        .rise { animation: rise .9s var(--ease) both; }
        .rise:nth-child(2) { animation-delay: .08s; } .rise:nth-child(3) { animation-delay: .16s; }
        .rise:nth-child(4) { animation-delay: .24s; } .rise:nth-child(5) { animation-delay: .32s; }
        .rise:nth-child(6) { animation-delay: .4s; } .rise:nth-child(7) { animation-delay: .48s; }
        @supports (animation-timeline: view()) {
          .tool { animation: ink linear both; animation-timeline: view(); animation-range: entry 0% entry 60%; }
        }
      }
      @keyframes rise { from { opacity: 0; transform: translateY(1.25rem); } }
      @keyframes ink { from { opacity: .15; transform: translateY(.75rem); } }`

const SCRIPT = `
      (() => {
        const status = document.querySelector('[data-status]')
        // The canonical address, not location.href: a copied or shared link
        // should not carry whatever query string brought the reader here.
        const page = document.querySelector('link[rel=canonical]').href
        const say = (message) => { status.textContent = ''; setTimeout(() => { status.textContent = message }, 60) }
        const copy = async (text, done) => {
          try { await navigator.clipboard.writeText(text); say(done) }
          catch { say(status.dataset.failed) }
        }
        document.addEventListener('click', (event) => {
          const button = event.target.closest('button[data-action]')
          if (!button) return
          const action = button.dataset.action
          if (action === 'links') {
            const lines = [...document.querySelectorAll('.shelf')].map((shelf) => {
              const title = shelf.querySelector('h2').dataset.title
              const tools = [...shelf.querySelectorAll('.tool a')].map((a) => '- ' + a.dataset.name + ': ' + a.href)
              return title + '\\n' + tools.join('\\n')
            })
            copy(document.title + '\\n' + page + '\\n\\n' + lines.join('\\n\\n'), button.dataset.done)
          } else if (action === 'command') {
            copy(document.querySelector('[data-command]').textContent, button.dataset.done)
          } else if (action === 'share') {
            const data = { title: document.title, text: document.querySelector('meta[name=description]').content, url: page }
            if (navigator.share) navigator.share(data).catch(() => {})
            else copy(page, button.dataset.done)
          }
        })
      })()`

const ICON = {
  download:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M8 2v8.5M4.5 7 8 10.5 11.5 7M2.5 13.5h11"/></svg>',
  copy: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="5" y="5" width="8.5" height="8.5"/><path d="M11 5V2.5H2.5V11H5"/></svg>',
  share:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M8 10V2M5 4.5 8 1.5l3 3M3.5 7.5v6h9v-6"/></svg>',
}

/** The full static document for one language. */
export function kitPage(locale: KitLocale): string {
  const c = COPY[locale]
  const other: KitLocale = locale === 'pt' ? 'en' : 'pt'
  const url = `${SITE_URL}${KIT_PATH[locale]}`
  const tools = kitTools()
  let index = 0

  const shelves = KIT_SHELVES.map((shelf, s) => {
    const items = shelf.tools
      .map((tool) => {
        index += 1
        return `
            <li class="tool">
              <a href="${escapeHtml(tool.url)}" target="_blank" rel="noopener" data-name="${escapeHtml(tool.name)}">
                <span class="n mono" aria-hidden="true">${pad(index)}</span>
                <span class="name">${escapeHtml(tool.name)}</span>
                <span class="arrow" aria-hidden="true">↗</span>
                <span class="body">
                  <span class="desc">${escapeHtml(tool.description[locale])}</span>
                  <span class="meta mono"><span>${escapeHtml(kitHost(tool.url))}</span><span class="lic">${escapeHtml(tool.license[locale])}</span></span>
                </span>
                <span class="sr">(${escapeHtml(c.opens)})</span>
              </a>
            </li>`
      })
      .join('')
    return `
        <section class="shelf" id="${shelf.id}" aria-labelledby="${shelf.id}-h">
          <h2 id="${shelf.id}-h" data-title="${escapeHtml(shelf.title[locale])}"><small class="mono">${pad(s + 1)} · ${shelf.tools.length}</small>${escapeHtml(shelf.title[locale])}</h2>
          <ol class="tools" start="${index - shelf.tools.length + 1}">${items}
          </ol>
        </section>`
  }).join('')

  const indexNav = KIT_SHELVES.map(
    (shelf, s) => `<a class="mono" href="#${shelf.id}"><b>${pad(s + 1)}</b>${escapeHtml(shelf.title[locale])}</a>`,
  ).join('\n          ')

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${url}#kit`,
    url,
    name: c.title,
    description: c.description,
    inLanguage: c.htmlLang,
    numberOfItems: tools.length,
    author: { '@type': 'Person', name: 'Marcus Boni', url: `${SITE_URL}/about` },
    itemListElement: tools.map((tool, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: tool.name,
      url: tool.url,
    })),
  }

  return `<!doctype html>
<html lang="${c.htmlLang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <!-- Generated from netlify/lib/kit.ts by tests/kit.test.ts. Edit the source, not this file. -->

    <title>${escapeHtml(c.title)}</title>
    <meta name="description" content="${escapeHtml(c.description)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${url}" />
    <link rel="alternate" hreflang="pt-BR" href="${SITE_URL}${KIT_PATH.pt}" />
    <link rel="alternate" hreflang="en" href="${SITE_URL}${KIT_PATH.en}" />
    <link rel="alternate" hreflang="x-default" href="${SITE_URL}${KIT_PATH.pt}" />
    <link rel="alternate" type="text/markdown" href="${url}" />
    <meta name="color-scheme" content="light dark" />
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f1ede5" />
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0d0c0a" />

    <meta property="og:type" content="website" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${escapeHtml(c.title)}" />
    <meta property="og:description" content="${escapeHtml(c.description)}" />
    <meta property="og:image" content="${SITE_URL}/og-image.jpg" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="Marcus Boni — Portfolio" />
    <meta property="og:locale" content="${c.ogLocale}" />
    <meta name="twitter:card" content="summary_large_image" />

    <link rel="preload" href="/kit/fonts/instrument-serif-400.woff2" as="font" type="font/woff2" crossorigin />
    <style>${FONT_FACES}
${STYLES}
    </style>
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  </head>
  <body>
    <a class="skip" href="#${KIT_SHELVES[0].id}">${escapeHtml(c.skip)}</a>
    <div class="wrap">
      <header class="top">
        <a class="wordmark" href="/" aria-label="Marcus Boni — ${escapeHtml(c.home)}">mb<span>.</span></a>
        <nav class="mono" aria-label="Site">
          <a href="/">${escapeHtml(c.home)}</a>
          <a href="/blog">${escapeHtml(c.journal)}</a>
          <a href="${KIT_PATH[other]}" hreflang="${COPY[other].htmlLang}" lang="${COPY[other].htmlLang}" aria-label="${escapeHtml(c.otherLangLabel)}">${escapeHtml(c.otherLang)}</a>
        </nav>
      </header>

      <main>
        <section class="hero" aria-labelledby="kit-title">
          <p class="label mono rise">${escapeHtml(c.label)}</p>
          <h1 id="kit-title" class="rise">${escapeHtml(c.h1[0])} <em>${escapeHtml(c.h1[1])}</em></h1>
          <p class="lead rise">${escapeHtml(c.lead)}</p>
          <ul class="stats mono rise">${c.stats(tools.length, KIT_SHELVES.length).map((stat) => `<li>${escapeHtml(stat)}</li>`).join('')}</ul>
          <div class="actions rise">
            <a class="btn primary" href="${KIT_DOWNLOADS[locale].bookmarks}" download>${ICON.download}${escapeHtml(c.bookmarks)}</a>
            <a class="btn" href="${KIT_DOWNLOADS[locale].markdown}" download>${ICON.download}${escapeHtml(c.markdown)}</a>
            <button class="btn" type="button" data-action="links" data-done="${escapeHtml(c.copied)}">${ICON.copy}${escapeHtml(c.copyLinks)}</button>
            <button class="btn" type="button" data-action="share" data-done="${escapeHtml(c.linkCopied)}">${ICON.share}${escapeHtml(c.share)}</button>
          </div>
          <p class="hint rise">${escapeHtml(c.hint)} <a href="#importar">${escapeHtml(c.hintLink)}</a></p>
          <p class="status mono" role="status" data-status data-failed="${escapeHtml(c.copyFailed)}"></p>
        </section>

        <nav class="index" aria-label="${escapeHtml(c.shelvesNav)}">
          ${indexNav}
        </nav>
${shelves}

        <section class="panel" id="skills-install" aria-labelledby="skills-install-h">
          <h2 id="skills-install-h">${escapeHtml(c.skillsTitle)}</h2>
          <div>
            <p>${escapeHtml(c.skillsText)}</p>
            <div class="code"><pre><code data-command>${escapeHtml(KIT_SKILLS_COMMAND)}</code></pre></div>
            <button class="btn" type="button" data-action="command" data-done="${escapeHtml(c.commandCopied)}">${ICON.copy}${escapeHtml(c.copyCommand)}</button>
          </div>
        </section>

        <section class="panel" id="importar" aria-labelledby="importar-h">
          <h2 id="importar-h">${escapeHtml(c.importTitle)}</h2>
          <ol>
            ${c.importSteps.map((step) => `<li>${step}</li>`).join('\n            ')}
          </ol>
        </section>

        <section class="panel" aria-labelledby="entry-h">
          <h2 id="entry-h">${escapeHtml(c.entryTitle)}</h2>
          <div>
            <p>${escapeHtml(c.entryText)}</p>
            <a class="entry-link" href="${KIT_ENTRY[locale]}">${escapeHtml(c.entryLink)} <span aria-hidden="true">→</span></a>
          </div>
        </section>
      </main>

      <footer>
        <p>${escapeHtml(c.licenseNote)}</p>
        <p class="mono">Marcus Boni · marcusboni.com.br</p>
      </footer>
    </div>
    <script>${SCRIPT}
    </script>
  </body>
</html>
`
}
