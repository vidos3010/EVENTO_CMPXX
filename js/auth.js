/**
 * =========================================================================================
 * SERVICIO DE AUTENTICACIÓN Y CONTROL DE ACCESO - CMP XX PASCO
 * Protege las pestañas de Validación QR, Asistencia & Excel y Configuración
 * =========================================================================================
 */

const AuthService = {
  // Claves de Almacenamiento
  STORAGE_KEYS: {
    AUTH_SESSION: "cmp_pasco_auth_session",
    AUTH_ROLE: "cmp_pasco_auth_role",
    ADMIN_USER: "cmp_pasco_admin_user",
    ADMIN_PASS: "cmp_pasco_admin_pass"
  },

  // Credenciales por Defecto
  DEFAULT_CREDENTIALS: {
    user: "admin",
    pass: "cmp2026",
    staffUser: "staff",
    staffPass: "staff2026"
  },

  /**
   * Obtener las credenciales configuradas
   */
  getCredentials() {
    const user = localStorage.getItem(this.STORAGE_KEYS.ADMIN_USER) || this.DEFAULT_CREDENTIALS.user;
    const pass = localStorage.getItem(this.STORAGE_KEYS.ADMIN_PASS) || this.DEFAULT_CREDENTIALS.pass;
    return { user, pass };
  },

  /**
   * Cambiar credenciales de Administrador
   */
  setCredentials(newUser, newPass) {
    if (newUser && newUser.trim()) {
      localStorage.setItem(this.STORAGE_KEYS.ADMIN_USER, newUser.trim());
    }
    if (newPass && newPass.trim()) {
      localStorage.setItem(this.STORAGE_KEYS.ADMIN_PASS, newPass.trim());
    }
  },

  /**
   * Verificar si la sesión actual está autenticada
   */
  isAuthenticated() {
    const session = sessionStorage.getItem(this.STORAGE_KEYS.AUTH_SESSION);
    return session !== null && session.length > 0;
  },

  /**
   * Obtener usuario actual en sesión
   */
  getCurrentUser() {
    return sessionStorage.getItem(this.STORAGE_KEYS.AUTH_SESSION) || null;
  },

  /**
   * Obtener el rol actual ('admin', 'staff', 'colegiado')
   */
  getCurrentRole() {
    return sessionStorage.getItem(this.STORAGE_KEYS.AUTH_ROLE) || (this.isAuthenticated() ? "admin" : null);
  },

  /**
   * Establecer sesión y rol
   */
  setSession(user, role = "admin") {
    if (user) {
      sessionStorage.setItem(this.STORAGE_KEYS.AUTH_SESSION, String(user).trim());
      sessionStorage.setItem(this.STORAGE_KEYS.AUTH_ROLE, role);
    }
  },

  /**
   * Validar credenciales e iniciar sesión
   * Soporta Administrador, Staff y Colegiados registrados
   */
  login(user, pass) {
    const creds = this.getCredentials();
    const cleanUser = String(user || "").trim();
    const cleanUserLower = cleanUser.toLowerCase();
    const cleanPass = String(pass || "").trim();

    // 1. Validar administrador
    if (cleanUserLower === creds.user.toLowerCase() && cleanPass === creds.pass) {
      this.setSession(creds.user, "admin");
      return { success: true, user: creds.user, role: "admin" };
    }

    // 2. Validar usuario staff / portería
    if (cleanUserLower === this.DEFAULT_CREDENTIALS.staffUser.toLowerCase() && cleanPass === this.DEFAULT_CREDENTIALS.staffPass) {
      this.setSession(this.DEFAULT_CREDENTIALS.staffUser, "staff");
      return { success: true, user: this.DEFAULT_CREDENTIALS.staffUser, role: "staff" };
    }

    // 3. Validar colegiado registrado (Usuario: CMP / Contraseña: CMP, celular o código)
    if (typeof StorageService !== "undefined") {
      const asistente = StorageService.buscarAsistente(cleanUser);
      if (asistente) {
        const cmpStr = String(asistente.cmp || "").trim();
        const celStr = String(asistente.celular || "").trim();
        const idStr = String(asistente.idReserva || "").trim().toLowerCase();

        if (cleanPass === cmpStr || cleanPass === celStr || cleanPass.toLowerCase() === idStr || cleanPass === creds.pass) {
          this.setSession(asistente.nombres || cmpStr, "colegiado");
          StorageService.guardarUltimaReserva(asistente);
          if (typeof QRManager !== "undefined") {
            QRManager.renderizarTicket(asistente, "ticket-container");
          }
          return { success: true, user: asistente.nombres || cmpStr, role: "colegiado", asistente };
        }
      }
    }

    return { success: false, error: "Usuario o contraseña incorrectos." };
  },

  /**
   * Cerrar sesión
   */
  logout() {
    sessionStorage.removeItem(this.STORAGE_KEYS.AUTH_SESSION);
    sessionStorage.removeItem(this.STORAGE_KEYS.AUTH_ROLE);
  }
};
