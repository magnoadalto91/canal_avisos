# Automação no celular

Esta é a peça que o PWA não consegue substituir. Navegador não lê SSID e não roda
em segundo plano — quem sabe em que wifi você está é o sistema operacional.

---

## Antes de abrir o MacroDroid

Três coisas em mãos. Pule isto e você vai errar em silêncio.

### 1. A URL com seu token

No app: aba **Dispositivos** → apelido → **Gerar token**. Ele mostra a URL
pronta. Copie e guarde num bloco de notas — **o token não é exibido de novo**.

Formato:

```
https://SEU-APP.vercel.app/api/heartbeat?t=TOKEN&event=EVENTO&ssid=NOME_DA_REDE
```

### 2. O nome exato da sua rede

Android → Configurações → Wi-Fi → o nome da rede conectada. Copie **exatamente**,
caractere por caractere.

Maiúscula e minúscula não importam (o app normaliza). **Espaço sobrando importa.**

### 3. Se o nome tiver caracteres especiais, codifique

O SSID vai dentro de uma URL, então alguns caracteres precisam virar código:

| No nome da rede | Na URL |
|---|---|
| espaço | `%20` |
| `#` | `%23` |
| `&` | `%26` |
| `+` | `%2B` |
| acento (`ã`, `é`) | funciona, mas evite se puder |

Exemplo: rede `NET 2G Casa` → `ssid=NET%202G%20Casa`

### 4. Cadastre o mesmo SSID no app

Aba **Ajustes** → campo **Nome do wifi de casa** → digite o nome **sem
codificação**, do jeito que aparece no Android (`NET 2G Casa`). A codificação é
só para a URL.

---

## Android — MacroDroid

São três macros. A versão gratuita permite cinco, então cabe.

> **Não achou um menu?** O seletor de gatilhos e de ações do MacroDroid tem uma
> **lupa de busca** no topo. Os nomes de categoria mudam entre versões e entre
> idiomas — buscar por "wifi", "HTTP" ou "intervalo" é mais confiável do que
> seguir um caminho decorado.

---

### Macro 1 — "Cheguei em casa"

**Tela inicial do MacroDroid → botão `+` (Adicionar Macro).**

Você vai ver três seções: **Gatilhos**, **Ações**, **Restrições**.

#### Gatilho

1. Toque no `+` da seção **Gatilhos**
2. Categoria **Conectividade** (*Connectivity*) → **Mudança de estado do Wi-Fi**
   (*Wifi State Change*)
3. Escolha **Conectado à rede** (*Connected to Network*)
4. Se aparecer a lista de redes, **marque a sua** → OK.
   Se não aparecer, tudo bem — a restrição do passo seguinte resolve.

> ### Não use "Wi-Fi dentro/fora do alcance"
>
> Existe um gatilho parecido chamado **Wi-Fi dentro/fora do alcance** (*Wifi
> In/Out Of Range*). Ele dispara quando a rede apenas **aparece na varredura**,
> sem você estar conectado — na calçada, no carro em frente ao prédio, na
> escada do vizinho.
>
> Usar esse gatilho aqui significaria mandar "chegou em casa" com você ainda na
> rua. É o erro na direção mais perigosa que este app tem: tranquilizar o grupo
> sem base nenhuma. Use **Mudança de estado do Wi-Fi**, que só dispara quando a
> conexão realmente acontece.

#### Restrição (importante)

1. Toque no `+` da seção **Restrições** (*Constraints*)
2. Busque por `wifi` → escolha a restrição de rede Wi-Fi
3. Configure para **conectado à sua rede de casa**

Por que, se o gatilho já é da sua rede: porque nem toda versão do MacroDroid
deixa escolher o SSID no gatilho. Se ele disparar em **qualquer** conexão Wi-Fi
e a URL levar o nome da sua casa fixo, o servidor receberia "estou em casa"
enquanto você conecta no Wi-Fi de um bar. A restrição fecha esse buraco de
uma vez, e não custa nada quando o gatilho já está certo.

