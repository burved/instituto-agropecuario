/* =====================================================================
   INSTITUTO AGROPECUARIO - Logica compartida del embudo
   - Captura y propaga UTMs por todo el funnel (localStorage + querystring)
   - Cuenta regresiva al webinar / al cierre de la oferta
   - CTA pegajoso en movil
   - Validacion y envio del formulario de registro
   ===================================================================== */
(function () {
  "use strict";

  var LLAVE_UTM = "ia_utm";
  var LLAVE_LEAD = "ia_lead";
  var CAMPOS_UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid", "ref"];

  /* ---------- UTMs ---------- */
  function leerQuery() {
    var p = new URLSearchParams(window.location.search);
    var out = {};
    CAMPOS_UTM.forEach(function (k) {
      var v = p.get(k);
      if (v) out[k] = v;
    });
    return out;
  }

  function guardarUtms() {
    var nuevos = leerQuery();
    var previos = {};
    try {
      previos = JSON.parse(localStorage.getItem(LLAVE_UTM) || "{}");
    } catch (e) { previos = {}; }
    var mezcla = Object.assign({}, previos, nuevos);
    if (!mezcla.primer_contacto) mezcla.primer_contacto = new Date().toISOString();
    try { localStorage.setItem(LLAVE_UTM, JSON.stringify(mezcla)); } catch (e) {}
    return mezcla;
  }

  function utms() {
    try { return JSON.parse(localStorage.getItem(LLAVE_UTM) || "{}"); } catch (e) { return {}; }
  }

  /* Propaga los UTMs a los enlaces internos del embudo */
  function propagarUtms() {
    var datos = utms();
    var claves = Object.keys(datos).filter(function (k) { return k !== "primer_contacto"; });
    if (!claves.length) return;
    var qs = claves.map(function (k) {
      return encodeURIComponent(k) + "=" + encodeURIComponent(datos[k]);
    }).join("&");

    document.querySelectorAll("a[href]").forEach(function (a) {
      var href = a.getAttribute("href");
      if (!href) return;
      if (href.charAt(0) === "#" || /^(mailto:|tel:)/i.test(href)) return;
      // solo enlaces internos del embudo (relativos o del mismo host)
      var esInterno = !/^https?:\/\//i.test(href) || href.indexOf(window.location.host) > -1;
      if (!esInterno) return;
      a.setAttribute("href", href + (href.indexOf("?") > -1 ? "&" : "?") + qs);
    });
  }

  /* ---------- Lead ---------- */
  function guardarLead(lead) {
    try { localStorage.setItem(LLAVE_LEAD, JSON.stringify(lead)); } catch (e) {}
  }
  function leerLead() {
    try { return JSON.parse(localStorage.getItem(LLAVE_LEAD) || "{}"); } catch (e) { return {}; }
  }

  /* Rellena los <span data-lead="nombre"> con el nombre capturado */
  function pintarLead() {
    var lead = leerLead();
    var p = new URLSearchParams(window.location.search);
    var nombre = p.get("nombre") || lead.nombre || "";
    if (!nombre) return;
    nombre = nombre.split(" ")[0];
    nombre = nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase();
    document.querySelectorAll("[data-lead=nombre]").forEach(function (el) {
      el.textContent = nombre;
    });
    document.querySelectorAll("[data-lead-bloque]").forEach(function (el) {
      el.style.display = "";
    });
  }

  /* ---------- Cuenta regresiva ---------- */
  /* <div class="contador" data-cuenta-regresiva="2026-09-03T19:00:00-05:00"></div>
     o data-horas="24" para una ventana rodante guardada por visitante */
  function contadores() {
    document.querySelectorAll("[data-cuenta-regresiva],[data-horas]").forEach(function (el) {
      var objetivo;
      var horas = el.getAttribute("data-horas");
      if (horas) {
        var llave = "ia_deadline_" + (el.id || "def");
        var guardado = null;
        try { guardado = localStorage.getItem(llave); } catch (e) {}
        if (!guardado) {
          guardado = String(Date.now() + parseFloat(horas) * 3600000);
          try { localStorage.setItem(llave, guardado); } catch (e) {}
        }
        objetivo = new Date(parseInt(guardado, 10));
      } else {
        objetivo = new Date(el.getAttribute("data-cuenta-regresiva"));
      }
      if (isNaN(objetivo.getTime())) return;

      el.innerHTML =
        '<div class="bloque"><span class="num" data-u="d">00</span><span class="lab">Dias</span></div>' +
        '<div class="bloque"><span class="num" data-u="h">00</span><span class="lab">Horas</span></div>' +
        '<div class="bloque"><span class="num" data-u="m">00</span><span class="lab">Min</span></div>' +
        '<div class="bloque"><span class="num" data-u="s">00</span><span class="lab">Seg</span></div>';

      function pad(n) { return n < 10 ? "0" + n : String(n); }
      function tic() {
        var falta = objetivo.getTime() - Date.now();
        if (falta < 0) falta = 0;
        var d = Math.floor(falta / 86400000);
        var h = Math.floor((falta % 86400000) / 3600000);
        var m = Math.floor((falta % 3600000) / 60000);
        var s = Math.floor((falta % 60000) / 1000);
        el.querySelector('[data-u=d]').textContent = pad(d);
        el.querySelector('[data-u=h]').textContent = pad(h);
        el.querySelector('[data-u=m]').textContent = pad(m);
        el.querySelector('[data-u=s]').textContent = pad(s);
      }
      tic();
      setInterval(tic, 1000);
    });
  }

  /* ---------- CTA pegajoso ---------- */
  function stickyCta() {
    var barra = document.querySelector(".sticky-cta");
    if (!barra) return;
    function ver() {
      var y = window.scrollY || document.documentElement.scrollTop;
      if (y > 700) barra.classList.add("visible");
      else barra.classList.remove("visible");
    }
    window.addEventListener("scroll", ver, { passive: true });
    ver();
  }

  /* ---------- Formulario de registro ---------- */
  /* <form data-form-registro data-destino="/gracias/"> ... </form>
     Si existe window.IA_ENDPOINT_REGISTRO se hace POST alli; si no, guarda local y redirige. */
  function formularios() {
    document.querySelectorAll("[data-form-registro]").forEach(function (form) {
      var error = form.querySelector(".form-error");
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var datos = {};
        new FormData(form).forEach(function (v, k) { datos[k] = String(v).trim(); });

        if (!datos.nombre || datos.nombre.length < 2) return fallo("Escribe tu nombre.");
        if ((datos.whatsapp || "").replace(/\D/g, "").length < 7) return fallo("Escribe tu numero de WhatsApp con indicativo.");
        /* El correo es OPCIONAL (WhatsApp es el canal central): solo se valida si lo escribieron. */
        if (datos.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(datos.correo)) return fallo("Revisa tu correo: parece incompleto.");

        if (error) error.style.display = "none";
        var boton = form.querySelector('button[type=submit],.btn');
        if (boton) { boton.disabled = true; boton.dataset.txt = boton.textContent; boton.textContent = "Guardando tu cupo..."; }

        var payload = Object.assign({}, datos, utms(), {
          pagina: window.location.pathname,
          enviado_en: new Date().toISOString()
        });
        guardarLead(payload);

        var destino = form.getAttribute("data-destino") || "/gracias/";
        var qs = "?nombre=" + encodeURIComponent(datos.nombre);
        var u = utms();
        Object.keys(u).forEach(function (k) {
          if (k === "primer_contacto") return;
          qs += "&" + encodeURIComponent(k) + "=" + encodeURIComponent(u[k]);
        });

        function seguir() { window.location.href = destino + qs; }

        if (window.IA_ENDPOINT_REGISTRO) {
          fetch(window.IA_ENDPOINT_REGISTRO, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          }).then(seguir).catch(seguir);
          setTimeout(seguir, 4000);
        } else {
          seguir();
        }

        function fallo(msg) {
          if (error) { error.textContent = msg; error.style.display = "block"; }
          else alert(msg);
        }
      });
    });
  }

  /* ---------- Enlace de WhatsApp con el intake del diagnostico ----------
     Uso (solo en /cafe/gracias/):
       <a class="btn btn-wa" data-wa-intake data-wa-destino="cafe_wa_diagnostico" href="#">ENVIAR MIS DATOS</a>
     Reconstruye el mensaje "#DIAG ..." con el lead guardado y arma el wa.me.
     NO toca la logica del formulario (el contrato pide no tocarla): la landing
     redirige a /gracias/ como siempre, y aqui se ofrece el envio por WhatsApp. */
  var CAMPOS_DIAG = ["nombre", "whatsapp", "correo", "variedad", "edad", "hectareas",
                     "matas", "distancia_siembra", "sombra", "estado", "humedad", "analisis"];

  /* ---------- Area del lote: "no se las hectareas" ----------
     Aditivo, no toca formularios(). La casilla [data-area-toggle] revela el
     bloque [data-area-distancia] y quita el "required" del campo de hectareas
     para que el cafetero pueda dar matas + distancia en su lugar. */
  function areaLote() {
    var toggle = document.querySelector("[data-area-toggle]");
    var caja = document.querySelector("[data-area-distancia]");
    var ha = document.getElementById("hectareas");
    if (!toggle || !caja || !ha) return;
    function sync() {
      var noSabe = toggle.checked;
      caja.hidden = !noSabe;
      if (noSabe) { ha.removeAttribute("required"); ha.value = ""; }
      else { ha.setAttribute("required", "required"); }
    }
    toggle.addEventListener("change", sync);
    sync();
  }

  function textoDiag(lead) {
    var lineas = ["Hola, quiero mi diagnostico de fertilizacion FertiCafe.", "", "#DIAG"];
    CAMPOS_DIAG.forEach(function (k) {
      if (lead[k]) lineas.push(k + ": " + lead[k]);
    });
    var u = utms();
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(function (k) {
      if (u[k]) lineas.push(k + ": " + u[k]);
    });
    return lineas.join("\n");
  }

  function enlacesWaIntake() {
    var cfg = window.IA_CONFIG || {};
    document.querySelectorAll("[data-wa-intake]").forEach(function (a) {
      var num = String(cfg[a.getAttribute("data-wa-destino") || "cafe_wa_diagnostico"] || "").replace(/\D/g, "");
      if (!num) { a.classList.add("enlace-pendiente"); a.setAttribute("href", "#"); return; }
      var lead = leerLead();
      var texto = (lead && lead.nombre) ? textoDiag(lead)
        : "Hola, quiero mi diagnostico de fertilizacion FertiCafe.";
      a.setAttribute("href", "https://wa.me/" + num + "?text=" + encodeURIComponent(texto));
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener");
      a.classList.remove("enlace-pendiente");
    });
  }

  /* ---------- Configuracion central (assets/config.js) ----------
     Texto:  <span data-cfg="nombre_experto"></span>
     Enlace: <a data-cfg-href="url_checkout" href="#">...</a>
     Fecha de cuenta regresiva: <div class="contador" data-cfg-cuenta="fecha_iso_webinar"></div>
     Lo que este vacio en config.js se marca visualmente como POR DEFINIR. */
  function configurar() {
    var cfg = window.IA_CONFIG || {};

    document.querySelectorAll("[data-cfg]").forEach(function (el) {
      var llave = el.getAttribute("data-cfg");
      var valor = cfg[llave];
      if (valor) {
        el.textContent = valor;
        el.classList.remove("dato-pendiente");
      } else {
        el.textContent = el.getAttribute("data-cfg-alt") || "POR DEFINIR";
        el.classList.add("dato-pendiente");
      }
    });

    document.querySelectorAll("[data-cfg-href]").forEach(function (el) {
      var valor = cfg[el.getAttribute("data-cfg-href")];
      if (valor) {
        el.setAttribute("href", valor);
        el.classList.remove("enlace-pendiente");
      } else {
        el.setAttribute("href", "#");
        el.classList.add("enlace-pendiente");
        el.setAttribute("title", "Falta configurar este enlace en assets/config.js");
      }
    });

    document.querySelectorAll("[data-cfg-cuenta]").forEach(function (el) {
      var valor = cfg[el.getAttribute("data-cfg-cuenta")];
      if (valor) el.setAttribute("data-cuenta-regresiva", valor);
      else if (!el.getAttribute("data-horas")) el.setAttribute("data-horas", "48");
    });

    if (cfg.correo_soporte) {
      document.querySelectorAll("[data-cfg-mailto]").forEach(function (el) {
        el.setAttribute("href", "mailto:" + cfg.correo_soporte);
        el.textContent = cfg.correo_soporte;
      });
    }
  }

  /* ---------- Arranque ---------- */
  function iniciar() {
    configurar();
    guardarUtms();
    propagarUtms();
    pintarLead();
    contadores();
    stickyCta();
    formularios();
    areaLote();
    enlacesWaIntake();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }

  window.IA = { utms: utms, lead: leerLead };
})();
