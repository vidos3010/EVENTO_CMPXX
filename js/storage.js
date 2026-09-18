/**
 * =========================================================================================
 * GESTOR DE ALMACENAMIENTO LOCAL Y SINCRONIZACIÓN (STORAGE SERVICE)
 * COLEGIO MÉDICO DEL PERÚ - CONSEJO REGIONAL XX PASCO
 * =========================================================================================
 */

const StorageService = {
  /**
   * Obtener todos los asistentes guardados localmente (filtrando cabeceras accidentales)
   */
  getAsistentes() {
    const data = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.ASISTENTES);
    if (!data) {
      // Si está vacío, inicializar con datos iniciales
      const initialData = this.getDatosIniciales();
      this.guardarTodos(initialData);
      return initialData;
    }
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        // Filtrar y limpiar cualquier fila de encabezado
        return parsed
          .filter(a => 
            a && 
            a.idReserva && 
            String(a.idReserva).trim() !== "ID Reserva" && 
            String(a.nombres || "").trim() !== "Nombres y Apellidos" &&
            String(a.cmp || "").trim() !== "N° CMP"
          )
          .map(a => this.normalizarAsistente(a));
      }
      return [];
    } catch (e) {
      console.error("Error al parsear asistentes de LocalStorage:", e);
      return [];
    }
  },

  // =========================================================================
  // PERSISTENCIA AVANZADA DE VOUCHERS CON INDEXEDDB Y CACHÉ EN MEMORIA
  // =========================================================================
  _dbPromise: null,
  _voucherMemoryCache: new Map(),

  getDB() {
    if (!this._dbPromise) {
      this._dbPromise = new Promise((resolve) => {
        try {
          if (!window.indexedDB) return resolve(null);
          const req = indexedDB.open("cmp_pasco_vouchers_db", 1);
          req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains("vouchers")) {
              db.createObjectStore("vouchers", { keyPath: "id" });
            }
          };
          req.onsuccess = (e) => resolve(e.target.result);
          req.onerror = () => resolve(null);
        } catch (err) {
          resolve(null);
        }
      });
    }
    return this._dbPromise;
  },

  async guardarVoucherIndexedDB(id, base64) {
    if (!id || !base64) return;
    const cleanId = String(id).trim().toLowerCase();
    const cleanNum = cleanId.replace(/^0+/, "") || cleanId;
    
    // Guardar en caché de memoria ultra-rápido
    this._voucherMemoryCache.set(cleanId, base64);
    this._voucherMemoryCache.set(cleanNum, base64);

    try {
      const db = await this.getDB();
      if (!db) return;
      const tx = db.transaction("vouchers", "readwrite");
      const store = tx.objectStore("vouchers");
      store.put({ id: cleanId, data: base64, updated: Date.now() });
      if (cleanNum !== cleanId) {
        store.put({ id: cleanNum, data: base64, updated: Date.now() });
      }
    } catch (e) {
      console.warn("IndexedDB voucher write fallback:", e);
    }
  },

  async obtenerVoucherIndexedDB(id) {
    if (!id) return null;
    const cleanId = String(id).trim().toLowerCase();
    const cleanNum = cleanId.replace(/^0+/, "") || cleanId;

    // 1. Revisar caché en memoria primero
    if (this._voucherMemoryCache.has(cleanId)) {
      return this._voucherMemoryCache.get(cleanId);
    }
    if (this._voucherMemoryCache.has(cleanNum)) {
      return this._voucherMemoryCache.get(cleanNum);
    }

    try {
      const db = await this.getDB();
      if (!db) return null;
      return new Promise((resolve) => {
        const tx = db.transaction("vouchers", "readonly");
        const store = tx.objectStore("vouchers");
        const req = store.get(cleanId);
        req.onsuccess = () => {
          if (req.result && req.result.data) {
            StorageService._voucherMemoryCache.set(cleanId, req.result.data);
            resolve(req.result.data);
          } else if (cleanNum !== cleanId) {
            const req2 = store.get(cleanNum);
            req2.onsuccess = () => {
              if (req2.result && req2.result.data) {
                StorageService._voucherMemoryCache.set(cleanNum, req2.result.data);
                resolve(req2.result.data);
              } else {
                resolve(null);
              }
            };
            req2.onerror = () => resolve(null);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  },

  /**
   * Precargar todos los comprobantes guardados en IndexedDB a la memoria al iniciar
   */
  async precargarVouchersDesdeIndexedDB() {
    try {
      const db = await this.getDB();
      if (!db) return;
      const tx = db.transaction("vouchers", "readonly");
      const store = tx.objectStore("vouchers");
      const req = store.getAll();
      req.onsuccess = () => {
        if (Array.isArray(req.result)) {
          req.result.forEach(item => {
            if (item && item.id && item.data) {
              StorageService._voucherMemoryCache.set(String(item.id).trim().toLowerCase(), item.data);
            }
          });
          // Refrescar tabla en administración para sincronizar botones a "Ver Voucher"
          if (typeof AdminService !== "undefined" && typeof AdminService.renderizarTabla === "function") {
            AdminService.actualizarEstadisticas();
            AdminService.renderizarTabla();
          }
        }
      };
    } catch (e) {
      console.warn("IndexedDB preload:", e);
    }
  },

  /**
   * Extraer ID de archivo de Google Drive desde cualquier formato de enlace
   */
  extraerIdGoogleDrive(url) {
    if (!url || typeof url !== "string") return null;
    const str = url.trim();
    if (!str.includes("drive.google.com") && !str.includes("docs.google.com") && !str.includes("googleusercontent.com")) {
      return null;
    }
    const match = str.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                  str.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
                  str.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
                  str.match(/id=([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  },

  /**
   * Obtener el voucher completo garantizado (revisando en memoria, LocalStorage, Drive e IndexedDB)
   */
  async obtenerVoucherCompleto(asistenteOId) {
    if (!asistenteOId) return "";
    let asistente = typeof asistenteOId === "object" ? asistenteOId : this.buscarAsistente(asistenteOId);

    if (asistente) {
      // 1. Revisar si ya tiene data base64 directa o URL válida en memoria
      if (asistente.voucherImg && asistente.voucherImg.trim() !== "") {
        const v = asistente.voucherImg.trim();
        if (v.startsWith("data:image/") || v.startsWith("http")) {
          return v;
        }
      }

      // 2. Revisar si tiene enlace de Google Drive
      if (asistente.enlaceVoucherDrive && asistente.enlaceVoucherDrive.trim() !== "") {
        const driveUrl = asistente.enlaceVoucherDrive.trim();
        if (driveUrl.startsWith("http")) {
          return driveUrl;
        }
      }

      // 3. Revisar en caché de memoria e IndexedDB por idReserva
      if (asistente.idReserva) {
        const vId = await this.obtenerVoucherIndexedDB(asistente.idReserva);
        if (vId) {
          asistente.voucherImg = vId;
          return vId;
        }
      }

      // 4. Revisar por CMP
      if (asistente.cmp) {
        const vCmp = await this.obtenerVoucherIndexedDB(asistente.cmp);
        if (vCmp) {
          asistente.voucherImg = vCmp;
          return vCmp;
        }
      }

      // 5. Revisar por QR Titular
      if (asistente.qrTitular) {
        const vQr = await this.obtenerVoucherIndexedDB(asistente.qrTitular);
        if (vQr) {
          asistente.voucherImg = vQr;
          return vQr;
        }
      }
    } else if (typeof asistenteOId === "string") {
      const v = await this.obtenerVoucherIndexedDB(asistenteOId);
      if (v) return v;
    }

    return "";
  },

  /**
   * Comprimir y optimizar imágenes en el navegador vía HTML5 Canvas para almacenamiento ultraligero
   */
  comprimirImagen(fileOrDataUrl, maxDim = 800, quality = 0.75) {
    return new Promise((resolve) => {
      if (!fileOrDataUrl) return resolve("");

      // Si es un File / Blob
      if (fileOrDataUrl instanceof Blob || fileOrDataUrl instanceof File) {
        const reader = new FileReader();
        reader.onerror = () => resolve("");
        reader.onload = (e) => {
          this.comprimirImagen(e.target.result, maxDim, quality).then(resolve).catch(() => resolve(e.target.result));
        };
        reader.readAsDataURL(fileOrDataUrl);
        return;
      }

      // Si ya es un string
      const src = String(fileOrDataUrl).trim();
      if (!src.startsWith("data:image/")) {
        return resolve(src);
      }

      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Convertir a JPEG optimizado (800px a 75% genera ~25-35KB ultranítido)
        try {
          const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
          resolve(compressedBase64 || src);
        } catch (errCanvas) {
          resolve(src);
        }
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
  },

  /**
   * Formatear URLs de imágenes (soporta Google Drive, URLs web y Base64)
   */
  formatearUrlImagen(urlOrBase64) {
    if (!urlOrBase64 || typeof urlOrBase64 !== "string") return "";
    const str = urlOrBase64.trim();
    if (str.startsWith("data:image/")) return str;

    // Convertir enlaces de Google Drive a URLs de renderizado directo
    const driveId = this.extraerIdGoogleDrive(str);
    if (driveId) {
      // Usar Google Thumbnail API de alta resolución con referrerpolicy no-referrer
      return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1200`;
    }
    return str;
  },

  /**
   * Obtener URL alternativa de vista previa para Google Drive en caso de bloqueo
   */
  obtenerUrlAlternativaDrive(urlOrBase64) {
    const driveId = this.extraerIdGoogleDrive(urlOrBase64);
    if (driveId) {
      return `https://lh3.googleusercontent.com/d/${driveId}`;
    }
    return "";
  },

  /**
   * Determinar con máxima resiliencia si un asistente (titular o acompañante) ya ingresó
   * Soporta "Ingresó", "Ingreso", "Asistió", "Asistio", "Presente", "SI", mayúsculas/minúsculas y fecha registrada
   */
  esIngresado(asistente, tipo = "titular") {
    if (!asistente) return false;
    if (tipo === "titular") {
      const estado = String(asistente.estado || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const fecha = String(asistente.fechaIngreso || "").trim();
      return estado === "ingreso" || estado === "asistio" || estado === "presente" || estado === "si" || estado === "validado" || fecha.length > 3;
    } else {
      const estado = String(asistente.estadoAcompanante || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const fecha = String(asistente.fechaIngresoAcompanante || "").trim();
      return estado === "ingreso" || estado === "asistio" || estado === "presente" || estado === "si" || estado === "validado" || fecha.length > 3;
    }
  },

  /**
   * Normalizar estructura de datos del asistente para soportar QR dual y persistencia total de acompañantes
   */
  normalizarAsistente(a) {
    if (!a) return null;

    const rawCmp = String(a.cmp || "").trim();
    const cleanCmp = rawCmp.replace(/^0+/, "") || rawCmp;

    // 1. Auto-corrección inteligente usando el Padrón Oficial de Agremiados
    let nombresOficiales = a.nombres || "";
    let dniOficial = String(a.dni || "").trim();
    let celularOficial = String(a.celular || "").trim();

    if (cleanCmp && typeof PadronService !== "undefined") {
      const colegiado = PadronService.buscarPorCMP(cleanCmp);
      if (colegiado && colegiado.nombres) {
        // Si nombres guardados son un número (ej. celular desplazado)
        if (!nombresOficiales || /^\d{6,15}$/.test(nombresOficiales.trim()) || nombresOficiales.trim().toLowerCase() === "médico colegiado") {
          if (/^\d{6,15}$/.test(nombresOficiales.trim()) && (!celularOficial || !/^\d{6,15}$/.test(celularOficial))) {
            celularOficial = nombresOficiales.trim();
          }
          nombresOficiales = colegiado.nombres;
        }

        // Si el DNI guardado contenía el nombre del médico (desfase de columnas)
        if (dniOficial && /[a-zA-Z]{3,}/.test(dniOficial)) {
          if (!nombresOficiales || nombresOficiales === cleanCmp) {
            nombresOficiales = colegiado.nombres;
          }
          dniOficial = ""; // Limpiar campo DNI desfasado
        }

        // Si celular contenía texto como "1 Acompañante"
        if (celularOficial && /[a-zA-Z]{3,}/.test(celularOficial)) {
          celularOficial = "";
        }

        // Asegurar nombre oficial del padrón siempre
        nombresOficiales = colegiado.nombres;
      }
    }

    // Detectar número de acompañantes con resiliencia extrema
    let rawAcomp = (
      a.acompanantes !== undefined ? a.acompanantes :
      (a["N° Acompañantes"] !== undefined ? a["N° Acompañantes"] :
      (a["Nº Acompañantes"] !== undefined ? a["Nº Acompañantes"] :
      (a["N° Acompañante"] !== undefined ? a["N° Acompañante"] :
      (a["Nº Acompañante"] !== undefined ? a["Nº Acompañante"] :
      (a["Acompañantes"] !== undefined ? a["Acompañantes"] :
      (a["Acompañante"] !== undefined ? a["Acompañante"] :
      (a.numAcomp !== undefined ? a.numAcomp :
      (a.nroAcompanantes !== undefined ? a.nroAcompanantes : 0))))))))
    );

    let numAcomp = parseInt(rawAcomp);
    if (isNaN(numAcomp) || numAcomp < 0) numAcomp = 0;

    // Indicadores secundarios irrefutables de acompañante
    const hasAcompNombre = Boolean(a.nombresAcompanantes && String(a.nombresAcompanantes).trim() !== "" && String(a.nombresAcompanantes).trim() !== "Ninguno");
    const hasAcompQr = Boolean(a.qrAcompanante && String(a.qrAcompanante).trim() !== "");
    const hasAcompPago = (parseFloat(a.montoPago) > 0) || (a.estadoPago && a.estadoPago !== "Gratuito" && a.estadoPago !== "");
    const hasAcompEstado = Boolean(a.estadoAcompanante && String(a.estadoAcompanante).trim() !== "");

    if (numAcomp === 0 && (hasAcompNombre || hasAcompQr || hasAcompPago || hasAcompEstado)) {
      numAcomp = 1;
    }

    const idReserva = a.idReserva || `CMP-${cleanCmp || '0000'}`;
    const qrTitular = a.qrTitular || a.qrHash || `${idReserva}-${cleanCmp || 'TITULAR'}`;
    const qrAcompanante = a.qrAcompanante || (numAcomp > 0 ? `${idReserva}-ACOMP1` : "");
    const nombresAcompanantes = a.nombresAcompanantes || (numAcomp > 0 ? "Acompañante Registrado" : "Ninguno");
    const montoPago = a.montoPago !== undefined ? parseFloat(a.montoPago) : (numAcomp > 0 ? 20 : 0);

    let voucherImg = a.voucherImg || "";
    let enlaceVoucherDrive = a.enlaceVoucherDrive || "";

    // Auto-recuperación y limpieza si el enlace de Google Drive cayó en otra columna (como fechaIngreso)
    if (!enlaceVoucherDrive) {
      for (const [key, val] of Object.entries(a)) {
        if (typeof val === "string" && (val.includes("drive.google.com") || val.includes("docs.google.com") || val.includes("googleusercontent.com"))) {
          enlaceVoucherDrive = val.trim();
          break;
        }
      }
    }

    let fechaIngreso = a.fechaIngreso || "";
    if (fechaIngreso.includes("drive.google.com") || fechaIngreso.includes("googleusercontent.com")) {
      if (!enlaceVoucherDrive) enlaceVoucherDrive = fechaIngreso;
      fechaIngreso = "";
    }

    let validadoPor = a.validadoPor || "";
    if (validadoPor.includes("drive.google.com") || validadoPor.includes("googleusercontent.com")) {
      if (!enlaceVoucherDrive) enlaceVoucherDrive = validadoPor;
      validadoPor = "";
    }

    let nroOperacion = a.nroOperacion || "";
    if (nroOperacion.includes("drive.google.com") || nroOperacion.includes("googleusercontent.com")) {
      if (!enlaceVoucherDrive) enlaceVoucherDrive = nroOperacion;
      nroOperacion = "";
    }

    // Si voucherImg está vacío, recuperar desde la memoria caché global
    if (!voucherImg && StorageService._voucherMemoryCache) {
      const cleanId = String(idReserva || "").trim().toLowerCase();
      const cleanNum = String(cleanCmp || "").trim().toLowerCase();
      voucherImg = StorageService._voucherMemoryCache.get(cleanId) ||
                   StorageService._voucherMemoryCache.get(cleanNum) || "";
    }

    const tieneVoucher = Boolean(
      a.tieneVoucher ||
      (voucherImg && voucherImg.trim() !== "") ||
      (enlaceVoucherDrive && enlaceVoucherDrive.trim() !== "")
    );

    // Normalizar estados de ingreso con certeza
    const titularYaIngreso = this.esIngresado(a, "titular");
    const acompYaIngreso = this.esIngresado(a, "acompanante");

    return {
      ...a,
      idReserva,
      cmp: cleanCmp,
      nombres: nombresOficiales,
      dni: dniOficial,
      celular: celularOficial,
      voucherImg,
      enlaceVoucherDrive,
      tieneVoucher,
      acompanantes: numAcomp,
      nombresAcompanantes: nombresAcompanantes,
      montoPago: isNaN(montoPago) ? (numAcomp > 0 ? 20 : 0) : montoPago,
      nroOperacion: nroOperacion || (numAcomp > 0 ? "" : "N/A"),
      qrTitular,
      qrHash: qrTitular,
      qrAcompanante,
      estadoPago: a.estadoPago || (numAcomp > 0 ? "Pendiente de Validación" : "Gratuito"),
      estado: titularYaIngreso ? "Ingresó" : (a.estado || "Pendiente"),
      fechaIngreso: fechaIngreso,
      validadoPor: validadoPor,
      estadoAcompanante: numAcomp > 0 ? (acompYaIngreso ? "Ingresó" : (a.estadoAcompanante || "Pendiente")) : "",
      fechaIngresoAcompanante: a.fechaIngresoAcompanante || "",
      validadoPorAcompanante: a.validadoPorAcompanante || ""
    };
  },

  /**
   * Guardar la lista completa de asistentes con tolerancia a cuotas de almacenamiento e IndexedDB
   */
  guardarTodos(asistentes) {
    if (Array.isArray(asistentes)) {
      const limpios = asistentes
        .filter(a => 
          a && 
          a.idReserva && 
          String(a.idReserva).trim() !== "ID Reserva" && 
          String(a.nombres || "").trim() !== "Nombres y Apellidos" &&
          String(a.cmp || "").trim() !== "N° CMP"
        )
        .map(a => this.normalizarAsistente(a));

      // 1. Guardar siempre los vouchers en memoria y en IndexedDB
      limpios.forEach(a => {
        if (a.voucherImg) {
          if (a.idReserva) {
            this._voucherMemoryCache.set(String(a.idReserva).trim().toLowerCase(), a.voucherImg);
          }
          if (a.cmp) {
            const cleanC = String(a.cmp).trim().replace(/^0+/, "").toLowerCase();
            this._voucherMemoryCache.set(cleanC, a.voucherImg);
            this._voucherMemoryCache.set(String(a.cmp).trim().toLowerCase(), a.voucherImg);
          }
          if (a.voucherImg.startsWith("data:")) {
            this.guardarVoucherIndexedDB(a.idReserva, a.voucherImg);
            if (a.cmp) this.guardarVoucherIndexedDB(a.cmp, a.voucherImg);
          }
        }
      });

      // 2. Guardar en LocalStorage
      try {
        localStorage.setItem(APP_CONFIG.STORAGE_KEYS.ASISTENTES, JSON.stringify(limpios));
      } catch (err) {
        console.warn("[guardarTodos] LocalStorage lleno, optimizando vouchers...", err);
        
        // Optimizar lista para LocalStorage (las imágenes completas ya están en memoria e IndexedDB)
        const listaLigera = limpios.map(a => {
          if (a.voucherImg && a.voucherImg.length > 60000) {
            return { ...a, voucherImg: a.enlaceVoucherDrive || "" };
          }
          return a;
        });

        try {
          localStorage.setItem(APP_CONFIG.STORAGE_KEYS.ASISTENTES, JSON.stringify(listaLigera));
        } catch (e2) {
          console.warn("[guardarTodos] Guardando asistentes ligeros:", e2);
        }
      }
    }
  },

  /**
   * Guardar o actualizar comprobante/voucher de un asistente garantizando persistencia.
   */
  async guardarVoucher(idReserva, voucherBase64OUrl, nuevoEstado = "Pendiente de Validación") {
    if (!idReserva) return { success: false };

    // Validar que el dato no esté vacío antes de guardar
    const voucherOptimizado = (typeof voucherBase64OUrl === "string" && voucherBase64OUrl.trim() !== "")
      ? voucherBase64OUrl.trim()
      : "";

    if (!voucherOptimizado) {
      return { success: false, mensaje: "La imagen del voucher está vacía o no es válida." };
    }

    const lista = this.getAsistentes();
    const cleanQuery = String(idReserva).trim().toLowerCase();
    const cleanNum = cleanQuery.replace(/^0+/, "") || cleanQuery;

    const idx = lista.findIndex(a => {
      const idR = a.idReserva ? a.idReserva.toLowerCase() : "";
      const cmpA = a.cmp ? String(a.cmp).trim().toLowerCase() : "";
      const cleanCmpA = cmpA.replace(/^0+/, "") || cmpA;
      return idR === cleanQuery || cmpA === cleanQuery || cleanCmpA === cleanNum;
    });

    if (idx !== -1) {
      // 1. Guardar SIEMPRE en IndexedDB inmediatamente (sin límite de tamaño)
      await this.guardarVoucherIndexedDB(lista[idx].idReserva, voucherOptimizado);
      if (lista[idx].cmp) {
        await this.guardarVoucherIndexedDB(lista[idx].cmp, voucherOptimizado);
      }

      // 2. Guardar versión optimizada en memoria y LocalStorage
      lista[idx].voucherImg = voucherOptimizado;
      lista[idx].tieneVoucher = true;
      if (nuevoEstado) {
        lista[idx].estadoPago = nuevoEstado;
      }

      this.guardarTodos(lista);
      this.guardarUltimaReserva(lista[idx]);
      return { success: true, asistente: lista[idx] };
    }
    return { success: false, mensaje: "Asistente no encontrado" };
  },

  /**
   * Agregar un nuevo asistente localmente
   */
  agregarAsistente(asistente) {
    const lista = this.getAsistentes();
    const cleanCmp = String(asistente.cmp || "").trim().replace(/^0+/, "") || String(asistente.cmp || "").trim();
    
    // Verificar duplicado estricto por CMP o ID de Reserva
    const existe = lista.some(a => {
      const aCmp = String(a.cmp || "").trim().replace(/^0+/, "") || String(a.cmp || "").trim();
      const matchCmp = cleanCmp && aCmp === cleanCmp;
      const matchId = a.idReserva && a.idReserva === asistente.idReserva;
      return matchCmp || matchId;
    });
    
    if (existe) {
      return { 
        success: false, 
        mensaje: `El CMP "${asistente.cmp}" ya cuenta con una inscripción registrada en el sistema. Solo se permite una inscripción por colegiado.` 
      };
    }

    const normalizado = this.normalizarAsistente(asistente);

    // Guardar voucher en IndexedDB si existe
    if (normalizado.voucherImg && normalizado.voucherImg.startsWith("data:")) {
      this.guardarVoucherIndexedDB(normalizado.idReserva, normalizado.voucherImg);
      if (normalizado.cmp) this.guardarVoucherIndexedDB(normalizado.cmp, normalizado.voucherImg);
    }

    lista.unshift(normalizado);
    this.guardarTodos(lista);
    this.guardarUltimaReserva(normalizado);
    
    return { success: true, asistente: normalizado };
  },

  /**
   * Buscar asistente por CMP, DNI, ID de Reserva o Código QR Hash (Titular o Acompañante)
   */
  buscarAsistente(criterio) {
    if (!criterio) return null;
    const lista = this.getAsistentes();
    const query = String(criterio).trim().toLowerCase();
    const cleanNum = query.replace(/^0+/, "") || query;

    return lista.find(a => {
      const cmpA = a.cmp ? String(a.cmp).trim().toLowerCase() : "";
      const cleanCmpA = cmpA.replace(/^0+/, "") || cmpA;
      const dniA = a.dni ? String(a.dni).trim().toLowerCase() : "";
      const qrAcomp = a.qrAcompanante ? String(a.qrAcompanante).trim().toLowerCase() : "";
      const qrTit = a.qrTitular ? String(a.qrTitular).trim().toLowerCase() : "";
      const qrH = a.qrHash ? String(a.qrHash).trim().toLowerCase() : "";

      return (
        (a.idReserva && a.idReserva.toLowerCase() === query) ||
        qrTit === query ||
        qrH === query ||
        qrAcomp === query ||
        cmpA === query ||
        cleanCmpA === cleanNum ||
        dniA === query ||
        (a.nombres && a.nombres.toLowerCase().includes(query))
      );
    }) || null;
  },

  /**
   * Buscar índice de asistente por ID de Reserva, CMP o documento
   */
  buscarIndiceAsistente(criterio) {
    if (!criterio) return -1;
    const lista = this.getAsistentes();
    const query = String(criterio).trim().toLowerCase();
    const cleanNum = query.replace(/^0+/, "") || query;

    return lista.findIndex(a => {
      const idR = a.idReserva ? a.idReserva.toLowerCase() : "";
      const cmpA = a.cmp ? String(a.cmp).trim().toLowerCase() : "";
      const cleanCmpA = cmpA.replace(/^0+/, "") || cmpA;
      const dniA = a.dni ? String(a.dni).trim().toLowerCase() : "";
      const qrTit = a.qrTitular ? String(a.qrTitular).trim().toLowerCase() : "";
      const qrH = a.qrHash ? String(a.qrHash).trim().toLowerCase() : "";
      const qrAcomp = a.qrAcompanante ? String(a.qrAcompanante).trim().toLowerCase() : "";

      return (
        idR === query ||
        cmpA === query ||
        cleanCmpA === cleanNum ||
        dniA === query ||
        qrTit === query ||
        qrH === query ||
        qrAcomp === query ||
        (a.nombres && a.nombres.toLowerCase() === query)
      );
    });
  },

  /**
   * Marcar asistencia (Validar ingreso independiente para Titular o Acompañante)
   */
  marcarIngreso(codigo, validador = "Staff Puerta", tipo = null) {
    const lista = this.getAsistentes();
    let rawQuery = String(codigo || "").trim();

    // Si el código escaneado es una URL completa (ej. enlace web del boleto)
    if (rawQuery.includes("?") || rawQuery.includes("http")) {
      try {
        const urlObj = new URL(rawQuery);
        const pCmp = urlObj.searchParams.get("cmp");
        const pRes = urlObj.searchParams.get("reserva") || urlObj.searchParams.get("id");
        const pTipo = urlObj.searchParams.get("tipo");
        if (pTipo === "acompanante" || pTipo === "acomp") {
          rawQuery = `${pRes || pCmp}-ACOMP1`;
        } else if (pRes || pCmp) {
          rawQuery = pRes || pCmp;
        }
      } catch (e) {
        // mantener rawQuery original
      }
    }

    const query = rawQuery.toLowerCase();
    const cleanNum = query.replace(/^0+/, "") || query;

    // Detectar si el código escaneado apunta explícitamente al Pase del Acompañante
    const esEscaneoAcompanante = tipo === "acompanante" || (tipo !== "titular" && query.includes("acomp"));

    const index = lista.findIndex(a => {
      const cmpA = a.cmp ? String(a.cmp).trim().toLowerCase() : "";
      const cleanCmpA = cmpA.replace(/^0+/, "") || cmpA;
      const dniA = a.dni ? String(a.dni).trim().toLowerCase() : "";
      const qrAcomp = a.qrAcompanante ? String(a.qrAcompanante).trim().toLowerCase() : "";
      const qrTit = a.qrTitular ? String(a.qrTitular).trim().toLowerCase() : "";
      const qrH = a.qrHash ? String(a.qrHash).trim().toLowerCase() : "";
      const idR = a.idReserva ? a.idReserva.toLowerCase() : "";

      if (esEscaneoAcompanante) {
        return (
          (qrAcomp && qrAcomp === query) ||
          query === `${idR}-acomp1` ||
          query === `${idR}-acomp` ||
          query === `${cmpA}-acomp1` ||
          query === `${cmpA}-acomp` ||
          query === `${cleanCmpA}-acomp1` ||
          query === `${cleanCmpA}-acomp` ||
          (query.includes("acomp") && (query.startsWith(idR) || (cmpA && query.startsWith(cmpA)) || (cleanCmpA && query.startsWith(cleanCmpA))))
        );
      }

      // Validación estricta de Médico Titular (nunca debe coincidir con un código de acompañante)
      if (query.includes("acomp")) return false;

      return (
        idR === query ||
        qrTit === query ||
        qrH === query ||
        cmpA === query ||
        cleanCmpA === cleanNum ||
        dniA === query ||
        (qrTit && (query === qrTit || query === `${idR}-${cmpA}` || query === `${idR}-${cleanCmpA}`))
      );
    });

    if (index === -1) {
      return {
        success: false,
        estado: "NO_ENCONTRADO",
        mensaje: "El código o documento no corresponde a ninguna reserva registrada en el sistema."
      };
    }

    const asistente = lista[index];
    const fechaHora = new Date().toLocaleString("es-PE", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false
    });

    // =========================================================================
    // CASO A: VALIDACIÓN DE PASE DE ACOMPAÑANTE
    // =========================================================================
    if (esEscaneoAcompanante) {
      const numAcomp = parseInt(asistente.acompanantes || 0);
      if (numAcomp === 0) {
        return {
          success: false,
          estado: "SIN_ACOMPANANTE",
          mensaje: `El registro de ${asistente.nombres} no incluye pase de acompañante.`,
          asistente
        };
      }

      // 1. Verificar si el pago del acompañante fue aprobado por el Admin
      const isPagado = asistente.estadoPago === "Aprobado" || asistente.estadoPago === "Pagado";
      if (!isPagado) {
        return {
          success: false,
          estado: "PAGO_PENDIENTE",
          mensaje: `⚠️ PAGO NO APROBADO: El abono de S/ 20.00 del acompañante de ${asistente.nombres} aún no ha sido confirmado por Administración.`,
          asistente,
          esAcompanante: true
        };
      }

      // 2. Verificar si el acompañante ya ingresó
      if (this.esIngresado(asistente, "acompanante")) {
        return {
          success: true,
          estado: "YA_INGRESADO",
          esAcompanante: true,
          mensaje: "¡ALERTA! El boleto de Acompañante YA FUE VALIDADO previamente.",
          fechaPrimerIngreso: asistente.fechaIngresoAcompanante || asistente.fechaIngreso || fechaHora,
          validadoPor: asistente.validadoPorAcompanante || asistente.validadoPor || validador,
          asistente
        };
      }

      // 3. Registrar ingreso del acompañante
      asistente.estadoAcompanante = "Ingresó";
      asistente.fechaIngresoAcompanante = fechaHora;
      asistente.validadoPorAcompanante = validador;

      lista[index] = asistente;
      this.guardarTodos(lista);

      return {
        success: true,
        estado: "VALIDO",
        esAcompanante: true,
        mensaje: "¡Ingreso de Acompañante Autorizado!",
        horaIngreso: fechaHora,
        asistente
      };
    }

    // =========================================================================
    // CASO B: VALIDACIÓN DE PASE DE MÉDICO TITULAR (COLEGIADO)
    // =========================================================================
    if (this.esIngresado(asistente, "titular")) {
      return {
        success: true,
        estado: "YA_INGRESADO",
        esAcompanante: false,
        mensaje: "¡ALERTA! El boleto Titular YA FUE VALIDADO previamente.",
        fechaPrimerIngreso: asistente.fechaIngreso || fechaHora,
        validadoPor: asistente.validadoPor || validador,
        asistente
      };
    }

    // Registrar ingreso del titular
    asistente.estado = "Ingresó";
    asistente.fechaIngreso = fechaHora;
    asistente.validadoPor = validador;

    lista[index] = asistente;
    this.guardarTodos(lista);

    return {
      success: true,
      estado: "VALIDO",
      esAcompanante: false,
      mensaje: "¡Ingreso Titular Autorizado Correctamente!",
      horaIngreso: fechaHora,
      asistente
    };
  },

  /**
   * Restablecer estado a Pendiente (Titular, Acompañante o Ambos)
   */
  restablecerEstado(idReserva, objetivo = "ambos") {
    const lista = this.getAsistentes();
    const index = this.buscarIndiceAsistente(idReserva);
    if (index !== -1) {
      if (objetivo === "ambos" || objetivo === "titular") {
        lista[index].estado = "Pendiente";
        lista[index].fechaIngreso = "";
        lista[index].validadoPor = "";
      }
      if (objetivo === "ambos" || objetivo === "acompanante") {
        lista[index].estadoAcompanante = "Pendiente";
        lista[index].fechaIngresoAcompanante = "";
        lista[index].validadoPorAcompanante = "";
      }
      this.guardarTodos(lista);
      this.guardarUltimaReserva(lista[index]);
      return true;
    }
    return false;
  },

  /**
   * Eliminar un asistente por su ID de Reserva, CMP o criterio
   */
  eliminarAsistente(criterio) {
    const query = String(criterio).trim().toLowerCase();
    const cleanNum = query.replace(/^0+/, "") || query;
    let lista = this.getAsistentes();
    lista = lista.filter(a => {
      const idR = a.idReserva ? a.idReserva.toLowerCase() : "";
      const cmpA = a.cmp ? String(a.cmp).trim().toLowerCase() : "";
      const cleanCmpA = cmpA.replace(/^0+/, "") || cmpA;
      return idR !== query && cmpA !== query && cleanCmpA !== cleanNum && a.idReserva !== criterio && a.cmp !== criterio;
    });
    this.guardarTodos(lista);

    const ultima = this.getUltimaReserva();
    if (ultima && (ultima.idReserva === criterio || ultima.cmp === criterio || String(ultima.idReserva || '').toLowerCase() === query || String(ultima.cmp || '').toLowerCase() === query)) {
      localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.ULTIMA_RESERVA);
      localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.ULTIMO_REGISTRO);
    }
  },

  /**
   * Guardar la última reserva generada (para visualizar inmediatamente en "Mi Boleto")
   */
  guardarUltimaReserva(asistente) {
    if (!asistente) return;
    const normalizado = this.normalizarAsistente(asistente);
    try {
      localStorage.setItem(APP_CONFIG.STORAGE_KEYS.ULTIMA_RESERVA, JSON.stringify(normalizado));
      localStorage.setItem(APP_CONFIG.STORAGE_KEYS.ULTIMO_REGISTRO, JSON.stringify(normalizado));
    } catch (err) {
      console.warn("Advertencia al guardar última reserva en LocalStorage:", err);
    }
  },

  /**
   * Obtener la última reserva guardada sincronizada con el estado actual
   */
  getUltimaReserva() {
    const data = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.ULTIMA_RESERVA) || localStorage.getItem(APP_CONFIG.STORAGE_KEYS.ULTIMO_REGISTRO);
    if (!data) return null;
    try {
      const parsed = JSON.parse(data);
      if (!parsed) return null;

      // Buscar si este asistente existe en la lista viva actualizada
      const idBuscado = parsed.idReserva;
      const cmpBuscado = String(parsed.cmp || "").trim().replace(/^0+/, "");

      const lista = this.getAsistentes();
      const match = lista.find(a => 
        (idBuscado && a.idReserva === idBuscado) ||
        (cmpBuscado && String(a.cmp || "").trim().replace(/^0+/, "") === cmpBuscado)
      );

      if (match) {
        return match;
      }
      return this.normalizarAsistente(parsed);
    } catch (e) {
      return null;
    }
  },

  /**
   * Datos iniciales de demostración con soporte para Option 2
   */
  getDatosIniciales() {
    return [
      {
        idReserva: "CMP-20261007-1001",
        fechaRegistro: "2026-09-02 08:30:00",
        cmp: "121642",
        dni: "73204910",
        nombres: "PONCE PIO GABRIELA LORENA",
        especialidad: "Médico Cirujano",
        celular: "963852741",
        correo: "gabriela.ponce@cmp.org.pe",
        acompanantes: 1,
        nombresAcompanantes: "Dr. Marco Aurelio Quispe",
        requerimientos: "Mesa reservada cerca al escenario",
        montoPago: 20,
        metodoPago: "Yape",
        nroOperacion: "98234710",
        voucherImg: "",
        estadoPago: "Aprobado",
        estado: "Pendiente",
        fechaIngreso: "",
        validadoPor: "",
        qrTitular: "CMP-20261007-1001-121642",
        qrHash: "CMP-20261007-1001-121642",
        qrAcompanante: "CMP-20261007-1001-ACOMP1",
        estadoAcompanante: "Pendiente",
        fechaIngresoAcompanante: "",
        validadoPorAcompanante: ""
      },
      {
        idReserva: "CMP-20261007-1002",
        fechaRegistro: "2026-09-02 09:15:00",
        cmp: "120050",
        dni: "47851236",
        nombres: "HUERTA AVILA YONEL HAMILTON",
        especialidad: "Médico Cirujano",
        celular: "987456321",
        correo: "yonel.huerta@cmp.org.pe",
        acompanantes: 0,
        nombresAcompanantes: "Ninguno",
        requerimientos: "Ninguno",
        montoPago: 0,
        metodoPago: "Gratuito (Titular)",
        nroOperacion: "N/A",
        voucherImg: "",
        estadoPago: "Gratuito",
        estado: "Pendiente",
        fechaIngreso: "",
        validadoPor: "",
        qrTitular: "CMP-20261007-1002-120050",
        qrHash: "CMP-20261007-1002-120050",
        qrAcompanante: "",
        estadoAcompanante: "",
        fechaIngresoAcompanante: "",
        validadoPorAcompanante: ""
      }
    ];
  }
};
