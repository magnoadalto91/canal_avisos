/**
 * Teste da lógica de janela e decisão, sem rede e sem banco.
 *
 *   npm run test:logic
 *
 * Roda direto no Node compilando os módulos com o próprio TypeScript
 * do projeto via --experimental-strip-types (Node 22+).
 */
import { windowState } from "../src/lib/time.ts";
import { decide } from "../src/lib/decide.ts";

let pass = 0;
let fail = 0;

function eq(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) {
    pass++;
  } else {
    fail++;
    console.log(`  FALHOU  ${label}\n          esperado ${JSON.stringify(want)}\n          obtido   ${JSON.stringify(got)}`);
  }
}

/** Constrói um instante a partir do relógio de parede em São Paulo (UTC-3). */
function spTime(dateIso, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(`${dateIso}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00-03:00`);
}

const TZ = "America/Sao_Paulo";

console.log("\njanela 22:00 -> 02:00 (cruza a meia-noite)");
{
  const w = (d, t) => windowState(TZ, "22:00", "02:00", spTime(d, t));

  eq("21:59 ainda é a noite de ontem e está fechada", (() => { const x = w("2026-08-21", "21:59"); return [x.nightKey, x.inside, x.after]; })(), ["2026-08-20", false, true]);
  eq("22:00 abre a noite de hoje", (() => { const x = w("2026-08-21", "22:00"); return [x.nightKey, x.inside, x.after]; })(), ["2026-08-21", true, false]);
  eq("23:40 segue aberta", (() => { const x = w("2026-08-21", "23:40"); return [x.nightKey, x.inside, x.after]; })(), ["2026-08-21", true, false]);
  eq("00:30 do dia seguinte AINDA é a noite de 21", (() => { const x = w("2026-08-22", "00:30"); return [x.nightKey, x.inside, x.after]; })(), ["2026-08-21", true, false]);
  eq("01:59 último minuto da janela", (() => { const x = w("2026-08-22", "01:59"); return [x.nightKey, x.inside, x.after]; })(), ["2026-08-21", true, false]);
  eq("02:00 fecha: hora do alerta", (() => { const x = w("2026-08-22", "02:00"); return [x.nightKey, x.inside, x.after]; })(), ["2026-08-21", false, true]);
  eq("09:00 continua sendo a noite de 21, fechada", (() => { const x = w("2026-08-22", "09:00"); return [x.nightKey, x.inside, x.after]; })(), ["2026-08-21", false, true]);
  eq("duração é 4h", w("2026-08-21", "22:00").durationMinutes, 240);
}

console.log("janela 22:00 -> 23:30 (mesmo dia)");
{
  const w = (d, t) => windowState(TZ, "22:00", "23:30", spTime(d, t));
  eq("22:10 dentro", (() => { const x = w("2026-08-21", "22:10"); return [x.nightKey, x.inside, x.after]; })(), ["2026-08-21", true, false]);
  eq("23:30 fecha", (() => { const x = w("2026-08-21", "23:30"); return [x.nightKey, x.inside, x.after]; })(), ["2026-08-21", false, true]);
  eq("03:00 do dia seguinte fecha a noite anterior", (() => { const x = w("2026-08-22", "03:00"); return [x.nightKey, x.inside, x.after]; })(), ["2026-08-21", false, true]);
  eq("duração é 90min", w("2026-08-21", "22:10").durationMinutes, 90);
}

console.log("decisão");
{
  const base = {
    enabled: true,
    targets: [{ kind: "telegram", chatId: "-100" }],
    freshnessMinutes: 60,
    alertOnNoSignal: true,
  };
  const d = (over, ctx) => decide({ user: { ...base, ...over }, ...ctx }).action;

  const MIN = 60_000;

  eq("em casa e fresco -> avisa", d({}, { insideWindow: true, afterWindow: false, beatNetwork: "home", beatAgeMs: 5 * MIN }), "send-home");
  eq("em casa mas velho -> espera, nao avisa", d({}, { insideWindow: true, afterWindow: false, beatNetwork: "home", beatAgeMs: 120 * MIN }), "wait");
  eq("fora de casa -> espera", d({}, { insideWindow: true, afterWindow: false, beatNetwork: "away", beatAgeMs: 2 * MIN }), "wait");
  eq("sem sinal nenhum -> espera", d({}, { insideWindow: true, afterWindow: false, beatNetwork: null, beatAgeMs: null }), "wait");
  eq("janela fechou sem sinal -> alerta", d({}, { insideWindow: false, afterWindow: true, beatNetwork: "away", beatAgeMs: 10 * MIN }), "send-no-signal");
  eq("janela fechou, alerta desligado -> silencio", d({ alertOnNoSignal: false }, { insideWindow: false, afterWindow: true, beatNetwork: null, beatAgeMs: null }), "silent");
  eq("monitoramento desligado -> pula", d({ enabled: false }, { insideWindow: true, afterWindow: false, beatNetwork: "home", beatAgeMs: 1 * MIN }), "skip");
  eq("sem destino -> pula", d({ targets: [] }, { insideWindow: true, afterWindow: false, beatNetwork: "home", beatAgeMs: 1 * MIN }), "skip");
  eq("exatamente no limite de frescor ainda vale", d({}, { insideWindow: true, afterWindow: false, beatNetwork: "home", beatAgeMs: 60 * MIN }), "send-home");
  eq("um minuto alem do limite nao vale", d({}, { insideWindow: true, afterWindow: false, beatNetwork: "home", beatAgeMs: 61 * MIN }), "wait");
}

console.log(`\n${pass} passaram, ${fail} falharam\n`);
process.exit(fail ? 1 : 0);
