# 🏛️ Sistema de Reserva y Validación QR para Eventos
### Colegio Médico del Perú - Consejo Regional XX Pasco

Aplicación web responsive completa diseñada para gestionar inscripciones, generar pases digitales oficiales con código QR, validar el ingreso en tiempo real mediante escáner con cámara o búsqueda manual, y sincronizar todo directamente con **Google Sheets (Google Drive)** y exportar a **Excel (.xlsx)**.

---

## 🌟 Características Principales

1. **📱 Formulario de Inscripción / Reserva para Colegiados**:
   - Campos oficiales para médicos: N° CMP, DNI, Nombres completos, Especialidad/Centro de salud, Celular/WhatsApp, Correo, Número de acompañantes y observaciones.
   - Validación automática contra duplicidad de CMP.
   - Efecto visual de confeti y confirmación auditiva al finalizar el registro.

2. **🎟️ Carnet / Pase Digital con Código QR Seguro**:
   - Diseño institucional con el escudo del Colegio Médico y paleta oficial (Azul marino `#003366` y Dorado `#c8963e`).
   - Generación instantánea de código QR criptográfico de alta resolución.
   - Botón para **Descargar Imagen PNG** de alta calidad (3x de resolución).
   - Botón para **Descargar en PDF** formato A5 para impresión.
   - Botón para **Compartir / Enviar por WhatsApp** con mensaje predeterminado.
   - Botón para **Impresión directa**.

3. **📷 Validación en Puerta con Escáner QR**:
   - Lector óptico integrado compatible con la cámara de cualquier celular (cámara trasera automática) o laptop/webcam.
   - Búsqueda manual rápida por CMP, DNI o ID de Boleto para asistentes que no lleven su QR.
   - **Respuestas en tiempo real con alertas sonoras y visuales**:
     - 🟢 **VÁLIDO**: Registra el ingreso inmediatamente y guarda la fecha/hora exacta.
     - 🟡 **DUPLICADO / YA INGRESADO**: Advierte que el boleto ya fue usado y muestra la hora del primer ingreso.
     - 🔴 **INVÁLIDO / NO ENCONTRADO**: Notifica que el código no existe en el sistema.

4. **📊 Panel de Asistencia & Exportación a Excel**:
   - Indicadores KPI en tiempo real: Total Inscritos, Total que Ingresaron, Pendientes y % de Asistencia.
   - Barra de control de aforo del auditorio/local.
   - Tabla interactiva con buscador en vivo y filtros (*Todos*, *Asistieron*, *Pendientes*).
   - Botón para **Exportar a Excel (.xlsx)** con un solo clic (usando SheetJS).
   - Acciones administrativas para ver pase QR, cambiar estado manualmente o eliminar registros.

5. **☁️ Integración Directa con Google Sheets / Google Drive**:
   - Backend ligero en **Google Apps Script** (gratuito, sin servidores de pago).
   - Sincronización automática de nuevas inscripciones y validaciones en tu hoja de Google Drive.
   - Modo de respaldo local (*LocalStorage*) para funcionar incluso si no hay conexión a internet.

---

## 📁 Estructura del Proyecto

```
COLEGIO_EVENTO/
├── index.html                           # Vista principal responsive (Single Page App)
├── css/
│   └── styles.css                       # Estilos institucionales, carnets y animaciones
├── js/
│   ├── config.js                        # Parámetros del evento y storage
│   ├── storage.js                       # Base de datos local y persistencia
│   ├── sheetsService.js                 # Conector API con Google Apps Script
│   ├── qrManager.js                     # Generador QR, tickets, PDF, PNG y audio
│   ├── scanner.js                       # Escáner de cámara y validación en puerta
│   ├── registro.js                      # Validador de formulario y emisión de pases
│   ├── admin.js                         # Estadísticas, aforo y exportación Excel
│   └── app.js                           # Enrutador de pestañas y notificaciones
├── google-sheets/
│   ├── CodigoAppsScript.gs              # Código listo para pegar en Google Apps Script
│   └── INSTRUCCIONES_GOOGLE_DRIVE.md    # Tutorial paso a paso para Google Drive
└── README.md                            # Documentación del sistema
```

---

## 🚀 Cómo Usar el Sistema

### 1. Uso Inmediato (Local / Offline)
Simplemente haz doble clic en el archivo `index.html` para abrirlo en cualquier navegador web (Chrome, Edge, Safari, Firefox). La aplicación funcionará inmediatamente en modo local.

### 2. Vincular con tu Google Drive (Recomendado)
Para que los datos se guarden en tu propia hoja de cálculo de Google Sheets:
1. Sigue las instrucciones detalladas en [`INSTRUCCIONES_GOOGLE_DRIVE.md`](file:///d:/c/Documents/2024/2026/soft/sci/COLEGIO_EVENTO/google-sheets/INSTRUCCIONES_GOOGLE_DRIVE.md).
2. Pega la URL de tu Apps Script en la pestaña **⚙️ Ajustes** del aplicativo.

---

## 🌐 Publicación en la Web (Opcional)
Puedes subir esta carpeta a cualquier servicio de hosting gratuito:
- **GitHub Pages** (Gratis)
- **Vercel** o **Netlify** (Gratis)
- **Hostinger / cPanel / Servidor institucional**
