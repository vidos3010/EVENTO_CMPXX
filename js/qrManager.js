/**
 * =========================================================================================
 * GESTOR DE BOLETOS EJECUTIVOS, QR Y EXPORTACIÓN - COLEGIO MÉDICO DEL PERÚ XX PASCO
 * COLORES OFICIALES: MORADO INSTITUCIONAL (#380036 / #4A154B) Y DORADO IMPERIAL (#DFB76C)
 * SOPORTE PARA PASE DOBLE (2 PERSONAS) O INDIVIDUAL (1 PERSONA)
 * =========================================================================================
 */

const QRManager = {
  /**
   * Generar código QR nítido en un contenedor
   */
  generarQR(containerElement, texto, size = 180) {
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
   * Renderizar el Pase / Carnet Oficial Institucional en la Web (Morado y Oro)
   * Diseñado con soporte de Pase Doble (2 Personas) o Pase Individual (1 Persona)
   */
  renderizarTicket(datos, containerId = "ticket-container") {
    const container = document.getElementById(containerId);
    if (!container || !datos) return;

    const config = APP_CONFIG.getEventoConfig();
    const logoUrl = APP_CONFIG.getLogoUrl();
    const numAcomp = parseInt(datos.acompanantes || 0);
    const esPaseDoble = numAcomp > 0;
    const qrPayload = datos.qrHash || datos.qrTitular || `${datos.idReserva}-${datos.cmp}`;
    const codigoDisplay = datos.idReserva || `CMP-${datos.cmp}`;
    const isIngreso = datos.estado === "Ingresó" || datos.estado === "Asistió";
    const nombreAcomp = (datos.nombresAcompanantes && datos.nombresAcompanantes !== "Ninguno" && String(datos.nombresAcompanantes).trim() !== "")
      ? datos.nombresAcompanantes
      : "Acompañante Registrado";

    const ticketHtml = `
      <div id="digital-ticket-card" class="executive-card max-w-md mx-auto text-slate-800 bg-white border-2 border-[#dfb76c]/70 rounded-3xl overflow-hidden shadow-2xl animate-fadeIn">
        
        <!-- 1. Cabecera Institucional Oficial (Morado Obispo & Oro) -->
        <div class="card-header-purple p-6 text-white text-center relative overflow-hidden">
          
          <!-- Logo Oficial del Colegio Médico -->
          <div class="w-20 h-20 bg-white rounded-2xl p-2 mx-auto mb-3 shadow-lg border-2 border-[#dfb76c] flex items-center justify-center">
            <img src="${logoUrl}" alt="Logo CMP Pasco" class="w-full h-full object-contain" onerror="this.src='assets/logo.png'">
          </div>

          <!-- Distintivo de Pase Doble o Individual -->
          <span class="inline-flex items-center gap-1.5 px-3.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-full ${
            esPaseDoble
              ? 'bg-amber-400 text-[#200530] shadow-md border border-amber-300'
              : 'bg-purple-900/80 text-amber-300 border border-amber-400/40'
          } mb-2">
            ${esPaseDoble ? '🎟️ PASE DOBLE — VALIDEZ: 2 PERSONAS' : '👨‍⚕️ PASE INDIVIDUAL — VALIDEZ: 1 PERSONA'}
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
        <div class="px-6 py-4 bg-purple-50/60 border-b border-purple-100 text-center">
          <h3 class="font-extrabold text-sm text-[#200530] leading-snug">
            ${config.nombre}
          </h3>
          <div class="flex items-center justify-center gap-3 mt-2 text-xs text-purple-900 font-semibold">
            <span>📅 ${config.fecha}</span>
            <span>•</span>
            <span>⏰ ${config.hora}</span>
          </div>
          <p class="text-xs text-slate-600 mt-1">
            📍 ${config.lugar} — ${config.ciudad || 'Pasco'}
          </p>
        </div>

        <!-- 3. Datos del Titular y Acompañante -->
        <div class="p-6 space-y-4">
          
          <!-- Nombre del Médico Colegiado -->
          <div class="text-center pb-3 border-b border-purple-100">
            <span class="text-[10px] uppercase font-black tracking-wider text-purple-900/70 block mb-1">
              Médico Colegiado Titular
            </span>
            
            <h4 class="text-lg font-black text-[#380036] leading-snug">
              ${datos.nombres}
            </h4>

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
            <p class="text-xs text-slate-500 italic mt-1 font-medium">
              ${datos.especialidad || 'Médico Cirujano'}
            </p>
          </div>

          <!-- Caja de Acompañante si es Pase Doble -->
          ${esPaseDoble ? `
            <div class="p-3 bg-gradient-to-r from-amber-50 via-purple-50 to-amber-50 border-2 border-amber-300/80 rounded-2xl text-center space-y-1 shadow-xs">
              <div class="flex items-center justify-center gap-1.5 text-xs font-black text-amber-950">
                <span>👥</span>
                <span>INCLUYE 1 ACOMPAÑANTE</span>
              </div>
              <span class="inline-block text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-md border border-emerald-300">
                ✓ Ingreso autorizado para 2 personas con este único código QR
              </span>
            </div>
          ` : ''}

          <!-- Código QR Central Único -->
          <div class="flex flex-col items-center justify-center py-2">
            <div class="p-3 bg-white border-2 border-[#dfb76c] rounded-2xl shadow-lg inline-block">
              <div class="ticket-qr-slot flex items-center justify-center min-w-[180px] min-h-[180px]"></div>
            </div>
            
            <div class="mt-2.5 text-center">
              <span class="font-mono-code text-xs font-black tracking-wider text-[#380036] bg-purple-50 px-3.5 py-1 rounded-md border border-purple-200 shadow-2xs">
                ${codigoDisplay}
              </span>
              <p class="text-[11px] text-slate-500 mt-1.5 font-semibold">
                ${esPaseDoble ? '🎟️ Pase Doble: Válido para el ingreso de 2 personas' : '👨‍⚕️ Pase Individual: Válido para 1 persona'}
              </p>
            </div>
          </div>

          <!-- Cuadrícula de Detalles de la Reserva -->
          <div class="grid grid-cols-2 gap-3 text-xs bg-purple-50/50 p-3.5 rounded-2xl border border-purple-100">
            <div>
              <span class="text-purple-900/60 font-black block text-[10px] uppercase">Modalidad</span>
              <span class="font-extrabold text-slate-800 text-xs">
                ${esPaseDoble ? '🎟️ Pase Doble (2 Personas)' : '👨‍⚕️ Pase Individual (1 Persona)'}
              </span>
            </div>

            <div>
              <span class="text-purple-900/60 font-black block text-[10px] uppercase">Código de Vestimenta</span>
              <span class="font-bold text-slate-800 text-xs">${config.dressCode || 'Gala / Formal'}</span>
            </div>

            <div class="col-span-2 pt-2 border-t border-purple-200/60 flex items-center justify-between text-xs">
              <span class="text-purple-900/70 font-bold text-[11px]">Acceso al Evento:</span>
              <span class="font-black text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 text-[11px]">
                100% Gratuito e Institucional
              </span>
            </div>
          </div>

          <!-- Estado de Asistencia / Validación -->
          <div class="text-center pt-1">
            <span class="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-black rounded-full shadow-sm ${
              isIngreso
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-purple-50 text-[#380036] border border-purple-200'
            }">
              <span class="w-2 h-2 rounded-full ${isIngreso ? 'bg-emerald-500 animate-ping' : 'bg-[#581878]'}"></span>
              ${isIngreso ? `ASISTENCIA REGISTRADA (${esPaseDoble ? '2 PERSONAS' : '1 PERSONA'})` : `PASE AUTORIZADO (${esPaseDoble ? '2 PERSONAS' : '1 PERSONA'})`}
            </span>
          </div>

        </div>

        <!-- Pie Institucional de Seguridad -->
        <div class="bg-[#200530] text-purple-200 px-4 py-2.5 text-center text-[10px] font-medium border-t border-[#3e0c4b]">
          Documento oficial emitido por el Colegio Médico del Perú — CR XX Pasco
        </div>

      </div>
    `;

    container.innerHTML = ticketHtml;

    // Renderizar el QR dentro del contenedor
    setTimeout(() => {
      const qrSlot = container.querySelector(".ticket-qr-slot");
      if (qrSlot) {
        this.generarQR(qrSlot, qrPayload, 180);
      }
    }, 50);
  },

  /**
   * Descargar Imagen PNG en Ultra Alta Definición
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
    const esDoble = parseInt(a.acompanantes || 0) > 0;
    const cleanName = a.nombres ? String(a.nombres).trim().replace(/[^a-zA-Z0-9]/g, '_') : 'Colegiado';
    const nombreArchivo = filename || (esDoble 
      ? `Pase_Doble_CMP_${a.cmp || a.idReserva}_${cleanName}.png` 
      : `Pase_Individual_CMP_${a.cmp || a.idReserva}_${cleanName}.png`);

    try {
      if (typeof html2canvas === "undefined") {
        App.showToast("Cargando componentes gráficos...", "info");
        return;
      }

      App.showToast(`Generando imagen de ${esDoble ? 'Pase Doble (2 Personas)' : 'Pase Individual'} HD...`, "info");

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
   * Descargar Documento PDF Oficial del Pase (Morado y Oro)
   */
  async descargarTicketPDF() {
    const a = StorageService.getUltimaReserva() || StorageService.getAsistentes()[0];
    if (!a) {
      App.showToast("No se encontró ninguna reserva para exportar.", "error");
      return;
    }

    const jsPdfLib = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : window.jsPDF;
    if (typeof jsPdfLib === "undefined" || typeof html2canvas === "undefined") {
      App.showToast("Cargando componentes de PDF...", "info");
      return;
    }

    const config = APP_CONFIG.getEventoConfig();
    const logoUrl = APP_CONFIG.getLogoUrl();
    const esDoble = parseInt(a.acompanantes || 0) > 0;
    const qrPayload = a.qrHash || a.qrTitular || `${a.idReserva}-${a.cmp}`;
    const codigoDisplay = a.idReserva || `CMP-${a.cmp}`;
    const isIngreso = a.estado === "Ingresó" || a.estado === "Asistió";
    const cleanName = a.nombres ? String(a.nombres).trim().replace(/[^a-zA-Z0-9]/g, '_') : 'Colegiado';
    const nombreAcomp = (a.nombresAcompanantes && a.nombresAcompanantes !== "Ninguno" && String(a.nombresAcompanantes).trim() !== "")
      ? a.nombresAcompanantes
      : "Acompañante Registrado";

    const filename = esDoble
      ? `Pase_Doble_2Personas_CMP_${a.cmp || 'Colegiado'}_${cleanName}.pdf`
      : `Pase_Individual_CMP_${a.cmp || 'Colegiado'}_${cleanName}.pdf`;

    try {
      App.showToast(`Generando PDF oficial (${esDoble ? 'Pase Doble - 2 Personas' : 'Pase Individual'})...`, "info");

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

            <span style="display: inline-block; padding: 5px 16px; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; border-radius: 9999px; background: ${esDoble ? '#dfb76c' : 'rgba(223, 183, 108, 0.25)'}; color: ${esDoble ? '#200530' : '#fef3cd'}; border: 1.5px solid #dfb76c; margin-bottom: 8px;">
              ${esDoble ? '🎟️ PASE DOBLE — VALIDEZ: 2 PERSONAS' : '👨‍⚕️ PASE INDIVIDUAL — VALIDEZ: 1 PERSONA'}
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

          <!-- Datos del Titular y Acompañante -->
          <div style="padding: 24px;">
            
            <div style="text-align: center; padding-bottom: 12px; border-bottom: 1px solid #f3e8ff;">
              <span style="font-size: 10px; text-transform: uppercase; font-weight: 800; letter-spacing: 1.5px; color: #9333ea; display: block; margin-bottom: 4px;">
                MÉDICO COLEGIADO TITULAR
              </span>
              <h4 style="font-size: 19px; font-weight: 900; color: #380036; margin: 0; line-height: 1.2;">
                ${a.nombres}
              </h4>
              <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 8px;">
                <span style="padding: 4px 12px; background: #faf5ff; color: #380036; border: 1.5px solid #e9d5ff; border-radius: 8px; font-size: 12px; font-weight: 800;">
                  CMP: ${a.cmp}
                </span>
              </div>
            </div>

            ${esDoble ? `
              <div style="margin-top: 12px; padding: 10px 14px; background: #fefce8; border: 1.5px solid #fde047; border-radius: 12px; text-align: center;">
                <span style="font-size: 11px; font-weight: 900; color: #854d0e; text-transform: uppercase; display: block;">
                  👥 INCLUYE 1 ACOMPAÑANTE
                </span>
                <span style="font-size: 10px; font-weight: 700; color: #15803d; margin-top: 3px; display: block;">
                  ✓ Validez: 2 Personas (Titular + 1 Acompañante)
                </span>
              </div>
            ` : ''}

            <!-- Código QR Central -->
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 14px 0;">
              <div id="pdf-temp-qr" style="padding: 12px; background: #ffffff; border: 2px solid #dfb76c; border-radius: 16px; box-shadow: 0 4px 12px rgba(58,10,74,0.1); display: inline-block;"></div>
              
              <div style="margin-top: 10px; text-align: center;">
                <span style="font-family: 'Space Mono', monospace; font-size: 12px; font-weight: 800; letter-spacing: 1.5px; color: #380036; background: #faf5ff; padding: 4px 12px; border-radius: 6px; border: 1px solid #e9d5ff; display: inline-block;">
                  ${codigoDisplay}
                </span>
                <p style="font-size: 11px; color: #64748b; margin: 4px 0 0 0; font-weight: 600;">
                  ${esDoble ? '🎟️ Pase Doble: Escanear en puerta para validar 2 personas' : '👨‍⚕️ Pase Individual: Escanear en puerta para validar 1 persona'}
                </p>
              </div>
            </div>

            <!-- Estado de Confirmación -->
            <div style="text-align: center; margin-top: 10px;">
              <span style="display: inline-block; padding: 6px 18px; font-size: 11px; font-weight: 800; border-radius: 9999px; background: ${isIngreso ? '#d1fae5' : '#faf5ff'}; color: ${isIngreso ? '#065f46' : '#380036'}; border: 1.5px solid ${isIngreso ? '#a7f3d0' : '#dfb76c'};">
                ${isIngreso ? `ASISTENCIA REGISTRADA (${esDoble ? '2 PERSONAS' : '1 PERSONA'})` : `PASE AUTORIZADO (${esDoble ? '2 PERSONAS' : '1 PERSONA'})`}
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
        width: 180,
        height: 180,
        colorDark: "#200530",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });

      // 4. Esperar breve momento para renderizado total
      await new Promise(r => setTimeout(r, 250));

      // 5. Capturar con html2canvas en ultra alta definición (3x)
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
   * Compartir por WhatsApp con mensaje formal indicando Pase Doble o Individual
   */
  async compartirWhatsApp(datos = null) {
    const a = datos || StorageService.getUltimaReserva() || StorageService.getAsistentes()[0];
    if (!a) {
      App.showToast("No hay datos de reserva para compartir.", "warning");
      return;
    }

    const esDoble = parseInt(a.acompanantes || 0) > 0;
    const config = APP_CONFIG.getEventoConfig();
    const qrPayload = a.qrHash || a.qrTitular || `${a.idReserva}-${a.cmp}`;

    // Enlace público directo a la imagen del código QR en alta definición
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=15&data=${encodeURIComponent(qrPayload)}`;

    // Enlace directo al Pase Digital en la web
    let webTicketUrl = "";
    if (window.location.origin && window.location.origin !== "null" && window.location.protocol.startsWith("http")) {
      const cleanPath = window.location.pathname.endsWith("/") ? window.location.pathname : window.location.pathname;
      webTicketUrl = `${window.location.origin}${cleanPath}?cmp=${encodeURIComponent(a.cmp || a.idReserva)}`;
    }

    let texto = "";

    if (esDoble) {
      const nombreAcomp = (a.nombresAcompanantes && a.nombresAcompanantes !== "Ninguno" && String(a.nombresAcompanantes).trim() !== "") 
        ? a.nombresAcompanantes 
        : "Acompañante Registrado";

      texto = `🏛️ *COLEGIO MÉDICO DEL PERÚ - CR XX PASCO*\n` +
        `🎟️ *PASE OFICIAL DE ACCESO (PASE DOBLE - 2 PERSONAS)*\n` +
        `🎊 *DÍA DE LA MEDICINA PERUANA 2026*\n\n` +
        `Estimado(a) *Dr(a). ${a.nombres}* (CMP: ${a.cmp}), su inscripción para 2 personas ha sido confirmada con éxito:\n\n` +
        `🎉 *${config.nombre}*\n` +
        `🎤 *Artistas Invitados:* ${config.artistas || "Los Dávila (K'jantu) & Orquesta La Penca"}\n\n` +
        `📅 *Fecha:* ${config.fecha}\n` +
        `⏰ *Hora:* ${config.hora}\n` +
        `📍 *Lugar:* ${config.lugar}\n` +
        `🔢 *Código de Reserva:* ${a.idReserva}\n` +
        `👥 *Modalidad:* Pase Doble (Válido para 2 Personas: Titular + 1 Acompañante)\n` +
        `🎫 *Validez:* Ingreso autorizado para 2 personas con este único código QR\n\n` +
        `📲 *SU CÓDIGO QR DE ACCESO (Haga clic para ver imagen):*\n${qrImageUrl}\n\n` +
        (webTicketUrl ? `🎫 *VER BOLETO DIGITAL EN LÍNEA:*\n${webTicketUrl}\n\n` : "") +
        `_Presente este único código QR en la entrada de La Katedral para el ingreso de ambas personas._`;
    } else {
      texto = `🏛️ *COLEGIO MÉDICO DEL PERÚ - CR XX PASCO*\n` +
        `🎟️ *PASE OFICIAL DE ACCESO (PASE INDIVIDUAL - 1 PERSONA)*\n` +
        `🎊 *DÍA DE LA MEDICINA PERUANA 2026*\n\n` +
        `Estimado(a) *Dr(a). ${a.nombres}* (CMP: ${a.cmp}), su reserva ha sido confirmada con éxito:\n\n` +
        `🎉 *${config.nombre}*\n` +
        `🎤 *Artistas Invitados:* ${config.artistas || "Los Dávila (K'jantu) & Orquesta La Penca"}\n\n` +
        `📅 *Fecha:* ${config.fecha}\n` +
        `⏰ *Hora:* ${config.hora}\n` +
        `📍 *Lugar:* ${config.lugar}\n` +
        `🔢 *Código de Reserva:* ${a.idReserva}\n` +
        `👤 *Tipo de Pase:* Pase Individual (1 Persona)\n\n` +
        `📲 *SU CÓDIGO QR DE ACCESO (Haga clic para ver imagen):*\n${qrImageUrl}\n\n` +
        (webTicketUrl ? `🎫 *VER BOLETO DIGITAL EN LÍNEA:*\n${webTicketUrl}\n\n` : "") +
        `_Presente su código QR al ingresar a La Katedral._`;
    }

    const cleanDigits = String(a.celular || "").replace(/[^0-9]/g, "");
    let phoneParam = "";
    if (cleanDigits.length === 9) {
      phoneParam = `phone=51${cleanDigits}&`;
    } else if (cleanDigits.length === 11 && cleanDigits.startsWith("51")) {
      phoneParam = `phone=${cleanDigits}&`;
    }

    const url = `https://api.whatsapp.com/send?${phoneParam}text=${encodeURIComponent(texto)}`;
    
    // Intentar copiar la imagen del boleto al portapapeles
    const copiado = await this.copiarPaseAlPortapapeles();
    
    window.open(url, "_blank");

    if (copiado) {
      App.showToast("Abriendo WhatsApp... ¡Pase copiado! Puede presionar Ctrl+V en el chat para pegar la imagen.", "success");
    } else {
      App.showToast("Abriendo WhatsApp con enlace al Código QR...", "info");
    }
  },

  /**
   * Compartir Nativo Móvil
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

    const esDoble = parseInt(a.acompanantes || 0) > 0;

    if (navigator.share && element && typeof html2canvas !== "undefined") {
      try {
        App.showToast("Preparando pase para compartir...", "info");
        const canvas = await html2canvas(element, { scale: 2, useCORS: true, allowTaint: true });
        canvas.toBlob(async (blob) => {
          const file = new File([blob], `Pase_CMP_${esDoble ? 'Doble_2Pers' : 'Individual'}_${a.cmp || a.idReserva}.png`, { type: "image/png" });
          try {
            await navigator.share({
              title: `Pase Oficial CMP Pasco - ${a.nombres}`,
              text: `Pase oficial de ingreso (${esDoble ? 'Pase Doble - 2 Personas' : 'Pase Individual'}) para ${a.nombres} (CMP ${a.cmp}) - Colegio Médico del Perú.`,
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
