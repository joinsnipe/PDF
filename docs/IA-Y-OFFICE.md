# IA y conversiones en PDF Contigo 2.4 beta

## Elige lo que necesitas

| Necesidad | Opción | Qué conserva | Requisito |
| --- | --- | --- | --- |
| Editar texto y tablas sencillas de un PDF | PDF a Word → editable | Líneas, tamaños de letra, tablas de columnas alineadas | Texto seleccionable; OCR previo si procede |
| Llevar un PDF a Word con su aspecto | PDF a Word → aspecto | Imagen de cada página | El texto y las tablas no serán editables |
| Convertir Word, Excel o PowerPoint a PDF | Office a PDF | Conversión con LibreOffice | Paquete Windows/Mac y LibreOffice instalado |
| Obtener frases representativas sin enviar datos | Entender mi PDF → local | Frases literales y páginas | Sin API ni cuenta |
| Sintetizar o explicar un documento | Entender mi PDF → IA | Informe en español, citas y páginas | Internet, cuenta y clave propia de API |

## IA con tu proveedor

Proveedores incluidos: **Gemini, OpenAI, Claude, Grok, Mistral y DeepSeek**. No hay clave compartida en el código ni suscripción a PDF Contigo. Cada proveedor puede cobrar consumo; sus cuotas gratuitas dependen de la cuenta, modelo, región y condiciones vigentes. Una suscripción de chat no implica crédito de API.

1. Pulsa **Configurar IA** en la barra superior o la sección **Leer, analizar e IA**. No necesitas seleccionar un PDF primero.
2. Elige el proveedor donde creaste tu clave (por ejemplo, **OpenAI, creador de ChatGPT**) y pégala. Ningún proveedor viene preseleccionado. Pulsa **Conectar con ese proveedor**: la app consulta los modelos y selecciona uno de texto automáticamente, sin enviar documentos. Este paso no comprueba saldo, cuota, precio ni permiso de generación.
3. Opcionalmente activa **Recordar mi conexión en este dispositivo**, elige una contraseña de al menos 4 caracteres (puedes elegir una más larga) y repítela. Al volver a abrir PDF podrás **Desbloquear IA** con esa contraseña, sin pegar la API. Esto no contacta con ningún proveedor ni consume IA. Si lo necesitas, **Opciones avanzadas** permite indicar un modelo concreto y el workspace de Claude `wrkspc_…`. La configuración manual se comprueba en la primera consulta, sin validar previamente la clave o el modelo.
4. Pulsa **Entender mi PDF** y selecciona el PDF. Puedes cambiar archivos sin volver a introducir la clave.
5. Elige páginas y pulsa **1. Revisar texto**, en el botón principal. La app lee el PDF en tu dispositivo y muestra el texto, sin consultar todavía la IA. Hasta 100 páginas y 60.000 caracteres, sin recorte silencioso.
6. Revisa el texto y el destino que aparece debajo. Pulsa **Enviar a OpenAI y analizar** (o el proveedor que hayas elegido). Este clic confirma el envío de esa consulta. **No hay casilla de autorización.** El proveedor recibe el texto y puede cobrar el uso; la revisión del paso anterior solo era local.
7. Contrasta el informe con el original desde el visor y los botones de página; descarga el TXT si lo necesitas.

**Estado visible:** «IA configurada · proveedor» indica que hay una conexión disponible en esta sesión. El punto verde significa que se consultó su catálogo al configurar; no comprueba saldo, disponibilidad actual ni generación. El modo manual se indica en ámbar. «Desbloquear IA» indica que hay una conexión guardada y bloqueada.

**Una sola herramienta:** «Entender mi PDF» recoge las ideas principales y explica solicitudes, documentación y fechas cuando constan en el texto, sin calcular plazos. No hay dos pestañas ni selector Resumir/Explicar. «Sin IA» selecciona frases literales y nunca envía el texto fuera del dispositivo.

Si te equivocas de proveedor, puedes corregirlo sin volver a pegar la clave. **Clave introducida** confirma que el campo contiene datos; no significa que el proveedor ya la haya aceptado. La app reconoce algunos formatos de claves y modelos y avisa de incoherencias antes de enviar. No prueba la clave en varios proveedores ni cambia de cuenta automáticamente. Una clave genérica `sk-` no identifica por sí sola al proveedor.

Un campo vacío, una clave incompleta o con caracteres adicionales y un rechazo de autenticación muestran mensajes diferentes. Tras un error de conexión, la clave sigue en el formulario para corregir o reintentar. Cerrar sin conectar descarta el borrador.

Cambiar páginas, conexión o método (con/sin IA) invalida la revisión anterior. Sin «Recordar», la clave solo dura esta sesión. Con «Recordar», se guarda cifrada y se vuelve a desbloquear al abrir o recargar. La contraseña es de PDF Contigo, **no la contraseña de OpenAI ni la API**. No podemos recuperarla; si la olvidas, configura la API de nuevo. La conexión es de cada perfil del dispositivo, no una cuenta sincronizada. «Desconectar y olvidar clave» borra la copia guardada. [Cifrado, ubicación y límites](PRIVACIDAD.md).

