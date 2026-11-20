Eu vivia salvando estes links em lugares diferentes. Este registro existe para
eu parar: é a lista do que eu abro quando quero construir um front-end bonito,
moderno e com cara de produto, e é para cá que eu mesmo vou voltar.

São dezesseis endereços em seis prateleiras: a base em que quase tudo se
instala, as coleções de componentes, as bibliotecas de movimento, o 3D, as
skills que dão critério de design ao agente de código e a pesquisa da marca do
cliente. Todos têm versão gratuita. Onde existe plano pago ou condição de
licença, a observação está em nota.

:::takeaways
- O shadcn/ui é a base: as cinco coleções daqui se instalam pelo mesmo comando.
- Coleção é repertório. Eu estudo o padrão e levo para o projeto só o que ele precisa.
- Uma biblioteca por trabalho: o GSAP coreografa a rolagem, o Lenis a suaviza, o Motion cuida do estado e o Anime.js resolve a página sem framework.
- 3D é a última camada. O Three.js entra quando a ideia pede profundidade de verdade e só carrega depois que a página já está de pé.
- Skill não desenha por mim. Ela dá vocabulário ao agente e uma régua para revisar o que saiu.
- Projeto de cliente começa pela marca do cliente. A pesquisa vem antes do primeiro componente.
- Antes de copiar, três conferências: licença, movimento reduzido e peso no bundle.
:::

:::callout{type=tip title="O kit em um link só"}
Os dezesseis endereços também estão em uma página própria, para abrir, compartilhar e baixar: favoritos que entram no navegador como uma pasta, a lista em Markdown e o comando que instala as skills. [marcusboni.com.br/kit/front-end](/kit/front-end)
:::

## O mapa

Para quem só quer o endereço certo, a tabela resolve. O resto do registro
explica cada linha.

