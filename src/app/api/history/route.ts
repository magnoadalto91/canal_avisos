import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { clearBeats } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Limpa a lista de sinais. Não mexe no histórico de noites: aquilo é o registro
 * do que o grupo recebeu, e apagar seria perder a única prova de que o app
 * funcionou — ou de que falhou.
 */
export async function DELETE(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  await clearBeats(auth.user.id);
  return NextResponse.json({ ok: true });
}
