// Servidor del chatbot: recibe los mensajes de WhatsApp (webhook de Meta) y responde.
const crypto = require("crypto");
const express = require("express");
const store = require("./store");
const wa = require("./whatsapp");
const { manejar } = require("./flujo");
const { generarPDF, nombreArchivo } = require("./pdf");
const T = require("./textos");

const PUERTO = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "";
const APP_SECRET = process.env.APP_SECRET || "";
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const EQUIPO = process.env.EQUIPO_NUMERO || ""; // número que recibe avisos de asesor y urgencias

// ---------- Ejecutar lo que decidió el flujo ----------
async function ejecutar(numero, acciones) {
  for (const a of acciones) {
    try {
      if (a.accion === "texto") await wa.texto(numero, a.cuerpo);
      else if (a.accion === "botones") await wa.botones(numero, a.cuerpo, a.opciones);
      else if (a.accion === "lista") await wa.lista(numero, a.cuerpo, a.boton, a.opciones);
      else if (a.accion === "documento") {
        const pdf = await generarPDF(a.caso);
        await wa.documento(numero, pdf, nombreArchivo(a.caso), T.PIE_DOCUMENTO);
      } else if (a.accion === "registrar_caso") {
        store.registrarCaso(a.caso);
        console.log("Caso nuevo", a.caso.radicado, a.caso.tipo, "para revisión del abogado");
        if (EQUIPO) await wa.texto(EQUIPO, "Caso nuevo " + a.caso.radicado + " (" + a.caso.tipo + ") de " + a.caso.nombre + ", " + a.caso.municipio + ". Pendiente de revisión.");
      } else if (a.accion === "aviso_equipo") {
        const s = store.sesion(numero);
        const msg = "Aviso (" + a.motivo + "): +" + numero + " " + (s.datos.nombre || "") + (s.ultimoCaso ? " · caso " + s.ultimoCaso : "");
        console.log(msg);
        if (EQUIPO) await wa.texto(EQUIPO, msg);
      }
    } catch (e) {
      console.error("Error al enviar a", numero, "-", e.message);
      if (a.accion === "documento") {
        await wa.texto(numero, "No pude enviarte el documento por un problema de conexión. Ya quedó guardado y un asesor te lo manda por aquí.").catch(() => {});
      }
    }
  }
}

// Convierte el mensaje de WhatsApp en una entrada para el flujo.
function leerEntrada(m) {
  if (m.type === "text") return { tipo: "texto", valor: m.text.body };
  if (m.type === "interactive") {
    const r = m.interactive.button_reply || m.interactive.list_reply;
    return { tipo: "opcion", valor: r ? r.id : "" };
  }
  if (m.type === "button") return { tipo: "texto", valor: m.button.text || m.button.payload };
  if (m.type === "audio") return { tipo: "audio" };
  return { tipo: "otro" };
}

// Atiende los mensajes de cada persona en orden, uno por uno.
const colas = new Map();
function enCola(numero, tarea) {
  const previa = colas.get(numero) || Promise.resolve();
  const siguiente = previa.then(tarea, tarea).finally(() => { if (colas.get(numero) === siguiente) colas.delete(numero); });
  colas.set(numero, siguiente);
  return siguiente;
}

const vistos = new Set(); // Meta puede reenviar el mismo mensaje
function yaVisto(id) {
  if (vistos.has(id)) return true;
  vistos.add(id);
  if (vistos.size > 5000) vistos.delete(vistos.values().next().value);
  return false;
}

async function procesar(m, perfil) {
  const numero = m.from;
  await wa.marcarLeido(m.id);
  const s = store.sesion(numero);
  if (perfil && !s.datos.perfil) s.datos.perfil = perfil;
  const { sesion, acciones } = manejar(s, leerEntrada(m), { radicado: store.nuevoRadicado });
  store.actualizar(numero, sesion);
  await ejecutar(numero, acciones);
}

// ---------- Rutas ----------
const app = express();
app.use(express.json({ verify: (req, _res, buf) => { req.crudo = buf; } }));

