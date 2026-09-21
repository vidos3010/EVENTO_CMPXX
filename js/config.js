/**
 * =========================================================================================
 * CONFIGURACIÓN GLOBAL DEL EVENTO - COLEGIO MÉDICO DEL PERÚ XX PASCO
 * =========================================================================================
 */

const APP_CONFIG = {
  // Información Institucional y del Evento
  institucion: "Colegio Médico del Perú",
  consejoRegional: "Consejo Regional XX Pasco",
  lema: "Ética, Ciencia y Solidaridad",
  
  // Datos Oficiales del Evento (Día de la Medicina Peruana)
  eventoDefault: {
    nombre: "Día de la Medicina Peruana — Noche de Confraternidad",
    subtitulo: "Noche de Diversión con Los Dávila (K'jantu) & Orquesta La Penca",
    fecha: "Miércoles, 07 de Octubre del 2026",
    hora: "07:00 p. m.",
    lugar: "LA KATEDRAL",
    ciudad: "Pasco, Perú",
    artistas: "Los Dávila (K'jantu) & Orquesta La Penca",
    dressCode: "Elegante / Fiesta",
    limiteAforo: 350,
    permitirAcompanantes: true,
    maxAcompanantes: 1,
    costoAcompanante: 0
  },

  // Claves para Almacenamiento Local (LocalStorage)
  STORAGE_KEYS: {
    ASISTENTES: "cmp_pasco_asistentes_v1",
    CONFIG_EVENTO: "cmp_pasco_config_evento_v1",
    APPS_SCRIPT_URL: "cmp_pasco_apps_script_url_v1",
    ULTIMA_RESERVA: "cmp_pasco_ultima_reserva_v1",
    ULTIMO_REGISTRO: "cmp_pasco_ultima_reserva_v1",
    COLA_SINCRONIZACION: "cmp_pasco_sync_queue_v1",
    CUSTOM_LOGO: "cmp_pasco_custom_logo_v1"
  },

  // Obtener la URL o ruta del logotipo oficial
  getLogoUrl() {
    return localStorage.getItem(this.STORAGE_KEYS.CUSTOM_LOGO) || "assets/logo.png";
  },

  // Guardar logotipo personalizado
  setLogoUrl(url) {
    if (url && url.trim()) {
      localStorage.setItem(this.STORAGE_KEYS.CUSTOM_LOGO, url.trim());
    } else {
      localStorage.removeItem(this.STORAGE_KEYS.CUSTOM_LOGO);
    }
  },

  // Obtener la URL de Google Apps Script configurada o predeterminada
  getAppsScriptUrl() {
    const saved = localStorage.getItem(this.STORAGE_KEYS.APPS_SCRIPT_URL);
    if (saved && !saved.includes("AKfycbwhbSnyTQdQzpcXbxpW9sQS6P4XnVpnE1_wDNa_z1BU0MmS1GoddXFN_swo7BhpGH9e") && !saved.includes("AKfycbx2jeudv9-6wgNHFyo35PQtjj72bduyiKVcIYPNmDj38AhcIQLuHTNAvSzanBfTD3ne") && !saved.includes("AKfycbxR2dFErigvIcquLoAUZF4WhY2TUs6AJqFReXAKKvTIckBdfTSB1s1O_PrmtChnF8wI")) {
      return saved.trim();
    }
    return "https://script.google.com/macros/s/AKfycbyQZYFK8p9K9Ouj4qVlj_v2skPmez7NaA6SDUqmWXOkag-akzBbfRnTW7hair_6pBR2/exec";
  },

  // Guardar la URL de Google Apps Script
  setAppsScriptUrl(url) {
    if (url) {
      localStorage.setItem(this.STORAGE_KEYS.APPS_SCRIPT_URL, url.trim());
    } else {
      localStorage.removeItem(this.STORAGE_KEYS.APPS_SCRIPT_URL);
    }
  },

  // Obtener la configuración del evento (o valores por defecto del afiche)
  getEventoConfig() {
    const custom = localStorage.getItem(this.STORAGE_KEYS.CONFIG_EVENTO);
    if (custom) {
      try {
        const parsed = JSON.parse(custom);
        // Si aún tenía el evento anterior genérico, actualizar al afiche oficial
        if (parsed.nombre && parsed.nombre.includes("Gran Noche de Gala")) {
          return { ...this.eventoDefault };
        }
        return { ...this.eventoDefault, ...parsed };
      } catch (e) {
        return { ...this.eventoDefault };
      }
    }
    return { ...this.eventoDefault };
  },

  // Guardar configuración personalizada del evento
  setEventoConfig(config) {
    if (config) {
      localStorage.setItem(this.STORAGE_KEYS.CONFIG_EVENTO, JSON.stringify(config));
    }
  }
};
