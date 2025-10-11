self.addEventListener("install", (e) => {
  e.waitUntil(caches.open("sough-v1").then((c) => c.addAll([
    "/","/index.html","/css/styles.css","/js/visualizer.js",
    "/mixer.html","/js/audio.js","/remixer.html","/js/remixer.js",
    "/beatlab.html","/js/beatlab.js","/assets/icon-192.png","/assets/icon-512.png","/assets/icon.svg","/assets/favicon.png"
  ])));
});
self.addEventListener("fetch", (e) => { e.respondWith(caches.match(e.request).then((res) => res || fetch(e.request))); });
