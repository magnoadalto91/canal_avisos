import { NextResponse } from "next/server";
import { badRequest, requireUser } from "@/lib/auth";
import { createDevice, deleteDevice, listDevices } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  return NextResponse.json({ devices: await listDevices(auth.user.id) });
}

/**
 * Cada celular ganha um token próprio, separado da chave da conta. Assim dá
 * para revogar o token que foi colado no MacroDroid sem derrubar a sessão do
 * app — e um token vazado não dá acesso à configuração.
 */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  let label = "Celular";
  try {
    const body = (await req.json()) as { label?: string };
    if (body.label?.trim()) label = body.label.trim().slice(0, 40);
  } catch {
    /* usa o padrão */
  }

  const { token, record } = await createDevice(auth.user.id, label);
  return NextResponse.json({ token, device: record });
}

export async function DELETE(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const deviceId = new URL(req.url).searchParams.get("deviceId");
  if (!deviceId) return badRequest("deviceId obrigatório");

  await deleteDevice(auth.user.id, deviceId);
  return NextResponse.json({ ok: true });
}
