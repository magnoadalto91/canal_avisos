import { NextResponse } from "next/server";
import { requireDevice, requireUser } from "@/lib/auth";
import { ipHashOf } from "@/lib/ip";
import { judge } from "@/lib/presence";
import { recordBeat, saveUser, touchDevice } from "@/lib/store";
import type { Heartbeat, HeartbeatEvent, HeartbeatSource } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENTS: HeartbeatEvent[] = [
  "wifi-connected",
  "wifi-disconnected",
  "periodic",
  "app-open",
];

/**
 * GET existe porque MacroDroid e Atalhos do iOS montam uma URL com muito menos
 * atrito do que um POST com corpo JSON. Mesma lógica, parâmetros na query.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  return handle(req, {
    event: url.searchParams.get("event") ?? undefined,
    ssid: url.searchParams.get("ssid") ?? undefined,
    connectionType: url.searchParams.get("connectionType") ?? undefined,
    source: url.searchParams.get("source") ?? undefined,
  });
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // Corpo vazio é aceitável: os defaults cobrem o caso comum.
  }
  return handle(req, {
    event: typeof body.event === "string" ? body.event : undefined,
    ssid: typeof body.ssid === "string" ? body.ssid : undefined,
    connectionType:
      typeof body.connectionType === "string" ? body.connectionType : undefined,
    source: typeof body.source === "string" ? body.source : undefined,
  });
}

async function handle(
  req: Request,
  input: {
    event?: string;
    ssid?: string;
    connectionType?: string;
    source?: string;
  },
) {
  // A automação usa token de dispositivo; o próprio app usa a chave da conta.
  // Aceitar os dois evita ter que gerar um token só para o PWA se anunciar.
  const asDevice = await requireDevice(req);
  let user, deviceId: string;

  if ("error" in asDevice) {
    const asUser = await requireUser(req);
    if ("error" in asUser) return asDevice.error;
    user = asUser.user;
    deviceId = "pwa";
  } else {
    user = asDevice.user;
    deviceId = asDevice.device.deviceId;
    // Registra o uso mesmo que o sinal acabe descartado: a pergunta que a aba
    // Dispositivos responde é "a automação está chegando aqui?", e ela chegou.
    await touchDevice(asDevice.device);
  }

  const event = (EVENTS as string[]).includes(input.event ?? "")
    ? (input.event as HeartbeatEvent)
    : "periodic";

  const source: HeartbeatSource =
    input.source === "pwa" ? "pwa" : "ssid-automation";

  const ipHash = ipHashOf(req);

  const verdict = judge({
    user,
    source,
    event,
    ssid: input.ssid,
    ipHash,
    connectionType: input.connectionType,
  });

  const beat: Heartbeat = {
    at: Date.now(),
    source,
    event,
    deviceId,
    network: verdict.network,
    reason: verdict.reason,
    connectionType: input.connectionType,
    ipHash: ipHash ?? undefined,
  };

  // Sinal do app que não determinou nada é pior que inútil: além de poluir o
  // histórico, ele SOBRESCREVERIA um "em casa" recente da automação por um
  // "desconhecido", e aí o cron esperaria em vez de avisar. Descartar é a
  // única opção correta — o navegador não lê SSID, então isso acontece toda
  // vez que o app é aberto.
  const informativo = !(source === "pwa" && verdict.network === "unknown");

  if (informativo) {
    // Config antiga não tem o campo; ausência significa ligado.
    await recordBeat(user.id, beat, { log: user.logBeats !== false });
  }

  // O IP de casa é dinâmico na maioria dos provedores. Toda vez que o SSID
  // confirma que estamos em casa, reaprendemos o IP — assim a checagem por IP
  // continua valendo mesmo depois que a operadora troca o endereço.
  if (verdict.relearnHomeIp && ipHash && user.homeIpHash !== ipHash) {
    await saveUser({ ...user, homeIpHash: ipHash });
  }

  return NextResponse.json({
    ok: true,
    network: verdict.network,
    reason: verdict.reason,
    registrado: informativo,
    at: beat.at,
  });
}
