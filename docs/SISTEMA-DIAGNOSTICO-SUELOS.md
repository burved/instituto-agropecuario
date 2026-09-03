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

- **Nivel 1 (siempre, automático, gratis):** el formulario genera una recomendación
  general sin análisis de suelo.
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
        ├─ intake_adapter -> motor FertiCafé (Nivel 1) -> genera el PDF
        └─ responde por WhatsApp:  acuse + PDF + resumen
        ▼
(5) El cafetero recibe su diagnóstico en el chat  (gratis: ventana de servicio de 24 h)
```

Si el cafetero manda una **foto** o un texto con datos de análisis, el servicio
responde "lo revisa un técnico" y marca el lead como `pendiente_nivel3` para que
Eduard lo procese con `operador.py`.

---

## 3. Las piezas y dónde viven

| Pieza | Carpeta | Qué es |
|---|---|---|
| Formulario + páginas | `instituto-agropecuario/public/cafe/` | HTML estático (Cloudflare Pages) |
| Lógica del embudo | `instituto-agropecuario/public/assets/funnel.js` | arma el enlace `wa.me` con el `#DIAG` |
| Config editable | `instituto-agropecuario/public/assets/config.js` | `cafe_wa_diagnostico`, `cafe_url_endpoint_diagnostico` |
| Motor técnico | `proyectos/ferticafe-motor/ferticafe_engine.py` | calcula la recomendación (no se toca sin Eduard) |
| Adaptador | `proyectos/ferticafe-motor/intake_adapter.py` | traduce los campos del formulario al motor |
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

- **Nivel 1:** no hay que hacer nada. Llega solo.
- **Revisar leads:** `https://<URL>/leads.html?token=<ADMIN_TOKEN>` — lista de quién
  pidió diagnóstico, estado (`entregado`, `pendiente_nivel3`, `procesando`...).
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
