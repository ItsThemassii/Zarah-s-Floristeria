// config-publico.js
// -----------------------------------------------------------------------------
// Lee la configuración de la tienda (tabla `configuracion`) desde Supabase y la
// aplica al sitio PÚBLICO (index.html y Productos.html). Así, cuando el dueño
// cambia el WhatsApp / horario / zona de entrega en el admin, el sitio público
// los refleja sin tener que editar el HTML.
//
// Diseño:
//   - Una SOLA query trae las 4 claves que necesita el sitio público.
//   - Si la query falla (sin internet, Supabase caído), se devuelven los
//     valores por defecto: el sitio nunca se rompe, solo muestra lo de siempre.
//   - aplicarConfigDom() actualiza el DOM buscando marcadores data-*, así el
//     HTML decide QUÉ se actualiza y este módulo no conoce IDs concretos.
// -----------------------------------------------------------------------------

import { supabase } from "./supabase-config.js";

// Claves que consume el sitio público y su valor por defecto (== lo que estaba
// hardcodeado en el HTML). Sirven de fallback si una clave falta o si la query
// falla por completo.
export const CONFIG_DEFAULTS = {
  nombre_tienda: "Zarah's",
  whatsapp:      "51994684237",
  horario:       "Lun – Sáb · 9:00 a.m. – 6:00 p.m.",
  area_entrega:  "Callao y Lima"
};

const CLAVES = Object.keys(CONFIG_DEFAULTS);

// Trae las 4 claves en una sola query. Devuelve { clave: valor } con defaults
// rellenando lo que falte. Nunca lanza: ante cualquier error, devuelve defaults.
export async function cargarConfig() {
  const config = { ...CONFIG_DEFAULTS };
  try {
    const { data, error } = await supabase
      .from("configuracion")
      .select("clave,valor")
      .in("clave", CLAVES);
    if (error) throw error;
    (data || []).forEach(({ clave, valor }) => {
      // Solo pisamos el default si vino un valor no vacío.
      if (valor != null && String(valor).trim() !== "") config[clave] = valor;
    });
  } catch (e) {
    console.warn("No se pudo cargar la configuración; uso valores por defecto.", e);
  }
  return config;
}

// "51994684237" -> "+51 994 684 237". Si el número no calza con el formato
// esperado, devuelve "+" + dígitos sin romper nada.
export function formatearWhatsapp(numero) {
  const d = String(numero).replace(/\D/g, "");
  if (d.length < 3) return "+" + d;
  const cc = d.slice(0, 2);              // código de país (51)
  const resto = d.slice(2).replace(/(\d{3})(?=\d)/g, "$1 ").trim();
  return `+${cc} ${resto}`;
}

// Aplica la config al DOM de la página actual mediante marcadores data-*:
//   data-wa-link   -> reescribe el número en el href, conservando ?text=...
//   data-wa-num    -> escribe el número visible, ya formateado
//   data-cfg="X"   -> reemplaza el texto del elemento por config[X]
export function aplicarConfigDom(config) {
  const wa = config.whatsapp;

  document.querySelectorAll("[data-wa-link]").forEach(a => {
    if (a.href) a.href = a.href.replace(/wa\.me\/\d+/, `wa.me/${wa}`);
  });

  document.querySelectorAll("[data-wa-num]").forEach(el => {
    el.textContent = formatearWhatsapp(wa);
  });

  document.querySelectorAll("[data-cfg]").forEach(el => {
    const clave = el.getAttribute("data-cfg");
    if (config[clave] != null) el.textContent = config[clave];
  });
}
