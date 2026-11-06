// Genera el borrador en PDF del derecho de petición o de la tutela.
// Plantillas pendientes de revisión por el abogado titulado.
const PDFDocument = require("pdfkit");
const { fechaLarga } = require("./plazos");

const ENTIDAD = {
  alcaldia: "Alcaldía Municipal de {municipio}",
  eps: null, // se pide completar el nombre de la EPS
  victimas: "Unidad para la Atención y Reparación Integral a las Víctimas",
  otra: null
};

const TIEMPO = { menos15: "hace menos de 15 días", mas15: "hace más de 15 días", mas3m: "hace más de tres meses" };

// Cada hecho es una lista de partes: texto normal o { ph: "..." } para lo que falta completar.
const HECHO = {
  no_responden: ["Presenté una solicitud ante esta entidad y no he recibido respuesta"],
  negaron: ["La entidad negó mi solicitud de ", { ph: "lo que se pidió" }],
  cobran: ["La entidad me está cobrando un valor que considero incorrecto"],
  otra_cosa: [{ ph: "descripción de lo que pasó" }]
};

const PETICION = {
  no_responden: ["Que se responda de fondo, de manera clara y completa, la solicitud que presenté."],
  negaron: ["Que se revise la decisión y se me conceda lo solicitado, o que se expliquen por escrito las razones de la negación."],
  cobran: ["Que se revise el cobro, se corrija el valor y se me entregue el soporte del cálculo."],
  otra_cosa: [{ ph: "lo que se le pide a la entidad" }, "."]
};

const PRETENSION = {
  no_responden: ["dé respuesta de fondo a la solicitud que presenté."],
  negaron: ["autorice y entregue lo solicitado: ", { ph: "medicamento, cita, tratamiento o ayuda" }, "."],
  cobran: ["suspenda el cobro mientras se revisa y corrija el valor."],
  otra_cosa: [{ ph: "lo que se le pide a la entidad" }, "."]
};

const COLOR_TEXTO = "#1D1A16";
const COLOR_PH = "#9C6414";
const COLOR_SUAVE = "#6B6257";

function derechos(caso) {
  const d = [];
  if (caso.entidad === "eps") d.push("la salud");
  if (caso.entidad === "victimas") d.push("la atención y reparación como víctima", "el mínimo vital");
  if (caso.entidad === "alcaldia" || caso.entidad === "otra") d.push("el mínimo vital");
  d.push("la vida digna");
  if (caso.hecho === "no_responden") d.push("el derecho de petición");
  return d.length > 1 ? d.slice(0, -1).join(", ") + " y " + d[d.length - 1] : d[0];
}

function entidadPartes(caso) {
  const plantilla = ENTIDAD[caso.entidad];
  if (caso.entidad === "eps") return [{ ph: "NOMBRE DE LA EPS" }];
  if (!plantilla) return [{ ph: "NOMBRE DE LA ENTIDAD" }];
  if (plantilla.includes("{municipio}")) {
    const muni = (caso.municipio || "").split(",")[0].trim();
    return muni ? [plantilla.replace("{municipio}", muni).toUpperCase()] : ["ALCALDÍA MUNICIPAL DE ", { ph: "MUNICIPIO" }];
  }
  return [plantilla.toUpperCase()];
}

// Escribe un párrafo hecho de partes; lo que falta completar va [entre corchetes] y en color.
function parrafo(doc, partes, opciones = {}) {
  const lista = partes.flat();
  lista.forEach((p, i) => {
    const ultimo = i === lista.length - 1;
    const esPh = typeof p === "object" && p !== null && p.ph;
    const negrita = typeof p === "object" && p !== null && p.b;
    const texto = esPh ? "[" + p.ph + "]" : (typeof p === "object" ? p.b : p);
    doc.font(esPh || negrita ? "Times-Bold" : "Times-Roman").fillColor(esPh ? COLOR_PH : COLOR_TEXTO)
      .text(texto, { ...opciones, continued: !ultimo });
  });
  doc.fillColor(COLOR_TEXTO).font("Times-Roman");
  doc.moveDown(0.6);
}

