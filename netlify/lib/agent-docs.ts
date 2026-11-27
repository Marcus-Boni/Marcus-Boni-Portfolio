/**
 * The Markdown representations of this site.
 *
 * Every function here is pure: given the same data it returns the same string,
 * with no Deno globals and no I/O. That is what lets `tests/agent-docs.test.ts`
 * assert the documents stay in sync with `src/data/profile.ts` — the drift this
 * file is otherwise wide open to, since the edge runtime cannot import from
 * `src/` (React, the i18n bundle and the Firebase SDK do not belong at the
 * edge).
 *
 * Prose here mirrors the static content in `index.html` and the copy in
 * `src/i18n/translations.tsx`. When the site's story changes, this changes too.
 */

import {
  availableLangs,
  collapseLegacyPairs,
  isBilingual,
  localizedMeta,
  type BlogLocale,
  type PostLocales,
} from './blog-locale.ts'
import { postCanonicalUrl, postUrl } from './blog-seo.ts'

const SITE_URL = 'https://marcusboni.com.br'

/** The subset of post metadata these documents render. */
export interface DocPost {
  slug: string
  lang: 'pt' | 'en'
  status?: string
  title: string
  subtitle: string
  excerpt: string
  tags: string[]
  readingMinutes: number
  publishedAt: string | null
  updatedAt: string
  translationOf: string | null
  locales?: PostLocales
}

/** Body images, keyed by the id the Markdown references as `media:{id}`. */
export type DocMedia = Record<string, { src: string; alt?: string }>

/** Shared footer: every document tells an agent where to go next. */
function footer(): string {
  return [
    '---',
    '',
    '## Machine-readable index',
    '',
    `- [\`/llms.txt\`](${SITE_URL}/llms.txt) — condensed site guide`,
    `- [\`/llms-full.txt\`](${SITE_URL}/llms-full.txt) — full profile, projects and client work`,
    `- [\`/agent-instructions.md\`](${SITE_URL}/agent-instructions.md) — when to use this site, and how`,
    `- [\`/developers\`](${SITE_URL}/developers) — every endpoint, with \`curl\` examples`,
    `- [\`/sitemap.xml\`](${SITE_URL}/sitemap.xml) — indexable URLs`,
    `- [\`/rss.xml\`](${SITE_URL}/rss.xml) — blog feed`,
    '',
    'Every HTML page on this site also answers `Accept: text/markdown` with a',
    'Markdown representation of the same URL.',
    '',
  ].join('\n')
}

/* ─── / ─────────────────────────────────────────────────────────────────── */

/**
 * The home page as Markdown.
 *
 * Mirrors the static content served in `index.html` — same claims, same
 * numbers, same links — so a crawler that reads either one gets the same
 * answer. `tests/agent-docs.test.ts` checks the facts against `profile.ts`.
 */
