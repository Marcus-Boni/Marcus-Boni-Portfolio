# Blog — arquitetura, publicação e sintaxe

O blog vive em `/blog`, é escrito em Markdown pelo `/admin/blog` e guardado no
Firestore. Este documento cobre o que você precisa fazer uma vez (deploy), o que
faz toda semana (escrever) e o que precisa saber antes de mexer no código.

---

## 1. Configuração — uma vez só

### 1.1 Plano Blaze + Storage

O upload de imagens usa o Firebase Storage, que exige o plano **Blaze**. O custo
fica baixo de propósito: o navegador reduz e recodifica cada imagem para WebP em
três larguras **antes** de enviar, então o bucket guarda só o que o site serve —
sem Cloud Functions, sem extensão de resize, sem CDN de imagem.

No console do Firebase: **Storage → Começar**, e anote o bucket
(`<projeto>.firebasestorage.app`).

### 1.2 Publicar regras e índice

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

- `firestore.rules` — leitura pública de posts `published` e `unlisted`;
  rascunhos e qualquer escrita só com login.
- `firestore.indexes.json` — o índice composto `status + publishedAt` que o
  índice público exige. **Sem ele a listagem falha.**
- `storage.rules` — leitura pública em `/blog/**`, escrita só autenticada, com
  teto de 10 MB e tipo restrito.

> Enquanto as regras não subirem, `/blog` mostra "Não foi possível carregar os
> registros" — é `permission-denied`, não um bug.

### 1.3 Variável de ambiente no Netlify

As edge functions leem o projeto por `VITE_FIREBASE_PROJECT_ID`. Ela já existe
para o build; confirme em **Site settings → Environment variables** que está
disponível também para *functions*. Sem ela as edge functions não quebram o
site — apenas não injetam nada e o sitemap cai no arquivo estático.

---

## 2. Escrever um post

`/admin/blog → Novo post`. O editor é split-pane: Markdown à esquerda, preview à
direita usando **o mesmo CSS do post publicado** — o que você vê é o resultado.

### Status

| Status | No índice, RSS e sitemap | Por link direto | Indexável |
| --- | --- | --- | --- |
| `draft` | não | não | não |
| `unlisted` | **não** | **sim** | não (`noindex`) |
| `published` | sim | sim | sim |

`unlisted` existe para o caso de compartilhar um estudo numa reunião interna
antes (ou em vez) de publicar.

### Idioma

Cada post nasce em um idioma. Preencha **Tradução** com o slug do par no outro
idioma só quando ele existir de fato — é isso que gera as tags `hreflang`, e
declarar um par inexistente é pior do que não declarar nada.

### Slug

O slug segue o título até você editá-lo à mão; depois disso ele é seu. Renomear
um post já publicado **quebra os links compartilhados** — o editor move o
documento, mas o endereço antigo passa a dar 404.

---

## 3. Sintaxe

Markdown com GFM (tabelas, listas de tarefas, `~~riscado~~`) mais estas
diretivas. HTML bruto **não** é interpretado, por segurança — todo embed rico
passa por um componente tipado.

### Callout

```md
:::callout{type=tip}
Corpo do aviso, com **Markdown** normal dentro.
:::
```

`type` aceita `info` (padrão), `tip`, `warn`, `danger`. `title` sobrescreve o
rótulo.

### Citação em destaque

```md
:::quote{cite="Alguém na retrospectiva"}
O texto da citação.
:::
```

### Galeria

```md
:::gallery{columns=2}
![Legenda A](media:abc12345)
![Legenda B](media:def67890)
:::
```

`columns` aceita `2` (padrão) ou `3`.

### Vídeo

```md
::youtube{id=dQw4w9WgXcQ title="Título do vídeo"}
::video{src=https://firebasestorage.../clipe.mp4 caption="Legenda" loop=true}
```

`::youtube` renderiza uma **fachada**: até o leitor clicar é só uma miniatura —
nenhum script ou cookie do YouTube é carregado. Use `::video` apenas para
clipes curtos e mudos (uma interação de UI, por exemplo); vídeo longo no
Storage é a linha mais imprevisível da fatura do Blaze.

### Card de repositório

```md
::repo{owner=Marcus-Boni name=OptTime desc="O que é" lang=TypeScript}
```

### Imagens

Imagens enviadas pelo editor entram como `![alt](media:{id})`, não como URL. É
isso que permite emitir `srcset` completo mais o placeholder de blur — coisa
impossível a partir de um `![alt](https://…)` solto. URLs externas continuam
funcionando, mas sem blur-up e sem reserva de espaço.

