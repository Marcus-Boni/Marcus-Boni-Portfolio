import type { Post } from '@/blog/types'

import toolboxBody from '../../docs/diario/caixa-de-ferramentas-front-end.md?raw'
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
 * One entry is real writing: the first one, with its English translation,
 * reads its body from `docs/diario/`, the Markdown that gets pasted into
 * `/admin/blog`, so a draft can be read on the real page before it is
 * published. The others are placeholders.
 */

const NOTICE = '> Registro de exemplo — visível apenas em desenvolvimento (`/blog?demo=1`).'

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

const SHORT_BODY = `${NOTICE}

## Contexto

Um registro curto, para conferir como a página se comporta com pouco texto e um
único título de seção.

## Notas

O sumário aparece a partir de dois títulos; a barra de leitura acompanha a
rolagem mesmo em textos pequenos.
`

function entry(
  fields: Pick<Post, 'slug' | 'lang' | 'title' | 'excerpt' | 'tags' | 'publishedAt'> &
    Partial<Post>,
): Post {
  return {
    status: 'published',
    subtitle: '',
    readingMinutes: 4,
    updatedAt: fields.publishedAt ?? new Date().toISOString(),
    body: SHORT_BODY,
    ...fields,
  }
}

export const fixturePosts: Post[] = [
  entry({
    slug: 'caixa-de-ferramentas-front-end',
    lang: 'pt',
    title: 'Minha caixa de ferramentas de front-end',
    subtitle:
      'Dezesseis endereços que eu abro antes de desenhar uma interface, da pesquisa da marca do cliente ao 3D.',
    excerpt:
      'Onde eu busco componentes, movimento e critério de design para construir interfaces: dezesseis ferramentas com versão gratuita e o que conferir antes de copiar.',
    tags: ['Front-end', 'Design', 'Animação', '3D', 'IA'],
    readingMinutes: 11,
    publishedAt: '2026-11-18T12:00:00.000Z',
    // A pair only counts when each side names the other.
    translationOf: 'my-front-end-toolbox',
    body: toolboxBody,
  }),
  entry({
    slug: 'my-front-end-toolbox',
    lang: 'en',
    title: 'My front-end toolbox',
    subtitle:
      "Sixteen addresses I open before designing an interface, from researching a client's brand to 3D.",
    excerpt:
      'Where I get components, motion and design judgment to build interfaces: sixteen tools that are free to use, and what to check before copying.',
    tags: ['Front-end', 'Design', 'Animation', '3D', 'AI'],
    readingMinutes: 11,
    publishedAt: '2026-11-18T12:00:00.000Z',
    translationOf: 'caixa-de-ferramentas-front-end',
    body: toolboxBodyEn,
  }),
  entry({
    slug: 'da-planilha-ao-produto',
    lang: 'pt',
    title: 'Da planilha ao produto',
    subtitle:
      'Como uma estimativa de horas saiu do Excel e passou a ler os itens direto da fonte.',
    excerpt:
      'O caminho de uma planilha frágil até uma aplicação que busca os itens de trabalho na API e guarda o histórico de cada mudança.',
    tags: ['TypeScript', 'Azure DevOps', 'Bastidores'],
    readingMinutes: 7,
    publishedAt: '2026-11-12T12:00:00.000Z',
    updatedAt: '2026-11-14T12:00:00.000Z',
    featured: true,
    body: LONG_BODY,
  }),
  entry({
    slug: 'rag-sobre-notas-de-reuniao',
    lang: 'pt',
    title: 'RAG sobre notas de reunião',
    excerpt:
      'O que funcionou, e o que não, ao responder perguntas sobre transcrições guardadas em um vault.',
    tags: ['IA', 'RAG', 'TypeScript'],
    readingMinutes: 9,
    publishedAt: '2026-11-03T12:00:00.000Z',
    series: { id: 'agentes', title: 'Agentes na prática', order: 2 },
  }),
  entry({
    slug: 'agentes-como-colegas-de-time',
    lang: 'pt',
    title: 'Agentes como colegas de time',
    excerpt:
      'Dividir uma entrega entre pessoas e agentes de IA muda mais o processo do que o código.',
    tags: ['IA', 'Bastidores'],
    readingMinutes: 6,
    publishedAt: '2026-10-21T12:00:00.000Z',
    series: { id: 'agentes', title: 'Agentes na prática', order: 1 },
  }),
  entry({
    slug: 'from-spreadsheet-to-product',
    lang: 'en',
    title: 'From spreadsheet to product',
    excerpt:
      'How an hour-estimation sheet left Excel and started reading work items straight from the source.',
    tags: ['TypeScript', 'Azure DevOps'],
    readingMinutes: 7,
    publishedAt: '2026-10-14T12:00:00.000Z',
    translationOf: 'da-planilha-ao-produto',
  }),
  entry({
    slug: 'postgres-legado-sem-medo',
    lang: 'pt',
    title: 'PostgreSQL legado sem medo',
    excerpt:
      'Ler uma base antiga com APIs de consulta antes de propor qualquer mudança de esquema.',
    tags: ['PostgreSQL', 'APIs'],
    readingMinutes: 5,
    publishedAt: '2026-10-02T12:00:00.000Z',
  }),
  entry({
    slug: 'pwa-para-portal-do-cliente',
    lang: 'pt',
    title: 'PWA para um portal do cliente',
    excerpt:
      'Perfis diferentes, um ERP por trás e a decisão de entregar pelo navegador em vez de uma loja.',
    tags: ['PWA', 'Node.js', 'Bastidores'],
    readingMinutes: 8,
    publishedAt: '2026-09-18T12:00:00.000Z',
  }),
  entry({
    slug: 'what-a-hackathon-teaches',
    lang: 'en',
    title: 'What a hackathon teaches about scope',
    excerpt: 'Three days, one product, and the features that were cut on purpose.',
    tags: ['React', 'IA'],
    readingMinutes: 4,
    publishedAt: '2026-09-05T12:00:00.000Z',
  }),
]
