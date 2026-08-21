"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import type { DeviceRecord, StatusResponse } from "@/lib/types";

export function DevicesPanel({
  status,
  reload,
}: {
  status: StatusResponse;
  reload: () => void;
}) {
  const [label, setLabel] = useState("Meu celular");
  const [issued, setIssued] = useState<{ token: string; device: DeviceRecord } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const sampleUrl = issued
    ? origin + "/api/heartbeat?t=" + issued.token + "&event=periodic&ssid=NOME_DO_SEU_WIFI"
    : "";

  async function create() {
    setBusy(true);
    setError(null);
    try {
      setIssued(await api<{ token: string; device: DeviceRecord }>("/api/devices", {
        method: "POST",
        body: JSON.stringify({ label }),
      }));
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falhou.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(deviceId: string) {
    await api("/api/devices?deviceId=" + encodeURIComponent(deviceId), { method: "DELETE" });
    reload();
  }

  return (
    <>
      {error && <div className="banner err">{error}</div>}

      <div className="card">
        <div className="banner warn" style={{ marginBottom: 0 }}>
          O app no navegador <strong>não</strong> consegue ler o nome do wifi nem
          rodar sozinho em segundo plano. Não existe API para isso em navegador
          nenhum. Quem dispara o sinal é uma automação do sistema operacional do
          celular, configurada abaixo.
        </div>
      </div>

      <div className="card">
        <h2>Novo dispositivo</h2>
        <p className="hint">
          Cada celular ganha um token próprio. Dá para revogar o token colado na
          automação sem derrubar sua sessão aqui, e um token vazado não dá acesso
          à configuração.
        </p>
        <label className="field">
          <span>Apelido</span>
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <button className="primary block" disabled={busy} onClick={create}>
          {busy ? "Gerando..." : "Gerar token"}
        </button>

        {issued && (
          <div style={{ marginTop: 16 }}>
            <p className="hint">
              Copie agora. O token não é exibido de novo.
            </p>
            <div className="token-box mono">{issued.token}</div>
            <p className="hint" style={{ marginTop: 12 }}>
              URL pronta para colar na automação (troque o SSID pelo nome real):
            </p>
            <div className="token-box mono">{sampleUrl}</div>
            <div className="actions">
              <button onClick={() => navigator.clipboard?.writeText(sampleUrl).catch(() => {})}>
                Copiar URL
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Dispositivos cadastrados</h2>
        {status.devices.length === 0 ? (
          <p className="empty">Nenhum ainda.</p>
        ) : (
          status.devices.map((d) => (
            <div className="row" key={d.deviceId}>
              <span>
                {d.label}
                <div className="mono" style={{ color: "var(--muted)", marginTop: 2 }}>
                  {d.deviceId}
                </div>
              </span>
              <button className="small danger" onClick={() => remove(d.deviceId)}>
                revogar
              </button>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <h2>Android — MacroDroid</h2>
        <p className="hint">
          Crie <strong>três</strong> macros. As duas primeiras marcam entrada e
          saída; a terceira é a que mantém o sinal fresco, e sem ela a checagem
          das 22:00 encontra um sinal velho e não confirma nada.
        </p>
        <ol className="steps">
          <li>
            <strong>Chegou:</strong> gatilho Wi-Fi conectado à sua rede → ação
            HTTP Request GET → a URL acima com <code>event=wifi-connected</code>.
          </li>
          <li>
            <strong>Saiu:</strong> gatilho Wi-Fi desconectado → mesma URL com{" "}
            <code>event=wifi-disconnected</code>.
          </li>
          <li>
            <strong>Mantém vivo:</strong> gatilho Intervalo Regular de 15 min,
            com restrição &ldquo;conectado à rede de casa&rdquo; → mesma URL com{" "}
            <code>event=periodic</code>. Se houver a opção{" "}
            <strong>Usar alarme</strong> no gatilho, ative: sem ela o Android
            adia o disparo durante o modo Doze, que é justamente o estado do
            celular parado na mesa às 22:00.
          </li>
          <li>
            Nas três, deixe o <code>ssid</code> exatamente igual ao nome da rede
            cadastrado nos Ajustes. Diferença de maiúscula não atrapalha, espaço
            sobrando sim. Se o nome tiver espaço, na URL ele vira{" "}
            <code>%20</code> — mas nos Ajustes digite normal.
          </li>
        </ol>
        <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
          Passo a passo tela por tela, incluindo como testar cada macro e como
          impedir o Android de matar o MacroDroid: <code>docs/CELULAR.md</code>.
        </p>
      </div>

      <div className="card">
        <h2>iPhone — Atalhos</h2>
        <p className="hint">
          Funciona, com uma ressalva: o iOS às vezes atrasa o disparo alguns
          minutos e não tem gatilho periódico confiável. Por isso, no iPhone,
          aumente o campo de frescor nos Ajustes para 180 minutos.
        </p>
        <ol className="steps">
          <li>
            Atalhos → Automação → Nova → <strong>Wi-Fi</strong> → escolha sua
            rede → Executar Imediatamente, sem perguntar.
          </li>
          <li>
            Ação <strong>Obter Conteúdo de URL</strong> apontando para a URL
            acima com <code>event=wifi-connected</code>.
          </li>
          <li>
            Repita para o gatilho de saída da rede, com{" "}
            <code>event=wifi-disconnected</code>.
          </li>
        </ol>
      </div>
    </>
  );
}
