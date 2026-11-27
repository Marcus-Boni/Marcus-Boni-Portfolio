# SEO do portfólio e do blog

## Auditoria e decisões

Auditoria do código em 10/10/2026. O projeto já tinha sitemap e RSS dinâmicos,
imagens WebP responsivas, rotas explícitas e metadados de artigos no servidor.
O trabalho completa a descoberta e a representação dos artigos usando a
arquitetura existente, sem adicionar dependências.

| Prioridade | Problema encontrado | Impacto e correção |
| --- | --- | --- |
| Alta | Artigos e índice dependiam de JavaScript para seu conteúdo | HTML entregue pelo edge inclui Markdown renderizado, título, autoria, datas e links reais para artigos. A mesma resposta atende leitores e buscadores. |
| Alta | `/blog` herdava o canonical e o título da home no HTML | Metadados próprios para índice e artigos; canonical sem filtros ou parâmetros de rastreamento. |
| Alta | Navegação preservava robots e JSON-LD de páginas anteriores | Gerenciamento de head limpa dados anteriores, respeita artigos não listados e remove canonical nas páginas inexistentes. |
| Alta | Sitemap limitado aos primeiros 200 artigos | Leitura paginada dos publicados; nenhum rascunho ou não listado aparece nos feeds. Falhas de leitura são diferenciadas de catálogo vazio. |
| Média | `lastmod` de páginas estáticas mudava a cada requisição | Datas só aparecem quando há evidência de atualização do conteúdo. Não são inventadas datas para páginas estáticas. |
| Média | Hreflang confiava apenas no campo `translationOf` | Alternativas só são emitidas para duas traduções publicadas, em idiomas distintos, que apontam reciprocamente uma para a outra. |
| Média | Idioma inicial inglês para conteúdo em português | HTML inicial em `pt-BR`; cada artigo declara seu próprio idioma, independente dos controles de navegação. |
| Média | Autoria apenas no schema | Autor visível com link para `/about`; página do autor com `ProfilePage`, artigos com `BlogPosting` e breadcrumbs. |
| Média | URLs `.html` duplicavam documentos públicos | Redirecionamentos permanentes para `/about`, `/contact`, `/privacy` e `/developers`. |
| Alta | Imagem social `og-image.png` era um JPEG 1024×1024 servido como `image/png` (412 KB) | Substituída por `og-image.jpg` real em 1200×630 (62 KB), com `og:image:width/height/type`; a URL antiga redireciona com 301. |
| Alta | O React apagava o artigo entregue pelo edge ao montar, exibindo tela vazia e "carregando" | `src/blog/lib/server-document.ts` mantém o HTML do servidor visível até a view React ter dados; se a leitura no cliente falhar, o documento do servidor permanece. |
| Média | `/blog/` e `/blog/slug/` respondiam 200 como duplicatas | Redirecionamento 301 para a URL canônica sem barra final, preservando a query string. |
| Média | Cards do X declarados com `property="twitter:*"` e sem card grande nas páginas estáticas | Todas as páginas usam `name="twitter:*"` e `summary_large_image`. |
| Baixa | Data de revisão só aparecia no rodapé renderizado por JavaScript | O HTML do edge mostra "Atualizado em" quando a revisão é de um dia posterior à publicação; o índice mostra a data de cada artigo. |
| Média | Checklist sugeria limites rígidos de SEO | Orientações editoriais, prévias aproximadas e checks de URL, títulos, descrições, imagens e links internos; salvamento continua livre. |
| Alta | `/ask` e `/en/ask` entregavam o HTML e canonical da home sem JS e estavam fora do sitemap | `blog-meta.ts` passa a renderizar `<head>`, `hreflang` recíproco (`pt-BR`, `en`, `x-default`), `WebPage` + `BreadcrumbList` e HTML semântico para `/ask` e `/en/ask`, sincronizados com `applyAskHead` e presentes no sitemap. |
| Alta | Capas personalizadas de artigos omitiam `og:image:width/height/type` e dimensões `width`/`height` no HTML do edge | `EdgePost` decodifica largura/altura da capa, emite metadados completos de Open Graph, reserva espaço no `<img>` (CLS = 0) e publica `ImageObject` rico no `BlogPosting` e `<image:image>` no sitemap. |
| Média | `BlogPosting` e `Blog` omitiam `wordCount`, `timeRequired`, `articleSection` e datas nos itens do índice | Enriquecidos no edge e no cliente com `wordCount`, `timeRequired` (ISO 8601), `articleSection`, `isAccessibleForFree`, `sameAs` do autor e `BreadcrumbList` também no índice. |
| Média | Sitemap omitia `hreflang` do `/kit/front-end` e não havia feed RSS em inglês | `feeds.ts` e `public/sitemap.xml` agora trazem `hreflang` completo para `/blog`, `/ask` e `/kit/front-end`; `/en/rss.xml` serve o feed dedicado em inglês com `<media:content>` para capas. |
| Média | Visita direta em `/en/blog/{slug}` mantinha chrome da interface em português e faltava `content-language` para Bing | `BlogPost` sincroniza o idioma da UI ao entrar em `/en/blog/*`, e todas as páginas emitem `<meta http-equiv="content-language">`, `og:site_name` unificado (`Marcus Boni`), `og:image:alt` e Twitter cards completos. |
| Baixa | Checklist e alertas do painel só conferiam o idioma principal de posts bilíngues | `postIssues()` e `SeoPreview` auditam PT e EN, exibem contagem de caracteres de título/descrição, prévia Desktop/Mobile e resumo de saúde de SEO no Painel. |

## Contrato de publicação

