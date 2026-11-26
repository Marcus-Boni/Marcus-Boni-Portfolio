Imagine que você precisa fechar o mês. Abre a tela de relatórios, escolhe
novembro e clica em **Exportar CSV**. O botão fica cinza. Você espera, clica
de novo ou procura o arquivo na pasta de downloads?

Essa cena resume a pergunta que eu quis investigar depois de escrever minha
[caixa de ferramentas de front-end](/blog/caixa-de-ferramentas-front-end).
Quando a interface já está de pé, o que eu preciso conferir para saber se
ela ajuda alguém a fazer o que veio fazer? Fui atrás de como times de produto
documentam essas decisões e do que os guias para agentes de código mandam
conferir. Usei essa tela de relatórios como exemplo para trazer a pesquisa
para perto de um problema de projeto.

:::takeaways
- Quero entender a tarefa antes de decidir o que entra na tela.
- Proximidade, peso e espaço ajudam a pessoa a ler a interface na ordem certa.
- Espera, erro e recuperação precisam de texto, comportamento e teste.
- Meu teste de entrega passa pelo fluxo no celular, no teclado e com uma falha provocada.
:::

## O primeiro teste é conseguir achar o caminho

Se o pedido chega como “adicionar um botão de exportação”, a primeira
pergunta que eu faria é quem precisa do arquivo e o que faz com ele.
“Baixar os dados de novembro para fechar o mês” já me dá algo para testar.
Será que a pessoa consegue confirmar quais dados o CSV vai incluir? Será
que ela precisa distinguir a data do lançamento da data de pagamento?
Essas respostas podem mudar o filtro, o texto e até o conteúdo do arquivo.

