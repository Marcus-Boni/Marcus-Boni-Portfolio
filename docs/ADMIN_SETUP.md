# Admin setup

Everything `/admin` needs to work, and what each screen is for. The area is
optional by construction: with no Firebase config the public site runs on
`src/data/profile.ts` and the admin renders in **demo mode** — navigable, with
nothing to read and nothing to save.

---

## 1. Firebase project

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Build → Authentication → Sign-in method**: enable **Email/Password**.
   Leave every other provider off, and do **not** enable self-signup flows you
   do not need — see the uid note in §3.
3. **Build → Authentication → Users**: add your own user (e-mail + password).
   This is the only account that will ever sign in.
4. **Build → Firestore Database**: create a database in production mode, region
   `southamerica-east1` (São Paulo) unless you have a reason to pick another.
5. **Build → Storage**: needed only for blog images, and it requires the
   **Blaze** plan. Without it everything else still works; image upload is the
   single feature that fails.
6. **Project settings → General → Your apps → Web app**: register one and copy
   the config values.

## 2. Environment

Copy `.env.example` to `.env` and fill it in:

```bash
VITE_FIREBASE_API_KEY=…
VITE_FIREBASE_AUTH_DOMAIN=…
VITE_FIREBASE_PROJECT_ID=…
VITE_FIREBASE_STORAGE_BUCKET=…
VITE_FIREBASE_MESSAGING_SENDER_ID=…
VITE_FIREBASE_APP_ID=…
```

Three of them are load-bearing — `API_KEY`, `PROJECT_ID` and `APP_ID` are what
`isFirebaseConfigured` checks. **Ajustes** lists all six with their state, so a
missing one is a line you can read instead of a mystery.

These values are **inlined into the bundle at build time**. Changing `.env`
means a new build and a new deploy; there is no runtime config. That is also why
the web API key is public by construction — it identifies the project, it does
not authorise anything. Authorisation lives entirely in the rules below.

On Netlify, set the same variables in **Site configuration → Environment
variables**, and make sure `VITE_FIREBASE_PROJECT_ID` is exposed to **functions**
too: the edge functions that render per-post SEO, `/rss.xml` and `/sitemap.xml`
read it (see [`BLOG.md`](./BLOG.md)).

## 3. Rules — the part that actually protects anything

Both rule files pin **one uid**:

```
function isAdmin() {
  return request.auth != null && request.auth.uid == 'FG69ZSmr9kZcA15R3fLaf4khAqm1';
}
```

"Anyone who managed to authenticate" would be the wrong bar: if the
Email/Password provider ever allows self-signup, a stranger would get write
access to site content and read access to every contact message. The uid is an
identifier, not a credential — it grants nothing without authenticating as that
account, which is why it is safe in a public repo.

Your uid is printed in **Ajustes → Status da conexão**, with a copy button.
Paste it into both files and deploy:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

| File | Covers |
| --- | --- |
| `firestore.rules` | `content/site`, `messages`, `analytics`, `settings`, `posts` (+ post bodies) |
| `firestore.indexes.json` | the one composite index the public blog index needs |
| `storage.rules` | `blog/**` — world-readable, admin-writable, ≤10 MB, images/video only |

Adding a second admin means adding their uid to both files and redeploying.

## 4. First run

```bash
pnpm dev
```

Open `/admin/login`, sign in with the user from §1. What to expect:

- **Painel** shows real numbers only after the site has traffic; an empty
  install shows zeros and the attention panel.
- **Audiência** may show a `failed-precondition` error the first time a range is
  queried. The banner carries Firestore's own message, and that message contains
  a one-click "create index" console link. Creating it takes a minute or two.
- **Mensagens** fills up from the public contact form.
- **Conteúdo** (Projetos / Carreira / Perfil) starts from `src/data/profile.ts`
  and writes to `content/site` on the first save.

---

## The screens

| Route | What it is for |
| --- | --- |
| `/admin` | Pending items first (unread messages, open drafts, content gaps — each row links to the field that fixes it), then the 7-day numbers. |
| `/admin/analytics` | The full audience view: window picker, comparisons, heat map, blog read-through, CSV export. Definitions in [`ANALYTICS.md`](./ANALYTICS.md). |
| `/admin/messages` | Inbox: search, list + detail, reply pre-addressed and pre-quoted, CSV export. Opening a message marks it read. |
| `/admin/blog` | Every post including drafts. Publish/unpublish without opening the editor, duplicate, delete. Recovers browser-local drafts. |
| `/admin/blog/:slug` | Split-pane Markdown editor, live preview with the published post's CSS, publish checklist, cover + alt, publish date, translation pair. |
| `/admin/media` | The Storage bucket, grouped by post. Flags folders with no matching post as *órfã* — that is orphaned weight you are paying for. |
| `/admin/projects` | The Trabalho section. Collapsed rows, drag or ↑/↓ to reorder, duplicate, per-field validation. |
| `/admin/experience` | Career timeline: role, dates (with `AAAA-MM` validation and a computed duration) and one entry per client. |
| `/admin/profile` | Identity, bio, availability, tech stack grouped by category, social links. |
| `/admin/settings` | Connection diagnostics, env-var checklist, uid, JSON export/import with a diff preview, and the reset-to-defaults button. |

### Conventions worth knowing

- **Nothing publishes until you save.** Content pages collect changes in a
  session-wide draft — switching pages does not lose them — and the save bar
  names which sections are pending. `Ctrl+S` saves. The one exception is
  **Ajustes → Restaurar padrões**, which publishes immediately and says so.
- **Destructive actions are undoable where they can be.** Removing a project,
  an experience, a tech or a social link offers *Desfazer* in the toast. Post and
  message deletion, and Storage deletion, are permanent — export first.
- **The browser keeps a copy of the post you are writing** (`localStorage`,
  every 800 ms). If a tab dies, the editor offers the newer local copy on open
  and the blog list lists orphaned drafts.
- `Ctrl+K` opens the command palette (pages, posts, projects, actions). `?`
  lists every shortcut.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `modo demo` in the sidebar | One of the three required env vars is empty. **Ajustes** says which. |
| `permission-denied` reading analytics or messages | Rules not deployed, or the uid in `firestore.rules` is not the uid you are signed in as. |
| `failed-precondition` on a chart | Missing composite index. The banner's raw message has the create link. |
| `invalid-argument` on analytics | A `limit` above Firestore's hard maximum of 10.000. `MAX_EVENTS` must stay at 10.000; more history needs pre-aggregated rollups, not a bigger query. |
| Image upload fails with a Storage error | The project is on the free plan; Storage needs Blaze. |
| Edits vanish after a reload | They were never saved — the save bar was showing pending sections. The browser also warns before you close the tab. |
| Blog post 404s on the public site | Status is `draft`. `unlisted` opens by direct link but stays out of the index, RSS and sitemap. |

## Gates

```bash
pnpm build      # tsc -b + vite build
npx eslint .
pnpm test
```

After any change that touches chunking, confirm the home page still loads
exactly four static chunks — `rolldown-runtime`, `react`, `router`, `motion`:

```bash
grep -o 'modulepreload[^>]*href="/assets/[^"]*"' dist/index.html
```

Firebase, Three.js and the admin bundle must never appear there.
