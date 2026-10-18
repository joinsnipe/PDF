# 2.4.0-beta.10 — 18 de octubre de 2026

- API recordada por dispositivo, cifrada con contraseña, con desbloqueo local y borrado explícito. Persistencia de escritorio independiente del puerto y carpeta de versión.
- Informe adaptado al tipo de documento, citas breves plegadas, varias referencias por punto, cobertura y eliminación de vacíos/duplicados exactos.
- Omisión de puntos con cifras no respaldadas por sus citas. Detección de respuestas truncadas, sin reintentos de pago.
- Selección automática de OpenAI prioriza la familia GPT mini frente al antiguo empate con o-mini; no cambia un modelo ya guardado.
- Documentación de almacenamiento, límites y actualización. GitHub Actions continúa pausado.

# Historial de cambios

## 2.4.0-beta.9

Una sola herramienta «Entender mi PDF» reúne resumen, explicación, peticiones y fechas, sin opciones duplicadas. Referencias por identificadores de fragmentos: las citas y páginas se recuperan del texto original. Una referencia incorrecta no descarta los puntos válidos; el informe se señala como parcial. Si no hay referencias localizables, se indica expresamente y no se muestran afirmaciones sin respaldo. No hay reintentos automáticos. Se aclara la duración de la clave en memoria, también en escritorio. [Detalle y límites](docs/releases/v2.4.0-beta.9.md).

Actions sigue pausado. Compilación, pruebas simuladas y empaquetado locales, sin API real ni artefactos de Actions.

## 2.4.0-beta.8

Indicador visible de IA conectada con punto verde y nombre del proveedor; configuración manual en ámbar. El botón principal guía el resumen: primero prepara y muestra el texto en local, después ofrece enviarlo al proveedor elegido. Se elimina la casilla desactivada que bloqueaba el flujo. El clic explícito de envío confirma una única consulta. Se explican «Resumen», «Qué me piden» y el modo sin IA. [Detalle](docs/releases/v2.4.0-beta.8.md).

## 2.4.0-beta.7

Configuración de IA sin Gemini preseleccionado. Cambiar proveedor conserva la clave pegada, los eventos repetidos no reinician el formulario y un cierre pendiente no vacía una configuración recién abierta. Se distinguen el campo vacío, un formato incompleto y un rechazo real del proveedor. Los formatos reconocibles de claves o modelos de otro proveedor se bloquean antes de enviar; la corrección requiere una elección y un clic explícitos. Google `API_KEY_INVALID` en HTTP 400 se clasifica como autenticación. [Detalle y pruebas](docs/releases/v2.4.0-beta.7.md).

## 2.4.0-beta.6

La IA conecta desde el dispositivo al proveedor elegido. En Windows/Mac se usa exclusivamente el conector del propio equipo. Se retira el relay público: las versiones anteriores deben actualizarse. Se mantienen la revisión del texto, el consentimiento, las citas y la clave solo en memoria. Se añade DeepSeek, su catálogo y salida JSON, sin cambio automático de proveedor. Web/móvil dependen de que el proveedor permita CORS.

Nueva sección «Accesibilidad · lectura cómoda»: texto grande, más contraste y reducción de movimiento, con preferencias locales. Foco visible reforzado, salto al contenido enfocable, progreso etiquetado y texto del visor navegable con teclado. Son mejoras de interfaz, sin certificación WCAG ni PDF/UA. [Alcance](docs/ACCESIBILIDAD.md).

## 2.4.0-beta.5

Corrige la conexión de IA en Cloudflare Workers: usa redirección manual y rechaza destinos alternativos sin reenviar claves. Distingue errores de autenticación, permisos, saldo, cuota y modelo. Añade una prueba en workerd real con proveedor simulado. La configuración de OpenAI explica que su API se factura aparte de ChatGPT.

Actions valida los cambios, pero solo empaqueta versiones nuevas y publica directamente en Releases. No sube artefactos intermedios ni genera cachés npm. Incluye una limpieza limitada al inventario de temporales de PDF del 16 de octubre, comprobando previamente las descargas publicadas. [Detalle técnico y mantenimiento](docs/MANTENIMIENTO-2026-10-16.md).

## 2.4.0-beta.4

Botón Compartir visible arriba a la derecha, en móvil y escritorio. Menú nativo cuando está disponible y alternativa para copiar el enlace público de la app. No comparte documentos ni direcciones locales.

## 2.4.0-beta.3

Elimina el acceso duplicado de configuración de IA con estrella, tanto en móvil como en escritorio. La cabecera mantiene el botón con borde rojo.

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
