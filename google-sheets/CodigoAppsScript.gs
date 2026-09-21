/**
 * =========================================================================================
 * SISTEMA DE RESERVAS, VALIDACIÓN QR Y ALMACENAMIENTO DE VOUCHERS EN GOOGLE DRIVE
 * COLEGIO MÉDICO DEL PERÚ - CONSEJO REGIONAL XX PASCO
 * CÓDIGO GOOGLE APPS SCRIPT (Backend para Google Sheets / Google Drive)
 * =========================================================================================
 * 
 * INSTRUCCIONES DE INSTALACIÓN:
 * 1. Crea una hoja de cálculo en Google Sheets (ejemplo: "Evento CMP Pasco 2026").
 * 2. Ve al menú: Extensiones -> Apps Script.
 * 3. Borra todo el código y pega este archivo completo.
 * 4. Haz clic en el botón azul "Implementar" (arriba a la derecha) -> "Nueva implementación".
 * 5. Selecciona el tipo de engranaje: "Aplicación web".
 * 6. Configura:
 *    - Descripción: "API Evento y Vouchers CMP Pasco"
 *    - Ejecutar como: "Yo (tu cuenta de correo)"
 *    - Quién tiene acceso: "Cualquier persona" (Anyone) -> ¡CLAVE PARA QUE FUNCIONE!
 * 7. Haz clic en "Implementar", autoriza los permisos y COPIA LA URL DE LA APLICACIÓN WEB.
 * 8. Pega esa URL en la pestaña "Ajustes" del sistema web.
 */

// Nombre de la pestaña de la hoja de cálculo y carpeta de Drive
const HOJA_REGISTROS = "Asistentes";
const CARPETA_VOUCHERS = "Vouchers Evento CMP Pasco 2026";

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
 * Inicializar la hoja de cálculo con los encabezados oficiales y actualizar columnas faltantes
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
    "N° Acompañantes",
    "Nombres Acompañantes",
    "Estado Pago",
    "Monto Abonado (S/)",
    "Medio de Pago",
    "N° Operación",
    "Enlace Voucher Drive",
    "Estado Asistencia", // Titular: Pendiente / Ingresó
    "Fecha y Hora Ingreso",
    "Validado Por",
    "Código QR Titular",
    "Código QR Acompañante",
    "Estado Asistencia Acompañante", // Acompañante: Pendiente / Ingresó
    "Fecha y Hora Ingreso Acompañante",
    "Validado Por Acompañante"
  ];
  
  // Si la primera fila está vacía, agregar encabezados completos
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headersOficiales);
    formatearCabecera(sheet, headersOficiales.length);
  } else {
    // Si la hoja ya tiene datos, verificar si faltan columnas nuevas (ej. Enlace Voucher Drive, Estado Pago)
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
 * Guardar foto/captura del voucher en una carpeta específica de Google Drive
 */
function guardarVoucherEnGoogleDrive(base64Data, idReserva, cmp) {
  if (!base64Data || typeof base64Data !== "string" || !base64Data.includes("base64,")) {
    return "";
  }
  
  try {
    let folder;
    const folders = DriveApp.getFoldersByName(CARPETA_VOUCHERS);
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(CARPETA_VOUCHERS);
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }
    
    // Extraer MIME type y bytes
    const parts = base64Data.split("base64,");
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const extension = mimeType.includes("png") ? ".png" : ".jpg";
    const decodedBytes = Utilities.base64Decode(parts[1]);
    const fileName = "Voucher_CMP_" + (cmp || "00000") + "_" + idReserva + extension;
    
    const blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return file.getUrl();
  } catch (err) {
    Logger.log("Error al subir voucher a Google Drive: " + err);
    return "";
  }
}

