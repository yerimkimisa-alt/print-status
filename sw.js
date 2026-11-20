// 앱 설치용 서비스워커. 항상 최신 화면을 먼저 받고(network-first), 연결이 끊겼을 때만 마지막 화면을 보여줌.
// 데이터(Supabase 연결 후)는 캐시하지 않음: 같은 출처의 GET 요청만 다룸.
const CACHE = "print-status-v2";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => clients.claim())));
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req, { cache: "no-cache" }) // 브라우저 HTTP 캐시(GitHub Pages 10분)를 건너뛰고 서버에 새 버전 확인
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
      .catch(() => caches.match(req))
  );
});
