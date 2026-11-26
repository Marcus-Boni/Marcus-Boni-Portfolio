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

`/admin/blog → Novo post` abre o editor no fluxo rápido: primeiro título,
visibilidade e escrita; depois detalhes editoriais e checklist. O modo inicial
prioriza a escrita. Você pode alternar para o preview ou para a visualização
dividida, que usa **o mesmo CSS do post publicado**.

### Começo rápido

No topo ficam os campos que decidem se o post já pode existir:

- **Título**: gera o slug enquanto você não editar o endereço manualmente.
- **Visibilidade**: `draft`, `unlisted` ou `published`.
- **Markdown**: corpo do artigo, com preview disponível na barra do editor.
- **Estruturas iniciais**: escolha explicação, tutorial ou estudo de caso, ou
  comece do zero. Substitua os trechos entre colchetes antes de publicar.

Salve cedo. O editor guarda rascunhos locais, mas o Firestore é a fonte de
verdade assim que você publica ou compartilha um link.

### Visibilidade

| Status | No índice, RSS e sitemap | Por link direto | Indexável |
| --- | --- | --- | --- |
| `draft` | não | não | não |
| `unlisted` | **não** | **sim** | não (`noindex`) |
| `published` | sim | sim | sim |

`unlisted` existe para compartilhar um estudo em revisão, reunião interna ou
pré-lançamento sem colocá-lo no índice público.

### Detalhes e checklist

Depois que o texto principal estiver de pé, preencha os detalhes:

- **Resumo**: alimenta cards, meta description, RSS e respostas de agentes (por idioma).
- **Tags**: ajudam o índice e agrupam assuntos recorrentes (por idioma).
- **Capa e alt text**: uma capa compartilhada para a publicação, com alt/legenda adaptáveis por idioma.
- **Idiomas (PT e EN na mesma publicação)**: toda publicação é um único registro
  com abas **Português** e **English** dentro do mesmo editor. Preencha só um
  idioma ou os dois — sem duplicar posts nem ligar `translationOf` na mão.
  Quando a publicação tem os dois idiomas, o leitor alterna entre PT e EN
  dentro do mesmo artigo: o português vive em `/blog/{slug}` e o inglês em
  `/en/blog/{slug}`, com `hreflang` recíproco automático, mesma prancha, mesmo
  número (`Nº`) e uma única entrada no índice e no RSS. Publicações antigas
  criadas separadas por `translationOf` podem ser unificadas com um clique no
  topo de `/admin/blog`.

O checklist mostra pontos de atenção sobre título, URL, resumo, capa, tags e
estrutura do texto antes de trocar a visibilidade para `published`.

### Slug

O slug segue o título até você editá-lo à mão; depois disso ele é seu. Renomear
um post já publicado **quebra links compartilhados**: o editor move o documento,
mas o endereço antigo passa a dar 404.

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

### Ideias-chave

```md
:::takeaways
- Uma ideia por linha.
- O que o leitor deve levar do registro.
:::
```

Vira o bloco "Em resumo". `title` troca o rótulo: `:::takeaways{title="O que aprendi"}`.

### Comparação da tela de exportação

```md
:::report-comparison
Antes, a tela fica em silêncio. Depois, ela confirma que o CSV está pronto.
:::
```

O bloco exibe o antes e depois do exemplo de exportação. O texto dentro da
diretiva descreve as diferenças e aparece também no HTML sem JavaScript.

### Notas de margem

Use a nota de rodapé do Markdown. O botão **margem** do editor insere a marca
onde está o cursor e abre a nota no fim do texto:

```md
A API devolve no máximo duzentos itens por chamada.[^limite]

[^limite]: O limite é da API, não da aplicação.
```

Em tela larga a nota aparece na margem, na altura da frase que a cita. Em tela
estreita o número vira um botão e a nota abre embaixo da frase. O nome entre
colchetes é só um identificador; a numeração segue a ordem de aparição.

Uma nota com lista ou bloco de código não cabe na margem: ela continua como
rodapé comum, numa lista no fim do registro.

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

Depois da linguagem, na mesma linha, vão as anotações do bloco:

| Anotação | Efeito |
| --- | --- |
| `title="src/arquivo.ts"` | Nome do arquivo na aba do bloco |
| `{2,4-6}` | Destaca as linhas 2, 4, 5 e 6 |
| `add={3-4}` | Marca as linhas como adicionadas (`+`) |
| `del={2}` | Marca a linha como removida (`−`) |
| `numbers` | Numera as linhas |
| `wrap` | Quebra linhas longas em vez de rolar para o lado |

````md
```ts title="src/retry.ts" {3} numbers
export async function retry<T>(run: () => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await run() } catch { await sleep(2 ** attempt * 100) }
  }
}
```
````

O diff mantém o realce da linguagem; não precisa trocar o bloco para `diff`.

### Passo a passo

O código (ou uma imagem) fica fixo enquanto os passos rolam, e cada passo
destaca as linhas de que fala. O botão **passos** do editor insere o esqueleto.

