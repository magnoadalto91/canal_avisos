/**
 * Tudo aqui gira em torno de uma ideia: a "noite" não bate com o dia do
 * calendário. Uma checagem à 01:30 pertence à noite anterior. Sem isso o app
 * mandaria duas mensagens na mesma noite, ou nenhuma.
 */

const DAY = 1440; // minutos

/** Partes do relógio de parede em um fuso IANA, sem depender de libs. */
export function wallClock(tz: string, when: Date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(when).map((p) => [p.type, p.value]),
  );
  // Intl às vezes devolve "24" para meia-noite dependendo do locale/engine.
  const hour = Number(parts.hour === "24" ? "00" : parts.hour);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour,
    minute: Number(parts.minute),
    minutes: hour * 60 + Number(parts.minute),
  };
}

export function parseHHMM(value: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) throw new Error(`Horário inválido: "${value}". Use HH:MM.`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new Error(`Horário fora do intervalo: "${value}".`);
  return h * 60 + min;
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function shiftDate(isoDate: string, days: number): string {
  // Meio-dia UTC evita que horário de verão empurre a data para o dia errado.
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface WindowState {
  /** Identidade da noite: a data em que a janela começou. Cruza a meia-noite. */
  nightKey: string;
  /** Estamos dentro da janela de avaliação? */
  inside: boolean;
  /** A janela desta noite já fechou? É quando o alerta de ausência dispara. */
  after: boolean;
  /** Minutos decorridos desde a abertura da janela. */
  elapsed: number;
  durationMinutes: number;
  clock: string;
}

/**
 * Em vez de tratar "cruza meia-noite" como caso especial, ancoramos tudo na
 * última abertura de janela e medimos o tempo decorrido em módulo 24h. Assim
 * 22:00->02:00 e 22:00->23:30 caem no mesmo caminho de código.
 */
export function windowState(
  tz: string,
  windowStart: string,
  windowEnd: string,
  when: Date = new Date(),
): WindowState {
  const now = wallClock(tz, when);
  const start = parseHHMM(windowStart);
  const end = parseHHMM(windowEnd);

  // Janela de duração zero seria uma janela de 24h — não é o que ninguém quer.
  const duration = ((end - start + DAY) % DAY) || DAY;

  // A janela mais recente que abriu: hoje se já passamos do horário, senão ontem.
  const nightKey = now.minutes >= start ? now.date : shiftDate(now.date, -1);
  const elapsed = (now.minutes - start + DAY) % DAY;

  return {
    nightKey,
    inside: elapsed < duration,
    after: elapsed >= duration,
    elapsed,
    durationMinutes: duration,
    clock: `${String(now.hour).padStart(2, "0")}:${String(now.minute).padStart(2, "0")}`,
  };
}

export function formatClock(tz: string, when: Date = new Date()): string {
  const c = wallClock(tz, when);
  return `${String(c.hour).padStart(2, "0")}:${String(c.minute).padStart(2, "0")}`;
}

export function humanAge(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h${String(min % 60).padStart(2, "0")} atrás`;
  return `${Math.floor(h / 24)} dias atrás`;
}
