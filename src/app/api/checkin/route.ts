import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { broadcast, renderMessage } from "@/lib/notify";
import { claimNight } from "@/lib/store";
import { windowState } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Escape hatch para o falso alarme mais provável: você está na casa de um
 * amigo, numa rede que o app não reconhece, e sem isso o grupo receberia um
 * alerta à toa. Resolve a noite e avisa que está tudo bem.
 */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (user.targets.length === 0) {
    return NextResponse.json(
      { error: "Nenhum destino configurado." },
      { status: 400 },
    );
  }

  const now = new Date();
  const ws = windowState(user.timezone, user.windowStart, user.windowEnd, now);

  const claimed = await claimNight(user.id, {
    nightKey: ws.nightKey,
    outcome: "manual-checkin",
    at: now.getTime(),
    detail: "check-in manual pelo app",
  });

  const text = renderMessage(user.messages.manual, user, now);
  const results = await broadcast(user.targets, text);
  const errors = results.filter((r) => !r.ok).map((r) => r.error!);

  return NextResponse.json({
    ok: results.some((r) => r.ok),
    nightClaimed: claimed,
    nightKey: ws.nightKey,
    errors: errors.length ? errors : undefined,
  });
}