function titulo(doc, t) {
  doc.moveDown(0.3).font("Times-Bold").fontSize(11.5).fillColor(COLOR_TEXTO).text(t.toUpperCase(), { characterSpacing: 0.6 });
  doc.fontSize(12).font("Times-Roman").moveDown(0.3);
}

function lista(doc, items) {
  items.forEach((partes, i) => {
    parrafo(doc, [String(i + 1) + ". ", ...partes], { indent: 0 });
  });
}

function marcaDeAgua(doc) {
  doc.save();
  doc.rotate(-30, { origin: [306, 396] });
  doc.font("Helvetica-Bold").fontSize(96).fillColor("#1E3A6E").fillOpacity(0.07);
  const ancho = doc.widthOfString("BORRADOR");
  const margen = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.text("BORRADOR", 306 - ancho / 2, 350, { lineBreak: false });
  doc.page.margins.bottom = margen;
  doc.restore();
  doc.fillOpacity(1);
}

function encabezado(doc, caso) {
  const y = 40;
  doc.font("Helvetica").fontSize(8.5).fillColor(COLOR_SUAVE)
    .text("Legal Tech Sucre · Radicado interno " + caso.radicado, 72, y, { lineBreak: false })
    .text("Borrador sin revisar", 72, y, { width: 468, align: "right", lineBreak: false });
  doc.moveTo(72, y + 14).lineTo(540, y + 14).lineWidth(0.5).strokeColor("#D8D0BF").stroke();
}

function pie(doc) {
  const y = 742;
  const margen = doc.page.margins.bottom;
  doc.page.margins.bottom = 0; // escribir en el pie sin que pdfkit cree otra página
  doc.font("Helvetica").fontSize(8).fillColor(COLOR_SUAVE)
    .text("Borrador generado por el asistente de Legal Tech Sucre. Un abogado titulado lo revisa antes de radicarlo.", 72, y, { width: 468, align: "center", lineBreak: false });
  doc.page.margins.bottom = margen;
}

