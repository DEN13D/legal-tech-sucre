// Simulador: prueba conversaciones completas sin conectarse a Meta.
// Uso: npm run simular   (los PDF quedan en la carpeta out/)
process.env.DRY_RUN = "1";
process.env.APP_SECRET = "secreto-de-prueba";
process.env.DATA_DIR = require("path").join(require("os").tmpdir(), "lts-sim-" + Date.now());
const crypto = require("crypto");
const assert = require("assert");
const { app } = require("../src/server");
const wa = require("../src/whatsapp");
const store = require("../src/store");

let n = 0;
function payload(numero, mensaje) {
  return { object: "whatsapp_business_account", entry: [{ id: "WABA", changes: [{ field: "messages", value: {
    messaging_product: "whatsapp", metadata: { phone_number_id: "PRUEBA" },
    contacts: [{ wa_id: numero, profile: { name: "Usuario de prueba" } }],
    messages: [{ from: numero, id: "wamid.SIM" + (++n), timestamp: String(Date.now() / 1000 | 0), ...mensaje }] } }] }] };
}
const txt = (t) => ({ type: "text", text: { body: t } });
const btn = (id) => ({ type: "interactive", interactive: { type: "button_reply", button_reply: { id, title: id } } });
const lst = (id) => ({ type: "interactive", interactive: { type: "list_reply", list_reply: { id, title: id } } });
const audio = () => ({ type: "audio", audio: { id: "a1", mime_type: "audio/ogg" } });

let base;
async function enviar(numero, mensaje, firmaMala = false) {
  const cuerpo = JSON.stringify(payload(numero, mensaje));
  const firma = "sha256=" + crypto.createHmac("sha256", firmaMala ? "otro" : process.env.APP_SECRET).update(cuerpo).digest("hex");
  const r = await fetch(base + "/webhook", { method: "POST", headers: { "Content-Type": "application/json", "X-Hub-Signature-256": firma }, body: cuerpo });
  await new Promise((ok) => setTimeout(ok, 60));
  return r.status;
}

function resumen(m) {
  if (m.type === "text") return "TEXTO: " + m.text.body;
  if (m.type === "document") return "DOCUMENTO: " + m.document.filename + " — " + m.document.caption;
  const i = m.interactive;
  const ops = i.type === "button" ? i.action.buttons.map((b) => "[" + b.reply.title + "]") : i.action.sections[0].rows.map((r) => "{" + r.title + "}");
  return (i.type === "button" ? "BOTONES: " : "LISTA (" + i.action.button + "): ") + i.body.text + "\n      " + ops.join(" ");
}

// Revisa los límites de WhatsApp en cada mensaje enviado.
function validarLimites(m) {
  if (m.type === "interactive") {
    const i = m.interactive;
    assert(i.body.text.length <= (i.type === "button" ? 1024 : 4096), "cuerpo muy largo");
    if (i.type === "button") {
      assert(i.action.buttons.length <= 3, "más de 3 botones");
      i.action.buttons.forEach((b) => assert(b.reply.title.length <= 20, "botón > 20: " + b.reply.title));
    } else {
      assert(i.action.button.length <= 20, "botón de lista > 20");
      const rows = i.action.sections.flatMap((s) => s.rows);
      assert(rows.length <= 10, "más de 10 filas");
      rows.forEach((r) => { assert(r.title.length <= 24, "fila > 24: " + r.title); assert(!r.description || r.description.length <= 72, "descripción > 72"); });
    }
  }
  if (m.type === "text") assert(m.text.body.length <= 4096);
}

async function conversacion(nombre, numero, pasos) {
  console.log("\n=== " + nombre + " ===");
  for (const [etiqueta, msg] of pasos) {
    const desde = wa.enviados.length;
    await enviar(numero, msg);
    console.log("\n> " + etiqueta);
    wa.enviados.slice(desde).forEach((m) => { validarLimites(m); console.log("  " + resumen(m).replace(/\n/g, "\n  ")); });
  }
}

(async () => {
  const servidor = app.listen(0);
  base = "http://127.0.0.1:" + servidor.address().port;

  // Seguridad: firma incorrecta y verificación del webhook
  assert.strictEqual(await enviar("570000000000", txt("hola"), true), 401, "debe rechazar firma falsa");
  const v = await fetch(base + "/webhook?hub.mode=subscribe&hub.verify_token=mal&hub.challenge=123");
  assert.strictEqual(v.status, 403);

  await conversacion("1. Derecho de petición con botones", "573001112233", [
    ["hola", txt("hola")],
    ["[Sí, autorizo]", btn("si")],
    ["maría elena pérez", txt("maría elena pérez")],
    ["Sampués, vereda La Gallera", txt("Sampués, vereda La Gallera")],
    ["{Alcaldía}", lst("alcaldia")],
    ["{No me responden}", lst("no_responden")],
    ["[Más de 15 días]", btn("mas15")],
    ["[No]", btn("no")]
  ]);

  await conversacion("2. Tutela escribiendo números, con audio y errores", "573104445566", [
    ["Buenas tardes", txt("Buenas tardes")],
    ["si", txt("si")],
    ["Juan", txt("Juan")],
    ["Juan Carlos Mercado Díaz", txt("Juan Carlos Mercado Díaz")],
    ["Corozal", txt("Corozal")],
    ["(audio)", audio()],
    ["2", txt("2")],
    ["no se", txt("no se")],
    ["me negaron algo", txt("me negaron algo")],
    ["1", txt("1")],
    ["sí", txt("sí")],
    ["gracias", txt("gracias")],
    ["[Hablar con asesor]", btn("asesor")],
    ["[Nuevo caso]", btn("reiniciar")]
  ]);

  await conversacion("3. No autoriza datos", "573207778899", [
    ["hola", txt("hola")],
    ["[No autorizo]", btn("no")],
    ["quiero ayuda?", txt("quiero ayuda?")],
    ["hola", txt("hola")]
  ]);

  // Mensaje repetido por Meta: no se responde dos veces
  const antes = wa.enviados.length;
  const repetido = JSON.stringify(payload("573001112233", txt("hola")));
  const firma = "sha256=" + crypto.createHmac("sha256", process.env.APP_SECRET).update(repetido).digest("hex");
  for (let i = 0; i < 2; i++) await fetch(base + "/webhook", { method: "POST", headers: { "Content-Type": "application/json", "X-Hub-Signature-256": firma }, body: repetido });
  await new Promise((ok) => setTimeout(ok, 80));
  assert.strictEqual(wa.enviados.length - antes, 2, "el repetido se procesa una sola vez (reinicio = 2 mensajes)");

  const casos = store.listarCasos();
  assert.strictEqual(casos.length, 2);
  assert.strictEqual(casos[0].tipo, "peticion");
  assert.strictEqual(casos[1].tipo, "tutela");
  console.log("\nCasos registrados:", casos.map((c) => c.radicado + " " + c.tipo + " " + c.nombre).join(" | "));
  console.log("\nTodo bien: " + wa.enviados.length + " mensajes enviados, límites de WhatsApp respetados.");
  servidor.close();
  process.exit(0);
})().catch((e) => { console.error("FALLÓ:", e); process.exit(1); });
