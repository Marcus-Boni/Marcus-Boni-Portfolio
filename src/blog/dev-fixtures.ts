import type { Post, PostLocaleMeta } from '@/blog/types'
import { readingMinutes } from '@/blog/lib/text'

import toolboxBody from '../../docs/diario/caixa-de-ferramentas-front-end.md?raw'
import wifiBody from '../../docs/diario/diagnosticar-wi-fi-lento-com-ia.md?raw'
import wifiBodyEn from '../../docs/diario/how-i-improved-my-wi-fi-with-ai.md?raw'
import toolboxBodyEn from '../../docs/diario/my-front-end-toolbox.md?raw'

/**
 * Sample entries for designing the journal — DEVELOPMENT ONLY.
 *
 * Loaded exclusively through `demoMode()` in `usePosts.ts` (visit
 * `/blog?demo=1` on the dev server). None of it reaches a production build.
 * The bodies exist to put every block the renderer supports on screen at
 * once: headings for the table of contents, code fences, a callout, a pull
 * quote, a table, lists.
 *
 * Each bilingual entry is ONE publication carrying both `pt` and `en` versions
 * inside `locales` and `bodies`, matching production Firestore documents.
 * Editorial drafts read their Markdown bodies from `docs/diario/`.
 */

const NOTICE = '> Registro de exemplo — visível apenas em desenvolvimento (`/blog?demo=1`).'
const NOTICE_EN = '> Sample entry — visible in development only (`/blog?demo=1`).'

const LONG_BODY = `${NOTICE}

Toda planilha que sobrevive tempo demais vira um sistema sem dono.[^dono] Este
registro acompanha a troca de uma delas por uma aplicação de verdade, do primeiro
levantamento até a semana em que a planilha foi arquivada.

:::takeaways
- Planilha compartilhada é sistema sem dono: o custo aparece na fatura, não no erro.
- Parar de copiar vem antes de automatizar.
- A migração só termina quando ninguém mais abre o arquivo antigo.
:::

## O problema de partida

A estimativa de horas vivia em um arquivo compartilhado. Cada linha era um item
de trabalho copiado à mão, e cada cópia era uma chance de erro.[^copia]

- Itens duplicados entre abas
- Fórmulas quebradas por quem só queria ordenar uma coluna
- Nenhum histórico de quem mudou o quê

:::callout{type=warn}
O custo real não estava nos erros que apareciam, e sim nos que ninguém via até a
fatura fechar.
:::

## Ler direto da fonte

O primeiro corte foi parar de copiar. A aplicação passou a buscar os itens na
API e a tratar a planilha como exportação, nunca como origem.

\`\`\`ts title="src/work-items.ts" {4}
export async function fetchWorkItems(ids: number[]): Promise<WorkItem[]> {
  const response = await client.post('/wit/workitemsbatch', {
    ids,
    fields: ['System.Title', 'Microsoft.VSTS.Scheduling.OriginalEstimate'],
  })
  return response.value.map(toWorkItem)
}
\`\`\`

### Limites e paginação

A API devolve no máximo duzentos itens por chamada.[^limite] Fatiar a lista
resolve, mas só se a ordem for preservada na volta.

\`\`\`ts add={2-4} del={1}
const items = await fetchWorkItems(ids)
const chunks = chunk(ids, 200)
const pages = await Promise.all(chunks.map(fetchWorkItems))
const items = pages.flat()
\`\`\`

## A importação, passo a passo

Com a leitura resolvida, a importação inteira cabe em uma função. Role para
acompanhar cada parte.

::::steps
\`\`\`ts title="src/import.ts" numbers
export async function importEstimate(queryId: string) {
  const ids = await runQuery(queryId)
  if (ids.length === 0) return []

  const pages = await Promise.all(chunk(ids, 200).map(fetchWorkItems))
  const items = pages.flat()

  const known = await loadEstimates()
  return items.map((item) => ({
    ...item,
    hours: known.get(item.id) ?? item.originalEstimate,
  }))
}
\`\`\`

:::step{lines=2-3}
**A consulta manda.** A lista de itens vem de uma consulta salva, não de uma
seleção manual. Se ela volta vazia, a importação termina ali.
:::

:::step{lines=5-6}
**Fatias de duzentos.** As páginas são pedidas em paralelo e juntadas na ordem
em que foram pedidas, não na ordem em que chegaram.[^ordem]
:::

:::step{lines=8}
**O que já foi estimado.** As horas ajustadas por alguém ficam em um mapa por
identificador, carregado uma única vez.
:::

:::step{lines=9-12}
**Quem vence.** Se existe um ajuste, ele vale. Caso contrário, entra a
estimativa original do item.
:::
::::

## O que mudou no dia a dia

| Antes | Depois |
| --- | --- |
| Copiar itens à mão | Importação por consulta |
| Fórmulas por aba | Regras em um só lugar |
| Sem histórico | Cada alteração registrada |

:::quote{cite="Anotação de retrospectiva"}
A melhor parte foi parar de perguntar qual versão da planilha era a certa.
:::

## Próximos passos

1. Fechar o ciclo com o planejado versus realizado
2. Exportar para quem ainda precisa do arquivo
3. Aposentar a planilha de vez

O restante fica para o próximo registro.

[^dono]: Ninguém responde por ela, mas todo mundo depende dela para fechar o mês.
[^copia]: Em um mês comum eram cerca de trezentas linhas copiadas à mão.
[^limite]: O limite é da API de itens de trabalho, não da aplicação. Mudar o tamanho da página do lado de cá não ajuda.
[^ordem]: \`Promise.all\` devolve os resultados na ordem das promessas, seja qual for a ordem de conclusão.
`

