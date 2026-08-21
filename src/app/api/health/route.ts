import { NextResponse } from "next/server";
import { redis, redisEnvNames } from "@/lib/redis";

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
 * Devolve apenas NOMES de variáveis e booleanos, nunca valores. Fica público de
 * propósito, para poder ser consultado quando o próprio CRON_SECRET é o que
 * está faltando.
 */
export async function GET() {
  const found = redisEnvNames();

  const env = {
    upstash: !!(found.url && found.token),
    telegramToken: !!process.env.TELEGRAM_BOT_TOKEN,
    hashSalt: (process.env.HASH_SALT ?? "").length >= 16,
    cronSecret: !!process.env.CRON_SECRET,
  };

  let redisStatus: string;
  if (env.upstash) {
    try {
      await redis().get("__health__");
      redisStatus = "ok";
    } catch {
      // Mensagem genérica: o erro do cliente pode conter a URL do banco.
      redisStatus = "variáveis presentes, mas a conexão falhou";
    }
  } else {
    redisStatus = "variáveis ausentes";
  }

  // Quais nomes relacionados a Redis realmente existem no ambiente. Só os
  // nomes: é o que revela na hora se a integração batizou como KV_REST_API_*
  // em vez de UPSTASH_REDIS_REST_*, que é o erro de setup mais comum aqui.
  const candidatos = Object.keys(process.env)
    .filter((n) => /redis|upstash|^kv_/i.test(n))
    .sort();

  const faltando = Object.entries(env)
    .filter(([, ok]) => !ok)
    .map(([k]) => k);

  const ok = faltando.length === 0 && redisStatus === "ok";

  return NextResponse.json(
    {
      ok,
      env,
      redis: redisStatus,
      redisUsando: found,
      variaveisDeRedisNoAmbiente: candidatos,
      faltando,
      dica: ok
        ? undefined
        : "Confira 'variaveisDeRedisNoAmbiente'. Se estiver vazio, o banco não está vinculado a este ambiente. Se tiver nomes mas 'redisUsando' vier nulo, o nome não é reconhecido. Depois de qualquer mudança, faça Redeploy: variável adicionada após o build não vale para o deploy existente.",
    },
    { status: ok ? 200 : 503 },
  );
}
