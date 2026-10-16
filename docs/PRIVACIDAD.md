# Privacidad

Las herramientas de edición de PDF procesan archivos en la memoria del navegador; la vía AutoFirma de escritorio delega la firma en la aplicación nativa instalada. Estas herramientas locales no envían documentos, certificados ni contraseñas a una API de conversión. La excepción opcional de IA se explica abajo. No incorpora analítica, cuentas, publicidad, historial ni guardado de documentos en almacenamiento web. Motores, fuentes y modelos OCR se sirven junto a la aplicación.

La versión web descarga la aplicación de su alojamiento. El alojamiento recibe solicitudes de recursos y los datos técnicos habituales de conexión, como IP. Esto no equivale a subir el PDF. GitHub aloja el repositorio y las descargas bajo sus propias condiciones.

Las herramientas locales de los paquetes funcionan sin Internet; la IA opcional requiere conexión. Su servidor escucha solo en 127.0.0.1 con puerto y ruta aleatorios. Rechaza otros Host, recorridos fuera de la carpeta y listados. Sirve los recursos de la aplicación. En Windows permite consultar si PDF está abierto, cerrarlo y entregar al visor el documento que has elegido mediante «Abrir con». El cierre exige la ruta de sesión, el origen local, una cabecera específica y una petición sin contenido.

La revisión de escritorio 4 guarda en `%LOCALAPPDATA%\PDF-Herramientas\state` la dirección local de la instancia, una clave aleatoria de comunicación entre lanzadores y un archivo de bloqueo para evitar procesos duplicados. No contienen documentos, contraseñas ni certificados. La dirección se elimina al terminar normalmente; un cierre abrupto puede dejar ese pequeño archivo de estado, que se reemplaza al reiniciar. La app sigue en segundo plano hasta pulsar **Salir de PDF** o cerrar la sesión de Windows. No se inicia automáticamente al encender el equipo.

Al usar «Abrir con» en Windows, el lanzador lee exclusivamente el PDF seleccionado y envía sus bytes al proceso de PDF en el mismo ordenador, nunca a un servicio externo. El servidor no admite rutas de archivos recibidas del navegador. La entrega requiere una clave local que no se proporciona a la página. Solo transmite el nombre del archivo, sin su ruta. El documento pendiente se conserva en memoria hasta que el visor lo recoge una vez, o durante un máximo de dos minutos; límite conjunto de 100 MB y ocho documentos pendientes. Después permanece en el visor mientras lo uses. No se crea una copia temporal en disco.

Cerrar o vaciar una herramienta libera referencias y enlaces; no garantiza borrado físico de memoria. Las descargas quedan donde las guardes y pueden sincronizarse con iCloud/OneDrive si eliges esas carpetas. **Compartir archivo** abre el menú del dispositivo: el destino elegido puede enviar el documento a terceros.

Contraseñas y certificados se usan para la operación actual. No hay recuperación de contraseñas. El visor desactiva la evaluación de scripts de PDF; no es un sanitizador ni un producto auditado de seguridad.

El repositorio y la web públicos no publican los documentos de visitantes. No adjuntes información personal a issues o pull requests: usa muestras ficticias.

## Firma con AutoFirma

Al confirmar una firma, el PDF pasa por una conexión WebSocket cifrada a AutoFirma en `127.0.0.1`, en el mismo ordenador. El componente oficial se carga desde los archivos de PDF, no desde un CDN. No se configuran servidores intermedios, firma trifásica ni servicio de sello de tiempo. Una política CSP limita las conexiones del componente a ese destino local. La app recibe el PDF firmado y lo conserva en memoria hasta que lo guardes o cierres. No recibe el P12, la contraseña ni la clave privada para esta vía. La elección del certificado y cualquier PIN se realizan en AutoFirma. AutoFirma mantiene sus propias preferencias, registros y conexiones de validación; PDF no sustituye su política de privacidad.

## IA opcional con tu propia clave

