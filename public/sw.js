/**
 * Service worker mínimo e proposital.
 *
 * O que ele NÃO faz: rodar em segundo plano para checar wifi. Isso não existe
 * em navegador nenhum — nem no Android (periodicsync é best-effort, roda de
 * 12 em 12h quando o Chrome quiser) nem no iOS (zero execução em background).
 * O gatilho real mora na automação do sistema operacional. Veja docs/ANDROID.md.
 *
 * O que ele faz: deixa a casca do app abrir offline e instalável.
 */
const CACHE = "canal-avisos-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Status e configuração nunca podem vir de cache: um painel que mostra o
  // estado de ontem é pior que um painel que não abre.
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("/"))),
  );
});