Las versiones anteriores no guardaban la API; no hay una clave antigua que recuperar automáticamente. Para activar la persistencia, pégala una vez en beta 10. Las actualizaciones posteriores del paquete conservan el archivo cifrado fuera de la carpeta de versión. En web/móvil, conserva el mismo origen y perfil y evita borrar sus datos.

No se cambia de proveedor ni se reintenta automáticamente. Un error o cancelación no garantiza que no haya consumo.

**El texto y la clave van de tu dispositivo al proveedor elegido por HTTPS.** En web/móvil el navegador hace la petición directamente. El paquete Windows/Mac utiliza el conector de tu propio ordenador (`127.0.0.1`), sin intermediario compartido de PDF Contigo. No se envían el archivo PDF, sus imágenes ni certificados. El código de la aplicación no almacena ni registra el contenido; los proveedores aplican sus condiciones. **Conectar** en modo automático envía la clave, sin texto. [Privacidad completa](PRIVACIDAD.md).

### Informe adaptado y referencias (beta 10)

Una sola herramienta: resumen y detalles útiles en función del documento. En una propuesta puede recoger alcance, trabajos, materiales, importes, condiciones, plazos y decisiones. En una comunicación administrativa, peticiones y documentación. La fecha del documento no debe presentarse como vencimiento y una propuesta no debe presentarse como obligación ya aceptada. No se exige rellenar apartados sin información.

La IA devuelve fragmentos identificados y citas breves. La aplicación contrasta las citas con el texto extraído y recupera las páginas de los identificadores, no de números inventados por el modelo. Un punto puede citar hasta tres fragmentos. Se muestran **citas plegadas** y botones para abrir las páginas; el TXT incluye el texto y todas las referencias. Se eliminan puntos idénticos y entradas vacías de «datos no identificados».

Antes de mostrar un punto, se comparan sus cifras escritas con dígitos, signos, decimales, porcentajes y monedas con sus citas. Por ejemplo, «50% al reservar» no se acepta con una cita sobre trabajos adicionales que no contenga ese porcentaje. Es una comprobación conservadora, no un verificador semántico: puede omitir reformulaciones válidas, no cubre cantidades escritas con palabras ni demuestra la relación entre una cifra y su concepto, ni que se hayan conservado todas las condiciones. La coincidencia literal tampoco garantiza que la interpretación sea correcta.

Si un punto falla, se omite y el informe se identifica como parcial. Si todos fallan, se muestra el aviso sin afirmaciones. Las respuestas explícitamente truncadas por el proveedor no se muestran como informes completos. **No hay una segunda llamada automática ni una segunda IA de pago para validar.** La solicitud original puede tener consumo.

La cobertura se calcula localmente: páginas seleccionadas, páginas sin texto y caracteres enviados. No es una certificación de que la IA haya comprendido o resumido todo. Solo se analiza texto extraído; imágenes, diagramas y tablas escaneadas necesitan OCR y pueden perder significado. No se recorta silenciosamente: máximo 100 páginas y 60.000 caracteres. Revisa el resultado con el original.

### Conexión directa y errores

Desde **2.4 beta 6** se retira el relay público. Recarga la web o actualiza el ZIP: los paquetes anteriores no tienen este conector local. No necesitas contratar un servidor ni introducir su dirección. La configuración muestra el recorrido que usa tu instalación.

En móvil y web el proveedor debe admitir peticiones desde el navegador (CORS). Si no las admite, o la cuenta las restringe, usa el paquete de escritorio o el resumen local. No se envían las claves a un proxy de terceros como alternativa. Un fallo de red no demuestra que la clave sea incorrecta.

DeepSeek consulta su catálogo y prefiere un modelo de texto Flash cuando está disponible. Usa Chat Completions y salida JSON, sin modo de razonamiento en esta tarea. No se presenta como API gratuita: revisa el saldo y las condiciones de tu cuenta.

### Sin API o con cuota gratuita

**Resumen gratuito sin API** funciona sin cuenta ni enviar datos: extrae frases literales, no genera un resumen con IA. En **Configurar IA → No tengo API** hay enlaces al proveedor y tres pasos para crear una clave.

