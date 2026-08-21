import { Redis } from "@upstash/redis";

let client: Redis | null = null;

export function redis(): Redis {
  if (client) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN não configurados. Veja docs/SETUP.md",
    );
  }
  client = new Redis({ url, token });
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
