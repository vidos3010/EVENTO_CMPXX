/**
 * =========================================================================================
 * GESTOR DE BOLETOS EJECUTIVOS, QR Y EXPORTACIÓN - COLEGIO MÉDICO DEL PERÚ XX PASCO
 * COLORES OFICIALES: MORADO INSTITUCIONAL (#380036 / #4A154B) Y DORADO IMPERIAL (#DFB76C)
 * SOPORTE PARA PASES SEPARADOS (TITULAR & ACOMPAÑANTE CONDICIONAL)
 * =========================================================================================
 */

const QRManager = {
  currentTicketType: "titular", // "titular" | "acompanante"

  /**
   * Generar código QR nítido en un contenedor
   */
  generarQR(containerElement, texto, size = 175) {
    if (!containerElement) return;
    containerElement.innerHTML = "";

    try {
      new QRCode(containerElement, {
        text: texto,
        width: size,
        height: size,
        colorDark: "#200530",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });
    } catch (e) {
      console.error("Error al generar código QR:", e);
      containerElement.innerHTML = `<div class="text-xs text-rose-600 font-bold p-2">Error al generar QR</div>`;
    }
  },

  /**
   * Obtener DataURL del código QR en alta resolución para el PDF
   */
  async obtenerQRDataURL(texto, size = 350) {
    return new Promise((resolve) => {
      const tempDiv = document.createElement("div");
      tempDiv.style.position = "absolute";
      tempDiv.style.left = "-9999px";
      document.body.appendChild(tempDiv);

      new QRCode(tempDiv, {
        text: texto,
        width: size,
        height: size,
        colorDark: "#200530",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });

      setTimeout(() => {
        const canvas = tempDiv.querySelector("canvas");
        if (canvas) {
          const dataUrl = canvas.toDataURL("image/png");
          document.body.removeChild(tempDiv);
          resolve(dataUrl);
        } else {
          const img = tempDiv.querySelector("img");
          const dataUrl = img ? img.src : null;
          document.body.removeChild(tempDiv);
          resolve(dataUrl);
        }
      }, 80);
    });
  },

  /**
   * Cambiar entre vista de Pase Titular y Pase Acompañante
   */
  cambiarVistaPase(tipo) {
    this.currentTicketType = tipo;
    const a = StorageService.getUltimaReserva() || StorageService.getAsistentes()[0];
    if (a) {
      if (document.getElementById("ticket-inscripcion-render")) {
        this.renderizarTicket(a, "ticket-inscripcion-render", tipo);
      }
      if (document.getElementById("ticket-container")) {
        this.renderizarTicket(a, "ticket-container", tipo);
      }
    }
  },

  /**
   * Renderizar el Pase / Carnet Oficial Institucional en la Web (Morado y Oro)
   */
  renderizarTicket(datos, containerId = "ticket-container", tipoPase = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (tipoPase) {
      this.currentTicketType = tipoPase;
    }

    const config = APP_CONFIG.getEventoConfig();
    const logoUrl = APP_CONFIG.getLogoUrl();
    const numAcompInt = parseInt(datos.acompanantes || 0);
    const hasAcompNombre = Boolean(datos.nombresAcompanantes && datos.nombresAcompanantes !== "Ninguno" && String(datos.nombresAcompanantes).trim() !== "");
    const hasAcompQr = Boolean(datos.qrAcompanante && String(datos.qrAcompanante).trim() !== "");
    const hasAcompPago = (parseFloat(datos.montoPago) > 0) || (datos.estadoPago && datos.estadoPago !== "Gratuito" && datos.estadoPago !== "");
    const hasAcompEstado = Boolean(datos.estadoAcompanante && String(datos.estadoAcompanante).trim() !== "");

    const tieneAcomp = (numAcompInt > 0) || hasAcompNombre || hasAcompQr || hasAcompPago || hasAcompEstado;
    const isPagado = datos.estadoPago === "Aprobado" || datos.estadoPago === "Pagado";

    // Si no tiene acompañante, forzar vista titular
    if (!tieneAcomp) {
      this.currentTicketType = "titular";
    }

    const isTitularView = this.currentTicketType === "titular";

    // Parámetros dinámicos según el tipo de pase activo
    const qrPayload = isTitularView 
      ? (datos.qrTitular || datos.qrHash || datos.idReserva)
      : (datos.qrAcompanante || `${datos.idReserva}-ACOMP1`);

    const codigoDisplay = isTitularView
      ? datos.idReserva
      : `${datos.idReserva}-ACOMP1`;

    const isIngreso = isTitularView
      ? (datos.estado === "Ingresó" || datos.estado === "Asistió")
      : (datos.estadoAcompanante === "Ingresó" || datos.estadoAcompanante === "Asistió");

    // 1. Selector de pestañas para alternar entre Titular y Acompañante
    let selectorTabsHtml = "";
    if (tieneAcomp) {
      selectorTabsHtml = `
        <div class="flex items-center justify-center p-1.5 bg-purple-100/80 rounded-2xl border border-purple-200 mb-4 max-w-md mx-auto shadow-inner">
          <button type="button" onclick="QRManager.cambiarVistaPase('titular')"
            class="flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              isTitularView
                ? 'bg-gradient-to-r from-[#200530] to-[#4a154b] text-amber-300 shadow-md border border-amber-400/40'
                : 'text-purple-950 hover:bg-white/60'
            }">
            <span>👨‍⚕️ Pase Titular (Colegiado)</span>
          </button>

          <button type="button" onclick="QRManager.cambiarVistaPase('acompanante')"
            class="flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              !isTitularView
                ? 'bg-gradient-to-r from-[#200530] to-[#4a154b] text-amber-300 shadow-md border border-amber-400/40'
                : 'text-purple-950 hover:bg-white/60'
            }">
            <span>🎟️ Pase Acompañante</span>
            <span class="text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${
              isPagado 
                ? 'bg-emerald-500 text-white shadow-xs' 
                : 'bg-amber-400 text-[#200530]'
            }">
              ${isPagado ? '✓ QR Listo' : '🔒 Bloqueado'}
            </span>
          </button>
        </div>
      `;
    }

    // 2. Si es vista de Acompañante pero el pago NO está aprobado: Mostrar tarjeta de bloqueo explicativa
    if (!isTitularView && !isPagado) {
      const rawVoucherSource = datos.voucherImg || datos.enlaceVoucherDrive;
      const voucherSource = StorageService.formatearUrlImagen(rawVoucherSource);
      const hasVoucher = Boolean(rawVoucherSource && rawVoucherSource.trim() !== "");

      container.innerHTML = `
        ${selectorTabsHtml}

        <div id="digital-ticket-card" class="executive-card max-w-md mx-auto text-slate-800 bg-white border-2 border-amber-400 rounded-3xl overflow-hidden shadow-lg animate-fadeIn">
          
          <!-- Cabecera de Bloqueo -->
          <div class="bg-gradient-to-r from-[#200530] via-[#4a154b] to-[#6b21a8] p-6 text-white text-center border-b-2 border-amber-400">
            <div class="w-16 h-16 bg-amber-400 text-[#200530] rounded-2xl flex items-center justify-center mx-auto mb-3 text-3xl font-black shadow-lg">
              🔒
            </div>
            <span class="inline-block px-3 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 mb-1">
              PASE DE ACOMPAÑANTE BLOQUEADO
            </span>
            <h3 class="text-lg font-black font-cinzel text-white leading-tight">
              Pendiente de Confirmación de Pago
            </h3>
            <p class="text-xs text-purple-200 mt-1">
              Colegiado Responsable: <strong>${datos.nombres}</strong> (CMP ${datos.cmp})
            </p>
          </div>

          <!-- Cuerpo explicativo -->
          <div class="p-6 space-y-4">
            
            <div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-950 space-y-2">
              <div class="flex items-center gap-2 font-black text-amber-900 text-sm">
                <span>⚠️</span>
                <span>¿Por qué no aparece el código QR del Acompañante?</span>
              </div>
              <p class="leading-relaxed text-slate-700">
                El <strong>pase y código QR del Acompañante</strong> se generará y desbloqueará en cuanto la administración del <strong>Colegio Médico</strong> verifique y apruebe el abono de <strong>S/ 20.00</strong> en su cuenta de Yape.
              </p>
            </div>

            <!-- Detalles del pago registrado -->
            <div class="bg-purple-50/50 p-3.5 rounded-xl border border-purple-100 text-xs space-y-1.5">
              <div class="flex justify-between">
                <span class="text-slate-500 font-semibold">Costo Acompañante:</span>
                <span class="font-black text-purple-950">S/ 20.00</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500 font-semibold">N° de Operación:</span>
                <span class="font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-purple-200">${datos.nroOperacion || 'Sin registrar'}</span>
              </div>
              <div class="flex justify-between items-center pt-1 border-t border-purple-200">
                <span class="text-slate-500 font-semibold">Estado de Validación:</span>
                <span class="px-2.5 py-0.5 bg-amber-100 text-amber-800 font-black text-[11px] rounded-full border border-amber-300">
                  🟡 En Revisión por Administración
                </span>
              </div>
            </div>

            <!-- Evidencia de voucher -->
            ${hasVoucher ? `
              <div class="bg-white p-3 rounded-xl border border-emerald-200 flex items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                  <img src="${voucherSource}" alt="Voucher" class="w-12 h-14 object-cover rounded-lg border border-emerald-300 shadow-xs cursor-pointer" onclick="App.verQRExpandido('${voucherSource}', 'Comprobante de Pago - ${datos.nombres}')">
                  <div>
                    <span class="text-xs font-bold text-emerald-900 block">Comprobante Adjunto</span>
                    <span class="text-[10px] text-slate-500">Listo para revisión administrativa</span>
                  </div>
                </div>
                <button type="button" onclick="App.verQRExpandido('${voucherSource}', 'Comprobante de Pago - ${datos.nombres}')" class="px-3 py-1.5 bg-purple-50 text-purple-900 hover:bg-purple-100 border border-purple-200 text-xs font-bold rounded-lg transition-all">
                  👁️ Ver
                </button>
              </div>
            ` : `
              <div class="bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs space-y-2">
                <p class="text-rose-900 font-bold text-[11px]">No se encontró captura del voucher. Adjúntela para agilizar la aprobación:</p>
                <label class="w-full py-2 bg-gradient-to-r from-[#200530] to-[#4a154b] text-amber-300 font-bold text-xs rounded-lg cursor-pointer flex items-center justify-center gap-1.5 shadow-sm border border-amber-400/30">
                  <span>📸 Subir Voucher de Yape Ahora</span>
                  <input type="file" accept="image/*" class="hidden" onchange="App.subirVoucherPosterior(event, '${datos.idReserva}')">
                </label>
              </div>
            `}

            <!-- Botón para regresar al pase titular -->
            <button type="button" onclick="QRManager.cambiarVistaPase('titular')"
              class="w-full py-3 bg-purple-50 hover:bg-purple-100 text-purple-950 font-extrabold text-xs rounded-xl border border-purple-200 transition-all flex items-center justify-center gap-1.5">
              <span>← Ver Pase Titular del Dr(a). ${datos.nombres.split(' ')[0]}</span>
            </button>

          </div>

          <!-- Pie -->
          <div class="bg-[#200530] text-purple-200 px-4 py-2.5 text-center text-[10px] font-medium border-t border-[#3e0c4b]">
            Colegio Médico del Perú — Consejo Regional XX Pasco
          </div>

        </div>
      `;
      return;
    }

    // 3. Renderizar Carnet Oficial Digital (Titular o Acompañante Aprobado)
    const ticketHtml = `
      ${selectorTabsHtml}

      <div id="digital-ticket-card" class="executive-card max-w-md mx-auto text-slate-800 bg-white border border-[#dfb76c]/50 rounded-3xl overflow-hidden shadow-lg animate-fadeIn">
        
        <!-- 1. Cabecera Institucional Oficial (Morado Obispo & Oro) -->
        <div class="card-header-purple p-6 text-white text-center">
          
          <!-- Logo Oficial del Colegio Médico -->
          <div class="w-20 h-20 bg-white rounded-2xl p-2 mx-auto mb-3 shadow-lg border-2 border-[#dfb76c] flex items-center justify-center">
            <img src="${logoUrl}" alt="Logo CMP Pasco" class="w-full h-full object-contain" onerror="this.src='assets/logo.png'">
          </div>

          <span class="inline-block px-3.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${
            isTitularView
              ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
              : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
          } mb-1.5">
            ${isTitularView ? 'PASE OFICIAL TITULAR (1 PERSONA)' : 'PASE OFICIAL DE ACOMPAÑANTE (1 PERSONA)'}
          </span>
          
          <h2 class="text-lg font-bold font-cinzel tracking-wide text-white leading-tight">
            ${APP_CONFIG.institucion}
          </h2>
          
          <p class="text-xs font-semibold text-purple-200 tracking-wider mt-0.5">
            ${APP_CONFIG.consejoRegional}
          </p>
          
          <p class="text-[10px] text-amber-200/90 font-medium mt-1">
            Gestión 2024 – 2027
          </p>
        </div>

        <!-- 2. Información Principal del Evento -->
        <div class="px-6 py-4 bg-purple-50/50 border-b border-purple-100 text-center">
          <h3 class="font-extrabold text-sm text-[#200530] leading-snug">
            ${config.nombre}
          </h3>
          <div class="flex items-center justify-center gap-3 mt-2 text-xs text-purple-900 font-semibold">
            <span>📅 ${config.fecha}</span>
            <span>•</span>
            <span>⏰ ${config.hora}</span>
          </div>
          <p class="text-xs text-slate-500 mt-1">
            📍 ${config.lugar} — ${config.ciudad || 'Pasco'}
          </p>
        </div>

        <!-- 3. Datos del Titular o Acompañante -->
        <div class="p-6 space-y-4">
          
          <!-- Nombre y Rol -->
          <div class="text-center pb-2 border-b border-purple-100">
            <span class="text-[10px] uppercase font-bold tracking-wider text-purple-900/60 block mb-1">
              ${isTitularView ? 'Médico Colegiado Titular' : 'Invitado de Honor / Acompañante'}
            </span>
            
            <h4 class="text-lg font-black text-[#380036] leading-snug">
              ${isTitularView ? datos.nombres : (datos.nombresAcompanantes && datos.nombresAcompanantes !== 'Ninguno' ? datos.nombresAcompanantes : `Acompañante de Dr(a). ${datos.nombres}`)}
            </h4>

            ${isTitularView ? `
              <div class="flex items-center justify-center gap-2 mt-2">
                <span class="px-3 py-1 bg-purple-50 text-[#380036] border border-purple-200 rounded-lg text-xs font-black">
                  CMP: ${datos.cmp}
                </span>
                ${datos.dni ? `
                  <span class="px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold">
                    DNI: ${datos.dni}
                  </span>
                ` : ''}
              </div>
              <p class="text-xs text-slate-500 italic mt-1.5 font-medium">
                ${datos.especialidad || 'Médico Cirujano'}
              </p>
            ` : `
              <div class="mt-2 bg-emerald-50 border border-emerald-200 py-1 px-3 rounded-lg inline-block">
                <span class="text-xs font-extrabold text-emerald-900">
                  Invitado por: Dr(a). ${datos.nombres} (CMP ${datos.cmp})
                </span>
              </div>
              <p class="text-[11px] text-emerald-700 font-bold mt-1">
                ✓ Abono de S/ 20.00 Aprobado y Validado
              </p>
            `}
          </div>

          <!-- Código QR Central -->
          <div class="flex flex-col items-center justify-center py-1">
            <div class="p-3 bg-white border-2 border-[#dfb76c]/60 rounded-2xl shadow-md inline-block">
              <div class="ticket-qr-slot flex items-center justify-center min-w-[175px] min-h-[175px]"></div>
            </div>
            
            <div class="mt-2.5 text-center">
              <span class="font-mono-code text-xs font-black tracking-wider text-[#380036] bg-purple-50 px-3 py-1 rounded-md border border-purple-200">
                ${codigoDisplay}
              </span>
              <p class="text-[11px] text-slate-400 mt-1 font-medium">
                ${isTitularView ? 'Presente este código QR para el ingreso del titular' : 'Presente este código QR individual en portería'}
              </p>
            </div>
          </div>

          <!-- Cuadrícula de Detalles de la Reserva -->
          <div class="grid grid-cols-2 gap-3 text-xs bg-purple-50/40 p-3.5 rounded-xl border border-purple-100">
            <div>
              <span class="text-purple-900/60 font-bold block text-[10px] uppercase">Tipo de Entrada</span>
              <span class="font-bold text-slate-800 text-xs">
                ${isTitularView ? 'Pase Titular (1 Persona)' : 'Pase Acompañante (1 Persona)'}
              </span>
            </div>

            <div>
              <span class="text-purple-900/60 font-bold block text-[10px] uppercase">Vestimenta</span>
              <span class="font-bold text-slate-800 text-xs">${config.dressCode || 'Gala / Formal'}</span>
            </div>

            ${!isTitularView ? `
              <div class="col-span-2 pt-1.5 border-t border-purple-200/60 flex items-center justify-between">
                <span class="text-purple-900/60 font-bold text-[10px] uppercase">Estado de Abono:</span>
                <span class="font-black text-emerald-800 text-xs bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  S/ 20.00 (Aprobado por Administración) • Ref: ${datos.nroOperacion || 'Verificado'}
                </span>
              </div>
            ` : (tieneAcomp ? `
              <div class="col-span-2 pt-1.5 border-t border-purple-200/60 flex items-center justify-between">
                <span class="text-purple-900/60 font-bold text-[10px] uppercase">Acompañante Registrado:</span>
                <button type="button" onclick="QRManager.cambiarVistaPase('acompanante')" class="font-bold text-purple-900 hover:text-purple-700 text-xs underline">
                  Ver Pase de Acompañante →
                </button>
              </div>
            ` : '')}
          </div>

          <!-- Estado de Asistencia / Validación -->
          <div class="text-center pt-1">
            <span class="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-black rounded-full shadow-sm ${
              isIngreso
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-purple-50 text-[#380036] border border-purple-200'
            }">
              <span class="w-2 h-2 rounded-full ${isIngreso ? 'bg-emerald-500 animate-ping' : 'bg-[#581878]'}"></span>
              ${isIngreso ? 'ASISTENCIA REGISTRADA' : 'PASE AUTORIZADO'}
            </span>
          </div>

        </div>

        <!-- Pie Institucional de Seguridad -->
        <div class="bg-[#200530] text-purple-200 px-4 py-2.5 text-center text-[10px] font-medium border-t border-[#3e0c4b]">
          Documento oficial emitido por el Colegio Médico del Perú — CR XX Pasco
        </div>

      </div>

      <!-- Sección de Comprobante para el Titular si tiene acompañante -->
      ${isTitularView && tieneAcomp ? `
        <div class="mt-3.5 bg-gradient-to-br from-purple-50 to-amber-50 border border-purple-200 p-4 rounded-2xl shadow-sm flex items-center justify-between gap-3">
          <div class="space-y-0.5">
            <span class="text-xs font-black text-[#200530] block">Pase de Acompañante Asociado</span>
            <span class="text-[11px] text-slate-600">Estado: <strong class="${isPagado ? 'text-emerald-700' : 'text-amber-700'}">${isPagado ? '✓ Pago Aprobado (QR Habilitado)' : '🔒 Pendiente de Aprobación'}</strong></span>
          </div>
          <button type="button" onclick="QRManager.cambiarVistaPase('acompanante')" class="px-3 py-2 bg-[#380036] hover:bg-[#200530] text-amber-300 font-extrabold text-xs rounded-xl shadow-xs transition-all shrink-0">
            ${isPagado ? '🎟️ Ver Pase Acompañante' : '🔍 Ver Estado de Pago'}
          </button>
        </div>
      ` : ''}
    `;

    container.innerHTML = ticketHtml;

    // Renderizar el QR dentro del contenedor específico
    setTimeout(() => {
      const qrSlot = container.querySelector(".ticket-qr-slot") || container.querySelector("#ticket-qr-slot");
      if (qrSlot) {
        this.generarQR(qrSlot, qrPayload, 175);
      }
    }, 50);
  },

  /**
   * Descargar Imagen PNG en Ultra Alta Definición (del pase activo seleccionado)
   */
  async descargarTicketPNG(elementId = null, filename = null) {
    let element = null;
    if (elementId) {
      element = document.getElementById(elementId);
    }
    if (!element) {
      const regTicket = document.querySelector("#container-ticket-exitoso-registro #digital-ticket-card");
      const isRegVisible = document.getElementById("container-ticket-exitoso-registro") && !document.getElementById("container-ticket-exitoso-registro").classList.contains("hidden");
      if (isRegVisible && regTicket) {
        element = regTicket;
      } else {
        element = document.querySelector("#ticket-container #digital-ticket-card") || document.querySelector("#digital-ticket-card");
      }
    }

    if (!element) {
      App.showToast("No se encontró el carnet digital para exportar.", "error");
      return;
    }

    const a = StorageService.getUltimaReserva() || StorageService.getAsistentes()[0] || {};
    const isTitular = this.currentTicketType === "titular";
    const cleanName = a.nombres ? String(a.nombres).trim().replace(/[^a-zA-Z0-9]/g, '_') : 'Colegiado';
    const nombreArchivo = filename || (isTitular 
      ? `Pase_Titular_CMP_${a.cmp || a.idReserva}_${cleanName}.png` 
      : `Pase_Acompanante_CMP_${a.cmp || a.idReserva}_${cleanName}.png`);

    try {
      if (typeof html2canvas === "undefined") {
        App.showToast("Cargando componentes gráficos...", "info");
        return;
      }

      App.showToast(`Generando imagen de ${isTitular ? 'Pase Titular' : 'Pase Acompañante'} HD...`, "info");

      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false
      });

      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = nombreArchivo;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      App.showToast("¡Imagen descargada exitosamente!", "success");
      return true;
    } catch (err) {
      console.error("Error al exportar PNG:", err);
      App.showToast("Hubo un problema al generar la imagen.", "error");
      return false;
    }
  },

  /**
   * Descargar Documento PDF Oficial del Pase Activo (Morado y Oro)
   */
  async descargarTicketPDF() {
    const a = StorageService.getUltimaReserva() || StorageService.getAsistentes()[0];
    if (!a) {
      App.showToast("No se encontró ninguna reserva para exportar.", "error");
      return;
    }

    const isTitular = this.currentTicketType === "titular";
    const isPagado = a.estadoPago === "Aprobado" || a.estadoPago === "Pagado";

    if (!isTitular && !isPagado) {
      App.showToast("El pase de acompañante aún no cuenta con la confirmación de pago para emitir el PDF.", "warning");
      return;
    }

    const jsPdfLib = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : window.jsPDF;
    if (typeof jsPdfLib === "undefined" || typeof html2canvas === "undefined") {
      App.showToast("Cargando componentes de PDF...", "info");
      return;
    }

    const config = APP_CONFIG.getEventoConfig();
    const logoUrl = APP_CONFIG.getLogoUrl();
    const qrPayload = isTitular ? (a.qrTitular || a.qrHash || a.idReserva) : (a.qrAcompanante || `${a.idReserva}-ACOMP1`);
    const codigoDisplay = isTitular ? a.idReserva : `${a.idReserva}-ACOMP1`;
    const isIngreso = isTitular ? (a.estado === "Ingresó") : (a.estadoAcompanante === "Ingresó");
    const cleanName = a.nombres ? String(a.nombres).trim().replace(/[^a-zA-Z0-9]/g, '_') : 'Colegiado';
    const filename = isTitular
      ? `Pase_Titular_CMP_${a.cmp || 'Colegiado'}_${cleanName}.pdf`
      : `Pase_Acompanante_CMP_${a.cmp || 'Invitado'}_${cleanName}.pdf`;

    try {
      App.showToast(`Generando PDF oficial de ${isTitular ? 'Pase Titular' : 'Pase Acompañante'}...`, "info");

      // 1. Crear un contenedor temporal fuera de pantalla
      const tempContainer = document.createElement("div");
      tempContainer.style.position = "fixed";
      tempContainer.style.left = "-9999px";
      tempContainer.style.top = "0";
      tempContainer.style.width = "480px";
      tempContainer.style.background = "#ffffff";
      tempContainer.style.zIndex = "99999";
      tempContainer.style.overflow = "visible";
      tempContainer.style.padding = "0";
      tempContainer.style.margin = "0";

      // 2. Insertar el diseño completo del pase en Morado y Dorado Oficial
      tempContainer.innerHTML = `
        <div style="width: 480px; background: #ffffff; border-radius: 20px; overflow: hidden; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; border: 2.5px solid #dfb76c; box-sizing: border-box; color: #0f172a;">
          
          <!-- Cabecera Institucional Morado Obispo -->
          <div style="background: linear-gradient(135deg, #1c0326 0%, #3a0a4a 50%, #54146e 100%); padding: 24px; text-align: center; color: #ffffff; border-bottom: 3.5px solid #dfb76c;">
            <div style="width: 80px; height: 80px; background: #ffffff; border-radius: 16px; padding: 6px; margin: 0 auto 12px auto; border: 2.5px solid #dfb76c; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
              <img src="${logoUrl}" alt="Logo CMP" style="width: 100%; height: 100%; object-fit: contain;">
            </div>

            <span style="display: inline-block; padding: 4px 14px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; border-radius: 9999px; background: rgba(223, 183, 108, 0.25); color: #fef3cd; border: 1px solid rgba(223, 183, 108, 0.5); margin-bottom: 6px;">
              ${isTitular ? 'PASE OFICIAL TITULAR' : 'PASE OFICIAL DE ACOMPAÑANTE'}
            </span>

            <h2 style="font-size: 19px; font-weight: 800; font-family: 'Cinzel', serif; letter-spacing: 0.5px; margin: 0; color: #ffffff; line-height: 1.2;">
              ${APP_CONFIG.institucion}
            </h2>

            <p style="font-size: 12px; font-weight: 700; color: #f5d0fe; letter-spacing: 1px; margin: 4px 0 0 0;">
              ${APP_CONFIG.consejoRegional}
            </p>

            <p style="font-size: 10px; color: #fde68a; margin: 4px 0 0 0; font-weight: 600;">
              Gestión 2024 – 2027
            </p>
          </div>

          <!-- Información del Evento -->
          <div style="padding: 16px 24px; background: #faf5ff; border-bottom: 1px solid #f3e8ff; text-align: center;">
            <h3 style="font-size: 15px; font-weight: 800; color: #200530; margin: 0; line-height: 1.3;">
              ${config.nombre}
            </h3>
            <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 8px; font-size: 12px; font-weight: 700; color: #581c87;">
              <span>📅 ${config.fecha}</span>
              <span>•</span>
              <span>⏰ ${config.hora}</span>
            </div>
            <p style="font-size: 11px; color: #6b21a8; margin: 4px 0 0 0; font-weight: 500;">
              📍 ${config.lugar} — ${config.ciudad || 'Pasco'}
            </p>
          </div>

          <!-- Datos del Titular o Acompañante -->
          <div style="padding: 24px;">
            
            <div style="text-align: center; padding-bottom: 12px; border-bottom: 1px solid #f3e8ff;">
              <span style="font-size: 10px; text-transform: uppercase; font-weight: 800; letter-spacing: 1.5px; color: #9333ea; display: block; margin-bottom: 4px;">
                ${isTitular ? 'MÉDICO COLEGIADO TITULAR' : 'INVITADO DE HONOR'}
              </span>
              <h4 style="font-size: 19px; font-weight: 900; color: #380036; margin: 0; line-height: 1.2;">
                ${isTitular ? a.nombres : (a.nombresAcompanantes && a.nombresAcompanantes !== 'Ninguno' ? a.nombresAcompanantes : `Invitado de Dr(a). ${a.nombres}`)}
              </h4>
              ${isTitular ? `
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 8px;">
                  <span style="padding: 4px 12px; background: #faf5ff; color: #380036; border: 1.5px solid #e9d5ff; border-radius: 8px; font-size: 12px; font-weight: 800;">
                    CMP: ${a.cmp}
                  </span>
                </div>
              ` : `
                <div style="margin-top: 8px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 4px 12px; display: inline-block; font-size: 11px; font-weight: 800; color: #065f46;">
                  Invitado por: Dr(a). ${a.nombres} (CMP ${a.cmp})
                </div>
              `}
            </div>

            <!-- Código QR Central -->
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 14px 0;">
              <div id="pdf-temp-qr" style="padding: 12px; background: #ffffff; border: 2px solid #dfb76c; border-radius: 16px; box-shadow: 0 4px 12px rgba(58,10,74,0.1); display: inline-block;"></div>
              
              <div style="margin-top: 10px; text-align: center;">
                <span style="font-family: 'Space Mono', monospace; font-size: 12px; font-weight: 800; letter-spacing: 1.5px; color: #380036; background: #faf5ff; padding: 4px 12px; border-radius: 6px; border: 1px solid #e9d5ff; display: inline-block;">
                  ${codigoDisplay}
                </span>
                <p style="font-size: 10.5px; color: #94a3b8; margin: 4px 0 0 0; font-weight: 500;">
                  ${isTitular ? 'Pase individual del colegiado titular' : 'Pase individual del acompañante verificado'}
                </p>
              </div>
            </div>

            <!-- Estado de Confirmación -->
            <div style="text-align: center; margin-top: 10px;">
              <span style="display: inline-block; padding: 6px 18px; font-size: 11px; font-weight: 800; border-radius: 9999px; background: ${isIngreso ? '#d1fae5' : '#faf5ff'}; color: ${isIngreso ? '#065f46' : '#380036'}; border: 1.5px solid ${isIngreso ? '#a7f3d0' : '#dfb76c'};">
                ${isIngreso ? 'ASISTENCIA REGISTRADA' : 'PASE AUTORIZADO'}
              </span>
            </div>

          </div>

          <!-- Pie -->
          <div style="background: #200530; color: #e9d5ff; padding: 10px 16px; text-align: center; font-size: 9.5px; font-weight: 500; border-top: 1px solid #3e0c4b;">
            Documento oficial emitido por el Colegio Médico del Perú — Consejo Regional XX Pasco
          </div>

        </div>
      `;

      document.body.appendChild(tempContainer);

      // 3. Renderizar el código QR en el contenedor temporal
      const qrSlot = tempContainer.querySelector("#pdf-temp-qr");
      new QRCode(qrSlot, {
        text: qrPayload,
        width: 175,
        height: 175,
        colorDark: "#200530",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });

      // 4. Esperar breve momento para renderizado total
      await new Promise(r => setTimeout(r, 250));

      // 5. Capturar con html2canvas en ultra alta definición (3.5x)
      const canvas = await html2canvas(tempContainer.firstElementChild, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false
      });

      if (tempContainer.parentNode) {
        document.body.removeChild(tempContainer);
      }

      const imgData = canvas.toDataURL("image/png");

      // 6. Dimensionar el PDF según las proporciones exactas del carnet
      const cardPxWidth = canvas.width;
      const cardPxHeight = canvas.height;
      const aspectRatio = cardPxHeight / cardPxWidth;

      const pdfPageWidth = 148; // mm (Ancho A5)
      const pdfMargin = 10;
      const pdfImgWidth = pdfPageWidth - (pdfMargin * 2);
      const pdfImgHeight = pdfImgWidth * aspectRatio;
      const pdfPageHeight = pdfImgHeight + (pdfMargin * 2);

      const pdf = new jsPdfLib({
        orientation: "portrait",
        unit: "mm",
        format: [pdfPageWidth, pdfPageHeight]
      });

      pdf.setFillColor(250, 245, 255);
      pdf.rect(0, 0, pdfPageWidth, pdfPageHeight, "F");
      pdf.addImage(imgData, "PNG", pdfMargin, pdfMargin, pdfImgWidth, pdfImgHeight);

      pdf.save(filename);
      App.showToast("¡Documento PDF generado exitosamente!", "success");
      return true;
    } catch (err) {
      console.error("Error al exportar PDF:", err);
      App.showToast("Hubo un problema al generar el PDF.", "error");
      return false;
    }
  },

  /**
   * Copiar imagen del Pase Oficial al Portapapeles (para pegar con Ctrl+V en WhatsApp Web)
   */
  async copiarPaseAlPortapapeles(elementId = null) {
    try {
      let element = null;
      if (elementId) {
        element = document.getElementById(elementId);
      }
      if (!element) {
        const regTicket = document.querySelector("#container-ticket-exitoso-registro #digital-ticket-card");
        const isRegVisible = document.getElementById("container-ticket-exitoso-registro") && !document.getElementById("container-ticket-exitoso-registro").classList.contains("hidden");
        if (isRegVisible && regTicket) {
          element = regTicket;
        } else {
          element = document.querySelector("#ticket-container #digital-ticket-card") || document.querySelector("#digital-ticket-card");
        }
      }

      if (element && typeof html2canvas !== "undefined" && navigator.clipboard && typeof ClipboardItem !== "undefined") {
        const canvas = await html2canvas(element, { scale: 2, useCORS: true, allowTaint: true });
        return new Promise((resolve) => {
          canvas.toBlob(async (blob) => {
            if (blob) {
              try {
                await navigator.clipboard.write([
                  new ClipboardItem({ "image/png": blob })
                ]);
                resolve(true);
              } catch (e) {
                console.warn("No se pudo escribir en el portapapeles:", e);
                resolve(false);
              }
            } else {
              resolve(false);
            }
          }, "image/png");
        });
      }
    } catch (err) {
      console.warn("Error en copiarPaseAlPortapapeles:", err);
    }
    return false;
  },

  /**
   * Compartir por WhatsApp con mensaje formal según el pase activo
   * Incluye enlace directo a la imagen del código QR y al Pase Digital en vivo
   */
  async compartirWhatsApp(datos = null) {
    const a = datos || StorageService.getUltimaReserva() || StorageService.getAsistentes()[0];
    if (!a) {
      App.showToast("No hay datos de reserva para compartir.", "warning");
      return;
    }

    const isTitular = this.currentTicketType === "titular";
    const isPagado = a.estadoPago === "Aprobado" || a.estadoPago === "Pagado";
    const config = APP_CONFIG.getEventoConfig();

    if (!isTitular && !isPagado) {
      App.showToast("El pase de acompañante aún está pendiente de validación de pago.", "warning");
      return;
    }

    // Payload de QR según tipo de pase
    const qrPayload = isTitular 
      ? (a.qrTitular || a.qrHash || a.idReserva)
      : (a.qrAcompanante || `${a.idReserva}-ACOMP1`);

    // Enlace público directo a la imagen del código QR en alta definición
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=15&data=${encodeURIComponent(qrPayload)}`;

    // Enlace directo al Pase Digital en la web (si está alojado en servidor/hosting)
    let webTicketUrl = "";
    if (window.location.origin && window.location.origin !== "null" && window.location.protocol.startsWith("http")) {
      const cleanPath = window.location.pathname.endsWith("/") ? window.location.pathname : window.location.pathname;
      webTicketUrl = `${window.location.origin}${cleanPath}?cmp=${encodeURIComponent(a.cmp || a.idReserva)}&tipo=${isTitular ? 'titular' : 'acompanante'}`;
    }

    let texto = "";

    if (isTitular) {
      texto = `🏛️ *COLEGIO MÉDICO DEL PERÚ - CR XX PASCO*\n` +
        `🎟️ *PASE OFICIAL DE ACCESO (TITULAR) - DÍA DE LA MEDICINA PERUANA*\n\n` +
        `Estimado(a) *Dr(a). ${a.nombres}* (CMP: ${a.cmp}), su reserva ha sido confirmada con éxito para la celebración:\n\n` +
        `🎉 *${config.nombre}*\n` +
        `🎤 *Artistas Invitados:* ${config.artistas || "Los Dávila (K'jantu) & Orquesta La Penca"}\n\n` +
        `📅 *Fecha:* ${config.fecha}\n` +
        `⏰ *Hora:* ${config.hora}\n` +
        `📍 *Lugar:* ${config.lugar}\n` +
        `🔢 *Código de Reserva:* ${a.idReserva}\n` +
        `👤 *Tipo de Pase:* Médico Colegiado Titular (1 Persona)\n\n` +
        `📲 *SU CÓDIGO QR DE ACCESO (Haga clic para ver imagen):*\n${qrImageUrl}\n\n` +
        (webTicketUrl ? `🎫 *VER BOLETO DIGITAL EN LÍNEA:*\n${webTicketUrl}\n\n` : "") +
        `_Presente su código QR al ingresar a La Katedral._`;
    } else {
      const nombreAcomp = (a.nombresAcompanantes && a.nombresAcompanantes !== "Ninguno" && String(a.nombresAcompanantes).trim() !== "") 
        ? a.nombresAcompanantes 
        : `Acompañante de Dr(a). ${a.nombres}`;

      texto = `🏛️ *COLEGIO MÉDICO DEL PERÚ - CR XX PASCO*\n` +
        `🎟️ *PASE OFICIAL DE ACOMPAÑANTE / INVITADO - DÍA DE LA MEDICINA PERUANA*\n\n` +
        `Pase de ingreso para: *${nombreAcomp}*\n` +
        `Invitado(a) por: *Dr(a). ${a.nombres}* (CMP: ${a.cmp})\n\n` +
        `🎉 *${config.nombre}*\n` +
        `📅 *Fecha:* ${config.fecha}\n` +
        `⏰ *Hora:* ${config.hora}\n` +
        `📍 *Lugar:* ${config.lugar}\n` +
        `🔢 *Boleto Acompañante:* ${a.idReserva}-ACOMP1\n` +
        `💰 *Estado de Abono:* Aprobado (S/ 20.00)\n\n` +
        `📲 *CÓDIGO QR DEL ACOMPAÑANTE (Haga clic para ver imagen):*\n${qrImageUrl}\n\n` +
        (webTicketUrl ? `🎫 *VER BOLETO DIGITAL EN LÍNEA:*\n${webTicketUrl}\n\n` : "") +
        `_Presente este código QR individual en portería para su acceso._`;
    }

    const cleanDigits = String(a.celular || "").replace(/[^0-9]/g, "");
    let phoneParam = "";
    if (cleanDigits.length === 9) {
      phoneParam = `phone=51${cleanDigits}&`;
    } else if (cleanDigits.length === 11 && cleanDigits.startsWith("51")) {
      phoneParam = `phone=${cleanDigits}&`;
    }

    const url = `https://api.whatsapp.com/send?${phoneParam}text=${encodeURIComponent(texto)}`;
    
    // Intentar copiar la imagen del boleto al portapapeles en background
    const copiado = await this.copiarPaseAlPortapapeles();
    
    window.open(url, "_blank");

    if (copiado) {
      App.showToast("Abriendo WhatsApp... ¡Pase copiado! Puede presionar Ctrl+V en el chat para pegar la imagen.", "success");
    } else {
      App.showToast("Abriendo WhatsApp con enlace al Código QR...", "info");
    }
  },

  /**
   * Compartir Nativo Móvil (Envía directamente la imagen PNG del ticket por WhatsApp u otras apps)
   */
  async compartirNativo(elementId = null) {
    const a = StorageService.getUltimaReserva() || StorageService.getAsistentes()[0];
    if (!a) {
      App.showToast("No hay datos de reserva para compartir.", "warning");
      return;
    }

    let element = null;
    if (elementId) {
      element = document.getElementById(elementId);
    }
    if (!element) {
      const regTicket = document.querySelector("#container-ticket-exitoso-registro #digital-ticket-card");
      const isRegVisible = document.getElementById("container-ticket-exitoso-registro") && !document.getElementById("container-ticket-exitoso-registro").classList.contains("hidden");
      if (isRegVisible && regTicket) {
        element = regTicket;
      } else {
        element = document.querySelector("#ticket-container #digital-ticket-card") || document.querySelector("#digital-ticket-card");
      }
    }

    if (navigator.share && element && typeof html2canvas !== "undefined") {
      try {
        App.showToast("Preparando pase para compartir...", "info");
        const canvas = await html2canvas(element, { scale: 2, useCORS: true, allowTaint: true });
        canvas.toBlob(async (blob) => {
          const isTit = this.currentTicketType === "titular";
          const file = new File([blob], `Pase_CMP_${isTit ? 'Titular' : 'Acompanante'}_${a.cmp || a.idReserva}.png`, { type: "image/png" });
          try {
            await navigator.share({
              title: `Pase Oficial CMP Pasco - ${a.nombres}`,
              text: `Pase oficial de ingreso (${isTit ? 'Titular' : 'Acompañante'}) para ${a.nombres} (CMP ${a.cmp}) - Colegio Médico del Perú.`,
              files: [file]
            });
          } catch (shareErr) {
            if (shareErr.name !== "AbortError") {
              this.compartirWhatsApp(a);
            }
          }
        });
      } catch (err) {
        this.compartirWhatsApp(a);
      }
    } else {
      this.compartirWhatsApp(a);
    }
  },

  /**
   * Efectos de Sonido
   */
  reproducirSonido(tipo = "success") {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      if (tipo === "success") {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        osc.frequency.setValueAtTime(783.99, now + 0.16);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (tipo === "warning") {
        const now = ctx.currentTime;
        const playBeep = (time, freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, time);
          gain.gain.setValueAtTime(0.3, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
          osc.start(time);
          osc.stop(time + 0.12);
        };
        playBeep(now, 440);
        playBeep(now + 0.15, 370);
      } else if (tipo === "error") {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.setValueAtTime(160, now + 0.15);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch (e) {
      console.warn("Audio Context no disponible:", e);
    }
  }
};
