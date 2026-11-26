Meu PC baixava a 191 Mbps, mas, com a rede em repouso, o roteador chegou
a levar 330 ms para responder a um ping. Depois dos ajustes, o pico caiu
para 12 ms e o download ficou perto de 198 Mbps em duas rodadas. A maior
diferença apareceu na estabilidade.

Usei um agente de IA para conduzir os testes no Windows 11. Na primeira
varredura, um sinal forte dividia o mesmo bloco de canais do meu Wi-Fi.
Parecia vir de um vizinho. Era o segundo roteador da minha própria casa.

:::takeaways
- Compare a resposta do roteador com a de um destino na internet, em repouso e sob carga.
- Se você tem dois roteadores, confira a largura dos canais dos dois. Números diferentes no painel podem ocupar o mesmo espaço.
- Mude uma coisa por vez quando possível. Repita o teste no mesmo lugar para ver se a melhora se sustenta.
:::

## Dois roteadores no mesmo bloco de 5 GHz

Comecei pelo PC. Passei a usar a rede dedicada de 5 GHz, ajustei a
preferência de banda e reduzi a agressividade de roaming, que controla
com que facilidade a placa procura outro ponto de acesso. Desativei a
economia de energia do adaptador e troquei o DNS depois de medir. A primeira
rodada mostrou um pico bem menor em repouso, mas o download oscilou e o ping
local ainda chegou a 116 ms durante o download. Como mudei várias opções do
Windows na mesma etapa, o resultado vale para o conjunto.[^windows]

O roteador principal era um **Askey RTF8115VW** no canal 161. O
**TP-Link Archer C50 v4** estava ligado a ele por cabo e usava o canal
149. Ambos operavam com 80 MHz, então ocupavam o mesmo bloco de canais,
de 149 a 161. Eu via dois números no painel, mas os dois rádios
disputavam o mesmo espaço.[^canais]

O Askey voltava para o canal automático quando eu tentava fixar outro.
Mantive o principal onde estava e movi o TP-Link para o **canal 44 com
40 MHz**, em outro bloco. As portas Ethernet do Archer são de 100 Mbps,
o que já limita o tráfego de internet que passa por ele. O reteste abaixo
mediu o PC conectado ao roteador principal.[^archer]

## Antes e depois

Mantive o PC no mesmo lugar e usei a mesma ferramenta e o mesmo servidor
da Cloudflare. Fiz os pings em repouso antes de iniciar o teste de
velocidade. Durante as transferências, medi a resposta sob carga em
uma etapa própria.[^carga]

| Medida | Antes | Após ajustes no PC | Após separar os canais |
| --- | ---: | ---: | ---: |
| Pico de ping ao roteador em repouso | 330 ms | 26 ms | **12 ms** |
| Variação entre pings ao roteador (jitter) | 41,6 ms | 2,9 ms | **0,86 ms** |
| Pacotes perdidos em 30 pings ao roteador | 1 | 1 | **0** |
| Download | 191,3 Mbps | 160,5–178,1 Mbps | **196,7–198,6 Mbps** |
| Upload | 104,7 Mbps | 100,7 Mbps | **105,7 Mbps** |

O salto de velocidade foi modesto em relação ao início. O que mais mudou
foi a regularidade das respostas do roteador. Os **zero pacotes perdidos**
são o resultado daquela amostra de 30 pings.

Na etapa final, a latência até o servidor de teste ainda ficou **47 a
81 ms acima da referência em repouso** durante o upload. Isso é compatível com
filas acumulando dados sob carga, o chamado *bufferbloat*. Um teste por
cabo seria o próximo passo para verificar quanto desse atraso persiste
sem o Wi-Fi.[^carga]

## O prompt para copiar

Escolha um modelo avançado em um agente com acesso ao terminal do **PC
conectado ao Wi-Fi**. Pode ser Google Antigravity, Codex, Claude Code ou
outro agente com esse acesso. Se estiver num chat sem terminal local,
peça os comandos e oculte os identificadores da rede antes de compartilhar
os resultados.

