// Sobrescritível para que o teste de ponta a ponta rode contra um Telegram
// falso, sem token real e sem mandar mensagem para ninguém.
const API = process.env.TELEGRAM_API_BASE ?? "https://api.telegram.org";

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN não configurado. Veja docs/SETUP.md");
  return t;
}

async function call<T>(method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}/bot${token()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  });
  const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!data.ok) {
    throw new Error(`Telegram ${method} falhou: ${data.description ?? res.status}`);
  }
  return data.result as T;
}

/**
 * Texto puro de propósito: sem parse_mode, uma mensagem personalizada com
 * "_" ou "*" faria o Telegram rejeitar o envio inteiro. Num app cujo trabalho
 * é avisar que algo deu errado, a mensagem nunca pode falhar por formatação.
 */
export async function sendMessage(chatId: string, text: string): Promise<void> {
  await call("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });
}

export interface BotInfo {
  id: number;
  username: string;
  first_name: string;
}

export function getMe(): Promise<BotInfo> {
  return call<BotInfo>("getMe");
}

export interface DiscoveredChat {
  chatId: string;
  title: string;
  type: string;
}

/**
 * Descobrir o chat_id é o passo em que todo mundo trava. Aqui o app lê as
 * atualizações recentes do bot e lista os grupos/canais que ele enxerga.
 * Atenção: getUpdates só funciona se não houver webhook configurado, e o
 * Telegram descarta atualizações com mais de 24h.
 */
export async function discoverChats(): Promise<DiscoveredChat[]> {
  const updates = await call<Array<Record<string, any>>>("getUpdates", {
    limit: 100,
    allowed_updates: ["message", "channel_post", "my_chat_member"],
  });

  const found = new Map<string, DiscoveredChat>();
  for (const u of updates) {
    const chat =
      u.message?.chat ?? u.channel_post?.chat ?? u.my_chat_member?.chat;
    if (!chat?.id) continue;
    const id = String(chat.id);
    found.set(id, {
      chatId: id,
      title: chat.title ?? chat.username ?? chat.first_name ?? "(sem título)",
      type: chat.type ?? "?",
    });
  }
  return [...found.values()];
}
