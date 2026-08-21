import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { discoverChats, getMe } from "@/lib/notify/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Descobrir o chat_id do grupo é onde todo mundo empaca. Em vez de mandar a
 * pessoa montar URL de getUpdates na mão, o app lista o que o bot enxerga.
 */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  try {
    const [bot, chats] = await Promise.all([getMe(), discoverChats()]);
    return NextResponse.json({
      bot: { username: bot.username, name: bot.first_name },
      chats,
      hint:
        chats.length === 0
          ? "Nenhum chat visível. Adicione o bot ao grupo, mande qualquer mensagem lá e recarregue. O Telegram só guarda atualizações por 24h."
          : undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