/**
 * Manejador de solicitudes GET (Consulta de datos, verificación de QR o prueba de conexión)
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
        mensaje: "Conexión exitosa con Google Sheets & Drive - CMP Pasco",
        fecha: new Date().toISOString()
      });
    }
    
    return jsonResponse({ success: true, mensaje: "API Activa" });
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

/**
 * Manejador de solicitudes POST (Registrar asistencia, validar QR y subir vouchers a Drive)
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
    // ACCIÓN 1: REGISTRAR ASISTENTE Y SUBIR VOUCHER A GOOGLE DRIVE
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
      
      // Si la reserva ya existe y viene una actualización de voucher o aprobación de pago:
      if (existingRowIndex !== -1) {
        let enlaceVoucherDrive = "";
        if (numAcomp > 0 && body.voucherImg) {
          enlaceVoucherDrive = guardarVoucherEnGoogleDrive(body.voucherImg, idReserva, nuevoCMP);
        }
        
        const voucherIdx = findHeaderIndex(headers, ["Enlace Voucher Drive", "Voucher Drive", "Voucher"]);
        const estadoPagoIdx = findHeaderIndex(headers, ["Estado Pago", "Estado de Pago"]);
        const nroOpIdx = findHeaderIndex(headers, ["N° Operación", "Nº Operación", "Operacion"]);
        const qrAcompIdx = findHeaderIndex(headers, ["Código QR Acompañante", "QR Acompañante"]);
        const acompIdx = findHeaderIndex(headers, ["N° Acompañantes", "Nº Acompañantes", "Acompañantes"]);
        const nomAcompIdx = findHeaderIndex(headers, ["Nombres Acompañantes", "Nombre Acompañante"]);
        const montoIdx = findHeaderIndex(headers, ["Monto Abonado (S/)", "Monto Abonado", "Monto"]);
        const metodoIdx = findHeaderIndex(headers, ["Medio de Pago", "Medio"]);
        const estadoTitIdx = findHeaderIndex(headers, ["Estado Asistencia", "Asistencia", "Estado"]);
        const fechaIngresoTitIdx = findHeaderIndex(headers, ["Fecha y Hora Ingreso", "Fecha Ingreso"]);
        const validadorTitIdx = findHeaderIndex(headers, ["Validado Por"]);
        const estadoAcompIdx = findHeaderIndex(headers, ["Estado Asistencia Acompañante"]);
        const fechaIngresoAcompIdx = findHeaderIndex(headers, ["Fecha y Hora Ingreso Acompañante"]);
        const validadorAcompIdx = findHeaderIndex(headers, ["Validado Por Acompañante"]);
        
        if (enlaceVoucherDrive && voucherIdx !== -1) {
          sheet.getRange(existingRowIndex, voucherIdx + 1).setValue(enlaceVoucherDrive);
        }
        if (body.estadoPago && estadoPagoIdx !== -1) {
          sheet.getRange(existingRowIndex, estadoPagoIdx + 1).setValue(body.estadoPago);
        }
        if (body.nroOperacion && nroOpIdx !== -1) {
          sheet.getRange(existingRowIndex, nroOpIdx + 1).setValue(body.nroOperacion);
        }
        if (body.estado && estadoTitIdx !== -1) {
          sheet.getRange(existingRowIndex, estadoTitIdx + 1).setValue(body.estado);
        }
        if (body.fechaIngreso && fechaIngresoTitIdx !== -1) {
          sheet.getRange(existingRowIndex, fechaIngresoTitIdx + 1).setValue(body.fechaIngreso);
        }
        if (body.validadoPor && validadorTitIdx !== -1) {
          sheet.getRange(existingRowIndex, validadorTitIdx + 1).setValue(body.validadoPor);
        }
        if (body.estadoAcompanante && estadoAcompIdx !== -1) {
          sheet.getRange(existingRowIndex, estadoAcompIdx + 1).setValue(body.estadoAcompanante);
        }
        if (body.fechaIngresoAcompanante && fechaIngresoAcompIdx !== -1) {
          sheet.getRange(existingRowIndex, fechaIngresoAcompIdx + 1).setValue(body.fechaIngresoAcompanante);
        }
        if (body.validadoPorAcompanante && validadorAcompIdx !== -1) {
          sheet.getRange(existingRowIndex, validadorAcompIdx + 1).setValue(body.validadoPorAcompanante);
        }
        if (numAcomp > 0) {
          if (acompIdx !== -1) sheet.getRange(existingRowIndex, acompIdx + 1).setValue(numAcomp);
          if (nomAcompIdx !== -1 && body.nombresAcompanantes) sheet.getRange(existingRowIndex, nomAcompIdx + 1).setValue(body.nombresAcompanantes);
          if (qrAcompIdx !== -1) sheet.getRange(existingRowIndex, qrAcompIdx + 1).setValue(body.qrAcompanante || (idReserva + "-ACOMP1"));
          if (montoIdx !== -1 && body.montoPago) sheet.getRange(existingRowIndex, montoIdx + 1).setValue(body.montoPago);
          if (metodoIdx !== -1 && body.metodoPago) sheet.getRange(existingRowIndex, metodoIdx + 1).setValue(body.metodoPago);
        }
        
        return jsonResponse({
          success: true,
          mensaje: "Reserva existente actualizada con nuevo comprobante / estado en Google Drive",
          idReserva: idReserva,
          enlaceVoucherDrive: enlaceVoucherDrive
        });
      }
      
      const fechaRegistro = body.fechaRegistro || Utilities.formatDate(new Date(), "America/Lima", "yyyy-MM-dd HH:mm:ss");
      const qrTitular = body.qrTitular || body.qrHash || idReserva + "-" + nuevoCMP;
      const qrAcompanante = numAcomp > 0 ? (body.qrAcompanante || idReserva + "-ACOMP1") : "";
      
      // Subir voucher a Google Drive si existe
      let enlaceVoucherDrive = "";
      if (numAcomp > 0 && body.voucherImg) {
        enlaceVoucherDrive = guardarVoucherEnGoogleDrive(body.voucherImg, idReserva, nuevoCMP);
      }
      
      const estadoPago = body.estadoPago || (numAcomp > 0 ? "Pendiente" : "Gratuito");
      const montoAbonado = body.montoPago || (numAcomp > 0 ? numAcomp * 20 : 0);
      const metodoPago = body.metodoPago || (numAcomp > 0 ? "Yape" : "Gratuito (Titular)");
      const nroOperacion = body.nroOperacion || (numAcomp > 0 ? "" : "N/A");
      
      const nuevaFila = [
        idReserva,
        fechaRegistro,
        nuevoCMP,
        body.nombres || "",
        body.celular || "",
        body.correo || "",
        numAcomp,
        body.nombresAcompanantes || (numAcomp > 0 ? "Acompañante Registrado" : "Ninguno"),
        estadoPago,
        montoAbonado,
        metodoPago,
        nroOperacion,
        enlaceVoucherDrive,
        "Pendiente", // Estado Asistencia Titular
        "",          // Fecha ingreso Titular
        "",          // Validado por Titular
        qrTitular,
        qrAcompanante,
        numAcomp > 0 ? "Pendiente" : "", // Estado Asistencia Acompanante
        "",                              // Fecha ingreso Acompanante
        ""                               // Validado por Acompanante
      ];
      
      sheet.appendRow(nuevaFila);
      
      return jsonResponse({
        success: true,
        mensaje: "Reserva registrada con pases duales en Google Drive",
        idReserva: idReserva,
        qrTitular: qrTitular,
        qrAcompanante: qrAcompanante,
        enlaceVoucherDrive: enlaceVoucherDrive
      });
    }
    
    // =========================================================================
    // ACCIÓN 2: VALIDAR INGRESO EN PUERTA (TITULAR O ACOMPAÑANTE)
    // =========================================================================
    if (action === "validarIngreso") {
      const codigo = String(body.codigo || body.idReserva || "").trim();
      const validador = body.validador || "Staff Puerta";
      const tipo = body.tipo || (codigo.toLowerCase().includes("acomp") ? "acompanante" : "titular");
      const esAcompScan = tipo === "acompanante" || codigo.toLowerCase().includes("acomp");
      
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const rows = data.slice(1);
      
      const idIndex = headers.indexOf("ID Reserva");
      const cmpIndex = headers.indexOf("N° CMP");
      const qrTitIndex = headers.indexOf("Código QR Titular") !== -1 ? headers.indexOf("Código QR Titular") : headers.indexOf("Código QR / Hash");
      const qrAcompIndex = headers.indexOf("Código QR Acompañante");
      const estadoIndex = headers.indexOf("Estado Asistencia");
      const fechaIngresoIndex = headers.indexOf("Fecha y Hora Ingreso");
      const validadorIndex = headers.indexOf("Validado Por");
      const estadoPagoIndex = headers.indexOf("Estado Pago");
      const estadoAcompIndex = headers.indexOf("Estado Asistencia Acompañante");
      const fechaIngresoAcompIndex = headers.indexOf("Fecha y Hora Ingreso Acompañante");
      const validadorAcompIndex = headers.indexOf("Validado Por Acompañante");
      
      let filaIndex = -1;
      let rowData = null;
      
      const cleanCode = codigo.toLowerCase();
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowId = String(row[idIndex]).trim().toLowerCase();
        const rowCmp = String(row[cmpIndex]).trim().toLowerCase();
        const rowQrTit = qrTitIndex !== -1 ? String(row[qrTitIndex]).trim().toLowerCase() : "";
        const rowQrAcomp = qrAcompIndex !== -1 ? String(row[qrAcompIndex]).trim().toLowerCase() : "";

        if (esAcompScan) {
          if (
            (rowQrAcomp && rowQrAcomp === cleanCode) ||
            cleanCode === rowId + "-acomp1" ||
            cleanCode === rowId + "-acomp" ||
            cleanCode === rowCmp + "-acomp1" ||
            cleanCode === rowCmp + "-acomp" ||
            (cleanCode.includes("acomp") && (cleanCode.startsWith(rowId) || cleanCode.startsWith(rowCmp)))
          ) {
            filaIndex = i + 2;
            rowData = row;
            break;
          }
        } else {
          if (cleanCode.includes("acomp")) continue;
          if (
            rowId === cleanCode ||
            rowQrTit === cleanCode ||
            rowCmp === cleanCode ||
            cleanCode === rowId + "-" + rowCmp
          ) {
            filaIndex = i + 2;
            rowData = row;
            break;
          }
        }
      }
      
      if (filaIndex === -1) {
        return jsonResponse({
          success: false,
          estado: "NO_ENCONTRADO",
          mensaje: "El código no corresponde a ninguna reserva registrada."
        });
      }
      
      const horaIngreso = Utilities.formatDate(new Date(), "America/Lima", "yyyy-MM-dd HH:mm:ss");

      // Validar acompañante
      if (esAcompScan) {
        const estadoPago = estadoPagoIndex !== -1 ? rowData[estadoPagoIndex] : "Pendiente";
        if (estadoPago !== "Aprobado" && estadoPago !== "Pagado" && validador !== "Admin Manual") {
          return jsonResponse({
            success: false,
            estado: "PAGO_PENDIENTE",
            mensaje: "⚠️ El pago del acompañante aún no ha sido APROBADO por administración.",
            asistente: {
              idReserva: rowData[idIndex],
              nombres: rowData[headers.indexOf("Nombres y Apellidos")],
              cmp: rowData[cmpIndex]
            }
          });
        }

        const estadoAcomp = estadoAcompIndex !== -1 ? rowData[estadoAcompIndex] : "Pendiente";
        if ((estadoAcomp === "Ingresó" || estadoAcomp === "Asistió") && validador !== "Admin Manual") {
          return jsonResponse({
            success: true,
            estado: "YA_INGRESADO",
            esAcompanante: true,
            mensaje: "¡ALERTA! El boleto de Acompañante YA FUE VALIDADO previamente.",
            fechaPrimerIngreso: fechaIngresoAcompIndex !== -1 ? rowData[fechaIngresoAcompIndex] : "",
            validadoPor: validadorAcompIndex !== -1 ? rowData[validadorAcompIndex] : "",
            asistente: {
              idReserva: rowData[idIndex],
              nombres: rowData[headers.indexOf("Nombres y Apellidos")],
              cmp: rowData[cmpIndex]
            }
          });
        }

        if (estadoAcompIndex !== -1) sheet.getRange(filaIndex, estadoAcompIndex + 1).setValue("Ingresó");
        if (fechaIngresoAcompIndex !== -1) sheet.getRange(filaIndex, fechaIngresoAcompIndex + 1).setValue(horaIngreso);
        if (validadorAcompIndex !== -1) sheet.getRange(filaIndex, validadorAcompIndex + 1).setValue(validador);

        return jsonResponse({
          success: true,
          estado: "VALIDO",
          esAcompanante: true,
          mensaje: "¡Ingreso de Acompañante autorizado con éxito!",
          horaIngreso: horaIngreso,
          asistente: {
            idReserva: rowData[idIndex],
            nombres: rowData[headers.indexOf("Nombres y Apellidos")],
            cmp: rowData[cmpIndex],
            horaIngreso: horaIngreso
          }
        });
      }

      // Validar titular
      const estadoActual = rowData[estadoIndex];
      if ((estadoActual === "Ingresó" || estadoActual === "Asistió") && validador !== "Admin Manual") {
        return jsonResponse({
          success: true,
          estado: "YA_INGRESADO",
          esAcompanante: false,
          mensaje: "¡ALERTA! Este boleto Titular YA FUE VALIDADO previamente.",
          fechaPrimerIngreso: rowData[fechaIngresoIndex],
          validadoPor: rowData[validadorIndex],
          asistente: {
            idReserva: rowData[idIndex],
            nombres: rowData[headers.indexOf("Nombres y Apellidos")],
            cmp: rowData[cmpIndex]
          }
        });
      }
      
      // Registrar ingreso titular
      sheet.getRange(filaIndex, estadoIndex + 1).setValue("Ingresó");
      sheet.getRange(filaIndex, fechaIngresoIndex + 1).setValue(horaIngreso);
      sheet.getRange(filaIndex, validadorIndex + 1).setValue(validador);
      
      return jsonResponse({
        success: true,
        estado: "VALIDO",
        esAcompanante: false,
        mensaje: "¡Ingreso Titular autorizado con éxito!",
        horaIngreso: horaIngreso,
        asistente: {
          idReserva: rowData[idIndex],
          nombres: rowData[headers.indexOf("Nombres y Apellidos")],
          cmp: rowData[cmpIndex],
          horaIngreso: horaIngreso
        }
      });
    }
    
    // =========================================================================
    // ACCIÓN 3: RESTABLECER ASISTENCIA A PENDIENTE (ADMIN)
    // =========================================================================
    if (action === "reiniciarAsistencia") {
      const codigo = String(body.codigo || body.idReserva || "").trim();
      const tipo = body.tipo || body.objetivo || "ambos"; // "titular", "acompanante", "ambos"
      
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const rows = data.slice(1);
      
      const idIndex = headers.indexOf("ID Reserva");
      const cmpIndex = headers.indexOf("N° CMP");
      const qrTitIndex = headers.indexOf("Código QR Titular") !== -1 ? headers.indexOf("Código QR Titular") : headers.indexOf("Código QR / Hash");
      const qrAcompIndex = headers.indexOf("Código QR Acompañante");
      
      const estadoIndex = headers.indexOf("Estado Asistencia");
      const fechaIngresoIndex = headers.indexOf("Fecha y Hora Ingreso");
      const validadorIndex = headers.indexOf("Validado Por");
      
      const estadoAcompIndex = headers.indexOf("Estado Asistencia Acompañante");
      const fechaIngresoAcompIndex = headers.indexOf("Fecha y Hora Ingreso Acompañante");
      const validadorAcompIndex = headers.indexOf("Validado Por Acompañante");
      
      const cleanQuery = codigo.toLowerCase();
      const cleanNum = cleanQuery.replace(/^0+/, "") || cleanQuery;
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowId = String(row[idIndex] || "").trim().toLowerCase();
        const rowCmp = String(row[cmpIndex] || "").trim().toLowerCase();
        const cleanRowCmp = rowCmp.replace(/^0+/, "") || rowCmp;
        const rowQrTit = qrTitIndex !== -1 ? String(row[qrTitIndex] || "").trim().toLowerCase() : "";
        const rowQrAcomp = qrAcompIndex !== -1 ? String(row[qrAcompIndex] || "").trim().toLowerCase() : "";
        
        if (
          rowId === cleanQuery ||
          rowCmp === cleanQuery ||
          cleanRowCmp === cleanNum ||
          (rowQrTit && rowQrTit === cleanQuery) ||
          (rowQrAcomp && rowQrAcomp === cleanQuery) ||
          rowId + "-acomp1" === cleanQuery ||
          rowId + "-acomp" === cleanQuery ||
          cleanQuery.startsWith(rowId)
        ) {
          const fila = i + 2;
          
          if (tipo === "ambos" || tipo === "titular") {
            if (estadoIndex !== -1) sheet.getRange(fila, estadoIndex + 1).setValue("Pendiente");
            if (fechaIngresoIndex !== -1) sheet.getRange(fila, fechaIngresoIndex + 1).setValue("");
            if (validadorIndex !== -1) sheet.getRange(fila, validadorIndex + 1).setValue("");
          }
          
          if (tipo === "ambos" || tipo === "acompanante") {
            if (estadoAcompIndex !== -1) sheet.getRange(fila, estadoAcompIndex + 1).setValue("Pendiente");
            if (fechaIngresoAcompIndex !== -1) sheet.getRange(fila, fechaIngresoAcompIndex + 1).setValue("");
            if (validadorAcompIndex !== -1) sheet.getRange(fila, validadorAcompIndex + 1).setValue("");
          }
          
          return jsonResponse({
            success: true,
            mensaje: `Estado de asistencia (${tipo}) restablecido a Pendiente exitosamente.`
          });
        }
      }
      return jsonResponse({ success: false, mensaje: "Registro no encontrado." });
    }

    // =========================================================================
    // ACCIÓN 4: ELIMINAR REGISTRO DE ASISTENTE EN GOOGLE SHEETS
    // =========================================================================
    if (action === "eliminarAsistente" || action === "eliminar") {
      const idReserva = String(body.idReserva || body.codigo || "").trim();
      const cmp = String(body.cmp || "").trim();
      
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const rows = data.slice(1);
      
      const idIndex = headers.indexOf("ID Reserva");
      const cmpIndex = headers.indexOf("N° CMP");
      
      let filaEliminar = -1;
      for (let i = 0; i < rows.length; i++) {
        const matchId = idReserva && String(rows[i][idIndex]).trim() === idReserva;
        const matchCmp = cmp && String(rows[i][cmpIndex]).trim() === cmp;
        if (matchId || matchCmp) {
          filaEliminar = i + 2;
          break;
        }
      }
      
      if (filaEliminar !== -1) {
        sheet.deleteRow(filaEliminar);
        return jsonResponse({
          success: true,
          mensaje: "Registro eliminado exitosamente de la hoja de Google Sheets.",
          idReserva: idReserva
        });
      }
      
      return jsonResponse({
        success: false,
        mensaje: "No se encontró el registro para eliminar en Google Sheets."
      });
    }
    
    return jsonResponse({ success: false, mensaje: "Acción no reconocida." });
    
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Función auxiliar para responder JSON con cabeceras CORS
 */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
