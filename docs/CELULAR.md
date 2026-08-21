# Automação no celular

Esta é a peça que o PWA não consegue substituir. Navegador não lê SSID e não roda
em segundo plano — quem sabe em que wifi você está é o sistema operacional.

Pegue a URL pronta na aba **Dispositivos** do app. Ela tem esta forma:

```
https://SEU-APP.vercel.app/api/heartbeat?t=TOKEN&event=EVENTO&ssid=NOME_DA_REDE
```

Eventos aceitos: `wifi-connected`, `wifi-disconnected`, `periodic`.

O `ssid` precisa bater com o cadastrado nos Ajustes. Maiúscula e minúscula não
importam; espaço sobrando importa.

---

## Android — MacroDroid

Grátis até 5 macros, e são exatamente 3. Tasker e Automate fazem o mesmo.

### Macro 1 — Cheguei

| | |
|---|---|
| Gatilho | Conectividade → Wi-Fi conectado → sua rede |
| Ação | Aplicativos → HTTP Request → **GET** → a URL com `event=wifi-connected` |

### Macro 2 — Saí

| | |
|---|---|
| Gatilho | Conectividade → Wi-Fi desconectado → sua rede |
| Ação | mesma URL com `event=wifi-disconnected` |

### Macro 3 — Mantém vivo (a mais importante)

| | |
|---|---|
| Gatilho | Data/Hora → Intervalo Regular → **15 minutos** |
| Restrição | Conectividade → Wi-Fi conectado → sua rede |
| Ação | mesma URL com `event=periodic` |

**Sem esta terceira macro o app não funciona.** Se você chega às 19h e a checagem
roda às 22h, o único sinal existente tem 3 horas de idade — e sinal velho não
confirma chegada, porque um celular que descarregou dentro de casa deixaria um
"em casa" congelado que mandaria tranquilidade falsa. A macro periódica é o que
prova que o aparelho continua vivo e na rede.

### Se o MacroDroid parar sozinho

O Android mata apps em segundo plano de forma agressiva, e as fabricantes
brasileiras são das piores nisso (Xiaomi, Samsung, Motorola). Faça os três:

- Configurações → Bateria → MacroDroid → **Sem restrições**
- Bloqueie o MacroDroid na tela de apps recentes (cadeado)
- Xiaomi: Segurança → Autoinicialização → ative para o MacroDroid

Confira na aba **Histórico** do app se os sinais periódicos estão chegando de
verdade nos primeiros dias. É o teste que vale.

---

## iPhone — Atalhos

Funciona, com limitações reais que valem saber antes.

### Automação de chegada

1. Atalhos → aba **Automação** → **+**
2. **Wi-Fi** → escolha sua rede
3. Marque **Executar Imediatamente** e desmarque "Perguntar Antes de Executar"
4. Ação **Obter Conteúdo de URL** com a URL e `event=wifi-connected`

### Automação de saída

Mesma coisa, com o gatilho de saída da rede e `event=wifi-disconnected`.

### As limitações

- **Não há gatilho periódico confiável no iOS.** Só entrada e saída de rede. Por
  isso, no iPhone, aumente o **frescor para 180 minutos** nos Ajustes — senão o
  sinal da chegada expira antes da checagem.
- O iOS às vezes **atrasa o disparo** alguns minutos. Não é problema: a janela é
  de horas e a checagem roda a cada 15 minutos.
- Se a automação parar de disparar depois de uma atualização do iOS, abra os
  Atalhos e confirme que "Executar Imediatamente" continua marcado. O iOS já
  reverteu essa opção sozinho em algumas versões.

---

## Conferindo se funcionou

Na aba **Dispositivos**, abra a URL no navegador do próprio celular. Deve voltar:

```json
{"ok":true,"network":"home","reason":"SSID de casa confirmado pelo sistema"}
```

Se vier `"network":"away"` com `"reason":"conectado a outro wifi"`, o SSID enviado
não bate com o cadastrado. Se vier `401`, o token está errado ou foi revogado.

Depois, confira a aba **Histórico**: os sinais precisam aparecer lá a cada 15
minutos enquanto você estiver em casa.
