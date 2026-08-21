"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import type { NotifyTarget, StatusResponse, UserConfig } from "@/lib/types";

interface Discovered {
  bot: { username: string; name: string };
  chats: Array<{ chatId: string; title: string; type: string }>;
  hint?: string;
}

export function ConfigPanel({
  status,
  reload,
}: {
  status: StatusResponse;
  reload: () => void;
}) {
  const c = status.config;
  const [form, setForm] = useState({
    displayName: c.displayName,
    timezone: c.timezone,
    windowStart: c.windowStart,
    windowEnd: c.windowEnd,
    freshnessMinutes: String(c.freshnessMinutes),
    alertOnNoSignal: c.alertOnNoSignal,
    enabled: c.enabled,
    homeSsid: "",
    messages: { ...c.messages },
  });
  const [targets, setTargets] = useState<NotifyTarget[]>(c.targets);
  const [discovered, setDiscovered] = useState<Discovered | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "info" | "err"; text: string } | null>(null);

  function patchField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function run(name: string, fn: () => Promise<string>) {
    setBusy(name);
    setMsg(null);
    try {
      setMsg({ kind: "info", text: await fn() });
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Falhou." });
    } finally {
      setBusy(null);
    }
  }

  const save = () =>
    run("save", async () => {
      const body: Record<string, unknown> = {
        displayName: form.displayName,
        timezone: form.timezone,
        windowStart: form.windowStart,
        windowEnd: form.windowEnd,
        freshnessMinutes: Number(form.freshnessMinutes),
        alertOnNoSignal: form.alertOnNoSignal,
        enabled: form.enabled,
        targets,
        messages: form.messages,
      };
      // Só manda o SSID se foi digitado agora: o servidor guarda o hash e nunca
      // devolve o texto, então campo vazio significa "não mexer".
      if (form.homeSsid.trim()) body.homeSsid = form.homeSsid.trim();

      await api<{ config: UserConfig }>("/api/config", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      patchField("homeSsid", "");
      reload();
      return "Ajustes salvos.";
    });

  const discover = () =>
    run("discover", async () => {
      const d = await api<Discovered>("/api/telegram/discover");
      setDiscovered(d);
      return d.hint ?? d.chats.length + " chat(s) encontrado(s) para @" + d.bot.username;
    });

  const test = (chatId: string) =>
    run("test", async () => {
      const r = await api<{ results: Array<{ ok: boolean; error?: string }> }>(
        "/api/telegram/test",
        { method: "POST", body: JSON.stringify({ chatId }) },
      );
      const bad = r.results.find((x) => !x.ok);
      if (bad) throw new Error(bad.error ?? "envio falhou");
      return "Mensagem de teste enviada.";
    });

  return (
    <>
      {msg && <div className={"banner " + msg.kind}>{msg.text}</div>}

      <div className="card">
        <h2>Grupo do Telegram</h2>
        <p className="hint">
          As pessoas do grupo não precisam criar nem instalar nada, só entrar
          pelo link do convite. Adicione seu bot ao grupo, mande qualquer
          mensagem lá e clique em procurar.
        </p>

        <button className="block" disabled={busy !== null} onClick={discover}>
          {busy === "discover" ? "Procurando..." : "Procurar grupos do bot"}
        </button>

        {discovered && discovered.chats.length > 0 && (
          <div style={{ marginTop: 14 }}>
            {discovered.chats.map((chat) => {
              const already = targets.some((t) => t.chatId === chat.chatId);
              return (
                <div className="row" key={chat.chatId}>
                  <span>
                    {chat.title}
                    <div className="mono" style={{ color: "var(--muted)", marginTop: 2 }}>
                      {chat.type} · {chat.chatId}
                    </div>
                  </span>
                  <button
                    className="small"
                    disabled={already}
                    onClick={() =>
                      setTargets((t) => [
                        ...t,
                        { kind: "telegram", chatId: chat.chatId, label: chat.title },
                      ])
                    }
                  >
                    {already ? "adicionado" : "adicionar"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Destinos ativos</h2>
        {targets.length === 0 ? (
          <p className="empty">Nenhum destino. Sem isto, o app não avisa ninguém.</p>
        ) : (
          targets.map((t) => (
            <div className="row" key={t.chatId}>
              <span>
                {t.label ?? "grupo"}
                <div className="mono" style={{ color: "var(--muted)", marginTop: 2 }}>
                  {t.chatId}
                </div>
              </span>
              <span style={{ display: "flex", gap: 6 }}>
                <button className="small" disabled={busy !== null} onClick={() => test(t.chatId)}>
                  testar
                </button>
                <button
                  className="small danger"
                  onClick={() => setTargets((prev) => prev.filter((x) => x.chatId !== t.chatId))}
                >
                  remover
                </button>
              </span>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <h2>Janela e rede</h2>

        <label className="field">
          <span>Seu nome nas mensagens</span>
          <input
            type="text"
            value={form.displayName}
            onChange={(e) => patchField("displayName", e.target.value)}
          />
        </label>

        <div style={{ display: "flex", gap: 12 }}>
          <label className="field" style={{ flex: 1 }}>
            <span>Começa às</span>
            <input
              type="time"
              value={form.windowStart}
              onChange={(e) => patchField("windowStart", e.target.value)}
            />
          </label>
          <label className="field" style={{ flex: 1 }}>
            <span>Limite</span>
            <input
              type="time"
              value={form.windowEnd}
              onChange={(e) => patchField("windowEnd", e.target.value)}
            />
          </label>
        </div>

        <label className="field">
          <span>Fuso horário</span>
          <input
            type="text"
            value={form.timezone}
            onChange={(e) => patchField("timezone", e.target.value)}
            placeholder="America/Sao_Paulo"
          />
        </label>

        <label className="field">
          <span>
            Nome do wifi de casa (SSID)
            {status.homeSsidRegistered ? " — já cadastrado, preencha só para trocar" : ""}
          </span>
          <input
            type="text"
            value={form.homeSsid}
            onChange={(e) => patchField("homeSsid", e.target.value)}
            placeholder={status.homeSsidRegistered ? "••••••••" : "NET_CASA_5G"}
          />
        </label>
        <p className="hint" style={{ marginTop: -8 }}>
          Guardamos só o hash do nome, nunca o texto. Precisa bater exatamente
          com o que a automação do celular envia.
        </p>

        <label className="field">
          <span>Sinal vale como &ldquo;em casa&rdquo; por até (minutos)</span>
          <input
            type="number"
            min={10}
            max={360}
            value={form.freshnessMinutes}
            onChange={(e) => patchField("freshnessMinutes", e.target.value)}
          />
        </label>
        <p className="hint" style={{ marginTop: -8 }}>
          Precisa ser maior que o intervalo do gatilho periódico do celular.
          Automação de 15 em 15 min com este campo em 60 dá margem folgada para
          um ou dois disparos perdidos.
        </p>
      </div>

      <div className="card">
        <h2>Comportamento</h2>

        <label className="toggle">
          <input
            type="checkbox"
            checked={form.alertOnNoSignal}
            onChange={(e) => patchField("alertOnNoSignal", e.target.checked)}
          />
          <span>
            <span className="t-title">Avisar quando não houver sinal</span>
            <span className="t-sub">
              Ligado, o grupo recebe um alerta explícito ao fim da janela.
              Desligado, o aviso é o silêncio: mais elegante, porém depende de
              alguém reparar numa mensagem que não chegou.
            </span>
          </span>
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => patchField("enabled", e.target.checked)}
          />
          <span>
            <span className="t-title">Monitoramento ligado</span>
            <span className="t-sub">
              Só ligue depois de testar o envio no grupo e de ver o primeiro
              sinal chegar na aba Status.
            </span>
          </span>
        </label>
      </div>

      <div className="card">
        <h2>Mensagens</h2>
        <p className="hint">
          Use <code>{"{nome}"}</code>, <code>{"{hora}"}</code> e <code>{"{data}"}</code>.
        </p>
        {(
          [
            ["home", "Chegou em casa"],
            ["noSignal", "Sem sinal até o limite"],
            ["manual", "Check-in manual"],
          ] as const
        ).map(([key, label]) => (
          <label className="field" key={key}>
            <span>{label}</span>
            <textarea
              value={form.messages[key]}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  messages: { ...f.messages, [key]: e.target.value },
                }))
              }
            />
          </label>
        ))}
      </div>

      <button className="primary block" disabled={busy !== null} onClick={save}>
        {busy === "save" ? "Salvando..." : "Salvar ajustes"}
      </button>
    </>
  );
}
