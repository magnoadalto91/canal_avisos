/** Onde o sinal nasceu. A automação do SO é a fonte mais forte. */
export type HeartbeatSource =
  | "ssid-automation" // MacroDroid / Atalhos do iOS: o SO afirma o SSID
  | "pwa" // app aberto no navegador
  | "manual"; // botão de check-in

export type HeartbeatEvent =
  | "wifi-connected"
  | "wifi-disconnected"
  | "periodic"
  | "app-open";

/** Veredito do servidor sobre onde a pessoa está. */
export type Network = "home" | "away" | "unknown";

export interface Heartbeat {
  at: number; // epoch ms
  source: HeartbeatSource;
  event: HeartbeatEvent;
  deviceId: string;
  network: Network;
  /** Como o servidor chegou nesse veredito — aparece no histórico. */
  reason: string;
  connectionType?: string; // navigator.connection.type, quando existir
  ipHash?: string;
}

export type Outcome =
  | "home-confirmed" // mandou "está em casa"
  | "no-signal-alert" // mandou "sem sinal"
  | "silent" // não mandou nada de propósito
  | "manual-checkin";

export interface NightRecord {
  nightKey: string; // "2026-08-21" — a data da noite, não do relógio
  outcome: Outcome;
  at: number;
  detail: string;
}

export interface NotifyTarget {
  kind: "telegram";
  /** chat_id do grupo/canal. Grupos são negativos: -1001234567890 */
  chatId: string;
  label?: string;
}

export interface UserConfig {
  id: string;
  createdAt: number;
  displayName: string;

  /** IANA, ex: "America/Sao_Paulo" */
  timezone: string;
  /** "HH:MM" no fuso do usuário. A partir daqui o app começa a avaliar. */
  windowStart: string;
  /** "HH:MM". Se nada foi detectado até aqui, dispara o alerta de ausência. */
  windowEnd: string;

  /**
   * Idade máxima do heartbeat para valer como "está em casa".
   * Existe porque heartbeat velho é perigoso: celular que morreu às 21h
   * em casa deixaria um "home" congelado e mandaria tranquilidade falsa.
   */
  freshnessMinutes: number;

  /** Manda aviso explícito quando nada foi detectado até windowEnd. */
  alertOnNoSignal: boolean;

  /**
   * Guarda o histórico de sinais recebidos. Serve para depurar a automação e
   * vira lixo depois que tudo está funcionando.
   *
   * Desligar NÃO afeta a detecção: o último sinal, que é o que a decisão usa,
   * continua sendo gravado sempre. Só a lista deixa de ser alimentada.
   */
  logBeats: boolean;

  enabled: boolean;

  /** sha256 do SSID de casa. Nunca guardamos o nome em claro. */
  homeSsidHash?: string;
  /** sha256 do IP público de casa. Reaprendido a cada conexão no SSID. */
  homeIpHash?: string;

  targets: NotifyTarget[];

  messages: {
    home: string;
    noSignal: string;
    manual: string;
  };
}

export interface DeviceRecord {
  userId: string;
  deviceId: string;
  label: string;
  createdAt: number;
  lastUsedAt?: number;
  /** sha256 do token, para conseguir apagar a credencial ao revogar. */
  tokenHash?: string;
}

/* ---------- respostas da API, compartilhadas com o front ---------- */

export interface WindowSnapshot {
  nightKey: string;
  inside: boolean;
  after: boolean;
  elapsed: number;
  durationMinutes: number;
  clock: string;
}

export interface StatusResponse {
  config: UserConfig;
  now: number;
  window: WindowSnapshot;
  lastBeat: Heartbeat | null;
  tonight: NightRecord | null;
  decision: { action: string; reason: string };
  beats: Heartbeat[];
  nights: NightRecord[];
  devices: DeviceRecord[];
  homeSsidRegistered: boolean;
  homeIpRegistered: boolean;
}
