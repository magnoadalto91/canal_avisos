import { redis, K, BEAT_LOG_MAX, NIGHT_LOG_MAX } from "./redis";
import { hashValue, newToken } from "./crypto";
import type {
  DeviceRecord,
  Heartbeat,
  NightRecord,
  UserConfig,
} from "./types";

export const DEFAULT_MESSAGES = {
  home: "🏠 {nome} chegou em casa — {hora}. Tudo certo por aqui.",
  noSignal:
    "⚠️ Nenhum sinal de que {nome} chegou em casa até {hora}. Se alguém conseguir falar com ele(a), vale a tentativa.",
  manual: "✅ {nome} fez check-in manual às {hora}: está bem, só não está em casa.",
};

export function defaultConfig(id: string, displayName: string): UserConfig {
  return {
    id,
    createdAt: Date.now(),
    displayName,
    timezone: "America/Sao_Paulo",
    windowStart: "22:00",
    windowEnd: "02:00",
    freshnessMinutes: 60,
    alertOnNoSignal: true,
    enabled: false, // só liga depois que o Telegram estiver testado
    targets: [],
    messages: { ...DEFAULT_MESSAGES },
  };
}

export async function createUser(displayName: string) {
  const r = redis();
  const id = newToken(9);
  const userKey = newToken(32);
  const config = defaultConfig(id, displayName);

  await Promise.all([
    r.set(K.user(id), JSON.stringify(config)),
    r.set(K.userByKey(hashValue(`ukey:${userKey}`)), id),
    r.sadd(K.allUsers, id),
  ]);

  return { config, userKey };
}

export async function getUser(userId: string): Promise<UserConfig | null> {
  const raw = await redis().get<string | UserConfig>(K.user(userId));
  if (!raw) return null;
  return typeof raw === "string" ? (JSON.parse(raw) as UserConfig) : raw;
}

export async function saveUser(config: UserConfig): Promise<void> {
  await redis().set(K.user(config.id), JSON.stringify(config));
}

export async function userIdFromKey(userKey: string): Promise<string | null> {
  return redis().get<string>(K.userByKey(hashValue(`ukey:${userKey}`)));
}

export async function listUserIds(): Promise<string[]> {
  return redis().smembers(K.allUsers);
}

/* ---------- dispositivos (tokens da automação) ---------- */

export async function createDevice(userId: string, label: string) {
  const r = redis();
  const token = newToken(24);
  const deviceId = newToken(6);
  const record: DeviceRecord = {
    userId,
    deviceId,
    label,
    createdAt: Date.now(),
  };
  await Promise.all([
    r.set(K.device(hashValue(`dev:${token}`)), JSON.stringify(record)),
    r.hset(K.devicesOf(userId), { [deviceId]: JSON.stringify(record) }),
  ]);
  return { token, record };
}

export async function resolveDevice(token: string): Promise<DeviceRecord | null> {
  const raw = await redis().get<string | DeviceRecord>(
    K.device(hashValue(`dev:${token}`)),
  );
  if (!raw) return null;
  return typeof raw === "string" ? (JSON.parse(raw) as DeviceRecord) : raw;
}

export async function listDevices(userId: string): Promise<DeviceRecord[]> {
  const all = await redis().hgetall<Record<string, string>>(K.devicesOf(userId));
  if (!all) return [];
  return Object.values(all).map((v) =>
    typeof v === "string" ? (JSON.parse(v) as DeviceRecord) : (v as DeviceRecord),
  );
}

export async function deleteDevice(userId: string, deviceId: string, token?: string) {
  const r = redis();
  await r.hdel(K.devicesOf(userId), deviceId);
  if (token) await r.del(K.device(hashValue(`dev:${token}`)));
}

/* ---------- heartbeats ---------- */

export async function recordBeat(userId: string, beat: Heartbeat): Promise<void> {
  const r = redis();
  const payload = JSON.stringify(beat);
  await Promise.all([
    r.set(K.lastBeat(userId), payload),
    r.lpush(K.beatLog(userId), payload),
  ]);
  await r.ltrim(K.beatLog(userId), 0, BEAT_LOG_MAX - 1);
}

export async function lastBeat(userId: string): Promise<Heartbeat | null> {
  const raw = await redis().get<string | Heartbeat>(K.lastBeat(userId));
  if (!raw) return null;
  return typeof raw === "string" ? (JSON.parse(raw) as Heartbeat) : raw;
}

export async function recentBeats(userId: string, n = 40): Promise<Heartbeat[]> {
  const rows = await redis().lrange<string>(K.beatLog(userId), 0, n - 1);
  return rows.map((v) =>
    typeof v === "string" ? (JSON.parse(v) as Heartbeat) : (v as Heartbeat),
  );
}

/* ---------- noites (idempotência do envio) ---------- */

/**
 * Marca a noite como resolvida. Usa SET NX: se duas execuções do cron
 * chegarem juntas, só uma ganha e só uma mensagem é enviada.
 */
export async function claimNight(
  userId: string,
  record: NightRecord,
): Promise<boolean> {
  const r = redis();
  const ok = await r.set(K.night(userId, record.nightKey), JSON.stringify(record), {
    nx: true,
    ex: 60 * 60 * 24 * 120,
  });
  if (ok) {
    await r.lpush(K.nightLog(userId), JSON.stringify(record));
    await r.ltrim(K.nightLog(userId), 0, NIGHT_LOG_MAX - 1);
  }
  return ok !== null;
}

export async function getNight(
  userId: string,
  nightKey: string,
): Promise<NightRecord | null> {
  const raw = await redis().get<string | NightRecord>(K.night(userId, nightKey));
  if (!raw) return null;
  return typeof raw === "string" ? (JSON.parse(raw) as NightRecord) : raw;
}

export async function recentNights(userId: string, n = 30): Promise<NightRecord[]> {
  const rows = await redis().lrange<string>(K.nightLog(userId), 0, n - 1);
  return rows.map((v) =>
    typeof v === "string" ? (JSON.parse(v) as NightRecord) : (v as NightRecord),
  );
}
