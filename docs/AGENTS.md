# Agent readiness

How this site behaves for the things that read it without a browser: crawlers,
retrieval pipelines, and agents fetching a URL to answer a question.

Five concerns, five places in the codebase. None of them is a React problem —
all of it has to be true of the *delivered response*, before any JavaScript
runs.

---

## 1. Real 404s

**The bug it fixes.** `public/_redirects` used to end with `/* /index.html 200`.
Every URL on the domain answered 200 with the app shell, so `/api`, `/docs` and
`/.well-known/anything` all reported themselves as existing. An agent probing
for endpoints concluded the site had all of them; a crawler could index
unlimited duplicates of the same page.

**How it works now.**

| Layer | File | Job |
| --- | --- | --- |
| Routing | `public/_redirects` | Enumerates the real routes. Anything else matches no rule and no file. |
| Fallback | `public/404.html` | Netlify serves it with a real 404 status for unmatched requests. |
| Blog | `netlify/edge-functions/blog-meta.ts` | `/blog/{slug}` resolves to the shell either way; whether the *slug* exists is a Firestore question, so the status is set after the lookup. |
| Markdown | `netlify/edge-functions/agents.ts` | The Markdown representation of a 404. |

Adding a client route means touching three files: the `<Route>` in
`src/main.tsx`, the rewrite in `public/_redirects`, and the entry in
`netlify/lib/routes.ts`. `tests/routes.test.ts` fails if they
disagree — which is the point of keeping the table.

`blog-meta` only 404s when Firestore *definitely* says the slug is missing.
`firestore.ts` distinguishes `missing` (404/403 — a draft is 403, and "not
found" is the right answer for a crawler) from `unavailable` (5xx, network
error, no project id). Collapsing the two would turn a database blip into
"every post on this site is gone".

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://marcusboni.com.br/nope        # 404
curl -s -o /dev/null -w '%{http_code}\n' https://marcusboni.com.br/blog/nope   # 404
curl -s -o /dev/null -w '%{http_code}\n' https://marcusboni.com.br/            # 200
```

## 2. Content without JavaScript

`index.html` used to ship the hero shell and nothing else — roughly 200
characters, which is all a non-executing crawler ever saw of the site.

`#static-content` now sits after `#hero-shell`, inside `#root`, and carries the
substance of the page in plain HTML: about, the five projects, the seven client
engagements, the stack, contact, and links to `/blog`, `/developers`,
`/llms.txt` and the feeds. About 2,300 characters of text in the delivered
document.

Nobody sees it who has JavaScript. `#hero-shell` is `h-svh`, so the block
starts a full viewport down, and `createRoot().render()` clears `#root` on
mount long before a visitor could scroll to it. Without JavaScript it simply
stays, which is a better answer than a blank page. The inline script that drops
`#hero-shell` off-route drops this too, or `/blog` and `/admin` would flash the
portfolio.

Keep the copy true to `src/i18n/translations.tsx` and `src/data/profile.ts`.
`tests/static-content.test.ts` asserts every project, client and technology in
`profile.ts` appears in the raw HTML, so a rename in one place fails the suite
rather than quietly making the crawlable copy wrong.

## 3. Markdown content negotiation

