# Plano: de projeto pessoal a produto

Documento de decisão, não de execução. Registra o que muda se o Canal de Avisos
virar produto comercial, e o que precisa ser decidido antes de escrever código.

O que existe hoje (PWA + MacroDroid + Telegram) continua válido como versão
pessoal e como validação. Nada aqui invalida o que está no ar.

---

## 0. Decisões tomadas

| Questão | Decisão |
|---|---|
| Gratuito inclui o alerta básico? | **Sim.** O grátis já salva; o pago amplia alcance |
| Modo só-SSID, sem permissão de localização? | **Sim**, opção de primeira classe |
| Chat próprio? | **Não.** Telegram como canal principal, WhatsApp no plano pago |
| Mercado | Começa no Brasil, arquitetura pensada para ser mundial |

A terceira é a que mais muda o cronograma: **não construir chat elimina o item
mais caro e mais demorado do produto**. Em troca, cria dependência de terceiros e
exige que o círculo tenha Telegram — barreira real fora do Brasil, tratada na
seção 4.

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
| Telegram só | Telegram + push + WhatsApp no pago | ver seção 4 |
| — | fila de entrega com retentativa | alerta que falha em silêncio é o pior defeito possível |

**O que a decisão do chat economiza:** sem chat próprio, não é preciso serviço de
tempo real (Supabase Realtime, Ably, Pusher) nem processo dedicado segurando
WebSocket — função serverless não segura conexão persistente. Isso tira do
caminho a parte mais cara da infra.

**Fila de entrega:** com WhatsApp e SMS entrando, envio vira operação que falha.
Precisa de fila com retentativa e registro do que foi entregue. Um alerta que se
perdeu em silêncio é o pior defeito que este produto pode ter.

**Escala do cron:** hoje ele lê todos os usuários a cada execução. Com volume,
vira consulta por "quem tem janela aberta agora", indexada por fuso e horário.

---

## 4. Canais de entrega

Não haverá chat próprio. **Telegram é o canal principal no plano gratuito,
WhatsApp entra no pago**, e push para o app é a base que funciona em qualquer
lugar do mundo.

### Telegram — principal, gratuito

Mantém o que já funciona hoje: grupo, custo zero, sem limite de mensagens, e as
pessoas conversam **entre si** quando o aviso não chega. Essa conversa é metade
do produto — a coordenação precisa acontecer no mesmo lugar onde o alarme toca.

Custo real da escolha: cada pessoa do círculo precisa ter Telegram. No Brasil
isso é aceitável. Em mercados onde o Telegram é pouco usado, é barreira de
adoção séria — ver seção 7.

#### Ninguém cria bot. Isso é só da versão pessoal

Na versão pessoal cada um cria o próprio bot no BotFather, e para um produto
isso seria impeditivo — nenhum consumidor faz isso.

**No produto existe um único bot, da empresa, compartilhado por todos os
clientes.** O usuário não sabe que bot existe.

O fluxo de vínculo é um toque, usando um recurso do próprio Telegram:

1. o app abre `https://t.me/SeuAppBot?startgroup=<token-do-usuário>`
2. o Telegram pergunta em qual grupo adicionar — a pessoa escolhe um grupo que
   **já existe**, tipo "Família"
3. ao entrar, o Telegram manda `/start <token>` para o grupo
4. o webhook recebe, lê o token e vincula aquele `chat_id` à conta

Sem BotFather, sem `chat_id`, sem copiar e colar nada. A pessoa toca num botão,
escolhe o grupo e acabou.

Notas de implementação, para não descobrir tarde:

- **Webhook, não `getUpdates`.** Com um bot só e muitos clientes, polling não
  serve: `getUpdates` tem um consumidor único e descarta atualizações com mais
  de 24h. O app pessoal usa `getUpdates` porque é um usuário só.
- Tratar também o update `my_chat_member`, que dispara quando o bot é adicionado
  a um grupo. Serve de rede de segurança se o `/start` não chegar.
- Limites do Telegram: cerca de 30 mensagens por segundo no total e 20 por
  minuto por grupo. Folgado para este volume, mas precisa de fila quando escalar.
- **Um bot só é ponto único de falha.** Se ele for sinalizado, todos os clientes
  perdem o canal de uma vez. É mais um motivo para push ser a base mundial, e
  não o Telegram.

### WhatsApp — plano pago, e com uma limitação que muda o desenho

**Só a Cloud API oficial da Meta.** Nada de Baileys ou Evolution API: além de
violar os termos, seria pôr o alerta de segurança de um cliente pagante num
canal que pode ser banido a qualquer momento.

E a Cloud API tem uma restrição que precisa entrar no desenho, não no rodapé:

> **Ela não posta em grupo nem em canal.** Só mensagem individual, e fora da
> janela de 24h apenas com template aprovado pela Meta.

Consequência: **WhatsApp entrega alcance, não coordenação.** Cada pessoa recebe
sua mensagem separada e ninguém vê a resposta de ninguém. Quem quiser a conversa
acontecendo continua no Telegram.

Isso não invalida a decisão — pelo contrário, encaixa bem no modelo de
assinatura, porque:

