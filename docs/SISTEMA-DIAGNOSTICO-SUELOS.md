# Sistema de Diagnóstico de Fertilización (análisis de suelos) — FertiCafé

> Cómo funciona el circuito completo, qué hace cada pieza y cómo se opera día a día.
> Documentos hermanos: `WHATSAPP-CLOUD-API-SETUP.md` (crear el WhatsApp gratis de Meta)
> y `DESPLIEGUE-SERVICIO.md` (poner el servicio en línea). Estado y pendientes en
> `salidas/2026-08-31_sistema-diagnostico-suelos_ESTADO.md`.

---

## 1. Qué hace

El cafetero llena el formulario de `/cafe/`, manda los datos de su lote por WhatsApp,
y recibe **en ese mismo chat** su recomendación de fertilización en PDF + un resumen.
Todo con el número **gratuito** de WhatsApp Cloud API de Meta.

- **Nivel 1 (automático, con costo por defecto):** el formulario genera una
  recomendación general sin análisis de suelo. Desde el 2026-09-14 cuesta
  10.000 COP (`cafe_precio_nivel1_cop` en la landing; el que de verdad cobra
  el bot es `CFG_PRECIO_NIVEL1` en `config.py`, con ese mismo valor **por
  defecto en el código** — no hace falta configurar nada en Render para que
  cobre — ver §5). Para volver al Nivel 1 gratis e instantáneo de antes, hay
  que poner `CFG_PRECIO_NIVEL1` vacío **de forma explícita** en Render.
- **Nivel 2 (automático, con fotos — desde 2026-09-17):** el cafetero manda
  6 fotos de su cafetal (protocolo en
  `salidas/2026-09-03_protocolo-fotos-nivel2_v1.md` del repo `agente-embudos`)
  y un modelo de visión (Claude, vía `ANTHROPIC_API_KEY`) las lee y arma el
  `sintomas` que ya sabía interpretar el motor. Sin gate de revisión humana:
  el diagnóstico siempre se entrega; si el modelo ve algo fuera de lo
  nutricional (daño de tronco, plaga fuerte), se agrega como nota informativa
  en el mensaje, no como bloqueo. Ver §2 y §5.
- **Nivel 3 (automático, análisis de suelo + fotos — desde 2026-09-17):** si el
  cafetero manda su análisis de laboratorio (foto o texto) y contesta que quiere
  Nivel 3, el bot también le pide las 6 fotos del cafetal. Un modelo de visión
  (Claude) lee el informe de suelo (extrae pH, Al, Ca, Mg, K, P, S, B, Zn, Cu,
  Mn, MO, textura — nunca inventa un valor que no vea) y otra llamada lee las
  fotos (igual que Nivel 2): el motor combina ambos en un solo diagnóstico —
  fertilización ajustada al suelo real **y** revisión de plagas/enfermedades.
  Sin revisión humana de los números antes de entregar (decisión de Eduard
  2026-09-17): si algo no se pudo leer bien, va como nota informativa en el
  mensaje, nunca bloquea. `operador.py` sigue disponible como plan B manual
  (ver §6) si Eduard prefiere teclear el análisis él mismo.

---

## 2. El circuito

```
(1) Cafetero llena el formulario en  /cafe/
        │  funnel.js guarda el lead y (si hay endpoint) hace POST /registro
        ▼
(2) Página /cafe/gracias/  ->  botón "ENVIAR MIS DATOS POR WHATSAPP"
        │  abre wa.me/<numero>?text=  con un bloque "#DIAG" ya escrito
        ▼
(3) El cafetero le da ENVIAR  ->  el mensaje llega al número Cloud API de Meta
        │  Meta llama al webhook del servicio:  POST /webhook
        ▼
(4) ferticafe-service (Render)
        ├─ parsea el bloque #DIAG
        └─ por defecto (CFG_PRECIO_NIVEL1 = "10.000 COP" en el codigo):
              guarda los datos del lote (no corre el motor todavia)
              responde por WhatsApp pidiendo el pago, estado = pendiente_nivel1
           si CFG_PRECIO_NIVEL1 se deja vacio EXPLICITAMENTE en Render:
              intake_adapter -> motor FertiCafé (Nivel 1) -> genera el PDF
              responde por WhatsApp:  acuse + PDF + resumen
        ▼
(5) El cafetero recibe su diagnóstico en el chat  (dentro de la ventana de servicio
    de 24 h, sin costo de WhatsApp para nosotros -- el costo del diagnóstico en si
    es aparte, ver §1 y §5)
```

