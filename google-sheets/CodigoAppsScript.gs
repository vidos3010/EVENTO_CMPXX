/**
 * =========================================================================================
 * SISTEMA DE RESERVAS Y VALIDACIÓN QR EN TIEMPO REAL
 * COLEGIO MÉDICO DEL PERÚ - CONSEJO REGIONAL XX PASCO
 * CÓDIGO GOOGLE APPS SCRIPT (Backend para Google Sheets)
 * =========================================================================================
 * 
 * INSTRUCCIONES DE INSTALACIÓN:
 * 1. Crea una hoja de cálculo en Google Sheets (ejemplo: "Evento CMP Pasco 2026").
 * 2. Ve al menú: Extensiones -> Apps Script.
 * 3. Borra todo el código y pega este archivo completo.
 * 4. Haz clic en el botón azul "Implementar" (arriba a la derecha) -> "Nueva implementación".
 * 5. Selecciona el tipo de engranaje: "Aplicación web".
 * 6. Configura:
 *    - Descripción: "API Evento y Validación QR CMP Pasco"
 *    - Ejecutar como: "Yo (tu cuenta de correo)"
 *    - Quién tiene acceso: "Cualquier persona" (Anyone) -> ¡CLAVE PARA QUE FUNCIONE!
 * 7. Haz clic en "Implementar", autoriza los permisos y COPIA LA URL DE LA APLICACIÓN WEB.
 * 8. Pega esa URL en la pestaña "Ajustes" del sistema web.
 */

// Nombre de la pestaña de la hoja de cálculo
const HOJA_REGISTROS = "Asistentes";

/**
 * Helper para buscar índice de columna por múltiples alias y sin sensibilidad a caracteres especiales
 */
function findHeaderIndex(headers, aliases) {
  if (!Array.isArray(headers)) return -1;
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const a of aliases) {
      const cleanA = String(a).toLowerCase().replace(/[^a-z0-9]/g, "");
      if (h === cleanA) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Inicializar la hoja de cálculo con los encabezados oficiales
 */
function inicializarHoja() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(HOJA_REGISTROS);
  
  if (!sheet) {
    sheet = ss.insertSheet(HOJA_REGISTROS);
  }
  
  const headersOficiales = [
    "ID Reserva",
    "Fecha y Hora Registro",
    "N° CMP",
    "Nombres y Apellidos",
    "Celular / WhatsApp",
    "Correo Electrónico",
    "Modalidad de Pase",
    "Personas Autorizadas",
    "Nombres Acompañante",
    "Estado Asistencia",
    "Fecha y Hora Ingreso",
    "Validado Por",
    "Código QR / Hash"
  ];
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headersOficiales);
    formatearCabecera(sheet, headersOficiales.length);
  } else {
    const currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
    let missingHeaders = [];
    
    headersOficiales.forEach(h => {
      const idx = findHeaderIndex(currentHeaders, [h]);
      if (idx === -1) {
        missingHeaders.push(h);
      }
    });
    
    if (missingHeaders.length > 0) {
      const startCol = currentHeaders.length + 1;
      missingHeaders.forEach((hName, i) => {
        sheet.getRange(1, startCol + i).setValue(hName);
      });
      formatearCabecera(sheet, sheet.getLastColumn());
    }
  }
}

function formatearCabecera(sheet, numCols) {
  const headerRange = sheet.getRange(1, 1, 1, numCols);
  headerRange.setBackground("#380036");
  headerRange.setFontColor("#DFB76C");
  headerRange.setFontWeight("bold");
  headerRange.setHorizontalAlignment("center");
  headerRange.setVerticalAlignment("middle");
  sheet.setRowHeight(1, 38);
  sheet.setFrozenRows(1);
}

/**
 * Manejador de solicitudes GET (Consulta de datos o prueba de conexión)
 */