function generarPDF(caso) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margins: { top: 80, bottom: 72, left: 72, right: 72 },
      info: { Title: (caso.tipo === "tutela" ? "Tutela" : "Derecho de petición") + " · borrador", Author: "Legal Tech Sucre" } });
    const partes = [];
    doc.on("data", (c) => partes.push(c));
    doc.on("end", () => resolve(Buffer.concat(partes)));
    doc.on("error", reject);

    const decorar = () => { marcaDeAgua(doc); encabezado(doc, caso); pie(doc); doc.x = 72; doc.y = 80; };
    doc.on("pageAdded", decorar);
    decorar();

    doc.fontSize(12).fillColor(COLOR_TEXTO).font("Times-Roman");
    const muni = (caso.municipio || "").split(",")[0].trim();
    const ent = entidadPartes(caso);
    const quien = ["Yo, ", { b: caso.nombre || "" }, ", identificado(a) con cédula de ciudadanía No. ", { ph: "número" },
      ", residente en ", caso.municipio ? caso.municipio : { ph: "municipio y vereda" }, ", "];
    const hecho = [...HECHO[caso.hecho], ". La situación empezó ", TIEMPO[caso.tiempo] || "", "."];

    // Una sola cadena: pdfkit no alinea a la derecha los textos partidos en trozos.
    doc.font("Times-Roman").fillColor(COLOR_TEXTO).text((muni || "[Municipio]") + ", " + fechaLarga(caso.fecha, false), { align: "right" });
    doc.moveDown(0.6);

    if (caso.tipo !== "tutela") {
      parrafo(doc, ["Señores"]);
      doc.moveUp(0.6);
      parrafo(doc, ent.map((p) => (typeof p === "string" ? { b: p } : p)));
      doc.moveUp(0.6);
      parrafo(doc, ["E. S. D."]);
      parrafo(doc, [{ b: "Referencia: " }, "Derecho de petición (artículo 23 de la Constitución Política y Ley 1755 de 2015)."]);
      parrafo(doc, [...quien, "en ejercicio del derecho fundamental de petición, me dirijo a ustedes con base en los siguientes:"], { align: "justify" });
      titulo(doc, "Hechos");
      const hechos = [hecho];
      if (caso.riesgo === "si") hechos.push(["Esta situación pone en riesgo mi salud, mi vivienda o mi sustento."]);
      hechos.push(["A la fecha la situación no se ha resuelto."]);
      lista(doc, hechos);
      titulo(doc, "Peticiones");
      lista(doc, [PETICION[caso.hecho], ["Que la respuesta se dé dentro de los 15 días hábiles que fija la Ley 1755 de 2015."]]);
    } else {
      const der = derechos(caso);
      parrafo(doc, ["Señor(a)"]);
      doc.moveUp(0.6);
      parrafo(doc, [{ b: "JUEZ (REPARTO)" }]);
      doc.moveUp(0.6);
      parrafo(doc, ["E. S. D."]);
      parrafo(doc, [{ b: "Referencia: " }, "Acción de tutela (artículo 86 de la Constitución Política y Decreto 2591 de 1991)."]);
      doc.moveUp(0.6);
      parrafo(doc, [{ b: "Accionante: " }, caso.nombre || { ph: "nombre completo" }]);
      doc.moveUp(0.6);
      parrafo(doc, [{ b: "Accionado: " }, ...ent]);
      parrafo(doc, [...quien, "acudo a usted para pedir la protección de mis derechos fundamentales, con base en los siguientes:"], { align: "justify" });
      titulo(doc, "Hechos");
      lista(doc, [hecho, ["Esta situación pone en riesgo mi salud, mi vivienda o mi sustento."],
        ["No cuento con otro medio rápido y eficaz para proteger mis derechos."]]);
      titulo(doc, "Derechos vulnerados");
      parrafo(doc, [der.charAt(0).toUpperCase() + der.slice(1) + "."]);
      titulo(doc, "Pretensiones");
      lista(doc, [["Tutelar mis derechos fundamentales a " + der + "."],
        ["Ordenar a ", ...ent, " que, en un plazo máximo de 48 horas, ", ...PRETENSION[caso.hecho]]]);
      titulo(doc, "Juramento");
      parrafo(doc, ["Manifiesto bajo la gravedad del juramento que no he presentado otra acción de tutela por los mismos hechos y derechos (artículo 37 del Decreto 2591 de 1991)."], { align: "justify" });
      titulo(doc, "Pruebas");
      lista(doc, [["Copia de mi cédula de ciudadanía."], [{ ph: "documentos del caso: orden médica, respuesta de la entidad, radicado" }]]);
    }

    titulo(doc, "Notificaciones");
    parrafo(doc, ["Recibiré respuesta en ", { ph: "dirección" }, " y en el celular y WhatsApp +" + (caso.telefono || "") + "."]);
    parrafo(doc, ["Atentamente,"]);
    doc.moveDown(2.2);
    const yFirma = doc.y;
    doc.moveTo(72, yFirma).lineTo(300, yFirma).lineWidth(0.8).strokeColor(COLOR_TEXTO).stroke();
    doc.y = yFirma + 4;
    parrafo(doc, [{ b: caso.nombre || "" }]);
    doc.moveUp(0.6);
    parrafo(doc, ["C.C. ", { ph: "número" }]);

    doc.end();
  });
}

function nombreArchivo(caso) {
  return (caso.tipo === "tutela" ? "Tutela" : "Derecho_de_peticion") + "_borrador_" + caso.radicado + ".pdf";
}

module.exports = { generarPDF, nombreArchivo };
