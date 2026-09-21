/**
 * =========================================================================================
 * MÓDULO DE REGISTRO E INSCRIPCIÓN CON VALIDACIÓN DE PADRÓN Y ABONO DE ACOMPAÑANTES
 * COLEGIO MÉDICO DEL PERÚ - CONSEJO REGIONAL XX PASCO
 * =========================================================================================
 */

const RegistroService = {
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

    // Control de acompañante (mostrar/ocultar campo de nombre de acompañante)
    const selectAcompanantes = document.getElementById("reg-acompanantes");
    const containerNombreAcomp = document.getElementById("container-nombre-acompanante");

    if (selectAcompanantes) {
      selectAcompanantes.addEventListener("change", (e) => {
        const val = parseInt(e.target.value || 0);
        if (val > 0) {
          if (containerNombreAcomp) containerNombreAcomp.classList.remove("hidden");
        } else {
          if (containerNombreAcomp) containerNombreAcomp.classList.add("hidden");
        }
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

    // 3. DATOS DE ACOMPAÑANTE (100% GRATUITO)
    let nombresAcompanantes = "Ninguno";
    if (numAcompanantes > 0) {
      const inputNombreAcomp = document.getElementById("reg-nombres-acompanante")?.value.trim();
      nombresAcompanantes = inputNombreAcomp || "Acompañante Registrado";
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
      const qrHash = `${idReserva}-${cmp}`;

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
        nombresAcompanantes,
        requerimientos: "Ninguno",
        montoPago: 0,
        metodoPago: "Gratuito",
        nroOperacion: "N/A",
        voucherImg: "",
        enlaceVoucherDrive: "",
        estadoPago: "Gratuito",
        estado: "Pendiente",
        fechaIngreso: "",
        validadoPor: "",
        qrTitular: qrHash,
        qrHash: qrHash,
        qrAcompanante: numAcompanantes > 0 ? qrHash : "",
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

    const containerNombreAcomp = document.getElementById("container-nombre-acompanante");
    if (containerNombreAcomp) containerNombreAcomp.classList.add("hidden");

    const feedback = document.getElementById("cmp-padron-feedback");
    if (feedback) {
      feedback.className = "hidden";
      feedback.innerHTML = "";
    }

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