export function homeMarkdown(): string {
  return `# Marcus Boni — Software Engineer

> Brazilian software engineer building full-stack software, native desktop
> systems (Rust/Tauri) and applied AI workflows (MCP servers, pgvector RAG),
> comfortable aligning directly with clients from discovery to production.
> Based in Espírito Santo, Brazil. Software Developer at Optsolv since June 2024.

- **Name:** Marcus Boni (Marcus Evandro Galvão Boni)
- **Role:** Software Engineer — Software Developer at Optsolv (Jun 2024 — present)
- **Location:** Espírito Santo, Brazil
- **Email:** mgalvaoboni@gmail.com
- **GitHub:** https://github.com/Marcus-Boni (75 public repositories)
- **LinkedIn:** https://www.linkedin.com/in/marcus-boni-729a52243
- **Résumé:** [Portuguese](${SITE_URL}/marcus-boni-cv-pt.pdf) · [English](${SITE_URL}/marcus-boni-resume-en.pdf)
- **Languages:** Portuguese (native), English (professional)

## About

A Brazilian software engineer focused on turning real operational problems into
resilient software — from native Rust tools to full-stack web apps and applied
AI in production. Uses AI deliberately as an engineering multiplier grounded in
fundamentals and industry best practices, while staying comfortable aligning
directly with clients through production deployment. The public GitHub account
carries 75 repositories of native tools, MCP servers, RAG pipelines and shipped
products.

## Selected projects

| Project | Year | Stack | What it is |
| --- | --- | --- | --- |
| [ISPer](https://github.com/Marcus-Boni/ISPer) | 2026 | Rust, Tauri 2, whisper.cpp, CUDA, MCP | Offline Windows voice dictation and Teams meeting transcription built on a 12-crate Rust workspace with Tauri 2 and whisper.cpp (CPU/CUDA), across 25 releases. |
| [OptTime](https://github.com/Marcus-Boni/OptTime) | 2026 | TypeScript, Next.js, PostgreSQL, Drizzle, MCP | Full-stack time-tracking platform synced bi-directionally with Azure DevOps, featuring a native extension and a 16-tool MCP server for AI agents. |
| [Meeting Copilot](https://github.com/Marcus-Boni/chatbot-template) | 2026 | TypeScript, Next.js, CopilotKit, pgvector, RAG | Config-driven RAG architecture for searching Teams meeting transcripts over pgvector, with mandatory source citations, workspace isolation and a retrieval evaluation harness. |
| [Auto Daily](https://github.com/Marcus-Boni/Auto-Daily-App) | 2026 | TypeScript, Next.js, Azure DevOps, AI | Web app that synthesizes AI-assisted daily standup drafts from Azure DevOps commits and OptTime hour logs. |
| [Estimativa de Horas](https://github.com/Marcus-Boni/Ferramenta-Estimativa-Horas) | 2026 | TypeScript, Next.js, Azure DevOps, Firebase | A web tool that replaced fragile Excel spreadsheets for task-hour estimation, pulling work items straight from Azure DevOps with dashboards and export. |

## Professional experience

**Software Developer — Optsolv** (June 2024 — present). Client work delivered
end to end — combining software engineering with direct stakeholder alignment
through production deployment — across seven sectors:

- **Unimed Sul Capixaba** — Healthcare. Medical-guide management platform:
  AD-authenticated service integration, CORS tuning on IIS, and full
  traceability of the inter-operator exchange-guide cycle. React, REST APIs, IIS.
- **Hidrauvit** — Industry. Phased-delivery production-management system:
  responsive UI refinement, ongoing technical alignment with the client, and
  WebService integration. React, ASP.Net.
- **EAV — Escola Americana de Vitória** — Customer Care. Virtual assistant with
  a standardized identity: a Tailwind design system in brand colors and public
  assets on Firebase Storage for transactional emails. N8N, Firebase, AI.
- **Cedisa** — Supply. Materials management wired into a legacy PostgreSQL base:
  REST query APIs, screen architecture, and technical discovery alongside the
  client IT team. Flutter, REST APIs, Mobile.
- **GAB — Grupo Águia Branca** — Logistics. B2B boarding-operations platform:
  staging environments, administrative workflows, and email notifications with
  auditing and log monitoring. React, Workflow.
- **Marca Ambiental** — Environment. Multi-profile web/PWA portal integrated
  with the Sankhya ERP: contracts, billing and invoices, measurements and
  documents, validated with key users. Node, PWA, PostgreSQL.
- **Galwan** — Real Estate. Real-estate payment-plan engine with sensitive
  business rules: installment math, multiple buyers, financial KPIs, and
  AI-assisted simulations. Backend, business rules, AI.

## Technical stack

- **Interface:** React, Next.js, TypeScript, Tailwind CSS, React Native, Astro, Flutter, WebGL
- **Services:** C#, Java, Python, Node.js, Rust, Tauri, MCP
- **Data:** PostgreSQL, SQL Server, Supabase, Firebase, SQLite, Neon, Turso, Drizzle, pgvector
- **Infrastructure:** Docker, Azure, Azure DevOps, Portainer, IIS, Netlify, GitHub Actions

## Writing

Technical notes, architecture write-ups and applied AI articles live at
[${SITE_URL}/blog](${SITE_URL}/blog), with a feed at
[${SITE_URL}/rss.xml](${SITE_URL}/rss.xml).

## Contact

Email **mgalvaoboni@gmail.com** for freelance or full-time work, technical
consulting, or a second opinion on architecture, applied AI or integrations. GitHub and LinkedIn are the other two public
channels. There is no phone number, calendar link or chat widget on this site —
email is the front door.

${footer()}`
}