const LONG_BODY_EN = `${NOTICE_EN}

Every spreadsheet that lives too long turns into an unowned system.[^owner] This
entry tracks replacing one of them with a real application, from the first
discovery pass to the week the file was finally archived.

:::takeaways
- A shared spreadsheet is an unowned system: the cost shows up on the invoice, not as an error.
- Stop copying by hand before automating anything.
- The migration is only done when nobody opens the old file anymore.
:::

## The starting problem

Hour estimates lived in a shared file. Every row was a work item copied by hand,
and every copy was another chance to drift.[^copy]

- Duplicate rows across tabs
- Broken formulas from someone simply sorting a column
- Zero history of who changed what

## Reading straight from the source

The first cut was to stop copying. The app started pulling work items straight
from the API and treating spreadsheets strictly as exports, never as the source.

## Next steps

1. Close the loop between planned and actual hours
2. Keep one-click export for stakeholders who still need a sheet
3. Retire the spreadsheet for good

[^owner]: Nobody owns it, yet everyone relies on it to close the month.
[^copy]: In a typical month, around three hundred rows were copied by hand.
`

const SHORT_BODY = `${NOTICE}

## Contexto

Um registro curto, para conferir como a página se comporta com pouco texto e um
único título de seção.

## Notas

O sumário aparece a partir de dois títulos; a barra de leitura acompanha a
rolagem mesmo em textos pequenos.
`

const SHORT_BODY_EN = `${NOTICE_EN}

## Context

A short entry to verify how the page behaves with concise copy and a couple of
section headings.

## Notes

The table of contents appears from two headings onward, and the reading bar
tracks scroll even on brief notes.
`

interface LocaleDraft {
  title: string
  subtitle?: string
  excerpt: string
  tags: string[]
  body: string
  readingMinutes?: number
}

function toLocaleMeta(draft: LocaleDraft): PostLocaleMeta {
  return {
    title: draft.title,
    subtitle: draft.subtitle ?? '',
    excerpt: draft.excerpt,
    tags: draft.tags,
    readingMinutes: draft.readingMinutes ?? readingMinutes(draft.body),
  }
}

function entry(
  fields: {
    slug: string
    publishedAt: string
    updatedAt?: string
    featured?: boolean
    series?: Post['series']
    pt?: LocaleDraft
    en?: LocaleDraft
  },
): Post {
  const primaryLang = fields.pt ? 'pt' : 'en'
  const primary = (fields.pt ?? fields.en)!
  const locales: NonNullable<Post['locales']> = {}
  const bodies: NonNullable<Post['bodies']> = {}

  if (fields.pt) {
    locales.pt = toLocaleMeta(fields.pt)
    bodies.pt = fields.pt.body
  }
  if (fields.en) {
    locales.en = toLocaleMeta(fields.en)
    bodies.en = fields.en.body
  }

  const primaryMeta = locales[primaryLang]!

  return {
    slug: fields.slug,
    lang: primaryLang,
    status: 'published',
    title: primaryMeta.title,
    subtitle: primaryMeta.subtitle,
    excerpt: primaryMeta.excerpt,
    tags: primaryMeta.tags,
    readingMinutes: primaryMeta.readingMinutes,
    publishedAt: fields.publishedAt,
    updatedAt: fields.updatedAt ?? fields.publishedAt,
    featured: fields.featured ?? false,
    series: fields.series,
    locales,
    body: primary.body,
    bodies,
  }
}

