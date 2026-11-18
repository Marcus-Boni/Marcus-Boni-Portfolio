# marcus-portfolio

Portfólio e Diário (blog) de Marcus Boni. React 19, Vite 8 (Rolldown),
TypeScript 6, Tailwind v4, GSAP + Lenis, Firebase, hospedado na Netlify com
edge functions.

## Comandos

```bash
pnpm dev      # servidor de desenvolvimento (porta 5173)
pnpm build    # tsc -b && vite build
pnpm lint     # eslint
pnpm test     # vitest run
```

## Antes de mexer em interface

- **Identidade:** `DESIGN.md` descreve o sistema Signal & Ink (tokens, tipos,
  componentes, regras de acessibilidade). Os tokens vivem no `@theme` de
  `src/styles/index.css`.
- **Referências de componentes e motion:** `docs/UI_REFERENCES.md` cataloga
  React Bits, Skiper UI, Componentry, KokonutUI e Bklit UI, com instalação,
  licença, o que serve para este projeto e o que já foi portado. A regra é
  estudar o padrão e portar para as primitivas daqui; instalar é exceção.
- **Texto:** toda cópia vai em `src/i18n/translations.tsx`, nos dois idiomas
  (a interface `Translation` quebra o build se faltar um).
- **Primitivas de motion que já existem** — use antes de criar outra:
  `useGsapScope`, `useScrollReveal` (`lines`, `chars`, `ink`), `useMagnetic`,
  `useScramble`, `useScrollHeader`, `HoverItalic`, `Marquee`, `SectionHeading`,
  `PostPlate`. O ease padrão do GSAP é `EASE_SIGNAL` (`src/animations/gsap.ts`).
- Toda animação precisa de caminho para `prefers-reduced-motion` e nenhum loop
  roda fora da tela.

## Armadilhas

1. **Chunks da home.** A home carrega exatamente 4 chunks estáticos
   (`rolldown-runtime`, `react`, `router`, `motion`). Depois de mexer em
   dependências ou em `manualChunks`, confira:

   ```bash
   pnpm build && grep -o 'modulepreload[^>]*href="/assets/[^"]*"' dist/index.html
   ```

   Os comentários de `vite.config.ts` explicam por que cada regra existe; não
   crie regra para o pipeline remark/rehype nem inclua `@shikijs/langs`.
2. **Hooks de animação e montagem.** `useScrollReveal` e `useGsapScope` ligam a
   animação no efeito de montagem do componente que os chama. Se o elemento só
   aparece depois (dados assíncronos), o efeito já rodou, não achou o nó e um
   `[data-reveal]` fica `visibility: hidden` para sempre. Coloque o hook num
   componente que só monta quando o elemento existe (veja `PostTitle` em
   `src/blog/pages/BlogPost.tsx`).
3. **Troca de idioma remonta a página.** `<main key={locale}>` recria todas as
   seções para o SplitType e os ScrollTriggers refazerem o trabalho. Qualquer
   coisa fora do `<main>` que observe seções (o `SectionRail`, por exemplo)
   precisa reagir a `locale`.
4. **`three` está em `^0.182.0`.** O React Three Fiber 9 usa `THREE.Clock`,
   descontinuado na r183. Não suba a versão sem conferir o R3F.
5. **Testes que fixam contrato de interface.** `tests/stack-content.test.ts`
   (todas as tecnologias visíveis, uma vez, sem painel fechado),
   `tests/work-accessibility.test.ts` (galeria sem motion) e
   `tests/blog-article-semantics.test.ts` (um `h1`, `lang`, datas em `<time>`,
   trilha e links relacionados). Mudou a marcação? Rode `pnpm test`.

6. **Blocos do corpo do post.** `PostBody` renderiza fora do `LanguageProvider`
   (preview do admin, testes): dentro dele use `useBodyLabels()`, nunca
   `useLanguage`. Diretiva nova passa por quatro lugares: `remark-blog.ts`, o
   mapa de componentes do `PostBody`, o de `netlify/lib/blog-html.ts` e o mock
   de `directives` em `tests/blog-client-seo.test.ts`.

7. **O conteúdo publicado vem do CMS.** Perfil, projetos, experiência e
   tecnologias são lidos do Firestore (`content/site`) e substituem os padrões
   de `src/data/profile.ts` assim que carregam. Mudar o padrão não muda o site
   publicado: a lista precisa ser salva em `/admin`. Para tecnologias,
   `/admin → Perfil` mostra as que faltam e as adiciona com um clique. Os
   padrões têm cópias que os testes conferem: o texto estático de
   `index.html`, `public/llms-full.txt`, `netlify/lib/agent-docs.ts` e
   `public/api/v1/*.json` (este último se regenera com
   `pnpm exec vitest run tests/api-payloads.test.ts -u`).

## Diário em desenvolvimento

Sem posts publicados o índice mostra o estado vazio. Para desenhar e revisar com
conteúdo, abra `/blog?demo=1` no servidor de desenvolvimento: os registros de
exemplo de `src/blog/dev-fixtures.ts` substituem o Firestore até `/blog?demo=0`.
O ramo é eliminado no build de produção.

## Documentação

| Arquivo | Assunto |
| --- | --- |
| `DESIGN.md` | Sistema visual, componentes e regras de interação |
| `docs/UI_REFERENCES.md` | Bibliotecas de referência e padrões portados |
| `docs/BLOG.md` | Arquitetura, publicação e sintaxe do Diário |
| `docs/SEO.md` | Contrato de SEO e HTML renderizado na edge |
| `docs/ANALYTICS.md` | Definições das métricas do painel |
| `docs/ADMIN_SETUP.md` | Configuração do `/admin` |
| `docs/AGENTS.md` | Endpoints e documentos para agentes |