Na prática, eu começaria pelos chamados de suporte e por uma conversa com
quem fecha o mês. Com um protótipo simples, pediria “baixe os dados de
novembro para o fechamento” e observaria por onde a pessoa começa, onde
hesita e se consegue chegar ao fim. A instrução só precisa descrever o
objetivo. O nome do controle fica para a pessoa descobrir. É uma prática
que vale repetir com quem navega por teclado ou usa leitor de tela.
[Pesquisa de necessidades no GOV.UK](https://www.gov.uk/service-manual/user-research/start-by-learning-user-needs) · [Testes moderados no GOV.UK](https://www.gov.uk/service-manual/user-research/using-moderated-usability-testing)

Isso também muda o jeito de organizar a navegação. Se período é o filtro
usado toda semana, ele merece ficar à vista. Se duas datas precisam ser
comparadas, deixo as duas acessíveis juntas. E, sempre que alguém abre
um lançamento para conferir um detalhe, vale checar se volta à lista
com o período e os filtros que já tinha escolhido.
[Heurísticas de Jakob Nielsen](https://www.nngroup.com/articles/ten-usability-heuristics/) · [Divulgação progressiva no Nielsen Norman Group](https://www.nngroup.com/articles/progressive-disclosure/)

## O que precisa aparecer primeiro

Eu montaria a tela com dados parecidos com os de verdade. **Relatório
financeiro** diz onde estou. **Novembro de 2026** me situa no tempo.
**48 lançamentos** me ajuda a confirmar o que vai sair no arquivo.
A partir daí, consigo decidir o que merece mais peso e o que pode ficar
em segundo plano. Se um rótulo parece mais perto da informação errada,
um ajuste no espaço entre os grupos pode resolver antes de eu mexer
na cor ou no tamanho da fonte.
[Refactoring UI, de Adam Wathan e Steve Schoger](https://refactoringui.com/) · [Hierarquia visual no Nielsen Norman Group](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/)

Estudando o Carbon da IBM, gostei de ver que o mesmo sistema prevê uma
tipografia mais compacta para superfícies de trabalho e outra mais
expressiva para contextos como marketing. Isso me dá um critério para
escolher densidade. Na tabela, quero que duas linhas sejam fáceis de
comparar. Numa página que apresenta um produto, posso abrir espaço
para a leitura e usar a tipografia para dar personalidade. Nos dois casos,
vale definir papéis para título, corpo e rótulo, manter a estrutura dos
títulos no HTML e testar com texto comprido.
[Tipografia do IBM Carbon](https://www.carbondesignsystem.com/building-blocks/foundations/typography/overview) · [Espaçamento do IBM Carbon](https://www.carbondesignsystem.com/building-blocks/foundations/spacing/overview)

Uma ideia que aproveitaria da pesquisa das skills é definir a direção
visual a partir do assunto e do conteúdo real. Se eu for comparar duas
propostas para uma página, colocaria a mesma oferta e a mesma ação nas
duas, para ver qual composição comunica melhor. Um título curto de exemplo
pode caber em qualquer lugar. Um título real já é um teste de layout.
[Frontend Design, da Anthropic](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) · [Huashu Design](https://github.com/alchaincyf/huashu-design/tree/59065698ad63f87ea1532c126c87f488d4f93fd6)

## O botão cinza é só um dos estados

Na tela do exemplo, eu manteria **Exportar CSV** como rótulo porque a pessoa
sabe o que vai acontecer. Durante a espera, mostraria **Gerando relatório**
perto da ação. Também conferiria o que acontece se ainda não houver
lançamentos, se os filtros zerarem a lista ou se faltar permissão. Cada
situação pede uma mensagem e uma saída próprias.

:::report-comparison
Antes, o botão de exportar fica indisponível e a tela fica em silêncio. Depois, dá para confirmar o período, ver que o arquivo está pronto e baixar o CSV.
:::

| O que aconteceu | O que eu mostraria |
| --- | --- |
| O período tem lançamentos | Quantidade de resultados e opção de exportar. |
| O filtro zerou a lista | “Nenhum lançamento em novembro” e um caminho para alterar o período. |
| O arquivo está sendo gerado | Estado de espera junto da ação, com anúncio para leitor de tela. |
| O arquivo ficou pronto | Link **Baixar CSV**. |
| A geração falhou | Mensagem sobre a falha e opção de tentar de novo com os mesmos filtros. |

Para uma espera que dá para medir, mostraria progresso. Para uma lista que
leva tempo para abrir e cuja estrutura já conheço, um *skeleton* pode ajudar.
Para a exportação, começaria com um indicador perto do botão. Se o arquivo
ficar pronto enquanto a pessoa está em outro ponto da tela, anunciaria a
mudança de estado sem tirar o foco dela.
[Estados vazios no IBM Carbon](https://www.carbondesignsystem.com/building-blocks/core/patterns/empty-states) · [Carregamento no IBM Carbon](https://www.carbondesignsystem.com/building-blocks/core/patterns/loading) · [Mensagens de status na WCAG](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

Gosto de um detalhe dos formulários do GOV.UK. Os erros aparecem no campo
e também num resumo no topo, que recebe foco e tem links para levar a
pessoa ao ponto da correção. Na tela de relatórios, “Escolha uma
data final igual ou posterior à inicial” já dá algo para fazer. Manteria
as datas digitadas para que a pessoa só precise corrigir uma delas.
Antes disso, eu tiraria da tela qualquer pergunta que o serviço já consiga
responder com os dados que tem.
[Resumo de erros do GOV.UK](https://design-system.service.gov.uk/components/error-summary/) · [Páginas de perguntas do GOV.UK](https://design-system.service.gov.uk/patterns/question-pages/) · [Notificações em formulários da WAI](https://www.w3.org/WAI/tutorials/forms/notifications/)

## A mesma tarefa no teclado e no celular

A revisão muda quando eu deixo o mouse de lado. Quero enxergar onde está
o foco, conseguir acionar **Exportar CSV** e encontrar o link **Baixar CSV**.
Se houver um diálogo, verifico para onde o foco vai ao abrir, se posso
fechá-lo com Escape e para onde volto depois. Começar com controles
nativos ajuda a preservar esses comportamentos. O botão gera o arquivo,
o link leva ao download e cada campo tem um rótulo associado.
[Práticas ARIA do W3C](https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/) · [Padrão de diálogo modal](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

No celular, deixaria o conteúdo dizer quando a grade precisa mudar. Os
filtros podem virar uma coluna assim que começam a disputar espaço. Se
a comparação entre colunas for essencial, confino a rolagem horizontal
à tabela e deixo o resto da página caber na tela. Faria a mesma revisão
com zoom, textos longos e nos temas que o produto oferece.
[Responsividade no web.dev](https://web.dev/articles/responsive-web-design-basics) · [Reflow na WCAG](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)

A WCAG 2.2 AA dá números para tirar parte dessa revisão do olho. Texto
comum pede contraste de pelo menos **4,5∶1** e texto grande, **3∶1**. Para
as pistas visuais de certos controles, estados e gráficos, também há um
critério de **3∶1**. O alvo de ponteiro em AA parte de **24 × 24 CSS px**,
com exceções como espaçamento suficiente. Em AAA, o critério aprimorado usa
**44 × 44 CSS px**, também com exceções. E, para o conteúdo comum, a
referência de refluxo é **320 CSS px** de largura sem rolar nos dois eixos.
Eu usaria esses critérios junto da passagem por teclado, toque e leitor de
tela no caminho inteiro.
[WCAG 2.2](https://www.w3.org/TR/WCAG22/) · [Contraste de texto](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) · [Contraste não textual](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) · [Tamanho do alvo](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

## A frequência muda a decisão de animar

O Emil Kowalski trouxe uma pergunta que ficou comigo. Quantas vezes a
pessoa vai ver essa animação? Dá para gostar da primeira abertura de um
painel e cansar da décima. Para um filtro que muda toda hora, eu testaria
a versão com resposta imediata. Para um painel que abre sobre a tabela,
uma transição curta pode mostrar de onde ele veio. Com
`prefers-reduced-motion`, mantenho o texto e o estado visível e reduzo o
deslocamento. Se o efeito pesa, começo examinando o que muda a cada quadro.
[Emil Kowalski sobre frequência de uso](https://emilkowal.ski/ui/you-dont-need-animations) · [Movimento no Apple HIG](https://developer.apple.com/design/human-interface-guidelines/motion) · [Animações de alto desempenho no web.dev](https://web.dev/articles/animations-guide)

## Onde o tempo da pessoa está indo

Eu mediria a abertura da rota e também a troca de período e o clique para
exportar. Cada etapa pode ter um gargalo diferente. Se a tela pula quando
o conteúdo entra, verifico se imagens e outros elementos tardios têm espaço
reservado. Se o conteúdo principal demora, investigo quando seu recurso é
descoberto e o que compete com ele. Se o filtro demora a responder, procuro
requisições independentes que estão esperando umas pelas outras e trabalho
demais na thread principal.
[Otimização de LCP](https://web.dev/articles/optimize-lcp) · [Otimização de CLS](https://web.dev/articles/optimize-cls) · [Otimização de INP](https://web.dev/articles/optimize-inp) · [React Best Practices da Vercel](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices)

Para acompanhar em produção, uso as referências de Core Web Vitals do
Google. **LCP até 2,5 s** para o conteúdo principal aparecer, **INP até
200 ms** para a resposta visual das interações e **CLS até 0,1** para
deslocamentos inesperados. A avaliação usa o percentil 75, com mobile
e desktop separados. Quando tiver dados de campo, quero usá-los para
encontrar a rota ou interação que merece atenção. O laboratório entra
para reproduzir o problema em condições conhecidas.
[Core Web Vitals](https://web.dev/articles/vitals)

## O que deixo registrado para a próxima tela

No GitHub Actions, a equipe adaptou uma navegação que já existia nas
configurações e usou o Primer para atender a diferentes larguras. Também
agrupou execuções de workflows reutilizáveis e acrescentou um caminho
de volta à lista. É o tipo de reaproveitamento que eu procuraria no
meu projeto. A base já está lá e a tarefa nova diz o que precisa mudar.
[Redesenho da navegação do GitHub Actions](https://github.blog/news-insights/product-news/improving-navigation-for-github-actions/)

Se o padrão vai voltar em outra tela, quero deixar registrada a decisão
por trás dele. Um token como `text-muted` tem um papel que continua
valendo quando a cor muda no tema escuro. Um componente de exportação
também precisa ter claro como comunica geração, sucesso e falha. No React,
eu representaria esses estados de forma explícita, para o código evitar
combinações como “arquivo pronto” e “gerando” ao mesmo tempo. No teste,
procuraria a ação pelo nome que a pessoa lê e executaria o caminho até
o download e até a recuperação de um erro.
[Tokens da Atlassian](https://atlassian.design/foundations/tokens/) · [Estrutura de estado no React](https://react.dev/learn/choosing-the-state-structure) · [Boas práticas do Playwright](https://playwright.dev/docs/best-practices)

Com um agente de código, eu colocaria no pedido o que gostaria de poder
conferir na entrega. Para essa tela, seria algo como “ao falhar a geração,
preserve o período, explique o que aconteceu e permita tentar de novo pelo
teclado”. Daí dá para abrir o navegador, provocar a falha e ver se a
interface cumpriu o combinado. Foi uma das ideias mais práticas que tirei
das skills de revisão.
[Frontend UI Engineering, de Addy Osmani](https://skills.addy.ie/skills/frontend-ui-engineering/) · [Better Interface, de Jakub Krehel](https://github.com/jakubkrehel/skills/tree/672ae44ace6aaed65b86cbb1e2fd6fbea0e79578)

## A revisão que eu faria antes de entregar

1. Peço a alguém para executar a tarefa e observo onde precisa parar para pensar ou pedir ajuda.
2. Abro a tela no celular e confiro se o conteúdo real acompanha a ordem em que eu preciso tomar decisões.
3. Faço o caminho de teclado e verifico o foco e os avisos com leitor de tela.
4. Simulo conexão lenta, nenhum resultado e falha. Confiro se consigo retomar a tarefa.
5. Registro as decisões que vão se repetir e o teste que ajuda a protegê-las.

Se eu só tiver tempo para uma passada, faço a tarefa principal com teclado,
provoco uma falha e tento sair dela. É assim que eu voltaria àquela tela
do começo. Só considero a exportação resolvida quando está claro o que
aconteceu com o arquivo e o que dá para fazer em seguida.
