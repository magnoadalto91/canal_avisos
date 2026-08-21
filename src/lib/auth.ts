import { NextResponse } from "next/server";
import { safeEqual } from "./crypto";
import { getUser, resolveDevice, userIdFromKey } from "./store";
import type { DeviceRecord, UserConfig } from "./types";

/** Aceita "Authorization: Bearer x", header próprio, ou ?t= na URL. */
export function extractToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();

  const custom = req.headers.get("x-canal-key");
  if (custom) return custom.trim();

  // Fallback para automações que só conseguem montar uma URL simples.
  // Menos seguro (query string vaza em log de proxy), mas às vezes é o único
  // jeito de configurar no celular.
  const url = new URL(req.url);
  return url.searchParams.get("t");
}

export function unauthorized(msg = "credencial inválida") {
  return NextResponse.json({ error: msg }, { status: 401 });
}

export function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export async function requireUser(
  req: Request,
): Promise<{ user: UserConfig } | { error: NextResponse }> {
  const token = extractToken(req);
  if (!token) return { error: unauthorized("sem credencial") };

  const userId = await userIdFromKey(token);
  if (!userId) return { error: unauthorized() };

  const user = await getUser(userId);
  if (!user) return { error: unauthorized("usuário não encontrado") };

  return { user };
}

export async function requireDevice(
  req: Request,
): Promise<{ user: UserConfig; device: DeviceRecord } | { error: NextResponse }> {
  const token = extractToken(req);
  if (!token) return { error: unauthorized("sem token de dispositivo") };

  const device = await resolveDevice(token);
  if (!device) return { error: unauthorized("token de dispositivo inválido") };

  const user = await getUser(device.userId);
  if (!user) return { error: unauthorized("usuário não encontrado") };

  return { user, device };
}

/** O cron é público na internet — sem o segredo, qualquer um dispararia avisos. */
export function checkCronSecret(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const auth = req.headers.get("authorization");
  const provided = auth?.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : new URL(req.url).searchParams.get("s");

  return !!provided && safeEqual(provided, expected);
}
