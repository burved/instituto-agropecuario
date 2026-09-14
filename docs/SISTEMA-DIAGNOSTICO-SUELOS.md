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
- **Nivel 3 (manual, si el cafetero lo pide):** si además manda su análisis de suelo
  (foto o números) por WhatsApp, Eduard lo procesa a mano con `operador.py` y devuelve
  una versión ajustada. Este nivel puede tener costo (`cafe_precio_nivel3_cop`).

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

Si el cafetero manda una **foto** o un texto con datos de análisis, el servicio
le pregunta si es Nivel 2 (fotos del cafetal, sin análisis de laboratorio) o
Nivel 3 (análisis de suelo real), con los dos precios, y marca el lead como
`pendiente_nivel3` (nombre interno del estado; cubre ambos niveles hasta que el
cafetero conteste cuál es) para que Eduard lo revise y procese con `operador.py`.

---

## 3. Las piezas y dónde viven

| Pieza | Carpeta | Qué es |
|---|---|---|
| Formulario + páginas | `instituto-agropecuario/public/cafe/` | HTML estático (Cloudflare Pages) |
| Lógica del embudo | `instituto-agropecuario/public/assets/funnel.js` | arma el enlace `wa.me` con el `#DIAG` |
| Config editable | `instituto-agropecuario/public/assets/config.js` | `cafe_wa_diagnostico`, `cafe_url_endpoint_diagnostico` |
| Motor técnico | `proyectos/ferticafe-motor/ferticafe_engine.py` | calcula la recomendación (no se toca sin Eduard) |
| Adaptador | `proyectos/ferticafe-motor/intake_adapter.py` | traduce los campos del formulario al motor; calcula el área del lote (hectáreas exactas, o matas × distancia de siembra si el cafetero no las sabe) |
| Parser | `proyectos/ferticafe-motor/parser_diag.py` | extrae el bloque `#DIAG` del mensaje |
| Textos WhatsApp | `proyectos/ferticafe-motor/mensajes.py` + `plantillas_mensajes.md` | acuse, entrega, etc. |
| Operador manual | `proyectos/ferticafe-motor/operador.py` | fallback y Nivel 3 |
| Servicio | `proyectos/ferticafe-service/` | webhook + captura de leads (FastAPI, Render) |

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
- **Nivel 3 (`pendiente_nivel3`):** el cafetero mandó foto o texto de su análisis.
  1. El servicio ya le respondió solo pidiendo el pago (mensaje `recibido_analisis`,
     con el precio y los datos de pago de `CFG_PRECIO_NIVEL3` / `CFG_DATOS_PAGO` si
     están configurados; si no, le avisa que le escribes tú con el valor).
  2. **Cobro manual, en el mismo chat de WhatsApp:** confirmas el pago (Nequi,
     Daviplata, transferencia — lo que uses) antes de procesar. No hay checkout
     automático para el Nivel 3, a diferencia de la Cohorte.
  3. Con el pago confirmado, copiar del chat los datos del análisis (pH, Al, Ca, Mg,
     K, P, S, B, Zn, Cu, Mn, textura).
  4. Armar un `lead.json` con los campos del formulario **+** `"servicio": "nivel_3"` y
     `"analisis_suelo": { ... }`. Plantilla en `ferticafe-motor/examples/lead_nivel3_demo.json`.
  5. `cd proyectos/ferticafe-motor && python operador.py --lead lead.json --pdf --registrar-url https://<tu-servicio>.onrender.com --registrar-token <ADMIN_TOKEN>`
     — el `--registrar-url`/`--registrar-token` son opcionales pero recomendados: sin
     ellos, este cliente (que sí pagó) no queda en `/leads.html` ni entra al
     recordatorio de próxima aplicación — solo el Nivel 1 automático queda registrado.
  6. Mandar el PDF de `out/` y pegar el mensaje que imprime la consola, en el chat del cafetero.
- **Si algo falla:** el servicio le avisa al cafetero "tuvimos un problema, ya quedó
  anotado" y el lead queda marcado `estado="error"` (con la nota del error) en
  `/leads.html` — no se queda invisible en `"procesando"`. Revisar los logs en Render
  y reprocesar con `operador.py`.
- **Recordatorio de próxima aplicación:** ver `DESPLIEGUE-SERVICIO.md` §"Recordatorio
  de próxima aplicación" — requiere una plantilla de Meta aprobada y un cron externo.

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