Gemini ofrece cuotas gratuitas limitadas, pero sus [condiciones](https://ai.google.dev/gemini-api/terms) exigen servicios de pago al ofrecer aplicaciones a usuarios del Espacio Económico Europeo, Suiza o Reino Unido. Consulta [precios](https://ai.google.dev/gemini-api/docs/pricing) y condiciones actuales; PDF Contigo no promete IA gratuita. DeepSeek factura su API por uso. No se activa facturación ni se cambia de proveedor por cuenta del usuario.

No se incluye una clave pública compartida ni se promete IA anónima gratuita. La revisión de proveedores del 15 de octubre de 2026 no encontró una opción sin credenciales que se incorporase como servicio estable: incluso [Pollinations requiere clave para generar](https://gen.pollinations.ai/docs). Las condiciones de servicios externos pueden cambiar.

La aplicación exige una cita literal y página para cada punto y comprueba que esa cita exista en el texto extraído. Una cita correcta **no demuestra que la interpretación de la IA sea correcta**. Revisa cifras, nombres, obligaciones y fechas en el original. No calcula plazos administrativos ni realiza gestiones. Los escaneados necesitan OCR; sus errores pueden trasladarse al informe. No es una revisión profesional ni sustituye el documento.

## Qué esperar de PDF a Word

El modo editable detecta filas de 2–8 columnas alineadas (al menos tres filas). Es una aproximación: columnas de texto, celdas fusionadas, fuentes complejas y diseños de formularios pueden cambiar. No reconstruye las imágenes del PDF. El modo aspecto coloca una imagen por página, por lo que conserva mejor el diseño, pero no permite editar su texto. Hasta 80 páginas por operación.

La vista de texto de la app no es una previsualización del diseño de Word. En modo aspecto, el visor se identifica como documento original. Abre el DOCX generado en Word o LibreOffice para revisar su resultado.

## Office a PDF en Windows y Mac

Instala [LibreOffice desde su web oficial](https://www.libreoffice.org/download/download-libreoffice/), abre el paquete de PDF Contigo actualizado y entra en «Office a PDF». «Comprobar instalación» confirma si se encuentra el motor. No necesitas Python ni Node instalados: el paquete ya incluye su lanzador; LibreOffice se instala aparte.

Admite **DOCX, XLSX y PPTX** hasta 25 MB. No admite DOC/XLS/PPT antiguos, contraseña, macros, objetos incrustados ni datos externos. Una conversión cada vez, con límite de 90 segundos. Las hojas de Excel utilizan las áreas de impresión y ajustes guardados: corrígelos en Excel/LibreOffice si salen demasiadas páginas. Las fuentes instaladas influyen en el diseño.

Se procesa en el ordenador, con temporales que se eliminan al finalizar normalmente. La web y Android/iOS no ejecutan LibreOffice: allí utiliza Exportar a PDF en tu aplicación de Office o realiza esta conversión en el ordenador. [Instalación](INSTALACION.md).

## Comprobación de esta beta

Beta 10: pruebas con cifrado real y credenciales ficticias cubren recuperación web y escritorio con otro puerto, contraseña incorrecta, manipulación, rechazo de claves sin cifrar, borrado y aislamiento por perfil. Pruebas DOM cubren guardar, bloquear y desbloquear, sin consultas de IA. Los informes se prueban con respuestas simuladas, incluida la regresión del pago del 50%, citas múltiples, cifras sin respaldo, secciones vacías y truncado. No se ha usado una cuenta de API real ni el PDF privado original; no equivale a validar su análisis completo. No se ha realizado una prueba visual en un navegador real ni ejecución nativa en Windows/macOS en este entorno.

En 2.4 beta 8 se verifica el recorrido desde el botón principal: primer clic muestra el texto sin petición de IA; segundo clic envía al proveedor elegido. Cambiar páginas, archivo, tarea o conexión invalida esa revisión. Se prueban también el indicador conectado/manual/desconectado, fallos de extracción, rechazo del proveedor y retorno al resumen local sin red. No se ha usado una clave real ni consumido una API en esta entrega.

En 2.4 beta 7 se prueban la selección explícita del proveedor, corrección sin borrar la clave, cambios repetidos, eventos de cierre tardíos, pegado sin evento de entrada, reintentos y el recorrido OpenAI desde configuración hasta informe. Se comprueba que las incoherencias reconocibles y los errores de formato no producen ninguna petición. Estas pruebas de DOM usan respuestas simuladas; no equivalen a validación con una cuenta o un navegador real.

En 2.4 beta 6 el flujo se ejecuta en el dispositivo. Se comprueba en workerd real que la ruta pública antigua responde 410 y no contacta con proveedores. Se prueban destinos directos, conector local, redirecciones, cancelaciones y límites con proveedores ficticios. La configuración de OpenAI explica la separación entre API y ChatGPT; los errores diferencian autenticación, permisos, saldo/límite de gasto, ritmo/cuota y modelo. El código de diagnóstico aparece junto al mensaje de conexión, sin exponer detalles brutos del proveedor.

Los adaptadores de IA se verifican con respuestas simuladas para los seis proveedores, validación de citas, límites y consentimiento. No se ha realizado consumo con claves reales en esta entrega. Las conversiones Office se prueban con documentos ficticios y LibreOffice en Linux; Windows, Mac, navegadores y dispositivos reales siguen necesitando comprobación. No se presenta una prueba simulada como validación completa del servicio externo.

Referencias de implementación: [Gemini](https://ai.google.dev/gemini-api/docs), [OpenAI](https://platform.openai.com/docs/api-reference/responses), [Claude](https://platform.claude.com/docs/en/api/overview), [Grok](https://docs.x.ai/developers/rest-api-reference/inference), [Mistral](https://docs.mistral.ai/api/endpoint/chat), [DeepSeek](https://api-docs.deepseek.com/api/create-chat-completion/), [LibreOffice](https://help.libreoffice.org/latest/es/text/shared/guide/start_parameters.html).