Por defecto (sin tocar nada en Render) el PDF no se genera hasta que Eduard confirma
el pago con el botón de `/leads.html` (o llamando `POST /leads/nivel1-confirmar-pago`) —
en ese momento se usan los datos del lote que el cafetero ya mandó, sin pedírselos de
nuevo. Ver §5.

**Nivel 2 por el botón de fotos** (`#FOTOS`, el otro botón de `/cafe/gracias/` o de
la landing): el circuito es igual al de `#DIAG` hasta el paso (4), pero en vez de
generar el PDF de una vez, el bot pide el pago si `CFG_PRECIO_NIVEL2` está
configurado y luego pide las **6 fotos obligatorias, una por una** (ver protocolo).
Cuando llegan las 6:

```
servicio (background task)
   ├─ descarga cada foto de WhatsApp (Graph API)
   ├─ vision_client.evaluar_fotos()  ->  llama a Claude con las 6-8 fotos
   ├─ vision_adapter.parsear_resultado_vision()  ->  JSON
   ├─ ¿alguna foto obligatoria no usable?
   │     sí -> pide repetir SOLO esa foto, vuelve a esperar
   │     no -> vision_adapter.vision_a_ferticafe()  ->  motor (Nivel 2)  ->  PDF
   └─ entrega PDF + resumen (con notas informativas si hubo señales sanitarias)
```

**Nivel 3 por foto/texto de análisis suelto** (desde 2026-09-17, automático): si el
cafetero manda una foto o un texto con datos de análisis SIN haber tocado el botón
`#FOTOS`, el servicio guarda ese contenido como candidato (`store.guardar_informe_suelo`)
y pregunta si es Nivel 2 o Nivel 3 (con los dos precios), marcando el lead como
`pendiente_nivel3` (nombre interno del estado; cubre ambos niveles hasta que el
cafetero conteste cuál es):

- Si contesta **"2"** (o "fotos", "nivel 2"): se descarta el informe guardado y
  arranca el circuito de Nivel 2 de arriba (pago si aplica, luego las 6 fotos).
- Si contesta **"3"** (o "análisis", "laboratorio", "nivel 3"): pide el pago si
  `CFG_PRECIO_NIVEL3` está configurado, y luego pide las 6 fotos del cafetal —
  **sin volver a pedir el análisis**, ya lo tiene guardado. Con las 6 fotos:

```
servicio (background task)
   ├─ vision_client.evaluar_fotos()       -> sintomas del cafetal (igual que Nivel 2)
   ├─ analisis_client.evaluar_informe()   -> llama a Claude con la foto/texto del analisis
   ├─ analisis_adapter.parsear_resultado_analisis()  -> JSON (valores + confianza)
   ├─ vision_adapter.vision_a_ferticafe(..., servicio="nivel_3")  -> caso + sintomas
   ├─ caso["analisis_suelo"] = analisis_adapter.analisis_suelo_desde_resultado(...)
   └─ motor (Nivel 3, con analisis_suelo Y sintomas) -> PDF + resumen
      (notas informativas si hubo valores no legibles, confianza baja, o
       señales sanitarias en las fotos -- nunca bloquea la entrega)
```

`operador.py` sigue disponible sin cambios como plan B 100% manual (ver §6), para
cuando Eduard prefiera teclear el análisis él mismo en vez de que lo lea el modelo.

---

## 3. Las piezas y dónde viven

