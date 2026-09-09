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

const SITE_URL = 'https://marcusboni.com.br'

/** The subset of post metadata these documents render. */
export interface DocPost {
  slug: string
  lang: 'pt' | 'en'
  title: string
  subtitle: string
  excerpt: string
  tags: string[]
  readingMinutes: number
  publishedAt: string | null
  updatedAt: string
  translationOf: string | null
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

> Brazilian software engineer building robust, modern web applications.
> React, TypeScript, Next.js, and backend work in Node.js and C#.
> Based in Espírito Santo, Brazil. Software Developer at Optsolv since June 2024.

- **Name:** Marcus Boni (Marcus Evandro Galvão Boni)
- **Role:** Software Engineer — Software Developer at Optsolv (Jun 2024 — present)
- **Location:** Espírito Santo, Brazil
- **Email:** mgalvaoboni@gmail.com
- **GitHub:** https://github.com/Marcus-Boni (67 public repositories)
- **LinkedIn:** https://www.linkedin.com/in/marcus-boni-729a52243
- **Résumé:** [Portuguese](${SITE_URL}/marcus-boni-cv-pt.pdf) · [English](${SITE_URL}/marcus-boni-resume-en.pdf)
- **Languages:** Portuguese (native), English (professional)

## About

A Brazilian web developer who cares about building robust, modern
applications. Clean code, honest interfaces, and engineering measured by what
it simplifies for the people who use it. The public GitHub account carries 67
repositories — studies, tools and products, kept in the open.

## Selected projects

| Project | Year | Stack | What it is |
| --- | --- | --- | --- |
| [OptTime](https://github.com/Marcus-Boni/OptTime) | 2026 | TypeScript, React, AI Agents | Hackathon-born product exploring software development workflows orchestrated by AI agents — built under pressure, shipped in days. |
| [Estimativa de Horas](https://github.com/Marcus-Boni/Ferramenta-Estimativa-Horas) | 2026 | TypeScript, Azure DevOps, React | A web tool that replaced fragile Excel spreadsheets for task-hour estimation, pulling work items straight from Azure DevOps. |
| [Vault Chatbot](https://github.com/Marcus-Boni/chatbot-template) | 2026 | TypeScript, LLM, RAG | A chatbot grounded in Obsidian vaults, answering questions over company meeting transcriptions instead of letting them rot in folders. |
| [Jarvis](https://github.com/Marcus-Boni/Jarvis) | 2026 | Python, Automation | A personal assistant system automating the daily rituals of a working software developer — one routine at a time. |
| [Opt Gestão](https://github.com/Marcus-Boni/Opt-Gestao-Projetos) | 2026 | TypeScript, React, PostgreSQL | Project administration application built for real company use — planning, tracking and shipping without ceremony. |

## Professional experience

**Software Developer — Optsolv** (June 2024 — present). Client work delivered
end to end, across seven sectors:

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

- **Interface:** React, Next.js, TypeScript, Tailwind CSS, React Native
- **Services:** C#, Java, Python, Node.js
- **Data:** PostgreSQL, SQL Server, Supabase, Firebase
- **Infrastructure:** Docker, Azure, Azure DevOps

## Writing

Technical notes, market studies and project write-ups live at
[${SITE_URL}/blog](${SITE_URL}/blog), with a feed at
[${SITE_URL}/rss.xml](${SITE_URL}/rss.xml).

## Contact

Email **mgalvaoboni@gmail.com** for freelance or full-time work, technical
consulting, or a second opinion on a front-end or integration problem.
GitHub and LinkedIn are the other two public channels. There is no phone
number, calendar link or chat widget on this site — email is the front door.

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

function postLine(post: DocPost): string {
  const date = (post.publishedAt ?? post.updatedAt).slice(0, 10)
  const tags = post.tags.length > 0 ? ` · ${post.tags.join(', ')}` : ''
  const dek = post.excerpt || post.subtitle
  return [
    `### [${post.title}](${SITE_URL}/blog/${post.slug})`,
    '',
    `${date} · ${post.lang} · ${post.readingMinutes} min read${tags}`,
    ...(dek ? ['', dek] : []),
    '',
  ].join('\n')
}

/** The blog index as Markdown. An empty list is a valid answer, not an error. */
export function blogIndexMarkdown(posts: readonly DocPost[]): string {
  const body =
    posts.length > 0
      ? posts.map(postLine).join('\n')
      : 'No posts published yet.\n'

  return `# Notas de campo — Marcus Boni

> Technical journal: market studies, project write-ups, and notes worth
> sharing in a meeting. Written in Portuguese and English; each post declares
> its own language.

Feed: [${SITE_URL}/rss.xml](${SITE_URL}/rss.xml)

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
export function postMarkdown(post: DocPost, body: string, media: DocMedia = {}): string {
  const front = [
    '---',
    `title: ${yaml(post.title)}`,
    ...(post.subtitle ? [`subtitle: ${yaml(post.subtitle)}`] : []),
    ...(post.excerpt ? [`description: ${yaml(post.excerpt)}`] : []),
    `url: ${yaml(`${SITE_URL}/blog/${post.slug}`)}`,
    `lang: ${yaml(post.lang === 'pt' ? 'pt-BR' : 'en')}`,
    ...(post.publishedAt ? [`date_published: ${yaml(post.publishedAt)}`] : []),
    ...(post.updatedAt ? [`date_modified: ${yaml(post.updatedAt)}`] : []),
    `reading_minutes: ${post.readingMinutes}`,
    ...(post.tags.length > 0
      ? [`tags: [${post.tags.map(yaml).join(', ')}]`]
      : []),
    ...(post.translationOf
      ? [`translation_of: ${yaml(`${SITE_URL}/blog/${post.translationOf}`)}`]
      : []),
    'author: "Marcus Boni"',
    '---',
    '',
  ].join('\n')

  const content = resolveMedia(body, media).trim()

  return `${front}# ${post.title}
${post.subtitle ? `\n_${post.subtitle}_\n` : ''}
${content}

---

Source: ${SITE_URL}/blog/${post.slug} · More posts: ${SITE_URL}/blog · Feed: ${SITE_URL}/rss.xml
`
}
