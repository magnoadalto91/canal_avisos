/**
 * Upstash Redis de mentira, em memória, falando o protocolo REST de verdade.
 *
 * Existe para o teste de ponta a ponta rodar sem conta, sem rede e sem Docker,
 * exercitando o cliente @upstash/redis real em vez de um stub — assim erros de
 * serialização (que é onde este cliente costuma surpreender) aparecem no teste.
 *
 *   node scripts/fake-upstash.mjs 8079
 */
import { createServer } from "node:http";

const store = new Map(); // key -> string | string[] | Map
const port = Number(process.argv[2] ?? 8079);

function asList(key) {
  const cur = store.get(key);
  if (Array.isArray(cur)) return cur;
  const fresh = [];
  store.set(key, fresh);
  return fresh;
}

function asHash(key) {
  const cur = store.get(key);
  if (cur instanceof Map) return cur;
  const fresh = new Map();
  store.set(key, fresh);
  return fresh;
}

function asSet(key) {
  const cur = store.get(key);
  if (cur instanceof Set) return cur;
  const fresh = new Set();
  store.set(key, fresh);
  return fresh;
}

/** Índices negativos do Redis contam do fim; -1 é o último elemento. */
function range(list, start, stop) {
  const n = list.length;
  let s = Number(start);
  let e = Number(stop);
  if (s < 0) s = Math.max(n + s, 0);
  if (e < 0) e = n + e;
  return list.slice(s, e + 1);
}

function exec(cmd) {
  const op = String(cmd[0]).toUpperCase();
  const key = cmd[1];
  if (process.env.FAKE_LOG) console.log("  redis>", op, key);

  switch (op) {
    case "SET": {
      const value = cmd[2];
      const rest = cmd.slice(3).map((x) => String(x).toUpperCase());
      // NX: só grava se não existir. É o que garante uma mensagem por noite.
      if (rest.includes("NX") && store.has(key)) return null;
      store.set(key, value);
      return "OK";
    }
    case "GET":
      return store.has(key) ? store.get(key) : null;
    case "DEL": {
      let n = 0;
      for (const k of cmd.slice(1)) if (store.delete(k)) n++;
      return n;
    }
    case "EXISTS":
      return store.has(key) ? 1 : 0;
    case "SADD": {
      const set = asSet(key);
      let added = 0;
      for (const m of cmd.slice(2)) if (!set.has(m)) { set.add(m); added++; }
      return added;
    }
    case "SMEMBERS":
      return [...asSet(key)];
    case "HSET": {
      const h = asHash(key);
      const pairs = cmd.slice(2);
      let n = 0;
      for (let i = 0; i < pairs.length; i += 2) {
        if (!h.has(pairs[i])) n++;
        h.set(pairs[i], pairs[i + 1]);
      }
      return n;
    }
    case "HGETALL": {
      const out = [];
      for (const [f, v] of asHash(key)) out.push(f, v);
      return out;
    }
    case "HDEL": {
      const h = asHash(key);
      let n = 0;
      for (const f of cmd.slice(2)) if (h.delete(f)) n++;
      return n;
    }
    case "LPUSH": {
      const list = asList(key);
      for (const v of cmd.slice(2)) list.unshift(v);
      return list.length;
    }
    case "LTRIM": {
      store.set(key, range(asList(key), cmd[2], cmd[3]));
      return "OK";
    }
    case "LRANGE":
      return range(asList(key), cmd[2], cmd[3]);
    case "FLUSHALL":
      store.clear();
      return "OK";
    default:
      throw new Error("comando não implementado no fake: " + op);
  }
}

/**
 * O cliente @upstash/redis manda `Upstash-Encoding: base64` e decodifica em
 * base64 toda string que volta. Um servidor que responde texto puro faz o
 * cliente produzir lixo binário — e de forma intermitente, porque depende de
 * o conteúdo por acaso decodificar em algo válido.
 */
function encode(value) {
  if (typeof value === "string") return Buffer.from(value, "utf8").toString("base64");
  if (Array.isArray(value)) return value.map(encode);
  return value;
}

const server = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    res.setHeader("content-type", "application/json");
    try {
      const parsed = body ? JSON.parse(body) : null;
      const isPipeline = req.url.includes("pipeline") || req.url.includes("multi-exec");
      const wantsB64 = req.headers["upstash-encoding"] === "base64";
      const enc = wantsB64 ? encode : (v) => v;

      const result = isPipeline
        ? parsed.map((c) => ({ result: enc(exec(c)) }))
        : { result: enc(exec(parsed)) };

      res.end(JSON.stringify(result));
    } catch (err) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: String(err.message ?? err) }));
    }
  });
});

server.listen(port, () => console.log("fake-upstash em http://127.0.0.1:" + port));
