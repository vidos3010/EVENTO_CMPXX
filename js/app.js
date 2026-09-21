/**
 * =========================================================================================
 * CONTROLADOR PRINCIPAL DE LA APLICACIÓN (APP ROUTER & CONTROLLER)
 * COLEGIO MÉDICO DEL PERÚ - CONSEJO REGIONAL XX PASCO
 * =========================================================================================
 */

const App = {
  currentTab: "inscripcion",
  pestanaPendienteAuth: null,

  /**
   * Inicializar aplicación
   */
  init() {
    this.initSplash();
    this.bindNavigation();
    this.bindConfigForm();
    this.bindBoletoActions();
    this.bindManualSearch();
    this.bindAuthForm();
    this.actualizarEstadoAuthEnUI();
    
    // Limpiar y sanitizar almacenamiento local (elimina filas de encabezados accidentales)
    StorageService.guardarTodos(StorageService.getAsistentes());

    // Inicializar módulos
    RegistroService.init();
    AdminService.init();

    // Precargar comprobantes de IndexedDB en memoria
    if (typeof StorageService.precargarVouchersDesdeIndexedDB === "function") {
      StorageService.precargarVouchersDesdeIndexedDB();
    }

    // Cargar última reserva si existe para mostrar en Mi Boleto
    const ultimaReserva = StorageService.getUltimaReserva();
    if (ultimaReserva) {
      QRManager.renderizarTicket(ultimaReserva, "ticket-container");
    } else {
      const demo = StorageService.getAsistentes()[0];
      if (demo) {
        QRManager.renderizarTicket(demo, "ticket-container");
      }
    }

    // Inicializar iconos de Lucide
    if (typeof lucide !== "undefined") {
      lucide.createIcons();
    }

    // Verificar si hay URL de Google Sheets guardada y cargar datos
    this.cargarConfiguracionEnUI();

    // Comprobar parámetros en URL (acceso directo desde enlace de WhatsApp)
    this.checkUrlParams();

    console.log("Aplicación CMP Pasco inicializada correctamente.");
  },

  /**
   * Verificar parámetros en la URL (ej: ?cmp=12345 o ?reserva=ID o ?ticket=...)
   * Permite abrir directamente el boleto digital desde el enlace compartido por WhatsApp
   */
  checkUrlParams() {
    try {
      const params = new URLSearchParams(window.location.search);
      const cmpParam = params.get("cmp") || params.get("CMP");
      const reservaParam = params.get("reserva") || params.get("id") || params.get("ticket");
      const tipoParam = params.get("tipo"); // "titular" | "acompanante"

      const query = (cmpParam || reservaParam || "").trim();
      if (!query) return;

      const asistente = StorageService.buscarAsistente(query);
      if (asistente) {
        StorageService.guardarUltimaReserva(asistente);
        if (typeof QRManager !== "undefined") {
          QRManager.currentTicketType = (tipoParam === "acompanante" || tipoParam === "acomp") ? "acompanante" : "titular";
          QRManager.renderizarTicket(asistente, "ticket-container", QRManager.currentTicketType);
        }

        // Mostrar pestaña de Boleto
        const sections = document.querySelectorAll(".app-section");
        sections.forEach(sec => sec.classList.add("hidden"));
        const activeSection = document.getElementById("section-boleto");
        if (activeSection) activeSection.classList.remove("hidden");
        this.currentTab = "boleto";

        const inputSearchCmp = document.getElementById("input-search-ticket-cmp");
        if (inputSearchCmp) inputSearchCmp.value = asistente.cmp || "";

        const selectAttendee = document.getElementById("select-attendee-ticket");
        if (selectAttendee) selectAttendee.value = asistente.idReserva;

        // Actualizar botones de navegación desktop
        const desktopNavBtns = document.querySelectorAll(".nav-tab-btn");
        desktopNavBtns.forEach(btn => {
          if (btn.getAttribute("data-tab-target") === "boleto") {
            btn.classList.add("bg-amber-400", "text-[#200530]", "font-bold", "shadow-sm");
            btn.classList.remove("text-white/80", "hover:bg-white/10");
          } else {
            btn.classList.remove("bg-amber-400", "text-[#200530]", "font-bold", "shadow-sm");
            btn.classList.add("text-white/80", "hover:bg-white/10");
          }
        });

        this.showToast(`¡Boleto oficial de ${asistente.nombres} cargado!`, "success");
      }
    } catch (err) {
      console.warn("Error al procesar parámetros URL:", err);
    }
  },

  /**
   * Pantalla de Carga Ejecutiva Oficial (Splash Screen de 3 Segundos)
   */
  initSplash() {
    const splash = document.getElementById("app-splash-screen");
    const bar = document.getElementById("splash-progress-bar");
    const statusText = document.getElementById("splash-status-text");
    const percentText = document.getElementById("splash-percent-text");
    const logoImg = document.getElementById("splash-logo-img");

    if (logoImg) {
      logoImg.src = APP_CONFIG.getLogoUrl();
    }

    if (!splash) return;

    const totalDuration = 3000; // 3.0 segundos
    const startTime = Date.now();

    const hitos = [
      { at: 0, text: "Iniciando plataforma institucional..." },
      { at: 25, text: "Cargando padrón oficial de agremiados..." },
      { at: 55, text: "Sincronizando pases duales y QR..." },
      { at: 80, text: "Configurando entorno de validación..." },
      { at: 95, text: "¡Bienvenido, Colegiado!" }
    ];

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, Math.round((elapsed / totalDuration) * 100));

      if (bar) bar.style.width = `${progress}%`;
      if (percentText) percentText.innerText = `${progress}%`;

      for (let i = hitos.length - 1; i >= 0; i--) {
        if (progress >= hitos[i].at) {
          if (statusText && statusText.innerText !== hitos[i].text) {
            statusText.innerText = hitos[i].text;
          }
          break;
        }
      }

      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          splash.classList.add("splash-hidden");
          setTimeout(() => {
            splash.style.display = "none";
          }, 800);
        }, 200);
      }
    }, 25);
  },

  /**
   * Manejador de navegación por pestañas
   */
  bindNavigation() {
    const navButtons = document.querySelectorAll("[data-tab-target]");
    navButtons.forEach(btn => {
      btn.addEventListener("click", (e) => {
        const targetTab = e.currentTarget.getAttribute("data-tab-target");
        this.cambiarPestana(targetTab);
      });
    });
  },

  /**
   * Cambiar de pestaña activa con Protección por Usuario y Contraseña
   */
  cambiarPestana(tabName) {
    // Pestañas restringidas que requieren autenticación
    const pestanasProtegidas = ["boleto", "validacion", "admin", "configuracion"];

    if (pestanasProtegidas.includes(tabName) && typeof AuthService !== "undefined") {
      if (!AuthService.isAuthenticated()) {
        this.pestanaPendienteAuth = tabName;
        this.abrirModalAuth();
        return;
      }

      // Si el rol es colegiado y trata de ingresar a módulos de administración / portería
      const role = AuthService.getCurrentRole();
      if (role === "colegiado" && ["validacion", "admin", "configuracion"].includes(tabName)) {
        this.showToast("Acceso restringido: Se requieren credenciales de directivo o staff.", "warning");
        this.pestanaPendienteAuth = tabName;
        this.abrirModalAuth();
        return;
      }
    }

    this.currentTab = tabName;

    // Si salimos de la pestaña de validación, apagar la cámara
    if (tabName !== "validacion" && typeof ScannerService !== "undefined") {
      ScannerService.detenerEscaner();
    }

    // Actualizar secciones visuales
    const sections = document.querySelectorAll(".app-section");
    sections.forEach(sec => {
      sec.classList.add("hidden");
    });

    const activeSection = document.getElementById(`section-${tabName}`);
    if (activeSection) {
      activeSection.classList.remove("hidden");
    }

    // Actualizar botones de navegación desktop
    const desktopNavBtns = document.querySelectorAll(".nav-tab-btn");
    desktopNavBtns.forEach(btn => {
      const isTarget = btn.getAttribute("data-tab-target") === tabName;
      if (isTarget) {
        btn.classList.add("bg-amber-400", "text-[#200530]", "font-bold", "shadow-sm");
        btn.classList.remove("text-white/80", "hover:bg-white/10");
      } else {
        btn.classList.remove("bg-amber-400", "text-[#200530]", "font-bold", "shadow-sm");
        btn.classList.add("text-white/80", "hover:bg-white/10");
      }
    });

    // Actualizar botones de navegación mobile
    const mobileNavBtns = document.querySelectorAll(".mobile-nav-btn");
    mobileNavBtns.forEach(btn => {
      const isTarget = btn.getAttribute("data-tab-target") === tabName;
      if (isTarget) {
        btn.classList.add("text-[#4a154b]", "font-extrabold");
        btn.classList.remove("text-slate-400");
      } else {
        btn.classList.remove("text-[#4a154b]", "font-extrabold");
        btn.classList.add("text-slate-400");
      }
    });

    // Si entra a la pestaña de boleto, refrescar la lista de asistentes
    if (tabName === "boleto") {
      this.cargarListaAsistentesEnTicket();
    }

    // Si entra a la pestaña de administración, actualizar tabla y stats
    if (tabName === "admin" && typeof AdminService !== "undefined") {
      AdminService.actualizarEstadisticas();
      AdminService.renderizarTabla();
    }

    // Si entra a la pestaña de configuración, cargar valores
    if (tabName === "configuracion") {
      this.cargarConfiguracionEnUI();
    }

    // Sincronización automática con Google Sheets al entrar a Mi Boleto, Validación QR y Asistencia
    if (["boleto", "validacion", "admin"].includes(tabName)) {
      this.sincronizarAutomatico(tabName);
    }
  },

  /**
   * Sincronización automática no bloqueante con Google Sheets en pestañas operativas
   */
  async sincronizarAutomatico(tabName) {
    if (typeof SheetsService === "undefined" || !SheetsService.isConfigured()) return;

    try {
      const res = await SheetsService.sincronizarDesdeGoogleSheets();
      if (res && res.success) {
        // Actualizar estadísticas y tabla si está en administración
        if (this.currentTab === "admin" && typeof AdminService !== "undefined") {
          AdminService.actualizarEstadisticas();
          AdminService.renderizarTabla();
        }
        // Actualizar lista en Mi Boleto
        if (this.currentTab === "boleto") {
          this.cargarListaAsistentesEnTicket();
        }
        console.log(`[Auto-Sync] Sincronización completada al entrar a '${tabName}' (${res.nuevos || 0} registros actualizados).`);
      }
    } catch (err) {
      console.warn(`[Auto-Sync] Error no bloqueante al sincronizar en '${tabName}':`, err);
    }
  },

  /**
   * Modal de Login / Autenticación
   */
  abrirModalAuth() {
    const modal = document.getElementById("modal-auth-login");
    const errorMsg = document.getElementById("auth-error-message");
    const inputUser = document.getElementById("auth-input-user");
    const inputPass = document.getElementById("auth-input-pass");
    const modalTitle = document.getElementById("auth-modal-title");
    const modalSubtitle = document.getElementById("auth-modal-subtitle");

    if (errorMsg) errorMsg.classList.add("hidden");
    if (inputUser) inputUser.value = "";
    if (inputPass) inputPass.value = "";

    if (modalTitle && modalSubtitle) {
      if (this.pestanaPendienteAuth === "boleto") {
        modalTitle.innerText = "Acceso a Mi Boleto";
        modalSubtitle.innerText = "Ingrese con su usuario y contraseña autorizados";
      } else {
        modalTitle.innerText = "Panel Administrativo";
        modalSubtitle.innerText = "Ingrese sus credenciales de directivo / staff";
      }
    }

    if (modal) {
      modal.classList.remove("hidden");
      setTimeout(() => {
        if (inputUser) inputUser.focus();
      }, 100);
    }
  },

  cerrarModalAuth() {
    const modal = document.getElementById("modal-auth-login");
    if (modal) modal.classList.add("hidden");
    this.pestanaPendienteAuth = null;
  },

  /**
   * Conectar Formulario de Login
   */
  bindAuthForm() {
    const form = document.getElementById("form-auth-login");
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const user = document.getElementById("auth-input-user")?.value;
      const pass = document.getElementById("auth-input-pass")?.value;
      const errorMsg = document.getElementById("auth-error-message");

      const res = AuthService.login(user, pass);
      if (res.success) {
        this.cerrarModalAuth();
        this.actualizarEstadoAuthEnUI();
        this.showToast(`¡Bienvenido al sistema, ${res.user}!`, "success");
        const destino = this.pestanaPendienteAuth || (res.role === "colegiado" ? "boleto" : "admin");
        this.pestanaPendienteAuth = null;
        this.cambiarPestana(destino);
      } else {
        if (errorMsg) {
          errorMsg.innerText = res.error || "Credenciales inválidas.";
          errorMsg.classList.remove("hidden");
        }
        if (typeof QRManager !== "undefined") {
          QRManager.reproducirSonido("error");
        }
      }
    });
  },

  /**
   * Cerrar Sesión Administrativa
   */
  cerrarSesion() {
    if (typeof AuthService !== "undefined") {
      AuthService.logout();
    }
    this.actualizarEstadoAuthEnUI();
    this.showToast("Sesión cerrada correctamente.", "info");
    this.cambiarPestana("inscripcion");
  },

  /**
   * Actualizar visibilidad del botón Salir en UI
   */
  actualizarEstadoAuthEnUI() {
    const btnLogout = document.getElementById("btn-header-logout");
    const btnMobileLogout = document.getElementById("btn-mobile-logout");
    const isAuth = typeof AuthService !== "undefined" && AuthService.isAuthenticated();
    if (btnLogout) {
      if (isAuth) {
        btnLogout.classList.remove("hidden");
      } else {
        btnLogout.classList.add("hidden");
      }
    }
    if (btnMobileLogout) {
      if (isAuth) {
        btnMobileLogout.classList.remove("hidden");
      } else {
        btnMobileLogout.classList.add("hidden");
      }
    }
  },

  /**
   * Cargar lista de asistentes en el selector de "Mi Boleto"
   */
  cargarListaAsistentesEnTicket() {
    const select = document.getElementById("select-attendee-ticket");
    const inputSearchCmp = document.getElementById("input-search-ticket-cmp");

    const asistentes = StorageService.getAsistentes();
    const ultimaReserva = StorageService.getUltimaReserva() || asistentes[0];

    if (select) {
      if (asistentes.length === 0) {
        select.innerHTML = `<option value="">No hay asistentes registrados aún</option>`;
      } else {
        select.innerHTML = asistentes.map(a => {
          const isSelected = ultimaReserva && (a.idReserva === ultimaReserva.idReserva || a.cmp === ultimaReserva.cmp);
          return `<option value="${a.idReserva}" ${isSelected ? 'selected' : ''}>
            ${a.nombres} (CMP: ${a.cmp}) - ${a.idReserva}
          </option>`;
        }).join("");
      }
    }

    // Renderizar boleto activo y llenar campo de búsqueda si existe reserva
    if (ultimaReserva) {
      if (inputSearchCmp && !inputSearchCmp.value) {
        inputSearchCmp.value = ultimaReserva.cmp || "";
      }
      QRManager.renderizarTicket(ultimaReserva, "ticket-container");
    }
  },

  /**
   * Conectar acciones del Boleto (Descarga PNG, PDF, WhatsApp, Impresión, Selector)
   */
  bindBoletoActions() {
    const btnPng = document.getElementById("btn-download-png");
    const btnPdf = document.getElementById("btn-download-pdf");
    const btnWa = document.getElementById("btn-share-whatsapp");
    const btnPrint = document.getElementById("btn-print-ticket");
    const selectAttendee = document.getElementById("select-attendee-ticket");
    const inputSearchCmp = document.getElementById("input-search-ticket-cmp");
    const btnSearchCmp = document.getElementById("btn-search-ticket-cmp");

    // Buscador por CMP en Mi Boleto
    const buscarBoletoPorCMP = () => {
      const cmpVal = inputSearchCmp?.value?.trim();
      if (!cmpVal) {
        App.showToast("Ingrese su N° de CMP para buscar su boleto.", "warning");
        return;
      }

      const asistentes = StorageService.getAsistentes();
      const asistente = asistentes.find(a => 
        String(a.cmp || "").trim() === cmpVal || 
        String(a.idReserva || "").toLowerCase() === cmpVal.toLowerCase()
      );

      if (asistente) {
        StorageService.guardarUltimaReserva(asistente);
        QRManager.renderizarTicket(asistente, "ticket-container");
        if (selectAttendee) selectAttendee.value = asistente.idReserva;
        App.showToast(`¡Boleto del Dr(a). ${asistente.nombres} cargado!`, "success");
      } else {
        App.showToast(`No se encontró reserva registrada con el CMP N° ${cmpVal}.`, "warning");
      }
    };

    if (btnSearchCmp) {
      btnSearchCmp.addEventListener("click", buscarBoletoPorCMP);
    }
    if (inputSearchCmp) {
      inputSearchCmp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          buscarBoletoPorCMP();
        }
      });
    }

    // Selector de asistente en vivo
    if (selectAttendee) {
      selectAttendee.addEventListener("change", (e) => {
        const idReserva = e.target.value;
        const asistente = StorageService.buscarAsistente(idReserva);
        if (asistente) {
          StorageService.guardarUltimaReserva(asistente);
          QRManager.renderizarTicket(asistente, "ticket-container");
          if (inputSearchCmp) inputSearchCmp.value = asistente.cmp || "";
          App.showToast(`Visualizando pase de: ${asistente.nombres}`, "info");
        }
      });
    }

    // Botón descargar imagen PNG Ultra HD
    if (btnPng) {
      btnPng.addEventListener("click", () => {
        const a = StorageService.getUltimaReserva() || StorageService.getAsistentes()[0];
        const filename = a ? `Pase_Oficial_CMP_${a.cmp || a.idReserva}.png` : "Pase_Oficial_CMP_Pasco.png";
        QRManager.descargarTicketPNG("digital-ticket-card", filename);
      });
    }

    // Botón descargar PDF Oficial Vectorial A4 / A5
    if (btnPdf) {
      btnPdf.addEventListener("click", () => {
        QRManager.descargarTicketPDF();
      });
    }

    // Botón compartir en WhatsApp
    if (btnWa) {
      btnWa.addEventListener("click", () => {
        QRManager.compartirWhatsApp();
      });
    }

    // Botón Imprimir
    if (btnPrint) {
      btnPrint.addEventListener("click", () => {
        window.print();
      });
    }
  },

  /**
   * Conectar búsqueda manual en portería
   */
  bindManualSearch() {
    const btnBuscar = document.getElementById("btn-manual-search");
    const inputBuscar = document.getElementById("manual-search-input");

    const ejecutarBusqueda = () => {
      const val = inputBuscar?.value?.trim();
      if (!val) {
        App.showToast("Ingrese un número de CMP, DNI o Código de Boleto.", "warning");
        return;
      }
      ScannerService.procesarCodigoEscaneado(val);
      if (inputBuscar) inputBuscar.value = "";
    };

    if (btnBuscar) {
      btnBuscar.addEventListener("click", ejecutarBusqueda);
    }

    if (inputBuscar) {
      inputBuscar.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          ejecutarBusqueda();
        }
      });
    }
  },

  /**
   * Cargar y guardar configuración
   */
  cargarConfiguracionEnUI() {
    let url = APP_CONFIG.getAppsScriptUrl();
    const config = APP_CONFIG.getEventoConfig();
    const logoUrl = APP_CONFIG.getLogoUrl();
    const creds = typeof AuthService !== "undefined" ? AuthService.getCredentials() : { user: "admin" };

    const inputUrl = document.getElementById("config-sheets-url");
    const inputLogoUrl = document.getElementById("config-logo-url");
    const inputEventoNombre = document.getElementById("config-evento-nombre");
    const inputEventoFecha = document.getElementById("config-evento-fecha");
    const inputEventoLugar = document.getElementById("config-evento-lugar");
    const inputEventoAforo = document.getElementById("config-evento-aforo");
    const inputAuthUser = document.getElementById("config-auth-user");
    const badgeStatus = document.getElementById("sheets-status-badge");

    // Actualizar imágenes del logo en toda la app
    this.actualizarLogosEnUI(logoUrl);

    if (inputUrl) inputUrl.value = url;
    if (inputLogoUrl) inputLogoUrl.value = logoUrl;
    if (inputEventoNombre) inputEventoNombre.value = config.nombre;
    if (inputEventoFecha) inputEventoFecha.value = config.fecha;
    if (inputEventoLugar) inputEventoLugar.value = config.lugar;
    if (inputEventoAforo) inputEventoAforo.value = config.limiteAforo;
    if (inputAuthUser) inputAuthUser.value = creds.user;

    if (badgeStatus) {
      if (url) {
        badgeStatus.innerHTML = `
          <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-full text-xs font-bold">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Conectado a Google Sheets
          </span>
        `;
      } else {
        badgeStatus.innerHTML = `
          <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-300 rounded-full text-xs font-bold">
            <span class="w-2 h-2 rounded-full bg-amber-500"></span> Modo Local / Sin Google Sheets
          </span>
        `;
      }
    }
  },

  /**
   * Actualizar todos los elementos de logo en pantalla
   */
  actualizarLogosEnUI(logoSrc) {
    const imgHeader = document.getElementById("header-logo-img");
    const imgHero = document.getElementById("hero-logo-img");
    const imgPreview = document.getElementById("preview-logo-img");
    const imgSplash = document.getElementById("splash-logo-img");

    if (imgHeader) imgHeader.src = logoSrc;
    if (imgHero) imgHero.src = logoSrc;
    if (imgPreview) imgPreview.src = logoSrc;
    if (imgSplash) imgSplash.src = logoSrc;

    // Refrescar ticket si existe
    const ultimaReserva = StorageService.getUltimaReserva() || StorageService.getAsistentes()[0];
    if (ultimaReserva) {
      QRManager.renderizarTicket(ultimaReserva, "ticket-container");
    }
  },

  /**
   * Conectar formulario de configuración
   */
  bindConfigForm() {
    const form = document.getElementById("form-configuracion");
    const btnTest = document.getElementById("btn-test-sheets");
    const btnSyncFromSheets = document.getElementById("btn-sync-from-sheets");
    const btnCopyScript = document.getElementById("btn-copy-apps-script");
    const inputLogoFile = document.getElementById("config-logo-file");
    const inputLogoUrl = document.getElementById("config-logo-url");
    const btnResetLogo = document.getElementById("btn-reset-logo");

    // Botón para copiar el código completo de Apps Script
    if (btnCopyScript) {
      btnCopyScript.addEventListener("click", async () => {
        try {
          const response = await fetch("google-sheets/CodigoAppsScript.gs");
          const codeText = await response.text();
          await navigator.clipboard.writeText(codeText);
          App.showToast("¡Código Apps Script completo (391 líneas) copiado al portapapeles!", "success");
        } catch (e) {
          console.warn("Fallo al leer archivo local vía fetch, usando fallback:", e);
          App.showToast("Abriendo archivo CodigoAppsScript.gs...", "info");
          window.open("google-sheets/CodigoAppsScript.gs", "_blank");
        }
      });
    }

    // Subir imagen local o de Facebook
    if (inputLogoFile) {
      inputLogoFile.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target.result;
            if (inputLogoUrl) inputLogoUrl.value = base64;
            APP_CONFIG.setLogoUrl(base64);
            App.actualizarLogosEnUI(base64);
            App.showToast("Logotipo cargado con éxito.", "success");
          };
          reader.readAsDataURL(file);
        }
      });
    }

    if (inputLogoUrl) {
      inputLogoUrl.addEventListener("input", (e) => {
        const val = e.target.value.trim();
        if (val) {
          document.getElementById("preview-logo-img").src = val;
        }
      });
    }

    if (btnResetLogo) {
      btnResetLogo.addEventListener("click", () => {
        APP_CONFIG.setLogoUrl("assets/logo.png");
        App.cargarConfiguracionEnUI();
        App.showToast("Logotipo restablecido al oficial.", "info");
      });
    }

    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const url = document.getElementById("config-sheets-url")?.value.trim();
        const logoUrl = document.getElementById("config-logo-url")?.value.trim();
        const nombre = document.getElementById("config-evento-nombre")?.value.trim();
        const fecha = document.getElementById("config-evento-fecha")?.value.trim();
        const lugar = document.getElementById("config-evento-lugar")?.value.trim();
        const aforo = parseInt(document.getElementById("config-evento-aforo")?.value || 350);
        const authUser = document.getElementById("config-auth-user")?.value.trim();
        const authPass = document.getElementById("config-auth-pass")?.value.trim();

        APP_CONFIG.setAppsScriptUrl(url);
        if (logoUrl) {
          APP_CONFIG.setLogoUrl(logoUrl);
        }
        APP_CONFIG.setEventoConfig({
          nombre,
          fecha,
          lugar,
          limiteAforo: aforo
        });

        // Actualizar credenciales si se ingresaron
        if (authUser || authPass) {
          AuthService.setCredentials(authUser, authPass);
        }

        this.cargarConfiguracionEnUI();
        App.showToast("Configuración y credenciales guardadas correctamente.", "success");
      });
    }

    if (btnTest) {
      btnTest.addEventListener("click", async () => {
        const url = document.getElementById("config-sheets-url")?.value.trim();
        if (!url) {
          App.showToast("Por favor pegue primero la URL de Google Apps Script.", "warning");
          return;
        }

        btnTest.disabled = true;
        btnTest.innerHTML = `<span>Comprobando...</span>`;

        const res = await SheetsService.testConnection(url);
        btnTest.disabled = false;
        btnTest.innerHTML = `<span>Probar Conexión</span>`;

        if (res.success) {
          App.showToast("¡Conexión Exitosa con Google Sheets en Google Drive!", "success");
          APP_CONFIG.setAppsScriptUrl(url);
          App.cargarConfiguracionEnUI();
        } else {
          App.showToast(res.error || "No se pudo conectar.", "error");
        }
      });
    }

    if (btnSyncFromSheets) {
      btnSyncFromSheets.addEventListener("click", async () => {
        if (!SheetsService.isConfigured()) {
          App.showToast("Primero configure la URL de Google Apps Script en Ajustes.", "warning");
          return;
        }

        btnSyncFromSheets.disabled = true;
        btnSyncFromSheets.innerHTML = `
          <div class="w-4 h-4 border-2 border-[#4a154b] border-t-transparent rounded-full animate-spin"></div>
          <span>Sincronizando...</span>
        `;

        try {
          const res = await SheetsService.sincronizarDesdeGoogleSheets();
          if (res.success) {
            App.showToast(`¡Sincronización completa! (${res.nuevos} registros actualizados)`, "success");
            AdminService.actualizarEstadisticas();
            AdminService.renderizarTabla();
            App.cargarListaAsistentesEnTicket();
          } else {
            App.showToast(res.error || "Error al sincronizar con Google Sheets.", "error");
          }
        } catch (err) {
          console.error("Error en sincronización:", err);
          App.showToast(`Error al sincronizar: ${err.message || err}`, "error");
        } finally {
          btnSyncFromSheets.disabled = false;
          btnSyncFromSheets.innerHTML = `
            <svg class="w-4 h-4 text-[#4a154b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            <span>Sincronizar Sheets</span>
          `;
        }
      });
    }

    // Subir archivo Excel del Padrón de Agremiados
    const inputPadronExcel = document.getElementById("config-padron-excel-file");
    if (inputPadronExcel) {
      inputPadronExcel.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (file) {
          try {
            App.showToast("Procesando archivo Excel de agremiados...", "info");
            const res = await PadronService.importarDesdeExcel(file);
            App.showToast(`¡Padrón actualizado exitosamente con ${res.total} colegiados!`, "success");
            App.cargarConfiguracionEnUI();
          } catch (err) {
            console.error("Error al importar Excel de padrón:", err);
            App.showToast(err.message || "Error al procesar el archivo Excel.", "error");
          }
        }
      });
    }

    // Buscador en modal de padrón
    const inputSearchPadron = document.getElementById("modal-padron-search");
    if (inputSearchPadron) {
      inputSearchPadron.addEventListener("input", (e) => {
        this.renderizarListaPadron(e.target.value.trim());
      });
    }
  },

  /**
   * Modal de Exploración del Padrón
   */
  abrirModalPadron() {
    const modal = document.getElementById("modal-ver-padron");
    const inputSearch = document.getElementById("modal-padron-search");
    if (inputSearch) inputSearch.value = "";
    this.renderizarListaPadron();
    if (modal) modal.classList.remove("hidden");
  },

  cerrarModalPadron() {
    const modal = document.getElementById("modal-ver-padron");
    if (modal) modal.classList.add("hidden");
  },

  renderizarListaPadron(query = "") {
    const listContainer = document.getElementById("modal-padron-list");
    const countBadge = document.getElementById("modal-padron-count-badge");
    const subtitle = document.getElementById("modal-padron-subtitle");
    if (!listContainer || typeof PadronService === "undefined") return;

    const padron = PadronService.getAgremiados();
    const cleanQ = query.toLowerCase();

    const filtrados = padron.filter(c => {
      if (!cleanQ) return true;
      return (
        (c.cmp && String(c.cmp).toLowerCase().includes(cleanQ)) ||
        (c.nombres && c.nombres.toLowerCase().includes(cleanQ))
      );
    });

    if (countBadge) countBadge.innerText = `Mostrando ${filtrados.length} de ${padron.length} médicos`;
    if (subtitle) subtitle.innerText = `${padron.length} médicos habilitados para reserva`;

    if (filtrados.length === 0) {
      listContainer.innerHTML = `
        <div class="py-8 text-center text-slate-400 font-medium">
          No se encontraron colegiados que coincidan con "${query}".
        </div>
      `;
      return;
    }

    listContainer.innerHTML = filtrados.map(c => `
      <div class="py-2.5 px-3 flex items-center justify-between hover:bg-purple-50/50 rounded-xl transition-colors">
        <div>
          <h5 class="text-xs font-bold text-slate-900 leading-snug">${c.nombres}</h5>
          <span class="text-[11px] text-purple-900/70 font-semibold">CMP: ${c.cmp}</span>
        </div>
        <span class="px-2.5 py-1 text-[10px] font-black uppercase rounded-lg ${
          c.habilidad === 'HABIL' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
        }">
          ${c.habilidad || 'HABIL'}
        </span>
      </div>
    `).join("");
  },

  restablecerPadronOriginal() {
    if (typeof PadronService !== "undefined") {
      PadronService.restablecerPadronOficial();
      this.cargarConfiguracionEnUI();
      this.showToast("Padrón restablecido a los 380 colegiados oficiales.", "success");
    }
  },

  /**
   * Abrir imagen o código QR en tamaño completo
   */
  verQRExpandido(imgUrl, titulo = "Imagen") {
    const modal = document.getElementById("modal-qr-expandido");
    const modalImg = document.getElementById("modal-qr-img");
    if (modal && modalImg) {
      modalImg.src = imgUrl || "assets/yape_qr.png";
      modal.classList.remove("hidden");
    }
  },

  /**
   * Mostrar Notificaciones Toast
   */
  showToast(mensaje, tipo = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast p-4 rounded-xl shadow-xl flex items-center justify-between gap-3 text-xs font-bold text-white ${
      tipo === "success" ? "bg-[#065f46] border border-emerald-400" :
      tipo === "error" ? "bg-[#881337] border border-rose-400" :
      tipo === "warning" ? "bg-[#78350f] border border-amber-400" :
      "bg-[#200530] border border-[#dfb76c]"
    }`;

    const icon = 
      tipo === "success" ? "✅" :
      tipo === "error" ? "❌" :
      tipo === "warning" ? "⚠️" : "ℹ️";

    toast.innerHTML = `
      <div class="flex items-center gap-2.5">
        <span class="text-base">${icon}</span>
        <span>${mensaje}</span>
      </div>
      <button onclick="this.parentElement.remove()" class="opacity-70 hover:opacity-100 text-white font-bold ml-2">✕</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(100%)";
        setTimeout(() => toast.remove(), 300);
      }
    }, 3800);
  }
};

// Inicializar cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
