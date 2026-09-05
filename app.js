let isRunning = false;
let stopProgress = false;

const APP_VERSION = "2026-08-30-3";

// Minimaler SW-Call (optional)
function sendToSW(msg) {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready.then(reg => {
    reg.active?.postMessage(msg);
  });
}

// ICS für EINEN Akku
function downloadICS(title, dateObj) {
  const dtStart = dateObj.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const dtEnd = new Date(dateObj.getTime() + 5 * 60000)
    .toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

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
  a.download = `${title.replace(/\s+/g, "_")}.ics`;
  a.click();

  URL.revokeObjectURL(url);
}

// ICS für ZWEI Akkus in EINER Datei
function downloadICSCombined(fertigA, fertigB) {
  const dtStartA = fertigA.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const dtEndA = new Date(fertigA.getTime() + 5 * 60000)
    .toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const dtStartB = fertigB.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const dtEndB = new Date(fertigB.getTime() + 5 * 60000)
    .toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const ics = `
BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Akku A fertig
DTSTART:${dtStartA}
DTEND:${dtEndA}
DESCRIPTION:Automatisch erzeugt durch Akku-Ladezeit-App
END:VEVENT
BEGIN:VEVENT
SUMMARY:Akku B fertig
DTSTART:${dtStartB}
DTEND:${dtEndB}
DESCRIPTION:Automatisch erzeugt durch Akku-Ladezeit-App
END:VEVENT
END:VCALENDAR`;

  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `akkus_fertig.ics`;
  a.click();

  URL.revokeObjectURL(url);
}

function updateStatus(state) {
  const status = document.getElementById("status");
  status.classList.remove("ready", "running", "done");

  const map = {
    ready: "Bereit",
    runningA: "Berechnung läuft (Akku A)…",
    runningB: "Berechnung läuft (Akku B)…",
    runningBoth: "Berechnung läuft (beide Akkus)…",
    doneA: "Akku A ist fertig (ICS erstellt)",
    doneB: "Akku B ist fertig (ICS erstellt)",
    doneBoth: "Beide Akkus sind fertig (ICS erstellt)"
  };

  status.innerText = map[state];
  status.classList.add(
    state.startsWith("done") ? "done" :
    state.startsWith("running") ? "running" :
    "ready"
  );
}

function updateButtons() {
  document.getElementById("calc").disabled = isRunning;
  document.getElementById("reset").disabled = false; // Reset immer aktiv
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

  sendToSW({ cmd: "clearTimers" });

  let fertigA = null;
  let fertigB = null;

  if (hasA) {
    const minA = ladezeitBerechnen(Number(startA), Number(zielA), temp, power);
    fertigA = new Date(Date.now() + minA * 60000);

    document.getElementById("resultA").innerText =
      `Akku A fertig um ${fertigA.toLocaleTimeString()}`;

    startProgress(minA, document.getElementById("progA"));
  }

  if (hasB) {
    const minB = ladezeitBerechnen(Number(startB), Number(zielB), temp, power);
    fertigB = new Date(Date.now() + minB * 60000);

    document.getElementById("resultB").innerText =
      `Akku B fertig um ${fertigB.toLocaleTimeString()}`;

    startProgress(minB, document.getElementById("progB"));
  }

  // ICS-Logik
  if (hasA && hasB) {
    if (fertigA.getTime() === fertigB.getTime()) {
      downloadICS("Beide Akkus fertig", fertigA);
      updateStatus("doneBoth");
    } else {
      downloadICSCombined(fertigA, fertigB);
      updateStatus("doneBoth");
    }
  } else if (hasA) {
    downloadICS("Akku A fertig", fertigA);
    updateStatus("doneA");
  } else if (hasB) {
    downloadICS("Akku B fertig", fertigB);
    updateStatus("doneB");
  }

  isRunning = false;
  updateButtons();
});

// NEUER RESET: Seite neu laden + Standardwerte setzen
document.getElementById("reset").addEventListener("click", () => {
  window.location.reload();
});

// Standardwerte setzen beim Laden
window.addEventListener("load", () => {
  document.getElementById("power").value = 1000;
  document.getElementById("temp").value = 15;
});

updateButtons();
updateStatus("ready");
