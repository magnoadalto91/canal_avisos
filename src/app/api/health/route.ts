import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnóstico de configuração.
 *
 * Existe porque erro de variável de ambiente em produção vira um 500 de corpo
 * vazio: o Next esconde a mensagem, e sem isto a única saída é caçar no log de
 * runtime da Vercel. Como o app pode ficar semanas sem precisar avisar nada,
 * uma configuração quebrada passaria despercebida justamente até a noite em
 * que importasse.
 *
 * Só devolve booleanos, nunca valores. Fica público de propósito, para poder
 * ser consultado quando o próprio CRON_SECRET é o que está faltando.
 */
export async function GET() {
  const env = {
    upstash: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    telegramToken: !!process.env.TELEGRAM_BOT_TOKEN,
    hashSalt: (process.env.HASH_SALT ?? "").length >= 16,
    cronSecret: !!process.env.CRON_SECRET,
  };

  let redisStatus = "não testado";
  if (env.upstash) {
    try {
      await redis().get("__health__");
      redisStatus = "ok";
    } catch {
      // Mensagem genérica: o erro do cliente pode conter a URL do banco.
      redisStatus = "falhou ao conectar";
    }
  } else {
    redisStatus = "variáveis ausentes";
  }

  const faltando = Object.entries(env)
    .filter(([, ok]) => !ok)
    .map(([k]) => k);

  const ok = faltando.length === 0 && redisStatus === "ok";

  return NextResponse.json(
    {
      ok,
      env,
      redis: redisStatus,
      faltando,
      dica: ok
        ? undefined
        : "Adicione as variáveis em Settings > Environment Variables e faça Redeploy. Variável adicionada depois do build não vale para o deploy que já existe.",
    },
    { status: ok ? 200 : 503 },
  );
}