#### Ação

1. Toque no `+` da seção **Ações**
2. Busque por `HTTP` → escolha **Requisição HTTP** (*HTTP Request*)
   - costuma ficar em **Conectividade**
3. Método: **GET**
4. No campo URL, cole a URL com `event=wifi-connected`:

```
https://SEU-APP.vercel.app/api/heartbeat?t=SEU_TOKEN&event=wifi-connected&ssid=SUA_REDE
```

5. Não preencha corpo, cabeçalho nem nada. Só a URL. OK

#### Salvar

Toque no ✓ (salvar) → dê o nome **Cheguei em casa** → OK.

---

### Macro 2 — "Saí de casa"

- **Gatilho:** Conectividade → **Mudança de estado do Wi-Fi** →
  **Desconectado da rede** (*Disconnected from Network*) → marque sua rede se
  ele deixar
- **Restrição:** **nenhuma** — leia o porquê abaixo
- **URL:** `event=wifi-disconnected`

```
https://SEU-APP.vercel.app/api/heartbeat?t=SEU_TOKEN&event=wifi-disconnected&ssid=SUA_REDE
```

Nome: **Saí de casa**.

> **Por que esta macro não leva restrição.** No instante em que ela dispara você
> acabou de sair da rede, então uma restrição de "conectado ao wifi de casa"
> seria falsa e bloquearia a própria macro.
>
> Ficar sem restrição aqui é seguro porque o erro possível vai na direção certa:
> um "saí" disparado à toa marca você como fora de casa. O pior que acontece é o
> app não mandar a mensagem de tranquilidade e o alerta de ausência disparar — 
> chato, mas te procuram. O contrário, um "cheguei" falso, calaria o alarme com
> você na rua. Por isso as macros que afirmam **presença** (1 e 3) são as que
> levam restrição.

---

### Macro 3 — "Mantém vivo" (a que ninguém pode pular)

Esta tem **gatilho, ação E restrição** — é a única com restrição.

#### Gatilho

1. `+` em **Gatilhos**
2. Categoria **Data/Hora** (*Date/Time*) → **Intervalo Regular** (*Regular Interval*)
   - se não achar, busque por `intervalo` ou `interval`
3. Defina **15 minutos**
4. **Se houver a opção "Usar alarme" / "Use alarm" / "Wake device", ATIVE.**
   Sem isso o Android adia o disparo durante o modo Doze, que é exatamente
   quando o celular está parado na mesa às 22:00 — ou seja, sempre.

#### Ação

Igual às outras, com `event=periodic`:

```
https://SEU-APP.vercel.app/api/heartbeat?t=SEU_TOKEN&event=periodic&ssid=SUA_REDE
```

#### Restrição — sem isto a macro mente

1. Toque no `+` da seção **Restrições** (*Constraints*)
2. Busque por `wifi` → escolha a restrição de rede Wi-Fi
3. Configure para **conectado à sua rede de casa**

Esta é a restrição mais importante das três macros. O gatilho é só um relógio:
ele dispara de 15 em 15 minutos **em qualquer lugar do mundo**. Como a URL leva
o nome da sua rede fixo, sem a restrição o servidor receberia "estou em casa" a
cada 15 minutos enquanto você estivesse na rua — e nunca mandaria alerta nenhum,
porque para ele você estaria sempre em casa.

Ou seja: sem esta restrição o app não fica ruim, ele fica **inútil e mentiroso**,
exatamente na noite em que você precisaria dele.

#### Salvar

Nome: **Mantém vivo**.

---

### Por que a macro 3 é obrigatória

Você chega em casa às 19h. A macro 1 dispara, o servidor registra "em casa".

Às 22:00 a checagem roda. O único sinal que existe tem **três horas de idade**.

