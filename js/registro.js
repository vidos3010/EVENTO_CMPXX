/**
 * =========================================================================================
 * MÓDULO DE REGISTRO E INSCRIPCIÓN CON VALIDACIÓN DE PADRÓN Y ABONO DE ACOMPAÑANTES
 * COLEGIO MÉDICO DEL PERÚ - CONSEJO REGIONAL XX PASCO
 * =========================================================================================
 */

const RegistroService = {
  voucherBase64: "",

  /**
   * Inicializar escuchadores del formulario de registro
   */
  init() {
    const form = document.getElementById("form-registro");
    const inputCmp = document.getElementById("reg-cmp");
    if (!form) return;

    // Escuchador de envío de formulario
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await this.procesarFormulario();
    });

    // Validación y autocompletado en tiempo real al escribir el CMP
    if (inputCmp) {
      inputCmp.addEventListener("input", (e) => {
        this.verificarCMPEnTiempoReal(e.target.value);
      });
      inputCmp.addEventListener("blur", (e) => {
        this.verificarCMPEnTiempoReal(e.target.value, true);
      });
    }

    // Control de acompañante y despliegue del módulo de pago
    const selectAcompanantes = document.getElementById("reg-acompanantes");
    const containerPago = document.getElementById("container-pago-acompanantes");
    const txtMontoTotal = document.getElementById("pago-monto-total");

    if (selectAcompanantes) {
      selectAcompanantes.addEventListener("change", (e) => {
        const val = parseInt(e.target.value || 0);

        if (val > 0) {
          if (containerPago) containerPago.classList.remove("hidden");
          if (txtMontoTotal) txtMontoTotal.innerText = `S/ 20.00`;
        } else {
          if (containerPago) containerPago.classList.add("hidden");
          if (txtMontoTotal) txtMontoTotal.innerText = `S/ 0.00`;
        }
      });
    }

    // Manejo de carga de voucher de pago
    const inputVoucher = document.getElementById("reg-voucher-file");
    const labelVoucherText = document.getElementById("label-voucher-text");
    const previewContainer = document.getElementById("voucher-preview-container");
    const previewImg = document.getElementById("voucher-preview-img");
    const btnRemoveVoucher = document.getElementById("btn-remove-voucher");

    if (inputVoucher) {
      inputVoucher.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (file) {
          try {
            App.showToast("Procesando y optimizando imagen del voucher...", "info");
            const compressed = await StorageService.comprimirImagen(file, 800, 0.75);
            this.voucherBase64 = compressed || "";
            if (previewImg) previewImg.src = this.voucherBase64;
            if (previewContainer) previewContainer.classList.remove("hidden");
            if (labelVoucherText) labelVoucherText.innerText = "Cambiar Voucher";
            App.showToast("✓ Captura del voucher lista y adjuntada.", "success");
          } catch (err) {
            console.error("Error al procesar voucher:", err);
            const reader = new FileReader();
            reader.onload = (event) => {
              this.voucherBase64 = event.target.result;
              if (previewImg) previewImg.src = this.voucherBase64;
              if (previewContainer) previewContainer.classList.remove("hidden");
              if (labelVoucherText) labelVoucherText.innerText = "Cambiar Voucher";
            };
            reader.readAsDataURL(file);
          }
        }
      });
    }

    if (btnRemoveVoucher) {
      btnRemoveVoucher.addEventListener("click", () => {
        this.voucherBase64 = "";
        if (inputVoucher) inputVoucher.value = "";
        if (previewContainer) previewContainer.classList.add("hidden");
        if (labelVoucherText) labelVoucherText.innerText = "Adjuntar Voucher";
        App.showToast("Voucher removido.", "info");
      });
    }
  },

  /**
   * Verificar CMP contra el Padrón Oficial y reservas existentes en tiempo real
   */
  verificarCMPEnTiempoReal(cmp, isBlur = false) {
    const inputNombres = document.getElementById("reg-nombres");
    const btnSubmit = document.getElementById("btn-submit-registro");
    let feedback = document.getElementById("cmp-padron-feedback");

    if (!feedback) {
      feedback = document.createElement("div");
      feedback.id = "cmp-padron-feedback";
      const cmpContainer = document.getElementById("reg-cmp")?.parentElement?.parentElement;
      if (cmpContainer) {
        cmpContainer.appendChild(feedback);
      }
    }

    const cleanCmp = String(cmp || "").trim();
    if (!cleanCmp || cleanCmp.length < 3) {
      feedback.className = "hidden";
      feedback.innerHTML = "";
      if (inputNombres) {
        inputNombres.value = "";
        inputNombres.readOnly = true;
        inputNombres.classList.remove("bg-emerald-50", "text-emerald-950", "bg-rose-50");
        inputNombres.classList.add("bg-slate-100/90", "cursor-not-allowed");
      }
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.classList.remove("opacity-50", "cursor-not-allowed");
      }
      return;
    }

    if (typeof PadronService === "undefined") return;

    const colegiado = PadronService.buscarPorCMP(cleanCmp);

    if (colegiado) {
      // 1. Verificar si el colegiado YA cuenta con una reserva activa
      const reservaExistente = typeof StorageService !== "undefined" ? StorageService.buscarAsistente(cleanCmp) : null;

      if (reservaExistente) {
        // 🚫 BLOQUEO: Ya tiene inscripción activa
        feedback.className = "mt-2 p-3 bg-rose-50 border-2 border-rose-300 rounded-xl text-xs text-rose-950 font-bold space-y-2 animate-fadeIn shadow-xs";
        feedback.innerHTML = `
          <div class="flex items-start gap-2">
            <span class="text-lg">🚫</span>
            <div class="flex-1">
              <span class="block font-black text-rose-900 uppercase">Colegiado Ya Registrado en el Sistema</span>
              <p class="text-[11px] text-rose-800 font-medium mt-0.5">
                El Dr(a). <strong class="text-rose-950">${colegiado.nombres}</strong> ya tiene una inscripción registrada con código <strong class="font-mono">${reservaExistente.idReserva}</strong>.
              </p>
              <p class="text-[10px] text-rose-700 italic mt-1 font-semibold">
                ⚠️ Solo se permite una inscripción por número de colegiatura (CMP).
              </p>
            </div>
          </div>
          <div class="pt-1 border-t border-rose-200/80 flex items-center justify-between gap-2">
            <span class="text-[10px] text-slate-600 font-semibold">¿Desea ver su boleto?</span>
            <button type="button" onclick="RegistroService.mostrarBoletoRegistrado('${cleanCmp}')" 
              class="px-2.5 py-1 bg-[#4a154b] hover:bg-[#380036] text-amber-300 rounded-lg text-[11px] font-bold shadow-xs transition-all flex items-center gap-1">
              🎟️ Ver mi Boleto Actual
            </button>
          </div>
        `;

        if (inputNombres) {
          inputNombres.value = colegiado.nombres;
          inputNombres.readOnly = true;
          inputNombres.classList.remove("bg-emerald-50", "text-emerald-950");
          inputNombres.classList.add("bg-rose-50", "text-rose-950", "cursor-not-allowed");
        }

        if (btnSubmit) {
          btnSubmit.disabled = true;
          btnSubmit.classList.add("opacity-50", "cursor-not-allowed");
        }
        return;
      }

      // ✅ Encontrado en el padrón de agremiados y SIN reserva previa (Habilitado para registrarse)
      feedback.className = "mt-2 p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-bold flex items-center gap-2 animate-fadeIn";
      feedback.innerHTML = `
        <span class="text-base">✅</span>
        <div class="flex-1">
          <span class="block font-black text-[#065f46]">MÉDICO COLEGIADO HABILITADO PARA INSCRIBIRSE</span>
          <span class="text-[11px] text-emerald-800 font-semibold">${colegiado.nombres} • Estado: ${colegiado.habilidad || 'HABIL'}</span>
        </div>
      `;

      // Cargar estrictamente el nombre oficial del padrón (Inmutable)
      if (inputNombres) {
        inputNombres.value = colegiado.nombres;
        inputNombres.readOnly = true;
        inputNombres.classList.remove("bg-slate-100/90", "bg-rose-50", "text-rose-950");
        inputNombres.classList.add("bg-emerald-50", "text-emerald-950", "font-black", "cursor-not-allowed");
      }

      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.classList.remove("opacity-50", "cursor-not-allowed");
      }
    } else if (cleanCmp.length >= 4 || isBlur) {
      // ❌ No figura en el padrón de Pasco
      feedback.className = "mt-2 p-2.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 font-bold flex items-center gap-2 animate-fadeIn";
      feedback.innerHTML = `
        <span class="text-base">⚠️</span>
        <div class="flex-1">
          <span class="block font-black text-rose-800">NO REGISTRADO EN EL PADRÓN CMP PASCO</span>
          <span class="text-[11px] text-rose-700 font-normal">Solo los médicos agremiados en el Consejo Regional Pasco pueden reservar.</span>
        </div>
      `;

      if (inputNombres) {
        inputNombres.value = "";
        inputNombres.readOnly = true;
        inputNombres.classList.remove("bg-emerald-50", "text-emerald-950", "bg-rose-50");
        inputNombres.classList.add("bg-slate-100/90", "cursor-not-allowed");
      }

      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.classList.remove("opacity-50", "cursor-not-allowed");
      }
    }
  },

  /**
   * Procesar datos del formulario, validar contra padrón, verificar pago y guardar
   */
  async procesarFormulario() {
    const btnSubmit = document.getElementById("btn-submit-registro");
    const originalText = btnSubmit ? btnSubmit.innerHTML : "";

    // Obtener valores de los campos simplificados
    const cmp = document.getElementById("reg-cmp")?.value.trim();
    const nombres = document.getElementById("reg-nombres")?.value.trim();
    const celular = document.getElementById("reg-celular")?.value.trim();
    const correo = document.getElementById("reg-correo")?.value.trim() || "";
    const numAcompanantes = parseInt(document.getElementById("reg-acompanantes")?.value || "0");

    // 1. Validaciones básicas de campos
    if (!cmp || !nombres || !celular) {
      App.showToast("Por favor complete los campos obligatorios (*)", "warning");
      return;
    }

    if (cmp.length < 3) {
      App.showToast("Ingrese un número de CMP válido.", "error");
      return;
    }

    // 2. VALIDACIÓN ESTRICTA CONTRA EL PADRÓN DE AGREMIADOS
    if (typeof PadronService !== "undefined") {
      const validacion = PadronService.validarIngresoReserva(cmp);
      
      if (!validacion.valido) {
        if (validacion.motivo === "NO_REGISTRADO") {
          App.showToast(validacion.mensaje, "error");
          if (typeof QRManager !== "undefined") QRManager.reproducirSonido("error");
          return;
        }

        if (validacion.motivo === "YA_REGISTRADO") {
          App.showToast(validacion.mensaje, "warning");
          if (typeof QRManager !== "undefined") QRManager.reproducirSonido("warning");
          
          this.mostrarBoletoExitoso(validacion.reservaExistente);
          return;
        }
      }
    }

    // 3. VALIDACIÓN DE PAGO PARA ACOMPAÑANTE
    let montoPago = 0;
    let metodoPago = "Gratuito (Titular)";
    let nroOperacion = "N/A";
    let estadoPago = "Gratuito";
    const voucherImg = this.voucherBase64 || "";

    if (numAcompanantes > 0) {
      montoPago = 20;
      metodoPago = document.getElementById("reg-metodo-pago")?.value || "Yape";
      nroOperacion = document.getElementById("reg-nro-operacion")?.value.trim() || "";
      estadoPago = "Pendiente de Validación";

      if (!nroOperacion) {
        App.showToast("Por favor ingrese el N° de Operación del pago de su acompañante.", "warning");
        const inputOp = document.getElementById("reg-nro-operacion");
        if (inputOp) {
          inputOp.focus();
          inputOp.classList.add("ring-2", "ring-rose-500");
        }
        return;
      }
    }

    // Cambiar estado del botón a cargando
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = `
        <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        <span>Verificando y Generando Boleto QR...</span>
      `;
    }

    try {
      // Generar ID único de reserva
      const now = new Date();
      const fechaStr = now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0');
      const randomCode = Math.floor(1000 + Math.random() * 9000);
      const idReserva = `CMP-${fechaStr}-${randomCode}`;
      const fechaRegistro = now.toLocaleString("es-PE", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false
      });
      const qrTitular = `${idReserva}-${cmp}`;
      const qrAcompanante = numAcompanantes > 0 ? `${idReserva}-ACOMP1` : "";

      const nuevoAsistente = {
        idReserva,
        fechaRegistro,
        cmp,
        dni: "",
        nombres,
        especialidad: "Médico Colegiado",
        celular,
        correo: correo || "",
        acompanantes: numAcompanantes,
        nombresAcompanantes: numAcompanantes > 0 ? "Acompañante Registrado" : "Ninguno",
        requerimientos: "Ninguno",
        montoPago,
        metodoPago,
        nroOperacion,
        voucherImg,
        estadoPago,
        estado: "Pendiente",
        fechaIngreso: "",
        validadoPor: "",
        qrTitular,
        qrHash: qrTitular,
        qrAcompanante,
        estadoAcompanante: numAcompanantes > 0 ? "Pendiente" : "",
        fechaIngresoAcompanante: "",
        validadoPorAcompanante: ""
      };

      // 1. Guardar en almacenamiento local (con verificación estricta de duplicados)
      const resGuardar = StorageService.agregarAsistente(nuevoAsistente);
      if (!resGuardar.success) {
        App.showToast(resGuardar.mensaje, "error");
        if (typeof QRManager !== "undefined") QRManager.reproducirSonido("error");
        return;
      }

      // 2. Enviar a Google Sheets de manera asíncrona
      if (SheetsService.isConfigured()) {
        SheetsService.registrarEnSheets(nuevoAsistente).catch(err => {
          console.warn("No se pudo sincronizar inmediatamente con Sheets:", err);
        });
      }

      // 3. Efectos de éxito (Confetti + Sonido)
      QRManager.reproducirSonido("success");
      if (typeof confetti === "function") {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }

      App.showToast("¡Reserva confirmada con éxito!", "success");

      // 4. Iniciar sesión de colegiado para acceso a Mi Boleto
      if (typeof AuthService !== "undefined" && !AuthService.isAuthenticated()) {
        AuthService.setSession(nuevoAsistente.nombres || nuevoAsistente.cmp, "colegiado");
        if (typeof App !== "undefined" && typeof App.actualizarEstadoAuthEnUI === "function") {
          App.actualizarEstadoAuthEnUI();
        }
      }

      // 5. Mostrar inmediatamente el boleto QR en la misma pestaña de Inscripción
      this.mostrarBoletoExitoso(nuevoAsistente);
      App.cargarListaAsistentesEnTicket();

    } catch (err) {
      console.error("Error al procesar reserva:", err);
      App.showToast("Hubo un error al procesar la reserva. Intente nuevamente.", "error");
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
      }
    }
  },

  /**
   * Mostrar el Pase QR en la misma pestaña de Inscripción
   */
  mostrarBoletoExitoso(asistente) {
    if (!asistente) return;

    StorageService.guardarUltimaReserva(asistente);

    const containerForm = document.getElementById("container-formulario-registro");
    const containerTicket = document.getElementById("container-ticket-exitoso-registro");

    if (containerForm) containerForm.classList.add("hidden");

    if (containerTicket) {
      containerTicket.classList.remove("hidden");
      QRManager.renderizarTicket(asistente, "ticket-inscripcion-render");
      containerTicket.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  },

  /**
   * Ver boleto cuando el colegiado ya cuenta con reserva registrada
   */
  mostrarBoletoRegistrado(cmp) {
    const asistente = StorageService.buscarAsistente(cmp);
    if (!asistente) {
      App.showToast("No se encontró la reserva del colegiado.", "error");
      return;
    }
    this.mostrarBoletoExitoso(asistente);
  },

  /**
   * Volver a mostrar el formulario de registro y permitir nueva inscripción
   */
  mostrarFormularioRegistro() {
    const containerForm = document.getElementById("container-formulario-registro");
    const containerTicket = document.getElementById("container-ticket-exitoso-registro");
    const form = document.getElementById("form-registro");

    if (form) form.reset();
    this.voucherBase64 = "";

    const previewContainer = document.getElementById("voucher-preview-container");
    if (previewContainer) previewContainer.classList.add("hidden");

    const feedback = document.getElementById("cmp-padron-feedback");
    if (feedback) {
      feedback.className = "hidden";
      feedback.innerHTML = "";
    }

    const containerPago = document.getElementById("container-pago-acompanantes");
    if (containerPago) containerPago.classList.add("hidden");

    const inputNombres = document.getElementById("reg-nombres");
    if (inputNombres) {
      inputNombres.value = "";
      inputNombres.classList.remove("bg-emerald-50", "text-emerald-950", "bg-rose-50", "text-rose-950");
      inputNombres.classList.add("bg-slate-100/90");
    }

    const btnSubmit = document.getElementById("btn-submit-registro");
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.classList.remove("opacity-50", "cursor-not-allowed");
    }

    if (containerTicket) containerTicket.classList.add("hidden");
    if (containerForm) {
      containerForm.classList.remove("hidden");
      containerForm.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
};
