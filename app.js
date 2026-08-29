function ladezeitBerechnen(start, ziel, temp, power) {
  const kapazitaetWh = 1248; // 26Ah * 48V
  const eff = 0.90;

  const delta = (ziel - start) / 100;
  const energie = kapazitaetWh * delta;

  let tempFaktor = 1.0;
  if (temp < 10) tempFaktor = 1.25;
  if (temp > 35) tempFaktor = 1.15;

  let cvVerlangsamung = ziel > 85 ? 1.3 : 1.0;

  const zeitStunden = (energie / (power * eff)) * tempFaktor * cvVerlangsamung;
  return zeitStunden * 60; // Minuten
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

  const temp = Number(document.getElementById("temp").value);
  const power = Number(document.getElementById("power").value);

  const startA = Number(document.getElementById("startA").value);
  const zielA = Number(document.getElementById("zielA").value);

  const startB = Number(document.getElementById("startB").value);
  const zielB = Number(document.getElementById("zielB").value);

  const hasA = !isNaN(startA) && startA !== "";
  const hasB = !isNaN(startB) && startB !== "";

  if (!hasA && !hasB) {
    alert("Bitte mindestens einen Akku eingeben.");
    return;
  }

  if (Notification.permission !== "granted") {
    await Notification.requestPermission();
  }

  // --- EINZELMODUS ---
  if (hasA && !hasB) {
    const minA = ladezeitBerechnen(startA, zielA, temp, power);
    const fertigA = new Date(Date.now() + minA * 60000);

    document.getElementById("resultA").innerText =
      `Akku A fertig um ${fertigA.toLocaleTimeString()}`;

    startProgress(minA, document.getElementById("progA"));

    setTimeout(() => {
      new Notification("Akku A fertig!", { body: "Akku ist vollständig geladen." });
    }, minA * 60000);

    document.getElementById("resultB").innerText = "";
    document.getElementById("progB").style.width = "0%";
    return;
  }

  if (!hasA && hasB) {
    const minB = ladezeitBerechnen(startB, zielB, temp, power);
    const fertigB = new Date(Date.now() + minB * 60000);

    document.getElementById("resultB").innerText =
      `Akku B fertig um ${fertigB.toLocaleTimeString()}`;

    startProgress(minB, document.getElementById("progB"));

    setTimeout(() => {
      new Notification("Akku B fertig!", { body: "Akku ist vollständig geladen." });
    }, minB * 60000);

    document.getElementById("resultA").innerText = "";
    document.getElementById("progA").style.width = "0%";
    return;
  }

  // --- SPLITTERMODUS (beide Akkus gleichzeitig) ---
  const minA = ladezeitBerechnen(startA, zielA, temp, power);
  const minB = ladezeitBerechnen(startB, zielB, temp, power);

  const fertigA = new Date(Date.now() + minA * 60000);
  const fertigB = new Date(Date.now() + minB * 60000);

  document.getElementById("resultA").innerText =
    `Akku A fertig um ${fertigA.toLocaleTimeString()}`;
  document.getElementById("resultB").innerText =
    `Akku B fertig um ${fertigB.toLocaleTimeString()}`;

  startProgress(minA, document.getElementById("progA"));
  startProgress(minB, document.getElementById("progB"));

  setTimeout(() => {
    new Notification("Akku A fertig!", { body: "Akku A ist vollständig geladen." });
  }, minA * 60000);

  setTimeout(() => {
    new Notification("Akku B fertig!", { body: "Akku B ist vollständig geladen." });
  }, minB * 60000);
});