/* ─── /ask ──────────────────────────────────────────────────────────────── */

/** The interactive dossier console route, represented as Markdown for crawlers/agents. */
export function askMarkdown(lang: BlogLocale = 'pt'): string {
  if (lang === 'en') {
    return `# Interactive Dossier — Marcus Boni

> Evidence-first local agentic console for recruiters, engineers and clients at [${SITE_URL}/en/ask](${SITE_URL}/en/ask).

This page runs a deterministic local retrieval runtime over the same structured data published by \`/api/v1/*\`:

- \`/fit <job description>\` — cross-checks pasted requirements against verified production engagements and public repositories, listing honest gaps explicitly.
- \`/stack\`, \`/projects\`, \`/experience\`, \`/posts\` — runs inspectable local tool calls with inline citations.
- \`/cv\` & \`/contact\` — approval-gated actions to download PT/EN PDF résumés or submit an inquiry to the site inbox.

For programmatic access without a browser, call the OpenAPI 3.1 endpoints directly at [${SITE_URL}/developers](${SITE_URL}/developers) or fetch [${SITE_URL}/llms-full.txt](${SITE_URL}/llms-full.txt).

${footer()}`
  }

  return `# Dossiê Interativo — Marcus Boni

> Console agêntico local orientado a evidências para recrutadores, engenheiros e clientes em [${SITE_URL}/ask](${SITE_URL}/ask).

Esta página executa um motor determinístico local sobre os mesmos dados publicados em \`/api/v1/*\`:

- \`/fit <descrição da vaga>\` — cruza requisitos colados contra entregas em produção e repositórios públicos, listando lacunas com transparência.
- \`/stack\`, \`/projects\`, \`/experience\`, \`/posts\` — executa chamadas de ferramentas inspecionáveis com citações inline.
- \`/cv\` e \`/contact\` — ações com aprovação explícita para baixar currículos em PDF (PT/EN) ou enviar mensagem direto ao inbox.

Para acesso programático sem navegador, use diretamente a API OpenAPI 3.1 em [${SITE_URL}/developers](${SITE_URL}/developers) ou leia [${SITE_URL}/llms-full.txt](${SITE_URL}/llms-full.txt).

${footer()}`
}

/* ─── /developers ───────────────────────────────────────────────────────── */

/**
 * The developer portal as Markdown.
 *
 * Mirrors `public/developers.html`. Both are hand-maintained against the
 * same list of endpoints; `tests/agent-docs.test.ts` asserts every endpoint
 * named here also appears in the HTML page, so the two cannot drift apart.
 */
