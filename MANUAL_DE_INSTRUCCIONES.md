# 📘 MANUAL OFICIAL DE OPERACIÓN, ADMINISTRACIÓN Y CONTINGENCIAS
## COLEGIO MÉDICO DEL PERÚ — CONSEJO REGIONAL XX PASCO
### Sistema Integral de Registro de Colegiados, Control de Accesos por Código QR y Gestión de Vouchers en la Nube

---

```
========================================================================================
  DOCUMENTO TÉCNICO Y OPERATIVO INSTITUCIONAL
  Evento:        Fiesta de Gala y Confraternidad por el Día de la Medicina Peruana 2026
  Fecha:         Miércoles, 07 de Octubre de 2026 — 07:00 p. m.
  Lugar:         Centro de Convenciones LA KATEDRAL (Pasco, Perú)
  Capacidad:     350 Personas (Aforo Controlado)
  Versión:       3.5 Professional Edition (Dual-Pass Architecture)
========================================================================================
```

---

## 📑 ÍNDICE GENERAL

1. [Visión General y Objetivos del Sistema](#1-visión-general-y-objetivos-del-sistema)
2. [Arquitectura y Flujo Operativo de Datos](#2-arquitectura-y-flujo-operativo-de-datos)
3. [Módulo 1: Inscripción y Validación de Colegiados](#3-módulo-1-inscripción-y-validación-de-colegiados)
4. [Módulo 2: Mi Boleto Digital (Pases Duales Independientes)](#4-módulo-2-mi-boleto-digital-pases-duales-independientes)
5. [Módulo 3: Escáner y Validación de Accesos en Puerta](#5-módulo-3-escáner-y-validación-de-accesos-en-puerta)
6. [Módulo 4: Panel de Administración, Aforo y Auditoría](#6-módulo-4-panel-de-administración-aforo-y-auditoría)
7. [Módulo 5: Configuración y Backend (Google Sheets & Google Drive)](#7-módulo-5-configuración-y-backend-google-sheets--google-drive)
8. [Módulo 6: Ajustes de Seguridad y Parámetros del Evento](#8-módulo-6-ajustes-de-seguridad-y-parámetros-del-evento)
9. [Protocolos de Contingencia y Preguntas Frecuentes (FAQ)](#9-protocolos-de-contingencia-y-preguntas-frecuentes-faq)

---

## 1. VISIÓN GENERAL Y OBJETIVOS DEL SISTEMA

El **Sistema Integral del Colegio Médico del Perú - Consejo Regional XX Pasco** ha sido diseñado con el fin de automatizar, asegurar y transparentar el proceso completo de inscripción, recaudación y control de ingreso para las festividades del Día de la Medicina Peruana.

### 🎯 Objetivos Principales:
- **Exclusividad Institucional:** Garantizar que únicamente los médicos habilitados del Consejo Regional XX Pasco puedan emitir reservas mediante consulta en vivo al padrón oficial de 380 colegiados.
- **Pases Duales e Independientes:** Permitir que el médico titular y su acompañante dispongan de códigos QR separados, posibilitando su ingreso en horarios distintos sin necesidad de llegar juntos.
- **Control Financiero Transparente:** Administrar la tarifa de acompañante (**S/ 20.00 PEN**) con carga digital de comprobantes (vouchers), almacenamiento automático en Google Drive y aprobación previa a la liberación del pase.
- **Control de Aforo y Seguridad en Puerta:** Escaneo óptico de alta velocidad con alertas acústicas y visuales para evitar suplantaciones o reingresos no autorizados (Aforo máximo: 350 personas).
- **Operatividad Offline-First:** Capacidad de operar al 100% en portería aún ante caídas del servicio de internet local, sincronizando los datos en tiempo diferido.

---

## 2. ARQUITECTURA Y FLUJO OPERATIVO DE DATOS

```
                                  [ MÉDICO COLEGIADO ]
                                           │
                                  Ingresa N° de CMP
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼                                     ▼
             [ CMP No Habilitado ]                  [ CMP En Padrón Pasco ]
             🚫 Alerta: Denegado                              │
                                                    Verifica Duplicados
                                                              │
                                       ┌──────────────────────┴──────────────────────┐
                                       ▼                                             ▼
                             [ Ya tiene Reserva ]                          [ Formulario Habilitado ]
                             🎟️ Muestra su Boleto                                    │
                                                                           Selecciona Modalidad
                                                                                     │
                                           ┌─────────────────────────────────────────┴─────────────────────────────────────────┐
                                           ▼                                                                                    ▼
                                [ Solo Médico Titular ]                                                            [ Titular + 1 Acompañante ]
                                   (100% Gratuito)                                                                   (Abono S/ 20.00 vía Yape)
                                           │                                                                                    │
                                           │                                                                           Sube Voucher + Operación
                                           │                                                                                    │
                                           ▼                                                                                    ▼
                                [ Genera Pase Titular ]                                                            [ Pase Titular Habilitado ]
                                     QR Activo ✅                                                                  [ Pase Acomp. Bloqueado ⏳ ]
                                           │                                                                                    │
                                           │                                                                       [ Panel de Administración ]
                                           │                                                                        Admin valida Voucher y
                                           │                                                                        pulsa "✓ Aprobar Pago"
                                           │                                                                                    │
                                           │                                                                                    ▼
                                           │                                                                       [ Pase Acomp. Desbloqueado ]
                                           │                                                                              QR -ACOMP1 ✅
                                           ▼                                                                                    ▼
                            ╔═══════════════════════════════════════════════════════════════════════════════════════════════════════════╗
                            ║                                    CONTROL DE ACCESOS EN PUERTA                                           ║
                            ║  • Escaneo QR Titular    ➔ Registra Ingreso Titular ✅                                                     ║
                            ║  • Escaneo QR Acompañante ➔ Registra Ingreso Acompañante ✅                                                ║
                            ╚═══════════════════════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 3. MÓDULO 1: INSCRIPCIÓN Y VALIDACIÓN DE COLEGIADOS

### 3.1. Validación contra el Padrón Oficial
1. El colegiado se sitúa en la pestaña **«Inscripción»**.
2. Ingresa su **Número de CMP** en la casilla correspondiente.
3. El sistema busca de manera instantánea en la base de datos de Pasco (380 agremiados):
   - **Caso A (Habilitado):** Se autocompleta el nombre oficial del médico, su especialidad y se desbloquea el resto del formulario.
   - **Caso B (No registrado en Pasco):** Se muestra un banner rojo indicando: *«El número de CMP no pertenece a los agremiados habilitados del Consejo Regional Pasco»*.
   - **Caso C (Control Antiduplicados):** Si el CMP ya fue registrado previamente en el sistema, los campos se bloquean y aparece el botón destacado **`🎟️ Ver mi Boleto Actual`**, impidiendo reservas duplicadas.

### 3.2. Modalidades de Entrada
- **Pase Individual (Solo Médico Titular):**
  - Costo: **S/ 0.00 (Gratuito)**.
  - Al hacer clic en **«Confirmar Reserva Gratuita»**, el sistema genera el boleto de inmediato.
- **Pase Doble (Médico + 1 Acompañante):**
  - Costo de Acompañante: **S/ 20.00 PEN**.
  - Se habilitan los campos para registrar el nombre completo del acompañante.
  - **Instrucciones de Pago en Pantalla:**
    - Destinatario oficial: **Colegio Médico del Perú - CR XX Pasco**.
    - Número de Yape / Transferencia: **`915 059 045`** (con botón de copia rápida).
    - El médico debe ingresar el **N° de Operación Bancaria** y subir la **imagen del voucher** (formato JPG, PNG o captura de pantalla).

---

## 4. MÓDULO 2: MI BOLETO DIGITAL (PASES DUALES INDEPENDIENTES)

El módulo **«Mi Boleto»** presenta la credencial electrónica oficial para el ingreso al evento.

> [!IMPORTANT]
> **Acceso Protegido con Usuario y Contraseña:**
> Por seguridad y privacidad institucional, el ingreso a la pestaña **«Mi Boleto»** requiere autenticación mediante credenciales oficiales:
> - **Directiva / Administrador:** Usuario `admin` | Contraseña `cmp2026`
> - **Personal de Staff:** Usuario `staff` | Contraseña `staff2026`
> - **Médico Colegiado Registrado:** Usuario `N° CMP` | Contraseña `N° CMP` (o su N° de celular registrado).

```
┌───────────────────────────────────────────────────────────────────────────┐
│              COLEGIO MÉDICO DEL PERÚ — CONSEJO REGIONAL XX                │
│                                                                           │
│    [ 🎟️ PASE TITULAR (Activo) ]     [ 👥 PASE ACOMPAÑANTE (Desbloqueado) ]  │
│                                                                           │
│    Dr. PONCE PIO GABRIELA LORENA                CMP: 121642               │
│    DNI: 73204910                                Especialidad: Cirugía     │
│    ┌─────────────────────────┐                                            │
│    │                         │   Código de Seguridad:                     │
│    │       CÓDIGO QR         │   CMP-20261007-1001-121642                 │
│    │       EN ALTA           │                                            │
│    │      DEFINICIÓN         │   Estado:                                  │
│    │                         │   ✅ INGRESO HABILITADO                    │
│    └─────────────────────────┘                                            │
│    📅 Miércoles, 07 de Octubre de 2026 | 07:00 PM | LA KATEDRAL           │
│                                                                           │
│    [ 📥 Descargar PNG ]  [ 📄 Descargar PDF ]  [ 💬 Enviar WhatsApp ]     │
└───────────────────────────────────────────────────────────────────────────┘
```

### 4.1. Selector de Pases Duales
- **Pestaña «Pase Titular»:**
  - Contiene el código QR titular con hash único: `CMP-AAAAMMDD-XXXX-CMP`.
  - Habilitado desde el primer instante.
- **Pestaña «Pase Acompañante»:**
  - **Estado Pendiente (Bloqueado):** Si el pago de S/ 20.00 aún no ha sido aprobado por administración, el código QR permanece oculto tras un aviso informativo de validación con botón de consulta directa por WhatsApp.
  - **Estado Aprobado (Desbloqueado):** Muestra el código QR individual terminado en `-ACOMP1` para uso exclusivo del acompañante.

### 4.2. Herramientas de Exportación y Consulta
- **Descargar PNG:** Genera una imagen optimizada para almacenar en la galería de fotos del smartphone.
- **Descargar PDF:** Genera un carnet formal en tamaño A4 listo para impresión física.
- **Compartir por WhatsApp:** Abre WhatsApp con el mensaje formal de confirmación, enlace directo para abrir/descargar la **imagen del código QR** en alta resolución, enlace directo al **Pase Digital en línea**, y copia automáticamente la tarjeta del boleto al portapapeles (para pegar la imagen con `Ctrl + V` en WhatsApp Web).
- **Compartir Nativo / Móvil:** Envía directamente la imagen PNG oficial con el QR adjunto a WhatsApp o redes sociales en dispositivos móviles.
- **Buscador de Boletos:** Si un médico extravía su enlace, puede ingresar a la pestaña «Mi Boleto», escribir su número de CMP y recuperar su pase en cualquier momento.

---

## 5. MÓDULO 3: ESCÁNER Y VALIDACIÓN DE ACCESOS EN PUERTA

El módulo de **Validación QR** está diseñado para ser operado por el personal de portería y control de accesos.

### 5.1. Operación del Escáner
1. Abrir la pestaña **«Validación QR»** en cualquier dispositivo (celular Android/iOS, tablet o laptop con webcam o pistola lectora USB 2D).
2. Seleccionar la cámara frontal o trasera.
3. Apuntar al código QR del asistente. El sistema detecta automáticamente si se trata del **Pase Titular** o del **Pase Acompañante**.

### 5.2. Tabla de Diagnósticos y Alertas del Sistema:

| Estado en Pantalla | Diagnóstico del Sistema | Señal Acústica | Acción en Puerta |
|---|---|---|---|
| **🟢 INGRESO AUTORIZADO** | Código válido, habilitado y sin ingreso previo. | Tono agudo de éxito (Beep) + Confetti | **Permitir ingreso.** Registra la hora exacta y el operador. |
| **🟡 YA VALIDADO** | El pase ya fue registrado previamente en puerta. | Doble tono de advertencia | **Revisar.** Muestra en pantalla la hora exacta en que ya ingresó. |
| **🔴 PAGO PENDIENTE** | Pase de acompañante cuyo abono de S/ 20.00 no ha sido aprobado. | Tono grave de error | **Denegar ingreso.** Derivar a la mesa de Tesorería para verificar el voucher. |
| **⚪ NO ENCONTRADO** | Código QR alterado o inexistente en la base de datos. | Tono grave de error | **Denegar ingreso.** Pase no reconocido. |

---

## 6. MÓDULO 4: PANEL DE ADMINISTRACIÓN, AFORO Y AUDITORÍA

Acceso restringido para la Directiva y Comisión Organizadora:
- **Usuario:** `admin`
- **Contraseña:** `cmp2026`

### 6.1. Panel de Métricas KPI en Tiempo Real
- **Total Inscritos:** Conteo acumulado de médicos registrados.
- **Asistieron / Ingresaron:** Conteo discriminado de médicos titulares y acompañantes que ingresaron por puerta.
- **Pendientes:** Personas por ingresar.
- **Termómetro de Aforo:** Barra de progreso porcentual respecto a la capacidad de 350 personas del local C.C. La Katedral.
- **Total Recaudado:** Suma monetaria efectiva de los acompañantes validados (S/ 20.00 c/u).

### 6.2. Funciones de Gestión en la Tabla
1. **Inspección de Vouchers (`👁️ Ver Voucher`):**
   - Despliega un modal con la captura del comprobante en tamaño completo, N° de operación y monto.
2. **Aprobación de Pagos (`✓ Aprobar`):**
   - Valida el abono de S/ 20.00, actualiza la base de datos en Google Sheets y **desbloquea inmediatamente el QR del acompañante**.
3. **Envío de Pase por WhatsApp (`💬`):**
   - Permite enviar el código QR del acompañante al WhatsApp del médico colegiado en un solo clic.
4. **Validación / Restablecimiento Manual (`✓` / `👥`):**
   - Permite marcar o desmarcar la asistencia en casos donde el médico no porte su celular físico.
5. **Eliminación Permanente Sincronizada (`🗑️`):**
   - Elimina el registro del aplicativo y ejecuta la solicitud hacia la API de Google Apps Script para **eliminar físicamente la fila en Google Sheets**.
6. **Exportar a Excel Oficial (`📊`):**
   - Descarga un archivo `.xlsx` estructurado con 22 columnas de auditoría detallada.
7. **Exportar Reporte Ejecutivo en PDF (`📄`):**
   - Genera un documento ejecutivo en formato A4 con membrete del CMP Pasco, 3 gráficos vectoriales en donut chart, métricas de recaudación, tabla de asistentes y casilleros de firmas oficiales para el Decano y la Comisión.

---

## 7. MÓDULO 5: CONFIGURACIÓN Y BACKEND (GOOGLE SHEETS & DRIVE)

El backend opera sobre la infraestructura gratuita y segura de **Google Workspace**.

### 7.1. Parámetros de Conexión Activos
- **URL Oficial de la Aplicación Web (Apps Script):**
  ```text
  https://script.google.com/macros/s/AKfycbxR2dFErigvIcquLoAUZF4WhY2TUs6AJqFReXAKKvTIckBdfTSB1s1O_PrmtChnF8wI/exec
  ```
- **Carpeta de Google Drive para Vouchers:**
  - Nombre: **`Vouchers Evento CMP Pasco 2026`** *(se crea automáticamente al recibir el primer comprobante)*.

### 7.2. Estructura de Columnas en Google Sheets
La hoja de cálculo debe contener exactamente las siguientes cabeceras en la Fila 1:

| Col | Encabezado | Descripción |
|---|---|---|
| A | `ID Reserva` | Identificador único (ej. `CMP-20261007-1001`) |
| B | `Fecha y Hora Registro` | Timestamp de inscripción |
| C | `N° CMP` | Número de colegiatura del titular |
| D | `DNI` | Documento de identidad |
| E | `Nombres y Apellidos` | Nombre oficial extraído del padrón |
| F | `Especialidad / Cargo` | Especialidad médica |
| G | `Celular / WhatsApp` | Contacto telefónico |
| H | `Correo Electrónico` | Correo de confirmación |
| I | `N° Acompañantes` | `0` (Solo titular) o `1` (Con acompañante) |
| J | `Nombres Acompañantes` | Nombre del invitado |
| K | `Monto Abonado` | `0` o `20` |
| L | `Medio de Pago` | Yape / Transferencia / Gratuito |
| M | `N° Operación` | Número de transacción bancaria |
| N | `Enlace Voucher Drive` | URL directa a la imagen guardada en Google Drive |
| O | `Estado Pago` | `Gratuito`, `Pendiente` o `Aprobado` |
| P | `Estado Asistencia` | `Pendiente` o `Ingresó` (Titular) |
| Q | `Fecha y Hora Ingreso` | Timestamp de validación del titular |
| R | `Validado Por` | Nombre del operador o escáner |
| S | `Estado Asistencia Acompañante` | `Pendiente`, `Ingresó` o `No aplica` |
| T | `Fecha y Hora Ingreso Acompañante`| Timestamp de validación del invitado |
| U | `Validado Por Acompañante` | Nombre del operador de acompañante |
| V | `Código QR / Hash` | Hash del QR del titular |
| W | `Código QR Acompañante` | Hash del QR del acompañante (`...-ACOMP1`) |

### 7.3. Pasos para Implementar o Reimplementar el Script en Google Sheets
1. Abrir la hoja de cálculo en Google Sheets.
2. Ir al menú superior: **Extensiones ➔ Apps Script**.
3. Pegar el código del backend (`google_apps_script.js`).
4. Clic en **Implementar ➔ Nueva implementación**.
5. Seleccionar tipo: **Aplicación Web**.
   - Ejecutar como: **Yo (tu correo de Google)**.
   - Quién tiene acceso: **Cualquier persona (Anyone)**.
6. Copiar la URL web generada y pegarla en la pestaña **⚙️ Ajustes** del aplicativo web.

---

## 8. MÓDULO 6: AJUSTES DE SEGURIDAD Y PARÁMETROS DEL EVENTO

En la pestaña **«Ajustes»** del sistema se pueden configurar los siguientes valores:
- **Seguridad de Acceso:** Modificación del usuario y clave administrativa.
- **Datos del Evento:** Edición del título, fecha, hora, lugar y límite de aforo reglamentario (350 personas).
- **Mantenimiento Local:** Botones para vaciar la memoria caché, reiniciar la base de datos o forzar la descarga de datos desde Google Sheets.

---

## 9. PROTOCOLOS DE CONTINGENCIA Y PREGUNTAS FRECUENTES (FAQ)

### 🚨 Protocolo 1: ¿Qué hacer si se corta la conexión a internet en la puerta del evento?
- **Respuesta:** El sistema continúa funcionando con normalidad gracias a su tecnología **Offline-First**. El escáner valida los accesos contra la memoria local del navegador. Al restablecerse la señal de internet, el administrador debe presionar **«Sincronizar Sheets»** para enviar todos los ingresos a la nube.

### 🚨 Protocolo 2: ¿Qué hacer si el médico colegiado olvidó su teléfono o se quedó sin batería?
- **Respuesta:** El personal de puerta debe ingresar a la pestaña **«Administración»**, buscar el apellido o número de CMP del médico en la barra de búsqueda y hacer clic en el botón verde **`✓` (Validar Manual)**.

### 🚨 Protocolo 3: ¿Un acompañante puede ingresar antes que el médico titular?
- **Respuesta:** **Sí.** Los códigos QR son independientes. Si el pago de S/ 20.00 está aprobado, el acompañante puede presentar su pase (`...-ACOMP1`) y acceder sin requerir la presencia simultánea del titular.

### 🚨 Protocolo 4: ¿Cómo regularizar un pago realizado a última hora en la puerta?
- **Respuesta:**
  1. El colegiado muestra la constancia de Yape al personal de administración.
  2. El administrador ingresa al panel, ubica el registro y presiona **`✓ Aprobar`**.
  3. El pase del acompañante queda desbloqueado en el acto y el escáner de portería autorizará su acceso inmediatamente.

---

```
========================================================================================
COLEGIO MÉDICO DEL PERÚ — CONSEJO REGIONAL XX PASCO
Documento elaborado y verificado para la Comisión de Eventos y Control de Accesos 2026.
========================================================================================
```
