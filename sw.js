let currentVersion = null;
let timers = {};

self.addEventListener("message", event => {
  const data = event.data;

  if (data.cmd === "version") {
    if (currentVersion && currentVersion !== data.version) {
      caches.keys().then(keys => keys.forEach(key => caches.delete(key)));

      for (const id in timers) clearTimeout(timers[id]);
      timers = {};

      self.skipWaiting();
      self.clients.claim();
    }
    currentVersion = data.version;
  }

  if (data.cmd === "startTimer") {
    const { id, delay, title, body } = data;

    if (timers[id]) clearTimeout(timers[id]);

    timers[id] = setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon: "icons/icon-192.png"
      });

      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ cmd: "done", id });
        });
      });

      delete timers[id];
    }, delay);
  }

  if (data.cmd === "clearTimers") {
    for (const id in timers) clearTimeout(timers[id]);
    timers = {};
  }
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", event => {
  // Wir müssen nichts cachen – aber Android braucht dieses Event
});
