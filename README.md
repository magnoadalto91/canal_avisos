# Canal de Avisos

PWA que avisa um grupo do Telegram quando você chega em casa — e, principalmente,
quando você **não** chega.

A partir de um horário que você escolhe (22:00, por exemplo), o servidor observa
se o seu celular está na rede wifi de casa. Se estiver, o grupo recebe uma
mensagem de tranquilidade. Se a janela fechar sem nenhum sinal, o grupo recebe um
alerta. As pessoas do grupo não instalam nem configuram nada: entram por um link
e pronto.

---

## O que um PWA não consegue fazer, e por que este app é assim

Vale ler antes de mexer no código, porque a arquitetura inteira decorre daqui.

**1. Navegador não lê o nome da rede wifi.** Não existe Web API para SSID em
navegador nenhum — é bloqueio deliberado de privacidade, já que o SSID é
geolocalização indireta. O mais próximo é `navigator.connection.type`, que
devolve `wifi` ou `cellular` sem dizer *qual* wifi, e que nem existe no iOS.

**2. PWA não roda em segundo plano num horário marcado.** No iOS não há execução
em background nenhuma. No Android existe `periodicsync`, mas é best-effort: o
Chrome roda quando quiser, na prática de 12 em 12 horas. "Às 22:00" é impossível.

**3. Canal do WhatsApp não aceita API oficial.** A Cloud API da Meta manda
mensagem individual e template, e não posta em canal. Postar em canal exige
biblioteca não-oficial (Baileys, base da Evolution API) mantendo um WebSocket de
pé com sessão em disco, o que não roda em serverless.

Por isso o gatilho foi movido para **o sistema operacional do celular**, que sabe
o SSID, e a entrega ficou no **Telegram**, que é gratuito e funciona em
serverless.

```
Celular  ──MacroDroid / Atalhos──▶  POST /api/heartbeat
   (o SO afirma o SSID)                    │
                                           ▼
                              Vercel: PWA + API + Upstash Redis
                                           ▲
                          cron-job.org bate a cada 15 min
                                           │
                                           ▼
                                   Grupo do Telegram
```

O agendador é o **cron-job.org**, externo e gratuito. O cron da Vercel não é
usado: no plano Hobby ele roda uma vez por dia e em minuto imprevisível dentro
da hora, o que não serve para uma janela que precisa ser checada de 15 em 15
minutos. Por isso o projeto não tem `vercel.json`.

---

## As duas decisões que fazem o app funcionar

**Frescor é requisito, não detalhe.** Um heartbeat "em casa" antigo é a falha
mais perigosa possível: um celular que descarregou às 21h *dentro de casa*
deixaria um estado `home` congelado, e o app mandaria tranquilidade sem ter
checado coisa alguma. Por isso o sinal só confirma chegada se for mais recente
que `freshnessMinutes`. É isso que torna o macro periódico obrigatório.

**O silêncio ganhou um reforço.** A ideia original era que a *ausência* da
mensagem fosse o alarme. Isso é elegante, mas frágil: depende de alguém reparar
numa mensagem que não chegou, numa quinta-feira corrida. Então, por padrão, o app
manda um alerta explícito ao fim da janela. Dá para voltar ao silêncio puro
desligando `alertOnNoSignal` nos Ajustes.

Como o servidor decide onde você está, do sinal mais forte para o mais fraco:

| Ordem | Sinal | Veredito |
|---|---|---|
| 1 | evento `wifi-disconnected` | fora |
| 2 | SSID enviado bate com o cadastrado | **em casa** |
| 3 | SSID enviado é outro | fora |
| 4 | IP público bate com o de casa | **em casa** |
| 5 | `connectionType` é `cellular` | fora |
| 6 | nada disso | desconhecido |

O IP de casa é reaprendido toda vez que o SSID confirma — assim a checagem por IP
continua valendo depois que o provedor troca o endereço.

---

## Rodando

```bash
npm install
cp .env.example .env.local   # preencha as quatro variáveis
npm run dev
```

Testes, nenhum deles precisa de rede ou conta:

```bash
npm run test:logic   # janela, virada de meia-noite e regra de decisão
npm run test:e2e     # fluxo completo com Upstash e Telegram falsos
npm run icons        # regenera os PNGs do PWA
```

Configuração completa, do zero ao primeiro aviso: [docs/SETUP.md](docs/SETUP.md).
Receita da automação no celular: [docs/CELULAR.md](docs/CELULAR.md).

---

## Estrutura

```
src/lib/
  decide.ts       regra de envio — pura, sem I/O, é onde mora a decisão
  presence.ts     traduz um heartbeat em "em casa" / "fora" / "desconhecido"
  time.ts         janela e a noite que atravessa a meia-noite
  evaluate.ts     junta tudo e envia, uma vez por noite
  store.ts        Redis
  crypto.ts       hash com sal para SSID e IP
  notify/         Telegram, mais o espaço reservado do WhatsApp
src/app/api/
  heartbeat/      recebe o sinal do celular (GET e POST)
  cron/evaluate/  o único ponto que dispara mensagem automática
scripts/
  fake-upstash.mjs  Redis em memória falando o protocolo REST do Upstash
  e2e.mjs           teste de ponta a ponta
```

`decide.ts` é de propósito uma função pura: tudo que ela precisa chega por
parâmetro. A regra que decide se alguém recebe ou não um alerta é testável sem
subir nada.

---

## Limites conhecidos

- **Casa de amigo** derruba a detecção: rede desconhecida não é "em casa", então
  o alerta dispararia à toa. Use o botão de check-in manual.
- **iPhone** não tem gatilho periódico confiável, só entrada e saída de rede.
  Aumente o frescor para 180 min nesses casos.
- **Chip clonado ou celular roubado** ainda mandaria heartbeat se o aparelho
  seguisse ligado no wifi de casa. Isto não é um sistema de segurança.
- A corrente tem três elos que podem quebrar: servidor, automação e Telegram.
  Trate como uma camada a mais, nunca como sua única rede de segurança.
