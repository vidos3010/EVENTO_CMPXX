/**
 * =========================================================================================
 * MÓDULO DE ADMINISTRACIÓN, ASISTENCIA Y VALIDACIÓN DE COMPROBANTES DE PAGO
 * COLEGIO MÉDICO DEL PERÚ - CONSEJO REGIONAL XX PASCO
 * =========================================================================================
 */

let filtroActual = "todos";
let textoBusqueda = "";

const AdminService = {
  voucherSeleccionadoId: null,

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

    // Filtros por estado y pagos
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

    // Botón aprobar pago en el modal de voucher
    const btnAprobarModal = document.getElementById("btn-aprobar-voucher-modal");
    if (btnAprobarModal) {
      btnAprobarModal.addEventListener("click", () => {
        if (this.voucherSeleccionadoId) {
          const idParaAprobar = this.voucherSeleccionadoId;
          this.aprobarPago(idParaAprobar);
          // Refrescar el modal mostrando el estado aprobado (imagen del voucher sigue visible)
          this.verVoucher(idParaAprobar);
        }
      });
    }

    // Soporte para pegar voucher desde portapapeles (Ctrl+V) cuando el modal está abierto
    document.addEventListener("paste", (e) => {
      const modal = document.getElementById("modal-ver-voucher");
      if (!modal || modal.classList.contains("hidden") || !this.voucherSeleccionadoId) return;

      const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            this.procesarArchivoVoucher(file);
            break;
          }
        }
      }
    });

    // Soporte para arrastrar y soltar (Drag & Drop) sobre el contenedor del voucher
    const dropZone = document.getElementById("modal-voucher-img-container");
    if (dropZone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.add("border-purple-600", "bg-purple-100/50");
        }, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.remove("border-purple-600", "bg-purple-100/50");
        }, false);
      });

      dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!this.voucherSeleccionadoId) return;
        const dt = e.dataTransfer;
        const files = dt?.files;
        if (files && files.length > 0) {
          const file = files[0];
          if (file.type.startsWith("image/")) {
            this.procesarArchivoVoucher(file);
          } else {
            App.showToast("Por favor arrastra un archivo de imagen válido (JPG o PNG).", "warning");
          }
        }
      }, false);
    }

    // Cerrar lightbox o modal con tecla Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const lightbox = document.getElementById("modal-lightbox-voucher");
        if (lightbox && !lightbox.classList.contains("hidden")) {
          this.cerrarLightboxVoucher();
        } else {
          this.cerrarModalVoucher();
        }
      }
    });

    // Cerrar lightbox al hacer clic en el fondo
    const lightboxModal = document.getElementById("modal-lightbox-voucher");
    if (lightboxModal) {
      lightboxModal.addEventListener("click", (e) => {
        if (e.target === lightboxModal) {
          this.cerrarLightboxVoucher();
        }
      });
    }
  },

  /**
   * Actualizar tarjetas de estadísticas e indicadores de aforo y recaudación
   * Conteo individual y conjunto de Médicos Titulares y Acompañantes
   */
  actualizarEstadisticas() {
    const asistentes = StorageService.getAsistentes();
    const config = APP_CONFIG.getEventoConfig();

    let totalTitularesInscritos = 0;
    let totalAcompInscritos = 0;
    let totalPersonasInscritas = 0;

    let totalTitularesIngresaron = 0;
    let totalAcompIngresaron = 0;
    let totalIngresaronGeneral = 0; // Total personas que ingresaron efectivamente (Titulares + Acompañantes)

    let totalTitularesPendientes = 0;
    let totalAcompPendientes = 0;
    let totalPendientesGeneral = 0;

    let totalRecaudado = 0;

    asistentes.forEach(a => {
      totalTitularesInscritos++;
      const numAcomp = parseInt(a.acompanantes || 0);
      if (numAcomp > 0) {
        totalAcompInscritos += numAcomp;
      }

      const titularIngreso = StorageService.esIngresado(a, "titular");
      const acompIngreso = numAcomp > 0 && StorageService.esIngresado(a, "acompanante");

      if (titularIngreso) {
        totalTitularesIngresaron++;
        totalIngresaronGeneral++;
      } else {
        totalTitularesPendientes++;
        totalPendientesGeneral++;
      }

      if (numAcomp > 0) {
        if (acompIngreso) {
          totalAcompIngresaron++;
          totalIngresaronGeneral++;
        } else {
          totalAcompPendientes++;
          totalPendientesGeneral++;
        }

        if (a.estadoPago === "Aprobado" || a.estadoPago === "Pagado") {
          totalRecaudado += (a.montoPago !== undefined ? parseFloat(a.montoPago) : (numAcomp * 20));
        }
      }
    });

    totalPersonasInscritas = totalTitularesInscritos + totalAcompInscritos;

    const porcentajeAsistencia = totalPersonasInscritas > 0 
      ? Math.round((totalIngresaronGeneral / totalPersonasInscritas) * 100) 
      : 0;

    const limiteAforo = config.limiteAforo || 350;
    const porcentajeAforo = Math.min(100, Math.round((totalIngresaronGeneral / limiteAforo) * 100));

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
          <span class="text-xs text-slate-400 font-bold">(${totalTitularesInscritos} Méd. + ${totalAcompInscritos} Acomp.)</span>
        </div>
      `;
    }

    if (elIngresaron) {
      elIngresaron.innerHTML = `
        <div class="flex items-baseline gap-2">
          <span>${totalIngresaronGeneral}</span>
          <span class="text-xs text-emerald-700 font-bold">(👨‍⚕️ ${totalTitularesIngresaron} Tit. + 🎟️ ${totalAcompIngresaron} Acomp.)</span>
        </div>
      `;
    }

    if (elPendientes) {
      elPendientes.innerHTML = `
        <div class="flex items-baseline gap-2">
          <span>${totalPendientesGeneral}</span>
          <span class="text-xs text-amber-700 font-bold">(⏳ ${totalTitularesPendientes} Tit. + ⏳ ${totalAcompPendientes} Acomp.)</span>
        </div>
      `;
    }

    if (elPorcentaje) {
      elPorcentaje.innerHTML = `
        <div class="flex items-baseline gap-2">
          <span>${porcentajeAsistencia}%</span>
          <span class="text-xs text-[#003366] font-bold">(${totalIngresaronGeneral}/${totalPersonasInscritas})</span>
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
      elAforoTexto.innerText = `${totalIngresaronGeneral} / ${limiteAforo} personas validadas en sala (${porcentajeAforo}% de aforo)`;
    }
  },

  /**
   * Renderizar la tabla de asistentes con columnas de Asistencia y Pago
   */
  renderizarTabla() {
    const tbody = document.getElementById("admin-table-body");
    const countBadge = document.getElementById("admin-table-count");
    if (!tbody) return;

    const asistentes = StorageService.getAsistentes();

    // Filtrar
    const filtrados = asistentes.filter(a => {
      const isIngresoTitular = StorageService.esIngresado(a, "titular");
      const numAcomp = parseInt(a.acompanantes || 0);
      const isIngresoAcomp = numAcomp > 0 && StorageService.esIngresado(a, "acompanante");

      // Filtros por pestaña
      if (filtroActual === "asistieron") {
        if (!isIngresoTitular && !isIngresoAcomp) return false;
      }
      if (filtroActual === "pendientes") {
        const titularPendiente = !isIngresoTitular;
        const acompPendiente = numAcomp > 0 && !isIngresoAcomp;
        if (!titularPendiente && !acompPendiente) return false;
      }
      if (filtroActual === "voucher-pendiente") {
        const tieneAcomp = numAcomp > 0;
        const noAprobado = a.estadoPago !== "Aprobado" && a.estadoPago !== "Pagado";
        if (!tieneAcomp || !noAprobado) return false;
      }

      // Filtro de texto de búsqueda
      if (textoBusqueda) {
        const query = textoBusqueda.toLowerCase();
        const coincide = 
          (a.nombres && String(a.nombres).toLowerCase().includes(query)) ||
          (a.cmp && String(a.cmp).toLowerCase().includes(query)) ||
          (a.dni && String(a.dni).toLowerCase().includes(query)) ||
          (a.idReserva && String(a.idReserva).toLowerCase().includes(query)) ||
          (a.nroOperacion && String(a.nroOperacion).toLowerCase().includes(query)) ||
          (a.especialidad && String(a.especialidad).toLowerCase().includes(query)) ||
          (a.nombresAcompanantes && String(a.nombresAcompanantes).toLowerCase().includes(query));
        if (!coincide) return false;
      }

      return true;
    });

    if (countBadge) {
      countBadge.innerText = `Mostrando ${filtrados.length} de ${asistentes.length} reservas`;
    }

    if (filtrados.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="py-12 text-center text-slate-400">
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
      const isIngresoTitular = StorageService.esIngresado(a, "titular");
      const numAcomp = parseInt(a.acompanantes || 0);
      const isIngresoAcomp = numAcomp > 0 && StorageService.esIngresado(a, "acompanante");
      const isPagado = a.estadoPago === "Aprobado" || a.estadoPago === "Pagado";
      const monto = a.montoPago !== undefined ? a.montoPago : (numAcomp * 20);
      const hasVoucher = Boolean(
        a.tieneVoucher ||
        (a.voucherImg && String(a.voucherImg).trim() !== "") ||
        (a.enlaceVoucherDrive && String(a.enlaceVoucherDrive).trim() !== "")
      );

      // Render de la columna de Pago / Voucher con Evidencia clara
      let pagoHTML = "";
      if (numAcomp === 0) {
        pagoHTML = `
          <span class="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 font-bold rounded-lg text-[11px]">
            <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Gratuito (Titular)
          </span>
        `;
      } else if (hasVoucher) {
        pagoHTML = `
          <div class="text-center space-y-1">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 ${isPagado ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-purple-100 text-purple-900 border-purple-300'} font-extrabold rounded-lg text-[11px] border">
              <span class="w-1.5 h-1.5 rounded-full ${isPagado ? 'bg-emerald-500' : 'bg-purple-600'}"></span>
              ${isPagado ? `✓ Pagado S/ ${monto}.00` : `📸 Voucher Adjunto (S/ ${monto}.00)`}
            </span>
            <div class="flex items-center justify-center gap-1">
              <button onclick="AdminService.verVoucher('${a.idReserva}')" class="text-[10px] bg-white border border-purple-300 text-purple-900 font-bold px-2 py-0.5 rounded hover:bg-purple-50 shadow-2xs flex items-center gap-1">
                👁️ Ver Voucher
              </button>
              ${!isPagado ? `
                <button onclick="AdminService.aprobarPago('${a.idReserva}')" title="Aprobar Pago y Liberar QR" class="text-[10px] bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-2 py-0.5 rounded shadow-2xs">
                  ✓ Aprobar
                </button>
              ` : ''}
            </div>
          </div>
        `;
      } else {
        // Tiene acompañante pero NO existe evidencia de voucher
        pagoHTML = `
          <div class="text-center space-y-1">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-800 font-black rounded-lg text-[11px] border border-rose-300 animate-pulse">
              <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> ⚠️ Sin Evidencia (S/ ${monto}.00)
            </span>
            <div class="flex items-center justify-center gap-1">
              <button onclick="AdminService.verVoucher('${a.idReserva}')" class="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded hover:bg-amber-200 shadow-2xs flex items-center gap-1">
                📸 Cargar Voucher
              </button>
              <button onclick="AdminService.aprobarPago('${a.idReserva}')" title="Aprobar Pago y Liberar QR" class="text-[10px] bg-slate-600 hover:bg-slate-700 text-white font-bold px-2 py-0.5 rounded shadow-2xs">
                ✓ Aprobar
              </button>
            </div>
          </div>
        `;
      }

      // Render de la columna de Asistencia Dual (Titular + Acompañante)
      let asistenciaHTML = `
        <div class="space-y-1 text-center">
          <div class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
            isIngresoTitular 
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs' 
              : 'bg-amber-50 text-amber-800 border border-amber-300'
          }">
            <span class="w-2 h-2 rounded-full ${isIngresoTitular ? 'bg-emerald-600' : 'bg-amber-500'}"></span>
            <span>Titular: <strong>${isIngresoTitular ? 'Ingresó' : 'Pendiente'}</strong></span>
          </div>
      `;

      if (numAcomp > 0) {
        if (isPagado) {
          asistenciaHTML += `
            <div>
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                isIngresoAcomp 
                  ? 'bg-purple-100 text-purple-900 border border-purple-300 shadow-2xs' 
                  : 'bg-slate-100 text-slate-700 border border-slate-300'
              }">
                <span class="w-1.5 h-1.5 rounded-full ${isIngresoAcomp ? 'bg-purple-600' : 'bg-slate-400'}"></span>
                <span>Acomp: <strong>${isIngresoAcomp ? 'Ingresó' : 'Pendiente'}</strong></span>
              </span>
            </div>
          `;
        } else {
          asistenciaHTML += `
            <div>
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                🔒 Acomp: Pago Pend.
              </span>
            </div>
          `;
        }
      }

      asistenciaHTML += `</div>`;

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
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${numAcomp > 0 ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-500'}">
              ${numAcomp > 0 ? `+${numAcomp} acomp.` : 'Solo'}
            </span>
            ${numAcomp > 0 ? `<div class="text-[10px] text-slate-400 mt-0.5 truncate max-w-[100px]">${a.nombresAcompanantes || ''}</div>` : ''}
          </td>
          <td class="py-3.5 px-4">
            ${pagoHTML}
          </td>
          <td class="py-3.5 px-4 text-center">
            ${asistenciaHTML}
          </td>
          <td class="py-3.5 px-4 text-right">
            <div class="flex items-center justify-end gap-1.5">
              <button onclick="AdminService.verBoleto('${a.idReserva}', 'titular')" title="Ver Pase Titular" class="p-1.5 text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-all">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path>
                </svg>
              </button>

              <button onclick="AdminService.enviarQRTitularWhatsApp('${a.idReserva}')" title="Enviar Pase QR Titular por WhatsApp" class="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all font-bold text-xs">
                📲
              </button>
              
              <button onclick="AdminService.toggleEstado('${a.idReserva}')" 
                title="${isIngresoTitular ? 'Restablecer Titular a Pendiente' : 'Validar Ingreso Titular'}" 
                class="px-2 py-1 ${isIngresoTitular ? 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300' : 'text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200'} rounded-lg transition-all font-bold text-[11px] flex items-center gap-1">
                <span>${isIngresoTitular ? '✓ Titular' : '+ Titular'}</span>
              </button>

              ${numAcomp > 0 && isPagado ? `
                <button onclick="AdminService.toggleEstadoAcompanante('${a.idReserva}')" 
                  title="${isIngresoAcomp ? 'Restablecer Acompañante a Pendiente' : 'Validar Ingreso Acompañante'}" 
                  class="px-2 py-1 ${isIngresoAcomp ? 'text-purple-700 bg-purple-100 hover:bg-purple-200 border border-purple-300' : 'text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200'} rounded-lg transition-all font-bold text-[11px] flex items-center gap-1">
                  <span>${isIngresoAcomp ? '✓ Acomp' : '+ Acomp'}</span>
                </button>
                <button onclick="AdminService.enviarQRAcompananteWhatsApp('${a.idReserva}')" title="Enviar QR de Acompañante por WhatsApp" class="p-1.5 text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-all font-bold text-xs">
                  💬
                </button>
              ` : ''}

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
   * Abrir modal para revisar el comprobante/voucher de pago
   */
  async verVoucher(idReserva) {
    const asistente = StorageService.buscarAsistente(idReserva);
    if (!asistente) return;

    this.voucherSeleccionadoId = idReserva;

    const modal = document.getElementById("modal-ver-voucher");
    const elMedico = document.getElementById("modal-voucher-medico");
    const elCmp = document.getElementById("modal-voucher-cmp");
    const elAcomp = document.getElementById("modal-voucher-acomp");
    const elMedio = document.getElementById("modal-voucher-medio");
    const elOp = document.getElementById("modal-voucher-operacion");
    const elMonto = document.getElementById("modal-voucher-monto");
    const elBadge = document.getElementById("modal-voucher-estado-badge");
    const elImg = document.getElementById("modal-voucher-img");
    const elNoImg = document.getElementById("modal-voucher-no-img");
    const elError = document.getElementById("modal-voucher-img-error");
    const btnAprobar = document.getElementById("btn-aprobar-voucher-modal");

    const actionsBar = document.getElementById("modal-voucher-actions-bar");
    const btnDescargarHeader = document.getElementById("btn-descargar-voucher-header");
    const btnDescargarFooter = document.getElementById("btn-descargar-voucher-footer");
    const btnVerDrive = document.getElementById("btn-ver-voucher-drive");
    const btnFallbackDrive = document.getElementById("btn-fallback-drive-link");
    const zoomHint = document.getElementById("modal-voucher-zoom-hint");

    const numAcomp = parseInt(asistente.acompanantes || 0);
    const monto = asistente.montoPago !== undefined ? asistente.montoPago : (numAcomp * 20);
    const isPagado = asistente.estadoPago === "Aprobado" || asistente.estadoPago === "Pagado";

    if (elMedico) elMedico.innerText = asistente.nombres;
    if (elCmp) elCmp.innerText = `CMP: ${asistente.cmp}`;
    if (elAcomp) elAcomp.innerText = `+${numAcomp} Persona(s) (${asistente.nombresAcompanantes || 'Ninguno'})`;
    if (elMedio) elMedio.innerText = asistente.metodoPago || "Yape / Transferencia";
    if (elOp) elOp.innerText = asistente.nroOperacion || "Sin número registrado";
    if (elMonto) elMonto.innerText = `S/ ${monto}.00`;

    // Limpiar estados previos de error o imágenes previas
    if (elError) elError.classList.add("hidden");
    if (elImg) {
      elImg.classList.add("hidden");
      elImg.onerror = null;
    }

    // Obtener voucher completo desde StorageService (revisa memoria, LocalStorage, Drive e IndexedDB)
    const rawSource = await StorageService.obtenerVoucherCompleto(asistente);
    const imgSource = StorageService.formatearUrlImagen(rawSource);
    const isDriveUrl = Boolean(rawSource && (rawSource.includes("drive.google.com") || rawSource.includes("docs.google.com") || rawSource.includes("googleusercontent.com")));
    const driveId = isDriveUrl ? StorageService.extraerIdGoogleDrive(rawSource) : null;
    const directDriveLink = driveId ? `https://drive.google.com/file/d/${driveId}/view?usp=sharing` : (isDriveUrl ? rawSource : null);

    const hasVoucher = Boolean(
      asistente.tieneVoucher ||
      (imgSource && String(imgSource).trim() !== "") ||
      isDriveUrl
    );

    if (elBadge) {
      if (isPagado) {
        elBadge.className = "px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300";
        elBadge.innerText = "✓ PAGO APROBADO";
      } else if (hasVoucher) {
        elBadge.className = "px-2.5 py-0.5 rounded-full text-[11px] font-black bg-purple-100 text-purple-900 border border-purple-300";
        elBadge.innerText = "📸 VOUCHER ADJUNTO (PENDIENTE DE REVISIÓN)";
      } else {
        elBadge.className = "px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300";
        elBadge.innerText = "⚠️ SIN EVIDENCIA (PENDIENTE DE CARGAR)";
      }
    }

    // Configurar botón de enlace a Google Drive si existe
    if (btnVerDrive) {
      if (directDriveLink) {
        btnVerDrive.href = directDriveLink;
        btnVerDrive.classList.remove("hidden");
      } else {
        btnVerDrive.classList.add("hidden");
      }
    }
    if (btnFallbackDrive && directDriveLink) {
      btnFallbackDrive.href = directDriveLink;
    }

    if (imgSource) {
      if (elNoImg) elNoImg.classList.add("hidden");
      if (actionsBar) actionsBar.classList.remove("hidden");
      if (btnDescargarHeader) btnDescargarHeader.classList.remove("hidden");
      if (btnDescargarFooter) btnDescargarFooter.classList.remove("hidden");
      if (zoomHint) zoomHint.classList.remove("hidden");

      if (elImg) {
        elImg.classList.remove("hidden");
        let retryCount = 0;
        elImg.onerror = () => {
          if (retryCount === 0 && isDriveUrl) {
            retryCount++;
            const altUrl = StorageService.obtenerUrlAlternativaDrive(rawSource);
            if (altUrl && altUrl !== elImg.src) {
              elImg.src = altUrl;
              return;
            }
          }
          // Si fallan todos los intentos, mostrar el contenedor de error amigable
          elImg.classList.add("hidden");
          if (zoomHint) zoomHint.classList.add("hidden");
          if (elError) elError.classList.remove("hidden");
        };

        elImg.onload = () => {
          elImg.classList.remove("hidden");
          if (elError) elError.classList.add("hidden");
          if (zoomHint) zoomHint.classList.remove("hidden");
        };

        elImg.src = imgSource;
      }
    } else {
      if (elImg) elImg.classList.add("hidden");
      if (elNoImg) elNoImg.classList.remove("hidden");
      if (elError) elError.classList.add("hidden");
      if (actionsBar) actionsBar.classList.add("hidden");
      if (btnDescargarHeader) btnDescargarHeader.classList.add("hidden");
      if (btnDescargarFooter) btnDescargarFooter.classList.add("hidden");
      if (zoomHint) zoomHint.classList.add("hidden");
    }

    if (btnAprobar) {
      if (isPagado) {
        btnAprobar.classList.add("hidden");
      } else {
        btnAprobar.classList.remove("hidden");
      }
    }

    if (modal) modal.classList.remove("hidden");
  },

  cerrarModalVoucher() {
    const modal = document.getElementById("modal-ver-voucher");
    if (modal) modal.classList.add("hidden");

    // Limpiar imagen y estados para evitar parpadeos en próxima apertura
    const elImg = document.getElementById("modal-voucher-img");
    if (elImg) {
      elImg.src = "";
      elImg.onerror = null;
      elImg.onload = null;
      elImg.classList.add("hidden");
    }
    const zoomHint = document.getElementById("modal-voucher-zoom-hint");
    if (zoomHint) zoomHint.classList.add("hidden");
    const elError = document.getElementById("modal-voucher-img-error");
    if (elError) elError.classList.add("hidden");
    const elNoImg = document.getElementById("modal-voucher-no-img");
    if (elNoImg) elNoImg.classList.remove("hidden");
    const actionsBar = document.getElementById("modal-voucher-actions-bar");
    if (actionsBar) actionsBar.classList.add("hidden");
    const btnDescargarHeader = document.getElementById("btn-descargar-voucher-header");
    if (btnDescargarHeader) btnDescargarHeader.classList.add("hidden");
    const btnDescargarFooter = document.getElementById("btn-descargar-voucher-footer");
    if (btnDescargarFooter) btnDescargarFooter.classList.add("hidden");
    const btnVerDrive = document.getElementById("btn-ver-voucher-drive");
    if (btnVerDrive) btnVerDrive.classList.add("hidden");

    this.voucherSeleccionadoId = null;
  },

  /**
   * Descargar la imagen del comprobante/voucher directamente en el dispositivo
   */
  async descargarVoucher(idReserva) {
    const targetId = idReserva || this.voucherSeleccionadoId;
    let asistente = targetId ? StorageService.buscarAsistente(targetId) : null;
    const elImg = document.getElementById("modal-voucher-img");
    let rawSource = (elImg && elImg.src && !elImg.classList.contains("hidden") && elImg.src !== window.location.href) ? elImg.src : "";

    if (asistente) {
      const fullVoucher = await StorageService.obtenerVoucherCompleto(asistente);
      if (fullVoucher) rawSource = fullVoucher;
    }

    const imgSource = StorageService.formatearUrlImagen(rawSource);

    if (!imgSource || String(imgSource).trim() === "" || imgSource === window.location.href) {
      App.showToast("Este registro aún no cuenta con una captura de voucher para descargar.", "warning");
      return;
    }

    const nombreLimpio = asistente && asistente.nombres ? String(asistente.nombres).trim().replace(/[^a-zA-Z0-9]/g, '_') : 'Asistente';
    const cmp = asistente && asistente.cmp ? asistente.cmp : '000000';
    const nombreArchivo = `Voucher_CMP_${cmp}_${nombreLimpio}.png`;

    try {
      if (imgSource.startsWith("data:")) {
        // Convertir dataURL Base64 a Blob para forzar descarga directa en el navegador
        const parts = imgSource.split(';base64,');
        const contentType = (parts[0] && parts[0].split(':')[1]) || 'image/png';
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
        for (let i = 0; i < rawLength; ++i) {
          uInt8Array[i] = raw.charCodeAt(i);
        }
        const blob = new Blob([uInt8Array], { type: contentType });
        const blobUrl = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.style.display = "none";
        a.href = blobUrl;
        a.download = nombreArchivo;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
          if (a.parentNode) document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        }, 600);

        App.showToast("¡Voucher descargado exitosamente!", "success");
      } else if (imgSource.includes("drive.google.com")) {
        let downloadUrl = imgSource;
        const match = imgSource.match(/\/d\/([a-zA-Z0-9_-]+)/) || imgSource.match(/id=([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          downloadUrl = `https://drive.google.com/uc?export=download&id=${match[1]}`;
        }
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.target = "_blank";
        a.download = nombreArchivo;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { if (a.parentNode) document.body.removeChild(a); }, 600);
        App.showToast("Iniciando descarga desde Google Drive...", "info");
      } else {
        // Archivo o URL remota
        const a = document.createElement("a");
        a.href = imgSource;
        a.target = "_blank";
        a.download = nombreArchivo;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { if (a.parentNode) document.body.removeChild(a); }, 600);
        App.showToast("¡Voucher descargado!", "success");
      }
    } catch (err) {
      console.error("Error al descargar voucher:", err);
      window.open(imgSource, "_blank");
    }
  },

  /**
   * Abrir modal Lightbox para ver voucher en tamaño completo
   */
  async abrirLightboxVoucher() {
    const elImg = document.getElementById("modal-voucher-img");
    let imgSource = (elImg && elImg.src && !elImg.classList.contains("hidden") && elImg.src !== window.location.href) ? elImg.src : null;

    let asistente = null;
    if (this.voucherSeleccionadoId) {
      asistente = StorageService.buscarAsistente(this.voucherSeleccionadoId);
      if (asistente) {
        const fullVoucher = await StorageService.obtenerVoucherCompleto(asistente);
        if (fullVoucher) {
          imgSource = StorageService.formatearUrlImagen(fullVoucher);
        }
      }
    }

    if (!imgSource || imgSource === window.location.href) {
      App.showToast("No hay imagen de comprobante para ampliar.", "warning");
      return;
    }

    const lightbox = document.getElementById("modal-lightbox-voucher");
    const lbImg = document.getElementById("lightbox-voucher-img");
    const lbTitle = document.getElementById("lightbox-voucher-title");

    if (lbImg) {
      lbImg.src = imgSource;
    }
    if (lbTitle) {
      lbTitle.innerText = asistente 
        ? `Voucher de ${asistente.nombres} (CMP: ${asistente.cmp})` 
        : `Comprobante de Pago`;
    }
    if (lightbox) {
      lightbox.classList.remove("hidden");
      lightbox.style.display = "flex";
    }
  },

  /**
   * Cerrar modal Lightbox
   */
  cerrarLightboxVoucher() {
    const lightbox = document.getElementById("modal-lightbox-voucher");
    if (lightbox) {
      lightbox.classList.add("hidden");
      lightbox.style.display = "none";
    }
  },

  /**
   * Adjuntar voucher desde el input del modal de administración
   */
  async subirVoucherDesdeModal(event) {
    const file = event.target.files[0];
    const inputFile = event.target;
    if (file) {
      await this.procesarArchivoVoucher(file);
    }
    if (inputFile) inputFile.value = "";
  },

  /**
   * Procesar archivo de voucher (soporta selección de archivo, Drag & Drop y pegado Ctrl+V)
   */
  async procesarArchivoVoucher(file) {
    if (!file || !this.voucherSeleccionadoId) return;

    const idReserva = this.voucherSeleccionadoId;
    const elImg = document.getElementById("modal-voucher-img");
    const elNoImg = document.getElementById("modal-voucher-no-img");
    const elError = document.getElementById("modal-voucher-img-error");
    const actionsBar = document.getElementById("modal-voucher-actions-bar");
    const btnDescargarHeader = document.getElementById("btn-descargar-voucher-header");
    const btnDescargarFooter = document.getElementById("btn-descargar-voucher-footer");
    const zoomHint = document.getElementById("modal-voucher-zoom-hint");

    // Limpiar estado de error
    if (elError) elError.classList.add("hidden");

    // Vista previa inmediata usando FileReader
    const previewReader = new FileReader();
    previewReader.onload = (ev) => {
      const previewSrc = ev.target.result;
      if (elImg && previewSrc) {
        elImg.src = previewSrc;
        elImg.classList.remove("hidden");
        if (elNoImg) elNoImg.classList.add("hidden");
        if (actionsBar) actionsBar.classList.remove("hidden");
        if (btnDescargarHeader) btnDescargarHeader.classList.remove("hidden");
        if (btnDescargarFooter) btnDescargarFooter.classList.remove("hidden");
        if (zoomHint) zoomHint.classList.remove("hidden");
      }
    };
    previewReader.readAsDataURL(file);

    try {
      App.showToast("Procesando y guardando voucher en el sistema...", "info");

      // Comprimir con calidad óptima a ~25-35KB
      const base64Img = await StorageService.comprimirImagen(file, 800, 0.75);
      if (!base64Img) {
        App.showToast("No se pudo procesar la imagen. Intente con otro archivo.", "error");
        return;
      }

      const res = await StorageService.guardarVoucher(idReserva, base64Img, "Pendiente de Validación");

      if (!res.success) {
        App.showToast(res.mensaje || "Error al guardar el voucher en el sistema.", "error");
        return;
      }

      // Actualizar la imagen del modal con la versión optimizada guardada
      if (elImg) {
        elImg.src = base64Img;
        elImg.classList.remove("hidden");
        if (elError) elError.classList.add("hidden");
        if (elNoImg) elNoImg.classList.add("hidden");
      }

      // Actualizar badge de estado
      const elBadge = document.getElementById("modal-voucher-estado-badge");
      if (elBadge) {
        elBadge.className = "px-2.5 py-0.5 rounded-full text-[11px] font-black bg-purple-100 text-purple-900 border border-purple-300";
        elBadge.innerText = "📸 VOUCHER ADJUNTO (PENDIENTE DE REVISIÓN)";
      }

      // Mostrar botón de aprobación si estaba oculto
      const btnAprobar = document.getElementById("btn-aprobar-voucher-modal");
      if (btnAprobar) btnAprobar.classList.remove("hidden");

      App.showToast("✅ Voucher cargado y guardado exitosamente.", "success");
      if (typeof QRManager !== "undefined") QRManager.reproducirSonido("success");

      // Refrescar tabla y estadísticas
      this.actualizarEstadisticas();
      this.renderizarTabla();

      // Sincronizar con Google Sheets / Google Drive
      if (typeof SheetsService !== "undefined" && SheetsService.isConfigured() && res.success) {
        SheetsService.registrarEnSheets(res.asistente).catch(err => {
          console.warn("Sincronización de voucher en Sheets:", err);
        });
      }
    } catch (err) {
      console.error("Error al subir voucher desde modal:", err);
      App.showToast("Error al procesar la imagen del voucher.", "error");
    }
  },

  /**
   * Aprobar el pago de acompañantes de un asistente y liberar su QR
   */
  aprobarPago(idReserva) {
    const lista = StorageService.getAsistentes();
    const idx = StorageService.buscarIndiceAsistente(idReserva);
    if (idx === -1) return;

    lista[idx].estadoPago = "Aprobado";
    lista[idx].qrAcompanante = `${lista[idx].idReserva}-ACOMP1`;
    if (!lista[idx].estadoAcompanante) {
      lista[idx].estadoAcompanante = "Pendiente";
    }

    StorageService.guardarTodos(lista);
    StorageService.guardarUltimaReserva(lista[idx]);

    App.showToast(`¡Pago de acompañante de ${lista[idx].nombres} aprobado! Se ha liberado su Pase QR Oficial.`, "success");
    if (typeof QRManager !== "undefined") QRManager.reproducirSonido("success");

    this.actualizarEstadisticas();
    this.renderizarTabla();

    // Sincronizar actualización con Google Sheets
    if (typeof SheetsService !== "undefined" && SheetsService.isConfigured()) {
      SheetsService.registrarEnSheets(lista[idx]).catch(err => {
        console.warn("Sincronización de aprobación en Sheets:", err);
      });
    }
  },

  /**
   * Cambiar manualmente el estado del médico titular (Validar o Restablecer)
   */
  toggleEstado(idReserva) {
    const asistente = StorageService.buscarAsistente(idReserva);
    if (!asistente) return;

    const yaIngreso = StorageService.esIngresado(asistente, "titular");

    if (yaIngreso) {
      StorageService.restablecerEstado(idReserva, "titular");
      if (typeof SheetsService !== "undefined" && SheetsService.isConfigured()) {
        SheetsService.restablecerEstadoEnSheets(idReserva, "titular");
      }
      App.showToast(`Estado del Titular (${asistente.nombres}) restablecido a Pendiente.`, "info");
    } else {
      StorageService.marcarIngreso(idReserva, "Admin Manual", "titular");
      if (typeof SheetsService !== "undefined" && SheetsService.isConfigured()) {
        SheetsService.validarIngresoEnSheets(idReserva, "Admin Manual", "titular");
      }
      App.showToast(`¡Ingreso Titular de ${asistente.nombres} validado con éxito!`, "success");
      if (typeof QRManager !== "undefined") {
        QRManager.reproducirSonido("success");
      }
    }

    this.actualizarEstadisticas();
    this.renderizarTabla();
  },

  /**
   * Cambiar manualmente el estado del acompañante (Validar o Restablecer)
   */
  toggleEstadoAcompanante(idReserva) {
    const asistente = StorageService.buscarAsistente(idReserva);
    if (!asistente) return;

    const isPagado = asistente.estadoPago === "Aprobado" || asistente.estadoPago === "Pagado";
    if (!isPagado) {
      App.showToast("Debe aprobar el pago del acompañante antes de registrar su ingreso.", "warning");
      return;
    }

    const yaIngreso = StorageService.esIngresado(asistente, "acompanante");

    if (yaIngreso) {
      StorageService.restablecerEstado(idReserva, "acompanante");
      if (typeof SheetsService !== "undefined" && SheetsService.isConfigured()) {
        SheetsService.restablecerEstadoEnSheets(idReserva, "acompanante");
      }
      App.showToast(`Estado del Acompañante de ${asistente.nombres} restablecido a Pendiente.`, "info");
    } else {
      StorageService.marcarIngreso(`${idReserva}-ACOMP1`, "Admin Manual", "acompanante");
      if (typeof SheetsService !== "undefined" && SheetsService.isConfigured()) {
        SheetsService.validarIngresoEnSheets(`${idReserva}-ACOMP1`, "Admin Manual", "acompanante");
      }
      App.showToast(`¡Ingreso de Acompañante de ${asistente.nombres} validado con éxito!`, "success");
      if (typeof QRManager !== "undefined") {
        QRManager.reproducirSonido("success");
      }
    }

    this.actualizarEstadisticas();
    this.renderizarTabla();
  },

  /**
   * Enviar directamente el Pase QR del Titular por WhatsApp al médico
   */
  enviarQRTitularWhatsApp(idReserva) {
    const asistente = StorageService.buscarAsistente(idReserva);
    if (!asistente) return;

    if (typeof QRManager !== "undefined") {
      QRManager.currentTicketType = "titular";
      QRManager.compartirWhatsApp(asistente);
    }
  },

  /**
   * Enviar directamente el Pase QR del Acompañante por WhatsApp al médico
   */
  enviarQRAcompananteWhatsApp(idReserva) {
    const asistente = StorageService.buscarAsistente(idReserva);
    if (!asistente) return;

    const isPagado = asistente.estadoPago === "Aprobado" || asistente.estadoPago === "Pagado";
    if (!isPagado) {
      App.showToast("Primero apruebe el comprobante de pago para habilitar el QR del acompañante.", "warning");
      return;
    }

    if (typeof QRManager !== "undefined") {
      QRManager.currentTicketType = "acompanante";
      QRManager.compartirWhatsApp(asistente);
    }
  },

  /**
   * Ver y abrir el boleto digital de un asistente (Titular o Acompañante)
   */
  verBoleto(idReserva, tipo = "titular") {
    const asistente = StorageService.buscarAsistente(idReserva);
    if (!asistente) {
      App.showToast("Boleto no encontrado", "error");
      return;
    }

    StorageService.guardarUltimaReserva(asistente);
    QRManager.renderizarTicket(asistente, "ticket-container", tipo);
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

      // 1. Eliminar inmediatamente en la interfaz local
      StorageService.eliminarAsistente(idReserva);
      this.actualizarEstadisticas();
      this.renderizarTabla();
      App.cargarListaAsistentesEnTicket();
      App.showToast("Eliminando de la aplicación y de Google Sheets...", "info");

      // 2. Eliminar permanentemente en Google Sheets
      if (typeof SheetsService !== "undefined" && SheetsService.isConfigured()) {
        try {
          const res = await SheetsService.eliminarEnSheets(idReserva, cmp);
          if (res && res.success) {
            App.showToast("¡Registro eliminado con éxito de Google Sheets y del aplicativo!", "success");
          } else {
            console.warn("Respuesta al eliminar en Sheets:", res);
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
   * Exportar todos los asistentes a un archivo Excel (.xlsx) oficial con datos de pases duales
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
      const dataExport = asistentes.map((a, idx) => ({
        "N°": idx + 1,
        "ID RESERVA": a.idReserva,
        "FECHA REGISTRO": a.fechaRegistro || "",
        "N° CMP": a.cmp || "",
        "DNI": a.dni || "",
        "NOMBRES Y APELLIDOS": a.nombres,
        "ESPECIALIDAD / CARGO": a.especialidad || "Médico Cirujano",
        "CELULAR": a.celular,
        "CORREO ELECTRÓNICO": a.correo || "",
        "N° ACOMPAÑANTES": parseInt(a.acompanantes) || 0,
        "NOMBRES ACOMPAÑANTES": a.nombresAcompanantes || "Ninguno",
        "ESTADO PAGO": a.estadoPago || (parseInt(a.acompanantes) > 0 ? "Pendiente" : "Gratuito"),
        "MONTO ABONADO (S/)": a.montoPago !== undefined ? a.montoPago : (parseInt(a.acompanantes) > 0 ? parseInt(a.acompanantes) * 20 : 0),
        "MEDIO DE PAGO": a.metodoPago || (parseInt(a.acompanantes) > 0 ? "Yape / Transf" : "Gratuito"),
        "N° OPERACIÓN": a.nroOperacion || "N/A",
        "ESTADO ASISTENCIA TITULAR": a.estado,
        "HORA INGRESO TITULAR": a.fechaIngreso || "Aún no ingresa",
        "ESTADO ASISTENCIA ACOMPAÑANTE": parseInt(a.acompanantes) > 0 ? (a.estadoAcompanante || "Pendiente") : "No aplica",
        "HORA INGRESO ACOMPAÑANTE": a.fechaIngresoAcompanante || "Aún no ingresa",
        "VALIDADO POR": a.validadoPor || a.validadoPorAcompanante || "",
        "QR TITULAR": a.qrTitular || a.qrHash || a.idReserva,
        "QR ACOMPAÑANTE": a.qrAcompanante || (parseInt(a.acompanantes) > 0 ? `${a.idReserva}-ACOMP1` : "No aplica")
      }));

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
        { wch: 16 }, // Acompañantes
        { wch: 28 }, // Nombres Acomp
        { wch: 18 }, // Estado Pago
        { wch: 18 }, // Monto
        { wch: 18 }, // Medio Pago
        { wch: 18 }, // Nro Operacion
        { wch: 22 }, // Asistencia Titular
        { wch: 22 }, // Hora Ingreso Titular
        { wch: 24 }, // Asistencia Acomp
        { wch: 24 }, // Hora Ingreso Acomp
        { wch: 20 }, // Validado por
        { wch: 25 }, // QR Titular
        { wch: 25 }  // QR Acompanante
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Asistencia y Recaudación CMP");

      const fechaActual = new Date().toISOString().slice(0, 10);
      const filename = `Reporte_Asistencia_Recaudacion_CMP_Pasco_${fechaActual}.xlsx`;

      XLSX.writeFile(wb, filename);
      App.showToast("¡Archivo Excel con datos de pases individuales exportado exitosamente!", "success");
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
      // 1. Cálculos de métricas estadísticas
      const config = (typeof APP_CONFIG !== "undefined" && APP_CONFIG.getEventoConfig) ? APP_CONFIG.getEventoConfig() : {};
      const limiteAforo = config.limiteAforo || 350;

      let totalInscritos = asistentes.length;
      let totalTitularesIngresaron = 0;
      let totalTitularesPendientes = 0;
      let totalAcompRegistrados = 0;
      let totalAcompIngresaron = 0;
      let totalAcompPendientes = 0;
      let totalPersonasReal = 0;
      let totalRecaudado = 0;
      let totalPagosAprobados = 0;
      let totalPagosPendientes = 0;
      let totalSinAcomp = 0;
      let totalConAcomp = 0;

      asistentes.forEach(a => {
        const numAcomp = parseInt(a.acompanantes || 0);
        const titularIngreso = (a.estado === "Ingresó" || a.estado === "Asistió");
        const acompIngreso = numAcomp > 0 && (a.estadoAcompanante === "Ingresó" || a.estadoAcompanante === "Asistió");
        const isPagado = a.estadoPago === "Aprobado" || a.estadoPago === "Pagado";

        if (titularIngreso) {
          totalTitularesIngresaron++;
          totalPersonasReal++;
        } else {
          totalTitularesPendientes++;
        }

        if (numAcomp > 0) {
          totalConAcomp++;
          totalAcompRegistrados += numAcomp;
          if (acompIngreso) {
            totalAcompIngresaron += numAcomp;
            totalPersonasReal += numAcomp;
          } else {
            totalAcompPendientes += numAcomp;
          }

          if (isPagado) {
            totalPagosAprobados++;
            totalRecaudado += (a.montoPago !== undefined ? a.montoPago : (numAcomp * 20));
          } else {
            totalPagosPendientes++;
          }
        } else {
          totalSinAcomp++;
        }
      });

      const pctAsistenciaTitular = totalInscritos > 0 ? Math.round((totalTitularesIngresaron / totalInscritos) * 100) : 0;
      const pctPendienteTitular = 100 - pctAsistenciaTitular;
      const pctAforo = Math.min(100, Math.round((totalPersonasReal / limiteAforo) * 100));
      const pctConAcomp = totalInscritos > 0 ? Math.round((totalConAcomp / totalInscritos) * 100) : 0;
      const pctSinAcomp = 100 - pctConAcomp;

      // Fechas para encabezado
      const ahora = new Date();
      const fechaFormato = ahora.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const horaFormato = ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      const codigoReporte = `RPT-CMP-${ahora.getFullYear()}${String(ahora.getMonth() + 1).padStart(2, '0')}${String(ahora.getDate()).padStart(2, '0')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      // Cálculos para gráficos SVG Donut (Circunferencia = 2 * PI * 48 = 301.6)
      const circ = 301.6;
      const arcAsist = ((pctAsistenciaTitular / 100) * circ).toFixed(1);
      const arcPend = ((pctPendienteTitular / 100) * circ).toFixed(1);

      const arcConAcomp = ((pctConAcomp / 100) * circ).toFixed(1);
      const arcSinAcomp = ((pctSinAcomp / 100) * circ).toFixed(1);

      const totalConAcompCalculo = (totalPagosAprobados + totalPagosPendientes) || 1;
      const pctPagosAprobados = Math.round((totalPagosAprobados / totalConAcompCalculo) * 100);
      const pctPagosPendientes = 100 - pctPagosAprobados;

      // Obtener logo
      let logoSrc = "assets/logo.png";
      const imgHeader = document.getElementById("header-logo-img");
      if (imgHeader && imgHeader.src) {
        logoSrc = imgHeader.src;
      }

      // Eliminar cualquier contenedor temporal previo
      const prevReport = document.getElementById("temp-executive-report");
      if (prevReport) prevReport.remove();

      // Crear contenedor temporal para el informe
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
        const numAcomp = parseInt(a.acompanantes || 0);
        const titularIngreso = (a.estado === "Ingresó" || a.estado === "Asistió");
        const acompIngreso = numAcomp > 0 && (a.estadoAcompanante === "Ingresó" || a.estadoAcompanante === "Asistió");
        const isPagado = a.estadoPago === "Aprobado" || a.estadoPago === "Pagado";
        const monto = a.montoPago !== undefined ? a.montoPago : (numAcomp * 20);
        const bgFila = idx % 2 === 0 ? "#f8fafc" : "#ffffff";

        let badgePago = `<span style="background:#f1f5f9; color:#475569; font-weight:700; padding:3px 8px; border-radius:6px; font-size:10px; display:inline-block;">Gratuito</span>`;
        if (numAcomp > 0) {
          if (isPagado) {
            badgePago = `<span style="background:#dcfce7; color:#166534; font-weight:800; padding:3px 8px; border-radius:6px; font-size:10px; display:inline-block; border:1px solid #bbf7d0;">✓ Pagado S/ ${monto}.00</span>`;
          } else {
            badgePago = `<span style="background:#fef3c7; color:#92400e; font-weight:800; padding:3px 8px; border-radius:6px; font-size:10px; display:inline-block; border:1px solid #fde68a;">⏳ Pendiente S/ ${monto}.00</span>`;
          }
        }

        const badgeIngresoTitular = titularIngreso
          ? `<span style="background:#dcfce7; color:#15803d; font-weight:800; padding:3px 8px; border-radius:6px; font-size:10px; display:inline-block; border:1px solid #86efac;">✓ INGRESÓ <span style="font-size:9px; font-weight:normal; opacity:0.85;">(${a.fechaIngreso ? a.fechaIngreso.split(' ')[1] || a.fechaIngreso : 'Validado'})</span></span>`
          : `<span style="background:#fef2f2; color:#b91c1c; font-weight:700; padding:3px 8px; border-radius:6px; font-size:10px; display:inline-block; border:1px solid #fecaca;">PENDIENTE</span>`;

        let badgeIngresoAcomp = `<span style="color:#94a3b8; font-size:10px;">—</span>`;
        if (numAcomp > 0) {
          badgeIngresoAcomp = acompIngreso
            ? `<span style="background:#dcfce7; color:#15803d; font-weight:800; padding:3px 8px; border-radius:6px; font-size:10px; display:inline-block; border:1px solid #86efac;">✓ INGRESÓ</span>`
            : `<span style="background:#fef3c7; color:#92400e; font-weight:700; padding:3px 8px; border-radius:6px; font-size:10px; display:inline-block; border:1px solid #fde68a;">PENDIENTE</span>`;
        }

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
              ${numAcomp > 0 
                ? `<span style="background:#f3e8ff; color:#6b21a8; font-weight:700; padding:2px 6px; border-radius:4px; font-size:9.5px;">+1 Acompañante</span><div style="font-size:9px; color:#7e22ce; margin-top:2px;">${a.nombresAcompanantes || ''}</div>`
                : `<span style="color:#64748b; font-size:10px;">Solo Titular</span>`}
            </td>
            <td style="padding: 7px 6px; text-align: center;">${badgePago}</td>
            <td style="padding: 7px 6px; text-align: center;">${badgeIngresoTitular}</td>
            <td style="padding: 7px 6px; text-align: center;">${badgeIngresoAcomp}</td>
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
            <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 800;">Tarifa Acompañante</div>
            <div style="font-size: 12px; font-weight: 800; color: #7e22ce; margin-top: 2px;">S/ 20.00 PEN</div>
            <div style="font-size: 9.5px; color: #94a3b8;">Titular 100% Gratuito</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px;">
            <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 800;">Sistema de Control</div>
            <div style="font-size: 12px; font-weight: 800; color: #0284c7; margin-top: 2px;">Código QR Individual</div>
            <div style="font-size: 9.5px; color: #94a3b8;">Validación en tiempo real</div>
          </div>
        </div>

        <!-- TARJETAS KPI RESUMEN EJECUTIVO -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
          <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-top: 4px solid #3b0764; border-radius: 12px; padding: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.03);">
            <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">Médicos Inscritos</div>
            <div style="font-size: 26px; font-weight: 900; color: #1e1b4b; margin: 4px 0 2px 0;">${totalInscritos}</div>
            <div style="font-size: 10px; color: #64748b;">
              <span style="color:#7e22ce; font-weight:700;">${totalConAcomp}</span> con acompañante
            </div>
          </div>

          <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-top: 4px solid #059669; border-radius: 12px; padding: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.03);">
            <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #059669; letter-spacing: 0.5px;">Titulares Ingresados</div>
            <div style="font-size: 26px; font-weight: 900; color: #059669; margin: 4px 0 2px 0;">
              ${totalTitularesIngresaron} <span style="font-size: 14px; font-weight: 700; color: #10b981;">(${pctAsistenciaTitular}%)</span>
            </div>
            <div style="font-size: 10px; color: #64748b;">
              <span style="color:#d97706; font-weight:700;">${totalTitularesPendientes}</span> aún pendientes
            </div>
          </div>

          <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-top: 4px solid #0284c7; border-radius: 12px; padding: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.03);">
            <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #0284c7; letter-spacing: 0.5px;">Personas en Sala</div>
            <div style="font-size: 26px; font-weight: 900; color: #0284c7; margin: 4px 0 2px 0;">
              ${totalPersonasReal} <span style="font-size: 13px; font-weight: 700; color: #64748b;">/ ${limiteAforo}</span>
            </div>
            <div style="font-size: 10px; color: #64748b;">
              <span style="color:#0284c7; font-weight:700;">${pctAforo}%</span> de ocupación total
            </div>
          </div>

          <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-top: 4px solid #d97706; border-radius: 12px; padding: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.03);">
            <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #d97706; letter-spacing: 0.5px;">Recaudación Acomp.</div>
            <div style="font-size: 24px; font-weight: 900; color: #b45309; margin: 4px 0 2px 0;">
              S/ ${totalRecaudado}.00
            </div>
            <div style="font-size: 10px; color: #64748b;">
              <span style="color:#059669; font-weight:700;">${totalPagosAprobados}</span> validados | <span style="color:#dc2626; font-weight:700;">${totalPagosPendientes}</span> pend.
            </div>
          </div>
        </div>

        <!-- PANEL DE GRÁFICOS ANALÍTICOS (SVG) -->
        <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 18px; margin-bottom: 22px; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 10px; margin-bottom: 16px;">
            <div style="font-size: 13px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
              📊 Análisis Gráfico de Asistencia, Modalidades y Control de Sala
            </div>
            <div style="font-size: 10px; color: #64748b; font-weight: 600;">
              Métricas calculadas en tiempo real
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
            
            <!-- GRÁFICO 1: ASISTENCIA TITULARES -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; text-align: center;">
              <div style="font-size: 11px; font-weight: 800; color: #1e293b; margin-bottom: 8px;">Asistencia Médicos Titulares</div>
              <div style="position: relative; width: 130px; height: 130px; margin: 0 auto;">
                <svg viewBox="0 0 120 120" width="130" height="130" style="transform: rotate(-90deg);">
                  <circle cx="60" cy="60" r="48" fill="none" stroke="#e2e8f0" stroke-width="18" />
                  <circle cx="60" cy="60" r="48" fill="none" stroke="#059669" stroke-width="18"
                    stroke-dasharray="${arcAsist} 301.6" stroke-dashoffset="0" />
                  <circle cx="60" cy="60" r="48" fill="none" stroke="#d97706" stroke-width="18"
                    stroke-dasharray="${arcPend} 301.6" stroke-dashoffset="${-arcAsist}" />
                </svg>
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                  <span style="font-size: 20px; font-weight: 900; color: #0f172a; line-height: 1;">${pctAsistenciaTitular}%</span>
                  <span style="font-size: 9px; font-weight: 700; color: #64748b; margin-top: 2px;">ASISTENCIA</span>
                </div>
              </div>

              <div style="margin-top: 10px; font-size: 10px; text-align: left; display: flex; flex-direction: column; gap: 3px;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <span style="display: flex; align-items: center; gap: 4px;">
                    <span style="width: 8px; height: 8px; background: #059669; border-radius: 50%; display: inline-block;"></span>
                    <span style="color: #334155; font-weight: 600;">Ingresaron</span>
                  </span>
                  <span style="font-weight: 800; color: #059669;">${totalTitularesIngresaron} (${pctAsistenciaTitular}%)</span>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <span style="display: flex; align-items: center; gap: 4px;">
                    <span style="width: 8px; height: 8px; background: #d97706; border-radius: 50%; display: inline-block;"></span>
                    <span style="color: #334155; font-weight: 600;">Pendientes</span>
                  </span>
                  <span style="font-weight: 800; color: #d97706;">${totalTitularesPendientes} (${pctPendienteTitular}%)</span>
                </div>
              </div>
            </div>

            <!-- GRÁFICO 2: MODALIDAD DE ASISTENCIA -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; text-align: center;">
              <div style="font-size: 11px; font-weight: 800; color: #1e293b; margin-bottom: 8px;">Modalidad de Participación</div>
              <div style="position: relative; width: 130px; height: 130px; margin: 0 auto;">
                <svg viewBox="0 0 120 120" width="130" height="130" style="transform: rotate(-90deg);">
                  <circle cx="60" cy="60" r="48" fill="none" stroke="#e2e8f0" stroke-width="18" />
                  <circle cx="60" cy="60" r="48" fill="none" stroke="#7e22ce" stroke-width="18"
                    stroke-dasharray="${arcConAcomp} 301.6" stroke-dashoffset="0" />
                  <circle cx="60" cy="60" r="48" fill="none" stroke="#4338ca" stroke-width="18"
                    stroke-dasharray="${arcSinAcomp} 301.6" stroke-dashoffset="${-arcConAcomp}" />
                </svg>
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                  <span style="font-size: 18px; font-weight: 900; color: #0f172a; line-height: 1;">${totalInscritos}</span>
                  <span style="font-size: 9px; font-weight: 700; color: #64748b; margin-top: 2px;">MÉDICOS</span>
                </div>
              </div>

              <div style="margin-top: 10px; font-size: 10px; text-align: left; display: flex; flex-direction: column; gap: 3px;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <span style="display: flex; align-items: center; gap: 4px;">
                    <span style="width: 8px; height: 8px; background: #7e22ce; border-radius: 50%; display: inline-block;"></span>
                    <span style="color: #334155; font-weight: 600;">Con Acompañante</span>
                  </span>
                  <span style="font-weight: 800; color: #7e22ce;">${totalConAcomp} (${pctConAcomp}%)</span>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <span style="display: flex; align-items: center; gap: 4px;">
                    <span style="width: 8px; height: 8px; background: #4338ca; border-radius: 50%; display: inline-block;"></span>
                    <span style="color: #334155; font-weight: 600;">Solo Titular</span>
                  </span>
                  <span style="font-weight: 800; color: #4338ca;">${totalSinAcomp} (${pctSinAcomp}%)</span>
                </div>
              </div>
            </div>

            <!-- GRÁFICO 3: ESTADO DE PAGOS -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; text-align: center;">
              <div style="font-size: 11px; font-weight: 800; color: #1e293b; margin-bottom: 8px;">Estado de Pagos (S/ 20.00)</div>
              <div style="position: relative; width: 130px; height: 130px; margin: 0 auto;">
                <svg viewBox="0 0 120 120" width="130" height="130" style="transform: rotate(-90deg);">
                  <circle cx="60" cy="60" r="48" fill="none" stroke="#e2e8f0" stroke-width="18" />
                  <circle cx="60" cy="60" r="48" fill="none" stroke="#059669" stroke-width="18"
                    stroke-dasharray="${((pctPagosAprobados / 100) * 301.6).toFixed(1)} 301.6" stroke-dashoffset="0" />
                  <circle cx="60" cy="60" r="48" fill="none" stroke="#dc2626" stroke-width="18"
                    stroke-dasharray="${((pctPagosPendientes / 100) * 301.6).toFixed(1)} 301.6" stroke-dashoffset="${-((pctPagosAprobados / 100) * 301.6).toFixed(1)}" />
                </svg>
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                  <span style="font-size: 17px; font-weight: 900; color: #059669; line-height: 1;">${pctPagosAprobados}%</span>
                  <span style="font-size: 8.5px; font-weight: 700; color: #64748b; margin-top: 2px;">RECAUDADO</span>
                </div>
              </div>

              <div style="margin-top: 10px; font-size: 10px; text-align: left; display: flex; flex-direction: column; gap: 3px;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <span style="display: flex; align-items: center; gap: 4px;">
                    <span style="width: 8px; height: 8px; background: #059669; border-radius: 50%; display: inline-block;"></span>
                    <span style="color: #334155; font-weight: 600;">Aprobados</span>
                  </span>
                  <span style="font-weight: 800; color: #059669;">${totalPagosAprobados} (S/ ${totalRecaudado})</span>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <span style="display: flex; align-items: center; gap: 4px;">
                    <span style="width: 8px; height: 8px; background: #dc2626; border-radius: 50%; display: inline-block;"></span>
                    <span style="color: #334155; font-weight: 600;">Por Validar</span>
                  </span>
                  <span style="font-weight: 800; color: #dc2626;">${totalPagosPendientes}</span>
                </div>
              </div>
            </div>

          </div>

          <!-- BARRA DE PROGRESO DE AFORO -->
          <div style="margin-top: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-size: 11px; font-weight: 800; color: #1e293b;">Ocupación de Sala C.C. La Katedral (${totalPersonasReal} de ${limiteAforo} personas)</span>
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
              📋 Padrón Detallado de Asistencia y Validaciones (${asistentes.length} Registros)
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
                <th style="padding: 8px 6px; text-align: center; border-right: 1px solid rgba(223, 183, 108, 0.3);">Estado Pago</th>
                <th style="padding: 8px 6px; text-align: center; border-right: 1px solid rgba(223, 183, 108, 0.3);">Ingreso Titular</th>
                <th style="padding: 8px 6px; text-align: center;">Ingreso Acomp.</th>
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
              <div style="font-size: 11px; font-weight: 800; color: #0f172a;">Comisión de Tesorería</div>
              <div style="font-size: 9.5px; color: #64748b;">Control & Recaudación</div>
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

      // Esperar breve renderizado de elementos
      await new Promise(resolve => setTimeout(resolve, 350));

      // Capturar canvas con html2canvas
      const canvas = await html2canvas(reportContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff"
      });

      // Limpiar contenedor temporal
      if (reportContainer.parentNode) {
        reportContainer.parentNode.removeChild(reportContainer);
      }

      // Crear PDF con jsPDF
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

      // Primera página
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, totalPdfHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;

      // Páginas adicionales si el reporte supera una página A4
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
