"use client";

const KEY_STORAGE = "canal-avisos:userKey";

export function getKey(): string | null {
  try {
    return localStorage.getItem(KEY_STORAGE);
  } catch {
    // Modo privado ou site data bloqueado: o app ainda renderiza, só não lembra.
    return null;
  }
}

export function setKey(key: string): void {
  try {
    localStorage.setItem(KEY_STORAGE, key);
  } catch {
    /* segue valendo em memória nesta sessão */
  }
}

export function clearKey(): void {
  try {
    localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* nada a fazer */
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("content-type", "application/json");

  if (auth) {
    const key = getKey();
    if (key) headers.set("x-canal-key", key);
  }

  const res = await fetch(path, { ...rest, headers, cache: "no-store" });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    throw new ApiError(data.error ?? "Erro " + res.status, res.status);
  }
  return data as T;
}
