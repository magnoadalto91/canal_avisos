"use client";

import { useState } from "react";
import { api, setKey } from "@/lib/client";
import type { UserConfig } from "@/lib/types";

export function Onboarding({ onReady }: { onReady: () => void }) {
  const [mode, setMode] = useState<"new" | "restore">("new");
  const [name, setName] = useState("");
  const [pasted, setPasted] = useState("");
  const [issued, setIssued] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ userKey: string; config: UserConfig }>("/api/user", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ displayName: name }),
      });
      setKey(res.userKey);
      setIssued(res.userKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falhou.");
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    setBusy(true);
    setError(null);
    try {
      setKey(pasted.trim());
      await api<{ config: UserConfig }>("/api/user");
      onReady();
    } catch {
      setError("Chave não reconhecida.");
    } finally {
      setBusy(false);
    }
  }

  if (issued) {
    return (
      <div className="card">
        <h2>Guarde esta chave agora</h2>
        <p className="hint">
          Ela é sua senha e seu login ao mesmo tempo. Não existe recuperação por
          e-mail — se você limpar os dados do navegador sem ter copiado isto,
          perde a configuração e começa de novo.
        </p>
        <div className="token-box mono">{issued}</div>
        <div className="actions">
          <button
            className="primary"
            onClick={() => navigator.clipboard?.writeText(issued).catch(() => {})}
          >
            Copiar chave
          </button>
          <button onClick={onReady}>Já guardei, continuar</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <h2>Como isto funciona</h2>
        <ol className="steps">
          <li>
            Você diz a partir de que horas quer ser monitorado — 22:00, por
            exemplo — e qual é o wifi da sua casa.
          </li>
          <li>
            Uma automação no seu celular avisa este app sempre que você conecta
            no wifi de casa. É o sistema operacional que faz isso: navegador
            nenhum consegue ler o nome da rede.
          </li>
          <li>
            Chegou em casa dentro da janela, o grupo recebe{" "}
            <em>&ldquo;chegou em casa&rdquo;</em>. Passou do horário-limite sem
            sinal nenhum, o grupo recebe um alerta.
          </li>
          <li>
            As pessoas do grupo só precisam entrar por um link do Telegram. Elas
            não instalam nem configuram nada.
          </li>
        </ol>
      </div>

      <div className="card">
        <nav className="tabs">
          <button aria-current={mode === "new"} onClick={() => setMode("new")}>
            Criar conta
          </button>
          <button aria-current={mode === "restore"} onClick={() => setMode("restore")}>
            Tenho uma chave
          </button>
        </nav>

        {error && <div className="banner err">{error}</div>}

        {mode === "new" ? (
          <>
            <label className="field">
              <span>Seu nome (é o que vai aparecer nas mensagens do grupo)</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Magno"
                maxLength={40}
              />
            </label>
            <button
              className="primary block"
              disabled={busy || name.trim().length < 2}
              onClick={create}
            >
              {busy ? "Criando..." : "Criar conta"}
            </button>
          </>
        ) : (
          <>
            <label className="field">
              <span>Cole a chave que você guardou</span>
              <input
                type="text"
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder="xY3k..."
              />
            </label>
            <button
              className="primary block"
              disabled={busy || pasted.trim().length < 10}
              onClick={restore}
            >
              {busy ? "Verificando..." : "Entrar"}
            </button>
          </>
        )}
      </div>
    </>
  );
}
