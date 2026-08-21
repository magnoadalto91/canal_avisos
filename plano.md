# Plano: de projeto pessoal a produto

Documento de decisão, não de execução. Registra o que muda se o Canal de Avisos
virar produto comercial, e o que precisa ser decidido antes de escrever código.

O que existe hoje (PWA + MacroDroid + Telegram) continua válido como versão
pessoal e como validação. Nada aqui invalida o que está no ar.

---

## 1. Por que o PWA acaba aqui

O limite não é o navegador parecer amador. É que **ninguém que paga vai
configurar três macros no MacroDroid**. A automação externa foi a solução certa
dada a restrição do navegador, e é inaceitável num produto.

Some-se: navegador não lê SSID, não roda em segundo plano com horário marcado, e
no iOS não roda em segundo plano de forma alguma.

**Decisão: React Native**, reaproveitando a API que já está de pé. O backend
atual serve — muda quem manda o heartbeat, não quem recebe.

---

## 2. Detecção: dois mecanismos, não um

### Geofencing (principal)

- **iOS:** `CLLocationManager` com region monitoring (`CLCircularRegion`).
  Funciona com o app encerrado, o sistema relança o app no evento. Limite de
  20 regiões por app.
- **Android:** Geofencing API do Google Play Services.

Vantagens sobre SSID: funciona sem wifi, é otimizado para bateria pelo próprio
sistema, não quebra quando a pessoa troca de roteador, e é o mesmo mecanismo que
o Life360 usa.

Desvantagens: precisa de permissão de localização "sempre", que é a permissão
mais difícil de conseguir do usuário e a mais escrutinada pelas lojas. Raio
mínimo prático de ~100m, então "chegou em casa" tem imprecisão de quarteirão.

### SSID (confirmação)

Mantido, e não por nostalgia: ele resolve exatamente onde o geofencing é fraco.

- **Precisão:** estar no wifi de casa é prova de estar *dentro* de casa, não a
  100m dela. Prédio com vários andares, geofence não distingue.
- **Privacidade:** é o mecanismo que não revela localização nenhuma. Para o
  público que recusa rastreamento, dá para oferecer **modo só-SSID**, sem
  permissão de localização contínua.
- **Bateria:** callback de rede é mais barato que região.

APIs: `NEHotspotNetwork.fetchCurrent` no iOS (exige localização autorizada),
`ConnectivityManager.NetworkCallback` + `WifiInfo` no Android.

### Como combinar

Geofence entrando na área **arma** a verificação; SSID **confirma**. Uma
confirmação vale mais que a outra, e a lógica de `judge()` que já existe no
servidor — do sinal mais forte para o mais fraco — é exatamente essa estrutura.
Ela sobrevive à migração quase intacta.

---

## 3. Infra: o que muda

O que **fica**: a regra de decisão (`decide.ts`), a janela que cruza a
meia-noite (`time.ts`), a idempotência por noite, a exigência de sinal recebido
depois da abertura da janela. Essa é a parte difícil e ela está pronta e testada.

O que **muda**:

| Hoje | Produto | Por quê |
|---|---|---|
| Upstash Redis | Postgres (Neon/Supabase) + Redis para estado quente | círculos, mensagens e relacionamentos são relacionais |
| Chave opaca no localStorage | autenticação de verdade | recuperação de conta, múltiplos aparelhos |
| Cron varrendo todos os usuários | consulta indexada por janela aberta | varrer todo mundo a cada 15 min não escala |
| cron-job.org | agendador próprio ou fila | confiabilidade vira contrato |
| Telegram | chat interno + push | ver seção 4 |

**Ponto de atenção:** chat em tempo real não roda em serverless na Vercel —
função serverless não segura WebSocket. Precisa de serviço à parte (Supabase
Realtime, Ably, Pusher) ou de um processo dedicado.

**Escala do cron:** hoje ele lê todos os usuários a cada execução. Com volume,
vira consulta por "quem tem janela aberta agora", indexada por fuso e horário.

---

## 4. Chat interno e push

Sai Telegram e WhatsApp. Motivos além do controle: o Telegram exige que cada
pessoa tenha conta e entre num grupo, e o canal do WhatsApp depende de
biblioteca não-oficial com risco de banimento.

O que o chat precisa ter, e que o grupo do Telegram dá de graça hoje:

- as pessoas conversarem **entre si** quando o aviso não chega (isso é metade do
  produto — a coordenação acontece onde o alarme toca)
- confirmação de leitura, para saber que alguém viu
- **botão de "estou indo ver"**, para não acontecer de cinco pessoas ligarem e
  nenhuma ir

Push: FCM cobrindo Android e iOS (via APNs). O alerta precisa sair como
notificação **crítica/prioritária**, senão o Android agrupa e silencia. No iOS,
notificação crítica que fura o modo Não Perturbe exige autorização especial da
Apple — vale pedir, é exatamente o caso de uso previsto.

---

## 5. "Dá para avisar sem internet?"

Resposta honesta, separando as duas direções.

### Do seu celular para o servidor: praticamente não

- **SMS para um gateway** funciona sem dados, mas: no iOS é impossível enviar SMS
  programaticamente, e no Android a permissão `SEND_SMS` é restrita pela Play
  Store a apps de mensagem padrão. Inviável como mecanismo principal.
