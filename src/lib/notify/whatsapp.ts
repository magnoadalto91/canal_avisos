/**
 * Espaço reservado para o WhatsApp.
 *
 * Postar em CANAL do WhatsApp exige biblioteca não-oficial (Baileys, que é a
 * base da Evolution API) mantendo um WebSocket de pé com a sessão em disco —
 * ou seja, não roda em serverless na Vercel. Precisa de um host persistente
 * (Railway, Fly.io, VPS) e de um número secundário, porque a conta pode ser
 * banida por uso não-oficial.
 *
 * A API oficial da Meta (Cloud API) não posta em canal de jeito nenhum: só
 * mensagem individual, e fora da janela de 24h só com template aprovado.
 *
 * Quando quiser plugar, implemente aqui e registre em ./index.ts:
 *
 *   const res = await fetch(`${base}/message/sendText/${instance}`, {
 *     method: "POST",
 *     headers: { apikey, "content-type": "application/json" },
 *     body: JSON.stringify({ number: chatId, text }),
 *   });
 */
export async function sendMessage(_chatId: string, _text: string): Promise<void> {
  throw new Error(
    "Canal do WhatsApp ainda não implementado — precisa de host persistente. Veja src/lib/notify/whatsapp.ts",
  );
}