El modo local sigue disponible sin cuenta. Si seleccionas IA, configuras tu proveedor y clave (con selección automática de modelo por defecto) y revisas exactamente el texto extraído antes de confirmar **cada consulta** mediante el botón «Enviar a tu proveedor y resumir/explicar». Preparar la revisión no hace una petición de IA; el envío requiere un segundo clic explícito. No hay casilla de autorización. PDF Contigo admite Gemini (Google), OpenAI, Claude (Anthropic), Grok (xAI), Mistral y DeepSeek. El archivo PDF, sus imágenes y los certificados no se incluyen en la petición.

Desde **2.4.0-beta.6**, el navegador conecta directamente con el proveedor elegido. En el paquete de escritorio, la petición pasa únicamente por el conector de **tu propio ordenador**, escuchando en `127.0.0.1`, antes de salir por HTTPS al proveedor. No se utiliza un servidor compartido de PDF Contigo. El antiguo endpoint público `/api/ai` está retirado y responde 410 sin leer ni reenviar el cuerpo. Actualiza los paquetes y recarga las pestañas antiguas: las versiones anteriores sí utilizaban ese intermediario.

El sitio web sigue necesitando alojamiento para entregar la aplicación. Su alojamiento puede conservar metadatos de las visitas, pero la nueva ruta de IA no le envía claves ni textos. Las llamadas del navegador omiten cookies y Referer hacia las APIs. No hay base de datos de consultas ni telemetría de contenido en el código. Los conectores locales limitan destinos a los seis proveedores, verifican sesión, origen, cabecera y tamaño, rechazan redirecciones y no registran cuerpos ni credenciales. No son servidores para publicar en Internet.

La clave se conserva solo en la memoria de la pestaña; no se escribe en localStorage, sessionStorage, cookies ni archivos. Se elimina la referencia al desconectar, recargar o salir. Cerrar la configuración vacía el campo; la conexión sigue en memoria hasta uno de esos eventos. Esto no garantiza borrado físico inmediato de memoria. Usa tus claves personales y dispositivos de confianza: cualquier clave introducida en una web puede quedar expuesta ante una página comprometida o una extensión con permisos. No hay claves del proyecto incluidas en la aplicación.

El proveedor recibe el texto revisado y aplica sus propias condiciones de retención, tratamiento, uso y facturación. IA directa no significa IA local ni retención cero por el proveedor. No se envían el PDF completo, sus imágenes o certificados mediante esta función.

«Conectar» consulta el catálogo con tu clave, sin enviar documentos. No comprueba saldo ni permiso de generación. El modelo manual se verifica con la primera consulta autorizada. No se cambia de proveedor ni se reintenta automáticamente. Un error o cancelación no garantiza que no haya consumo. En web/móvil, las políticas de acceso desde navegador (CORS) del proveedor pueden impedir la conexión; el paquete local evita depender de CORS. No se envía la consulta a un proxy compartido para resolverlo.

## Preferencias de lectura

«Lectura cómoda» guarda únicamente tres valores booleanos (texto grande, contraste y movimiento) en `localStorage`, bajo `pdf-contigo-reading-v1`. No contienen documentos, claves ni historial. «Restablecer» los elimina. Si el navegador bloquea el almacenamiento, se aplican solo durante esa visita. En el paquete local, el puerto y origen pueden cambiar al volver a abrirlo; las preferencias no se comparten entre orígenes.

## Office a PDF en escritorio

El navegador envía el archivo seleccionado a su lanzador en `127.0.0.1`, con ruta aleatoria y controles de origen, cabecera y tamaño. El lanzador acepta únicamente DOCX/XLSX/PPTX y rechaza macros, objetos incrustados, vínculos de datos externos y documentos cifrados. Ejecuta LibreOffice instalado en el ordenador, sin shell, con un perfil temporal separado y seguridad de macros alta. No descarga ni instala LibreOffice automáticamente.

La conversión crea copias temporales del archivo, perfil y PDF en una carpeta del usuario. Se eliminan al terminar o en errores controlados; un apagado o cierre abrupto puede dejarlas en la carpeta temporal del sistema. No es un entorno aislado de seguridad ni un sanitizador. Mantén LibreOffice actualizado y abre solo documentos de confianza. La app no configura un servicio de conversión externo.