````md
::::steps
```ts title="src/import.ts" numbers
const ids = await runQuery(queryId)
const pages = await Promise.all(chunk(ids, 200).map(fetchWorkItems))
return pages.flat()
```

:::step{lines=1}
A lista de itens vem de uma consulta salva.
:::

:::step{lines=2-3}
As páginas são pedidas em paralelo e juntadas na ordem.
:::
::::
````

- O bloco de fora usa **quatro** dois-pontos (`::::steps` … `::::`), porque
  contém outros blocos. Cada passo usa três.
- O que vem antes do primeiro passo é o que fica fixo.
- `lines` aceita o mesmo formato do destaque de código: `3`, `3-5`, `1,4-6`.
- Um passo que começa com seu próprio bloco de código ou imagem troca o que
  está fixo a partir dali; um passo sem isso mantém o anterior.
- Escreva os passos como texto corrido, sem títulos (`##`), para não entrarem
  no índice do registro.

Em tela larga o painel fica ao lado dos passos; em tela estreita ele gruda no
topo e os passos passam por baixo.

---

## 4. Métricas

O desempenho de cada post aparece em **Audiência → Desempenho do blog**:
aberturas, leituras (rolagem até 75%), taxa de leitura e compartilhamentos. As
rotas do blog também emitem `pageview`, então aparecem em "Páginas mais vistas"
junto com o portfólio. Definições em [`ANALYTICS.md`](./ANALYTICS.md).

## 5. Arquitetura

### Dados

```
posts/{slug}                 metadados + `locales.{pt,en}` — o que o índice lista
posts/{slug}/content/main    { body, bodies: { pt, en }, status, media }
```

A separação é o que mantém o índice barato: listar 40 posts baixa 40 documentos
pequenos, não 40 artigos inteiros. Guardar PT e EN dentro do mesmo par de
documentos elimina posts duplicados e faz a troca de idioma na leitura custar
zero leituras extras no Firestore. `status` é espelhado no documento do corpo e
escrito no **mesmo `writeBatch`**, para as regras poderem filtrar sem um `get()`
— um `get()` nas regras cobra uma leitura por requisição.

### Página do registro

A página de um post é uma página de caderno (`src/blog/pages/BlogPost.tsx`):

- **Margem.** Em tela larga (≥ 1280px) a coluna de texto mantém a medida de
  leitura e o espaço à direita é a margem. O índice do registro e as notas
  entram nela por `float` com margem negativa (classe `in-margin` e
  `data-pinned`, em `src/styles/index.css`): não ocupam largura no texto,
  começam na linha que as cita e `clear` empilha vizinhas. Nenhum script mede
  posição.
- **Trilho.** `PostRail` é o trilho de seções da home apontado para o post:
  um traço numerado por `##`, o título da seção atual na borda da página e a
  posição em porcentagem. Abaixo de 1280px ele dá lugar à `MobileReadingBar`.
- **Numeração.** O número de cada `##` é um contador CSS no próprio link do
  título, então trilho, índice e título nunca divergem. Clicar no número copia
  o link da seção.
- **Rótulos do corpo.** `PostBody` também renderiza no preview do admin e em
  testes, fora do `LanguageProvider`. Os blocos leem os rótulos por
  `useBodyLabels()` (`src/blog/lib/body-context.ts`), que seguem o idioma **do
  post**, não o da interface.
- **Link para um trecho.** Selecionar texto abre uma barra (`QuoteShare`) que
  copia `…/blog/slug#q=primeiras+palavras&e=últimas+palavras`. Na chegada a
  página procura o trecho, rola até ele e o marca com a Highlight API. Não usa
  os text fragments do navegador (`#:~:text=`), que são resolvidos antes de o
  Markdown chegar.
- **Continuar de onde parou.** `src/blog/lib/reading-memory.ts` guarda a
  posição de cada registro no `localStorage` do leitor (chave
  `mb-journal-reading`). Nada é enviado ao servidor. O post oferece retomar; o
  índice mostra "Lido" ou a porcentagem.

No HTML de servidor (`netlify/lib/blog-html.ts`) os blocos interativos viram
estrutura simples: o passo a passo é o código seguido de uma lista ordenada, e
as notas ficam como rodapé no fim.

### Pranchas de campo

Todo registro tem uma prancha: um mapa de curvas de nível de um terreno que só
existe para ele. O terreno é função pura do slug (`src/blog/lib/plate.ts`:
hash FNV-1a, PRNG com semente, um campo de alturas e um pintor que desenha as
curvas pixel a pixel), então o mesmo post mostra a mesma prancha no índice, no
cabeçalho e em "Leia também". Ela é a capa quando o post não tem imagem; com
`cover`, a imagem vence.

`PostPlate` pinta num `<canvas>` só quando a prancha chega perto da tela e só
anima enquanto está visível, com a aba em primeiro plano e sem
`prefers-reduced-motion`. Mudar o slug muda a prancha.

