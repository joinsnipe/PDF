# Validación de PDF 2.2.0-beta.1

**Entrega actual: PDF 2.3.0-beta.1.** Construcción completa y **96 pruebas JavaScript + 19 pruebas Python aprobadas** en Linux. Incluye protocolo AutoScript oficial con WebSocket simulado, firma ficticia verificada con OpenSSL e interfaz hasta descarga. [Alcance y prueba nativa pendiente](AUTOFIRMA.md). Las secciones siguientes son históricas: no acreditan una ejecución de AutoFirma en Windows/Mac.

**36 pruebas JavaScript y 2 pruebas Python aprobadas en Linux**, tras instalar dependencias en una copia limpia y construir los motores desde el lockfile. Se verificaron operaciones PDF reales, OCR local, firma CMS con OpenSSL, contraseñas con qpdf, bytes de descarga y flujos de UI simulados. No se ha ejecutado un navegador gráfico ni instalado en los cuatro sistemas de destino.

## Cambios comprobados en 2.2

- Compartir entrega el mismo nombre y bytes del PDF generado; cancelar no muestra un error. El botón se oculta si no se admiten archivos.
- Ayuda para Safari/iOS, Android y escritorio. Detección del modo instalado de iOS; cancelación/reintento del prompt nativo y evento appinstalled.
- Controlador Mac en memoria: index y WASM, HEAD sin cuerpo; rechazo de Host ajeno, POST, traversal, rutas malformadas y directorios.
- Construcción con npm ci y las versiones fijadas, incluyendo el módulo de firma compartiendo la instancia de pdf-lib.
- Portada SVG renderizada e inspeccionada como imagen; no es una captura de navegador.
- Empaquetador con hashes de runtimes, CRC del ZIP y permisos ejecutables para Mac. Estas comprobaciones no demuestran ejecución nativa de los runtimes.

El workflow de GitHub debe repetir construcción, pruebas y empaquetado antes de crear una Release. Su resultado concreto puede consultarse en la pestaña Actions del repositorio.

## Matriz manual pendiente

| Plataforma | Abrir/instalar | Marca de agua e imágenes a PDF | Guardar y reabrir | PDF protegido |
| --- | --- | --- | --- | --- |
| Windows 10/11 x64 | Pendiente | Pendiente | Pendiente | Pendiente |
| macOS Apple Silicon | Pendiente | Pendiente | Pendiente | Pendiente |
| macOS Intel | Pendiente | Pendiente | Pendiente | Pendiente |
| Android + Chrome | Pendiente | Pendiente | Pendiente | Pendiente |
| iPhone/iPad + Safari | Pendiente | Pendiente | Pendiente | Pendiente |

En cada equipo: anota versión de sistema y navegador; abre el paquete/icono, procesa un PDF ficticio y dos imágenes, guarda el resultado y vuelve a abrirlo. Repite con un PDF de contraseña conocida y con un ZIP de varias páginas. En móvil prueba Compartir/Archivos y volver a la app. En escritorio comprueba el paquete sin conexión y una ruta de carpeta con espacios. Usa muestras sin datos personales.

Hasta completar esa matriz se mantiene la etiqueta beta. El entorno de trabajo no ofrece la habilidad de navegador requerida por su flujo de publicación; no se sustituyó por un navegador alternativo. Las pruebas DOM no certifican descargas nativas, permisos, ventanas emergentes o diseño final en pantalla.

## Cobertura previa conservada

### Revisión 2.0

Revisión del 14 de octubre de 2026. Algunas marcas técnicas pueden corresponder al siguiente día UTC.

**29 pruebas JavaScript y 2 del lanzador aprobadas**, usando los motores incluidos en la aplicación. Comprobación en Node y Python, sin navegador gráfico ni sistema Windows.

## Descargas y contraseñas

Se reprodujo un enlace de resultado obsoleto durante la reutilización del elemento de descarga en JSDOM. Ahora se crea un enlace nuevo por resultado. Se eliminó la revocación de URL durante `pagehide`, que podía interferir al abrir/guardar. No se afirma que esa sea la única causa del problema observado en el navegador del usuario.