export function developersMarkdown(): string {
  return `# Developers

> Everything on marcusboni.com.br that is meant to be read by a program rather
> than a person: the machine-readable files, the content-negotiation contract,
> and copy-pasteable \`curl\` for each one.

This is a personal portfolio and technical blog. Its API is **public,
read-only and unauthenticated**: no private endpoints, no write operations, no
published rate limit, and therefore **no API keys to issue and no sandbox to
provision**. Every endpoint below is the production endpoint, which makes the
API its own sandbox.

## Quickstart

\`\`\`bash
# The profile, as JSON
curl -s ${SITE_URL}/api/v1/profile

# The OpenAPI 3.1 description of every operation
curl -s ${SITE_URL}/openapi.json

# The site's own guide for language models
curl -s ${SITE_URL}/llms.txt

# Any page, as Markdown instead of HTML
curl -s -H 'Accept: text/markdown' ${SITE_URL}/
\`\`\`

## JSON API

Read-only representations of the same content the pages publish. The
specification is [OpenAPI 3.1](${SITE_URL}/openapi.json); every operation has a
unique \`operationId\`, a description, typed parameters and a response schema,
so the surface can be handed to a function-calling runtime unchanged.
Discovery also goes through the RFC 9727 catalog at
[\`/.well-known/api-catalog\`](${SITE_URL}/.well-known/api-catalog).

| Operation | Endpoint | Returns |
| --- | --- | --- |
| \`getApiIndex\` | \`GET /api/v1\` | The operation list and a link to the specification. |
| \`getProfile\` | \`GET /api/v1/profile\` | Identity, employer, location, contact channels, résumés. |
| \`listProjects\` | \`GET /api/v1/projects\` | Selected projects with year, stack and repository URL. |
| \`getExperience\` | \`GET /api/v1/experience\` | Current role and every client engagement, with sector and scope. |
| \`listTechnologies\` | \`GET /api/v1/stack\` | Technologies, grouped by frontend, backend, data and ops. |
| \`listPosts\` | \`GET /api/v1/posts\` | Published posts, newest first. Served live, so publishing needs no rebuild. |
| \`getPost\` | \`GET /api/v1/posts/{slug}\` | One post, including the Markdown it was authored in. |

### Errors

Every failure under \`/api/\` is [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457)
\`application/problem+json\`, never an HTML error page, with a stable \`code\`
and a \`hint\` naming the next thing to try.

\`\`\`json
{
  "type": "${SITE_URL}/developers#error-not-found",
  "title": "Not found",
  "status": 404,
  "detail": "No published post has the slug \\"ghost\\". Drafts are not readable.",
  "instance": "/api/v1/posts/ghost",
  "code": "not_found",
  "hint": "GET ${SITE_URL}/api/v1/posts to list every published post and its slug."
}
\`\`\`

| Code | Status | When |
| --- | --- | --- |
| \`not_found\` | 404 | No such endpoint, or no published post with that slug. |
| \`method_not_allowed\` | 405 | Anything but GET or HEAD. The API is read-only. |
| \`not_acceptable\` | 406 | Your \`Accept\` header rules out \`application/json\`. |
| \`upstream_unavailable\` | 503 | The content database is unreachable. Transient — retry. |

### Versioning and deprecation

The major version is in the URL path. \`/api/v1\` is current; a breaking change
ships as \`/api/v2\`, never as an edit to \`v1\`. Additive changes — a new
endpoint, a new optional field — happen in place, so **ignore unknown
properties rather than failing on them**.

A path being retired announces itself on its own responses, before it stops
answering:

| Header | Spec | Carries |
| --- | --- | --- |
| \`Deprecation\` | RFC 9745 | When the path was deprecated, as \`@<unix-seconds>\`. |
| \`Sunset\` | RFC 8594 | When it stops responding, as an HTTP date. |
| \`Link\` | RFC 8288 | \`rel="deprecation"\`, pointing at the explanation. |

There are at least **180 days** between the two dates. **Nothing is deprecated
today**, so none of these headers appears on any current response — the
mechanism is in place and tested so the first deprecation is signalled rather
than announced after the fact.

## Markdown content negotiation

Every HTML document on this site is also available as Markdown from the same
URL, following the [acceptmarkdown.com](https://acceptmarkdown.com) convention.

\`\`\`bash
curl -sI -H 'Accept: text/markdown' ${SITE_URL}/
# content-type: text/markdown; charset=utf-8
# vary: Accept, Accept-Encoding
\`\`\`

| Request \`Accept\` | Response |
| --- | --- |
| *(absent)* | \`text/html\` — the default representation |
| \`*/*\` | \`text/html\` |
| \`text/html\` | \`text/html\` |
| \`text/markdown\` | \`text/markdown; charset=utf-8\` |
| \`text/markdown;q=0.9, text/html;q=0.8\` | \`text/markdown\` — highest q wins |
| \`text/markdown;q=0\` | \`text/html\` — an explicit refusal of Markdown |
| \`application/pdf\` | \`406 Not Acceptable\`, listing both representations |

Quality values and wildcard specificity are honoured; \`text/x-markdown\` and
\`text/mdx\` are accepted as aliases. Responses carry \`Vary: Accept\` so a
shared cache cannot hand an agent the HTML variant.

Negotiable paths: \`/\`, \`/blog\`, \`/blog/{slug}\`, \`/developers\`, and any
unknown path (which answers \`404\` in both representations).

## Machine-readable files

| Endpoint | Content type | What it is |
| --- | --- | --- |
| \`/openapi.json\` | \`application/json\` | OpenAPI 3.1 description of every API operation. |
| \`/.well-known/api-catalog\` | \`application/linkset+json\` | RFC 9727 discovery document pointing at the specification and the docs. |
| \`/llms.txt\` | \`text/plain\` | Condensed site guide, [llmstxt.org](https://llmstxt.org) format, including a "when to use this" section. |
| \`/llms-full.txt\` | \`text/plain\` | Full profile: bio, every project, every client engagement, the whole stack. |
| \`/agent-instructions.md\` | \`text/markdown\` | Best-fit tasks, how to call this site, and what not to infer from it. |
| \`/sitemap.xml\` | \`application/xml\` | Indexable URLs, generated per request so a new post is discoverable without a rebuild. |
| \`/rss.xml\` | \`application/xml\` | RSS 2.0 feed of published posts. |
| \`/robots.txt\` | \`text/plain\` | Crawl directives. Everything is allowed except \`/admin\`. |
| \`/marcus-boni-cv-pt.pdf\` | \`application/pdf\` | Résumé, Portuguese. |
| \`/marcus-boni-resume-en.pdf\` | \`application/pdf\` | Résumé, English. |

## Structured data

The home page carries a schema.org \`Person\` in JSON-LD; every post carries a
\`BlogPosting\`, injected into the delivered HTML at the edge so it is present
without executing JavaScript.

\`\`\`bash
curl -s ${SITE_URL}/ | grep -A2 'application/ld+json'
\`\`\`

## HTTP behaviour

- **404** — unknown paths return a genuine \`404\`, not the app shell with a
  \`200\`. The body points back at this page, \`/sitemap.xml\` and \`/llms.txt\`.
  A \`/blog/{slug}\` with no such post returns \`404\` as well. Under \`/api/\`
  the same 404 arrives as \`problem+json\`.
- **406** — returned only when an \`Accept\` header rules out every
  representation a path can produce: \`text/html\` and \`text/markdown\` on a
  page, \`application/json\` under \`/api/\`.
- **301** — \`/marcus-boni-cv.pdf\` redirects to the Portuguese résumé, kept
  alive for links shared before the PT/EN split.
- **CORS** — not enabled. These are documents, fetched server-side; nothing
  here is designed to be read from another site's JavaScript.
- **Rate limits** — none published. Be reasonable; the whole site is a few
  hundred kilobytes and changes weekly at most.

## Reusing the content

The prose, résumés and images are © Marcus Boni. Quote and link freely, with
attribution to ${SITE_URL}. Code in the linked GitHub repositories carries its
own licence per repository.

${footer()}`
}

