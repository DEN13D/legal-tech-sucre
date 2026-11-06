# Chatbot de WhatsApp · Legal Tech Sucre

Chatbot de prueba para el TRL 4: hace el registro con autorización de datos, el triaje de 4 preguntas y envía por WhatsApp el borrador en PDF del derecho de petición (o de la tutela, si el caso es urgente). Usa el **número de prueba de Meta** y **no hace cobros**.

> El asistente orienta y un abogado titulado revisa todo documento. Las preguntas y las plantillas están pendientes de su revisión.

## Cómo funciona la conversación

1. La persona escribe cualquier cosa (por ejemplo «hola»).
2. Bienvenida y **autorización de datos** (Ley 1581 de 2012) con botones *Sí, autorizo* / *No autorizo*.
3. Nombre completo y municipio (o vereda).
4. **Triaje de 4 preguntas** con listas y botones. También acepta el número de la opción o el texto escrito.
5. Resultado: derecho de petición o tutela. Regla: riesgo = Sí y además (negación, EPS o Unidad de Víctimas) → tutela.
6. Envía el **PDF del borrador** con el radicado interno `LTS-AAMM-NNNN`, y la fecha límite de respuesta (15 días hábiles, contando festivos de Colombia).
7. Botones finales: *Hablar con asesor* y *Nuevo caso*.

Palabras que funcionan en cualquier momento: **HOLA** o **NUEVO** (empezar otra vez), **ASESOR** (pasar a una persona), **URGENTE**.
Si la persona manda un audio, el bot le pide tocar una opción o escribir **ASESOR**. Si se cae la señal, la conversación queda guardada y sigue donde iba.

## Archivos

| Archivo | Qué hace |
| --- | --- |
| `src/server.js` | Servidor Express: webhook de Meta, verificación de firma, cola de mensajes por persona, rutas `/casos` |
| `src/flujo.js` | Máquina de estados de la conversación (no se conecta a Meta, por eso se puede probar) |
| `src/textos.js` | Todos los mensajes y las 4 preguntas. **Aquí se editan los textos** |
| `src/pdf.js` | Plantillas del derecho de petición y la tutela en PDF (pdfkit) |
| `src/plazos.js` | Días hábiles y festivos de Colombia 2026–2027 |
| `src/whatsapp.js` | Envío de textos, botones, listas y documentos con la API de WhatsApp Cloud |
| `src/store.js` | Guarda sesiones y casos en archivos JSON |
| `test/simular.js` | Simulador: 3 conversaciones completas sin conectarse a Meta |

## Probarlo en su computador (sin Meta)

Necesita Node.js 18 o más reciente.

```bash
cd chatbot
npm install
npm run simular
```

Muestra la conversación en la terminal y deja los PDF en la carpeta `out/`.

## Ponerlo a funcionar con WhatsApp

### 1. Crear la app en Meta (gratis)

1. Entre a [developers.facebook.com](https://developers.facebook.com) con una cuenta de Facebook y regístrese como desarrollador.
2. **Mis apps → Crear app**. Elija el caso de uso de **WhatsApp** (conectar con clientes por WhatsApp) y siga los pasos. Meta crea o le pide una cuenta comercial (Business).
3. En el panel de la app, vaya a **WhatsApp → Configuración de la API**. Ahí encuentra:
   - el **número de prueba** que Meta le regala,
   - el **identificador del número de teléfono** (`PHONE_NUMBER_ID`),
   - un **token de acceso temporal** (`WHATSAPP_TOKEN`, dura 24 horas).
4. En **Para**, agregue los celulares que van a probar (máximo 5). A cada uno le llega un código para confirmarlo.
5. En **Configuración de la app → Básica**, copie la **clave secreta de la app** (`APP_SECRET`).

### 2. Publicar el servidor en Render (gratis)

1. Entre a [render.com](https://render.com) con su cuenta de GitHub.
2. **New → Web Service** y elija el repositorio `DEN13D/legal-tech-sucre`.
3. Configure:
   - **Root Directory:** `chatbot`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
4. En **Environment**, agregue las variables de `.env.example`: `WHATSAPP_TOKEN`, `PHONE_NUMBER_ID`, `VERIFY_TOKEN` (una palabra que usted inventa), `APP_SECRET` y `ADMIN_KEY`.
5. Cree el servicio. Cuando termine, Render le da una dirección como `https://legal-tech-sucre-chatbot.onrender.com`. Ábrala: debe decir «Chatbot de Legal Tech Sucre activo».

### 3. Conectar Meta con el servidor

1. En Meta, **WhatsApp → Configuración**, en **Webhook** toque **Editar**.
2. **URL de devolución de llamada:** `https://SU-DIRECCION.onrender.com/webhook`
3. **Token de verificación:** la misma palabra que puso en `VERIFY_TOKEN`.
4. **Verificar y guardar**. Luego, en **Campos del webhook**, suscríbase a **messages**.
5. Desde uno de los celulares agregados, escriba **hola** al número de prueba.

### Ver los casos (para el abogado)

- Lista de casos: `https://SU-DIRECCION.onrender.com/casos?clave=SU_ADMIN_KEY`
- PDF de un caso: `https://SU-DIRECCION.onrender.com/casos/LTS-2611-0001.pdf?clave=SU_ADMIN_KEY`

## Cosas a tener en cuenta

- **El token temporal vence a las 24 horas.** Para pruebas de varios días, cree un *usuario del sistema* en la configuración del negocio de Meta y genere un token con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`.
- **Render gratis se duerme** después de 15 minutos sin uso. El primer mensaje puede tardar hasta un minuto en responder; los siguientes son inmediatos.
- **Los datos se borran** cuando Render reinicia el servicio. Para la prueba interna está bien. En la Parte 2 se usa una base de datos con los datos sensibles cifrados.
- El número **+57 310 485 0697** se conecta después, en producción. Un número conectado a la API ya no se puede usar en la aplicación normal de WhatsApp.
- El bot solo responde a quien le escribe primero, así que no necesita plantillas aprobadas por Meta.

## Pendientes

- [ ] El abogado titulado valida las 4 preguntas (`src/textos.js`) y las plantillas (`src/pdf.js`)
- [ ] Prueba interna con al menos 5 personas del equipo y registro de resultados (evidencia para el TRL 4)
- [ ] Entender notas de voz (transcripción) — mejora del prototipo final
- [ ] Alertas automáticas de plazos — Parte 2