| Pieza | Carpeta | Qué es |
|---|---|---|
| Formulario + páginas | `instituto-agropecuario/public/cafe/` | HTML estático (Cloudflare Pages) |
| Lógica del embudo | `instituto-agropecuario/public/assets/funnel.js` | arma el enlace `wa.me` con el `#DIAG` |
| Config editable | `instituto-agropecuario/public/assets/config.js` | `cafe_wa_diagnostico`, `cafe_url_endpoint_diagnostico` |
| Motor técnico | `proyectos/ferticafe-motor/ferticafe_engine.py` | calcula la recomendación (no se toca sin Eduard) |
| Adaptador | `proyectos/ferticafe-motor/intake_adapter.py` | traduce los campos del formulario al motor; calcula el área del lote (hectáreas exactas, o matas × distancia de siembra si el cafetero no las sabe) |
| Parser | `proyectos/ferticafe-motor/parser_diag.py` | extrae los bloques `#DIAG` y `#FOTOS` del mensaje |
| Adaptador de fotos | `proyectos/ferticafe-motor/vision_adapter.py` | prompt del modelo de visión + traduce su JSON a `sintomas` del motor (Nivel 2 y 3) |
| Adaptador de análisis | `proyectos/ferticafe-motor/analisis_adapter.py` | prompt del modelo de visión para leer el informe de suelo + traduce su JSON a `analisis_suelo` del motor (Nivel 3) |
| Textos WhatsApp | `proyectos/ferticafe-motor/mensajes.py` + `plantillas_mensajes.md` | acuse, entrega, pedido de fotos, pedido de pago por nivel, etc. |
| Operador manual | `proyectos/ferticafe-motor/operador.py` | plan B 100% manual, sin depender del servicio ni de Claude |
| Servicio | `proyectos/ferticafe-service/` | webhook + captura de leads (FastAPI, Render) |
| Cliente de visión (fotos) | `proyectos/ferticafe-service/vision_client.py` | llama a la API de Claude con las fotos del cafetal (Nivel 2 y 3) |
| Cliente de análisis | `proyectos/ferticafe-service/analisis_client.py` | llama a la API de Claude con la foto/texto del informe de suelo (Nivel 3) |

---

## 4. Puesta en marcha (una sola vez)

1. **WhatsApp Cloud API** — seguir `WHATSAPP-CLOUD-API-SETUP.md`. Al final tienes:
   `WA_TOKEN`, `WA_PHONE_ID`, `WA_VERIFY_TOKEN` (te lo inventas), `WA_APP_SECRET`,
   y el **número** que Meta te asigna.
2. **Desplegar el servicio** — seguir `DESPLIEGUE-SERVICIO.md` (Render, plan free).
   Cargar ahí las variables del punto 1. Al final tienes una URL tipo
   `https://ferticafe-service.onrender.com`.
3. **Conectar el webhook** — en Meta, Callback URL = `<URL>/webhook`, Verify Token =
   el `WA_VERIFY_TOKEN`, suscribir el evento `messages`.
4. **Editar `config.js`:**
   - `cafe_wa_diagnostico`: el número de Meta, **solo dígitos** (ej. `"573001234567"`).
   - `cafe_url_endpoint_diagnostico`: la URL del servicio, **sin barra final**.
4.b. **Nivel 2 y 3 (fotos / análisis):** crear una clave en console.anthropic.com y
   cargarla como `ANTHROPIC_API_KEY` en Render. Sin esto, el Nivel 1 sigue
   funcionando normal; solo los flujos con fotos (Nivel 2 y 3) no pueden
   evaluarlas (ver §5).
5. **Publicar** `public/` en Cloudflare Pages.
6. **Prueba real:** desde un WhatsApp que hayas registrado como destinatario de prueba
   en Meta, entra a `/cafe/`, llena el formulario, manda el `#DIAG`. Debe llegar el PDF
   en 1–2 min (la primera del día puede tardar ~1 min más por el "cold start" de Render).

Mientras no esté todo esto: el botón de WhatsApp de `/cafe/gracias/` sale como
"CONFIGURA EL ENLACE" (amarillo) y no rompe nada. Se puede operar 100% manual con
`operador.py` + WhatsApp Business App (ver §6).

---

## 5. Operación diaria (con el servicio en línea)

