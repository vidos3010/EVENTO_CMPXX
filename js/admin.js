/**
 * =========================================================================================
 * MÓDULO DE ADMINISTRACIÓN, ASISTENCIA Y CONTROL DE AFORO
 * COLEGIO MÉDICO DEL PERÚ - CONSEJO REGIONAL XX PASCO
 * =========================================================================================
 */

let filtroActual = "todos";
let textoBusqueda = "";

const AdminService = {
  /**
   * Inicializar escuchadores del panel de administración
   */
  init() {
    this.actualizarEstadisticas();
    this.renderizarTabla();

    // Buscador en vivo
    const inputBuscar = document.getElementById("admin-search-input");
    if (inputBuscar) {
      inputBuscar.addEventListener("input", (e) => {
        textoBusqueda = e.target.value.toLowerCase().trim();
        this.renderizarTabla();
      });
    }

    // Filtros por estado de asistencia
    const filterButtons = document.querySelectorAll("[data-filter]");
    filterButtons.forEach(btn => {
      btn.addEventListener("click", (e) => {
        filterButtons.forEach(b => {
          b.classList.remove("bg-[#380036]", "text-amber-300", "font-bold");
          b.classList.add("bg-white", "text-slate-700");
        });

        const target = e.currentTarget;
        target.classList.remove("bg-white", "text-slate-700");
        target.classList.add("bg-[#380036]", "text-amber-300", "font-bold");

        filtroActual = target.getAttribute("data-filter");
        this.renderizarTabla();
      });
    });
  },

  /**
   * Actualizar tarjetas de estadísticas e indicadores de aforo
   * Considera si el boleto es Pase Doble (2 Personas) o Individual (1 Persona)
   */
  actualizarEstadisticas() {
    const asistentes = StorageService.getAsistentes();
    const config = APP_CONFIG.getEventoConfig();

    let totalMedicosInscritos = asistentes.length;
    let totalPasesDobles = 0;
    let totalPasesIndividuales = 0;
    let totalPersonasInscritas = 0;

    let totalMedicosIngresaron = 0;
    let totalPersonasIngresaron = 0; // Total ocupación en sala
    let totalPersonasPendientes = 0;

    asistentes.forEach(a => {
      const numAcomp = parseInt(a.acompanantes || 0);
      const esDoble = numAcomp > 0;
      const factorPersonas = esDoble ? 2 : 1;

      if (esDoble) {
        totalPasesDobles++;
      } else {
        totalPasesIndividuales++;
      }

      totalPersonasInscritas += factorPersonas;

      const ingreso = StorageService.esIngresado(a);
      if (ingreso) {
        totalMedicosIngresaron++;
        totalPersonasIngresaron += factorPersonas;
      } else {
        totalPersonasPendientes += factorPersonas;
      }
    });

    const porcentajeAsistencia = totalPersonasInscritas > 0 
      ? Math.round((totalPersonasIngresaron / totalPersonasInscritas) * 100) 
      : 0;

    const limiteAforo = config.limiteAforo || 350;
    const porcentajeAforo = Math.min(100, Math.round((totalPersonasIngresaron / limiteAforo) * 100));

    // Elementos DOM
    const elTotal = document.getElementById("stat-total-inscritos");
    const elIngresaron = document.getElementById("stat-total-asistieron");
    const elPendientes = document.getElementById("stat-total-pendientes");
    const elPorcentaje = document.getElementById("stat-porcentaje-asistencia");
    const elAforoBar = document.getElementById("stat-aforo-bar");
    const elAforoTexto = document.getElementById("stat-aforo-texto");

    if (elTotal) {
      elTotal.innerHTML = `
        <div class="flex items-baseline gap-2">
          <span>${totalPersonasInscritas}</span>
          <span class="text-xs text-slate-400 font-bold">(${totalMedicosInscritos} Médicos • ${totalPasesDobles} Dobles)</span>
        </div>
      `;
    }

    if (elIngresaron) {
      elIngresaron.innerHTML = `
        <div class="flex items-baseline gap-2">
          <span>${totalPersonasIngresaron}</span>
          <span class="text-xs text-emerald-700 font-bold">(${totalMedicosIngresaron} Médicos en Sala)</span>
        </div>
      `;
    }

    if (elPendientes) {
      elPendientes.innerHTML = `
        <div class="flex items-baseline gap-2">
          <span>${totalPersonasPendientes}</span>
          <span class="text-xs text-amber-700 font-bold">(${totalMedicosInscritos - totalMedicosIngresaron} Médicos Pendientes)</span>
        </div>
      `;
    }

    if (elPorcentaje) {
      elPorcentaje.innerHTML = `
        <div class="flex items-baseline gap-2">
          <span>${porcentajeAsistencia}%</span>
          <span class="text-xs text-[#003366] font-bold">(${totalPersonasIngresaron}/${totalPersonasInscritas})</span>
        </div>
      `;
    }

    if (elAforoBar) {
      elAforoBar.style.width = `${porcentajeAforo}%`;
      if (porcentajeAforo > 85) {
        elAforoBar.className = "h-full bg-rose-500 rounded-full transition-all duration-500";
      } else if (porcentajeAforo > 60) {
        elAforoBar.className = "h-full bg-amber-500 rounded-full transition-all duration-500";
      } else {
        elAforoBar.className = "h-full bg-emerald-500 rounded-full transition-all duration-500";
      }
    }

    if (elAforoTexto) {
      elAforoTexto.innerText = `${totalPersonasIngresaron} / ${limiteAforo} personas validadas en sala (${porcentajeAforo}% de aforo)`;
    }
  },

  /**
   * Renderizar la tabla de asistentes
   */
  renderizarTabla() {
    const tbody = document.getElementById("admin-table-body");
    const countBadge = document.getElementById("admin-table-count");
    if (!tbody) return;

    const asistentes = StorageService.getAsistentes();

    // Filtrar
    const filtrados = asistentes.filter(a => {
      const isIngreso = StorageService.esIngresado(a);

      // Filtros por pestaña
      if (filtroActual === "asistieron") {
        if (!isIngreso) return false;
      }
      if (filtroActual === "pendientes") {
        if (isIngreso) return false;
      }

      // Filtro de texto de búsqueda
      if (textoBusqueda) {
        const query = textoBusqueda.toLowerCase();
        const coincide = 
          (a.nombres && String(a.nombres).toLowerCase().includes(query)) ||
          (a.cmp && String(a.cmp).toLowerCase().includes(query)) ||
          (a.dni && String(a.dni).toLowerCase().includes(query)) ||
          (a.idReserva && String(a.idReserva).toLowerCase().includes(query)) ||
          (a.especialidad && String(a.especialidad).toLowerCase().includes(query)) ||
          (a.nombresAcompanantes && String(a.nombresAcompanantes).toLowerCase().includes(query));
        if (!coincide) return false;
      }

      return true;
    });

    if (countBadge) {
      countBadge.innerText = `Mostrando ${filtrados.length} de ${asistentes.length} colegiados registrados`;
    }

    if (filtrados.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-12 text-center text-slate-400">
            <div class="flex flex-col items-center justify-center gap-2">
              <svg class="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <p class="font-medium text-xs">No se encontraron registros que coincidan con los filtros.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtrados.map(a => {
      const isIngreso = StorageService.esIngresado(a);
      const numAcomp = parseInt(a.acompanantes || 0);
      const esDoble = numAcomp > 0;
      const nombreAcomp = (a.nombresAcompanantes && a.nombresAcompanantes !== 'Ninguno') ? a.nombresAcompanantes : '';

      return `
        <tr class="border-b border-slate-100 hover:bg-purple-50/40 transition-colors text-xs">
          <td class="py-3.5 px-4 font-mono font-bold text-slate-800">
            ${a.idReserva}
            <div class="text-[10px] text-slate-400 font-sans font-normal">${a.fechaRegistro || ''}</div>
          </td>
          <td class="py-3.5 px-4">
            <div class="font-bold text-slate-900 leading-tight">${a.nombres}</div>
            <div class="text-xs text-slate-500 mt-0.5">${a.especialidad || 'Médico Cirujano'}</div>
          </td>
          <td class="py-3.5 px-4">
            <span class="inline-block px-2.5 py-1 bg-purple-50 text-[#380036] font-extrabold text-xs rounded-lg border border-purple-200">
              CMP: ${a.cmp}
            </span>
            ${a.dni ? `<div class="text-xs text-slate-500 mt-1">DNI: ${a.dni}</div>` : ''}
          </td>
          <td class="py-3.5 px-4 text-xs text-slate-600">
            <div>📞 ${a.celular || '--'}</div>
            <div class="text-slate-400 text-[11px] truncate max-w-[150px]">${a.correo || ''}</div>
          </td>
          <td class="py-3.5 px-4 text-center">
            <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black ${
              esDoble 
                ? 'bg-amber-100 text-[#380036] border border-amber-300 shadow-2xs' 
                : 'bg-slate-100 text-slate-700 border border-slate-200'
            }">
              ${esDoble ? '🎟️ Pase Doble (2 Pers)' : '👨‍⚕️ Individual (1 Pers)'}
            </span>
            ${esDoble && nombreAcomp ? `<div class="text-[10px] text-purple-900 font-bold mt-1 truncate max-w-[140px] mx-auto" title="${nombreAcomp}">👥 ${nombreAcomp}</div>` : ''}
          </td>
          <td class="py-3.5 px-4 text-center">
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black ${
              isIngreso 
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs' 
                : 'bg-amber-50 text-amber-800 border border-amber-300'
            }">
              <span class="w-2 h-2 rounded-full ${isIngreso ? 'bg-emerald-600 animate-ping' : 'bg-amber-500'}"></span>
              <span>${isIngreso ? `✓ Ingresó (${esDoble ? '2 Pers' : '1 Pers'})` : `Pendiente (${esDoble ? '2 Pers' : '1 Pers'})`}</span>
            </div>
            ${isIngreso && a.fechaIngreso ? `<div class="text-[9.5px] text-slate-400 mt-0.5">${a.fechaIngreso.split(' ')[1] || a.fechaIngreso}</div>` : ''}
          </td>
          <td class="py-3.5 px-4 text-right">
            <div class="flex items-center justify-end gap-1.5">
              <button onclick="AdminService.verBoleto('${a.idReserva}')" title="Ver Pase QR Oficial" class="p-1.5 text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-all">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path>
                </svg>
              </button>

              <button onclick="AdminService.enviarQRWhatsApp('${a.idReserva}')" title="Enviar Pase QR por WhatsApp" class="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all font-bold text-xs">
                📲
              </button>
              
              <button onclick="AdminService.toggleEstado('${a.idReserva}')" 
                title="${isIngreso ? 'Restablecer a Pendiente' : 'Validar Ingreso en Sala'}" 
                class="px-2.5 py-1 ${isIngreso ? 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300' : 'text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200'} rounded-lg transition-all font-bold text-[11px] flex items-center gap-1">
                <span>${isIngreso ? '✓ Validado' : '+ Ingreso'}</span>
              </button>

              <button onclick="AdminService.eliminar('${a.idReserva}')" title="Eliminar registro" class="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-all">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  },

  /**
   * Cambiar manualmente el estado de asistencia (Validar o Restablecer)
   */
  toggleEstado(idReserva) {
    const asistente = StorageService.buscarAsistente(idReserva);
    if (!asistente) return;

    const yaIngreso = StorageService.esIngresado(asistente);
    const esDoble = parseInt(asistente.acompanantes || 0) > 0;

    if (yaIngreso) {
      StorageService.restablecerEstado(idReserva);
      if (typeof SheetsService !== "undefined" && SheetsService.isConfigured()) {
        SheetsService.restablecerEstadoEnSheets(idReserva);
        const act = StorageService.buscarAsistente(idReserva);
        if (act) SheetsService.registrarEnSheets(act).catch(() => {});
      }
      App.showToast(`Estado de ${asistente.nombres} restablecido a Pendiente.`, "info");
    } else {
      StorageService.marcarIngreso(idReserva, "Admin Manual");
      if (typeof SheetsService !== "undefined" && SheetsService.isConfigured()) {
        SheetsService.validarIngresoEnSheets(idReserva, "Admin Manual");
        const act = StorageService.buscarAsistente(idReserva);
        if (act) SheetsService.registrarEnSheets(act).catch(() => {});
      }
      App.showToast(`¡Ingreso de ${asistente.nombres} (${esDoble ? '2 Personas' : '1 Persona'}) validado exitosamente!`, "success");
      if (typeof QRManager !== "undefined") {
        QRManager.reproducirSonido("success");
      }
    }

    this.actualizarEstadisticas();
    this.renderizarTabla();
  },

  /**
   * Enviar directamente el Pase QR por WhatsApp al médico colegiado
   */
  enviarQRWhatsApp(idReserva) {
    const asistente = StorageService.buscarAsistente(idReserva);
    if (!asistente) return;

    if (typeof QRManager !== "undefined") {
      QRManager.compartirWhatsApp(asistente);
    }
  },

  enviarQRTitularWhatsApp(idReserva) {
    this.enviarQRWhatsApp(idReserva);
  },

  /**
   * Ver y abrir el carnet digital de un asistente
   */
  verBoleto(idReserva) {
    const asistente = StorageService.buscarAsistente(idReserva);
    if (!asistente) {
      App.showToast("Boleto no encontrado", "error");
      return;
    }

    StorageService.guardarUltimaReserva(asistente);
    QRManager.renderizarTicket(asistente, "ticket-container");
    App.cambiarPestana("boleto");
  },

  /**
   * Eliminar un registro de asistente en el aplicativo y en Google Sheets
   */
  async eliminar(idReserva) {
    const asistente = StorageService.buscarAsistente(idReserva);
    if (!asistente) return;

    if (confirm(`¿Está seguro de eliminar el registro de ${asistente.nombres} (CMP: ${asistente.cmp})?\n\n⚠️ Esta acción eliminará permanentemente la reserva tanto del aplicativo como de la hoja de Google Sheets.`)) {
      const cmp = asistente.cmp || "";

      StorageService.eliminarAsistente(idReserva);
      this.actualizarEstadisticas();
      this.renderizarTabla();
      App.cargarListaAsistentesEnTicket();
      App.showToast("Eliminando de la aplicación y de Google Sheets...", "info");

      if (typeof SheetsService !== "undefined" && SheetsService.isConfigured()) {
        try {
          const res = await SheetsService.eliminarEnSheets(idReserva, cmp);
          if (res && res.success) {
            App.showToast("¡Registro eliminado con éxito de Google Sheets y del aplicativo!", "success");
          } else {
            App.showToast(res?.mensaje || "Registro eliminado del aplicativo.", "info");
          }
        } catch (err) {
          console.error("Error al eliminar en Sheets:", err);
          App.showToast("Registro eliminado del aplicativo.", "info");
        }
      } else {
        App.showToast("Registro eliminado del aplicativo.", "success");
      }
    }
  },

  /**
   * Exportar todos los asistentes a un archivo Excel (.xlsx) oficial
   */
  exportarExcel() {
    const asistentes = StorageService.getAsistentes();
    if (asistentes.length === 0) {
      App.showToast("No hay registros de asistentes para exportar.", "warning");
      return;
    }

    if (typeof XLSX === "undefined") {
      App.showToast("Librería de exportación no cargada. Intente nuevamente.", "error");
      return;
    }

    try {
      const dataExport = asistentes.map((a, idx) => {
        const esDoble = parseInt(a.acompanantes || 0) > 0;
        const isIngreso = StorageService.esIngresado(a);

        return {
          "N°": idx + 1,
          "ID RESERVA": a.idReserva,
          "FECHA REGISTRO": a.fechaRegistro || "",
          "N° CMP": a.cmp || "",
          "DNI": a.dni || "",
          "NOMBRES Y APELLIDOS": a.nombres,
          "ESPECIALIDAD / CARGO": a.especialidad || "Médico Cirujano",
          "CELULAR": a.celular,
          "CORREO ELECTRÓNICO": a.correo || "",
          "MODALIDAD DE PASE": esDoble ? "Pase Doble (2 Personas)" : "Pase Individual (1 Persona)",
          "PERSONAS AUTORIZADAS": esDoble ? 2 : 1,
          "NOMBRES ACOMPAÑANTE": esDoble ? (a.nombresAcompanantes || "Acompañante Registrado") : "Ninguno",
          "ESTADO ASISTENCIA": isIngreso ? `Ingresó (${esDoble ? '2 Personas' : '1 Persona'})` : "Pendiente",
          "HORA DE INGRESO": a.fechaIngreso || "Aún no ingresa",
          "VALIDADO POR": a.validadoPor || "",
          "CÓDIGO QR / HASH": a.qrHash || a.qrTitular || a.idReserva
        };
      });

      const ws = XLSX.utils.json_to_sheet(dataExport);

      ws["!cols"] = [
        { wch: 5 },  // N°
        { wch: 20 }, // ID Reserva
        { wch: 20 }, // Fecha Registro
        { wch: 12 }, // CMP
        { wch: 12 }, // DNI
        { wch: 35 }, // Nombres
        { wch: 25 }, // Especialidad
        { wch: 15 }, // Celular
        { wch: 28 }, // Correo
        { wch: 26 }, // Modalidad
        { wch: 22 }, // Personas Autorizadas
        { wch: 28 }, // Nombres Acomp
        { wch: 24 }, // Estado Asistencia
        { wch: 22 }, // Hora Ingreso
        { wch: 20 }, // Validado por
        { wch: 28 }  // QR Hash
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Padrón Oficial Asistencia CMP");

      const fechaActual = new Date().toISOString().slice(0, 10);
      const filename = `Reporte_Asistencia_Evento_CMP_Pasco_${fechaActual}.xlsx`;

      XLSX.writeFile(wb, filename);
      App.showToast("¡Archivo Excel oficial exportado exitosamente!", "success");
    } catch (e) {
      console.error("Error al exportar Excel:", e);
      App.showToast("Ocurrió un error al generar el archivo Excel.", "error");
    }
  },

  /**
   * Exportar Informe Ejecutivo en formato PDF con Gráficos Vectoriales y Métricas de Auditoría
   */
  async exportarPDF() {
    const asistentes = StorageService.getAsistentes();
    if (!asistentes || asistentes.length === 0) {
      App.showToast("No hay registros de asistentes para generar el informe PDF.", "warning");
      return;
    }

    if (typeof html2canvas === "undefined" || (typeof jspdf === "undefined" && typeof jsPDF === "undefined")) {
      App.showToast("Librerías de exportación PDF no disponibles. Verifique su conexión.", "error");
      return;
    }

    const btnPdf = document.getElementById("btn-export-pdf");
    const originalBtnText = btnPdf ? btnPdf.innerHTML : "";
    if (btnPdf) {
      btnPdf.disabled = true;
      btnPdf.innerHTML = `
        <svg class="animate-spin w-4 h-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        <span>Generando PDF...</span>
      `;
    }

    App.showToast("Generando reporte ejecutivo institucional con gráficos...", "info");

    try {
      const config = (typeof APP_CONFIG !== "undefined" && APP_CONFIG.getEventoConfig) ? APP_CONFIG.getEventoConfig() : {};
      const limiteAforo = config.limiteAforo || 350;

      let totalMedicos = asistentes.length;
      let totalPasesDobles = 0;
      let totalPasesIndividuales = 0;
      let totalPersonasInscritas = 0;
      let totalMedicosIngresaron = 0;
      let totalPersonasIngresaron = 0;

      asistentes.forEach(a => {
        const numAcomp = parseInt(a.acompanantes || 0);
        const esDoble = numAcomp > 0;
        const factor = esDoble ? 2 : 1;

        if (esDoble) totalPasesDobles++;
        else totalPasesIndividuales++;

        totalPersonasInscritas += factor;

        if (StorageService.esIngresado(a)) {
          totalMedicosIngresaron++;
          totalPersonasIngresaron += factor;
        }
      });

      const totalPersonasPendientes = totalPersonasInscritas - totalPersonasIngresaron;
      const pctAsistencia = totalPersonasInscritas > 0 ? Math.round((totalPersonasIngresaron / totalPersonasInscritas) * 100) : 0;
      const pctPendiente = 100 - pctAsistencia;
      const pctAforo = Math.min(100, Math.round((totalPersonasIngresaron / limiteAforo) * 100));
      const pctPaseDoble = totalMedicos > 0 ? Math.round((totalPasesDobles / totalMedicos) * 100) : 0;
      const pctPaseIndiv = 100 - pctPaseDoble;

      // Fechas para encabezado
      const ahora = new Date();
      const fechaFormato = ahora.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const horaFormato = ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      const codigoReporte = `RPT-CMP-${ahora.getFullYear()}${String(ahora.getMonth() + 1).padStart(2, '0')}${String(ahora.getDate()).padStart(2, '0')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      // Cálculos para gráficos SVG Donut (Circunferencia = 2 * PI * 48 = 301.6)
      const circ = 301.6;
      const arcAsist = ((pctAsistencia / 100) * circ).toFixed(1);
      const arcPend = ((pctPendiente / 100) * circ).toFixed(1);
      const arcDoble = ((pctPaseDoble / 100) * circ).toFixed(1);
      const arcIndiv = ((pctPaseIndiv / 100) * circ).toFixed(1);

      // Obtener logo
      let logoSrc = "assets/logo.png";
      const imgHeader = document.getElementById("header-logo-img");
      if (imgHeader && imgHeader.src) {
        logoSrc = imgHeader.src;
      }

      // Eliminar contenedor temporal previo si existe
      const prevReport = document.getElementById("temp-executive-report");
      if (prevReport) prevReport.remove();

      const reportContainer = document.createElement("div");
      reportContainer.id = "temp-executive-report";
      reportContainer.style.position = "absolute";
      reportContainer.style.left = "-9999px";
      reportContainer.style.top = "0";
      reportContainer.style.width = "850px";
      reportContainer.style.backgroundColor = "#ffffff";
      reportContainer.style.color = "#1e293b";
      reportContainer.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
      reportContainer.style.padding = "24px 28px";
      reportContainer.style.boxSizing = "border-box";

      // Renderizado de filas de la tabla
      const filasTablaHTML = asistentes.map((a, idx) => {
        const esDoble = parseInt(a.acompanantes || 0) > 0;
        const isIngreso = StorageService.esIngresado(a);
        const bgFila = idx % 2 === 0 ? "#f8fafc" : "#ffffff";

        const badgeIngreso = isIngreso
          ? `<span style="background:#dcfce7; color:#15803d; font-weight:800; padding:3px 8px; border-radius:6px; font-size:10px; display:inline-block; border:1px solid #86efac;">✓ INGRESÓ (${esDoble ? '2 Pers' : '1 Pers'})</span>`
          : `<span style="background:#fef2f2; color:#b91c1c; font-weight:700; padding:3px 8px; border-radius:6px; font-size:10px; display:inline-block; border:1px solid #fecaca;">PENDIENTE</span>`;

        return `
          <tr style="background:${bgFila}; border-bottom: 1px solid #e2e8f0; font-size: 11px;">
            <td style="padding: 7px 6px; text-align: center; font-weight: 700; color: #64748b;">${idx + 1}</td>
            <td style="padding: 7px 6px; font-family: monospace; font-weight: 700; color: #3b0764;">${a.idReserva || '—'}</td>
            <td style="padding: 7px 6px; font-weight: 800; color: #0f172a; text-align: center;">${a.cmp || '—'}</td>
            <td style="padding: 7px 6px; color: #475569; text-align: center;">${a.dni || '—'}</td>
            <td style="padding: 7px 6px; font-weight: 700; color: #0f172a;">
              <div>${a.nombres || '—'}</div>
              <div style="font-size: 9px; color: #64748b; font-weight: 400;">${a.especialidad || 'Médico Cirujano'}</div>
            </td>
            <td style="padding: 7px 6px; text-align: center;">
              ${esDoble 
                ? `<span style="background:#fef3c7; color:#92400e; font-weight:800; padding:2px 8px; border-radius:5px; font-size:10px; border:1px solid #fde68a;">🎟️ Pase Doble (2 Pers)</span><div style="font-size:9px; color:#7e22ce; margin-top:2px;">👥 ${a.nombresAcompanantes || 'Acompañante'}</div>`
                : `<span style="background:#f1f5f9; color:#475569; font-weight:700; padding:2px 8px; border-radius:5px; font-size:10px;">👨‍⚕️ Individual (1 Pers)</span>`}
            </td>
            <td style="padding: 7px 6px; text-align: center;">${badgeIngreso}</td>
            <td style="padding: 7px 6px; text-align: center; color:#64748b; font-size:10px;">${a.fechaIngreso || '—'}</td>
          </tr>
        `;
      }).join("");

      reportContainer.innerHTML = `
        <!-- CABECERA INSTITUCIONAL -->
        <div style="background: linear-gradient(135deg, #200530 0%, #3b0764 60%, #4a044e 100%); border-radius: 14px; padding: 18px 22px; color: #ffffff; border: 2px solid #dfb76c; box-shadow: 0 4px 12px rgba(0,0,0,0.15); margin-bottom: 20px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 16px;">
              <div style="width: 68px; height: 68px; background: #ffffff; border-radius: 12px; padding: 4px; display: flex; align-items: center; justify-content: center; border: 2px solid #dfb76c; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
                <img src="${logoSrc}" alt="Logo CMP" style="max-width: 100%; max-height: 100%; object-fit: contain;">
              </div>
              <div>
                <div style="color: #dfb76c; font-size: 13px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase;">Colegio Médico del Perú</div>
                <div style="color: #ffffff; font-size: 18px; font-weight: 900; letter-spacing: 0.5px;">CONSEJO REGIONAL XX PASCO</div>
                <div style="display: inline-block; background: #dfb76c; color: #200530; font-size: 11px; font-weight: 900; padding: 2px 8px; border-radius: 5px; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
                  Reporte Ejecutivo Oficial de Asistencia & Aforo
                </div>
              </div>
            </div>
            <div style="text-align: right; background: rgba(255,255,255,0.08); padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(223, 183, 108, 0.4);">
              <div style="font-size: 10px; color: #e9d5ff; text-transform: uppercase; font-weight: 700;">Código de Auditoría</div>
              <div style="font-size: 12px; font-weight: 800; color: #fef08a; font-family: monospace;">${codigoReporte}</div>
              <div style="font-size: 10px; color: #cbd5e1; margin-top: 4px;">📅 ${fechaFormato} | ⏰ ${horaFormato}</div>
            </div>
          </div>
        </div>

        <!-- METADATOS DEL EVENTO -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px;">
            <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 800;">Lugar del Evento</div>
            <div style="font-size: 12px; font-weight: 800; color: #0f172a; margin-top: 2px;">C.C. La Katedral</div>
            <div style="font-size: 9.5px; color: #94a3b8;">Pasco, Perú</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px;">
            <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 800;">Capacidad de Aforo</div>
            <div style="font-size: 12px; font-weight: 800; color: #0f172a; margin-top: 2px;">${limiteAforo} Personas</div>
            <div style="font-size: 9.5px; color: #94a3b8;">Límite reglamentario</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px;">
            <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 800;">Acceso / Entrada</div>
            <div style="font-size: 12px; font-weight: 800; color: #059669; margin-top: 2px;">100% Gratuito</div>
            <div style="font-size: 9.5px; color: #94a3b8;">Colegiados e Invitados</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px;">
            <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 800;">Control en Puerta</div>
            <div style="font-size: 12px; font-weight: 800; color: #0284c7; margin-top: 2px;">Código QR Único</div>
            <div style="font-size: 9.5px; color: #94a3b8;">Validez 1 o 2 Personas</div>
          </div>
        </div>

        <!-- TARJETAS KPI RESUMEN EJECUTIVO -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
          <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-top: 4px solid #3b0764; border-radius: 12px; padding: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.03);">
            <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">Personas Inscritas</div>
            <div style="font-size: 26px; font-weight: 900; color: #1e1b4b; margin: 4px 0 2px 0;">${totalPersonasInscritas}</div>
            <div style="font-size: 10px; color: #64748b;">
              <span style="color:#7e22ce; font-weight:700;">${totalMedicos}</span> médicos colegiados
            </div>
          </div>

          <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-top: 4px solid #059669; border-radius: 12px; padding: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.03);">
            <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #059669; letter-spacing: 0.5px;">Personas en Sala</div>
            <div style="font-size: 26px; font-weight: 900; color: #059669; margin: 4px 0 2px 0;">
              ${totalPersonasIngresaron} <span style="font-size: 14px; font-weight: 700; color: #10b981;">(${pctAsistencia}%)</span>
            </div>
            <div style="font-size: 10px; color: #64748b;">
              <span style="color:#059669; font-weight:700;">${totalMedicosIngresaron}</span> médicos presentes
            </div>
          </div>

          <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-top: 4px solid #d97706; border-radius: 12px; padding: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.03);">
            <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #d97706; letter-spacing: 0.5px;">Personas Pendientes</div>
            <div style="font-size: 26px; font-weight: 900; color: #d97706; margin: 4px 0 2px 0;">
              ${totalPersonasPendientes} <span style="font-size: 13px; font-weight: 700; color: #64748b;">(${pctPendiente}%)</span>
            </div>
            <div style="font-size: 10px; color: #64748b;">
              Por ingresar en portería
            </div>
          </div>

          <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-top: 4px solid #0284c7; border-radius: 12px; padding: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.03);">
            <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #0284c7; letter-spacing: 0.5px;">Ocupación de Aforo</div>
            <div style="font-size: 24px; font-weight: 900; color: #0284c7; margin: 4px 0 2px 0;">
              ${pctAforo}%
            </div>
            <div style="font-size: 10px; color: #64748b;">
              ${totalPersonasIngresaron} de ${limiteAforo} asientos
            </div>
          </div>
        </div>

        <!-- PANEL DE GRÁFICOS ANALÍTICOS (SVG) -->
        <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 18px; margin-bottom: 22px; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 10px; margin-bottom: 16px;">
            <div style="font-size: 13px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
              📊 Análisis Gráfico de Asistencia y Modalidades de Pase
            </div>
            <div style="font-size: 10px; color: #64748b; font-weight: 600;">
              Métricas calculadas en tiempo real
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
            
            <!-- GRÁFICO 1: ASISTENCIA GENERAL -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; text-align: center;">
              <div style="font-size: 12px; font-weight: 800; color: #1e293b; margin-bottom: 8px;">Asistencia Total de Personas</div>
              <div style="position: relative; width: 130px; height: 130px; margin: 0 auto;">
                <svg viewBox="0 0 120 120" width="130" height="130" style="transform: rotate(-90deg);">
                  <circle cx="60" cy="60" r="48" fill="none" stroke="#e2e8f0" stroke-width="18" />
                  <circle cx="60" cy="60" r="48" fill="none" stroke="#059669" stroke-width="18"
                    stroke-dasharray="${arcAsist} 301.6" stroke-dashoffset="0" />
                  <circle cx="60" cy="60" r="48" fill="none" stroke="#d97706" stroke-width="18"
                    stroke-dasharray="${arcPend} 301.6" stroke-dashoffset="${-arcAsist}" />
                </svg>
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                  <span style="font-size: 20px; font-weight: 900; color: #0f172a; line-height: 1;">${pctAsistencia}%</span>
                  <span style="font-size: 9px; font-weight: 700; color: #64748b; margin-top: 2px;">ASISTENCIA</span>
                </div>
              </div>

              <div style="margin-top: 12px; font-size: 11px; text-align: left; display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <span style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 8px; height: 8px; background: #059669; border-radius: 50%; display: inline-block;"></span>
                    <span style="color: #334155; font-weight: 600;">En Sala</span>
                  </span>
                  <span style="font-weight: 800; color: #059669;">${totalPersonasIngresaron} (${pctAsistencia}%)</span>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <span style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 8px; height: 8px; background: #d97706; border-radius: 50%; display: inline-block;"></span>
                    <span style="color: #334155; font-weight: 600;">Pendientes</span>
                  </span>
                  <span style="font-weight: 800; color: #d97706;">${totalPersonasPendientes} (${pctPendiente}%)</span>
                </div>
              </div>
            </div>

            <!-- GRÁFICO 2: MODALIDADES (PASE DOBLE VS INDIVIDUAL) -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; text-align: center;">
              <div style="font-size: 12px; font-weight: 800; color: #1e293b; margin-bottom: 8px;">Modalidades de Pase</div>
              <div style="position: relative; width: 130px; height: 130px; margin: 0 auto;">
                <svg viewBox="0 0 120 120" width="130" height="130" style="transform: rotate(-90deg);">
                  <circle cx="60" cy="60" r="48" fill="none" stroke="#e2e8f0" stroke-width="18" />
                  <circle cx="60" cy="60" r="48" fill="none" stroke="#dfb76c" stroke-width="18"
                    stroke-dasharray="${arcDoble} 301.6" stroke-dashoffset="0" />
                  <circle cx="60" cy="60" r="48" fill="none" stroke="#3b0764" stroke-width="18"
                    stroke-dasharray="${arcIndiv} 301.6" stroke-dashoffset="${-arcDoble}" />
                </svg>
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                  <span style="font-size: 19px; font-weight: 900; color: #0f172a; line-height: 1;">${totalMedicos}</span>
                  <span style="font-size: 9px; font-weight: 700; color: #64748b; margin-top: 2px;">COLEGIADOS</span>
                </div>
              </div>

              <div style="margin-top: 12px; font-size: 11px; text-align: left; display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <span style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 8px; height: 8px; background: #dfb76c; border-radius: 50%; display: inline-block;"></span>
                    <span style="color: #334155; font-weight: 600;">Pases Dobles (2 Pers)</span>
                  </span>
                  <span style="font-weight: 800; color: #92400e;">${totalPasesDobles} (${pctPaseDoble}%)</span>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <span style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 8px; height: 8px; background: #3b0764; border-radius: 50%; display: inline-block;"></span>
                    <span style="color: #334155; font-weight: 600;">Individuales (1 Pers)</span>
                  </span>
                  <span style="font-weight: 800; color: #3b0764;">${totalPasesIndividuales} (${pctPaseIndiv}%)</span>
                </div>
              </div>
            </div>

          </div>

          <!-- BARRA DE PROGRESO DE AFORO -->
          <div style="margin-top: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-size: 11px; font-weight: 800; color: #1e293b;">Ocupación de Sala C.C. La Katedral (${totalPersonasIngresaron} de ${limiteAforo} personas)</span>
              <span style="font-size: 11px; font-weight: 900; color: ${pctAforo > 80 ? '#dc2626' : '#059669'};">${pctAforo}% Ocupado</span>
            </div>
            <div style="width: 100%; height: 12px; background: #e2e8f0; border-radius: 9999px; overflow: hidden;">
              <div style="width: ${pctAforo}%; height: 100%; background: ${pctAforo > 80 ? 'linear-gradient(90deg, #f59e0b, #dc2626)' : 'linear-gradient(90deg, #10b981, #059669)'}; border-radius: 9999px;"></div>
            </div>
          </div>
        </div>

        <!-- TABLA DETALLADA DE ASISTENTES -->
        <div style="margin-bottom: 24px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <div style="font-size: 13px; font-weight: 900; color: #0f172a; text-transform: uppercase;">
              📋 Padrón Detallado de Asistencia (${asistentes.length} Registros)
            </div>
            <div style="font-size: 10px; color: #64748b;">
              Ordenado cronológicamente
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; text-align: left; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background: #200530; color: #dfb76c; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">
                <th style="padding: 8px 6px; text-align: center; border-right: 1px solid rgba(223, 183, 108, 0.3);">N°</th>
                <th style="padding: 8px 6px; text-align: left; border-right: 1px solid rgba(223, 183, 108, 0.3);">ID Reserva</th>
                <th style="padding: 8px 6px; text-align: center; border-right: 1px solid rgba(223, 183, 108, 0.3);">CMP</th>
                <th style="padding: 8px 6px; text-align: center; border-right: 1px solid rgba(223, 183, 108, 0.3);">DNI</th>
                <th style="padding: 8px 6px; text-align: left; border-right: 1px solid rgba(223, 183, 108, 0.3);">Médico Titular</th>
                <th style="padding: 8px 6px; text-align: center; border-right: 1px solid rgba(223, 183, 108, 0.3);">Modalidad</th>
                <th style="padding: 8px 6px; text-align: center; border-right: 1px solid rgba(223, 183, 108, 0.3);">Estado Asistencia</th>
                <th style="padding: 8px 6px; text-align: center;">Hora Ingreso</th>
              </tr>
            </thead>
            <tbody>
              ${filasTablaHTML}
            </tbody>
          </table>
        </div>

        <!-- SECCIÓN DE FIRMAS Y CERTIFICACIÓN OFICIAL -->
        <div style="margin-top: 30px; page-break-inside: avoid; border-top: 2px dashed #cbd5e1; padding-top: 24px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="font-size: 11px; font-weight: 700; color: #475569;">
              El presente informe ha sido validado y certificado digitalmente mediante el Sistema de Control de Accesos por Código QR del Colegio Médico del Perú - Consejo Regional XX Pasco.
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center;">
            <div>
              <div style="border-bottom: 1.5px solid #475569; width: 80%; margin: 0 auto 8px auto; height: 40px;"></div>
              <div style="font-size: 11px; font-weight: 800; color: #0f172a;">Decano(a) Regional</div>
              <div style="font-size: 9.5px; color: #64748b;">CMP Consejo Regional XX Pasco</div>
            </div>
            <div>
              <div style="border-bottom: 1.5px solid #475569; width: 80%; margin: 0 auto 8px auto; height: 40px;"></div>
              <div style="font-size: 11px; font-weight: 800; color: #0f172a;">Comisión Organizadora</div>
              <div style="font-size: 9.5px; color: #64748b;">Día de la Medicina Peruana</div>
            </div>
            <div>
              <div style="border-bottom: 1.5px solid #475569; width: 80%; margin: 0 auto 8px auto; height: 40px;"></div>
              <div style="font-size: 11px; font-weight: 800; color: #0f172a;">Control de Accesos</div>
              <div style="font-size: 9.5px; color: #64748b;">Validación en Puerta (QR)</div>
            </div>
          </div>

          <div style="text-align: center; margin-top: 24px; font-size: 9px; color: #94a3b8;">
            Generado automáticamente por el Sistema Integral de Eventos y Reservas CMP Pasco • Documento Oficial de Consulta y Auditoría
          </div>
        </div>
      `;

      document.body.appendChild(reportContainer);

      await new Promise(resolve => setTimeout(resolve, 350));

      const canvas = await html2canvas(reportContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff"
      });

      if (reportContainer.parentNode) {
        reportContainer.parentNode.removeChild(reportContainer);
      }

      const JsPDFClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
      if (!JsPDFClass) {
        throw new Error("Librería jsPDF no encontrada.");
      }

      const pdf = new JsPDFClass('p', 'mm', 'a4');
      const pdfWidth = 210; // mm
      const pdfHeight = 297; // mm
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const totalPdfHeight = (canvasHeight * pdfWidth) / canvasWidth;

      let heightLeft = totalPdfHeight;
      let position = 0;

      const imgData = canvas.toDataURL('image/jpeg', 0.98);

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, totalPdfHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position -= pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, totalPdfHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;
      }

      const nombreArchivo = `Reporte_Ejecutivo_CMP_Pasco_${ahora.getFullYear()}${String(ahora.getMonth() + 1).padStart(2, '0')}${String(ahora.getDate()).padStart(2, '0')}_${String(ahora.getHours()).padStart(2, '0')}${String(ahora.getMinutes()).padStart(2, '0')}.pdf`;
      pdf.save(nombreArchivo);

      App.showToast("¡Reporte ejecutivo en PDF con gráficos exportado exitosamente!", "success");
    } catch (err) {
      console.error("Error al generar reporte PDF:", err);
      App.showToast("Ocurrió un error al generar el reporte PDF: " + (err.message || err), "error");
    } finally {
      if (btnPdf) {
        btnPdf.disabled = false;
        btnPdf.innerHTML = originalBtnText;
      }
    }
  }
};
