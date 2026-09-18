/**
 * =========================================================================================
 * MÓDULO DE ESCÁNER QR Y VALIDACIÓN EN PUERTA (SCANNER SERVICE)
 * =========================================================================================
 */

let html5QrCode = null;
let isScanning = false;
let scanCooldown = false;

const ScannerService = {
  /**
   * Iniciar la cámara para escanear códigos QR
   */
  async iniciarEscaner(containerId = "reader", onScanSuccessCallback) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (isScanning) {
      console.log("El escáner ya se encuentra activo.");
      return;
    }

    try {
      if (typeof Html5Qrcode === "undefined") {
        alert("La librería de escáner aún se está cargando. Por favor, espere 2 segundos y vuelva a presionar Iniciar.");
        return;
      }

      html5QrCode = new Html5Qrcode(containerId);
      
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      // Preferir cámara trasera en teléfonos móviles
      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText, decodedResult) => {
          if (scanCooldown) return;
          scanCooldown = true;
          setTimeout(() => { scanCooldown = false; }, 2500); // 2.5s cooldown entre escaneos

          console.log("QR Detectado:", decodedText);
          this.procesarCodigoEscaneado(decodedText);
        },
        (errorMessage) => {
          // Ignorar errores continuos de búsqueda de frame
        }
      );

      isScanning = true;
      this.actualizarUIEscaner(true);
    } catch (err) {
      console.error("Error al iniciar la cámara:", err);
      isScanning = false;
      this.actualizarUIEscaner(false);
      alert("No se pudo acceder a la cámara. Verifique que concedió permisos de cámara en su navegador o use la búsqueda manual por CMP/DNI.");
    }
  },

  /**
   * Detener la cámara
   */
  async detenerEscaner() {
    if (html5QrCode && isScanning) {
      try {
        await html5QrCode.stop();
        html5QrCode.clear();
      } catch (e) {
        console.warn("Error al detener cámara:", e);
      }
    }
    isScanning = false;
    this.actualizarUIEscaner(false);
  },

  /**
   * Alternar estado de la cámara
   */
  async toggleEscaner() {
    if (isScanning) {
      await this.detenerEscaner();
    } else {
      await this.iniciarEscaner("reader");
    }
  },

  /**
   * Actualizar botones de la interfaz del escáner
   */
  actualizarUIEscaner(activo) {
    const btnToggle = document.getElementById("btn-toggle-camera");
    const laser = document.getElementById("scanner-laser-beam");
    const statusText = document.getElementById("scanner-status-text");

    if (btnToggle) {
      if (activo) {
        btnToggle.innerHTML = `
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"></path>
          </svg>
          <span>Detener Cámara</span>
        `;
        btnToggle.className = "flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md transition-all";
      } else {
        btnToggle.innerHTML = `
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
          </svg>
          <span>Activar Cámara</span>
        `;
        btnToggle.className = "flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white bg-[#003366] hover:bg-[#002244] shadow-md transition-all";
      }
    }

    if (laser) {
      laser.style.display = activo ? "block" : "none";
    }

    if (statusText) {
      statusText.innerText = activo 
        ? "Enfoca el código QR del asistente en el recuadro..." 
        : "Cámara en reposo. Presiona 'Activar Cámara' para comenzar.";
    }
  },

  /**
   * Procesar código detectado por escáner o ingresado manualmente
   */
  async procesarCodigoEscaneado(codigoTexto) {
    if (!codigoTexto || !codigoTexto.trim()) return;
    const codigo = codigoTexto.trim();

    // Nombre del validador / staff
    const validador = localStorage.getItem("cmp_validador_nombre") || "Staff Recepción";

    // Mostrar estado de carga
    this.mostrarResultadoModal({
      tipo: "cargando",
      titulo: "Verificando...",
      mensaje: "Consultando base de datos del CMP Pasco..."
    });

    try {
      // Validar contra Sheets o Local
      const resultado = await SheetsService.validarIngresoEnSheets(codigo, validador);

      if (!resultado || !resultado.success) {
        // ERROR O PAGO PENDIENTE
        QRManager.reproducirSonido("error");
        
        if (resultado && resultado.estado === "PAGO_PENDIENTE") {
          this.mostrarResultadoModal({
            tipo: "pago_pendiente",
            titulo: "⚠️ PAGO NO CONFIRMADO",
            mensaje: resultado.mensaje || "El abono de este acompañante aún no ha sido aprobado.",
            asistente: resultado.asistente,
            codigo: codigo
          });
        } else {
          this.mostrarResultadoModal({
            tipo: "error",
            titulo: "❌ BOLETO NO VÁLIDO",
            mensaje: resultado?.mensaje || "El código escaneado no está registrado en el sistema.",
            codigo: codigo
          });
        }
      } else if (resultado.estado === "YA_INGRESADO") {
        // ALERTA DUPLICADO
        QRManager.reproducirSonido("warning");
        this.mostrarResultadoModal({
          tipo: "warning",
          titulo: resultado.esAcompanante ? "⚠️ BOLETO DE ACOMPAÑANTE YA UTILIZADO" : "⚠️ BOLETO TITULAR YA UTILIZADO",
          mensaje: "Este pase ya fue registrado previamente en la puerta de ingreso.",
          asistente: resultado.asistente,
          esAcompanante: resultado.esAcompanante,
          fechaIngreso: resultado.fechaPrimerIngreso,
          validadoPor: resultado.validadoPor
        });
      } else {
        // VÁLIDO / INGRESO EXITOSO
        QRManager.reproducirSonido("success");
        this.mostrarResultadoModal({
          tipo: "success",
          titulo: resultado.esAcompanante ? "✅ INGRESO ACOMPAÑANTE AUTORIZADO" : "✅ INGRESO TITULAR AUTORIZADO",
          mensaje: "¡Bienvenido al evento del Colegio Médico!",
          asistente: resultado.asistente,
          esAcompanante: resultado.esAcompanante,
          horaIngreso: resultado.horaIngreso
        });

        // Actualizar estadísticas de aforo si la pestaña admin existe
        if (typeof AdminService !== "undefined") {
          AdminService.actualizarEstadisticas();
          AdminService.renderizarTabla();
        }
      }
    } catch (e) {
      console.error("Error al procesar validación:", e);
      QRManager.reproducirSonido("error");
      this.mostrarResultadoModal({
        tipo: "error",
        titulo: "Error de Validación",
        mensaje: "Ocurrió un inconveniente al conectar con el servidor. Intente nuevamente."
      });
    }
  },

  /**
   * Mostrar ventana emergente con el resultado de la validación
   */
  mostrarResultadoModal(info) {
    const modal = document.getElementById("validation-result-modal");
    const content = document.getElementById("validation-result-content");
    if (!modal || !content) return;

    let html = "";

    if (info.tipo === "cargando") {
      html = `
        <div class="p-8 text-center space-y-4">
          <div class="w-14 h-14 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <h3 class="text-xl font-bold text-slate-800">${info.titulo}</h3>
          <p class="text-sm text-slate-500">${info.mensaje}</p>
        </div>
      `;
    } else if (info.tipo === "success") {
      const a = info.asistente;
      const esAcomp = info.esAcompanante;

      html = `
        <div class="text-center ${esAcomp ? 'bg-[#380036] border-b-2 border-amber-400' : 'bg-emerald-600'} text-white p-6 rounded-t-2xl">
          <div class="w-16 h-16 bg-white ${esAcomp ? 'text-[#380036]' : 'text-emerald-600'} rounded-full flex items-center justify-center mx-auto mb-2 shadow-lg">
            <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <span class="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-bold uppercase tracking-wider mb-1 text-amber-300">
            ${esAcomp ? 'PASE ACOMPAÑANTE AUTORIZADO (1 PERSONA)' : 'PASE TITULAR AUTORIZADO (1 PERSONA)'}
          </span>
          <h3 class="text-2xl font-black">${info.titulo}</h3>
          <p class="text-xs text-purple-100 mt-1">${info.mensaje}</p>
        </div>

        <div class="p-6 space-y-4 bg-white">
          <!-- Datos del Asistente -->
          <div class="border-b border-slate-100 pb-3 text-center">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              ${esAcomp ? 'Invitado / Acompañante de' : 'Médico Colegiado Titular'}
            </span>
            <h4 class="text-xl font-extrabold text-[#380036] mt-0.5">
              ${esAcomp ? (a.nombresAcompanantes && a.nombresAcompanantes !== 'Ninguno' ? a.nombresAcompanantes : `Invitado de Dr(a). ${a.nombres}`) : a.nombres}
            </h4>
            <div class="flex items-center justify-center gap-2 mt-1 font-semibold text-xs text-slate-600">
              <span class="bg-purple-100 text-[#380036] px-2.5 py-0.5 rounded-md font-bold">CMP: ${a.cmp}</span>
              ${a.dni ? `<span class="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md">DNI: ${a.dni}</span>` : ''}
            </div>
            ${esAcomp ? `<p class="text-xs text-emerald-800 font-bold mt-1">✓ Abono de S/ 20.00 Aprobado</p>` : `<p class="text-xs text-slate-500 italic mt-1">${a.especialidad || 'Médico Cirujano'}</p>`}
          </div>

          <!-- Detalles adicionales -->
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span class="text-slate-400 block text-[10px] uppercase font-bold">Tipo de Pase</span>
              <span class="font-extrabold text-slate-800 text-xs">
                ${esAcomp ? 'Acompañante (1 Pers)' : 'Titular (1 Pers)'}
              </span>
            </div>
            <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span class="text-slate-400 block text-[10px] uppercase font-bold">Hora de Ingreso</span>
              <span class="font-extrabold text-emerald-700 text-xs">${info.horaIngreso || 'Ahora'}</span>
            </div>
          </div>

          <!-- Si es Titular y tiene Acompañante pendiente de ingreso -->
          ${!esAcomp && parseInt(a.acompanantes || 0) > 0 ? `
            <div class="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs space-y-2">
              <div class="flex items-center justify-between">
                <span class="font-bold text-[#380036]">Pase de Acompañante Asociado:</span>
                <span class="px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                  (a.estadoAcompanante === 'Ingresó' || a.estadoAcompanante === 'Asistió')
                    ? 'bg-emerald-100 text-emerald-800'
                    : (a.estadoPago === 'Aprobado' || a.estadoPago === 'Pagado')
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                }">
                  ${(a.estadoAcompanante === 'Ingresó' || a.estadoAcompanante === 'Asistió') ? '✓ Ya Ingresó' : ((a.estadoPago === 'Aprobado' || a.estadoPago === 'Pagado') ? '⏳ Pendiente' : '🔒 Pago Pend.')}
                </span>
              </div>
              
              ${(a.estadoPago === 'Aprobado' || a.estadoPago === 'Pagado') && a.estadoAcompanante !== 'Ingresó' && a.estadoAcompanante !== 'Asistió' ? `
                <button type="button" onclick="ScannerService.validarAcompananteDirecto('${a.idReserva}')" class="w-full py-2 bg-[#380036] hover:bg-[#200530] text-amber-300 font-bold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-1">
                  <span>🎟️ Validar Ingreso de Acompañante Ahora</span>
                </button>
              ` : ''}
            </div>
          ` : ''}

          <!-- Botón de acción -->
          <div class="pt-2">
            <button onclick="ScannerService.cerrarModalResultado()" class="w-full py-3 bg-gradient-to-r from-[#200530] to-[#4a154b] hover:from-[#150220] hover:to-[#380036] text-amber-300 font-extrabold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 border border-amber-400/40">
              <span>Continuar Escaneando</span>
              <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
              </svg>
            </button>
          </div>
        </div>
      `;
    } else if (info.tipo === "pago_pendiente") {
      const a = info.asistente || {};
      html = `
        <div class="text-center bg-rose-700 text-white p-6 rounded-t-2xl">
          <div class="w-16 h-16 bg-white text-rose-700 rounded-full flex items-center justify-center mx-auto mb-2 shadow-lg animate-bounce">
            <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
          </div>
          <span class="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-bold uppercase tracking-wider mb-1 text-amber-300">
            PAGO NO CONFIRMADO
          </span>
          <h3 class="text-2xl font-black">${info.titulo}</h3>
          <p class="text-xs text-rose-100 mt-1">${info.mensaje}</p>
        </div>

        <div class="p-6 space-y-4 bg-white">
          <div class="bg-rose-50 border-2 border-rose-300 rounded-xl p-3.5 text-center text-xs text-rose-950 space-y-1">
            <p class="font-bold">El abono de S/ 20.00 del acompañante aún no ha sido aprobado en administración.</p>
            <p class="text-slate-600">Verifique con el administrador del evento para validar el voucher antes de permitir el acceso.</p>
          </div>

          <div class="text-center border-t border-slate-100 pt-3">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Médico Colegiado Responsable</span>
            <h4 class="text-lg font-bold text-slate-800 mt-0.5">${a.nombres || 'Colegiado'}</h4>
            <p class="text-xs text-slate-600 font-semibold mt-1">CMP: ${a.cmp || '--'} | N° Operación: ${a.nroOperacion || 'Sin registrar'}</p>
          </div>

          <div class="pt-2">
            <button onclick="ScannerService.cerrarModalResultado()" class="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow transition-all">
              Entendido / Cerrar
            </button>
          </div>
        </div>
      `;
    } else if (info.tipo === "warning") {
      const a = info.asistente || {};
      const esAcomp = info.esAcompanante;

      html = `
        <div class="text-center bg-amber-500 text-white p-6 rounded-t-2xl">
          <div class="w-16 h-16 bg-white text-amber-600 rounded-full flex items-center justify-center mx-auto mb-2 shadow-lg animate-bounce">
            <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
          </div>
          <span class="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-bold uppercase tracking-wider mb-1">
            DUPLICADO DETECTADO
          </span>
          <h3 class="text-xl font-black">${info.titulo}</h3>
          <p class="text-xs text-amber-100 mt-1">${info.mensaje}</p>
        </div>

        <div class="p-6 space-y-4 bg-white">
          <div class="bg-amber-50 border-2 border-amber-300 rounded-xl p-3.5 text-center">
            <p class="text-xs font-bold text-amber-900">Primer Ingreso Registrado el:</p>
            <p class="text-base font-extrabold text-amber-700 mt-0.5">📅 ${info.fechaIngreso || 'Hora no registrada'}</p>
            ${info.validadoPor ? `<p class="text-[11px] text-amber-800 mt-1">Por: <strong>${info.validadoPor}</strong></p>` : ''}
          </div>

          <div class="text-center border-t border-slate-100 pt-3">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              ${esAcomp ? 'Acompañante de' : 'Titular del Boleto'}
            </span>
            <h4 class="text-lg font-bold text-slate-800 mt-0.5">${a.nombres || 'Asistente'}</h4>
            <p class="text-xs text-slate-600 font-semibold mt-1">CMP: ${a.cmp || '--'} | DNI: ${a.dni || '--'}</p>
          </div>

          <div class="pt-2">
            <button onclick="ScannerService.cerrarModalResultado()" class="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow transition-all">
              Entendido / Cerrar
            </button>
          </div>
        </div>
      `;
    } else {
      // ERROR / NO ENCONTRADO
      html = `
        <div class="text-center bg-rose-600 text-white p-6 rounded-t-2xl">
          <div class="w-16 h-16 bg-white text-rose-600 rounded-full flex items-center justify-center mx-auto mb-2 shadow-lg">
            <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </div>
          <h3 class="text-2xl font-black">${info.titulo}</h3>
          <p class="text-xs text-rose-100 mt-1">${info.mensaje}</p>
        </div>

        <div class="p-6 space-y-4 bg-white text-center">
          ${info.codigo ? `
            <div class="bg-slate-100 p-3 rounded-lg font-mono text-xs text-slate-700">
              Código leído: <strong class="text-rose-600">${info.codigo}</strong>
            </div>
          ` : ''}
          <p class="text-xs text-slate-500">
            Asegúrese de que el asistente esté previamente inscrito o intente buscarlo manualmente por su N° de CMP o DNI.
          </p>
          <div class="pt-2">
            <button onclick="ScannerService.cerrarModalResultado()" class="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow transition-all">
              Reintentar Escaneo
            </button>
          </div>
        </div>
      `;
    }

    content.innerHTML = html;
    modal.classList.remove("hidden");
  },

  /**
   * Validar directamente el acompañante desde el modal de éxito del titular
   */
  async validarAcompananteDirecto(idReserva) {
    this.cerrarModalResultado();
    await this.procesarCodigoEscaneado(`${idReserva}-ACOMP1`);
  },

  /**
   * Cerrar la ventana emergente de resultado y refrescar interfaz
   */
  cerrarModalResultado() {
    const modal = document.getElementById("validation-result-modal");
    if (modal) {
      modal.classList.add("hidden");
    }

    if (typeof AdminService !== "undefined") {
      AdminService.actualizarEstadisticas();
      AdminService.renderizarTabla();
    }
  }
};
