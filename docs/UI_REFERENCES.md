# Referências de componentes e motion

Bibliotecas externas que servem de repertório para a interface do portfólio e do
Diário. Catálogo levantado em 16/11/2026 a partir das páginas oficiais; confira
a página de cada componente antes de usar, porque nomes e licenças mudam.

## Como usar neste projeto

1. **Referência primeiro, instalação depois.** O padrão é estudar o componente e
   portar a ideia para as primitivas que o projeto já tem (GSAP + ScrollTrigger,
   Lenis, SplitType, tokens do `@theme` em `src/styles/index.css`). A home
   precisa carregar exatamente 4 chunks estáticos (`rolldown-runtime`, `react`,
   `router`, `motion`); qualquer dependência nova pode quebrar isso.
2. **Se for instalar pelo shadcn CLI**, o `components.json` já existe. Acrescente
   o namespace em `registries`, instale e depois:
   - troque cores e fontes pelos tokens Signal & Ink (`ink`, `bone`, `ember`,
     `line`, `font-display`, `font-mono`);
   - componentes que importam de `motion/react` precisam do pacote `motion`; o
     projeto tem `framer-motion`, então ajuste o import ou instale o pacote e
     inclua-o na regra `motion` do `manualChunks` em `vite.config.ts`;
   - rode `pnpm build` e confira os `modulepreload` de `dist/index.html`.
3. **Regras que valem para qualquer componente adotado:** caminho de
   `prefers-reduced-motion`, nenhuma informação disponível só no hover, texto
   vindo de `src/i18n/translations.tsx` nos dois idiomas, loops pausados fora da
   tela.

## Padrões já portados

Nenhum destes foi instalado: cada um é uma implementação própria, com GSAP,
Lenis e Canvas 2D, do padrão que as bibliotecas demonstram.

| Onde | Padrão de referência | Implementação |
| --- | --- | --- |
| Fundo do hero (campo-fonte) | ASCII Effect (Componentry), Letter Glitch e Faulty Terminal (React Bits, fundos), a parede de código de <https://ponytail.dev> | `src/animations/codeField.ts`, `src/components/canvas/CodeField.tsx` |
| Textura das margens | Dot Grid (React Bits, fundos), com fragmentos do próprio código no lugar dos pontos | `src/components/layout/CodeTooth.tsx`, utilitário `code-tooth` |
| Letreiros da home | Scroll Velocity (React Bits), Velocity Scroll (Componentry) | `src/components/ui/Marquee.tsx` |
| Frase do Sobre | Scroll Reveal (React Bits), Text Scroll animation (Skiper `skiper31`) | `useScrollReveal({ mode: 'ink' })` |
| Ferramentas, fig. 02 | Layered Stack (Componentry), Svg follow scroll (Skiper `skiper19`) | `src/components/sections/Stack.tsx` |
| Leitura de posição em Projetos | Scroll progress 001 (Skiper `skiper89`) | `src/components/sections/Work.tsx` |
| Números do Diário | Count Up (React Bits), Animated number (Skiper `skiper37`) | `CountUp` em `src/blog/pages/BlogIndex.tsx` |
| Pranchas dos registros | Topography (React Bits, fundos) | `src/blog/lib/plate.ts`, `PostPlate` |
| Troca de tema | View Transitions API, revelação circular por `clip-path` (padrão da plataforma, sem biblioteca) | `toggleTheme` em `src/lib/theme.ts`, `ThemeToggle` |
| Trilho de leitura do post | Scroll progress (Skiper), Side Scroll Navigation (Skiper `skiper60`) | `PostRail` em `src/blog/components/reading.tsx` |
| Notas de margem | Annotated Text (Componentry) | `MarginNote` em `src/blog/components/directives.tsx`, `src/blog/lib/rehype-sidenotes.ts` |
| Passo a passo com painel fixo | Sticky Scroll Cards, Scroll Choreography (Componentry), Card stack scroll (Skiper `skiper16`) | `src/blog/components/steps.tsx` |
| Barra sobre o trecho selecionado | Custom tooltip (Skiper `skiper101`) | `src/blog/components/QuoteShare.tsx` |
| Console de dossiê (`/ask`, `⌘K`) | AI Input Selector (`AI-01`), AI Text Loading (`AI-04`), AI Voice (`AI-05`), AI Tool Calls (`AI-07`), AI Send (`AI-10`), AI Context Meter (`AI-16`), AI Inline Citations (`AI-17`) (KokonutUI) | `src/agent/components/*` |

## Bibliotecas

### React Bits — <https://www.reactbits.dev/get-started/introduction>

Biblioteca aberta de componentes React animados, copiados para o projeto como
código-fonte. 222 componentes em cinco categorias.

- **Instalação:** `npx shadcn@latest add @react-bits/<Nome>-TS-TW` (sufixos
  `JS-CSS`, `JS-TW`, `TS-CSS`, `TS-TW`) ou cópia manual pela aba Code.
- **Dependências:** variam por componente e aparecem na aba Code de cada um.
- **Licença:** MIT + Commons Clause. Uso pessoal e comercial liberado; não é
  permitido revender ou redistribuir os componentes em si.