- **Satélite** (iPhone 14+, Android 14+) não é aberto a terceiros. Só Emergency
  SOS e o Mensagens da Apple.
- **Mesh Bluetooth** (estilo Bridgefy) só funciona com outros usuários por perto.
  Densidade insuficiente mata a ideia.

### Do servidor para o seu círculo: sim, e vale construir

**SMS via Twilio/Zenvia** chega em quem está sem dados, e **chamada de voz
automatizada** chega em quem está dormindo com o celular no silencioso. Push não
faz nem uma coisa nem outra.

### O ponto que muda tudo

**O alarme deste app é a ausência de sinal, e quem o dispara é o servidor.**

Isso significa que o caso "celular sem internet, sem bateria, roubado ou no
fundo de um rio" **já está coberto por construção**. O aparelho não precisa
conseguir falar — o silêncio dele é a mensagem.

Só a confirmação de "cheguei bem" depende de conectividade. E se ela não chega,
o sistema faz exatamente o que deve: alerta.

Isso não é um detalhe de implementação, é o argumento de venda. Todo concorrente
que depende de a pessoa apertar um botão falha justamente quando o celular
morre.

---

## 6. Ideias para justificar assinatura

O problema central: **o valor é invisível**. Ninguém sente falta de um seguro que
nunca acionou. É por isso que o Life360 empacota com localização, relatório de
direção e detecção de colisão — coisas que se vê funcionando.

Então as ideias abaixo estão ordenadas por **quanto tornam o valor visível**, não
por facilidade.

### Alta prioridade

**Modo trajeto.** "Saindo do trabalho, chego em ~40 min." Se não chegar, o
círculo é avisado. Isto ataca o medo original — a rua, não a casa — e é usado
várias vezes por semana, o que resolve a invisibilidade. Casa perfeitamente com
geofencing.

**Escalonamento.** Se ninguém do círculo reagir em X minutos, sobe para SMS,
depois para chamada de voz no contato prioritário. Tem custo real por mensagem,
o que **justifica assinatura de forma natural** em vez de arbitrária.

**Localização só durante o alerta.** Normalmente ninguém vê nada. Disparado o
alerta, o círculo recebe a última localização conhecida. É o diferencial de
privacidade transformado em recurso: *não te rastreio, mas se der ruim seu
círculo sabe onde procurar.* Nenhum concorrente grande oferece isso, porque
todos partem do rastreamento contínuo.

### Média

- **Vários locais e várias rotinas** — casa, trabalho, casa da mãe; horários
  diferentes por dia da semana. Grátis: 1 local, 1 rotina.
- **Círculos maiores** — grátis até 3 pessoas.
- **Detecção de inatividade** — o celular não é tocado há X horas. Cobre queda em
  casa, e abre o mercado de quem mora sozinho e de idosos.
- **Apple Watch / widget / atalho de voz** para check-in manual.

### Baixa, mas barata

- Histórico e relatórios (fraco, mas é o que o Life360 vende)
- Integração com Home Assistant
- Mensagens personalizadas por círculo

### Sobre quem paga

Vale testar uma inversão: **quem compra costuma ser quem se preocupa**, não quem
corre risco. Mãe, companheiro, filho adulto. Um plano "família" pago por um e
usado por vários pode converter melhor que o individual — e é o modelo que o
Life360 já provou.

Faixa de referência para o Brasil: individual R$ 9,90–14,90/mês, família
R$ 24,90–29,90/mês, com o essencial gratuito para sempre. Cobrar pelo alerta
básico seria vender tranquilidade a prazo; melhor que o gratuito já salve vidas e
o pago adicione alcance.

---

## 7. Riscos e o que decidir antes de codar

**Responsabilidade.** No instante em que se cobra, "app de segurança" vira
promessa. Termos explícitos de que não é serviço de emergência, e o tom que já
está no rodapé do app atual — *uma camada a mais, nunca sua única rede de
segurança* — precisa sobreviver à área de marketing.

**Lojas.** Localização em background exige justificativa formal no Google Play e
é causa comum de rejeição na Apple. Some semanas ao cronograma e escreva a
justificativa antes de submeter, não depois.

**Life360.** A versão gratuita já faz alerta de chegada em 2 lugares. É preciso
ter resposta pronta para "por que não uso o Life360?" — e ela é privacidade e
alarme por ausência, não recursos.

**Retenção.** Se a única coisa que o app faz é ficar quieto, ele é desinstalado.
O modo trajeto existe nesta lista principalmente por isso.

### Decidir antes de começar

1. O gratuito inclui o alerta básico? (recomendo que sim)
2. Modo só-SSID sem permissão de localização vai existir como opção?
3. Chat próprio ou integração com o que a pessoa já usa? (o chat próprio custa
   caro e é o que mais atrasa o lançamento)
4. Mercado inicial: Brasil apenas, ou já pensar em internacional?

---

## 8. O que aproveitar do que já existe

Não é pouco, e é a parte que costuma dar errado:

- `decide.ts` — a regra de quando avisar, pura e testada
- `time.ts` — janela que cruza a meia-noite, a "noite" que não é o dia do
  calendário
- idempotência por noite via `SET NX` antes do envio
- a exigência de sinal recebido **depois** da abertura da janela
- a hierarquia de sinais do `judge()`
- 70 testes que documentam por que cada regra existe

Isso é o núcleo. O resto é interface e canalização.
