/* =====================================================================
   INSTITUTO AGROPECUARIO - CONFIGURACION DEL EMBUDO
   ---------------------------------------------------------------------
   ESTE ES EL UNICO ARCHIVO QUE HAY QUE EDITAR ANTES DE PUBLICAR.
   Todo lo que este vacio ("") sale resaltado en amarillo en la pagina
   con el texto "POR DEFINIR", para que no se publique nada a medias.
   ===================================================================== */
window.IA_CONFIG = {

  /* ---- El experto ---- */
  nombre_experto: "",              // ej: "Ing. Carlos Restrepo"
  cargo_experto: "Ingeniero Agricola",
  anos_experiencia: "",            // ej: "14"

  /* ---- El webinar ---- */
  fecha_webinar: "",               // ej: "Jueves 4 de septiembre"
  hora_webinar: "",                // ej: "7:00 p. m. (hora Colombia)"
  duracion_webinar: "90 minutos",
  fecha_iso_webinar: "",           // ej: "2026-09-04T19:00:00-05:00"  (para la cuenta regresiva)
  url_sala: "",                    // enlace de Zoom / YouTube en vivo (se envia por WhatsApp y correo)

  /* ---- WhatsApp ---- */
  wa_grupo_webinar: "",            // https://chat.whatsapp.com/XXXX  (grupo de los registrados)
  wa_grupo_cohorte: "",            // https://chat.whatsapp.com/XXXX  (grupo de la cohorte fundadora)
  wa_soporte: "",                  // https://wa.me/57XXXXXXXXXX     (soporte 1 a 1)

  /* ---- La oferta ---- */
  url_checkout: "",                // enlace de pago (Stripe / Hotmart / Bold)
  precio: "37",
  moneda: "USD",
  precio_cop: "",                  // ej: "150.000" (referencia informativa)
  precio_regular: "197",
  cupos_cohorte: "50",
  fecha_inicio_cohorte: "",        // ej: "Lunes 15 de septiembre"

  /* =========================================================
     VERTICAL CAFE  (seccion /cafe/  --  ver docs/BRIEF-CAFE.md)
     Si se deja vacio, sale "POR DEFINIR" en amarillo igual que arriba.
     ========================================================= */

  /* ---- Cafe: webinar ----
     Si Eduard hace UN solo webinar "Finca con Cobertura" para cafe y gallinas,
     deja estos vacios y reutiliza fecha_webinar / hora_webinar / fecha_iso_webinar. */
  cafe_fecha_webinar: "",
  cafe_hora_webinar: "",
  cafe_duracion_webinar: "90 minutos",
  cafe_fecha_iso_webinar: "",       // "2026-09-11T19:00:00-05:00" (cuenta regresiva)
  cafe_url_sala: "",

  /* ---- Cafe: WhatsApp ---- */
  cafe_wa_grupo_webinar: "",         // https://chat.whatsapp.com/XXXX
  cafe_wa_grupo_cohorte: "",         // https://chat.whatsapp.com/XXXX
  cafe_wa_diagnostico: "15556777383", // SOLO DIGITOS del numero de WhatsApp Cloud API que da Meta,
                                     // con indicativo y sin +  (ej: "573001234567").
                                     // Es el numero al que el cafetero manda el bloque #DIAG.
                                     // Ver docs/WHATSAPP-CLOUD-API-SETUP.md

  /* ---- Cafe: diagnostico de fertilizacion (FertiCafe) ---- */
  cafe_precio_nivel2_cop: "",        // [REVISAR] sugerido 30.000-40.000
  cafe_precio_nivel3_cop: "",        // [REVISAR] sugerido 60.000-90.000
  cafe_url_endpoint_diagnostico: "https://ferticafe.onrender.com", // URL publica del servicio ferticafe-service ya desplegado,
                                     // SIN barra final (ej: "https://ferticafe-service.onrender.com").
                                     // La landing le agrega "/registro" para guardar el lead.
                                     // Ver docs/DESPLIEGUE-SERVICIO.md

  /* ---- Cafe: oferta / cohorte ---- */
  cafe_url_checkout_cohorte: "",
  cafe_precio_cohorte: "",
  cafe_precio_cohorte_regular: "",
  cafe_cupos_cohorte: "",
  cafe_fecha_inicio_cohorte: "",

  /* ---- Legal / marca ---- */
  marca: "Instituto Agropecuario",
  dominio: "institutoagropecuario.com",
  correo_soporte: "",              // ej: "hola@institutoagropecuario.com"
  url_privacidad: "/legal/privacidad.html",
  url_terminos: "/legal/terminos.html"
};