/* ─── /about, /contact, /privacy ────────────────────────────────────────── */

/**
 * The trust pages, as Markdown.
 *
 * These are what an agent reads to decide whether the person behind a site is
 * real before recommending them, so the Markdown has to carry the same facts
 * as the HTML rather than a teaser. Twins of `public/about.html`,
 * `public/contact.html` and `public/privacy.html`; `tests/agent-docs.test.ts`
 * holds the key facts in both.
 *
 * Portuguese, like the pages: these address people, and the site is PT-first.
 * The machine-facing documents (`llms.txt`, `agent-instructions.md`,
 * `/developers`) stay English.
 */
export function aboutMarkdown(): string {
  return `# Sobre — Marcus Boni

> Engenheiro de software brasileiro, no Espírito Santo. Desenvolvedor de
> Software na Optsolv desde junho de 2024, construindo software full-stack,
> sistemas nativos e IA aplicada com autonomia para atuar do discovery ao
> deploy em produção.

## O que eu faço

Atuo no ciclo completo de engenharia: entender o problema direto com quem vai
usar, traduzir requisitos de negócio em decisões técnicas claras, construir a
interface e o serviço, integrar com sistemas existentes e acompanhar o deploy
em produção.

Na prática: TypeScript, React e Next.js na frente; Rust/Tauri, Node.js, Python e
C# atrás; PostgreSQL, Drizzle e pgvector nos dados; servidores MCP e pipelines
RAG em IA aplicada — sempre usando IA como multiplicador de engenharia ancorado
em fundamentos e boas práticas de mercado.

A parte que costuma decidir o projeto raramente é a tecnologia. É entender por
que a planilha que a ferramenta vai substituir existe há seis anos.

## Onde já entreguei

Sete clientes, sete setores, todos na Optsolv:

- **Saúde** — Unimed Sul Capixaba: gestão de guias médicas, integração com
  serviços autenticados via AD, rastreabilidade de guias de intercâmbio.
- **Indústria** — Hidrauvit: gestão da produção em entrega faseada, integração
  via WebService.
- **Logística** — GAB, Grupo Águia Branca: plataforma de embarque B2B, fluxos
  administrativos e notificações auditadas.
- **Meio ambiente** — Marca Ambiental: portal do cliente web/PWA multi-perfil
  integrado ao ERP Sankhya.
- **Suprimentos** — Cedisa: gestão de materiais sobre base PostgreSQL legada.
- **Imobiliário** — Galwan: motor de plano de pagamento, parcelamento e KPIs
  financeiros.
- **Atendimento** — EAV, Escola Americana de Vitória: assistente virtual.

Escopo e stack de cada um em \`GET ${SITE_URL}/api/v1/experience\`.

## Fora do trabalho

75 repositórios públicos em https://github.com/Marcus-Boni. Entre os projetos
em destaque: ISPer (motor local de voz em Rust com 12 crates, Tauri 2 e
whisper.cpp CPU/CUDA), OptTime (apontamento integrado ao Azure DevOps com
servidor MCP de 16 ferramentas), Meeting Copilot (RAG com pgvector e avaliação
de busca) e Auto Daily. Escrevo com frequência no blog sobre engenharia de
software, arquitetura e IA aplicada. Este site é código aberto, incluindo o
painel administrativo e a API.

## Trabalhar comigo

Aberto a trabalho freelance ou efetivo, consultoria técnica e segunda opinião
em arquitetura, IA aplicada ou integração. E-mail: mgalvaoboni@gmail.com.
Detalhes em [${SITE_URL}/contact](${SITE_URL}/contact).

${footer()}`
}

