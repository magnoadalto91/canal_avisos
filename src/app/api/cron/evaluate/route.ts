import { NextResponse } from "next/server";
import { checkCronSecret } from "@/lib/auth";
import { evaluateUser } from "@/lib/evaluate";
import { getUser, listUserIds } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Ponto único de disparo. Roda a cada 15 min durante a janela — não uma vez
 * às 22:00 — para que quem chegar em casa às 23:40 também seja avisado.
 */
export async function GET(req: Request) {
  if (!checkCronSecret(req)) {
    return NextResponse.json({ error: "segredo do cron inválido" }, { status: 401 });
  }

  const now = new Date();
  const ids = await listUserIds();

  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        const user = await getUser(id);
        if (!user) return { userId: id, action: "missing", reason: "sem config" };
        return await evaluateUser(user, now);
      } catch (err) {
        return {
          userId: id,
          action: "error",
          reason: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  return NextResponse.json({
    ok: true,
    at: now.toISOString(),
    evaluated: results.length,
    results,
  });
}

export const POST = GET;
