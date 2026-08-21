import { NextResponse } from "next/server";
import { badRequest, requireUser } from "@/lib/auth";
import { broadcast, renderMessage } from "@/lib/notify";
import type { NotifyTarget } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  let chatId: string | undefined;
  try {
    const body = (await req.json()) as { chatId?: string };
    chatId = body.chatId?.trim();
  } catch {
    /* sem corpo: testa todos os destinos salvos */
  }

  const targets: NotifyTarget[] = chatId
    ? [{ kind: "telegram", chatId }]
    : user.targets;

  if (targets.length === 0) return badRequest("Nenhum destino para testar.");

  const text = renderMessage(
    "🔔 Teste do Canal de Avisos. Se você está lendo isso, o aviso de {nome} vai chegar aqui. Enviado às {hora} de {data}.",
    user,
  );

  const results = await broadcast(targets, text);
  return NextResponse.json({
    results: results.map((r) => ({
      chatId: r.target.chatId,
      ok: r.ok,
      error: r.error,
    })),
  });
}
