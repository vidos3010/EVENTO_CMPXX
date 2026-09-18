/**
 * =========================================================================================
 * SERVICIO DE PADRÓN DE AGREMIADOS - COLEGIO MÉDICO DEL PERÚ PASCO
 * Valida que solo los médicos colegiados registrados en el Padrón puedan reservar.
 * =========================================================================================
 */

const PadronService = {
  STORAGE_KEY: "cmp_pasco_padron_personalizado_v1",

  /**
   * Obtener lista completa de agremiados (desde localStorage o base oficial de 380)
   */
  getAgremiados() {
    const custom = localStorage.getItem(this.STORAGE_KEY);
    if (custom) {
      try {
        const parsed = JSON.parse(custom);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error("Error al leer padrón personalizado:", e);
      }
    }
    return typeof PADRON_AGREMIADOS_DATA !== "undefined" ? PADRON_AGREMIADOS_DATA : [];
  },

  /**
   * Guardar nuevo padrón actualizado
   */
  guardarPadron(lista) {
    if (Array.isArray(lista)) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(lista));
    }
  },

  /**
   * Restablecer padrón al archivo oficial de 380 colegiados
   */
  restablecerPadronOficial() {
    localStorage.removeItem(this.STORAGE_KEY);
  },

  /**
   * Buscar colegiado por número de CMP exacto
   */
  buscarPorCMP(cmp) {
    if (!cmp) return null;
    const cleanCmp = String(cmp).trim().replace(/^0+/, "") || String(cmp).trim();
    const padron = this.getAgremiados();

    return padron.find(a => {
      const padronCmp = String(a.cmp).trim().replace(/^0+/, "") || String(a.cmp).trim();
      return padronCmp === cleanCmp || String(a.cmp).trim() === String(cmp).trim();
    }) || null;
  },

  /**
   * Validar si un CMP está habilitado para reservar
   */
  validarIngresoReserva(cmp) {
    const colegiado = this.buscarPorCMP(cmp);
    if (!colegiado) {
      return {
        valido: false,
        motivo: "NO_REGISTRADO",
        mensaje: `El N° de CMP "${cmp}" no se encuentra en el Padrón Oficial de Agremiados de Pasco. Solo los colegiados registrados pueden reservar.`
      };
    }

    // Verificar si ya tiene reserva registrada
    const yaRegistrado = StorageService.buscarAsistente(cmp);
    if (yaRegistrado) {
      return {
        valido: false,
        motivo: "YA_REGISTRADO",
        mensaje: `El Dr(a). ${colegiado.nombres} ya cuenta con una inscripción activa (ID: ${yaRegistrado.idReserva}). Solo se permite una inscripción por colegiado.`,
        colegiado,
        reservaExistente: yaRegistrado
      };
    }

    return {
      valido: true,
      colegiado,
      mensaje: `Médico verificado: ${colegiado.nombres} (${colegiado.habilidad || 'HABIL'})`
    };
  },

  /**
   * Procesar archivo Excel (.xlsx) subido para actualizar el padrón
   */
  async importarDesdeExcel(file) {
    return new Promise((resolve, reject) => {
      if (!file || typeof XLSX === "undefined") {
        reject(new Error("Librería XLSX no disponible o archivo no válido."));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

          let headerRowIndex = -1;
          for (let i = 0; i < Math.min(15, rows.length); i++) {
            const rowStr = JSON.stringify(rows[i] || []).toUpperCase();
            if (rowStr.includes("CMP") && (rowStr.includes("NOMBRE") || rowStr.includes("NOMBRES"))) {
              headerRowIndex = i;
              break;
            }
          }

          if (headerRowIndex === -1) {
            reject(new Error("No se detectó la columna CMP o NOMBRES en el archivo Excel."));
            return;
          }

          const header = rows[headerRowIndex].map(h => String(h || "").trim().toUpperCase());
          const cmpIdx = header.findIndex(h => h === "CMP" || h.includes("COLEG"));
          const nomIdx = header.findIndex(h => h.includes("NOMBRE") || h.includes("APELLID"));
          const habIdx = header.findIndex(h => h.includes("HABIL"));

          const nuevosAgremiados = [];
          for (let r = headerRowIndex + 1; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;

            const cmpVal = row[cmpIdx];
            const nomVal = row[nomIdx];
            if (cmpVal && nomVal) {
              nuevosAgremiados.push({
                cmp: String(cmpVal).trim(),
                nombres: String(nomVal).trim(),
                habilidad: habIdx !== -1 && row[habIdx] ? String(row[habIdx]).trim() : "HABIL",
                estado: "ACTIVO"
              });
            }
          }

          if (nuevosAgremiados.length === 0) {
            reject(new Error("No se encontraron registros válidos de colegiados."));
            return;
          }

          this.guardarPadron(nuevosAgremiados);
          resolve({
            success: true,
            total: nuevosAgremiados.length,
            muestra: nuevosAgremiados.slice(0, 3)
          });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Error al leer el archivo."));
      reader.readAsArrayBuffer(file);
    });
  }
};