| Ferramenta | Eu abro quando | Licença |
| --- | --- | --- |
| [shadcn/ui](https://ui.shadcn.com/) | preciso da base: botão, diálogo, formulário | MIT |
| [React Bits](https://www.reactbits.dev/get-started/introduction) | quero texto, fundo ou cartão animado | MIT + Commons Clause |
| [Skiper UI](https://skiper-ui.com/components) | procuro interação de rolagem ou de cursor | Gratuita com atribuição |
| [Componentry](https://componentry.dev/docs) | o assunto é scroll, tipografia cinética ou WebGL | MIT |
| [KokonutUI](https://kokonutui.com/docs/ai/ai-token-alternatives) | a tela é de um produto de IA | MIT |
| [Bklit UI](https://bklit.com/) | preciso de um gráfico | MIT |
| [GSAP](https://gsap.com/) | a rolagem dirige a animação | Gratuita, licença própria |
| [Lenis](https://lenis.dev/) | a página pede rolagem suave | MIT |
| [Motion](https://motion.dev/docs) | o movimento depende do estado do React | MIT |
| [Anime.js](https://animejs.com/documentation/) | quero uma linha do tempo sem framework | MIT |
| [Three.js](https://github.com/mrdoob/three.js/) | a ideia pede 3D: modelo, cena, shader | MIT |
| [Impeccable](https://impeccable.style/docs/impeccable/) | vou revisar ou refinar uma interface com o agente | Apache 2.0 |
| [Taste Skill](https://www.tasteskill.dev/) | o agente vai criar um site do zero | MIT |
| [emilkowalski/skills](https://github.com/emilkowalski/skills) | o assunto é animação de interface | MIT |
| [research](https://github.com/mattpocock/skills/tree/main/skills/engineering/research) | preciso levantar a marca de um cliente | MIT |
| [Firecrawl](https://www.firecrawl.dev/) | o agente precisa ler o site do cliente | AGPL-3.0 |

## A base: shadcn/ui

O [shadcn/ui](https://ui.shadcn.com/) não entra no projeto como dependência. A
linha de comando copia o código de cada componente para dentro do repositório, e
dali em diante ele é seu: dá para ler, trocar o estilo e apagar o que sobra. A
própria documentação avisa que aquilo não é uma biblioteca de componentes, e sim
o jeito de construir a sua.

```bash title="terminal"
npx shadcn@latest init
npx shadcn@latest add button
```

O que faz dele a base desta lista é o **registro**: um endereço que entrega
componentes no formato que essa linha de comando entende. Qualquer pessoa pode
publicar um, e as cinco coleções da próxima seção publicaram.[^mcp] O Componentry,
o KokonutUI e o Bklit pedem uma linha cada no `components.json`:

```json title="components.json"
{
  "registries": {
    "@componentry": "https://componentry.dev/r/{name}.json",
    "@kokonutui": "https://kokonutui.com/r/{name}.json",
    "@bklit": "https://ui.bklit.com/r/{name}.json"
  }
}
```

Daí em diante instalar é sempre o mesmo comando, só com outro prefixo. Estes são
os exemplos que cada documentação imprime:

```bash title="terminal"
npx shadcn@latest add @react-bits/SplitText-TS-TW
npx shadcn@latest add @skiper-ui/skiper40
npx shadcn@latest add @kokonutui/ai-token-alternatives
npx shadcn@latest add @bklit/area-chart
```

## Coleções de componentes

Nenhuma delas eu instalo inteira. Uso como repertório: abro com uma pergunta na
cabeça (como mostrar o progresso de leitura? como revelar um título?), vejo como
duas ou três resolveram e decido se instalo o componente ou se reescrevo o
padrão com o que o projeto já tem.

### React Bits

O [React Bits](https://www.reactbits.dev/get-started/introduction) é uma
biblioteca aberta com mais de duzentos componentes React animados, entre texto,
animações, componentes e fundos.[^reactbits] Cada um vem em quatro variantes:
JavaScript ou TypeScript, CSS puro ou Tailwind. É onde eu começo quando quero um
título que se revela, um fundo com textura ou um cartão que reage ao cursor.

### Skiper UI

O [Skiper UI](https://skiper-ui.com/components) é um registro de componentes
React e Tailwind com uma parte gratuita e outra paga.[^skiper] Os gratuitos que
eu mais consulto são os de rolagem e de cursor: barra de progresso, texto que se
revela conforme a página desce, pilha de cartões.

### Componentry

O [Componentry](https://componentry.dev/docs) entrega os componentes como
código-fonte editável, com foco em scroll, tipografia cinética e efeitos WebGL.
Foi de lá que saiu a ideia das notas que acompanham este registro.[^componentry]

### KokonutUI

O [KokonutUI](https://kokonutui.com/docs) é uma biblioteca aberta voltada a
aplicações de IA, construída sobre Tailwind v4, Motion e shadcn/ui.[^kokonut] A
categoria que justifica o link é a de IA: seletor de modelo, chamadas de
ferramenta, citações em linha, medidor de contexto. O componente que eu deixei
marcado é o [AI Token Alternatives](https://kokonutui.com/docs/ai/ai-token-alternatives):
uma resposta de modelo em que cada palavra incerta mostra as alternativas que o
modelo pesou, com a probabilidade de cada uma.

### Bklit UI

O [Bklit UI](https://bklit.com/) distribui gráficos em React pelo mesmo
registro, feitos com d3, Motion e Tailwind v4. Vai do básico (área, barra, linha,
pizza) ao que normalmente exige outra biblioteca: Sankey, sunburst, candlestick,
mapa coroplético. É onde eu olho primeiro quando um painel precisa de gráfico.

## Movimento

São quatro bibliotecas e cada uma tem um trabalho. Quando duas fazem o mesmo
trabalho na mesma página, o bundle cresce e as animações passam a disputar o
mesmo elemento.

### GSAP

O [GSAP](https://gsap.com/) é a biblioteca que eu uso quando a animação precisa
de precisão: linhas do tempo, controle de reprodução e, com o plugin
ScrollTrigger, movimento amarrado à rolagem. Hoje é um produto da Webflow e
ficou gratuito por inteiro, inclusive os plugins que eram pagos, como SplitText
e MorphSVG.[^gsap] A instalação é `npm install gsap`, e é ele que coreografa
este site.

A galeria de projetos da home resume o que ele faz. A seção fica presa na tela
(`pin`) e a rolagem vertical empurra a trilha de painéis para o lado (`scrub`):

```ts title="src/components/sections/Work.tsx" {8-9}
gsap.to(track, {
  x: () => -distance(),
  ease: 'none',
  scrollTrigger: {
    trigger: root,
    start: 'top top',
    end: () => `+=${distance() * WORK_TRAVEL_RATIO}`,
    pin: true,
    scrub: 1,
    invalidateOnRefresh: true,
  },
})
```

Dois cuidados valem para qualquer uso. Em React, toda animação criada em um
efeito precisa ser revertida na desmontagem, e o pacote `@gsap/react` traz o
hook `useGSAP` para isso. E `gsap.matchMedia()` deixa a coreografia existir só
onde faz sentido: aqui, a galeria horizontal só é montada em tela larga.

### Lenis

O [Lenis](https://lenis.dev/), da darkroom.engineering, suaviza a rolagem sem
trocá-la: a página continua rolando de verdade, então `position: sticky` e a
barra de rolagem seguem funcionando.[^lenis] É leve, não tem dependências e roda
na home e no Diário deste site, inclusive nesta página.

O que dá trabalho é o relógio. O Lenis e o ScrollTrigger precisam avançar no
mesmo quadro. Se cada um tiver o seu laço, o conteúdo fixado treme. É assim que
este site liga os dois, em versão resumida:

::::steps
```tsx title="src/components/layout/SmoothScroll.tsx" numbers
export function SmoothScroll({ children }: Props) {
  const lenisRef = useRef<LenisRef>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    if (reduced) return
    const lenis = lenisRef.current?.lenis
    const update = (time: number) => lenis?.raf(time * 1000)

    gsap.ticker.add(update)
    gsap.ticker.lagSmoothing(0)
    lenis?.on('scroll', ScrollTrigger.update)
    return () => {
      gsap.ticker.remove(update)
      lenis?.off('scroll', ScrollTrigger.update)
    }
  }, [reduced])

  if (reduced) return <>{children}</>
  return (
    <ReactLenis
      root
      ref={lenisRef}
      options={{ autoRaf: false }}
    >
      {children}
    </ReactLenis>
  )
}
```

:::step{lines=24}
**Sem relógio próprio.** `autoRaf: false` avisa ao Lenis que ele não vai rodar o
próprio `requestAnimationFrame`. Alguém de fora vai chamar `raf` a cada quadro.
:::

:::step{lines=8,10-11}
**Um relógio só.** Esse alguém é o `ticker` do GSAP. Ele entrega o tempo em
segundos e o Lenis espera milissegundos, daí o `* 1000`. Já o `lagSmoothing(0)`
desliga a compensação de atraso do GSAP: com ela ligada, depois de um quadro
lento o tempo da animação e a posição da rolagem deixariam de bater.
:::

:::step{lines=12}
**A rolagem avisa.** A cada evento de rolagem do Lenis, o ScrollTrigger
recalcula. É o que mantém os trechos fixados e as animações presas ao scroll na
posição certa.
:::

:::step{lines=3,6,19}
**Movimento reduzido.** Quem pediu menos movimento no sistema não recebe o
Lenis. O componente devolve os filhos sem nada em volta e a rolagem é a do
navegador.
:::

:::step{lines=13-16}
**Limpeza.** Ao desmontar, o laço e o ouvinte saem. Sem isso, cada troca de
página deixaria um relógio rodando.
:::
::::

### Motion

O [Motion](https://motion.dev/docs) é o antigo Framer Motion.[^motion] Entra
quando o movimento nasce do estado do React: um item que entra e sai da árvore,
um layout que se reorganiza, um gesto de arrastar. A animação é declarada no
próprio componente, e o `AnimatePresence` cobre o caso mais chato, que é animar
a saída de um elemento que o React já tirou da árvore. O menu deste site abre e
fecha assim.

```tsx title="Aviso.tsx" {8}
import { AnimatePresence, motion } from 'motion/react'

<AnimatePresence>
  {aberto && (
    <motion.p
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
    >
      Salvo.
    </motion.p>
  )}
</AnimatePresence>
```

Fora do React existe a função `animate`, importada direto de `motion`, e há uma
versão para Vue.

### Anime.js

O [Anime.js](https://animejs.com/documentation/), do Julian Garnier, é um motor
de animação em JavaScript puro. A versão 4 é modular: importo `animate`,
`createTimeline` ou `stagger` e só isso vai para o bundle. A biblioteca inteira
fica em torno de 24 KB. Faz boa parte do que o GSAP faz (linha do tempo, traço
de SVG, texto dividido em letras) com licença MIT e pagando só pelo que foi
importado. É a que eu escolho para página sem framework, de um HTML estático a
um site em Astro.

No React, a documentação recomenda criar um escopo dentro do efeito e reverter
na desmontagem:

```tsx title="Logo.tsx" {5}
useEffect(() => {
  scope.current = createScope({ root }).add(() => {
    animate('.logo', { rotate: 360, duration: 1200 })
  })
  return () => scope.current.revert()
}, [])
```

### Qual eu uso para quê

| Trabalho | Ferramenta |
| --- | --- |
| Rolagem suave | Lenis |
| Animação dirigida pela rolagem, com trecho fixado | GSAP com ScrollTrigger |
| Entrada, saída e layout em React | Motion |
| Sequência e SVG em página sem framework | Anime.js |

## Terceira dimensão: Three.js

O [Three.js](https://github.com/mrdoob/three.js/) é para quando a ideia cresce
além do 2D: um modelo que gira na página, uma cena com luz e câmera, um efeito
escrito em shader. É uma biblioteca de 3D para o navegador, com renderizadores
WebGL e WebGPU.[^three]

Vale um ajuste de expectativa: o Three.js não modela, ele mostra. O modelo nasce
em uma ferramenta como o Blender, sai em glTF, e o Three.js carrega esse arquivo
com o `GLTFLoader`, ilumina e renderiza.

```bash title="terminal"
npm install three @react-three/fiber
```

Em React eu uso pelo React Three Fiber, que descreve a cena como componentes. O
fundo da capa deste site é isso: um plano do tamanho da tela com um shader que
reage ao cursor e à velocidade da rolagem.

```tsx title="src/components/canvas/InkFieldScene.tsx" {2-3}
<Canvas
  frameloop={active ? 'always' : 'never'}
  dpr={[1, isDesktop ? 1.5 : 1]}
  orthographic
>
  <InkPlane />
</Canvas>
```

O Three.js é, de longe, o item mais pesado desta lista, então ele entra com
regras:

- **Carrega por último.** Fica em um arquivo separado, baixado só depois da primeira interação. Até lá a capa mostra um gradiente estático.
- **Para fora da tela.** Quando a capa sai da área visível, o laço de renderização é desligado: é o `frameloop` virando `never`.
- **Resolução com teto.** A densidade de pixels vai até 1,5 no computador e fica em 1 no celular. Renderizar na densidade cheia de uma tela de celular multiplica os pixels sem ganho visível.
- **Movimento reduzido.** Quem pediu menos movimento fica com o gradiente estático e nem baixa a biblioteca.

## Skills: critério para o agente

Boa parte das minhas interfaces hoje é escrita com um agente de código ao lado,
e agente sem direção entrega sempre a mesma tela genérica. Uma skill é um pacote
de instruções que o agente carrega quando a tarefa pede. Estas três tratam de
design e se instalam em agentes como Claude Code, Cursor e Codex.

### Impeccable

O [Impeccable](https://impeccable.style/docs/impeccable/), do Paul Bakaus, dá ao
agente um vocabulário de design e um conjunto de comandos em torno de
`/impeccable`. O `shape` planeja antes do código, o `critique` faz uma revisão de
UX com nota, o `audit` levanta problemas técnicos, e `polish` e `harden` fecham o
trabalho. O `init` escreve um `PRODUCT.md` com público e propósito, e o
`document` registra o sistema visual em um `DESIGN.md` que os comandos seguintes
leem.[^designmd]

A parte que eu mais uso é o detector: dezenas de regras determinísticas, sem
modelo e sem chave de API, que apontam os vícios típicos de interface gerada por
IA.

```bash title="terminal"
npx impeccable install
npx impeccable detect src/
```

### Taste Skill

A [Taste Skill](https://www.tasteskill.dev/), do Leon Lin e do blueemi, cuida da
direção de arte quando o agente vai criar um site do zero. Ela escolhe uma entre
vinte direções, com paleta, busca imagens de referência e confere o resultado em
um navegador antes de entregar.[^taste]

```bash title="terminal"
npx skills add Leonxlnx/taste-skill
```

### emilkowalski/skills

As skills do Emil Kowalski, autor do Sonner, são dezenove e quase todas tratam
de animação de interface. A `animate` constrói uma animação escolhendo curva,
duração e propriedades. A `review-animations` revisa as que já existem. A
`remove-animations` tira o movimento que não precisa existir, e a
`animation-performance` vai atrás dos quadros perdidos. Fora de animação, a
`break-ui` testa a tela com os piores dados possíveis.

::repo{owner=emilkowalski name=skills desc="Skills para designers e engenheiros: animação, gestos e revisão de interface."}

```bash title="terminal"
npx skills@latest add emilkowalski/skills
```

Um exemplo do tipo de regra que elas ensinam: animação de entrada usa
`ease-out`, não `ease-in`.

## Pesquisa: a marca do cliente

Em projeto de cliente a direção de arte não é minha para inventar. A interface
precisa sair com a paleta, a tipografia e o logo de quem contratou, então antes
de abrir qualquer coleção eu levanto isso com duas ferramentas que trabalham
juntas.

### research

A [research](https://github.com/mattpocock/skills/tree/main/skills/engineering/research)
é uma skill do Matt Pocock. Ela manda um agente em segundo plano, com contexto
limpo, investigar uma pergunta em fontes primárias e guardar o resultado em um
único arquivo Markdown dentro do repositório, com a fonte de cada afirmação. Para
uma marca, a fonte primária é o próprio cliente: o site, o manual de identidade,
os perfis oficiais.

```bash title="terminal"
npx skills@latest add mattpocock/skills
```

### Firecrawl

O [Firecrawl](https://www.firecrawl.dev/) é o que dá olhos a esse agente. É uma
API de dados da web feita para agentes: lê uma página e devolve Markdown limpo,
captura de tela ou dados estruturados.[^firecrawl] O formato que me interessa
aqui é o `branding`, que extrai a identidade da página: esquema de cores, paleta,
fontes, escala tipográfica, espaçamentos, logo e favicon.

```json title="POST /v2/scrape" {3}
{
  "url": "https://www.cliente.example",
  "formats": ["branding", "screenshot", "images"]
}
```

No agente a instalação é uma linha. Com ela, o agente que a research dispara
passa a ter como ler o site do cliente, tirar a captura de tela e listar as
imagens.

```bash title="terminal"
npx -y firecrawl-cli@latest init --all --browser
```

O que sai disso é um arquivo de pesquisa no repositório, com as cores em
hexadecimal, as fontes, o logo e a página de onde cada coisa veio. É dele que
saem os tokens do projeto e o `DESIGN.md`.

:::callout{type=tip title="Extração é ponto de partida"}
Cor de marca eu confirmo no manual de identidade, quando existe. Logo eu peço em
vetor ao cliente: a imagem tirada do site serve de referência, não de arquivo
final.
:::

## Como as peças se encaixam

1. **Direção antes de componente.** Em projeto de cliente, começo pela pesquisa da marca. O `PRODUCT.md` e o `DESIGN.md` registram para quem é a interface e como ela se parece. Sem isso, qualquer componente bonito vira colagem.
2. **Procuro o padrão, não a peça.** Abro as coleções com uma pergunta e comparo duas ou três respostas.
3. **Instalo ou reescrevo.** Se o componente encaixa e o projeto já tem as dependências dele, instalo pelo registro. Se ele traria uma biblioteca nova para fazer uma coisa só, reescrevo o padrão com o que já está no projeto.
4. **Visto com os tokens.** Cores, fontes e espaçamentos do componente saem, entram os do projeto.
5. **Reviso.** Detector do Impeccable, navegação por teclado, movimento reduzido e o tamanho do build.

Este site é o exemplo que eu tenho à mão. Nenhum componente dessas coleções foi
instalado nele: os padrões foram reescritos com GSAP, Lenis e os tokens do
projeto, e nenhuma dependência nova entrou no bundle por causa disso. O letreiro
da home partiu do Scroll Velocity do React Bits e do Velocity Scroll do
Componentry. O painel fixo do passo a passo, algumas seções acima, partiu dos
Sticky Scroll Cards do Componentry e do Card stack scroll do Skiper.

## O que eu confiro antes de copiar

:::callout{type=warn title="Licença primeiro"}
Gratuito não significa sem condição. Nesta lista há Commons Clause, exigência de
atribuição e planos pagos convivendo com a parte aberta. Leia a licença do
componente específico antes de levar para um projeto de cliente.
:::

- **Movimento reduzido.** Todo efeito precisa de um caminho para `prefers-reduced-motion`. Muita coisa copiada não tem.
- **Nada só no hover.** Informação que aparece apenas com o cursor não existe no toque nem no teclado.
- **Laço fora da tela.** Canvas, WebGL e letreiros param quando saem da área visível.
- **Peso.** Um componente pode trazer uma biblioteca de animação inteira. Compare o bundle antes e depois.

A lista vale para novembro de 2026. Quando a bancada mudar, este registro muda
junto.

[^mcp]: O shadcn também tem um servidor MCP, ligado com `npx shadcn@latest mcp init --client claude`. Com ele o agente pesquisa e instala itens de qualquer registro configurado.
[^reactbits]: A licença é MIT com Commons Clause. Uso pessoal e comercial está liberado; revender ou redistribuir os componentes em si, não.
[^skiper]: A versão gratuita pede atribuição ao Skiper UI, e os termos do site proíbem republicar o código.
[^componentry]: O padrão de lá se chama Annotated Text. Aqui ele foi reescrito sobre as notas de rodapé do Markdown, sem instalar nada.
[^kokonut]: Os componentes são MIT. O Kokonut UI Pro, pago, acrescenta mais componentes e modelos de página.
[^gsap]: A licença não é MIT. É a licença padrão sem custo do GSAP: libera uso comercial e proíbe usar a biblioteca em ferramentas de criar animação sem código que concorram com a da Webflow.
[^three]: Este site usa a r182 de propósito. O React Three Fiber 9 depende do `THREE.Clock`, que a r183 marcou como obsoleto, então a versão só sobe depois de conferir o R3F.
[^lenis]: Os limites estão no README. Não combina com CSS scroll-snap (existe o pacote `lenis/snap` para isso), e um contêiner com rolagem própria precisa ser marcado com `data-lenis-prevent`.
[^motion]: O pacote hoje se chama `motion` e o import do React é `motion/react`. Projetos mais antigos, como este site, ainda importam de `framer-motion`. A biblioteca é aberta; o Motion+ é pago.
[^designmd]: Este site tem um `DESIGN.md` assim. É ele que mantém cor, tipografia e movimento coerentes entre a home e o Diário.
[^firecrawl]: O código é aberto, sob AGPL-3.0, e dá para hospedar por conta própria. O serviço tem um plano gratuito com créditos mensais, sem cartão.
[^taste]: Pede Node 22 ou mais novo e um navegador Chromium instalado, por causa da conferência no navegador.
