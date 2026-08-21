import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createUser } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cadastro sem senha e sem e-mail: o servidor gera uma chave aleatória de 256
 * bits que vira a credencial. Ela aparece UMA vez e o app guarda no
 * localStorage. Zero custo, zero provedor de e-mail, zero dado pessoal.
 */
export async function POST(req: Request) {
  let displayName = "";
  try {
    const body = (await req.json()) as { displayName?: string };
    displayName = (body.displayName ?? "").trim();
  } catch {
    /* corpo inválido cai na validação abaixo */
  }

  if (displayName.length < 2 || displayName.length > 40) {
    return NextResponse.json(
      { error: "Informe um nome entre 2 e 40 caracteres." },
      { status: 400 },
    );
  }

  const { config, userKey } = await createUser(displayName);
  return NextResponse.json({ userKey, config });
}

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  return NextResponse.json({ config: auth.user });
}