- **Mais úteis aqui**
  - Texto: Scroll Reveal, Scroll Velocity, Scroll Float, Split Text, Decrypted
    Text, Scrambled Text, Shuffle, Count Up, Variable Proximity, Text Pressure,
    Rotating Text.
  - Animações: Magnet, Logo Loop, Glare Hover, Gradual Blur, Electric Border,
    Target Cursor, Pixel Transition, Animated Content.
  - Componentes: Spotlight Card, Tilted Card, Scroll Stack, Card Swap, Magic
    Bento, Staggered Menu, Flowing Menu, Counter, Stepper.
  - Fundos: Dither, Grainient, Noise, Dot Grid, Threads, Faulty Terminal, Letter
    Glitch.

### Skiper UI — <https://skiper-ui.com/components>

Registro shadcn de componentes React/Tailwind, parte gratuita e parte paga.

- **Instalação (gratuitos):** `npx shadcn add @skiper-ui/skiper40`.
- **Instalação (Pro):** `SKIPER_LICENSE_KEY` no `.env.local` e o registro
  `@skiper-ui` com cabeçalho `Authorization` no `components.json`. A chave nunca
  entra no repositório.
- **Dependências:** framer-motion, gsap, react-use-measure, lucide-react, clsx,
  tailwind-merge.
- **Licença:** uso e modificação livres em projetos pessoais e comerciais; a
  versão gratuita exige atribuição ao Skiper UI. Os Termos de Serviço do site
  proíbem redistribuir o conteúdo, então não republique o código.
- **Gratuitos mais úteis aqui:** Scroll progress 001 (`skiper89`), Text Scroll
  animation (`skiper31`), Svg follow scroll (`skiper19`), Card stack scroll
  (`skiper16`, `skiper17`), 3D perspective text (`skiper28`), Progressive Blur
  (`skiper41`), Animated number (`skiper37`), Text roll navigation (`skiper58`),
  Mouse follow animations (`skiper61`), SVG clip path mask (`skiper66`), Scroll
  with fade effect (`skiper87`), ExpandOnHover (`skiper52`, `skiper53`), CssLink
  (`skiper40`), Custom tooltip (`skiper101`).
- **Pagos, só como referência visual:** Rolling text (`skiper27`), Horizontal
  Text reveal (`skiper72`), Projects Showcase (`skiper80`), Side Scroll
  Navigation (`skiper60`), Timeline calendar (`skiper74`), Scroll progress
  002/003 (`skiper94`, `skiper95`), Image reveal (`skiper71`), Words preloader
  (`skiper8`), Vercel Command Search (`skiper92`).

### Componentry — <https://componentry.dev/docs>

Coleção de componentes entregues como código-fonte editável, com foco em scroll,
tipografia cinética e efeitos WebGL.

- **Instalação:** registro shadcn `"@componentry": "https://componentry.dev/r/{name}.json"`.
- **Dependências e licença:** a documentação não lista; confira o repositório
  <https://github.com/harshjdhv/componentry> antes de copiar.
- **Mais úteis aqui**
  - Texto: Velocity Scroll, Letter Cascade, Kinetic Text Reveal, Text Morph,
    Flipping Word Swap, Text Repel.
  - Componentes: Annotated Text, Sticky Scroll Cards, Scroll Split Card, Scroll
    Choreography, Layered Stack, Case Study Flip Stack, Github Calendar,
    Magnetic Dock, Signature.
  - Efeitos: ASCII Effect, Dither Gradient, Magnet Lines, Pixel Canvas, Image
    Trail.

### KokonutUI — <https://kokonutui.com/docs/ai/ai-token-alternatives>

Biblioteca aberta de componentes React voltada a aplicações de IA, em cima de
Tailwind v4, Motion e shadcn/ui. Cerca de 120 componentes em nove categorias
(AI, Backgrounds, Cards, Navigation, Inputs, Media, Feedback, Texts, Buttons).
Lista completa em <https://kokonutui.com/llms.txt>.

- **Instalação:** registro `"@kokonutui": "https://kokonutui.com/r/{name}.json"`
  e `npx shadcn@latest add @kokonutui/<nome>`.
- **Dependências:** motion (`motion/react`), lucide-react, Tailwind v4.
- **Licença:** MIT no cabeçalho dos componentes; existe o Kokonut UI Pro, pago.
- **AI Token Alternatives** (o componente do link): resposta de LLM que entra
  palavra a palavra; palavras com alternativas ficam sublinhadas e abrem uma
  lista ordenada por probabilidade, com barra e percentual. Trocar uma palavra
  reescreve o restante via `compose`. Aceita `prompt`, `slots`, `compose` e traz
  o utilitário `fromLogprobs`. Serve de referência para posts do Diário sobre
  LLMs e para qualquer demonstração interativa embutida em artigo.

### Bklit UI — <https://bklit.com/>

Biblioteca aberta de gráficos React distribuída pelo registro shadcn.

- **Instalação:** `npx shadcn@latest add @bklit/area-chart`; em projeto
  existente, registro `"@bklit": "https://ui.bklit.com/r/{name}.json"`.
- **Dependências:** d3, Motion, Tailwind v4.
- **Licença:** MIT, segundo o site.
- **Gráficos:** Area, Bar, Candlestick, Choropleth, Composed, Funnel, Gauge,
  Heatmap, Line, Live Line, Particle Line, Pie, Radar, Radial, Ring, Scatter,
  Sankey, Sparkline, Sunburst.
- **Onde cabe:** painel de audiência do `/admin` (`src/admin/components/charts.tsx`)
  e gráficos dentro de posts. O painel não usa paleta categórica de propósito;
  veja `docs/ANALYTICS.md` antes de trocar qualquer gráfico.
