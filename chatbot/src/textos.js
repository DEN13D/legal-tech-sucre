// Todos los textos que ve la persona y las opciones del triaje.
// Límites de WhatsApp: botón (reply) máx. 20 caracteres, máx. 3 botones;
// fila de lista máx. 24 caracteres de título y 72 de descripción, máx. 10 filas.

const PAGINA = process.env.PAGINA_URL || "https://den13d.github.io/legal-tech-sucre/";

const AVISO = "El asistente orienta y un abogado titulado revisa tus documentos.";

const BIENVENIDA =
  "¡Hola! Soy el asistente de *Legal Tech Sucre* 👋\n\n" +
  "Te ayudo a reclamar ante la alcaldía, la EPS, la Unidad de Víctimas y otras entidades. " +
  "Te hago 4 preguntas y te preparo la carta para reclamar.\n\n" +
  "_" + AVISO + "_";

const PERMISO =
  "Antes de empezar necesito tu permiso para usar tus datos (Ley 1581 de 2012).\n\n" +
  "Guardamos tu nombre, tu número, tu municipio y lo que nos cuentes de tu caso, " +
  "solo para orientarte, preparar tus documentos y avisarte de los plazos. " +
  "Puedes pedir que los corrijamos o los borremos cuando quieras.\n\n" +
  "Política completa: " + PAGINA + "#legales\n\n" +
  "¿Nos das tu permiso?";

const SIN_PERMISO =
  "Entendido. Sin tu permiso no podemos guardar tus datos ni preparar documentos.\n\n" +
  "Si cambias de opinión, escribe *HOLA* y empezamos de nuevo.";

const PEDIR_NOMBRE = "Gracias. ¿Cuál es tu *nombre completo*? Escríbelo como aparece en tu cédula.";
const NOMBRE_CORTO = "No alcancé a entender tu nombre. Escríbelo completo, por favor (nombre y apellido).";

const PEDIR_MUNICIPIO =
  "¿En qué *municipio* vives? Si vives en un corregimiento o vereda, escríbelo también.\n" +
  "Ejemplo: _Sampués, vereda La Gallera_";
const MUNICIPIO_CORTO = "Escríbeme el nombre de tu municipio, por favor. Ejemplo: _Corozal_";

// Las 4 preguntas del triaje. Pendiente: validarlas con el abogado titulado.
const PREGUNTAS = [
  {
    clave: "entidad",
    tipo: "lista",
    texto: "*Pregunta 1 de 4*\n¿Con qué entidad tienes el problema?",
    boton: "Ver entidades",
    opciones: [
      { id: "alcaldia", titulo: "Alcaldía", desc: "Alcaldía municipal o sus oficinas" },
      { id: "eps", titulo: "EPS o salud", desc: "EPS, hospital, puesto de salud" },
      { id: "victimas", titulo: "Unidad de Víctimas", desc: "Ayuda humanitaria, reparación, registro" },
      { id: "otra", titulo: "Otra entidad", desc: "Sisbén, servicios públicos, otra" }
    ]
  },
  {
    clave: "hecho",
    tipo: "lista",
    texto: "*Pregunta 2 de 4*\n¿Qué te pasó?",
    boton: "Ver opciones",
    opciones: [
      { id: "no_responden", titulo: "No me responden", desc: "Pedí algo y no me han contestado" },
      { id: "negaron", titulo: "Me negaron algo", desc: "Un medicamento, una cita, una ayuda" },
      { id: "cobran", titulo: "Me cobran mal", desc: "Un cobro que no es correcto" },
      { id: "otra_cosa", titulo: "Otra cosa", desc: "Otro problema con la entidad" }
    ]
  },
  {
    clave: "tiempo",
    tipo: "botones",
    texto: "*Pregunta 3 de 4*\n¿Hace cuánto empezó el problema?",
    opciones: [
      { id: "menos15", titulo: "Menos de 15 días" },
      { id: "mas15", titulo: "Más de 15 días" },
      { id: "mas3m", titulo: "Más de 3 meses" }
    ]
  },
  {
    clave: "riesgo",
    tipo: "botones",
    texto: "*Pregunta 4 de 4*\n¿Esto pone en riesgo tu salud, tu casa o tu comida?",
    opciones: [
      { id: "si", titulo: "Sí" },
      { id: "no", titulo: "No" }
    ]
  }
];

const NO_ENTENDI = "No entendí tu respuesta. Toca una de las opciones o escribe el número de la opción.";
const AUDIO_RECIBIDO =
  "Recibí tu audio 🎧. En esta versión de prueba todavía no entiendo audios, " +
  "así que te pido tocar una opción o escribir. Si prefieres, escribe *ASESOR* y una persona te atiende.";
const ASESOR =
  "Listo. Le avisé a una persona del equipo y te escribirá por este chat en horario de atención " +
  "(lunes a sábado). Si es urgente, escribe *URGENTE*.";
const URGENTE = "Marcamos tu caso como urgente. Un abogado lo revisa primero.";
const REINICIO = "Empecemos de nuevo.";

const RESULTADO_PETICION =
  "✅ *Resultado*\nTe sirve un *derecho de petición*: una carta que obliga a la entidad a responderte. " +
  "La ley le da *15 días hábiles* para contestar.";
const RESULTADO_TUTELA =
  "⚠️ *Resultado*\nTu caso puede ser para una *tutela*, porque está en riesgo algo urgente. " +
  "El juez debe decidir en máximo 10 días. Un abogado titulado revisa tu caso hoy mismo y te dice si procede.";
const PREPARANDO = "Estoy preparando tu borrador, dame unos segundos…";
const PIE_DOCUMENTO = "Borrador para revisión del abogado. Lo resaltado entre [corchetes] lo completamos contigo.";

function cierre(fechaLimite) {
  let t = "Un abogado titulado revisa tu borrador antes de que lo entregues y te escribe por aquí.";
  if (fechaLimite) t += "\n\n📅 Si entregas la carta hoy, la entidad debe responderte a más tardar el *" + fechaLimite + "*. Te avisaremos.";
  t += "\n\nEsta primera orientación fue gratis.";
  return t;
}

const BOTONES_CIERRE = [
  { id: "asesor", titulo: "Hablar con asesor" },
  { id: "reiniciar", titulo: "Nuevo caso" }
];

const YA_TERMINAMOS =
  "Tu borrador ya está en revisión. Escribe *NUEVO* para otro caso o *ASESOR* para hablar con una persona.";

module.exports = {
  PAGINA, AVISO, BIENVENIDA, PERMISO, SIN_PERMISO, PEDIR_NOMBRE, NOMBRE_CORTO, PEDIR_MUNICIPIO,
  MUNICIPIO_CORTO, PREGUNTAS, NO_ENTENDI, AUDIO_RECIBIDO, ASESOR, URGENTE, REINICIO,
  RESULTADO_PETICION, RESULTADO_TUTELA, PREPARANDO, PIE_DOCUMENTO, cierre, BOTONES_CIERRE, YA_TERMINAMOS
};
