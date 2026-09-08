# Agent readiness

How this site behaves for the things that read it without a browser: crawlers,
retrieval pipelines, and agents fetching a URL to answer a question.

Four concerns, four places in the codebase. None of them is a React problem —
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

**The routing is subtle.** `agents.ts` declares itself inline only, never in
`netlify.toml`: it matches `/*` and relies on `excludedPattern` to stay off
hashed assets and `/admin`, and a `netlify.toml` declaration would be *merged*
with the inline one rather than replacing it, re-adding the paths it excludes.

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
- `public/developers/index.html` — the human-readable portal.

`/developers` is a standalone document, not a React route. Reference
documentation has no reason to wait for a bundle, and serving it as a file
means the delivered HTML carries its own `<title>` and canonical instead of
inheriting the SPA shell's. It is rewritten to its own file in `_redirects`
rather than leaning on the host to resolve a directory index — Netlify would,
`vite preview` would not, and a page that only exists in production is a page
nobody checks.

Its Markdown twin is `developersMarkdown()` in `agent-docs.ts`.
`tests/agent-docs.test.ts` asserts both name exactly the same endpoints.

**On "API keys and a sandbox".** The readiness model asks a developer portal for
both. This site is read-only and unauthenticated, so the honest answer is that
neither exists — every endpoint is the production endpoint and needs no
credentials, which makes the site its own sandbox. Issuing fake keys to score a
check would be worse than the check failing.

---

## Verifying

```bash
pnpm test          # 200+ assertions across the four concerns above
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
