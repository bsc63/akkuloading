let timers = {};

self.addEventListener("install", e => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", e => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("message", e => {
  const data = e.data;

  if (data.cmd === "clearTimers") {
    for (const id in timers) clearTimeout(timers[id]);
    timers = {};
  }

  if (data.cmd === "startTimer") {
    const { id, delay, title, body } = data;

    if (timers[id]) clearTimeout(timers[id]);

    timers[id] = setTimeout(() => {
      self.registration.showNotification(title, { body });
      delete timers[id];
    }, delay);
  }
});