```text title="Prompt para diagnosticar o Wi-Fi" wrap
Ajude-me a melhorar a velocidade e a estabilidade do Wi-Fi deste PC com
Windows. Responda em português do Brasil e explique cada conclusão em
termos simples. Pergunte qual é o sintoma, quando acontece, a velocidade
contratada e quais roteadores, repetidores ou pontos de acesso eu uso.
Se houver mais de um, pergunte como estão ligados.

Se você estiver em um ambiente remoto ou sem terminal local, me passe os
comandos ou passos para executar no PC e aguarde meus resultados.

Comece só com medições. Antes de alterar qualquer configuração, mostre
o que pretende mudar, qual é o valor atual, como desfazer e aguarde meu
aval. Avise se o ajuste puder derrubar a conexão. Oculte nomes de redes,
endereços MAC e IPs públicos do relatório. Nunca consulte senhas.

Faça os testes nesta ordem, na máquina conectada ao Wi-Fi:

1. Identifique a placa, a banda, o canal, a largura, o sinal e a taxa de
   enlace. Confira os eventos recentes de desconexão. Use a lista de redes
   próximas para avaliar a sobreposição dos blocos de canais. Confirme
   quais sinais fortes vêm de equipamentos da minha própria casa.
   Marque os dados que a placa ou o driver não expõem.
2. Com a rede em repouso, confira se há downloads, sincronização ou VPN.
   Faça 30 pings ao roteador e depois 30 a um destino público que responda.
   Registre mediana, picos e perda. Se houver cabo, proponha repetir por
   Ethernet para comparar. Termine os pings em repouso antes da carga.
3. Se páginas demoram para começar a abrir, compare os tempos de consulta
   do DNS atual com alternativas, usando os mesmos domínios e separando
   consultas com e sem cache quando for possível medir isso.
4. Meça download, upload e latência em repouso e sob carga com uma
   ferramenta que mostre essas métricas. Se também medir o ping local
   durante a transferência, identifique-o como teste sob carga. Se algo
   exigir ação manual, diga o que fazer e quais resultados devolver.

Mostre uma tabela com as medições e priorize até três hipóteses, com a
evidência de cada uma e o teste que ajudaria a confirmar. Comece por
ajustes simples e reversíveis. Confirme os modelos dos roteadores e
use as opções disponíveis. Se houver canais sobrepostos, sugira bloco
e largura com base na leitura do ambiente.

Depois de cada ajuste, repita os mesmos testes com o PC no mesmo lugar,
com a mesma ferramenta, o mesmo servidor e tráfego de fundo parecido.
Compare antes e depois. Se a diferença for pequena ou variar entre
rodadas, diga que o ganho ainda não foi confirmado.
```

## Por onde eu começaria em outra casa

- **Só um PC fica instável.** Teste mais perto do roteador e experimente
  uma rede dedicada de 5 GHz onde o sinal chega bem. Em notebooks, teste
  ajustes de energia na tomada e considere o impacto na bateria.
- **Há dois roteadores ou pontos de acesso.** Compare os blocos de canais
  e as larguras antes de escolher novos valores. Em 2,4 GHz, comece
  comparando 1, 6 e 11 em 20 MHz. No Archer, voltar canal e largura para
  `Automático` desfaz o ajuste deste caso.[^canais]
- **A latência sobe quando alguém ocupa a conexão.** Repita o teste por
  cabo, se puder. Se o atraso continuar, veja se o roteador oferece SQM,
  um recurso para gerenciar as filas de tráfego.[^sqm]

:::callout{type=tip title="Um teste pelo navegador"}
O teste da Cloudflare mostra velocidade, latência em repouso e sob carga.
Espere acabar o ping em repouso antes de abrir o teste e use a mesma
ferramenta na comparação. [Cloudflare Speed Test](https://speed.cloudflare.com/)
:::

Se os Mbps ficarem parecidos e os picos diminuírem em rodadas repetidas, eu
fico com o ajuste. Foi essa a diferença mais importante no meu PC.

[^windows]: O relatório de rede sem fio do Windows reúne eventos de conexão e informações da placa. [Microsoft](https://support.microsoft.com/en-us/windows/experience/connectivity-networking/analyze-the-wireless-network-report)
[^canais]: Em 5 GHz, um bloco de 80 MHz reúne quatro canais de 20 MHz. A largura importa tanto quanto o canal primário ao verificar sobreposição. [Agrupamento de canais, Cisco Meraki](https://documentation.meraki.com/Wireless/Operate_and_Maintain/User_Guides/Radio_Settings/Channel_Bonding) · [Escolha de canal e largura, Microsoft](https://support.microsoft.com/en-us/windows/experience/connectivity-networking/wi-fi-and-your-home-layout)
[^archer]: A ficha técnica do Archer C50 v4 lista uma porta WAN e quatro portas LAN de 10/100 Mbps. [TP-Link](https://www.tp-link.com/ca/home-networking/wifi-router/archer-c50/v4/)
[^carga]: Os números do caso vieram de um script local com quatro fluxos HTTPS, usando um servidor da Cloudflare. O teste no navegador é uma alternativa para fazer a sua própria comparação. [Como a Cloudflare mede latência sob carga](https://blog.cloudflare.com/how-does-cloudflares-speed-test-really-work/)
[^sqm]: O SQM gerencia as filas quando a conexão está ocupada. [Exemplo com CoDel, Netgate](https://docs.netgate.com/pfsense/en/latest/recipes/codel-limiters.html)