export function contactMarkdown(): string {
  return `# Contato — Marcus Boni

> E-mail é o canal principal: **mgalvaoboni@gmail.com**. Não há telefone
> comercial publicado, nem chat, nem link de agenda.

## Canais

- **E-mail**: mgalvaoboni@gmail.com — qualquer assunto, inclusive pedidos
  relativos a dados pessoais.
- **Formulário**: no fim de [${SITE_URL}/](${SITE_URL}/). Cai na mesma caixa.
- **LinkedIn**: https://www.linkedin.com/in/marcus-boni-729a52243 — carreira e
  recrutamento.
- **GitHub**: https://github.com/Marcus-Boni — código.

Baseado no Espírito Santo, Brasil (UTC−3). Atende em português e inglês.

## Que trabalho eu pego

- **Aplicação web de ponta a ponta** — da tela ao serviço, incluindo integração
  com o sistema que já existe.
- **Front-end sobre back-end de terceiro** — quando a API já existe, é legada,
  ou é de outro time. React, TypeScript, Next.js.
- **Integração** — ERP, WebService, base legada, serviço autenticado.
- **Segunda opinião** — revisão de arquitetura, decisão técnica ou código, em
  escopo fechado e curto.

## Como funciona o orçamento

Não há tabela de preço publicada, porque o que determina o custo é o escopo, o
estado do sistema que vai receber a integração e o prazo. O caminho é uma
conversa curta e então uma proposta com escopo e valor fechados por escrito,
antes de qualquer trabalho começar. Estimativa de ordem de grandeza para
decidir se vale continuar: é só pedir.

## O que incluir na mensagem

Qual é o problema (não a solução já imaginada), que sistema existe hoje, qual
prazo importa, e se há orçamento definido. Link para repositório, protótipo ou
documento ajuda mais que descrição longa. Se for recrutamento: formato
(efetivo ou contrato, remoto ou presencial) e faixa.

${footer()}`
}

