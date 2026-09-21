/**
 * =========================================================================================
 * SERVICIO DE INTEGRACIÓN CON GOOGLE SHEETS / DRIVE (API CLIENT)
 * COLEGIO MÉDICO DEL PERÚ - CONSEJO REGIONAL XX PASCO
 * =========================================================================================
 */

const SheetsService = {
  /**
   * Verificar si la URL de Google Sheets está configurada y es válida
   */
  isConfigured() {
    const url = APP_CONFIG.getAppsScriptUrl();
    return url && (url.startsWith("https://script.google.com") || url.startsWith("http"));
  },

  /**
   * Validar formato de URL antes de llamar
   */
  validarFormatoUrl(url) {
    if (!url || !url.trim()) {
      return { valido: false, error: "No se ha ingresado ninguna URL de Google Apps Script." };
    }
    const cleanUrl = url.trim().replace(/^["']|["']$/g, "");
    if (cleanUrl.includes("docs.google.com/spreadsheets")) {
      return {
        valido: false,
        error: "⚠️ Pegó la URL de la hoja de cálculo de Google Drive. Debe pegar la URL de la 'Aplicación Web' creada en Extensiones > Apps Script > Implementar (termina en /exec)."
      };
    }
    if (!cleanUrl.startsWith("https://script.google.com/macros/s/")) {
      return {
        valido: false,
        error: "⚠️ La URL debe ser una Aplicación Web de Google Apps Script (inicia con: https://script.google.com/macros/s/.../exec)."
      };
    }
    return { valido: true, url: cleanUrl };
  },

  /**
   * Probar la conexión con la Web App de Google Apps Script
   */
  async testConnection(customUrl = null) {
    const rawUrl = customUrl || APP_CONFIG.getAppsScriptUrl();
    const validacion = this.validarFormatoUrl(rawUrl);
    if (!validacion.valido) {
      return { success: false, error: validacion.error };
    }
    const url = validacion.url;

    try {
      const endpoint = url.includes("?") ? `${url}&action=ping` : `${url}?action=ping`;
      const response = await fetch(endpoint, {
        method: "GET",
        redirect: "follow"
      });

      const data = await response.json();
      if (data && data.success) {
        return { success: true, data };
      }
      return { success: true, data };
    } catch (err) {
      console.warn("Fallo al conectar con Google Apps Script:", err);
      return { 
        success: false, 
        error: "Google bloqueó la conexión (Error CORS / Red). Verifique su conexión a internet y que en Apps Script > Implementar > 'Quién tiene acceso' esté configurado en 'Cualquier persona' (Anyone)." 
      };
    }
  },

  /**
   * Registrar una nueva reserva en Google Sheets
   */
  async registrarEnSheets(datosAsistente) {
    if (!this.isConfigured()) {
      console.log("Modo Offline / LocalStorage activo: No hay URL de Google Sheets configurada.");
      return { success: true, localOnly: true };
    }

    const rawUrl = APP_CONFIG.getAppsScriptUrl();
    const validacion = this.validarFormatoUrl(rawUrl);
    if (!validacion.valido) return { success: true, localOnly: true, syncError: validacion.error };
    const url = validacion.url;

    try {
      const response = await fetch(url, {
        method: "POST",
        redirect: "follow",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          action: "registrar",
          ...datosAsistente
        })
      });

      const res = await response.json();
      return res;
    } catch (err) {
      console.error("Error al registrar en Google Sheets:", err);
      return { success: true, localOnly: true, syncError: err.message };
    }
  },

  /**
   * Validar ingreso en tiempo real contra Google Sheets
   */
  async validarIngresoEnSheets(codigo, validador = "Staff Puerta") {
    // 1. Asegurar actualización local inmediata
    const resLocal = StorageService.marcarIngreso(codigo, validador);

    if (!this.isConfigured()) {
      return resLocal;
    }

    const rawUrl = APP_CONFIG.getAppsScriptUrl();
    const validacion = this.validarFormatoUrl(rawUrl);
    if (!validacion.valido) return resLocal;
    const url = validacion.url;

    try {
      fetch(url, {
        method: "POST",
        redirect: "follow",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          action: "validarIngreso",
          codigo: codigo,
          validador: validador
        })
      }).catch(err => console.warn("Sync Sheets error:", err));

      return resLocal;
    } catch (err) {
      console.warn("Fallo al conectar con Sheets, usando local:", err);
      return resLocal;
    }
  },

  /**
   * Restablecer estado a Pendiente en Sheets
   */
  async restablecerEstadoEnSheets(idReserva) {
    StorageService.restablecerEstado(idReserva);

    if (!this.isConfigured()) return { success: true };

    const rawUrl = APP_CONFIG.getAppsScriptUrl();
    const validacion = this.validarFormatoUrl(rawUrl);
    if (!validacion.valido) return { success: true };
    const url = validacion.url;

    try {
      fetch(url, {
        method: "POST",
        redirect: "follow",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          action: "reiniciarAsistencia",
          codigo: idReserva
        })
      }).catch(err => console.warn("Error restableciendo en Sheets:", err));
      return { success: true };
    } catch (err) {
      return { success: true };
    }
  },

  /**
   * Eliminar un registro de asistente en Google Sheets
   */
  async eliminarEnSheets(idReserva, cmp = "") {
    if (!this.isConfigured()) {
      return { success: true, localOnly: true };
    }

    const rawUrl = APP_CONFIG.getAppsScriptUrl();
    const validacion = this.validarFormatoUrl(rawUrl);
    if (!validacion.valido) return { success: true, localOnly: true };
    const url = validacion.url;

    try {
      const response = await fetch(url, {
        method: "POST",
        redirect: "follow",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          action: "eliminarAsistente",
          idReserva: idReserva,
          cmp: cmp
        })
      });

      const res = await response.json();
      return res;
    } catch (err) {
      console.warn("Fallo al eliminar en Google Sheets:", err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Sincronizar y obtener la lista completa de asistentes desde Google Sheets
   */
  async sincronizarDesdeGoogleSheets() {
    return this.descargarDesdeSheets();
  },

  /**
   * Obtener valor de fila de forma flexible
   */
  getField(row, aliases) {
    if (!row || typeof row !== "object") return "";
    for (const a of aliases) {
      if (row[a] !== undefined && row[a] !== null && String(row[a]).trim() !== "") {
        return row[a];
      }
    }
    const rowKeys = Object.keys(row);
    for (const a of aliases) {
      const cleanA = a.toLowerCase().replace(/[^a-z0-9]/g, "");
      const matchedKey = rowKeys.find(rk => rk.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanA);
      if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null && String(row[matchedKey]).trim() !== "") {
        return row[matchedKey];
      }
    }
    return "";
  },

  async descargarDesdeSheets() {
    if (!this.isConfigured()) {
      return { 
        success: false, 
        error: "No ha configurado la URL de Google Apps Script. Ingrese a la pestaña 'Ajustes' para vincular su hoja." 
      };
    }

    const rawUrl = APP_CONFIG.getAppsScriptUrl();
    const validacion = this.validarFormatoUrl(rawUrl);
    if (!validacion.valido) {
      return { success: false, error: validacion.error };
    }
    const url = validacion.url;

    const endpoint = url.includes("?") ? `${url}&action=obtenerAsistentes` : `${url}?action=obtenerAsistentes`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

      const response = await fetch(endpoint, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const res = await response.json();

      if (res.success && Array.isArray(res.data)) {
        const locales = StorageService.getAsistentes();
        const localMap = new Map();
        locales.forEach(l => {
          if (l.idReserva) {
            localMap.set(String(l.idReserva).trim().toLowerCase(), l);
          }
          if (l.cmp) {
            const cleanCmp = String(l.cmp).trim().replace(/^0+/, "").toLowerCase();
            localMap.set(cleanCmp, l);
            localMap.set(String(l.cmp).trim().toLowerCase(), l);
          }
        });

        const mapeados = res.data
          .filter(row => {
            const id = this.getField(row, ["ID Reserva", "idReserva", "Codigo"]);
            const cmp = this.getField(row, ["N° CMP", "Nº CMP", "CMP", "cmp"]);
            return (id && String(id).trim() !== "ID Reserva") || (cmp && String(cmp).trim() !== "N° CMP");
          })
          .map(row => {
            const idReserva = String(this.getField(row, ["ID Reserva", "idReserva", "Codigo"]) || "").trim();
            const rawCmp = String(this.getField(row, ["N° CMP", "Nº CMP", "CMP", "cmp"]) || "").trim();
            const cleanCmp = rawCmp.replace(/^0+/, "").toLowerCase() || rawCmp.toLowerCase();
            
            const local = localMap.get(idReserva.toLowerCase()) || localMap.get(cleanCmp) || localMap.get(rawCmp.toLowerCase()) || {};
            
            // Detección de acompañantes
            const rawAcompRemote = this.getField(row, [
              "N° Acompañantes", "Nº Acompañantes", "N° Acompañante", "Nº Acompañante",
              "Acompañantes", "Acompañante", "numAcomp", "nroAcompanantes", "acompanantes"
            ]);
            
            let numAcomp = parseInt(rawAcompRemote);
            if (isNaN(numAcomp)) numAcomp = 0;

            const nomAcompRemote = String(this.getField(row, ["Nombres Acompañantes", "Nombre Acompañante", "nombresAcompanantes", "Acompañante"]) || "").trim();
            const localAcompNum = parseInt(local.acompanantes || 0);

            if (numAcomp === 0) {
              if (localAcompNum > 0) {
                numAcomp = localAcompNum;
              } else if (nomAcompRemote && nomAcompRemote !== "Ninguno") {
                numAcomp = 1;
              }
            }

            const finalIdReserva = idReserva || local.idReserva || `CMP-${rawCmp || '0000'}`;
            const qrHash = String(this.getField(row, ["Código QR Titular", "Código QR / Hash", "Código QR Único", "QR Hash", "qrHash"]) || local.qrHash || `${finalIdReserva}-${rawCmp}`);
            const nombresAcompanantes = nomAcompRemote || local.nombresAcompanantes || (numAcomp > 0 ? "Acompañante Registrado" : "Ninguno");

            let fechaIngreso = String(this.getField(row, ["Fecha y Hora Ingreso", "fechaIngreso", "Hora Ingreso"]) || "");
            let validadoPor = String(this.getField(row, ["Validado Por", "validadoPor"]) || "");

            const estadoRemote = String(this.getField(row, ["Estado Asistencia", "estado", "Asistencia"]) || "").trim();
            const cleanEstadoRemote = estadoRemote.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            let finalEstado = "Pendiente";
            
            if (cleanEstadoRemote.includes("ingres") || cleanEstadoRemote.includes("asist") || cleanEstadoRemote === "presente" || cleanEstadoRemote === "si") {
              finalEstado = "Ingresó";
              fechaIngreso = fechaIngreso || local.fechaIngreso || "";
              validadoPor = validadoPor || local.validadoPor || "Escáner QR";
            } else if (cleanEstadoRemote === "pendiente") {
              finalEstado = "Pendiente";
              fechaIngreso = "";
              validadoPor = "";
            } else if (StorageService.esIngresado(local)) {
              finalEstado = "Ingresó";
              fechaIngreso = local.fechaIngreso || "";
              validadoPor = local.validadoPor || "";
            } else {
              finalEstado = local.estado || "Pendiente";
              fechaIngreso = local.fechaIngreso || "";
              validadoPor = local.validadoPor || "";
            }

            return {
              idReserva: finalIdReserva,
              fechaRegistro: String(this.getField(row, ["Fecha y Hora Registro", "fechaRegistro", "Fecha"]) || local.fechaRegistro || ""),
              cmp: rawCmp || local.cmp || "",
              dni: String(this.getField(row, ["DNI", "dni", "Documento"]) || local.dni || "").trim(),
              nombres: String(this.getField(row, ["Nombres y Apellidos", "nombres", "Nombre", "Apellidos y Nombres"]) || local.nombres || ""),
              especialidad: String(this.getField(row, ["Especialidad / Cargo", "especialidad", "Especialidad"]) || local.especialidad || "Médico Colegiado"),
              celular: String(this.getField(row, ["Celular / WhatsApp", "celular", "Telefono", "WhatsApp"]) || local.celular || "").trim(),
              correo: String(this.getField(row, ["Correo Electrónico", "correo", "Email"]) || local.correo || ""),
              acompanantes: numAcomp,
              nombresAcompanantes: nombresAcompanantes,
              requerimientos: "Ninguno",
              estadoPago: "Gratuito",
              montoPago: 0,
              metodoPago: "Gratuito",
              nroOperacion: "N/A",
              enlaceVoucherDrive: "",
              voucherImg: "",
              tieneVoucher: false,
              estado: finalEstado,
              fechaIngreso: finalEstado === "Ingresó" ? (fechaIngreso || local.fechaIngreso || "") : "",
              validadoPor: finalEstado === "Ingresó" ? (validadoPor || local.validadoPor || "") : "",
              qrTitular: qrHash,
              qrHash: qrHash,
              qrAcompanante: numAcomp > 0 ? qrHash : "",
              estadoAcompanante: numAcomp > 0 ? finalEstado : "",
              fechaIngresoAcompanante: numAcomp > 0 && finalEstado === "Ingresó" ? (fechaIngreso || local.fechaIngreso || "") : "",
              validadoPorAcompanante: numAcomp > 0 && finalEstado === "Ingresó" ? (validadoPor || local.validadoPor || "") : ""
            };
          });

        if (mapeados.length > 0) {
          StorageService.guardarTodos(mapeados);
        }

        return { success: true, nuevos: mapeados.length, data: mapeados };
      }

      return { success: false, error: res.error || "No se encontraron registros en la hoja de Google Sheets." };
    } catch (err) {
      console.error("Error al descargar desde Google Sheets:", err);
      if (err.name === 'AbortError') {
        return { success: false, error: "Tiempo de espera agotado al conectar con Google Sheets. Intente nuevamente." };
      }
      return { 
        success: false, 
        error: "Google bloqueó la conexión (Error CORS / Red). Asegúrese de que en Apps Script > Implementar > 'Quién tiene acceso' esté configurado en 'Cualquier persona' (Anyone)." 
      };
    }
  }
};