- `published`: aparece no índice, sitemap e RSS, e pode ser indexado.
- `unlisted`: acessível por link, com `noindex, follow`, fora do índice e feeds.
- `draft`: não é conteúdo público; a URL responde como inexistente.
- Artigo inexistente: HTTP 404, sem canonical e com `noindex`.
- Falha temporária do banco: HTTP 503 com `Retry-After`; não deve aparentar que
  o artigo foi excluído ou que o catálogo está vazio.

O sitemap e o RSS refletem o banco sem exigir novo build. As Edge Functions
não ativam `cache: 'manual'`: apenas definir `Netlify-CDN-Cache-Control` não
habilita o cache de respostas Edge no Netlify. O HTML é consultado por
requisição, priorizando mudanças de visibilidade. Respostas não listadas e
erros usam `no-store`. RSS/sitemap e Markdown público ainda têm um cache curto
no navegador; não prometem atualização instantânea de respostas já armazenadas.

A leitura do catálogo possui limites de páginas e tempo para proteger o edge.
Se o catálogo crescer até esses limites, a resposta falha temporariamente em
vez de omitir artigos. Nesse estágio, implemente arquivo paginado e um índice
de sitemaps antes de aumentar os limites. Cache compartilhado de HTML exige
também invalidação na publicação e variação por `Accept`.

Use URLs estáveis, como `/blog/como-funciona-uma-api`. Renomear um artigo já
publicado exige planejar o redirecionamento da URL antiga; o editor não cria um
histórico automático de aliases. Preserve `publishedAt` nas revisões e altere
`updatedAt` quando o conteúdo mudar.

Para publicações bilíngues, preencha as abas **Português** e **English** dentro
do mesmo registro no editor: o português responde em `/blog/{slug}` e o inglês
em `/en/blog/{slug}`, com canonical próprio em cada URL e `hreflang` recíproco
(`pt-BR`, `en`, `x-default`) gerado automaticamente tanto no HTML quanto no
sitemap. O índice segue o mesmo padrão (`/blog` e `/en/blog`), listando cada
publicação uma única vez. Publicações de um único idioma permanecem em
`/blog/{slug}` sem `hreflang` (e `/en/blog/{slug}` redireciona com 301 para a
URL canônica). Pares legados ligados por `translationOf` continuam suportados
até serem unificados em `/admin/blog`.

## Preparar cada artigo

1. Defina a pergunta concreta do leitor e responda com experiência, exemplos e
   fontes verificáveis. Não há número mínimo de palavras para ranquear.
2. Escreva título descritivo e resumo próprio. As prévias são aproximações:
   Google pode escolher outro trecho ou título conforme a consulta.
3. Organize o corpo com `##` e `###`; o título do artigo já fornece o H1.
4. Use capa representativa com texto alternativo. A imagem padrão atende o
   compartilhamento quando não há capa, mas não substitui uma imagem editorial
   pertinente nos dados estruturados do artigo.
5. Inclua links para artigos relacionados e referências oficiais. Evite criar
   páginas vazias por tag apenas para expandir o número de URLs indexáveis.
6. Revise exemplos, linguagem, links e preview antes de publicar. Informe o
   idioma real do conteúdo.

## Validar após o deploy

O build local não comprova a indexação. Não houve acesso autenticado ao Search
Console nem comprovação de desempenho real em produção nesta auditoria.

1. Confirme `https://marcusboni.com.br` como domínio principal no Netlify, com
   HTTPS e redirecionamento das variantes do domínio. As tags e feeds usam
   esse endereço; não adicione domínios de preview ao Search Console.
2. Verifique a propriedade de domínio no Google Search Console usando o fluxo
   oficial e envie `https://marcusboni.com.br/sitemap.xml`. Não há token de
   verificação inventado no código.
3. Use a inspeção de URL na home, no índice e em um artigo publicado; veja o
   HTML recebido, o canonical escolhido e o status de indexação.
4. Execute o Rich Results Test em um artigo e em `/about`. Verifique autoria,
   datas, imagens e breadcrumbs. Dados estruturados não garantem rich results.
5. Confira uma URL ausente, um artigo não listado e o sitemap/RSS; confirme
   status HTTP, robots, ausência de drafts e atualização depois do cache.
6. Avalie PageSpeed Insights em mobile e desktop. Monitore os dados de campo de
   LCP, INP e CLS quando houver amostra suficiente. Um score de laboratório
   não equivale a desempenho medido dos leitores.

Os filtros `?tag=` mantêm o canonical `/blog` (ou `/en/blog`). O idioma dos controles
do portfólio pode mudar na mesma URL; isso não cria uma página traduzida
independente nem justifica hreflang fictício para a home.

## Próximos passos opcionais

- Bing Webmaster Tools: importe a propriedade do Search Console e envie o mesmo
  sitemap. O Bing também alimenta buscas de assistentes como o Copilot.
- IndexNow: notificar Bing e Yandex ao publicar exige uma chave publicada em
  `/<chave>.txt` e uma chamada no fluxo de publicação. O Google não usa
  IndexNow; o sitemap dinâmico já cobre a descoberta.
- Quando houver dezenas de artigos, considere páginas de tag com texto próprio
  e arquivo paginado, cada uma com canonical próprio.

## Referências oficiais

- [SEO para JavaScript](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Renderização no servidor e estática](https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering)
- [Dados estruturados de artigos](https://developers.google.com/search/docs/appearance/structured-data/article)
- [Perfil do autor](https://developers.google.com/search/docs/appearance/structured-data/profile-page)
- [Sitemaps e datas confiáveis](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Títulos nos resultados](https://developers.google.com/search/docs/appearance/title-link)
- [Resumos nos resultados](https://developers.google.com/search/docs/appearance/snippet)
- [Conteúdo útil](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [API das Edge Functions do Netlify](https://docs.netlify.com/build/edge-functions/api/)
