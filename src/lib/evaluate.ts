import { broadcast, renderMessage } from "./notify";
import { decide } from "./decide";
import { claimNight, getNight, lastBeat, saveUser } from "./store";
import { windowState } from "./time";
import type { NightRecord, Outcome, UserConfig } from "./types";

export interface EvaluationResult {
  userId: string;
  displayName: string;
  nightKey: string;
  clock: string;
  action: string;
  reason: string;
  sent: boolean;
  errors?: string[];
}

/**
 * Avalia uma noite e, se for o caso, envia. Idempotente por noite: mesmo que o
 * cron rode a cada 15 minutos, só a primeira execução que decide algo consegue
 * reservar a noite e disparar mensagem.
 */
export async function evaluateUser(
  user: UserConfig,
  now: Date = new Date(),
): Promise<EvaluationResult> {
  const ws = windowState(user.timezone, user.windowStart, user.windowEnd, now);

  const base = {
    userId: user.id,
    displayName: user.displayName,
    nightKey: ws.nightKey,
    clock: ws.clock,
    sent: false,
  };

  // Noite já resolvida: não manda de novo, nem que o cron rode mil vezes.
  const already = await getNight(user.id, ws.nightKey);
  if (already) {
    return { ...base, action: "already-resolved", reason: already.detail };
  }

  const beat = await lastBeat(user.id);
  const decision = decide({
    user,
    insideWindow: ws.inside,
    afterWindow: ws.after,
    beatNetwork: beat?.network ?? null,
    beatAgeMs: beat ? now.getTime() - beat.at : null,
    windowElapsedMs: ws.elapsed * 60_000,
  });

  if (decision.action === "wait" || decision.action === "skip") {
    return { ...base, action: decision.action, reason: decision.reason };
  }

  const outcome: Outcome =
    decision.action === "send-home"
      ? "home-confirmed"
      : decision.action === "send-no-signal"
        ? "no-signal-alert"
        : "silent";

  const record: NightRecord = {
    nightKey: ws.nightKey,
    outcome,
    at: now.getTime(),
    detail: decision.reason,
  };

  // Reserva a noite ANTES de enviar. Se duas execuções concorrentes chegarem
  // juntas, só uma passa daqui — melhor um envio perdido que dois iguais.
  const claimed = await claimNight(user.id, record);
  if (!claimed) {
    return { ...base, action: "race-lost", reason: "outra execução já resolveu" };
  }

  if (decision.action === "silent") {
    return { ...base, action: "silent", reason: decision.reason };
  }

  const template =
    decision.action === "send-home" ? user.messages.home : user.messages.noSignal;
  const text = renderMessage(template, user, now);
  const results = await broadcast(user.targets, text);
  const errors = results.filter((r) => !r.ok).map((r) => r.error!);

  return {
    ...base,
    action: decision.action,
    reason: decision.reason,
    sent: results.some((r) => r.ok),
    errors: errors.length ? errors : undefined,
  };
}

/** Estado atual para o painel, sem efeito colateral nenhum. */
export async function describeStatus(user: UserConfig, now: Date = new Date()) {
  const ws = windowState(user.timezone, user.windowStart, user.windowEnd, now);
  const beat = await lastBeat(user.id);
  const night = await getNight(user.id, ws.nightKey);
  const decision = decide({
    user,
    insideWindow: ws.inside,
    afterWindow: ws.after,
    beatNetwork: beat?.network ?? null,
    beatAgeMs: beat ? now.getTime() - beat.at : null,
    windowElapsedMs: ws.elapsed * 60_000,
  });

  return { window: ws, beat, night, decision };
}

export { saveUser };
