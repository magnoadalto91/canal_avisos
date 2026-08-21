# Do zero ao primeiro aviso

Custo total: R$ 0,00. Tempo: uns 25 minutos.

---

## 1. Bot do Telegram

1. No Telegram, fale com **@BotFather**.
2. Mande `/newbot`, escolha um nome e um username terminado em `bot`.
3. Ele devolve um token tipo `7123456789:AAF...`. Guarde — é o `TELEGRAM_BOT_TOKEN`.

## 2. Grupo do Telegram

Crie um **grupo** (não um canal) e adicione o bot como membro comum.

Por que grupo e não canal: em canal só o admin fala. No grupo, quando a mensagem
*não* chegar, as pessoas conseguem se falar ali mesmo — "alguém falou com ele?".
Como a ausência da mensagem é parte do alarme, o lugar da coordenação precisa ser
o mesmo lugar do alarme.

**O que as pessoas do grupo precisam fazer: nada.** Só clicar no link de convite.
Não criam bot, não instalam app, não configuram nada.

> A única forma que *exigiria* ação delas seria mensagem privada do bot, porque
> bot do Telegram não consegue iniciar conversa — cada pessoa teria que mandar
> `/start`. Por isso o app usa grupo.

Depois de criar, mande qualquer mensagem no grupo. Isso faz o bot enxergar o chat,
e é o que permite o app descobrir o `chat_id` sozinho lá nos Ajustes.

## 3. Banco (Upstash Redis)

No painel da Vercel: **Storage → Marketplace → Upstash for Redis → Create**. O
plano gratuito dá 500 mil comandos por mês; este app usa uma fração disso.

Ao conectar o banco ao projeto, a Vercel injeta `UPSTASH_REDIS_REST_URL` e
`UPSTASH_REDIS_REST_TOKEN` sozinha.

## 4. Segredos

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Rode duas vezes: um valor vira `HASH_SALT`, outro vira `CRON_SECRET`.

> `HASH_SALT` entra no hash do SSID e do IP. Sem sal, o hash de um nome de rede
> seria trivial de reverter por força bruta — o espaço de busca é pequeno.
> **Trocar esse valor depois invalida o SSID e o IP já cadastrados.** Defina uma
> vez e não mexa.

## 5. Deploy

```bash
npx vercel
```

Em **Settings → Environment Variables**, adicione as quatro:
`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `TELEGRAM_BOT_TOKEN`,
`HASH_SALT`, `CRON_SECRET`.

## 6. Agendador — cron-job.org

O projeto **não usa o cron da Vercel** de propósito. No plano Hobby ele roda uma
vez por dia e dispara em qualquer minuto da hora — um `0 22 * * *` pode cair às
22:47. Para este app, isso é inútil. Por isso não existe `vercel.json` aqui.

O agendador é externo, grátis e preciso ao minuto.

**[cron-job.org](https://cron-job.org)** → Create cronjob:

| Campo | Valor |
|---|---|
| URL | `https://SEU-APP.vercel.app/api/cron/evaluate` |
| Schedule | a cada **15 minutos** |
| Timezone | `America/Sao_Paulo` |
| Header | `Authorization: Bearer SEU_CRON_SECRET` |

Rode a cada 15 minutos o dia inteiro, não só às 22:00. Três motivos:

- quem chega em casa às 23:40 também precisa ser avisado;
- o alerta de ausência precisa de uma execução *depois* do fim da janela;
- usuários diferentes têm janelas diferentes.

Não há risco de mensagem repetida: cada noite é reservada no Redis com `SET NX`
antes do envio, então só a primeira execução que decide algo dispara.

## 7. Configurar no app

Abra o site, crie a conta e **guarde a chave** (não há recuperação por e-mail).
Depois, na aba **Ajustes**:

1. **Procurar grupos do bot** → adicione o grupo que apareceu.
2. **testar** → confirme que a mensagem chegou no grupo.
3. Preencha o **SSID** exatamente como o celular reporta.
4. Ajuste a janela (padrão 22:00 → 02:00).
5. Configure a automação do celular: [CELULAR.md](CELULAR.md).
6. Veja o primeiro sinal aparecer na aba **Status**.
7. **Só então** ligue o monitoramento.

Essa ordem não é frescura: ligar antes de ver o sinal chegar é como o app falha
silenciosamente justo na primeira noite que importa.

---

## Variáveis

| Variável | Para quê |
|---|---|
| `UPSTASH_REDIS_REST_URL` | banco |
| `UPSTASH_REDIS_REST_TOKEN` | banco |
| `TELEGRAM_BOT_TOKEN` | envio |
| `HASH_SALT` | hash de SSID e IP — **não troque depois** |
| `CRON_SECRET` | protege o disparo; sem ele qualquer um avisaria seu grupo |
| `TELEGRAM_API_BASE` | opcional, só o teste e2e usa |

## Depois, se quiser WhatsApp

`src/lib/notify/whatsapp.ts` está reservado. A entrega passa toda por
`broadcast()` em `src/lib/notify/index.ts`, então plugar é adicionar um `case` —
nada da lógica de decisão precisa mudar.

Precisa de host persistente (Railway, Fly, VPS) rodando Evolution API, porque
Baileys mantém WebSocket aberto e sessão em disco. Use um número secundário: uso
não-oficial pode levar a banimento da conta.
