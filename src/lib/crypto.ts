import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Um sal fixo do servidor entra em todo hash. Sem ele, o hash de um SSID
 * ("NET_2G_CASA") ou de um IP residencial seria trivial de reverter por força
 * bruta — o espaço de busca é pequeno demais.
 */
function salt(): string {
  const s = process.env.HASH_SALT;
  if (!s || s.length < 16) {
    throw new Error(
      "HASH_SALT ausente ou curto demais (mínimo 16 caracteres). Veja docs/SETUP.md",
    );
  }
  return s;
}

export function hashValue(value: string): string {
  return createHash("sha256").update(`${salt()}:${value}`).digest("hex");
}

/** Normaliza antes de hashear: SSID com espaço/caixa diferente é o mesmo SSID. */
export function hashSsid(ssid: string): string {
  return hashValue(`ssid:${ssid.trim().toLowerCase()}`);
}

export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Comparação em tempo constante, para não vazar o segredo por timing. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