export function privacyMarkdown(): string {
  return `# Privacidade — Marcus Boni

> Portfólio pessoal. Não vende nada, não tem publicidade e **não usa cookies**.
> Coleta duas coisas: mensagens do formulário de contato e estatísticas de
> acesso anônimas.

## Controlador

Marcus Evandro Galvão Boni, pessoa física, Espírito Santo, Brasil. Contato para
qualquer assunto relativo a dados, incluindo pedidos de titular:
mgalvaoboni@gmail.com. Não há encarregado (DPO) designado.

## Formulário de contato

Grava exatamente os campos preenchidos — nome, e-mail e mensagem — mais o
idioma do site, o domínio de origem, um país estimado e a data.

- **Base legal**: providências preliminares a pedido do titular.
- **Finalidade**: responder. As mensagens não alimentam lista de e-mail, não
  são usadas para marketing e não são compartilhadas.
- **Retenção**: enquanto a conversa for relevante; exclusão imediata a pedido.

## Estatísticas de acesso

Analytics próprio, de primeira parte. Sem cookies, sem Google Analytics, sem
qualquer script de terceiro, sem geolocalização por IP. Por evento:

- Um identificador aleatório no \`localStorage\` e outro no \`sessionStorage\`,
  que morre ao fechar a aba. Números aleatórios, não perfis.
- Página visitada, horário e qual evento ocorreu.
- Tipo de dispositivo, navegador, sistema operacional, resolução e idioma.
- Site de origem, quando há.
- Fuso horário, do qual se estima um país — aproximação deliberada.

- **Base legal**: legítimo interesse.
- **Retenção**: 12 meses.

A preferência de idioma (\`mb-locale\`) também fica no navegador. Limpar os
dados do site apaga tudo isso.

## Operadores

- **Google (Firebase / Cloud Firestore)** — armazenamento.
- **Netlify** — hospedagem; mantém registros de acesso próprios, que incluem
  endereço IP, sob a política deles.

Ambos operam servidores fora do Brasil, então há transferência internacional.
Nada é vendido, alugado ou compartilhado com terceiro comercial.

## Direitos (LGPD, Lei 13.709/2018)

Confirmação de tratamento, acesso, correção, anonimização ou eliminação,
portabilidade, informação sobre compartilhamento, e revogação de consentimento.
Para exercer qualquer um: mgalvaoboni@gmail.com.

## Mudanças

Alterações aparecem no repositório público do site, com histórico:
https://github.com/Marcus-Boni/Marcus-Boni-Portfolio

${footer()}`
}

/* ─── 404 ───────────────────────────────────────────────────────────────── */

/**
 * Body for a 404, in Markdown.
 *
 * A 404 is a routing answer, and for an agent it is also a chance to recover:
 * naming the real entry points here is the difference between "this site has
 * nothing" and "you looked in the wrong place, try these".
 */
export function notFoundMarkdown(pathname: string): string {
  return `# 404 — Not found

\`${pathname}\` does not exist on marcusboni.com.br.

This site is a personal portfolio and technical blog. Its complete surface is:

- [\`/\`](${SITE_URL}/) — profile, projects, client work, stack, contact
- [\`/blog\`](${SITE_URL}/blog) — technical notes and write-ups
- [\`/developers\`](${SITE_URL}/developers) — every machine-readable endpoint
- [\`/sitemap.xml\`](${SITE_URL}/sitemap.xml) — the authoritative URL list
- [\`/llms.txt\`](${SITE_URL}/llms.txt) — condensed guide for language models
- [\`/agent-instructions.md\`](${SITE_URL}/agent-instructions.md) — when to use this site

There is no API, no \`/docs\`, and no authenticated area other than \`/admin\`,
which is disallowed in \`robots.txt\` and of no use without credentials. If you
were probing for an endpoint, \`/sitemap.xml\` is the complete answer.
`
}

/* ─── /blog ─────────────────────────────────────────────────────────────── */

function postLine(post: DocPost, lang: BlogLocale, langs: BlogLocale[]): string {
  const view = localizedMeta({ ...post, status: post.status ?? 'published' }, lang)
  const href = postCanonicalUrl({ ...post, status: post.status ?? 'published' }, lang)
  const date = (post.publishedAt ?? post.updatedAt).slice(0, 10)
  const tags = view.tags.length > 0 ? ` · ${view.tags.join(', ')}` : ''
  const dek = view.excerpt || view.subtitle
  const langLabel = langs.length > 1 ? langs.join('/') : view.lang
  return [
    `### [${view.title}](${href})`,
    '',
    `${date} · ${langLabel} · ${view.readingMinutes} min read${tags}`,
    ...(dek ? ['', dek] : []),
    '',
  ].join('\n')
}