### Ver o Diário sem publicar

No servidor de desenvolvimento, `/blog?demo=1` troca o Firestore pelos
registros de exemplo de `src/blog/dev-fixtures.ts`, e `/blog?demo=0` desfaz. A
marca fica em `sessionStorage`, porque o índice reescreve a própria query
string. No build de produção o ramo inteiro é código morto e o arquivo não é
emitido.

Um rascunho de verdade pode ser lido do mesmo jeito antes de publicar: o
Markdown fica em `docs/diario/<slug>.md`, só com o corpo, e entra nos exemplos
por um import `?raw` em `dev-fixtures.ts`. É esse mesmo arquivo que se cola no
editor do `/admin/blog`.

### Kit de um registro

Um registro que é uma lista de ferramentas pode ganhar um kit: uma página
estática com os links, favoritos para importar no navegador, a lista em
Markdown e o comando das skills. O primeiro é `/kit/front-end` (e
`/en/kit/front-end`). A fonte é `netlify/lib/kit.ts`; `tests/kit.test.ts`
gera as páginas e os downloads em `public/`. Depois de editar a lista:

```bash
pnpm exec vitest run tests/kit.test.ts -u
```

A página não passa pelo React nem pelo Firestore: abre sem JavaScript,
compartilha com o próprio título e descrição, e responde em Markdown para
agentes (`Accept: text/markdown`).

### Numeração dos registros

O "Nº 007" é a posição do post na lista publicada, do mais antigo para o mais
novo. Não é um campo salvo: despublicar um registro antigo renumera os
seguintes.

### Publicação por agentes

Agentes confiáveis publicam por `POST /agent/v1/posts` e revisam posts existentes
por `PATCH /agent/v1/posts`. Não há `DELETE`: remoção continua sendo uma ação
humana no admin.

A autorização técnica é o cabeçalho `Authorization: Bearer <AGENT_PUBLISH_TOKEN>`.
O `requestId` no corpo é uma correlação fornecida pelo chamador, útil para ligar
a resposta e o último registro de publicação por agente ao pedido original.
Ele não prova, por si só, que houve um pedido autorizado.

A regra operacional para agentes confiáveis é publicar ou revisar somente após
um pedido específico, por exemplo: "crie um artigo explicando APIs". Escolher
pauta e publicar proativamente não é uma política tecnicamente aplicada por
`requestId`; é uma instrução do agente e deve ser respeitada na orquestração que
chama este endpoint.

```json
{
  "requestId": "api-explainer-2026-09-28",
  "post": {
    "slug": "explicando-apis",
    "status": "published",
    "locales": {
      "pt": {
        "title": "Explicando APIs",
        "subtitle": "Uma introdução prática",
        "body": "## O que é uma API?\n\n...",
        "tags": ["apis", "arquitetura"]
      },
      "en": {
        "title": "Explaining APIs",
        "subtitle": "A practical introduction",
        "body": "## What is an API?\n\n...",
        "tags": ["apis", "architecture"]
      }
    }
  }
}
```

O formato de idioma único (`lang`, `title`, `body`) continua aceito para
compatibilidade, e enviar `locales` grava PT e EN na mesma publicação (ou
adiciona o segundo idioma via `PATCH`). Envie esse JSON com `Content-Type: application/json` para
`POST https://marcusboni.com.br/agent/v1/posts`. Para uma revisão, envie
`PATCH` para a mesma URL com `requestId`, `post.slug` e somente os campos que
quer alterar. A revisão mantém título, Markdown, capa, tags e demais campos
omitidos. `POST` retorna `201`; `PATCH` retorna `200`. Um slug ocupado ou uma
revisão concorrente retorna `409`, e um token ausente ou inválido retorna `401`.

Credenciais ficam somente no Netlify:

- `AGENT_PUBLISH_TOKEN` protege o endpoint contra chamadas externas.
- `FIREBASE_PROJECT_ID` ou `VITE_FIREBASE_PROJECT_ID` identifica o projeto.
- `FIREBASE_SERVICE_ACCOUNT_EMAIL` e `FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY`
  assinam o acesso server-side ao Firestore.

Crie uma conta de serviço dedicada à publicação, com o menor acesso ao Firestore
que permita ler e gravar os posts. Guarde a chave privada apenas nas variáveis
secretas do Netlify e faça a rotação se ela for exposta. Chamadas com essa conta
usam IAM e não passam por `firestore.rules`; o limite a posts é imposto pelo
endpoint e pelo sigilo das credenciais, não pelas regras do cliente.

O endpoint grava o mesmo layout do admin: metadados em `posts/{slug}` e Markdown
em `posts/{slug}/content/main`, com `status` espelhado no corpo e `publishedAt`
preservado em revisões. `PATCH` só revisa posts que já estejam `published` ou
`unlisted`, preserva campos omitidos e usa a versão lida do Firestore como
precondição para evitar sobrescrever uma revisão concorrente.

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
