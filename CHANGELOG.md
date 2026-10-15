# Historial de cambios

## 2.4.0-beta.2

Configuración de IA independiente, conexión con modelo automático, guía para conseguir API y alternativa local visible. La clave permanece solo en memoria de la pestaña y se puede olvidar. Icono de Windows con siete tamaños, rutas entrecomilladas y aviso de actualización de accesos directos. [Detalle](docs/releases/v2.4.0-beta.2.md).

## 2.4.0-beta.1

IA opcional con clave propia de Gemini, OpenAI, Claude, Grok y Mistral, revisión previa del texto y citas por página. Word editable con tablas sencillas o modo visual. Office a PDF con LibreOffice en escritorio. «Añadir firma a mano» pasa a «Firma y seguridad». [Detalle y límites](docs/releases/v2.4.0-beta.1.md).

# Cambios

## 2.3.0-beta.4

- Nombre PDF Contigo, con la misma identidad blanca y roja y las mismas rutas.
- Miniaturas, selección visual, giro previo y visor del resultado en el flujo de las 28 herramientas.
- Paginación de miniaturas, actualización al reordenar archivos y visor ajustado al ancho.
- Aprobación o certificación sin cambios (DocMDP P=1), con detección de firmas y bloqueo de edición.
- Apariencia compacta de firma, ajuste de texto y comprobación de recuadros demasiado pequeños.
- El usuario confirma firma nativa en Windows con beta 3. Los modos y apariencia nuevos requieren validación nativa.

## 2.3.0-beta.3

- Corregido un falso `AF_COMPONENT_BLOCKED`: scripts ajenos bloqueados o políticas informativas ya no invalidan un conector disponible.
- Errores específicos para archivo oficial bloqueado, marco bloqueado, origen inaccesible e inicialización.
- Los bloqueos reales continúan deteniendo la operación; se conserva la CSP restringida y el cliente oficial sin modificar.
- Cinco regresiones nuevas. Firma nativa pendiente de validación en Windows/Mac.

## 2.3.0-beta.2

- Conector AutoFirma precargado, disponibilidad explícita y errores de carga separados.
- Apertura mediante un clic nuevo cuando el navegador ha perdido la activación.
- Ayuda para el permiso de red local; cancelación y reintentos sin reutilizar una operación.
- Web y paquetes actualizados; seis regresiones nuevas, 102 pruebas JavaScript y 19 Python.
- La firma nativa completa sigue pendiente de comprobación en Windows/Mac.

## 2.3.0-beta.1

- AutoFirma como vía principal de firma en Windows y Mac: certificado instalado y selección de marca visible en la aplicación nativa.
- Descarga del PDF devuelto sin reescribir sus bytes; cancelación y errores de conexión diferenciados.
- Instalación Windows por usuario, accesos sin consola, cierre explícito y opción Abrir con PDF.
- Correcciones del visor, contraseñas PDF, metadatos y compatibilidad del método P12 alternativo; el certificado real no se considera corregido por ese método.
- Componente AutoScript oficial fijado, fuente y licencias incluidas. Pruebas nativas en dispositivos reales pendientes.

## 2.2.0-beta.1

- Código público con licencia MIT, portada y documentación en español.
- Guías Windows, Mac Apple Silicon/Intel, Android e iOS/iPadOS.
- Compartir archivos con el menú nativo cuando esté disponible.
- Detección de instalación en iOS y ayuda de instalación móvil/escritorio.
- Lanzador Mac y paquetes con runtimes verificados y licencias.
- Construcción con lockfile, GitHub Actions y Releases con SHA-256.
- Beta hasta validar instalación y descarga en dispositivos reales.

## 2.1.0

- Web pública, instalación web Android, iconos y adaptación móvil.

## 2.0.0

- 28 herramientas, OCR, formularios y firma RSA P12/PFX.
- Apertura con contraseña conocida en visor y desbloqueo.
- Revisión de enlaces, Guardar como y apertura alternativa.
- Paquete local Windows con runtime y motores incluidos.
