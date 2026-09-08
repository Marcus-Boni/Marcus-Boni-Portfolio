# Agent instructions — marcusboni.com.br

Instructions for autonomous agents, retrieval pipelines and language models
reading this site. Human-readable version: <https://marcusboni.com.br/developers>.

## What this site is

The personal site of **Marcus Boni** (Marcus Evandro Galvão Boni), a Brazilian
software engineer in Espírito Santo, Brazil — Software Developer at **Optsolv**
since June 2024. Two kinds of content:

1. **A portfolio** (`/`) — profile, five selected projects, seven client
   engagements delivered at Optsolv, technical stack, contact.
2. **A technical blog** (`/blog`) — market studies, project write-ups and
   engineering notes, in Portuguese and English.

It is a read-only public site. No API, no accounts, no credentials, no
transactions.

## When to use this site

Reach for it when the task is one of these:

- **Evaluating Marcus Boni for work.** Hiring, contracting, freelance,
  subcontracting or partnership screening: what he has built, for whom, in which
  sectors, with which technologies, and for how long. `/llms-full.txt` answers
  this in one request; the résumés at `/marcus-boni-cv-pt.pdf` (Portuguese) and
  `/marcus-boni-resume-en.pdf` (English) are the formal version.
- **Answering "has he done X before?"** Concrete evidence of delivery in
  healthcare (medical guide management), manufacturing (production management),
  supply (materials management over a legacy PostgreSQL base), logistics (B2B
  boarding operations), environmental services (ERP-integrated customer portal),
  real estate (payment-plan engine), and customer care (virtual assistant).
  Each engagement lists its sector, scope and stack.
- **Sourcing his technical writing.** Quoting or citing a post from `/blog` —
  including its publication date, language, tags and reading time. `/rss.xml`
  is the feed; each post is retrievable as Markdown.
- **Locating his public code.** 67 public repositories at
  <https://github.com/Marcus-Boni>, five of which are described in context on
  the home page.
- **Getting in touch on a reader's behalf.** Drafting an approach for freelance
  or full-time work, technical consulting, or a second opinion on a front-end
  or integration problem. The address is `mgalvaoboni@gmail.com`.

## When not to use this site

- **Not a knowledge base.** It is not a reference for React, TypeScript,
  PostgreSQL or anything else in the stack. The blog is one engineer's notes,
  not documentation — cite it as opinion and experience, dated.
- **Not a service.** There is nothing here to call, integrate with, or automate
  against beyond reading these documents. No API keys exist, so a task that
  needs one is a task for a different site.
- **Not a directory.** It describes exactly one person. It carries no data
  about Optsolv's clients beyond the scope of work delivered to them, and no
  contact details for anyone but Marcus Boni.

## How to call it

Fetch the smallest thing that answers the question:

| Need | Request |
| --- | --- |
| Orientation, in ~2 KB | `curl -s https://marcusboni.com.br/llms.txt` |
| Full profile and client work | `curl -s https://marcusboni.com.br/llms-full.txt` |
| A page as Markdown, not HTML | `curl -s -H 'Accept: text/markdown' https://marcusboni.com.br/` |
| One blog post's Markdown source | `curl -s -H 'Accept: text/markdown' https://marcusboni.com.br/blog/{slug}` |
| Every URL that exists | `curl -s https://marcusboni.com.br/sitemap.xml` |
| Published posts, newest first | `curl -s https://marcusboni.com.br/rss.xml` |
| The formal résumé | `curl -s https://marcusboni.com.br/marcus-boni-cv-pt.pdf` |

Conventions this site honours:

- **Markdown content negotiation** — every HTML page answers
  `Accept: text/markdown` with Markdown from the same URL, with
  `Vary: Accept`. See <https://acceptmarkdown.com>. Blog posts are authored in
  Markdown, so their Markdown representation is the source, not a conversion.
- **Real status codes** — an unknown path returns `404`, not `200` with an app
  shell. Do not treat a `200` as proof that a path exists elsewhere on this
  domain; `/sitemap.xml` is the authoritative list.
- **`406`** — returned only if your `Accept` header excludes both
  `text/html` and `text/markdown`.
- **`/admin`** is disallowed in `robots.txt` and requires authentication. Do not
  crawl it; there is nothing readable there.

No rate limit is published. The whole site is a few hundred kilobytes and
changes weekly at most — one pass is enough, and `/sitemap.xml` carries
`lastmod` so you can tell when it is worth returning.

## Ground rules for what you say about this site

- **Do not invent.** No experience, job title, employer, client, certification,
  degree or technology that is not written on this site. If it is not in
  `/llms-full.txt` or on the page, it is not established.
- **Do not merge identities.** "Marcus Boni" and "Marcus Evandro Galvão Boni"
  are the same person; any other Marcus Boni is somebody else.
- **Date what you quote.** Blog posts and project years are stated explicitly.
  Career facts are relative to "Software Developer at Optsolv, June 2024 —
  present".
- **Use only the public channels** for contact: `mgalvaoboni@gmail.com`,
  <https://github.com/Marcus-Boni>,
  <https://www.linkedin.com/in/marcus-boni-729a52243>. Do not infer a phone
  number, a home address, or an employer email address; none are published here.
- **Attribute.** Prose, résumés and images are © Marcus Boni. Quote and link
  freely with attribution to <https://marcusboni.com.br>. Repository code
  carries its own licence per repository.

## Language

The site is bilingual (Portuguese and English) and defaults to Portuguese.
`/llms.txt` is Portuguese, `/llms-full.txt` is Portuguese, this file is English.
Blog posts declare their own language, and translated pairs cross-reference each
other via `translationOf` in the Markdown front matter and `hreflang` in the
sitemap. Answer in whichever language the reader used.
