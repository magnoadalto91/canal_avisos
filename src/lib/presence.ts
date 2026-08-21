import { hashSsid } from "./crypto";
import type { HeartbeatEvent, HeartbeatSource, Network, UserConfig } from "./types";

export interface Judgement {
  network: Network;
  reason: string;
  /** SSID de casa confirmado pelo SO: aproveitamos para reaprender o IP. */
  relearnHomeIp: boolean;
}

/**
 * Decide onde a pessoa está, do sinal mais forte para o mais fraco.
 *
 * O SSID vindo da automação do sistema operacional é a fonte de verdade —
 * é a única que sabe *qual* wifi. O IP público é a rede de segurança que
 * funciona em qualquer plataforma. O tipo de conexão é o último recurso e
 * só serve para descartar (rede móvel = não está em casa).
 */
export function judge(input: {
  user: UserConfig;
  source: HeartbeatSource;
  event: HeartbeatEvent;
  ssid?: string;
  ipHash?: string | null;
  connectionType?: string;
}): Judgement {
  const { user, source, event, ssid, ipHash, connectionType } = input;

  if (event === "wifi-disconnected") {
    // Roteador de banda dupla (2.4 e 5 GHz) dispara "desconectou" toda vez que
    // o aparelho troca de banda, sem ninguém ter saído de casa. Se a requisição
    // chegou do IP de casa, ela é a própria prova de que ainda estamos na rede:
    // pela rede móvel o endereço seria da operadora.
    //
    // Isso não enfraquece a detecção de saída. Quem sai de verdade manda esse
    // sinal pelos dados móveis — ou não manda nada, e aí o frescor resolve.
    if (ipHash && user.homeIpHash && ipHash === user.homeIpHash) {
      return {
        network: "home",
        reason: "trocou de banda do wifi, mas continua no IP de casa",
        relearnHomeIp: false,
      };
    }
    return {
      network: "away",
      reason: "automação avisou que saiu do wifi",
      relearnHomeIp: false,
    };
  }

  if (ssid && user.homeSsidHash) {
    const match = hashSsid(ssid) === user.homeSsidHash;
    return match
      ? {
          network: "home",
          reason: "SSID de casa confirmado pelo sistema",
          relearnHomeIp: true,
        }
      : {
          network: "away",
          reason: "conectado a outro wifi",
          relearnHomeIp: false,
        };
  }

  if (ipHash && user.homeIpHash && ipHash === user.homeIpHash) {
    return {
      network: "home",
      reason: "IP público bate com o de casa",
      relearnHomeIp: false,
    };
  }

  if (connectionType === "cellular") {
    return { network: "away", reason: "rede móvel", relearnHomeIp: false };
  }

  if (ssid && !user.homeSsidHash) {
    return {
      network: "unknown",
      reason: "SSID de casa ainda não cadastrado",
      relearnHomeIp: false,
    };
  }

  // Um sinal do próprio app quase sempre cai aqui, porque navegador não lê
  // SSID. Sem dizer isso, a linha vira "rede não reconhecida" no histórico e
  // é lida como falha da automação — o que manda a pessoa depurar a macro
  // errada. Vale a mensagem explícita.
  if (source === "pwa") {
    return {
      network: "unknown",
      reason: "app aberto — o navegador não consegue identificar a rede",
      relearnHomeIp: false,
    };
  }

  return {
    network: "unknown",
    reason: connectionType
      ? `rede não reconhecida (${connectionType})`
      : "rede não reconhecida",
    relearnHomeIp: false,
  };
}
