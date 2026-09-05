let isRunning = false;
let stopProgress = false;

let calendarButtons = null;

window.addEventListener("load", () => {
  calendarButtons = document.getElementById("calendarButtons");
  document.getElementById("power").value = 1000;
  document.getElementById("temp").value = 15;
});

const APP_VERSION = "2026-09-05-3";

// Minimaler SW-Call
function sendToSW(msg) {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready.then(reg => {
    reg.active?.postMessage(msg);
  });
}

// Google Kalender öffnen
function openGoogleCalendar(event) {
  const formatGoogleDate = (dateVal) => {
    const d = new Date(dateVal);
    return d.toISOString().replace(/-|:|\.\d+/g, '');
  };

  const startStr = formatGoogleDate(event.start);
  const endStr = formatGoogleDate(event.end);

  const title = encodeURIComponent(event.title || '');
  const details = encodeURIComponent(event.description || '');
  const location = encodeURIComponent(event.location || '');

  const googleUrl =
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${title}` +
    `&dates=${startStr}/${endStr}` +
    `&details=${details}` +
    `&location=${location}`;

  window.open(googleUrl, '_blank');
}

function updateStatus(state) {
  const status = document.getElementById("status");
  status.classList.remove("ready", "running", "done");

  const map = {
  ready: "Bereit",
  runningA: "Ladevorgang läuft…",
  runningB: "Ladevorgang läuft…",
  runningBoth: "Ladevorgang läuft…",
  doneA: "Laden beendet",
  doneB: "Laden beendet",
  doneBoth: "Laden beendet"
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
  document.getElementById("reset").disabled = false;
}

// Realistische Ladezeit
function ladezeitBerechnen(start, ziel, temp, power) {
  const kapazitaetWh = 1248;
  const eff = 0.90;

  const delta = (ziel - start) / 100;
  const energie = kapazitaetWh * delta;

  const ccAnteil = Math.min(delta, 0.60);
  const ccZeit = (energie * (ccAnteil / delta)) / (power * eff);

  const cvAnteil = Math.max(delta - 0.60, 0);
  const cvZeit = (energie * (cvAnteil / delta)) / (power * eff) * 2.5;

  let tempFaktor = temp < 10 ? 1.25 : temp > 35 ? 1.15 : 1.0;

  return (ccZeit + cvZeit) * tempFaktor * 60;
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

// ⭐ BERECHNEN
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

  // ⭐ Kalender-Buttons erzeugen
  calendarButtons.innerHTML = "";

  const diff = Math.abs(Number(startA) - Number(startB));

  function createButton(label, callback) {
    const btn = document.createElement("button");
    btn.innerText = label;
    btn.className = "calendar-btn";
    btn.onclick = callback;
    calendarButtons.appendChild(btn);
  }

  if (hasA && hasB) {

    if (diff <= 3) {
      // EIN Termin
      createButton("Beide Akkus eintragen", () => {
        const start = fertigA < fertigB ? fertigA : fertigB;
        openGoogleCalendar({
          title: "Beide Akkus fertig",
          start: start,
          end: new Date(start.getTime() + 5 * 60000),
          description:
            `Akku A fertig: ${fertigA.toLocaleString()}\n` +
            `Akku B fertig: ${fertigB.toLocaleString()}\n\n` +
            `Automatisch erzeugt durch Akku-Ladezeit-App`
        });
      });

      updateStatus("doneBoth");

    } else {
      // ZWEI Buttons
      createButton("Akku A eintragen", () => {
        openGoogleCalendar({
          title: "Akku A fertig",
          start: fertigA,
          end: new Date(fertigA.getTime() + 5 * 60000),
          description: "Automatisch erzeugt durch Akku-Ladezeit-App"
        });
      });

      createButton("Akku B eintragen", () => {
        openGoogleCalendar({
          title: "Akku B fertig",
          start: fertigB,
          end: new Date(fertigB.getTime() + 5 * 60000),
          description: "Automatisch erzeugt durch Akku-Ladezeit-App"
        });
      });

      updateStatus("doneBoth");
    }

  } else if (hasA) {

    createButton("Akku A eintragen", () => {
      openGoogleCalendar({
        title: "Akku A fertig",
        start: fertigA,
        end: new Date(fertigA.getTime() + 5 * 60000),
        description: "Automatisch erzeugt durch Akku-Ladezeit-App"
      });
    });

    updateStatus("doneA");

  } else if (hasB) {

    createButton("Akku B eintragen", () => {
      openGoogleCalendar({
        title: "Akku B fertig",
        start: fertigB,
        end: new Date(fertigB.getTime() + 5 * 60000),
        description: "Automatisch erzeugt durch Akku-Ladezeit-App"
      });
    });

    updateStatus("doneB");
  }

  isRunning = false;
  updateButtons();
});

// RESET
document.getElementById("reset").addEventListener("click", () => {
  window.location.reload();
});

updateButtons();
updateStatus("ready");