O app não confirma sua chegada com esse sinal — e está certo em não confirmar.
Um celular que descarregou às 21h dentro de casa deixaria exatamente esse mesmo
rastro: um "em casa" congelado às 19h. Se o app aceitasse, ele mandaria
tranquilidade para o grupo sem ter checado absolutamente nada.

A macro periódica é o que prova que o aparelho continua vivo e na rede. Ela é o
sistema.

---

## Testando cada macro

Não espere a noite chegar para descobrir que não funciona.

### Teste 1 — a ação, isolada

Editando a macro, na lista de **Ações**: toque e segure na ação HTTP →
**Testar ação** (*Test Action*). Ou use o menu `⋮` → **Testar ações**.

Com o celular **na rede de casa**, o servidor deve responder:

```json
{"ok":true,"network":"home","reason":"SSID de casa confirmado pelo sistema"}
```

Para ver a resposta, ative o **Log** do MacroDroid (menu lateral → Log) e rode
de novo. Ou abra a URL direto no navegador do celular, que é mais simples.

### Teste 2 — o gatilho de verdade

Desligue o Wi-Fi, espere 10 segundos, ligue de novo. Isso deve disparar a macro
2 e depois a macro 1.

### Teste 3 — o que o servidor viu

No app, aba **Histórico** → seção **Sinais recebidos**. Os disparos têm que
aparecer ali, com o motivo. É o que prova a corrente inteira.

### Teste 4 — o mais importante: prove que ele sabe dizer "não"

Os testes acima só provam que o app avisa quando você **está** em casa. Isso é
a metade fácil. O que protege você é ele **não** avisar quando você não está.

1. Desligue o Wi-Fi e fique só nos dados móveis
2. Espere uns 20 minutos (mais que um ciclo da macro 3)
3. Abra a aba **Histórico**

O que tem que acontecer: **nenhum sinal novo com "Em casa"**. Se aparecer
qualquer coisa marcada como em casa enquanto você está na rede móvel, a
restrição da macro 3 não está funcionando — e o app inteiro perde o sentido,
porque ele nunca mais mandaria um alerta.

Vale repetir esse teste uma vez fora de casa, de verdade, antes de confiar no
sistema.

### O que cada resposta significa

| Resposta | Significado |
|---|---|
| `"network":"home"` | ✅ funcionando |
| `"network":"away"`, motivo `conectado a outro wifi` | o `ssid=` da URL não bate com o cadastrado nos Ajustes |
| `"network":"unknown"`, motivo `SSID de casa ainda não cadastrado` | falta preencher o SSID nos Ajustes do app |
| `401` | token errado, revogado, ou você copiou a URL cortada |
| nada acontece | a macro está desativada, ou o MacroDroid foi morto pelo sistema |

---

## Impedindo o Android de matar o MacroDroid

Este é o motivo número um de falha, e as fabricantes brasileiras são das piores.
Faça os três:

1. **Configurações → Bateria → MacroDroid → Sem restrições** (*Unrestricted*)
2. **Tela de apps recentes → segure o card do MacroDroid → cadeado** (fixa o app)
3. **Xiaomi/Redmi:** Segurança → Autoinicialização → ative para o MacroDroid
   **Samsung:** Configurações → Bateria → Limites de uso em segundo plano →
   Apps que nunca entram em suspensão → adicione o MacroDroid
   **Motorola:** Configurações → Bateria → Otimização → MacroDroid → Não otimizar

Depois disso, **confira a aba Histórico do app nos primeiros dias**. Se os sinais
periódicos pararem de chegar em algum momento, foi o sistema matando o
MacroDroid — não adianta supor, é olhar.

---

## iPhone — Atalhos

Funciona, com limitações reais que valem saber antes.

### Automação de chegada

1. Atalhos → aba **Automação** → **+**
2. **Wi-Fi** → escolha sua rede
3. Marque **Executar Imediatamente** e desmarque *Perguntar Antes de Executar*
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
