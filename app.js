let isRunning = false;
let stopProgress = false;

const APP_VERSION = "2026-08-30-1";

// SW-Kommunikation bleibt drin, falls du später wieder etwas damit machen willst
function sendToSW(msg) {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.ready.then(reg => {
    if (reg.active) {
      reg.active.postMessage(msg);
    } else if (reg.waiting) {
      reg.waiting.postMessage(msg);
    } else if (reg.installing) {
      reg.installing.postMessage(msg);
    } else {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        navigator.serviceWorker.controller?.postMessage(msg);
      });
    }
  });
}

// ICS-Export: erzeugt eine Kalenderdatei, die der Nutzer öffnen kann
function downloadICS(title, dateObj) {
  const dtStart = dateObj.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const dtEnd = new Date(dateObj.getTime() + 5 * 60000)
    .toISOString()
    .replace(/[-:]/g, "")
    .split(".")[0] + "Z";

  const ics = `
BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:${title}
DTSTART:${dtStart}
DTEND:${dtEnd}
DESCRIPTION:Automatisch erzeugt durch Akku-Ladezeit-App
END:VEVENT
END:VCALENDAR`;

  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "akku_fertig.ics";
  a.click();

  URL.revokeObjectURL(url);
}

function updateStatus(state) {
  const status = document.getElementById("status");
  status.classList.remove("ready", "running", "waiting", "done");

  const map = {
    ready: "Bereit",
    runningA: "Berechnung läuft (Akku A)…",
    runningB: "Berechnung läuft (Akku B)…",
    runningBoth: "Berechnung läuft (beide Akkus)…",
    waiting: "Warte auf Kalender-Eintrag…",
    doneA: "Akku A ist fertig (Kalender-Eintrag erstellt)!",
    doneB: "Akku B ist fertig (Kalender-Eintrag erstellt)!",
    doneBoth: "Beide Akkus sind fertig (Kalender-Einträge erstellt)!"
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

  if (hasA && hasB) updateStatus("runningBoth");
  else if (hasA) updateStatus("runningA");
  else updateStatus("runningB");

  // Service-Worker-Timer werden nicht mehr genutzt, aber Clear bleibt drin
  sendToSW({ cmd: "clearTimers" });
  sendToSW({ cmd: "version", version: APP_VERSION });

  let doneCount = 0;

  if (hasA) {
    const minA = ladezeitBerechnen(Number(startA), Number(zielA), temp, power);
    const fertigA = new Date(Date.now() + minA * 60000);

    document.getElementById("resultA").innerText =
      `Akku A fertig um ${fertigA.toLocaleTimeString()}`;

    startProgress(minA, document.getElementById("progA"));

    // ICS für Akku A
    downloadICS("Akku A fertig", fertigA);
    doneCount++;
  } else {
    document.getElementById("resultA").innerText = "";
    document.getElementById("progA").style.width = "0%";
  }

  if (hasB) {
    const minB = ladezeitBerechnen(Number(startB), Number(zielB), temp, power);
    const fertigB = new Date(Date.now() + minB * 60000);

    document.getElementById("resultB").innerText =
      `Akku B fertig um ${fertigB.toLocaleTimeString()}`;

    startProgress(minB, document.getElementById("progB"));

    // ICS für Akku B
    downloadICS("Akku B fertig", fertigB);
    doneCount++;
  } else {
    document.getElementById("resultB").innerText = "";
    document.getElementById("progB").style.width = "0%";
  }

  // Status nach ICS-Erzeugung
  if (doneCount === 2) updateStatus("doneBoth");
  else if (hasA) updateStatus("doneA");
  else if (hasB) updateStatus("doneB");

  isRunning = false;
  updateButtons();
});

document.getElementById("reset").addEventListener("click", () => {
  stopProgress = true;

  document.getElementById("resultA").innerText = "";
  document.getElementById("resultB").innerText = "";
  document.getElementById("progA").style.width = "0%";
  document.getElementById("progB").style.width = "0%";

  sendToSW({ cmd: "clearTimers" });

  isRunning = false;
  updateButtons();
  updateStatus("ready");
});

updateButtons();
updateStatus("ready");

// SW-Nachrichten sind für Timer nicht mehr relevant, bleiben aber als Reserve drin
navigator.serviceWorker.addEventListener("message", event => {
  if (event.data.cmd === "done") {
    if (event.data.id === "A") updateStatus("doneA");
    if (event.data.id === "B") updateStatus("doneB");
  }
});