export const fixturePosts: Post[] = [
  entry({
    slug: 'diagnosticar-wi-fi-lento-com-ia',
    publishedAt: '2026-11-24T12:00:00.000Z',
    pt: {
      title: 'Como diagnostiquei e melhorei meu Wi-Fi com IA',
      subtitle:
        'Dois roteadores dividiam o mesmo bloco de 5 GHz. O que mudou quando separei os canais e o prompt para testar sua rede.',
      excerpt:
        'O pico de ping ao roteador caiu de 330 para 12 ms. Veja o antes e depois no Windows e copie o prompt para diagnosticar seu Wi-Fi.',
      tags: ['Wi-Fi', 'Windows', 'IA'],
      body: wifiBody,
    },
    en: {
      title: 'How I diagnosed and improved my Wi-Fi with AI',
      subtitle:
        'Two routers shared the same 5 GHz channels. What changed when I separated them, plus a prompt to test your own network.',
      excerpt:
        'Peak ping to my router dropped from 330 to 12 ms. See the before-and-after results on Windows and copy the prompt to diagnose your Wi-Fi.',
      tags: ['Wi-Fi', 'Windows', 'AI'],
      body: wifiBodyEn,
    },
  }),
  entry({
    slug: 'caixa-de-ferramentas-front-end',
    publishedAt: '2026-11-18T12:00:00.000Z',
    pt: {
      title: 'Minha caixa de ferramentas de front-end',
      subtitle:
        'Dezesseis endereços que eu abro antes de desenhar uma interface, da pesquisa da marca do cliente ao 3D.',
      excerpt:
        'Onde eu busco componentes, movimento e critério de design para construir interfaces: dezesseis ferramentas com versão gratuita e o que conferir antes de copiar.',
      tags: ['Front-end', 'Design', 'Animação', '3D', 'IA'],
      readingMinutes: 11,
      body: toolboxBody,
    },
    en: {
      title: 'My front-end toolbox',
      subtitle:
        "Sixteen addresses I open before designing an interface, from researching a client's brand to 3D.",
      excerpt:
        'Where I get components, motion and design judgment to build interfaces: sixteen tools that are free to use, and what to check before copying.',
      tags: ['Front-end', 'Design', 'Animation', '3D', 'AI'],
      readingMinutes: 11,
      body: toolboxBodyEn,
    },
  }),
  entry({
    slug: 'da-planilha-ao-produto',
    publishedAt: '2026-11-12T12:00:00.000Z',
    updatedAt: '2026-11-14T12:00:00.000Z',
    featured: true,
    pt: {
      title: 'Da planilha ao produto',
      subtitle:
        'Como uma estimativa de horas saiu do Excel e passou a ler os itens direto da fonte.',
      excerpt:
        'O caminho de uma planilha frágil até uma aplicação que busca os itens de trabalho na API e guarda o histórico de cada mudança.',
      tags: ['TypeScript', 'Azure DevOps', 'Bastidores'],
      readingMinutes: 7,
      body: LONG_BODY,
    },
    en: {
      title: 'From spreadsheet to product',
      subtitle:
        'How an hour-estimation sheet left Excel and started reading work items straight from the source.',
      excerpt:
        'From a fragile spreadsheet to an application that fetches work items straight from the API and keeps a full history of every change.',
      tags: ['TypeScript', 'Azure DevOps', 'Behind the scenes'],
      readingMinutes: 7,
      body: LONG_BODY_EN,
    },
  }),
  entry({
    slug: 'rag-sobre-notas-de-reuniao',
    publishedAt: '2026-11-03T12:00:00.000Z',
    series: { id: 'agentes', title: 'Agentes na prática', order: 2 },
    pt: {
      title: 'RAG sobre notas de reunião',
      excerpt:
        'O que funcionou, e o que não, ao responder perguntas sobre transcrições guardadas em um vault.',
      tags: ['IA', 'RAG', 'TypeScript'],
      readingMinutes: 9,
      body: SHORT_BODY,
    },
  }),
  entry({
    slug: 'agentes-como-colegas-de-time',
    publishedAt: '2026-10-21T12:00:00.000Z',
    series: { id: 'agentes', title: 'Agentes na prática', order: 1 },
    pt: {
      title: 'Agentes como colegas de time',
      excerpt:
        'Dividir uma entrega entre pessoas e agentes de IA muda mais o processo do que o código.',
      tags: ['IA', 'Bastidores'],
      readingMinutes: 6,
      body: SHORT_BODY,
    },
  }),
  entry({
    slug: 'postgres-legado-sem-medo',
    publishedAt: '2026-10-02T12:00:00.000Z',
    pt: {
      title: 'PostgreSQL legado sem medo',
      excerpt:
        'Ler uma base antiga com APIs de consulta antes de propor qualquer mudança de esquema.',
      tags: ['PostgreSQL', 'APIs'],
      readingMinutes: 5,
      body: SHORT_BODY,
    },
  }),
  entry({
    slug: 'pwa-para-portal-do-cliente',
    publishedAt: '2026-09-18T12:00:00.000Z',
    pt: {
      title: 'PWA para um portal do cliente',
      excerpt:
        'Perfis diferentes, um ERP por trás e a decisão de entregar pelo navegador em vez de uma loja.',
      tags: ['PWA', 'Node.js', 'Bastidores'],
      readingMinutes: 8,
      body: SHORT_BODY,
    },
  }),
  entry({
    slug: 'what-a-hackathon-teaches',
    publishedAt: '2026-09-05T12:00:00.000Z',
    en: {
      title: 'What a hackathon teaches about scope',
      excerpt: 'Three days, one product, and the features that were cut on purpose.',
      tags: ['React', 'AI'],
      readingMinutes: 4,
      body: SHORT_BODY_EN,
    },
  }),
]