O `title` do Markdown vira a legenda:

```md
![Texto alternativo](media:abc12345 "Legenda que aparece sob a figura")
```

### Código

````md
```ts title="src/blog/service.ts"
export async function fetchPost(slug: string) {}
```
````

Linguagens com gramática carregada sob demanda: `typescript`, `tsx`,
`javascript`, `jsx`, `json`, `bash`, `sql`, `csharp`, `python`, `yaml`,
`docker`, `html`, `css`, `markdown`, `diff` (mais os apelidos usuais: `ts`,
`js`, `sh`, `py`, `yml`, `cs`…). Uma linguagem desconhecida cai para texto
puro em vez de quebrar.

---

## 4. Métricas

O desempenho de cada post aparece em **Audiência → Desempenho do blog**:
aberturas, leituras (rolagem até 75%), taxa de leitura e compartilhamentos. As
rotas do blog também emitem `pageview`, então aparecem em "Páginas mais vistas"
junto com o portfólio. Definições em [`ANALYTICS.md`](./ANALYTICS.md).

## 5. Arquitetura

### Dados

```
posts/{slug}                 metadados — o que o índice lista
posts/{slug}/content/main    { body: markdown, status, media }
```

A separação é o que mantém o índice barato: listar 40 posts baixa 40 documentos
pequenos, não 40 artigos inteiros. `status` é espelhado no documento do corpo e
escrito no **mesmo `writeBatch`**, para as regras poderem filtrar sem um `get()`
— um `get()` nas regras cobra uma leitura por requisição.

### SEO

Crawlers sociais (LinkedIn, Slack, WhatsApp, X) não executam JavaScript. Sem
tratamento, todo post compartilhado mostraria o card genérico do portfólio.

`netlify/edge-functions/blog-meta.ts` intercepta `/blog/*`, lê o post pela API
REST do Firestore e substitui o bloco delimitado por
`<!-- SEO:START -->…<!-- SEO:END -->` no `index.html` por `title`,
`description`, Open Graph, Twitter Card, `hreflang` e JSON-LD `BlogPosting`.
Qualquer imprevisto — projeto sem id, slug desconhecido, marcador ausente —
devolve a resposta intocada, então a falha degrada para o card padrão, nunca
para erro.

`src/blog/lib/seo.ts` escreve os **mesmos valores** no cliente, para a navegação
SPA (onde nenhum HTML novo é buscado) manter o documento honesto.

`netlify/edge-functions/feeds.ts` gera `/rss.xml` e `/sitemap.xml` a cada
requisição, então publicar não exige rebuild. `public/sitemap.xml` continua no
repositório como fallback: se o Firestore não responder, a função devolve o
arquivo estático em vez de um sitemap vazio — que para um buscador significa
"estas páginas sumiram".

### Performance — a restrição que não pode ser quebrada

A home carrega exatamente 4 chunks estáticos: `rolldown-runtime`, `react`,
`router`, `motion`. **O blog não adiciona nenhum.** Se você mexer no
`vite.config.ts` ou nos imports do blog, confirme com:

```bash
pnpm build && grep -o 'modulepreload[^>]*href="/assets/[^"]*"' dist/index.html
```

Duas armadilhas já pisadas:

1. **Não crie um `manualChunks` para a pipeline unified/remark/rehype.** Nomear
   um chunk faz o Rolldown tratá-lo como dependência *estática*, e ele reaparece
   como `modulepreload` na home — o mesmo modo de falha do `scheduler` dentro do
   chunk `three`. A fronteira certa é o `lazy()` de `BlogPost` dentro de
   `BlogApp`, que é o que mantém o renderer fora do índice.
2. **`@shikijs/langs` e `@shikijs/themes` ficam de fora da regra do Shiki.**
   Incluí-los força as gramáticas para dentro de um único chunk de 1,2 MB e
   destrói o carregamento por linguagem.

Perfil de carga resultante:

| Rota | Além do que a home já carrega |
| --- | --- |
| `/blog` | `BlogApp` + `text` + `usePosts` + `firebase` |
| `/blog/:slug` | acima + `BlogPost` + `PostBody` (~52 KB gz) |
| post com código | acima + `shiki` (~53 KB gz) + a gramática usada (~16 KB gz) |

O `shiki` é importado dinamicamente dentro do `CodeBlock`: um post sem bloco de
código não baixa highlighter nenhum.