- **Nivel 1 gratis** (solo si pusiste `CFG_PRECIO_NIVEL1` vacío a propósito en
  Render): no hay que hacer nada. Llega solo.
- **Nivel 1 con cobro (`pendiente_nivel1`) — comportamiento por defecto:** el cafetero
  mandó su `#DIAG` y el bot ya le respondió pidiendo el pago (mensaje
  `pedido_pago_nivel1`, con el precio y los datos de `CFG_DATOS_PAGO`).
  1. **Cobro manual, en el mismo chat de WhatsApp:** confirmas el pago (Nequi,
     Bancolombia, transferencia) antes de entregar. No hay checkout automático.
  2. Entra a `https://<URL>/leads.html?token=<ADMIN_TOKEN>` y busca ese teléfono
     en estado `pendiente_nivel1`.
  3. Clic en **"Confirmar pago y enviar"**. El servicio recupera los datos del lote
     que el cafetero ya mandó (no hay que volver a pedírselos), genera el PDF y lo
     entrega solo, igual que el Nivel 1 automático.
  4. Si prefieres no usar el botón, el mismo resultado se logra con
     `POST /leads/nivel1-confirmar-pago?token=<ADMIN_TOKEN>` y body
     `{"telefono": "57..."}`.
- **Revisar leads:** `https://<URL>/leads.html?token=<ADMIN_TOKEN>` — lista de quién
  pidió diagnóstico, estado (`entregado`, `pendiente_nivel1`, `pendiente_nivel3`,
  `procesando`...).
- **Nivel 3 automático, análisis + fotos (`pendiente_nivel3` → `pendiente_nivel3_pago`
  → `nivel3_recibiendo_fotos` → `nivel3_procesando`) — desde 2026-09-17:** el cafetero
  mandó foto o texto de su análisis (sin tocar el botón `#FOTOS`).
  1. El servicio le respondió preguntando Nivel 2 o Nivel 3 (mensaje `recibido_analisis`,
     con los dos precios) y guardó ese análisis como candidato
     (`informe_suelo_json` en el lead — no se le pide de nuevo).
  2. Si contesta **"3"**: si `CFG_PRECIO_NIVEL3` está configurado, el lead queda en
     `pendiente_nivel3_pago` hasta que confirmes el pago en `/leads.html` (botón
     **"Confirmar pago y pedir fotos"**) o con
     `POST /leads/nivel3-confirmar-pago?token=<ADMIN_TOKEN>` + `{"telefono": "57..."}`.
     Sin precio configurado, arranca directo.
  3. El bot pide las 6 fotos del cafetal una por una (`nivel3_recibiendo_fotos`), igual
     que Nivel 2 — si alguna sale mal, pide repetir solo esa.
  4. Con las 6 fotos usables, el servicio llama a Claude dos veces: una para las fotos
     (síntomas/plagas) y otra para leer el análisis de suelo guardado (foto o texto,
     extrae pH/Al/Ca/Mg/K/P/S/B/Zn/Cu/Mn/MO/textura). Combina ambos y entrega
     (`entregado`, `nivel=3`) — igual de automático que Nivel 1 y 2.
  5. Requiere `ANTHROPIC_API_KEY` (ver Nivel 2 más abajo). Si el modelo no pudo leer
     algún valor del análisis, o tuvo poca confianza, lo avisa como nota en el mensaje
     de entrega — nunca bloquea.
  6. **Plan B manual** (si prefieres no depender de Claude, o para el primer cliente
     mientras configuras `ANTHROPIC_API_KEY`): copiar del chat los datos del análisis,
     armar un `lead.json` con `"servicio": "nivel_3"` y `"analisis_suelo": { ... }`
     (plantilla en `ferticafe-motor/examples/lead_nivel3_demo.json`), y
     `cd proyectos/ferticafe-motor && python operador.py --lead lead.json --pdf --registrar-url https://<tu-servicio>.onrender.com --registrar-token <ADMIN_TOKEN>`
     — el `--registrar-url`/`--registrar-token` son opcionales pero recomendados: sin
     ellos, este cliente (que sí pagó) no queda en `/leads.html` ni entra al
     recordatorio de próxima aplicación. Mandar el PDF de `out/` y pegar el mensaje que
     imprime la consola, en el chat del cafetero.
