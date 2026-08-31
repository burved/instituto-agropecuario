# Desplegar `ferticafe-service` en Render (plan free)

> El servicio vive en `proyectos/ferticafe-service/` del repo `agente-embudos`.
> Recibe el webhook de WhatsApp y la captura de leads del formulario.
> Lo hace **Eduard** (crea la cuenta de Render y carga los tokens).

---

## 0. Requisito: el código en un repo de Git

Render despliega desde un repositorio (GitHub / GitLab). El servicio y el motor son
carpetas hermanas y el servicio **necesita** al motor (`requirements.txt` instala
`../ferticafe-motor`), así que **ambas van en el mismo repo**.

**Ya está hecho:** la carpeta `agente-embudos/proyectos/` es un repo de Git
(inicializado el 2026-08-31) que contiene exactamente `ferticafe-motor/` y
`ferticafe-service/` (el `.gitignore` excluye `instituto-agropecuario/`).
`render.yaml` ya trae `rootDir: ferticafe-service`.

Solo falta subirlo a GitHub:

```bash
cd C:\Users\burve\agente-embudos\proyectos
# crea el repo vacio "ferticafe" en github.com (privado), sin README, y luego:
git remote add origin https://github.com/<tu-usuario>/ferticafe.git
git branch -M main
git push -u origin main
```

Estructura que verá Render:

```
ferticafe/  (repo)
├── ferticafe-motor/
└── ferticafe-service/   <- rootDir
```

> El `git push` lo haces tú (R7). El repo local ya tiene el primer commit.

---

## 1. Crear el servicio en Render

1. Cuenta en https://render.com (el plan **Free** basta).
2. **New → Web Service** → conecta el repo de Git.
3. Render detecta `render.yaml` (Blueprint). Si te lo pregunta, acéptalo. Si no:
   - **Root Directory:** `ferticafe-service` (o `proyectos/ferticafe-service`)
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app:app --host 0.0.0.0 --port $PORT`
   - **Plan:** Free
   - **Health Check Path:** `/health`

## 2. Variables de entorno

En **Environment** del servicio, agrega (valores del `WHATSAPP-CLOUD-API-SETUP.md`):

| Clave | Valor |
|---|---|
| `WA_TOKEN` | token permanente del System User |
| `WA_PHONE_ID` | Phone number ID |
| `WA_VERIFY_TOKEN` | la frase que te inventaste |
| `WA_APP_SECRET` | clave secreta de la app |
| `ADMIN_TOKEN` | otra frase larga tuya (para abrir `/leads`) |
| `CFG_WEBINAR` | opcional, ej. `jueves 11 de septiembre 7 p.m.` |
| `CFG_GRUPO_WA` | opcional, link del grupo `https://chat.whatsapp.com/...` |

Guarda → Render redepliega.

## 3. Comprobar

- Abre `https://<tu-servicio>.onrender.com/health` → debe decir
  `{"status":"ok", ... "puede_enviar_whatsapp":true}`.
  Si dice `incompleto` y lista `faltan_variables`, revisa el paso 2.
- Abre `https://<tu-servicio>.onrender.com/leads.html?token=<ADMIN_TOKEN>` → tabla vacía.

## 4. Enviar la URL a los dos sitios

1. **Meta:** webhook Callback URL = `https://<tu-servicio>.onrender.com/webhook`
   (paso 7 de `WHATSAPP-CLOUD-API-SETUP.md`).
2. **`config.js`** del sitio:
   `cafe_url_endpoint_diagnostico: "https://<tu-servicio>.onrender.com"` (sin barra final).

## 5. Prueba de punta a punta

Desde un WhatsApp registrado como destinatario de prueba en Meta:
1. Entra a `/cafe/`, llena el formulario, cae en `/cafe/gracias/`.
2. Toca **"ENVIAR MIS DATOS POR WHATSAPP"**, dale enviar en WhatsApp.
3. En ~30–90 s (más la primera vez del día por el "cold start") llega: un acuse, el PDF
   y el resumen.
4. En `/leads.html` aparece el lead como `entregado`.

---

## Notas del plan free

- **Se duerme** tras 15 min sin tráfico. La siguiente petición tarda ~30–50 s en
  despertar. Meta **reintenta** el webhook varias veces, así que el mensaje no se
  pierde: solo llega con retraso la primera consulta del día. Si molesta, un
  "cron" externo (ej. cron-job.org) que pegue `/health` cada 10 min lo mantiene despierto.
- **`leads.db` es efímero:** se borra en cada redeploy. No es crítico (el chat de
  WhatsApp es el registro real y el resumen se entrega igual). Para historial durable:
  subir a plan de pago + disco, o añadir un Postgres (Render → New → PostgreSQL; luego
  cambiar `store.py` a `psycopg`). Por ahora no hace falta.
- **Logs:** Render → tu servicio → **Logs**. Ahí se ven los errores de proceso.

## Alternativa: Fly.io

Mismo código. `fly launch` en `ferticafe-service/` (detecta el Dockerfile/Procfile),
`fly secrets set WA_TOKEN=... WA_PHONE_ID=...`, `fly deploy`. Fly no duerme igual que
Render pero el setup con CLI es un poco más técnico.