function doGet(e) {
  try {
    inicializarHoja();
    const action = e.parameter ? e.parameter.action : null;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(HOJA_REGISTROS);
    
    // 1. Obtener todos los asistentes
    if (action === "obtenerAsistentes" || !action) {
      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) {
        return jsonResponse({ success: true, data: [] });
      }
      
      const headers = data[0];
      const rows = data.slice(1);
      const asistentes = rows.map((row, index) => {
        let obj = { rowIndex: index + 2 };
        headers.forEach((header, i) => {
          obj[header] = row[i];
        });
        return obj;
      });
      
      return jsonResponse({ success: true, data: asistentes });
    }
    
    // 2. Ping de prueba de conexión
    if (action === "ping") {
      return jsonResponse({
        success: true,
        mensaje: "Conexión exitosa con Google Sheets - CMP Pasco",
        fecha: new Date().toISOString()
      });
    }
    
    return jsonResponse({ success: true, mensaje: "API Activa" });
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

/**
 * Manejador de solicitudes POST (Registrar, validar QR, reiniciar, eliminar)
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  
  try {
    lock.waitLock(15000);
    inicializarHoja();
    
    let body = {};
    if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    
    const action = body.action || "registrar";
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(HOJA_REGISTROS);
    
    // =========================================================================
    // ACCIÓN 1: REGISTRAR ASISTENTE
    // =========================================================================
    if (action === "registrar") {
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const rows = data.slice(1);
      
      const cmpIndex = findHeaderIndex(headers, ["N° CMP", "Nº CMP", "CMP", "cmp"]);
      const idIndex = findHeaderIndex(headers, ["ID Reserva", "idReserva", "Codigo"]);
      const nuevoCMP = String(body.cmp || "").trim();
      const idReserva = body.idReserva || "CMP-" + Utilities.formatDate(new Date(), "America/Lima", "yyyyMMdd-") + Math.floor(1000 + Math.random() * 9000);
      const numAcomp = parseInt(body.acompanantes || 0);
      const esDoble = numAcomp > 0;
      
      // Comprobar si ya existe la reserva por CMP o ID Reserva
      let existingRowIndex = -1;
      if (nuevoCMP || body.idReserva) {
        for (let i = 0; i < rows.length; i++) {
          const matchCMP = nuevoCMP && cmpIndex !== -1 && String(rows[i][cmpIndex]).trim() === nuevoCMP;
          const matchID = body.idReserva && idIndex !== -1 && String(rows[i][idIndex]).trim() === String(body.idReserva).trim();
          if (matchCMP || matchID) {
            existingRowIndex = i + 2;
            break;
          }
        }
      }
      
      const qrHash = body.qrHash || body.qrTitular || idReserva + "-" + nuevoCMP;
      const modalidad = esDoble ? "Pase Doble (2 Personas)" : "Pase Individual (1 Persona)";
      const personas = esDoble ? 2 : 1;
      const nombresAcomp = esDoble ? (body.nombresAcompanantes || "Acompañante Registrado") : "Ninguno";
      
      if (existingRowIndex !== -1) {
        // Actualizar fila existente
        const estadoIdx = findHeaderIndex(headers, ["Estado Asistencia", "Asistencia", "Estado"]);
        const fechaIngresoIdx = findHeaderIndex(headers, ["Fecha y Hora Ingreso", "Fecha Ingreso", "Hora Ingreso"]);
        const validadorIdx = findHeaderIndex(headers, ["Validado Por", "Validado por"]);
        const modIdx = findHeaderIndex(headers, ["Modalidad de Pase", "Modalidad"]);
        const persIdx = findHeaderIndex(headers, ["Personas Autorizadas", "Personas"]);
        const nomAcompIdx = findHeaderIndex(headers, ["Nombres Acompañante", "Nombres Acompañantes"]);
        
        if (body.estado && estadoIdx !== -1) sheet.getRange(existingRowIndex, estadoIdx + 1).setValue(body.estado);
        if (body.fechaIngreso && fechaIngresoIdx !== -1) sheet.getRange(existingRowIndex, fechaIngresoIdx + 1).setValue(body.fechaIngreso);
        if (body.validadoPor && validadorIdx !== -1) sheet.getRange(existingRowIndex, validadorIdx + 1).setValue(body.validadoPor);
        if (modIdx !== -1) sheet.getRange(existingRowIndex, modIdx + 1).setValue(modalidad);
        if (persIdx !== -1) sheet.getRange(existingRowIndex, persIdx + 1).setValue(personas);
        if (nomAcompIdx !== -1) sheet.getRange(existingRowIndex, nomAcompIdx + 1).setValue(nombresAcomp);
        
        return jsonResponse({
          success: true,
          mensaje: "Reserva existente actualizada con éxito",
          idReserva: idReserva
        });
      }
      
      const fechaRegistro = body.fechaRegistro || Utilities.formatDate(new Date(), "America/Lima", "yyyy-MM-dd HH:mm:ss");
      
      const nuevaFila = [
        idReserva,
        fechaRegistro,
        nuevoCMP,
        body.nombres || "",
        body.celular || "",
        body.correo || "",
        modalidad,
        personas,
        nombresAcomp,
        "Pendiente", // Estado Asistencia
        "",          // Fecha ingreso
        "",          // Validado por
        qrHash       // Código QR / Hash
      ];
      
      sheet.appendRow(nuevaFila);
      
      return jsonResponse({
        success: true,
        mensaje: "Reserva registrada exitosamente",
        idReserva: idReserva,
        qrHash: qrHash
      });
    }
    
    // =========================================================================
    // ACCIÓN 2: VALIDAR INGRESO EN PUERTA (1 PERSONA O PASE DOBLE PARA 2)
    // =========================================================================
    if (action === "validarIngreso") {
      const codigo = String(body.codigo || body.idReserva || "").trim();
      const validador = body.validador || "Staff Puerta";
      
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const rows = data.slice(1);
      
      const idIndex = findHeaderIndex(headers, ["ID Reserva", "idReserva", "Codigo"]);
      const cmpIndex = findHeaderIndex(headers, ["N° CMP", "Nº CMP", "CMP", "cmp"]);
      const qrIndex = findHeaderIndex(headers, ["Código QR / Hash", "Código QR Titular", "QR Hash"]);
      const estadoIndex = findHeaderIndex(headers, ["Estado Asistencia", "Asistencia", "Estado"]);
      const fechaIngresoIndex = findHeaderIndex(headers, ["Fecha y Hora Ingreso", "Fecha Ingreso", "Hora Ingreso"]);
      const validadorIndex = findHeaderIndex(headers, ["Validado Por"]);
      const persIndex = findHeaderIndex(headers, ["Personas Autorizadas", "Personas"]);
      const modIndex = findHeaderIndex(headers, ["Modalidad de Pase", "Modalidad"]);
      const nomAcompIndex = findHeaderIndex(headers, ["Nombres Acompañante", "Nombres Acompañantes"]);
      
      let filaIndex = -1;
      let rowData = null;
      const cleanCode = codigo.toLowerCase();
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowId = idIndex !== -1 ? String(row[idIndex]).trim().toLowerCase() : "";
        const rowCmp = cmpIndex !== -1 ? String(row[cmpIndex]).trim().toLowerCase() : "";
        const rowQr = qrIndex !== -1 ? String(row[qrIndex]).trim().toLowerCase() : "";
        
        if (
          rowId === cleanCode ||
          rowQr === cleanCode ||
          rowCmp === cleanCode ||
          cleanCode === rowId + "-" + rowCmp ||
          (cleanCode.includes(rowId) && rowId.length > 3) ||
          (rowCmp && cleanCode.includes(rowCmp) && rowCmp.length >= 4)
        ) {
          filaIndex = i + 2;
          rowData = row;
          break;
        }
      }
      
      if (filaIndex === -1) {
        return jsonResponse({
          success: false,
          estado: "NO_ENCONTRADO",
          mensaje: "El código no corresponde a ninguna reserva registrada."
        });
      }
      
      const estadoActual = estadoIndex !== -1 ? String(rowData[estadoIndex]).trim().toLowerCase() : "";
      const esDoble = persIndex !== -1 ? parseInt(rowData[persIndex] || 1) > 1 : (modIndex !== -1 && String(rowData[modIndex]).includes("Doble"));
      const personas = esDoble ? 2 : 1;
      
      if (estadoActual.includes("ingres") || estadoActual.includes("asist") || estadoActual === "si") {
        return jsonResponse({
          success: true,
          estado: "YA_INGRESADO",
          esPaseDoble: esDoble,
          personas: personas,
          mensaje: "¡ALERTA! Este boleto ya fue validado previamente.",
          fechaPrimerIngreso: fechaIngresoIndex !== -1 ? rowData[fechaIngresoIndex] : "",
          validadoPor: validadorIndex !== -1 ? rowData[validadorIndex] : "",
          asistente: {
            idReserva: idIndex !== -1 ? rowData[idIndex] : "",
            nombres: rowData[findHeaderIndex(headers, ["Nombres y Apellidos", "Nombres"])],
            cmp: cmpIndex !== -1 ? rowData[cmpIndex] : "",
            nombresAcompanantes: nomAcompIndex !== -1 ? rowData[nomAcompIndex] : ""
          }
        });
      }
      
      const horaIngreso = Utilities.formatDate(new Date(), "America/Lima", "yyyy-MM-dd HH:mm:ss");
      
      if (estadoIndex !== -1) sheet.getRange(filaIndex, estadoIndex + 1).setValue("Ingresó");
      if (fechaIngresoIndex !== -1) sheet.getRange(filaIndex, fechaIngresoIndex + 1).setValue(horaIngreso);
      if (validadorIndex !== -1) sheet.getRange(filaIndex, validadorIndex + 1).setValue(validador);
      
      return jsonResponse({
        success: true,
        estado: "VALIDO",
        esPaseDoble: esDoble,
        personas: personas,
        mensaje: esDoble ? "¡Ingreso Autorizado para 2 Personas!" : "¡Ingreso Autorizado para 1 Persona!",
        horaIngreso: horaIngreso,
        asistente: {
          idReserva: idIndex !== -1 ? rowData[idIndex] : "",
          nombres: rowData[findHeaderIndex(headers, ["Nombres y Apellidos", "Nombres"])],
          cmp: cmpIndex !== -1 ? rowData[cmpIndex] : "",
          nombresAcompanantes: nomAcompIndex !== -1 ? rowData[nomAcompIndex] : ""
        }
      });
    }
    
    // =========================================================================
    // ACCIÓN 3: REINICIAR / RESTABLECER ASISTENCIA A PENDIENTE
    // =========================================================================
    if (action === "reiniciarAsistencia") {
      const codigo = String(body.codigo || "").trim();
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const rows = data.slice(1);
      
      const idIndex = findHeaderIndex(headers, ["ID Reserva", "idReserva", "Codigo"]);
      const cmpIndex = findHeaderIndex(headers, ["N° CMP", "Nº CMP", "CMP", "cmp"]);
      const qrIndex = findHeaderIndex(headers, ["Código QR / Hash", "Código QR Titular", "QR Hash"]);
      const estadoIndex = findHeaderIndex(headers, ["Estado Asistencia", "Asistencia", "Estado"]);
      const fechaIngresoIndex = findHeaderIndex(headers, ["Fecha y Hora Ingreso", "Fecha Ingreso", "Hora Ingreso"]);
      const validadorIndex = findHeaderIndex(headers, ["Validado Por"]);
      
      const cleanCode = codigo.toLowerCase();
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowId = idIndex !== -1 ? String(row[idIndex]).trim().toLowerCase() : "";
        const rowCmp = cmpIndex !== -1 ? String(row[cmpIndex]).trim().toLowerCase() : "";
        const rowQr = qrIndex !== -1 ? String(row[qrIndex]).trim().toLowerCase() : "";
        
        if (rowId === cleanCode || rowCmp === cleanCode || rowQr === cleanCode) {
          const filaIndex = i + 2;
          if (estadoIndex !== -1) sheet.getRange(filaIndex, estadoIndex + 1).setValue("Pendiente");
          if (fechaIngresoIndex !== -1) sheet.getRange(filaIndex, fechaIngresoIndex + 1).setValue("");
          if (validadorIndex !== -1) sheet.getRange(filaIndex, validadorIndex + 1).setValue("");
          
          return jsonResponse({
            success: true,
            mensaje: "Asistencia restablecida a Pendiente con éxito."
          });
        }
      }
      
      return jsonResponse({ success: false, error: "Registro no encontrado para reiniciar." });
    }
    
    // =========================================================================
    // ACCIÓN 4: ELIMINAR ASISTENTE
    // =========================================================================
    if (action === "eliminarAsistente") {
      const idReserva = String(body.idReserva || "").trim();
      const cmp = String(body.cmp || "").trim();
      
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const rows = data.slice(1);
      
      const idIndex = findHeaderIndex(headers, ["ID Reserva", "idReserva", "Codigo"]);
      const cmpIndex = findHeaderIndex(headers, ["N° CMP", "Nº CMP", "CMP", "cmp"]);
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowId = idIndex !== -1 ? String(row[idIndex]).trim() : "";
        const rowCmp = cmpIndex !== -1 ? String(row[cmpIndex]).trim() : "";
        
        if ((idReserva && rowId === idReserva) || (cmp && rowCmp === cmp)) {
          sheet.deleteRow(i + 2);
          return jsonResponse({
            success: true,
            mensaje: "Asistente eliminado correctamente de la hoja de cálculo."
          });
        }
      }
      
      return jsonResponse({ success: false, error: "No se encontró el registro para eliminar." });
    }
    
    return jsonResponse({ success: false, error: "Acción no reconocida." });
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper para responder en formato JSON
 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