- **Si algo falla:** el servicio le avisa al cafetero "tuvimos un problema, ya quedó
  anotado" y el lead queda marcado `estado="error"` (con la nota del error) en
  `/leads.html` — no se queda invisible en `"procesando"`. Revisar los logs en Render
  y reprocesar con `operador.py`.
- **Recordatorio de próxima aplicación:** ver `DESPLIEGUE-SERVICIO.md` §"Recordatorio
  de próxima aplicación" — requiere una plantilla de Meta aprobada y un cron externo.
- **Nivel 2 con fotos (`nivel2_recibiendo_fotos` / `nivel2_procesando`):** el cafetero
  entró por el botón `#FOTOS`.
  1. Si `CFG_PRECIO_NIVEL2` está configurado, el lead queda en `pendiente_nivel2_pago`
     hasta que confirmes el pago en `/leads.html` (botón **"Confirmar pago y pedir
     fotos"**) o con `POST /leads/nivel2-confirmar-pago?token=<ADMIN_TOKEN>` +
     `{"telefono": "57..."}`. Ahí arranca el pedido de fotos, no la entrega directa.
  2. El bot pide las 6 fotos una por una (`nivel2_recibiendo_fotos`). Si alguna sale
     mal, el modelo la rechaza y el bot pide repetir solo esa — no hace falta que
     intervengas.
  3. Con las 6 usables, el servicio llama a Claude, arma el diagnóstico y lo entrega
     solo (`entregado`, `nivel=2`) — igual de automático que el Nivel 1.
  4. Requiere `ANTHROPIC_API_KEY` configurada en Render (misma clave que usa el
     Nivel 3); sin ella, `/health` marca `puede_evaluar_fotos_nivel2: false` y el
     paso 3 falla (el lead queda en `error`, visible en `/leads.html`, y hay que
     procesarlo a mano con `operador.py` mientras se configura la clave).

---

## 6. Plan B / fallback manual (sin servicio)

Sirve el primer día, o si Render está caído.

1. Tener **WhatsApp Business App** (gratis) en el celular con el número de contacto.
2. En `config.js`, `cafe_wa_diagnostico` = ese número (el cafetero te escribe el `#DIAG`
   directo a tu WhatsApp normal).
3. Cuando llegue un `#DIAG`:
   - copiar el mensaje a un archivo `mensaje.txt` (o usar `--pega`),
   - `cd proyectos/ferticafe-motor && python operador.py --mensaje mensaje.txt --pdf`,
   - mandar el PDF de `out/` + pegar el mensaje que imprime.
4. Los leads NO quedan en `/leads` (no hay servicio) pero sí en el chat.

`operador.py` necesita `pip install -r proyectos/ferticafe-motor/requirements.txt` una vez.

---

## 7. Costos y límites

- **WhatsApp:** las conversaciones que **inicia el cliente** (nos escribe) y las respuestas
  dentro de las **24 h** siguientes son **gratis**. Solo se paga si nosotros iniciamos la
  conversación fuera de esa ventana (plantilla). El sistema está diseñado para responder
  siempre dentro de la ventana.
- **Número de prueba de Meta:** gratis, pero solo escribe a hasta 5 números que registres
  a mano. Para atender a cualquiera hay que añadir un número real + verificación de negocio
  (ver `WHATSAPP-CLOUD-API-SETUP.md` §7).
- **Render free:** el servicio se duerme tras 15 min; Meta reintenta el webhook, así que
  no se pierden mensajes, solo llegan con algo de retraso la primera vez del día.
  `leads.db` se borra en cada redeploy (el chat es el registro real).

---

## 8. Privacidad

El motor no guarda historial técnico. El servicio guarda lo mínimo para operar
(nombre, teléfono, campos del formulario, estado) en `leads.db`. El PDF **no** se
almacena. Coherente con `aviso_privacidad` del motor y con `/legal/privacidad.html`.