- tem **custo por mensagem** cobrado pela Meta, então a cobrança é consequência
  de um custo real e não de um limite artificial
- resolve o caso "minha mãe não vai instalar Telegram", que é exatamente a dor
  que justifica pagar

Preparar antes: conta no Meta Business, verificação da empresa e aprovação dos
templates. São semanas, e é trabalho de empresa, não de usuário. Comece cedo.

### Push — a base mundial

Notificação para o próprio app, via FCM cobrindo Android e iOS. É o único canal
que funciona em qualquer país sem depender de o círculo usar um mensageiro
específico, e é grátis.

O alerta precisa sair como notificação **prioritária**, senão o Android agrupa e
silencia. No iOS, notificação crítica que fura o Não Perturbe exige autorização
especial da Apple — vale pedir, este é literalmente o caso de uso previsto.

### A coordenação sem construir um chat

O que importa quando o alerta dispara não é conversar, é **saber que alguém
assumiu**. Sem isso, ou cinco pessoas ligam ao mesmo tempo, ou nenhuma vai.

Isso se resolve com uma tela e um botão, não com um produto de mensageria:

- o alerta abre uma tela com quem foi avisado
- botão **"estou indo ver"**
- quem apertou aparece para todos, e os outros param de se preocupar

É barato, entrega a metade do produto que interessa, e mantém a porta aberta
para um chat de verdade depois, se os dados mostrarem que falta.

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

### O corte entre grátis e pago

Decidido: **o alerta básico é gratuito para sempre**. Cobrar por ele seria vender
tranquilidade a prazo, e um app de segurança que só protege quem paga tem um
problema ético antes de ter um problema comercial.

| Grátis | Pago |
|---|---|
| alerta de ausência completo | **WhatsApp** (custo por mensagem da Meta) |
| Telegram, sem limite de mensagens | escalonamento por SMS e chamada de voz |
| push para o app | modo trajeto |
| 1 local, 1 rotina, círculo até 3 pessoas | vários locais e rotinas, círculo maior |
| modo só-SSID | localização durante o alerta |

O princípio: **o gratuito salva, o pago amplia alcance e cobre mais situações.**
Repare que quase tudo na coluna paga tem custo marginal real (WhatsApp, SMS,
voz) — a cobrança é consequência de um custo, não de um limite inventado.

### Por que isso ainda não basta

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

## 7. Ser mundial: o que muda

Começar pelo Brasil e mirar o mundo tem uma consequência principal, e ela bate
justamente na decisão do canal.

### O canal não é o mesmo em todo lugar

| Região | Canal que funciona |
|---|---|
| Brasil, Índia, Irã, leste europeu | Telegram e WhatsApp |
| América Latina, Europa, Índia | WhatsApp domina |
| EUA e Canadá | SMS e iMessage; Telegram é nicho |
| Alemanha, norte da Europa | WhatsApp e Signal |

**Telegram como canal principal é uma decisão brasileira, e está certa para o
lançamento.** Mas nos EUA ela quebra: pedir que a mãe de alguém instale Telegram
para receber um alerta é conversão perdida.

Por isso o **push para o app é a base mundial**, e o canal externo vira
preferência por região. A boa notícia é que a arquitetura já está pronta para
isso: a interface `Notifier` e o `broadcast()` que existem hoje foram feitos
justamente para trocar o entregador sem tocar na regra de decisão.

Ordem sugerida: Telegram e push no lançamento, WhatsApp junto com o plano pago,
SMS quando os EUA entrarem no mapa.

### O resto

**Fuso horário** já está resolvido — o app usa IANA e a janela que cruza a
meia-noite funciona em qualquer fuso. Foi de graça.

**Idioma** não está. Mensagens, textos do app e os templates do WhatsApp
precisam de i18n desde cedo; template da Meta é aprovado **por idioma**, então
cada novo idioma é um novo ciclo de aprovação.

**Preço** precisa ser regional. R$ 14,90 no Brasil não vira US$ 14,90 nos EUA
nem em conversão nem em percepção. E o custo de SMS e WhatsApp varia muito por
país, o que pode inverter a margem de um plano.

**LGPD e GDPR.** Localização e rede de contatos são dados sensíveis, e o GDPR é
a régua mais alta. Vale desenhar para ele desde o começo: retenção curta, dado
mínimo, exclusão de conta funcionando de verdade. Aqui o projeto já começa bem —
guardar apenas hash de SSID e de IP, nunca o valor, é exatamente o tipo de
decisão que o GDPR premia.

---

## 8. Riscos

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

---

## 9. O que aproveitar do que já existe

Não é pouco, e é a parte que costuma dar errado:

- `decide.ts` — a regra de quando avisar, pura e testada
- `time.ts` — janela que cruza a meia-noite, a "noite" que não é o dia do
  calendário
- idempotência por noite via `SET NX` antes do envio
- a exigência de sinal recebido **depois** da abertura da janela
- a hierarquia de sinais do `judge()`
- 70 testes que documentam por que cada regra existe

Isso é o núcleo. O resto é interface e canalização.
