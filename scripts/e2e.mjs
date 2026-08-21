/**
 * Teste de ponta a ponta do fluxo real: cria conta, configura destino,
 * cadastra dispositivo, manda heartbeat, roda o cron e confere o que chegou
 * no Telegram — tudo contra um Upstash e um Telegram falsos, em memória.
 *
 *   npm run test:e2e
 *
 * Sobe o próprio `next dev`, então demora uns 30s.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";

const REDIS_PORT = 8079;
const TG_PORT = 8080;
const APP_PORT = 3010;
const BASE = "http://127.0.0.1:" + APP_PORT;
const CRON_SECRET = "segredo-de-teste-1234567890";

let pass = 0;
let fail = 0;
const sent = []; // mensagens que o "Telegram" recebeu

function check(label, ok, extra = "") {
  if (ok) {
    pass++;
    console.log("  ok    " + label);
  } else {
    fail++;
    console.log("  FALHA " + label + (extra ? "\n        " + extra : ""));
  }
}

/* ---------------- Telegram falso ---------------- */

const telegram = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    res.setHeader("content-type", "application/json");
    if (req.url.endsWith("/sendMessage")) {
      const payload = JSON.parse(body || "{}");
      sent.push(payload);
      res.end(JSON.stringify({ ok: true, result: { message_id: sent.length } }));
    } else if (req.url.endsWith("/getMe")) {
      res.end(JSON.stringify({ ok: true, result: { id: 1, username: "fakebot", first_name: "Fake" } }));
    } else {
      res.end(JSON.stringify({ ok: true, result: [] }));
    }
  });
});

/* ---------------- utilidades ---------------- */

async function req(path, { method = "GET", key, body, cron } = {}) {
  const headers = { "content-type": "application/json" };
  if (key) headers["x-canal-key"] = key;
  if (cron) headers["authorization"] = "Bearer " + CRON_SECRET;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : {} };
}

/** Relógio em UTC, para a janela do teste não depender de fuso nem horário de verão. */
function utcHHMM(offsetMinutes) {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
}

