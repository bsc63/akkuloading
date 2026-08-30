let isRunning = false;
let stopProgress = false;

const APP_VERSION = "2026-08-30-1";

function updateStatus(state) {
  const status = document.getElementById("status");
  status.classList.remove("ready", "running", "waiting", "done");

  const map = {
    ready: "Bereit",
    runningA: "Berechnung läuft (Akku A)…",
    runningB: "Berechnung läuft (Akku B)…",
    runningBoth: "Berechnung läuft (beide Akkus)…",
    waiting: "Warte auf Benachrichtigung…",
    doneA: "Akku A ist fertig!",
    doneB: "Akku B ist fertig!",
    doneBoth: "Beide Akkus sind fertig!"
  };

  status.innerText = map[state];
  status.classList.add(
    state.startsWith("done") ? "done" :
    state.startsWith("running") ? "running" :
    state === "waiting" ? "waiting" :
    "ready"
  );
}

function updateButtons() {
  const calcBtn = document.getElementById("calc");
  const resetBtn = document.getElementById("reset");

  calcBtn.disabled = isRunning;
  resetBtn.disabled = !isRunning;
}

function ladezeitBerechnen(start, ziel, temp, power) {
  const kapazitaetWh = 1248;
  const eff = 0.90;

  const delta = (ziel - start) / 100;
  const energie = kapazitaetWh * delta;

  let tempFaktor = temp < 10 ? 1.25 : temp > 35 ? 1.15 : 1.0;
  let cvVerlangsamung = ziel > 85 ? 1.3 : 1.0;

  return (energie / (power * eff)) * tempFaktor * cvVerlangsamung * 60;
}

function startProgress(durationMin, element) {
  stopProgress = false;

  const start = Date.now();
  const end = start + durationMin * 60000;

  function update() {
    if (stopProgress) return;

    const now = Date.now();
    const progress = Math.min(1, (now - start) / (end - start));
    element.style.width = (progress * 100) + "%";

    if (progress < 1) requestAnimationFrame(update);
  }

  update();
}

document.getElementById("calc").addEventListener("click", async () => {
  if (isRunning) return;

  isRunning = true;
  updateButtons();

  const temp = Number(document.getElementById("temp").value);
  const power = Number(document.getElementById("power").value);

  const startA = document.getElementById("startA").value;
  const zielA = document.getElementById("zielA").value;

  const startB = document.getElementById("startB").value;
  const zielB = document.getElementById("zielB").value;

  const hasA = startA !== "" && zielA !== "";
  const hasB = startB !== "" && zielB !== "";

  if (!hasA && !hasB) {
    alert("Bitte mindestens einen Akku eingeben.");
    isRunning = false;
    updateButtons();
    updateStatus("ready");
    return;
  }

  if (Notification.permission !== "granted") {
    await Notification.requestPermission();
  }

  navigator.serviceWorker.ready.then(reg => {
    reg.active?.postMessage({ cmd: "clearTimers" });
    reg.active?.postMessage({ cmd: "version", version: APP_VERSION });
  });

  if (hasA && hasB) updateStatus("runningBoth");
  else if (hasA) updateStatus("runningA");
  else updateStatus("runningB");

  if (hasA) {
    const minA = ladezeitBerechnen(Number(startA), Number(zielA), temp, power);
    const fertigA = new Date(Date.now() + minA * 60000);

    document.getElementById("resultA").innerText =
      `Akku A fertig um ${fertigA.toLocaleTimeString()}`;

    startProgress(minA, document.getElementById("progA"));

    navigator.serviceWorker.ready.then(reg => {
      reg.active?.postMessage({
        cmd: "startTimer",
        id: "A",
        delay: minA * 60000,
        title: "Akku A fertig!",
        body: "Akku A ist vollständig geladen."
      });
    });
  }

  if (hasB) {
    const minB = ladezeitBerechnen(Number(startB), Number(zielB), temp, power);
    const fertigB = new Date(Date.now() + minB * 60000);

    document.getElementById("resultB").innerText =
      `Akku B fertig um ${fertigB.toLocaleTimeString()}`;

    startProgress(minB, document.getElementById("progB"));

    navigator.serviceWorker.ready.then(reg => {
      reg.active?.postMessage({
        cmd: "startTimer",
        id: "B",
        delay: minB * 60000,
        title: "Akku B fertig!",
        body: "Akku B ist vollständig geladen."
      });
    });
  }
});

document.getElementById("reset").addEventListener("click", () => {
  stopProgress = true;

  document.getElementById("resultA").innerText = "";
  document.getElementById("resultB").innerText = "";
  document.getElementById("progA").style.width = "0%";
  document.getElementById("progB").style.width = "0%";

  navigator.serviceWorker.ready.then(reg => {
    reg.active?.postMessage({ cmd: "clearTimers" });
  });

  isRunning = false;
  updateButtons();
  updateStatus("ready");
});

updateButtons();
updateStatus("ready");

navigator.serviceWorker.addEventListener("message", event => {
  if (event.data.cmd === "done") {
    if (event.data.id === "A") updateStatus("doneA");
    if (event.data.id === "B") updateStatus("doneB");
  }
});