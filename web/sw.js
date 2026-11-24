/* Montée — service worker : l'app marche hors ligne. Change VERSION à chaque mise en ligne. */
var VERSION = "montee-4.4.7";
var SHELL = ["./", "index.html", "styles.css", "illus.js", "widgets.js", "engine.js", "parser.js", "tenup.js", "pdfimport.js", "summary.js", "app.js", "vendor/capacitor.js", "vendor/pdf.min.js", "vendor/pdf.worker.min.js", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "apple-touch-icon.png", "vendor/fonts/figtree-latin-400-normal.woff2", "vendor/fonts/figtree-latin-500-normal.woff2", "vendor/fonts/figtree-latin-600-normal.woff2", "vendor/fonts/figtree-latin-700-normal.woff2", "vendor/fonts/figtree-latin-800-normal.woff2", "vendor/fonts/fraunces-latin-700-normal.woff2", "vendor/fonts/fraunces-latin-800-normal.woff2"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// Réseau d'abord (pour avoir la dernière version), cache si hors ligne
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin && url.host.indexOf("fonts.") !== 0) return;
  e.respondWith(fetch(e.request).then(function (res) {
    var copy = res.clone();
    caches.open(VERSION).then(function (c) { c.put(e.request, copy); });
    return res;
  }).catch(function () { return caches.match(e.request).then(function (r) { return r || caches.match("index.html"); }); }));
});
