const CACHE_NAME = "psyvit-ybt-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./site.webmanifest",
  "./assets/icon.svg",
  "./data/manifest.json",
  "./data/scenarios/biz_energy_budget_01.json",
  "./data/scenarios/biz_smarts_03.json",
  "./data/scenarios/biz_stop_doing_02.json",
  "./data/scenarios/team_canvas_01.json",
  "./data/scenarios/team_circle_resp_02.json",
  "./data/scenarios/team_psych_safety_03.json",
  "./data/scenarios/ya_checkin_checkout_03.json",
  "./data/scenarios/ya_resentment_audit_02.json",
  "./data/scenarios/ya_self_care_map_01.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});
