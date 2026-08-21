"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { humanAge } from "@/lib/time";
import type { StatusResponse } from "@/lib/types";

const NETWORK_LABEL: Record<string, string> = {
  home: "Em casa",
  away: "Fora de casa",
  unknown: "Rede não reconhecida",
};

function headline(s: StatusResponse) {
  if (!s.config.enabled)
    return { icon: "⏸️", title: "Monitoramento desligado", sub: "Ligue na aba Ajustes quando terminar de configurar." };

  if (s.tonight) {
    const map: Record<string, { icon: string; title: string }> = {
      "home-confirmed": { icon: "🏠", title: "Chegada avisada ao grupo" },
      "no-signal-alert": { icon: "⚠️", title: "Alerta de ausência enviado" },
      "manual-checkin": { icon: "✅", title: "Check-in manual enviado" },
      silent: { icon: "🔕", title: "Janela fechou em silêncio" },
    };
    const m = map[s.tonight.outcome] ?? { icon: "•", title: s.tonight.outcome };
    return { icon: m.icon, title: m.title, sub: s.tonight.detail };
  }

  if (s.window.inside)
    return { icon: "👀", title: "Janela aberta, observando", sub: s.decision.reason };

  return { icon: "🌤️", title: "Fora da janela", sub: `A próxima começa às ${s.config.windowStart}.` };
}

export function StatusPanel({
  status,
  reload,
}: {
  status: StatusResponse;
  reload: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "info" | "err"; text: string } | null>(null);

  const beat = status.lastBeat;
  const ageMs = beat ? status.now - beat.at : null;
  const fresh = ageMs !== null && ageMs <= status.config.freshnessMinutes * 60_000;
  const h = headline(status);

  async function run(name: string, fn: () => Promise<string>) {
    setBusy(name);
    setMsg(null);
    try {
      setMsg({ kind: "info", text: await fn() });
      reload();
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Falhou." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {msg && <div className={`banner ${msg.kind}`}>{msg.text}</div>}

      <div className="card">
        <div className="status-big">
          <span className="icon">{h.icon}</span>
          <div>
            <div className="title">{h.title}</div>
            <div className="sub">{h.sub}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Último sinal do celular</h2>
        {beat ? (
          <>
            <div className="row">
              <span className="label">Onde</span>
              <span className="value">
                <span className={`pill ${beat.network === "home" ? "ok" : beat.network === "away" ? "warn" : ""}`}>
                  {NETWORK_LABEL[beat.network]}
                </span>
              </span>
            </div>
            <div className="row">
              <span className="label">Quando</span>
              <span className="value">
                {humanAge(ageMs!)}{" "}
                <span className={`pill ${fresh ? "ok" : "bad"}`}>
                  {fresh ? "fresco" : "velho demais"}
                </span>
              </span>
            </div>
            <div className="row">
              <span className="label">Como o app concluiu</span>
              <span className="value">{beat.reason}</span>
            </div>
          </>
        ) : (
          <p className="empty">
            Nenhum sinal recebido ainda. Configure a automação do celular na aba
            Dispositivos.
          </p>
        )}

        {beat && !fresh && (
          <div className="banner warn" style={{ marginTop: 14, marginBottom: 0 }}>
            Sinal antigo não confirma chegada. Um celular que descarregou dentro
            de casa deixaria um &ldquo;em casa&rdquo; congelado aqui, e o app
            mandaria tranquilidade sem ter checado nada — por isso ele não conta.
          </div>
        )}
      </div>

      <div className="card">
        <h2>Estou bem, mas não estou em casa</h2>
        <p className="hint">
          Use quando estiver na casa de alguém ou numa rede que o app não
          reconhece. Resolve a noite e avisa o grupo que está tudo certo, em vez
          de deixar o alerta de ausência disparar à toa.
        </p>
        <button
          className="block"
          disabled={busy !== null || status.config.targets.length === 0}
          onClick={() =>
            run("checkin", async () => {
              await api("/api/checkin", { method: "POST" });
              return "Check-in enviado ao grupo.";
            })
          }
        >
          {busy === "checkin" ? "Enviando..." : "Fazer check-in manual"}
        </button>
      </div>

      <div className="card">
        <h2>Janela desta noite</h2>
        <div className="row">
          <span className="label">Horário</span>
          <span className="value">
            {status.config.windowStart} → {status.config.windowEnd}
          </span>
        </div>
        <div className="row">
          <span className="label">Agora no seu fuso</span>
          <span className="value">{status.window.clock}</span>
        </div>
        <div className="row">
          <span className="label">Noite</span>
          <span className="value mono">{status.window.nightKey}</span>
        </div>
        <div className="row">
          <span className="label">Wifi de casa</span>
          <span className="value">
            <span className={`pill ${status.homeSsidRegistered ? "ok" : "bad"}`}>
              {status.homeSsidRegistered ? "cadastrado" : "faltando"}
            </span>
          </span>
        </div>
        <div className="row">
          <span className="label">IP de casa</span>
          <span className="value">
            <span className={`pill ${status.homeIpRegistered ? "ok" : ""}`}>
              {status.homeIpRegistered ? "aprendido" : "não aprendido"}
            </span>
          </span>
        </div>
      </div>
    </>
  );
}
