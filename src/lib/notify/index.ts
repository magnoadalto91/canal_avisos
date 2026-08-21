import type { NotifyTarget, UserConfig } from "../types";
import { formatClock, wallClock } from "../time";
import * as telegram from "./telegram";

/**
 * Toda entrega passa por aqui. Trocar Telegram por WhatsApp (ou somar os dois)
 * é adicionar um case — nada no núcleo de decisão precisa saber quem entrega.
 */
const senders: Record<NotifyTarget["kind"], (chatId: string, text: string) => Promise<void>> = {
  telegram: telegram.sendMessage,
};

export function renderMessage(
  template: string,
  user: UserConfig,
  when: Date = new Date(),
): string {
  const clock = wallClock(user.timezone, when);
  const [y, m, d] = clock.date.split("-");
  return template
    .replaceAll("{nome}", user.displayName)
    .replaceAll("{hora}", formatClock(user.timezone, when))
    .replaceAll("{data}", `${d}/${m}/${y}`);
}

export interface DeliveryResult {
  target: NotifyTarget;
  ok: boolean;
  error?: string;
}

/**
 * Um destino que falha não pode derrubar os outros: se o grupo da família
 * der erro, o grupo dos amigos ainda tem que receber.
 */
export async function broadcast(
  targets: NotifyTarget[],
  text: string,
): Promise<DeliveryResult[]> {
  return Promise.all(
    targets.map(async (target): Promise<DeliveryResult> => {
      try {
        await senders[target.kind](target.chatId, text);
        return { target, ok: true };
      } catch (err) {
        return {
          target,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );
}
