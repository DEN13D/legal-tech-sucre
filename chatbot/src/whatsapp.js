// Envío de mensajes con la API de WhatsApp Cloud (Meta).
// Con DRY_RUN=1 no llama a Meta: guarda los mensajes en memoria y los PDF en ./out (para el simulador).
const fs = require("fs");
const path = require("path");

const VERSION = process.env.GRAPH_VERSION || "v25.0";
const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID;
const DRY_RUN = process.env.DRY_RUN === "1";
const BASE = () => `https://graph.facebook.com/${VERSION}/${PHONE_ID}`;

const enviados = []; // solo en DRY_RUN

function recortar(t, max) {
  t = String(t);
  return t.length <= max ? t : t.slice(0, max - 1) + "…";
}

async function llamar(ruta, cuerpo) {
  if (DRY_RUN) {
    enviados.push(cuerpo);
    return { ok: true };
  }
  const r = await fetch(BASE() + ruta, {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo)
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Meta respondió " + r.status + ": " + JSON.stringify(datos));
  return datos;
}

function texto(para, cuerpo) {
  return llamar("/messages", {
    messaging_product: "whatsapp", to: para, type: "text",
    text: { body: recortar(cuerpo, 4096), preview_url: false }
  });
}

// Hasta 3 botones de respuesta rápida (título máx. 20 caracteres).
function botones(para, cuerpo, opciones) {
  return llamar("/messages", {
    messaging_product: "whatsapp", to: para, type: "interactive",
    interactive: {
      type: "button",
      body: { text: recortar(cuerpo, 1024) },
      action: { buttons: opciones.slice(0, 3).map((o) => ({ type: "reply", reply: { id: o.id, title: recortar(o.titulo, 20) } })) }
    }
  });
}

// Lista desplegable de hasta 10 opciones (título máx. 24, descripción máx. 72).
function lista(para, cuerpo, boton, opciones) {
  return llamar("/messages", {
    messaging_product: "whatsapp", to: para, type: "interactive",
    interactive: {
      type: "list",
      body: { text: recortar(cuerpo, 4096) },
      action: {
        button: recortar(boton, 20),
        sections: [{
          title: "Opciones",
          rows: opciones.slice(0, 10).map((o) => ({ id: o.id, title: recortar(o.titulo, 24), description: o.desc ? recortar(o.desc, 72) : undefined }))
        }]
      }
    }
  });
}

// Sube el PDF a Meta y lo envía como documento.
async function documento(para, buffer, nombre, leyenda) {
  let mediaId;
  if (DRY_RUN) {
    const dir = path.join(__dirname, "..", "out");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, nombre), buffer);
    mediaId = "media-de-prueba";
  } else {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", "application/pdf");
    form.append("file", new Blob([buffer], { type: "application/pdf" }), nombre);
    const r = await fetch(BASE() + "/media", { method: "POST", headers: { Authorization: "Bearer " + TOKEN }, body: form });
    const datos = await r.json().catch(() => ({}));
    if (!r.ok || !datos.id) throw new Error("No se pudo subir el PDF: " + r.status + " " + JSON.stringify(datos));
    mediaId = datos.id;
  }
  return llamar("/messages", {
    messaging_product: "whatsapp", to: para, type: "document",
    document: { id: mediaId, filename: nombre, caption: recortar(leyenda, 1024) }
  });
}

// Marca el mensaje como leído (los dos chulitos azules).
function marcarLeido(idMensaje) {
  if (DRY_RUN) return Promise.resolve();
  return llamar("/messages", { messaging_product: "whatsapp", status: "read", message_id: idMensaje }).catch(() => {});
}

module.exports = { texto, botones, lista, documento, marcarLeido, enviados, DRY_RUN };
