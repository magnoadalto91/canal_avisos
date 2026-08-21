import { hashValue } from "./crypto";

/**
 * O IP público é o sinal que funciona em qualquer plataforma, inclusive iOS,
 * sem API nenhuma do navegador: em casa o IP é o do seu roteador, na rede
 * móvel é o da operadora. Guardamos só o hash.
 */
export function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    // A Vercel põe o IP real do cliente na primeira posição.
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || null;
}

/**
 * IPv6 residencial troca os 64 bits finais o tempo todo (privacy extensions),
 * então comparar o endereço inteiro daria falso negativo toda hora. O prefixo
 * /64 é o que identifica a rede.
 */
export function normalizeIp(ip: string): string {
  const clean = ip.replace(/^\[|\]$/g, "").split("%")[0];

  if (!clean.includes(":")) return clean; // IPv4: usa inteiro

  // IPv4 mapeado em IPv6 (::ffff:1.2.3.4)
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(clean);
  if (mapped) return mapped[1];

  return expandIpv6Prefix64(clean);
}

function expandIpv6Prefix64(addr: string): string {
  const [head, tail] = addr.split("::");
  const headParts = head ? head.split(":").filter(Boolean) : [];
  const tailParts = tail ? tail.split(":").filter(Boolean) : [];
  const missing = 8 - headParts.length - tailParts.length;
  const full =
    addr.includes("::")
      ? [...headParts, ...Array(Math.max(missing, 0)).fill("0"), ...tailParts]
      : addr.split(":");

  return full
    .slice(0, 4)
    .map((g) => g.padStart(4, "0").toLowerCase())
    .join(":");
}

export function ipHashOf(req: Request): string | null {
  const ip = clientIp(req);
  if (!ip) return null;
  return hashValue(`ip:${normalizeIp(ip)}`);
}
