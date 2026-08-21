"use client";

import { useState } from "react";
import { api } from "@/lib/client";
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

const SOURCE: Record<string, { label: string; kind: string }> = {
  "ssid-automation": { label: "automação", kind: "ok" },
  manual: { label: "manual", kind: "" },
};

export function HistoryPanel({
  status,
  reload,
}: {
  status: StatusResponse;
  reload: () => void;
}) {
  const tz = status.config.timezone;

  /**
   * Esta lista existe para depurar a automação do celular, então mostra só o
   * que veio dela. O sinal do próprio app continua contando para o estado de
   * presença — aparece na aba Status — mas aqui só atrapalhava: era lido como
   * automação com defeito e mandava procurar problema onde não havia.
   */
  const sinais = status.beats.filter((b) => b.source !== "pwa");

  const [confirmando, setConfirmando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const fmt = (ms: number) =>
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: tz,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ms));

  async function limpar() {
    setBusy(true);
    setErro(null);
    try {
      await api("/api/history", { method: "DELETE" });
      setConfirmando(false);
      reload();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falhou.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {erro && <div className="banner err">{erro}</div>}

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
          Só o que a automação do celular mandou. Serve para conferir se as
          macros estão disparando de verdade.
        </p>

        {sinais.length === 0 ? (
          <p className="empty">Nenhum sinal da automação ainda.</p>
        ) : (
          <>
            <ul className="timeline">
              {sinais.map((b, i) => {
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

            <div className="actions" style={{ marginTop: 16 }}>
              {confirmando ? (
                <>
                  <button className="danger" disabled={busy} onClick={limpar}>
                    {busy ? "Limpando..." : "Confirmar: apagar tudo"}
                  </button>
                  <button className="ghost" disabled={busy} onClick={() => setConfirmando(false)}>
                    Cancelar
                  </button>
                </>
              ) : (
                <button className="ghost" onClick={() => setConfirmando(true)}>
                  Limpar sinais
                </button>
              )}
            </div>

            {confirmando && (
              <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
                Apaga também o estado de presença atual — o app volta a
                &ldquo;sem sinal&rdquo; até a próxima automação disparar. O
                histórico de noites não é afetado.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}
