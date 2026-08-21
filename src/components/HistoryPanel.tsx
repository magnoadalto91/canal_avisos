"use client";

import type { StatusResponse } from "@/lib/types";

const OUTCOME: Record<string, { icon: string; label: string }> = {
  "home-confirmed": { icon: "🏠", label: "Chegada avisada" },
  "no-signal-alert": { icon: "⚠️", label: "Alerta de ausência" },
  "manual-checkin": { icon: "✅", label: "Check-in manual" },
  silent: { icon: "🔕", label: "Silêncio" },
};

const NETWORK: Record<string, { icon: string; label: string }> = {
  home: { icon: "🏠", label: "Em casa" },
  away: { icon: "🚶", label: "Fora" },
  unknown: { icon: "❓", label: "Rede desconhecida" },
};

/**
 * Quem mandou o sinal. Sem isso, um heartbeat do próprio app parece um
 * disparo da automação que deu errado — e manda a pessoa depurar a macro
 * errada, procurando defeito onde não há.
 */
const SOURCE: Record<string, { label: string; kind: string }> = {
  "ssid-automation": { label: "automação", kind: "ok" },
  pwa: { label: "app aberto", kind: "" },
  manual: { label: "manual", kind: "" },
};

export function HistoryPanel({ status }: { status: StatusResponse }) {
  const tz = status.config.timezone;

  const fmt = (ms: number) =>
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: tz,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ms));

  return (
    <>
      <div className="card">
        <h2>Noites</h2>
        <p className="hint">O que o grupo recebeu, ou não recebeu, a cada noite.</p>
        {status.nights.length === 0 ? (
          <p className="empty">Nenhuma noite avaliada ainda.</p>
        ) : (
          <ul className="timeline">
            {status.nights.map((n) => {
              const o = OUTCOME[n.outcome] ?? { icon: "•", label: n.outcome };
              return (
                <li key={n.nightKey + n.at}>
                  <span className="when">{n.nightKey.slice(5).replace("-", "/")}</span>
                  <span className="what">
                    {o.icon} {o.label}
                    <div className="why">
                      {fmt(n.at)} · {n.detail}
                    </div>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card">
        <h2>Sinais recebidos</h2>
        <p className="hint">
          Últimos heartbeats do celular. Serve para conferir se a automação está
          disparando de verdade.
        </p>
        {status.beats.length === 0 ? (
          <p className="empty">Nenhum sinal ainda.</p>
        ) : (
          <ul className="timeline">
            {status.beats.map((b, i) => {
              const n = NETWORK[b.network] ?? { icon: "•", label: b.network };
              const s = SOURCE[b.source] ?? { label: b.source, kind: "" };
              return (
                <li key={b.at + "-" + i}>
                  <span className="when">{fmt(b.at)}</span>
                  <span className="what">
                    {n.icon} {n.label}{" "}
                    <span className={"pill " + s.kind}>{s.label}</span>
                    <div className="why">
                      {b.event} · {b.reason}
                    </div>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
