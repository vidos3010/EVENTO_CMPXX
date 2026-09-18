# 📘 Guía de Conexión con Google Sheets y Google Drive
### Colegio Médico del Perú - Consejo Regional XX Pasco

Este sistema permite que **cada registro de inscripción y validación de QR se guarde automáticamente en una hoja de cálculo en tu Google Drive**, sin costo de servidores ni bases de datos complejas.

---

## 🚀 Pasos para vincular tu Google Sheets (En solo 3 minutos)

### Paso 1: Crear la Hoja de Google Sheets
1. Entra a tu [Google Drive](https://drive.google.com/) con tu cuenta de Google o institucional del Colegio Médico.
2. Haz clic en **Nuevo (+)** ➜ **Hojas de cálculo de Google** ➜ **Hoja de cálculo en blanco**.
3. Ponle un nombre arriba a la izquierda, por ejemplo:
   `EVENTO_CMP_PASCO_2026_ASISTENCIA`

---

### Paso 2: Pegar el Código en Apps Script
1. En el menú superior de la hoja de cálculo, haz clic en:
   **Extensiones** ➜ **Apps Script**
2. Se abrirá una pestaña con el editor de código.
3. Borra todo el código que aparezca en el editor (`function myFunction() { ... }`).
4. Abre el archivo [`CodigoAppsScript.gs`](file:///d:/c/Documents/2024/2026/soft/sci/COLEGIO_EVENTO/google-sheets/CodigoAppsScript.gs), copia **TODO el contenido** y pégalo en el editor de Apps Script.
5. Haz clic en el ícono de **Guardar** (el disquete 💾) o presiona `Ctrl + S`.

---

### Paso 3: Publicar como Aplicación Web (¡Paso Clave!)
1. En la parte superior derecha de Apps Script, haz clic en el botón azul **Implementar** ➜ **Nueva implementación**.
2. Al lado de "Seleccionar tipo", haz clic en el ícono de engranaje ⚙️ y elige **Aplicación web**.
3. Rellena los siguientes campos:
   - **Descripción**: `API Evento CMP Pasco`
   - **Ejecutar como**: `Yo (tu correo de Google)`
   - **Quién tiene acceso**: `Cualquier persona` (*Anyone*)  
     *(⚠️ Es vital seleccionar "Cualquier persona" para que el formulario web de reserva pueda enviar los datos sin pedir login de Google).*
4. Haz clic en el botón azul **Implementar**.
5. Google te pedirá autorizar permisos:
   - Haz clic en **Autorizar acceso**.
   - Selecciona tu cuenta de Google.
   - Si sale una pantalla de "Google no ha verificado esta app", haz clic en **Avanzado** (abajo) y luego en **Ir a Proyecto (no seguro)**.
   - Haz clic en **Permitir**.
6. Te aparecerá una ventana con la **URL de la aplicación web** (termina en `/exec`).
7. Haz clic en **Copiar** para copiar esa URL.

---

### Paso 4: Conectar la URL en el Aplicativo Web
1. Abre tu aplicativo web (`index.html`) en el navegador.
2. Dirígete a la pestaña **⚙️ Configuración**.
3. En el campo **"URL de Google Apps Script Web App"**, pega la URL que copiaste.
4. Haz clic en el botón **"Probar Conexión"**. Si todo está bien, saldrá un mensaje verde confirmando la conexión.
5. Haz clic en **"Guardar Configuración"**.

---

## 🎯 ¿Qué sucede automáticamente a partir de aquí?

1. **Al Inscribirse**:
   - El colegiado llena el formulario y presiona "Confirmar Reserva".
   - Al instante se crea una fila en tu Google Sheet con todos los datos (CMP, DNI, Médico, Celular, QR Hash, Estado: "Pendiente").
   - El usuario recibe su carnet/pase con QR y opciones para descargarlo o enviarlo a WhatsApp.

2. **Al Validar el Ingreso en la Puerta del Evento**:
   - El encargado escanea el código QR con la cámara de su celular o laptop.
   - El sistema actualiza en tiempo real la celda de **Estado Asistencia** a `Ingresó` y anota la **Fecha y Hora de Ingreso**.
   - Si una persona intenta ingresar 2 veces con el mismo QR, la pantalla se pondrá en amarillo y mostrará una **Alerta de Entrada Ya Utilizada** con la hora exacta del primer ingreso.

3. **Exportación a Excel**:
   - En la pestaña **Panel de Asistencia**, puedes descargar la lista completa en formato `.xlsx` (Excel) con un solo clic en cualquier momento, incluso sin internet.
