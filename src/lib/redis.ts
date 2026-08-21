import { Redis } from "@upstash/redis";

let client: Redis | null = null;

/**
 * A integração da Vercel batiza as variáveis de formas diferentes dependendo de
 * como o banco foi conectado: a nomenclatura do antigo Vercel KV é
 * KV_REST_API_*, e a do Upstash pelo Marketplace é UPSTASH_REDIS_REST_*. Quem
 * conecta não escolhe nem vê essa diferença, e o sintoma é um 500 de corpo
 * vazio. Aceitar os dois elimina a classe inteira de erro.
 */
const URL_VARS = [
  "UPSTASH_REDIS_REST_URL",
  "KV_REST_API_URL",
  "REDIS_REST_URL",
] as const;

const TOKEN_VARS = [
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_TOKEN",
  "REDIS_REST_TOKEN",
] as const;

function pick(names: readonly string[]): { name: string; value: string } | null {
  for (const name of names) {
    const value = process.env[name];
    if (value) return { name, value };
  }
  return null;
}

/** Quais variáveis foram encontradas. Só nomes — nunca valores. */
export function redisEnvNames(): { url: string | null; token: string | null } {
  return {
    url: pick(URL_VARS)?.name ?? null,
    token: pick(TOKEN_VARS)?.name ?? null,
  };
}

export function redis(): Redis {
  if (client) return client;

  const url = pick(URL_VARS);
  const token = pick(TOKEN_VARS);

  if (!url || !token) {
    throw new Error(
      "Redis não configurado. Defina " +
        URL_VARS[0] +
        " e " +
        TOKEN_VARS[0] +
        " (ou os equivalentes KV_REST_API_*). Veja /api/health e docs/SETUP.md",
    );
  }

  client = new Redis({ url: url.value, token: token.value });
  return client;
}

export const K = {
  user: (userId: string) => `u:${userId}`,
  userByKey: (keyHash: string) => `ukey:${keyHash}`,
  device: (tokenHash: string) => `dev:${tokenHash}`,
  devicesOf: (userId: string) => `devs:${userId}`,
  lastBeat: (userId: string) => `hb:${userId}`,
  beatLog: (userId: string) => `hbl:${userId}`,
  night: (userId: string, nightKey: string) => `night:${userId}:${nightKey}`,
  nightLog: (userId: string) => `nights:${userId}`,
  allUsers: "users:all",
};

export const BEAT_LOG_MAX = 200;
export const NIGHT_LOG_MAX = 90;
