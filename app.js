let isRunning = false;


function ladezeitBerechnen(start, ziel, temp, power) {
  const kapazitaetWh = 1248;
  const eff = 0.90;

  const delta = (ziel - start) / 100;
  const energie = kapazitaetWh * delta;

  let tempFaktor = 1.0;
  if (temp < 10) tempFaktor = 1.25;
  if (temp > 35) tempFaktor = 1.15;

  let cvVerlangsamung = ziel > 85 ? 1.3 : 1.0;

  const zeitStunden = (energie / (power * eff)) * tempFaktor * cvVerlangsamung;
  return zeitStunden * 60;
}

function startProgress(durationMin, element) {
  const start = Date.now();
  const end = start + durationMin * 60000;

  function update() {
    const now = Date.now();
    const progress = Math.min(1, (now - start) / (end - start));
    element.style.width = (progress * 100) + "%";

    if (progress < 1) requestAnimationFrame(update);
  }

  update();
}

document.getElementById("calc").addEventListener("click", async () => {

if (isRunning) return;   // verhindert erneutes Starten
  isRunning = true;
  document.getElementById("calc").disabled = true;

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
    return;
  }

  if (Notification.permission !== "granted") {
    await Notification.requestPermission();
  }

  navigator.serviceWorker.ready.then(reg => {
    reg.active.postMessage({ cmd: "clearTimers" });
  });

  if (hasA) {
    const minA = ladezeitBerechnen(Number(startA), Number(zielA), temp, power);
    const fertigA = new Date(Date.now() + minA * 60000);

    document.getElementById("resultA").innerText =
      `Akku A fertig um ${fertigA.toLocaleTimeString()}`;

    startProgress(minA, document.getElementById("progA"));

    navigator.serviceWorker.ready.then(reg => {
      reg.active.postMessage({
        cmd: "startTimer",
        id: "A",
        delay: minA * 60000,
        title: "Akku A fertig!",
        body: "Akku A ist vollständig geladen."
      });
    });
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

    navigator.serviceWorker.ready.then(reg => {
      reg.active.postMessage({
        cmd: "startTimer",
        id: "B",
        delay: minB * 60000,
        title: "Akku B fertig!",
        body: "Akku B ist vollständig geladen."
      });
    });
  } else {
    document.getElementById("resultB").innerText = "";
    document.getElementById("progB").style.width = "0%";
  }
});

document.getElementById("reset").addEventListener("click", () => {
  // UI zurücksetzen
  document.getElementById("resultA").innerText = "";
  document.getElementById("resultB").innerText = "";
  document.getElementById("progA").style.width = "0%";
  document.getElementById("progB").style.width = "0%";

  // Timer im Service Worker löschen
  navigator.serviceWorker.ready.then(reg => {
    reg.active.postMessage({ cmd: "clearTimers" });
  });

  // Berechnen wieder erlauben
  isRunning = false;
  document.getElementById("calc").disabled = false;
});

