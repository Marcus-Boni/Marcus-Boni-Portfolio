# Analytics — o que é medido, como e por quê

Analytics próprio, sem cookies e sem terceiros: eventos anônimos gravados no
Firestore e agregados no `/admin`. Este documento define cada métrica. Um número
sem definição não é um insight — é um número.

- **Painel** (`/admin`) — últimos 7 dias, o essencial.
- **Audiência** (`/admin/analytics`) — janela selecionável, todos os cortes.

---

## 1. Modelo de eventos

Cada interação vira um documento em `analytics`. O visitante é identificado por
um id aleatório em `localStorage` e a sessão por um id em `sessionStorage` — sem
cookies, sem fingerprint, sem IP.

| Evento | Quando dispara |
| --- | --- |
| `pageview` | Em toda rota, no portfólio **e** no blog |
| `section_view` | Cada seção da home que entra em tela (uma vez) |
| `post_view` | Abertura de um post |
| `post_read` | Post rolado até **75%** |
| `post_share` | LinkedIn, X ou "copiar link" no rodapé do post |
| `blog_index_view` | Índice do blog |
| `outbound_click` | Clique em link externo |
| `cv_download` | Download do currículo |
| `contact_submit` | Envio do formulário |
| `language_change` | Troca de idioma |

> **Ao adicionar uma rota nova, garanta que ela dispare `pageview`.** O blog
> ficou de fora da métrica principal de visitas até isso ser corrigido: ele só
> emitia `post_view`, então nem "Visitas" nem "Páginas mais vistas" enxergavam
> um único leitor.

---

## 2. Definições das métricas

| Métrica | Definição exata |
| --- | --- |
| **Visitas** | Contagem de `pageview`. |
| **Visitantes únicos** | `visitorId` distintos. Quem limpa o `localStorage` vira um novo visitante. |
| **Sessões** | `sessionId` distintos. A sessão morre ao fechar a aba. |
| **Páginas por sessão** | Visitas ÷ sessões. |
| **Taxa de rejeição** | Sessões **sem engajamento** ÷ sessões. Uma sessão engaja se tiver ≥2 visitas, **ou** ≥3 `section_view`, **ou** qualquer `outbound_click` / `cv_download` / `contact_submit` / `post_read` / `post_share`. |
| **Duração média** | Último menos primeiro evento da sessão. Sessões de evento único não entram (não têm duração medível) e sessões acima de **2 horas** também não. |
| **Taxa de leitura** | `post_read` ÷ `post_view` por post. Separa quem abriu de quem leu. |

### Por que a rejeição precisa dessa definição

