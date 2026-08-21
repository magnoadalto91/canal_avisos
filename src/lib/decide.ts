import type { Network, UserConfig } from "./types";

/**
 * Decisão pura: sem rede, sem banco, sem relógio próprio. Tudo que ela precisa
 * chega por parâmetro, o que torna esta regra — a que decide se o grupo recebe
 * ou não uma mensagem — testável sem infraestrutura nenhuma.
 */
export type Action = "send-home" | "send-no-signal" | "wait" | "silent" | "skip";

export interface Decision {
  action: Action;
  reason: string;
}

/**
 * Um heartbeat "em casa" antigo é a falha mais perigosa do sistema: um celular
 * que descarregou às 21h dentro de casa deixaria um estado "home" congelado, e
 * o app mandaria tranquilidade sem ter checado nada. Por isso frescor é
 * requisito para confirmar, nunca só o estado.
 */
export function decide(input: {
  user: UserConfig;
  insideWindow: boolean;
  afterWindow: boolean;
  beatNetwork: Network | null;
  beatAgeMs: number | null;
  /** Há quanto tempo a janela abriu. Um sinal mais velho que isso é de antes. */
  windowElapsedMs: number;
  now?: number;
}): Decision {
  const { user, insideWindow, afterWindow, beatNetwork, beatAgeMs, windowElapsedMs } =
    input;

  if (!user.enabled) return { action: "skip", reason: "monitoramento desligado" };
  if (user.targets.length === 0)
    return { action: "skip", reason: "nenhum destino configurado" };

  const freshLimit = user.freshnessMinutes * 60_000;
  const fresh = beatAgeMs !== null && beatAgeMs <= freshLimit;

  /**
   * "Recente" não basta. Quem estava em casa às 21h45, saiu às 21h55 e tem a
   * janela abrindo às 22h deixaria para trás um sinal de quinze minutos —
   * fresco pela régua antiga — e o app mandaria "chegou em casa" para alguém
   * que está na rua, encerrando a noite. Ninguém seria avisado depois disso.
   *
   * A pergunta certa não é se o sinal é recente, e sim se houve sinal de casa
   * DEPOIS que a janela abriu. É isso que torna a macro de saída dispensável:
   * o gatilho periódico só dispara em casa, então a ausência dele dentro da
   * janela já diz que a pessoa não está lá.
   */
  const dentroDaJanela = beatAgeMs !== null && beatAgeMs <= windowElapsedMs;

  if (insideWindow) {
    if (beatNetwork === "home" && fresh && dentroDaJanela) {
      return { action: "send-home", reason: "sinal de casa recebido dentro da janela" };
    }
    if (beatNetwork === "home" && fresh && !dentroDaJanela) {
      return {
        action: "wait",
        reason: "o sinal de casa é de antes da janela abrir, aguardando um novo",
      };
    }
    if (beatNetwork === "home" && !fresh) {
      return {
        action: "wait",
        reason: `último sinal de casa é antigo demais (limite: ${user.freshnessMinutes} min)`,
      };
    }
    if (beatNetwork === "away") {
      return { action: "wait", reason: "fora de casa, aguardando chegada" };
    }
    return { action: "wait", reason: "sem sinal conclusivo ainda" };
  }

  if (afterWindow) {
    return user.alertOnNoSignal
      ? {
          action: "send-no-signal",
          reason: "janela fechou sem confirmação de chegada",
        }
      : {
          action: "silent",
          reason: "janela fechou sem confirmação — silêncio é o aviso",
        };
  }

  return { action: "wait", reason: "fora da janela" };
}