Every HTML document also answers `Accept: text/markdown` from the same URL,
per [acceptmarkdown.com](https://acceptmarkdown.com).

- `netlify/lib/accept.ts` — the parser. Ranks by q, breaks ties by
  specificity, treats `q=0` as a refusal. The conformance vectors from the spec
  are in `tests/accept.test.ts`.
- `netlify/lib/agent-docs.ts` — the documents. Pure functions, so
  the drift tests can hold them against `profile.ts`.
- `netlify/edge-functions/agents.ts` — the handler.

| `Accept` | Response |
| --- | --- |
| absent, `*/*`, `text/html` | `text/html` |
| `text/markdown` | `text/markdown; charset=utf-8` |
| `text/markdown;q=0` | `text/html` — a refusal, not a 406 |
| `application/pdf` | `406`, body listing both representations |

Every response — HTML included — carries `Vary: Accept`. Without it a shared
cache hands whichever variant it stored first to everyone.

Blog posts are *authored* in Markdown and stored that way, so their Markdown
representation is the source rather than a conversion of the HTML.
`media:{id}` references are resolved to real URLs on the way out; they are
meaningless outside the React renderer.

**The handler asks the origin; it does not guess.** `agents.ts` produces a
representation only for the routes in the table. Everything else — every static
file, `/admin`, and every path that does not exist — goes to `context.next()`,
and only a genuine 404 coming back is restated as Markdown.

That structure is not decoration. The first version trusted its own routing
config to keep it away from static files, matching `/*` with an
`excludedPattern` list. Netlify pairs `excludedPattern` with `pattern` and
silently ignores it next to `path`, so the exclusions never applied — and
because the handler read "not an app route" as "does not exist", `/llms.txt`,
`/robots.txt`, `/sitemap.xml` and every PDF answered **404**, while
`Accept: text/plain` on a text/plain file got a **406** claiming the resource
only came in HTML and Markdown. Every local test passed; only a deploy showed
it.

`excludedPath` (the form that does go with `path`) is still declared, but now
purely to save invocations on hashed assets. If it were ignored again the site
would still be correct, just slightly busier.

`agents.ts` also declares itself inline only, never in `netlify.toml`: a
declaration there is *merged* with the inline one rather than replacing it,
which would re-add the paths it excludes.

There is no `method` filter either. Netlify's `HTTPMethod` union has no `HEAD`
— the platform answers HEAD from the GET path — so listing `['GET']` would risk
the function being skipped for `curl -sI`, which is the command
acceptmarkdown.com tells implementers to verify with. The handler filters
methods itself, where a test can reach it.

### Shared code goes in `netlify/lib/`, never in `netlify/edge-functions/`

Netlify packages **every** `.ts` file at the top level of
`netlify/edge-functions/` as an edge function and requires each one to
default-export a function. It does *not* skip names beginning with `_` — that
convention belongs to Netlify *Functions*. A helper module parked there kills
the deploy:

```
Default export in '…/netlify/edge-functions/_accept.ts' must be a function.
```

This is worth knowing because of *when* it fails: `pnpm test` passes, `pnpm
build` passes, and the deploy dies afterwards in the bundling step, so nothing
you can run locally catches it. `tests/edge-functions.test.ts` now does —
it enumerates the directory and asserts every file default-exports a handler
and declares a `config.path`.

## 4. Agent instructions and the developer portal

- `public/agent-instructions.md` — when to use this site, when not to, how to
  call it, and the ground rules for what to say about it.
- `public/llms.txt` — same guidance in condensed form, plus the section index.
- `public/developers.html` — the human-readable portal.

**`llms.txt` is written in English, on purpose.** The first version had the
guidance under `## Quando usar este site`, with the English `## When to use
this site` only in `agent-instructions.md`. The readiness check reads
`llms.txt` — it picks up other things from that file — and did not recognise
the section, so the check kept failing while the content was demonstrably
there. The file is read by machines, so its headings are English now. The
*site* stays bilingual and `llms-full.txt` is still Portuguese.

`/developers` is a standalone document, not a React route. Reference
documentation has no reason to wait for a bundle, and serving it as a file
means the delivered HTML carries its own `<title>` and canonical instead of
inheriting the SPA shell's.

It is a **flat `public/developers.html`**, rewritten to itself in `_redirects`.
Both halves of that matter. As `public/developers/index.html` it worked, but
Netlify 301'd `/developers` to `/developers/` because a directory of that name
existed — so the canonical URL cost an extra round trip and disagreed with the
`<link rel="canonical">` on the page. And the explicit rewrite is what makes it
resolve under `vite preview`, which serves the SPA shell for any extensionless
path; a page that only works in production is a page nobody checks.

Its Markdown twin is `developersMarkdown()` in `agent-docs.ts`.
`tests/agent-docs.test.ts` asserts both name exactly the same endpoints.

**On "API keys and a sandbox".** The readiness model asks a developer portal for
both. The API is read-only and unauthenticated, so the honest answer is that
neither exists — every endpoint is the production endpoint and needs no
credentials, which makes the API its own sandbox. Issuing fake keys to score a
check would be worse than the check failing.

## 5. The JSON API

`/api/v1` publishes the same content the pages do, as typed JSON, described by
[OpenAPI 3.1](https://marcusboni.com.br/openapi.json). It exists so an agent can
*call* the site instead of parsing it — the readiness model's API checks
(`openapi-spec`, `json-error-responses`, `api-schema-analysis`,
`function-calling-compat`) all reduce to that.

**Two mechanisms, deliberately.**

| Endpoints | Served by | Why |
| --- | --- | --- |
| `/api/v1`, `/profile`, `/projects`, `/experience`, `/stack` | Static JSON in `public/api/v1/`, rewritten in `_redirects` | The content changes only on deploy. A file read beats an invocation. |
| `/api/v1/posts`, `/api/v1/posts/{slug}` | `netlify/edge-functions/api.ts` | Posts live in Firestore and appear on publish, without a rebuild. |

**Where the data comes from.** `src/data/profile.ts`, still the only source.
`src/data/api.ts` shapes it into payloads and `src/data/openapi.ts` builds the
specification from the same `OPERATIONS` list, so a documented endpoint that
does not exist is not expressible. `tests/api-payloads.test.ts` writes the
files with `toMatchFileSnapshot`, which means the committed JSON *is* the
assertion: edit `profile.ts` without regenerating and the suite fails, and the
Netlify build runs the suite.

```bash
pnpm test -u    # regenerate public/api/v1/*.json and public/openapi.json
```

**Errors.** Every failure under `/api/` is RFC 9457
`application/problem+json` — `netlify/lib/problem.ts` — with a stable `code` and
a `hint` naming the next request to make. `api.ts` deliberately does **not** set
`onError: 'bypass'`: the bypass target is `public/404.html`, and handing an HTML
page to a JSON client is the exact failure the endpoint exists to prevent.

For the same reason `agents.ts` now converts a 404 to Markdown only when the
origin's own 404 was HTML. Without that guard it would have rewritten
`problem+json` into prose.

**Why 3.1 rather than 3.0.** 3.1 is JSON Schema 2020-12 compatible, so the
schemas can go straight into a tool-calling runtime. `tests/openapi.test.ts`
asserts what makes that work — unique `operationId`s, a description long enough
to decide on, typed parameters, a named response schema per operation, and no
dangling or unused `$ref`.

---

## Verifying

```bash
pnpm test          # 300+ assertions across the five concerns above
pnpm build         # tsc -b now covers netlify/ too
```

`tsconfig.test.json` is what puts `netlify/` under the typechecker. It was
unchecked before — nothing included it — which is how `agents.ts` nearly
shipped a `method: ['HEAD']` past a union with no `HEAD` in it.

Against a deploy:

```bash
curl -sI -H 'Accept: text/markdown' https://marcusboni.com.br/   # content-type + vary
curl -s  -H 'Accept: text/markdown' https://marcusboni.com.br/   # the document
curl -s -o /dev/null -w '%{http_code}\n' -H 'Accept: application/pdf' \
     https://marcusboni.com.br/                                  # 406
curl -s -o /dev/null -w '%{http_code}\n' https://marcusboni.com.br/nope  # 404
```

The readiness check itself lives at
<https://is-agentic.com/scan/marcusboni.com.br>.
