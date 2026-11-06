// Cálculo de días hábiles en Colombia (lunes a viernes, sin festivos).
// Festivos 2026 y 2027 según la Ley 51 de 1983 (Ley Emiliani). Agregue los de años siguientes.

const FESTIVOS = new Set([
  // 2026
  "2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03", "2026-05-01",
  "2026-05-18", "2026-06-08", "2026-06-15", "2026-06-29", "2026-07-20", "2026-08-07",
  "2026-08-17", "2026-10-12", "2026-11-02", "2026-11-16", "2026-12-08", "2026-12-25",
  // 2027
  "2027-01-01", "2027-01-11", "2027-03-22", "2027-03-25", "2027-03-26", "2027-05-01",
  "2027-05-10", "2027-05-31", "2027-06-07", "2027-07-05", "2027-07-20", "2027-08-07",
  "2027-08-16", "2027-10-18", "2027-11-01", "2027-11-15", "2027-12-08", "2027-12-25"
]);

const ZONA = "America/Bogota";

// Fecha de hoy en Colombia como "AAAA-MM-DD".
function hoyColombia(ahora = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
}

function esHabil(iso) {
  const d = new Date(iso + "T12:00:00Z");
  const dia = d.getUTCDay(); // 0 domingo, 6 sábado
  return dia !== 0 && dia !== 6 && !FESTIVOS.has(iso);
}

// Suma n días hábiles a partir del día siguiente a "desde".
function sumarHabiles(desde, n) {
  const d = new Date(desde + "T12:00:00Z");
  let contados = 0;
  while (contados < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (esHabil(d.toISOString().slice(0, 10))) contados++;
  }
  return d.toISOString().slice(0, 10);
}

// "2026-11-27" → "viernes 27 de noviembre de 2026"
function fechaLarga(iso, conDia = true) {
  const d = new Date(iso + "T12:00:00Z");
  const opciones = { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" };
  if (conDia) opciones.weekday = "long";
  return new Intl.DateTimeFormat("es-CO", opciones).format(d).replace(",", "");
}

module.exports = { hoyColombia, esHabil, sumarHabiles, fechaLarga, FESTIVOS };