async function waitForApp() {
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(BASE + "/api/status");
      if (r.status === 401) return true;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/* ---------------- cenários ---------------- */

async function run() {
  console.log("\n1. conta e configuração");

  const created = await req("/api/user", {
    method: "POST",
    body: { displayName: "Magno" },
  });
  check("cria conta", created.status === 200 && !!created.data.userKey, JSON.stringify(created.data));
  const key = created.data.userKey;

  check(
    "monitoramento nasce desligado",
    created.data.config.enabled === false,
  );

  const semDestino = await req("/api/config", {
    method: "PATCH",
    key,
    body: { enabled: true },
  });
  check("recusa ligar sem destino", semDestino.status === 400, JSON.stringify(semDestino.data));

  const cfg = await req("/api/config", {
    method: "PATCH",
    key,
    body: {
      timezone: "UTC",
      windowStart: utcHHMM(-30), // janela já aberta
      windowEnd: utcHHMM(+120), // e ainda longe de fechar
      homeSsid: "CASA_5G",
      targets: [{ kind: "telegram", chatId: "-1001", label: "Família" }],
      enabled: true,
    },
  });
  check("salva configuração", cfg.status === 200, JSON.stringify(cfg.data));

  console.log("\n2. dispositivo e heartbeat");

  const dev = await req("/api/devices", { method: "POST", key, body: { label: "Pixel" } });
  check("gera token de dispositivo", dev.status === 200 && !!dev.data.token);
  const token = dev.data.token;

  const errado = await req(
    "/api/heartbeat?t=" + token + "&event=wifi-connected&ssid=WIFI_DO_VIZINHO",
  );
  check(
    "SSID diferente marca fora de casa",
    errado.data.network === "away",
    JSON.stringify(errado.data),
  );

  const certo = await req("/api/heartbeat?t=" + token + "&event=wifi-connected&ssid=CASA_5G");
  check("SSID de casa marca em casa", certo.data.network === "home", JSON.stringify(certo.data));

  const caixaAlta = await req("/api/heartbeat?t=" + token + "&event=periodic&ssid=casa_5g");
  check("SSID é insensível a maiúsculas", caixaAlta.data.network === "home");

  const semToken = await req("/api/heartbeat?t=invalido&event=periodic&ssid=CASA_5G");
  check("token inválido é rejeitado", semToken.status === 401);

  console.log("\n3. cron e envio");

  const antes = sent.length;
  const cron1 = await req("/api/cron/evaluate", { cron: true });
  const r1 = cron1.data.results?.[0];
  check("cron avisa a chegada", r1?.action === "send-home", JSON.stringify(r1));
  check("mensagem chegou no Telegram", sent.length === antes + 1);
  check(
    "mensagem tem nome e hora",
    sent[sent.length - 1]?.text?.includes("Magno") && /\d{2}:\d{2}/.test(sent[sent.length - 1]?.text ?? ""),
    sent[sent.length - 1]?.text,
  );
  check("foi para o chat certo", sent[sent.length - 1]?.chat_id === "-1001");

  const depois = sent.length;
  const cron2 = await req("/api/cron/evaluate", { cron: true });
  check(
    "segunda execução não repete",
    cron2.data.results?.[0]?.action === "already-resolved",
    JSON.stringify(cron2.data.results?.[0]),
  );
  check("nenhuma mensagem duplicada", sent.length === depois);

  console.log("\n4. sinal velho não confirma chegada");

  const u2 = await req("/api/user", { method: "POST", body: { displayName: "Ana" } });
  const key2 = u2.data.userKey;
  await req("/api/config", {
    method: "PATCH",
    key: key2,
    body: {
      timezone: "UTC",
      windowStart: utcHHMM(-30),
      windowEnd: utcHHMM(+120),
      homeSsid: "CASA_ANA",
      freshnessMinutes: 10,
      targets: [{ kind: "telegram", chatId: "-1002" }],
      enabled: true,
    },
  });
  const semSinal = await req("/api/cron/evaluate", { cron: true });
  const rAna = semSinal.data.results.find((r) => r.displayName === "Ana");
  check(
    "sem nenhum heartbeat, espera em vez de avisar",
    rAna?.action === "wait",
    JSON.stringify(rAna),
  );

  console.log("\n5. janela fechada dispara o alerta de ausência");

  const u3 = await req("/api/user", { method: "POST", body: { displayName: "Bruno" } });
  const key3 = u3.data.userKey;
  await req("/api/config", {
    method: "PATCH",
    key: key3,
    body: {
      timezone: "UTC",
      windowStart: utcHHMM(-180), // abriu há 3h
      windowEnd: utcHHMM(-60), // e fechou há 1h
      targets: [{ kind: "telegram", chatId: "-1003" }],
      alertOnNoSignal: true,
      enabled: true,
    },
  });

  const antesAlerta = sent.length;
  const cron3 = await req("/api/cron/evaluate", { cron: true });
  const rBruno = cron3.data.results.find((r) => r.displayName === "Bruno");
  check("janela fechada dispara alerta", rBruno?.action === "send-no-signal", JSON.stringify(rBruno));
  check("alerta chegou", sent.length === antesAlerta + 1);
  check(
    "alerta foi para o chat do Bruno",
    sent[sent.length - 1]?.chat_id === "-1003",
    sent[sent.length - 1]?.text,
  );

  console.log("\n6. check-in manual");

  const u4 = await req("/api/user", { method: "POST", body: { displayName: "Carla" } });
  const key4 = u4.data.userKey;
  await req("/api/config", {
    method: "PATCH",
    key: key4,
    body: {
      timezone: "UTC",
      windowStart: utcHHMM(-30),
      windowEnd: utcHHMM(+120),
      targets: [{ kind: "telegram", chatId: "-1004" }],
      enabled: true,
    },
  });

  const antesCheckin = sent.length;
  const ci = await req("/api/checkin", { method: "POST", key: key4 });
  check("check-in envia", ci.status === 200 && sent.length === antesCheckin + 1, JSON.stringify(ci.data));

  const cron4 = await req("/api/cron/evaluate", { cron: true });
  const rCarla = cron4.data.results.find((r) => r.displayName === "Carla");
  check(
    "check-in resolve a noite e o cron não avisa de novo",
    rCarla?.action === "already-resolved",
    JSON.stringify(rCarla),
  );

  console.log("\n7. isolamento entre contas");
  const vazamento = await req("/api/status", { key: key2 });
  check(
    "cada conta enxerga só a si mesma",
    vazamento.data.config?.displayName === "Ana",
    vazamento.data.config?.displayName,
  );
}

/* ---------------- orquestração ---------------- */

const redis = spawn(process.execPath, ["scripts/fake-upstash.mjs", String(REDIS_PORT)], {
  stdio: process.env.FAKE_LOG ? "inherit" : "ignore",
});
telegram.listen(TG_PORT);

const app = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "dev", "-p", String(APP_PORT)],
  {
    stdio: process.env.E2E_DEBUG ? "inherit" : "ignore",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      UPSTASH_REDIS_REST_URL: "http://127.0.0.1:" + REDIS_PORT,
      UPSTASH_REDIS_REST_TOKEN: "fake",
      TELEGRAM_BOT_TOKEN: "123:fake",
      TELEGRAM_API_BASE: "http://127.0.0.1:" + TG_PORT,
      HASH_SALT: "sal-de-teste-com-tamanho-suficiente",
      CRON_SECRET,
    },
  },
);

function cleanup() {
  app.kill();
  redis.kill();
  telegram.close();
}

console.log("subindo app de teste...");
const up = await waitForApp();
if (!up) {
  console.log("app não subiu a tempo");
  cleanup();
  process.exit(1);
}

try {
  await run();
} catch (err) {
  fail++;
  console.log("\nerro inesperado: " + (err?.stack ?? err));
}

console.log("\n" + pass + " passaram, " + fail + " falharam\n");
cleanup();
process.exit(fail ? 1 : 0);