/** The blog index as Markdown. An empty list is a valid answer, not an error. */
export function blogIndexMarkdown(posts: readonly DocPost[], lang: BlogLocale = 'pt'): string {
  const entries = collapseLegacyPairs(
    posts.map((post) => ({ ...post, status: post.status ?? 'published' })),
    lang,
  )
  const body =
    entries.length > 0
      ? entries.map(({ post, availableLangs: langs }) => postLine(post, lang, langs)).join('\n')
      : 'No posts published yet.\n'

  const heading = lang === 'en' ? '# Field notes — Marcus Boni' : '# Notas de campo — Marcus Boni'
  const otherIndex =
    lang === 'en'
      ? `Portuguese index: [${SITE_URL}/blog](${SITE_URL}/blog)`
      : `English index: [${SITE_URL}/en/blog](${SITE_URL}/en/blog)`

  return `${heading}

> Technical journal: market studies, project write-ups, and notes worth
> sharing in a meeting. Bilingual entries can be read in Portuguese (\`/blog/{slug}\`)
> or English (\`/en/blog/{slug}\`) from a single publication.

Feed: [${SITE_URL}/rss.xml](${SITE_URL}/rss.xml) · ${otherIndex}

## Posts

${body}
${footer()}`
}

/* ─── /blog/{slug} ──────────────────────────────────────────────────────── */

/** Escapes a value for a double-quoted YAML scalar. */
function yaml(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/**
 * Resolves the `media:{id}` references the renderer understands into real
 * URLs. The Markdown source uses them so the React renderer can emit a full
 * `srcset` plus a blur-up placeholder (see `src/blog/types.ts`); an agent
 * needs a URL it can actually fetch.
 */
export function resolveMedia(body: string, media: DocMedia = {}): string {
  return body.replace(
    /!\[([^\]]*)\]\(media:([A-Za-z0-9_-]+)\)/g,
    (match, alt: string, id: string) => {
      const ref = media[id]
      if (!ref) return match
      return `![${alt || ref.alt || ''}](${ref.src})`
    },
  )
}

/**
 * One post as Markdown: YAML front matter, then the author's own Markdown
 * source. This is the "source-of-truth" approach acceptmarkdown.com
 * recommends — posts are *written* in Markdown and stored that way, so the
 * Markdown representation is the original, not a conversion of the HTML.
 */
export function postMarkdown(
  post: DocPost,
  body: string,
  media: DocMedia = {},
  lang: BlogLocale = post.lang,
): string {
  const normalized = { ...post, status: post.status ?? 'published' }
  const view = localizedMeta(normalized, lang)
  const activeLang = view.lang
  const url = postCanonicalUrl(normalized, activeLang)
  const langs = availableLangs(normalized)
  const bilingual = isBilingual(normalized)
  const otherLang: BlogLocale = activeLang === 'pt' ? 'en' : 'pt'

  const front = [
    '---',
    `title: ${yaml(view.title)}`,
    ...(view.subtitle ? [`subtitle: ${yaml(view.subtitle)}`] : []),
    ...(view.excerpt ? [`description: ${yaml(view.excerpt)}`] : []),
    `url: ${yaml(url)}`,
    `lang: ${yaml(activeLang === 'pt' ? 'pt-BR' : 'en')}`,
    ...(bilingual
      ? [
          `available_languages: [${langs.map((l) => yaml(l === 'pt' ? 'pt-BR' : 'en')).join(', ')}]`,
          `alternate_${otherLang}: ${yaml(postUrl(post.slug, otherLang))}`,
        ]
      : []),
    ...(post.publishedAt ? [`date_published: ${yaml(post.publishedAt)}`] : []),
    ...(post.updatedAt ? [`date_modified: ${yaml(post.updatedAt)}`] : []),
    `reading_minutes: ${view.readingMinutes}`,
    ...(view.tags.length > 0
      ? [`tags: [${view.tags.map(yaml).join(', ')}]`]
      : []),
    ...(!bilingual && post.translationOf
      ? [`translation_of: ${yaml(`${SITE_URL}/blog/${post.translationOf}`)}`]
      : []),
    'author: "Marcus Boni"',
    '---',
    '',
  ].join('\n')

  const content = resolveMedia(body, media).trim()
  const indexHref = bilingual && activeLang === 'en' ? `${SITE_URL}/en/blog` : `${SITE_URL}/blog`

  return `${front}# ${view.title}
${view.subtitle ? `\n_${view.subtitle}_\n` : ''}
${content}

---

Source: ${url} · More posts: ${indexHref} · Feed: ${SITE_URL}/rss.xml
`
}
