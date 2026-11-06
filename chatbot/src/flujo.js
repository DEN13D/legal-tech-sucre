// Máquina de estados de la conversación.
// Recibe la sesión y lo que escribió la persona, y devuelve qué responder.
// No hace llamadas a Meta: así se puede probar con el simulador.
const T = require("./textos");
const { hoyColombia, sumarHabiles, fechaLarga } = require("./plazos");

// Quita tildes y mayúsculas para comparar respuestas escritas.
function normalizar(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

const COMANDOS = {
  reiniciar: ["hola", "menu", "inicio", "nuevo", "reiniciar", "empezar", "buenas", "buenos dias", "buenas tardes", "buenas noches"],
  asesor: ["asesor", "abogado", "humano", "persona", "ayuda"],
  urgente: ["urgente"]
};

function comando(entrada) {
  if (entrada.tipo === "opcion" && (entrada.valor === "reiniciar" || entrada.valor === "asesor")) return entrada.valor;
  if (entrada.tipo !== "texto") return null;
  const t = normalizar(entrada.valor);
  for (const [cmd, palabras] of Object.entries(COMANDOS)) if (palabras.includes(t)) return cmd;
  return null;
}

// Convierte la respuesta (botón, lista, número o texto) en el id de una opción.
function elegir(entrada, opciones) {
  if (entrada.tipo === "opcion") return opciones.find((o) => o.id === entrada.valor) ? entrada.valor : null;
  if (entrada.tipo !== "texto") return null;
  const t = normalizar(entrada.valor);
  const n = parseInt(t, 10);
  if (String(n) === t && n >= 1 && n <= opciones.length) return opciones[n - 1].id;
  const exacta = opciones.find((o) => normalizar(o.titulo) === t);
  if (exacta) return exacta.id;
  const parcial = opciones.filter((o) => t.length >= 3 && normalizar(o.titulo).includes(t));
  return parcial.length === 1 ? parcial[0].id : null;
}

const OPC_PERMISO = [{ id: "si", titulo: "Sí, autorizo" }, { id: "no", titulo: "No autorizo" }];

function preguntar(i) {
  const p = T.PREGUNTAS[i];
  // Las opciones también van numeradas en el texto, por si el celular no muestra botones.
  const numeradas = p.opciones.map((o, k) => (k + 1) + ". " + o.titulo).join("\n");
  const cuerpo = p.texto + "\n\n" + numeradas;
  return p.tipo === "lista"
    ? { accion: "lista", cuerpo, boton: p.boton, opciones: p.opciones }
    : { accion: "botones", cuerpo, opciones: p.opciones };
}

function pedirPermiso() {
  return { accion: "botones", cuerpo: T.PERMISO, opciones: OPC_PERMISO };
}

function repetirActual(s) {
  if (s.estado === "permiso") return [pedirPermiso()];
  if (s.estado === "nombre") return [{ accion: "texto", cuerpo: T.PEDIR_NOMBRE }];
  if (s.estado === "municipio") return [{ accion: "texto", cuerpo: T.PEDIR_MUNICIPIO }];
  const m = /^p(\d)$/.exec(s.estado);
  if (m) return [preguntar(Number(m[1]))];
  return [];
}

function esUrgente(r) {
  return r.riesgo === "si" && (r.hecho === "negaron" || r.entidad === "eps" || r.entidad === "victimas");
}

/**
 * @param s sesión guardada { estado, datos, respuestas }
 * @param entrada { tipo: "texto" | "opcion" | "audio" | "otro", valor }
 * @param ctx { radicado: () => string, perfil: nombre de WhatsApp }
 * @returns { sesion, acciones: [...] }
 */
function manejar(s, entrada, ctx = {}) {
  s = JSON.parse(JSON.stringify(s));
  const acciones = [];
  const cmd = comando(entrada);

  if (cmd === "asesor") {
    s.datos.pideAsesor = new Date().toISOString();
    acciones.push({ accion: "texto", cuerpo: T.ASESOR }, { accion: "aviso_equipo", motivo: "asesor" });
    return { sesion: s, acciones };
  }
  if (cmd === "urgente" && s.estado !== "nuevo") {
    s.datos.urgente = true;
    acciones.push({ accion: "texto", cuerpo: T.URGENTE }, { accion: "aviso_equipo", motivo: "urgente" });
    return { sesion: s, acciones };
  }
  if (cmd === "reiniciar" && s.datos.permiso) {
    if (!s.datos.nombre || !s.datos.municipio) {
      // Todavía está en el registro: se repite la pregunta pendiente.
      acciones.push(...repetirActual(s));
      return { sesion: s, acciones };
    }
    s.respuestas = {};
    s.estado = "p0";
    acciones.push({ accion: "texto", cuerpo: T.REINICIO }, preguntar(0));
    return { sesion: s, acciones };
  }

  if (entrada.tipo === "audio" && !["nuevo", "sin_permiso"].includes(s.estado)) {
    acciones.push({ accion: "texto", cuerpo: T.AUDIO_RECIBIDO }, ...repetirActual(s));
    return { sesion: s, acciones };
  }

  switch (s.estado) {
    case "nuevo":
    case "sin_permiso": {
      if (s.estado === "sin_permiso" && cmd !== "reiniciar") {
        acciones.push({ accion: "texto", cuerpo: T.SIN_PERMISO });
        break;
      }
      s.estado = "permiso";
      acciones.push({ accion: "texto", cuerpo: T.BIENVENIDA }, pedirPermiso());
      break;
    }
    case "permiso": {
      const r = elegir(entrada, OPC_PERMISO) || (entrada.tipo === "texto" && ["si", "sí", "s", "claro", "listo", "dale", "ok", "bueno"].includes(normalizar(entrada.valor)) ? "si" : null);
      if (r === "si") {
        s.datos.permiso = new Date().toISOString(); // fecha de la autorización (Ley 1581)
        s.estado = "nombre";
        acciones.push({ accion: "texto", cuerpo: T.PEDIR_NOMBRE });
      } else if (r === "no") {
        s.estado = "sin_permiso";
        acciones.push({ accion: "texto", cuerpo: T.SIN_PERMISO });
      } else {
        acciones.push({ accion: "texto", cuerpo: T.NO_ENTENDI }, pedirPermiso());
      }
      break;
    }
    case "nombre": {
      const v = entrada.tipo === "texto" ? entrada.valor.trim().replace(/\s+/g, " ") : "";
      if (v.length < 5 || v.split(" ").length < 2 || /\d/.test(v)) {
        acciones.push({ accion: "texto", cuerpo: T.NOMBRE_CORTO });
        break;
      }
      s.datos.nombre = v.split(" ").map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
      s.estado = "municipio";
      acciones.push({ accion: "texto", cuerpo: T.PEDIR_MUNICIPIO });
      break;
    }
    case "municipio": {
      const v = entrada.tipo === "texto" ? entrada.valor.trim().replace(/\s+/g, " ") : "";
      if (v.length < 3) {
        acciones.push({ accion: "texto", cuerpo: T.MUNICIPIO_CORTO });
        break;
      }
      s.datos.municipio = v.charAt(0).toUpperCase() + v.slice(1);
      s.estado = "p0";
      acciones.push({ accion: "texto", cuerpo: "Gracias, " + s.datos.nombre.split(" ")[0] + ". Ahora las 4 preguntas. Toca una opción o escribe su número." }, preguntar(0));
      break;
    }
    case "p0":
    case "p1":
    case "p2":
    case "p3": {
      const i = Number(s.estado.slice(1));
      const p = T.PREGUNTAS[i];
      const id = elegir(entrada, p.opciones);
      if (!id) {
        acciones.push({ accion: "texto", cuerpo: T.NO_ENTENDI }, preguntar(i));
        break;
      }
      s.respuestas[p.clave] = id;
      if (i < 3) {
        s.estado = "p" + (i + 1);
        acciones.push(preguntar(i + 1));
        break;
      }
      // Fin del triaje: resultado + documento + cierre.
      const fecha = hoyColombia(ctx.ahora);
      const tipo = esUrgente(s.respuestas) ? "tutela" : "peticion";
      const caso = {
        radicado: ctx.radicado ? ctx.radicado(fecha) : "LTS-0000-0000",
        tipo, fecha, telefono: s.numero, nombre: s.datos.nombre, municipio: s.datos.municipio,
        ...s.respuestas, estado: "pendiente_revision_abogado", creado: new Date().toISOString()
      };
      const limite = tipo === "peticion" ? fechaLarga(sumarHabiles(fecha, 15)) : null;
      s.estado = "listo";
      s.ultimoCaso = caso.radicado;
      acciones.push(
        { accion: "texto", cuerpo: tipo === "tutela" ? T.RESULTADO_TUTELA : T.RESULTADO_PETICION },
        { accion: "texto", cuerpo: T.PREPARANDO },
        { accion: "documento", caso },
        { accion: "botones", cuerpo: T.cierre(limite), opciones: T.BOTONES_CIERRE },
        { accion: "registrar_caso", caso }
      );
      break;
    }
    case "listo":
    default:
      acciones.push({ accion: "texto", cuerpo: T.YA_TERMINAMOS });
  }
  return { sesion: s, acciones };
}

module.exports = { manejar, normalizar, elegir, esUrgente };