O portfólio é uma página só. Pela definição clássica ("sessão com uma única
pageview") **toda** sessão seria rejeição, sempre, e a métrica não diria nada. A
definição acima mede o que interessa: a pessoa fez alguma coisa ou só chegou?

### Por que o teto de 2 horas na duração

O `sessionId` vive no `sessionStorage`, então uma aba esquecida aberta continua
reportando a mesma sessão. Sem teto, uma única aba dessas levou a média para
**38.966 minutos** na primeira medição. Descartar é mais honesto do que truncar:
uma "sessão" de 9 horas não é uma visita de 2 horas, não é uma medição de visita.

---

## 3. Fuso horário

Tudo é reportado em **horário de Brasília** (`America/Sao_Paulo`), inclusive o
recorte dos dias e o heatmap.

Isso corrige um bug real: `toISOString().slice(0,10)` corta à meia-noite **UTC**,
então para um leitor em UTC−3 todo evento entre 21h e meia-noite caía no dia
*seguinte*. "Visitas hoje" ficava errada por um oitavo de cada dia. O recorte
agora usa `Intl.DateTimeFormat('en-CA', { timeZone })`.

O heatmap deriva o dia e a hora do `createdAt` do servidor, não do campo `hour`
gravado pelo cliente: o campo do cliente é a hora **local do visitante**, que
responde outra pergunta. Para decidir quando publicar, o que importa é a sua
hora.

---

## 4. Comparação de períodos

Todo número aparece contra a janela imediatamente anterior de **mesma duração** —
30 dias comparam com os 30 anteriores. A consulta busca duas janelas e a
agregação divide as duas.

A seta segue o **significado**, não o sinal: rejeição caindo é melhora e aparece
em ember; duração caindo é piora e aparece em cinza. Quem controla isso é
`higherIsBetter` no `MetricTile`.

---

## 5. Cores — por que não há paleta categórica

O Signal & Ink é monocromático quente mais um único ember. Isso **não consegue**
produzir uma paleta categórica legal: todo vizinho do ember cai na mesma faixa
vermelho-laranja e colapsa sob deuteranopia. Medido, contra um piso de ΔE 8:

| Par testado | ΔE (deuteranopia) |
| --- | --- |
| ember + `#c23005` | 11,9 — mas falha o piso de visão normal (13,7 < 15) |
| ember + `#e0a07a` | 10,3 — fora da faixa de luminosidade e abaixo do croma |
| ember + `#d9a441` | 7,4 |
| ember + `#b8863b` | 4,2 |

A paleta antiga do donut falhava em quatro checks de uma vez: quatro das seis
cores liam como cinza, duas fora da faixa, uma a 1,96:1 de contraste.

**Consequências de projeto:**

- **Identidade nunca vem de matiz.** Vem de posição, rótulo direto e legenda.
- **O donut foi removido.** Ele exigia cor categórica e é a forma errada para
  comparar valores próximos. Toda quebra virou lista de barras de série única,
  com percentual e contagem visíveis.
- **A única cor que codifica valor** é a rampa sequencial do heatmap:
  `#743b29 → #984429 → #c04b21 → #e95111`. Quatro passos, calculada em OKLCH,
  aprovada em luminosidade monótona, ΔL ≥ 0,06 entre passos e 2,10:1 da ponta
  clara contra a superfície. Quatro é o máximo que a faixa de luminosidade
  disponível comporta com gaps legais.
- **A linha de comparação é neutra**, não uma segunda cor de série — é fundo,
  não identidade, e vem com legenda.

Para revalidar depois de qualquer mudança de cor, use o validador da skill
`dataviz`:

```bash
node scripts/validate_palette.js "#743b29,#984429,#c04b21,#e95111" --ordinal --mode dark --surface "#161412"
```

---

## 6. Acessibilidade

- **Todo gráfico tem uma tabela gêmea.** O botão "Tabela" no cabeçalho de cada
  card troca o gráfico pelos números. Tooltip melhora a leitura, nunca é o único
  caminho até o valor.
- **Células do heatmap são `<button>`** com `aria-label`, então funcionam por
  teclado e leitor de tela, não só no hover.
- Texto nunca veste a cor da série; rótulos e valores usam os tokens de texto.

---

## 7. Custo e limites

A consulta é limitada por **data**, não por um `limit` solto: busca a janela
selecionada mais a anterior. Isso importa porque `onSnapshot` cobra uma leitura
por documento na carga inicial e depois só pelos novos — filtrar por data mantém
o custo proporcional ao que está sendo olhado.

O `limit` da consulta é **10.000** — e esse número não é escolha de gosto, é o
**máximo rígido do Firestore** para `limit` numa structured query. Passar dele
não degrada: a assinatura inteira falha com `invalid-argument` antes mesmo de as
regras serem avaliadas. Foi o que aconteceu na primeira versão desta página, que
pedia 12.000. **Não aumente esse número** — para cobrir mais histórico, o
caminho é pré-agregar (veja abaixo).

Ao atingir o teto, a página mostra um aviso e trata os totais como piso, em vez
de mentir em silêncio — que era exatamente o que a versão anterior fazia ao ler
"os últimos 4.000 eventos".

**Quando isso deixar de bastar** (a janela selecionada mais a anterior passando
de 10.000 eventos), o próximo passo é pré-agregar: uma Cloud Function diária escrevendo
`analytics_daily/{YYYY-MM-DD}` com os totais já somados, e o dashboard lendo os
rollups em vez dos eventos crus. Não vale a pena antes disso.

---

## 8. Quando a página mostra erro

O banner de erro traz o **código do Firestore** e a mensagem crua, de propósito:
uma mensagem de `failed-precondition` carrega a URL que cria o índice faltante
com um clique, e esconder isso esconde a correção. Cada código vem com a ação
que resolve:

| Código | O que fazer |
| --- | --- |
| `invalid-argument` | Bug de código — quase sempre `limit` acima de 10.000. |
| `failed-precondition` | Falta índice; use o link da mensagem. |
| `permission-denied` | Publique `firestore.rules` e confirme que está logado. |
| `unavailable` | Conexão; tente de novo. |
| `resource-exhausted` | Cota do projeto excedida. |

## 9. Exportar

"Exportar CSV" baixa os eventos crus da janela atual, com aspas RFC 4180 (um
referrer com vírgula não desloca colunas). Os dados nunca ficam presos nesta
interface.
