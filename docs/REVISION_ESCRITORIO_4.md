# Revisión de escritorio 4 — entrega privada

15 de octubre de 2026. No publicada en GitHub ni en la web.

## Cambios en Windows

- `Instalar_PDF.cmd` copia los archivos verificados a una carpeta de versiones del usuario, crea accesos en escritorio e Inicio y registra PDF como opción en «Abrir con». Incluye el runtime; no requiere instalar Python ni permisos de administrador.
- El icono inicia `pythonw.exe` sin mantener PowerShell abierto. Abrirlo otra vez reutiliza la instancia de esa versión. **Salir de PDF** cierra su proceso; cerrar solo la pestaña no lo detiene.
- «Abrir con → PDF» entrega el archivo elegido al visor. Si está protegido, solicita su contraseña. El instalador no modifica `UserChoice` ni el valor predeterminado de `.pdf`: el usuario decide qué lector usar siempre.
- El visor permanece visible después de preparar la descarga del original. No se modifica ni sobrescribe el archivo seleccionado.
- Se oculta la instalación web en localhost: un icono del navegador con una URL local antigua no puede arrancar el servidor.
- **Inicio → PDF Herramientas → Quitar integración de PDF** retira el registro de «Abrir con». Eliminar los archivos y accesos sigue siendo manual; véase [Instalación](INSTALACION.md).

## Entrega local de documentos

El lanzador lee solo el PDF elegido. Las siguientes aperturas pasan sus bytes por loopback con una clave exclusiva del lanzador, ausente de la página. No se aceptan rutas de archivos del navegador ni subidas con origen de navegador. El visor recibe un identificador aleatorio de un solo uso, sin ruta local. No se escriben copias temporales en disco. La cola expira a los dos minutos, con un máximo conjunto de 100 MB y ocho documentos; la caducidad se revisa aunque no lleguen nuevas peticiones.

El estado local contiene la dirección y clave de control de la instancia, sin documentos, certificados ni contraseñas. No protege frente a otro programa que ya actúe como el mismo usuario. Las solicitudes internas evitan proxies y redirecciones. Véase [Privacidad](PRIVACIDAD.md).

## Comprobaciones

**19 pruebas Python y 26 JavaScript aprobadas en Linux.**

Python comprueba copia verificada, repetición de instalación, actualización sin sobrescribir versiones, conservación de archivos ajenos, rutas con espacios/Unicode, comandos entrecomillados, registro por usuario sin imponer predeterminados, retirada desde versiones antiguas, bloqueo y reutilización del proceso, limpieza del estado, controles de Host/token/origen, cierre y entrega de documentos una sola vez, caducidad y rechazo de rutas/subidas desde el navegador.

JavaScript comprueba apertura desde escritorio al visor, solicitud de contraseña, integridad de los bytes del original, visor tras descargar, entrega caducada, cierre/reintento, ocultación de instalación web local, flujos móviles y regresiones de descargas y seguridad. La firma de prueba usa un certificado ficticio y OpenSSL: no demuestra compatibilidad con el certificado del usuario.

El manejador HTTP se prueba en memoria y la interfaz mediante DOM. No se ha ejecutado navegador gráfico ni Windows. **Falta comprobar en Windows real**: `.cmd`/`pythonw.exe`, accesos directos, menú «Abrir con», elección de lector predeterminado, descarga nativa y cierre/reapertura. El ZIP se verifica con CRC y manifiesto SHA-256.

## Prueba breve en Windows

1. Guarda los resultados y cierra la versión anterior. Extrae todo el ZIP nuevo y ejecuta `Instalar_PDF.cmd`.
2. Abre PDF desde el icono. Cierra cualquier PowerShell previo y comprueba que sigue funcionando. Guarda una marca de agua y un PDF creado con imágenes; abre ambos resultados.
3. Sobre un PDF de prueba, elige **Abrir con → PDF**. Comprueba lectura, zoom y búsqueda. Repite con otro documento.
4. Repite con un PDF protegido cuya contraseña conozcas. Usa copias de prueba si contiene firmas.
5. Pulsa **Salir de PDF**, vuelve a abrir el icono y después otro documento desde Windows.
6. Comprueba la elección de lector predeterminado desde Windows. Para retirar la opción usa **Quitar integración de PDF**.

## Pendiente

- **El error `CERT_INTEGRITY` del certificado de empresa sigue sin resolver.** Esta entrega no incorpora AutoFirma ni anuncia una corrección del caso real. Necesitamos confirmar si ese certificado firma un PDF directamente en AutoFirma. Véase [Decisión de firma](DECISION_FIRMA_AUTOFIRMA.md).
- Mac conserva su lanzador con Terminal. Mac, Android e iOS todavía no tienen integración de «Abrir con»/«Abrir en». Requiere implementación y prueba por plataforma; instalar el icono web no añade esa capacidad.
- No hay instalador firmado, autoarranque ni actualización automática. Continúa siendo una beta privada.

Referencias: [Microsoft: OpenWithProgids](https://learn.microsoft.com/en-us/windows/win32/shell/how-to-include-an-application-on-the-open-with-dialog-box), [registro de aplicaciones](https://learn.microsoft.com/en-us/windows/win32/shell/app-registration) y [Python en Windows](https://docs.python.org/3/using/windows.html).
