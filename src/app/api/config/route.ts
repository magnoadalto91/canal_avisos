import { NextResponse } from "next/server";
import { badRequest, requireUser } from "@/lib/auth";
import { hashSsid } from "@/lib/crypto";
import { ipHashOf } from "@/lib/ip";
import { saveUser } from "@/lib/store";
import { isValidTimezone, parseHHMM } from "@/lib/time";
import type { NotifyTarget, UserConfig } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return badRequest("JSON inválido");
  }

  const next: UserConfig = { ...auth.user };

  try {
    if (typeof body.displayName === "string") {
      const v = body.displayName.trim();
      if (v.length < 2 || v.length > 40) return badRequest("Nome entre 2 e 40 caracteres.");
      next.displayName = v;
    }

    if (typeof body.timezone === "string") {
      if (!isValidTimezone(body.timezone)) return badRequest("Fuso horário inválido.");
      next.timezone = body.timezone;
    }

    if (typeof body.windowStart === "string") {
      parseHHMM(body.windowStart);
      next.windowStart = body.windowStart.trim();
    }

    if (typeof body.windowEnd === "string") {
      parseHHMM(body.windowEnd);
      next.windowEnd = body.windowEnd.trim();
    }

    if (body.freshnessMinutes !== undefined) {
      const n = Number(body.freshnessMinutes);
      // Abaixo de 10 min a automação não consegue acompanhar; acima de 6h o
      // sinal deixa de significar "está em casa agora".
      if (!Number.isFinite(n) || n < 10 || n > 360) {
        return badRequest("Frescor deve ficar entre 10 e 360 minutos.");
      }
      next.freshnessMinutes = Math.round(n);
    }

    if (typeof body.alertOnNoSignal === "boolean") {
      next.alertOnNoSignal = body.alertOnNoSignal;
    }

    if (typeof body.enabled === "boolean") next.enabled = body.enabled;

    // O SSID chega em claro, é hasheado e o texto original é descartado.
    if (typeof body.homeSsid === "string") {
      const v = body.homeSsid.trim();
      next.homeSsidHash = v ? hashSsid(v) : undefined;
    }

    // "Estou em casa agora": aprende o IP público desta requisição.
    if (body.learnHomeIp === true) {
      const h = ipHashOf(req);
      if (!h) return badRequest("Não foi possível ler o IP desta conexão.");
      next.homeIpHash = h;
    }
    if (body.forgetHomeIp === true) next.homeIpHash = undefined;

    if (Array.isArray(body.targets)) {
      const targets: NotifyTarget[] = [];
      for (const raw of body.targets) {
        const t = raw as Partial<NotifyTarget>;
        if (t.kind !== "telegram") return badRequest("Tipo de destino não suportado.");
        const chatId = String(t.chatId ?? "").trim();
        if (!/^-?\d+$/.test(chatId) && !chatId.startsWith("@")) {
          return badRequest(`chat_id inválido: "${chatId}"`);
        }
        targets.push({ kind: "telegram", chatId, label: t.label?.slice(0, 60) });
      }
      next.targets = targets;
    }

    if (body.messages && typeof body.messages === "object") {
      const m = body.messages as Record<string, unknown>;
      for (const key of ["home", "noSignal", "manual"] as const) {
        if (typeof m[key] === "string") {
          const v = (m[key] as string).trim();
          if (!v || v.length > 500) return badRequest(`Mensagem "${key}" vazia ou longa demais.`);
          next.messages[key] = v;
        }
      }
    }
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Dados inválidos.");
  }

  // Ligar o monitoramento sem destino é a configuração que falha em silêncio
  // justamente na noite em que importa.
  if (next.enabled && next.targets.length === 0) {
    return badRequest("Adicione ao menos um destino no Telegram antes de ligar.");
  }

  await saveUser(next);
  return NextResponse.json({ config: next });
}