app.get("/", (_req, res) => res.type("text").send("Chatbot de Legal Tech Sucre activo."));

// Verificación del webhook (Meta la hace una vez al configurarlo).
app.get("/webhook", (req, res) => {
  if (req.query["hub.mode"] === "subscribe" && VERIFY_TOKEN && req.query["hub.verify_token"] === VERIFY_TOKEN) {
    console.log("Webhook verificado por Meta.");
    return res.status(200).send(req.query["hub.challenge"]);
  }
  console.warn("Verificación del webhook rechazada: el token de verificación no coincide con VERIFY_TOKEN.");
  res.sendStatus(403);
});

// Mensajes entrantes.
app.post("/webhook", (req, res) => {
  if (APP_SECRET) {
    const firma = req.get("x-hub-signature-256") || "";
    const esperada = "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(req.crudo || "").digest("hex");
    if (firma.length !== esperada.length || !crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) {
      console.warn("Webhook rechazado: la firma no coincide. Revise que APP_SECRET sea la 'Clave secreta de la app' de Meta.");
      return res.sendStatus(401);
    }
  }
  res.sendStatus(200); // responder rápido; Meta reintenta si tarda
  for (const entry of req.body.entry || []) {
    for (const change of entry.changes || []) {
      const v = change.value || {};
      const perfil = v.contacts && v.contacts[0] && v.contacts[0].profile ? v.contacts[0].profile.name : "";
      const nMsg = (v.messages || []).length, nEst = (v.statuses || []).length;
      console.log("Webhook recibido (" + change.field + "): " + nMsg + " mensaje(s), " + nEst + " estado(s)" +
        (nEst ? " · " + v.statuses.map((s) => s.status + (s.errors ? " " + JSON.stringify(s.errors) : "")).join(", ") : ""));
      for (const m of v.messages || []) {
        console.log("Mensaje de +" + m.from + " tipo " + m.type);
        if (yaVisto(m.id)) continue;
        enCola(m.from, () => procesar(m, perfil)).catch((e) => console.error("Error procesando:", e));
      }
    }
  }
});

// Lista de casos para el abogado (protegida con ADMIN_KEY).
app.get("/casos", (req, res) => {
  if (!ADMIN_KEY || req.query.clave !== ADMIN_KEY) return res.sendStatus(403);
  res.json(store.listarCasos());
});

// Volver a generar el PDF de un caso para revisarlo.
app.get("/casos/:radicado.pdf", async (req, res) => {
  if (!ADMIN_KEY || req.query.clave !== ADMIN_KEY) return res.sendStatus(403);
  const caso = store.listarCasos().find((c) => c.radicado === req.params.radicado);
  if (!caso) return res.sendStatus(404);
  res.type("application/pdf").send(await generarPDF(caso));
});

if (require.main === module) {
  if (!wa.DRY_RUN && (!process.env.WHATSAPP_TOKEN || !process.env.PHONE_NUMBER_ID || !VERIFY_TOKEN)) {
    console.warn("Faltan variables: WHATSAPP_TOKEN, PHONE_NUMBER_ID y VERIFY_TOKEN. Revise el archivo .env.example");
  }
  app.listen(PUERTO, () => {
    console.log("Chatbot escuchando en el puerto " + PUERTO);
    console.log("Configuración: WHATSAPP_TOKEN " + (process.env.WHATSAPP_TOKEN ? "sí (" + process.env.WHATSAPP_TOKEN.length + " caracteres)" : "FALTA") +
      " · PHONE_NUMBER_ID " + (process.env.PHONE_NUMBER_ID || "FALTA") + " · VERIFY_TOKEN " + (VERIFY_TOKEN ? "sí" : "FALTA") +
      " · APP_SECRET " + (APP_SECRET ? "sí" : "no (no se revisa la firma)") + " · API " + (process.env.GRAPH_VERSION || "v25.0"));
  });
}

module.exports = { app, procesar, leerEntrada };
