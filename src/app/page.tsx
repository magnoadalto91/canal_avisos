"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConfigPanel } from "@/components/ConfigPanel";
import { DevicesPanel } from "@/components/DevicesPanel";
import { HistoryPanel } from "@/components/HistoryPanel";
import { Onboarding } from "@/components/Onboarding";
import { StatusPanel } from "@/components/StatusPanel";
import { api, clearKey, getKey } from "@/lib/client";
import type { StatusResponse } from "@/lib/types";

type Tab = "status" | "ajustes" | "dispositivos" | "historico";

const TABS: Array<[Tab, string]> = [
  ["status", "Status"],
  ["ajustes", "Ajustes"],
  ["dispositivos", "Dispositivos"],
  ["historico", "Histórico"],
];

export default function Page() {
  // undefined = ainda lendo o localStorage; null = sem conta.
  const [key, setKeyState] = useState<string | null | undefined>(undefined);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [tab, setTab] = useState<Tab>("status");
  const [error, setError] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const jaAnunciou = useRef(false);

  const load = useCallback(async () => {
    setAtualizando(true);
    try {
      setStatus(await api<StatusResponse>("/api/status"));
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falhou.";
      // 401 significa chave inválida: melhor voltar ao início do que deixar a
      // pessoa presa numa tela de erro sem saída.
      if (msg.includes("credencial") || msg.includes("inválida")) {
        clearKey();
        setKeyState(null);
      }
      setError(msg);
    } finally {
      setAtualizando(false);
    }
  }, []);

  useEffect(() => {
    const k = getKey();
    setKeyState(k);
    if (k) void load();
  }, [load]);

  // O app se anuncia uma única vez por sessão. O servidor descarta esse sinal
  // quando ele não determina nada — que é o caso sempre que o IP de casa ainda
  // não foi aprendido, já que navegador não lê SSID.
  useEffect(() => {
    if (!key || jaAnunciou.current) return;
    jaAnunciou.current = true;
    const conn = (navigator as unknown as { connection?: { type?: string } }).connection;
    void api("/api/heartbeat", {
      method: "POST",
      body: JSON.stringify({
        source: "pwa",
        event: "app-open",
        connectionType: conn?.type,
      }),
    }).catch(() => {});
  }, [key]);

  if (key === undefined) {
    return (
      <main className="shell">
        <p className="empty">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="top">
        <div className="brand">
          <span className={"dot" + (status?.config.enabled ? "" : " off")} />
          Canal de Avisos
        </div>
        {key && (
          <span style={{ display: "flex", gap: 6 }}>
            <button
              className="small"
              disabled={atualizando}
              onClick={() => void load()}
              aria-label="Atualizar"
              title="Atualizar"
            >
              {atualizando ? "..." : "↻ atualizar"}
            </button>
            <button
              className="ghost small"
              onClick={() => {
                clearKey();
                setKeyState(null);
                setStatus(null);
              }}
            >
              sair
            </button>
          </span>
        )}
      </header>

      {!key ? (
        <Onboarding
          onReady={() => {
            setKeyState(getKey());
            void load();
          }}
        />
      ) : !status ? (
        error ? (
          <div className="banner err">{error}</div>
        ) : (
          <p className="empty">Carregando status...</p>
        )
      ) : (
        <>
          <nav className="tabs">
            {TABS.map(([id, label]) => (
              <button key={id} aria-current={tab === id} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </nav>

          {tab === "status" && <StatusPanel status={status} reload={load} />}
          {tab === "ajustes" && <ConfigPanel status={status} reload={load} />}
          {tab === "dispositivos" && <DevicesPanel status={status} reload={load} />}
          {tab === "historico" && <HistoryPanel status={status} reload={load} />}

          <footer className="note">
            O aviso depende de um servidor, de uma automação no celular e do
            Telegram. Nenhum dos três é infalível — trate isto como uma camada a
            mais, nunca como sua única rede de segurança.
          </footer>
        </>
      )}
    </main>
  );
}