Pruebas de interfaz con DOM simulado: selección -> procesamiento -> enlace blob -> lectura de bytes PDF válidos para marca de agua e imágenes a PDF. ZIP con entradas correctas. Guardar como recibe los mismos bytes. `pagehide` mantiene el enlace disponible. Las 28 herramientas tienen opciones y acción. El visor detecta el marcador de cifrado, solicita contraseña, permite reintentar, elimina la entrada y presenta el resultado. Este último contrato usa un worker simulado; el descifrado real se comprueba por separado con qpdf.

El motor qpdf real cifra con AES-256, rechaza una contraseña incorrecta, descifra con la correcta conservando el texto y reescribe un PDF válido en modo reparación. Esto no prueba la reparación de toda corrupción posible.

## Operaciones PDF

- Rangos vacíos, invertidos, duplicados y fuera de límites.
- Unir, dividir, reordenar, eliminar y girar: orden y texto verificados con PDF.js.
- Optimización estructural y compresión raster: dimensiones, reducción y pérdida esperada de texto seleccionable.
- Marca de agua y numeración: páginas con CropBox y giros 0/90/180/270. En la revisión inicial se renderizaron e inspeccionaron sus cuatro variantes.
- JPG/PNG a PDF y PDF a JPG/PNG: páginas, dimensiones y contenido decodificable.
- Texto extraído y errores claros para escaneados sin texto.
- Metadatos, recorte, cambio de tamaño, texto añadido y firma como imagen.
- Formularios: texto acentuado, casilla, lista, valores guardados; aplanado conserva texto y elimina campos.
- Ocultación: píxel negro en el área, ningún texto extraíble y ausencia de objetos originales en la nueva salida de imágenes.
- Grises: dimensiones y canales iguales.
- Resumen: frases literales con referencias; comparación: multiplicidad de frases.
- Word: ZIP OOXML con contenido escapado y saltos de página. No se abrió Microsoft Word.
- OCR real con modelos locales español/inglés: reconoce el importe 125 en una imagen de prueba, genera PDF buscable y conserva dimensiones. No garantiza exactitud sobre documentos reales.
- Firma real con certificado RSA sintético generado durante el test: OpenSSL verifica CMS sin verificar cadena de confianza; una alteración de bytes invalida la firma. Se rechazan contraseña incorrecta y firma previa. El certificado de prueba no se distribuye en el ZIP.
- Recursos HTML locales y ausencia de ruta de subida en el controlador.

## Lanzador y paquete

El manejador HTTP se ejercita en memoria, sin servidor de previsualización: entrega index y MIME WASM; rechaza Host ajeno, ruta sin token, traversal y POST. El código enlaza únicamente 127.0.0.1 y no implementa subida de archivos. El ZIP incorpora Python oficial para Windows x64, todos los activos, modelos, código fuente de la aplicación y licencias. Su integridad se comprueba con CRC y manifiesto SHA-256.

## Límites de esta validación

No hay verificación del guardado nativo, ventanas emergentes, permisos de descargas, CSP en navegador, render de interfaz móvil/escritorio ni doble clic del lanzador en Windows. La habilidad de navegador exigida por el flujo de Sites no está disponible; se respetó ese límite. JSDOM y Canvas en Node no sustituyen esas pruebas. El aspecto visual final debe confirmarse en el navegador del usuario.

La firma no tiene TSA, consulta de revocación, prueba de confianza de CA ni certificación de validez jurídica. No se han probado todos los tipos de PDF, formularios, certificados o idiomas.

## Actualización pública y Android 2.1

El propietario autorizó expresamente el acceso público; Sites devolvió access_mode public, revisión 2. Icono SVG propio inspeccionado y PNG comprobados (192/512, adaptable 512, favicon 32). Manifiesto y rutas válidos. Seis regresiones de interfaz aprobadas. Comprobaciones adicionales en DOM: ayuda de instalación sin prompt nativo, cancelación del prompt, reintento, appinstalled e IDs únicos. No se repitió la batería de motores PDF, cuyo código no cambió. No se ejecutó navegador por ausencia de control-browser en el entorno administrado; pendiente instalación y descarga real en Android.
