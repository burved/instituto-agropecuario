# WhatsApp Cloud API — montar el número gratis de Meta

> Para el sistema de diagnóstico (`SISTEMA-DIAGNOSTICO-SUELOS.md`). Esto lo hace
> **Eduard** (toca credenciales de Meta — el agente no las maneja).
>
> Meta cambia los nombres de los menús cada tanto. Si un botón no se llama
> exactamente así, busca el equivalente: la secuencia es la misma.
> Referencia oficial: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started

Al terminar tendrás 5 datos para el servicio:
`WA_PHONE_ID`, `WA_TOKEN`, `WA_VERIFY_TOKEN`, `WA_APP_SECRET`, y el **número** (para `config.js`).

---

## 1. Cuentas base

1. Una cuenta de **Facebook** normal (personal; sirve la que ya tengas).
2. Un **Meta Business Portfolio** en https://business.facebook.com → crear uno
   ("Instituto Agropecuario"). Anota el **Business Portfolio ID**.

## 2. Crear la App

1. Entra a https://developers.facebook.com/apps → **Crear app**.
2. Caso de uso: **"Otro"** → tipo **"Empresa / Business"**.
3. Nombre: `ferticafe`. Vincúlala al Business Portfolio del paso 1.
4. Dentro de la app: **Agregar producto → WhatsApp → Configurar**.

## 3. Número de prueba (gratis)

Al configurar WhatsApp, Meta crea solo:
- una **WhatsApp Business Account** de prueba,
- un **número de prueba** (Meta te lo regala) con su **Phone number ID**.

En la página **WhatsApp → Configuración de la API** (API Setup):
- Copia el **"Identificador del número de teléfono" / Phone number ID** → es `WA_PHONE_ID`.
- Copia también el **"Identificador de la cuenta de WhatsApp Business" / WABA ID** (lo pide alguna plantilla).
- El **número** que aparece arriba (formato `+1 555 ...`): ese es el que va en `config.js`
  como `cafe_wa_diagnostico`, **solo dígitos, sin `+` ni espacios**.

### Destinatarios de prueba
El número de prueba solo puede escribirle a números que registres a mano.
En la misma página, sección **"Para" / "To"** → agrega tu WhatsApp personal y el de
2–3 personas de confianza (máx. 5). Cada uno confirma con un código.

## 4. Token temporal (para probar ya)

En "API Setup" hay un **token de acceso temporal (24 h)**. Úsalo para las primeras
pruebas: pégalo como `WA_TOKEN` en el `.env` local. Caduca en 24 h — para producción,
paso 5.

## 5. Token permanente (System User)

1. https://business.facebook.com/settings → **Usuarios → Usuarios del sistema** → **Agregar**.
   - Nombre: `ferticafe-bot`, rol: **Administrador**.
2. Con ese usuario seleccionado → **Agregar activos** → pestaña **Apps** → marca la app
   `ferticafe` → permiso **Control total**.
3. **Generar nuevo token** → app `ferticafe` → **caducidad: Nunca** → permisos:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
4. Copia el token que aparece (no se vuelve a mostrar). Ese es el `WA_TOKEN` de producción.

## 6. App Secret y Verify Token

- **`WA_APP_SECRET`:** https://developers.facebook.com/apps → tu app → **Configuración →
  Básica** → "Clave secreta de la app" → Mostrar. Sirve para que el servicio verifique
  que el webhook viene de verdad de Meta.
- **`WA_VERIFY_TOKEN`:** te lo inventas tú. Una frase larga sin espacios, ej.
  `ferticafe-webhook-8f3k2m9x`. La misma cadena va en el `.env` del servicio y en el
  paso 8.

## 7. Conectar el webhook

> Hazlo **después** de desplegar el servicio (`DESPLIEGUE-SERVICIO.md`), cuando ya
> tengas la URL pública, ej. `https://ferticafe-service.onrender.com`.

1. Tu app → **WhatsApp → Configuración** → sección **Webhook** → **Editar**.
2. **URL de devolución de llamada:** `https://<tu-URL>/webhook`
3. **Token de verificación:** el `WA_VERIFY_TOKEN` del paso 6.
4. **Verificar y guardar.** (Meta hace un GET a `/webhook`; el servicio responde el reto.
   Si falla: revisa que la URL sea https y que el servicio esté despierto — abre
   `https://<tu-URL>/health` en el navegador primero.)
5. En **Campos del webhook** → **Suscribirse** a **`messages`**. (Los demás no hacen falta.)

## 8. Plantilla para entregas fuera de 24 h (opcional pero recomendable)

Si un diagnóstico se demora más de 24 h (un Nivel 3 complicado), ya no se puede
responder gratis con texto libre: hay que usar una **plantilla aprobada**.

1. https://business.facebook.com/wa/manage/message-templates → **Crear plantilla**.
2. Categoría: **Utilidad (Utility)**. Idioma: **Español**. Nombre: `diagnostico_listo`.
3. Cuerpo:
   `Hola {{1}}, tu diagnostico de fertilizacion FertiCafe ya esta listo. Responde este mensaje y te paso el PDF.`
   Variable de ejemplo `{{1}}` = `Ana`.
4. Enviar a revisión (suele aprobarse en minutos/horas). El servicio ya sabe usarla
   (`wa_client.send_template`).

## 9. Pasar a producción (número real)

El número de prueba no sirve para atender cafeteros de verdad (solo 5 destinatarios).
Cuando quieras abrir:

1. **WhatsApp → Configuración de la API → "Agregar número de teléfono".** Usa un número
   que **no** tenga WhatsApp normal activo (o bórralo de la app WhatsApp primero).
   Verificación por SMS/llamada.
2. **Verificación del negocio:** Business Settings → **Centro de seguridad** →
   verificar el negocio (documento de la empresa / RUT). Puede tardar días.
3. **Acceso avanzado:** developers.facebook.com → tu app → **Revisión de la app →
   Permisos y funciones** → solicitar **Advanced Access** para
   `whatsapp_business_messaging` y `whatsapp_business_management`.
4. Actualiza `WA_PHONE_ID` (el del número nuevo) en Render y `cafe_wa_diagnostico`
   (el número nuevo, solo dígitos) en `config.js`.

Hasta la verificación del negocio hay un límite de ~250 conversaciones nuevas/día,
que para arrancar sobra.

---

## Checklist de datos

| Variable | De dónde sale |
|---|---|
| `WA_PHONE_ID` | WhatsApp → API Setup → "Phone number ID" |
| `WA_TOKEN` | System User → Generar token (caducidad Nunca) — paso 5 |
| `WA_VERIFY_TOKEN` | te lo inventas — paso 6 |
| `WA_APP_SECRET` | App → Configuración → Básica → Clave secreta |
| número para `config.js` | el número de arriba en API Setup, **solo dígitos** |
