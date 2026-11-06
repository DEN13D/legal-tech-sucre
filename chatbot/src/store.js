// Guarda las conversaciones y los casos en archivos JSON (suficiente para la prueba interna).
// En la Parte 2 esto se reemplaza por una base de datos con los datos sensibles cifrados.
const fs = require("fs");
const path = require("path");

const DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const ARCH_SESIONES = path.join(DIR, "sesiones.json");
const ARCH_CASOS = path.join(DIR, "casos.json");

function leer(arch, defecto) {
  try { return JSON.parse(fs.readFileSync(arch, "utf8")); } catch { return defecto; }
}

let sesiones = leer(ARCH_SESIONES, {});
let casos = leer(ARCH_CASOS, []);
let pendiente = null;

function guardar() {
  clearTimeout(pendiente);
  pendiente = setTimeout(() => {
    try {
      fs.mkdirSync(DIR, { recursive: true });
      fs.writeFileSync(ARCH_SESIONES, JSON.stringify(sesiones, null, 2));
      fs.writeFileSync(ARCH_CASOS, JSON.stringify(casos, null, 2));
    } catch (e) { console.error("No se pudo guardar:", e.message); }
  }, 200);
}

function sesion(numero) {
  if (!sesiones[numero]) sesiones[numero] = { numero, estado: "nuevo", datos: {}, respuestas: {}, creado: new Date().toISOString() };
  return sesiones[numero];
}

function actualizar(numero, s) {
  s.actualizado = new Date().toISOString();
  sesiones[numero] = s;
  guardar();
}

function nuevoRadicado(fecha) {
  const aamm = fecha.slice(2, 4) + fecha.slice(5, 7);
  const n = casos.filter((c) => c.radicado.startsWith("LTS-" + aamm)).length + 1;
  return "LTS-" + aamm + "-" + String(n).padStart(4, "0");
}

function registrarCaso(caso) {
  casos.push(caso);
  guardar();
  return caso;
}

function listarCasos() { return casos; }

// Solo para el simulador.
function _reiniciarTodo() { sesiones = {}; casos = []; }

module.exports = { sesion, actualizar, nuevoRadicado, registrarCaso, listarCasos, _reiniciarTodo };
