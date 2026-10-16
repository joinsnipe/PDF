# IA y conversiones en PDF Contigo 2.4 beta

## Elige lo que necesitas

| Necesidad | Opción | Qué conserva | Requisito |
| --- | --- | --- | --- |
| Editar texto y tablas sencillas de un PDF | PDF a Word → editable | Líneas, tamaños de letra, tablas de columnas alineadas | Texto seleccionable; OCR previo si procede |
| Llevar un PDF a Word con su aspecto | PDF a Word → aspecto | Imagen de cada página | El texto y las tablas no serán editables |
| Convertir Word, Excel o PowerPoint a PDF | Office a PDF | Conversión con LibreOffice | Paquete Windows/Mac y LibreOffice instalado |
| Obtener frases representativas sin enviar datos | Resumir y entender → local | Frases literales y páginas | Sin API ni cuenta |
| Sintetizar o explicar un documento | Resumir y entender → IA | Informe en español, citas y páginas | Internet, cuenta y clave propia de API |

## IA con tu proveedor

Proveedores incluidos: **Gemini, OpenAI, Claude, Grok, Mistral y DeepSeek**. No hay clave compartida en el código ni suscripción a PDF Contigo. Cada proveedor puede cobrar consumo; sus cuotas gratuitas dependen de la cuenta, modelo, región y condiciones vigentes. Una suscripción de chat no implica crédito de API.

1. Pulsa **Configurar IA** en la barra superior o la sección **Leer, analizar e IA**. No necesitas seleccionar un PDF primero.
2. Elige el proveedor donde creaste tu clave (por ejemplo, **OpenAI, creador de ChatGPT**) y pégala. Ningún proveedor viene preseleccionado. Pulsa **Conectar con ese proveedor**: la app consulta los modelos y selecciona uno de texto automáticamente, sin enviar documentos. Este paso no comprueba saldo, cuota, precio ni permiso de generación.
3. Si lo necesitas, **Opciones avanzadas** permite indicar un modelo concreto y el workspace de Claude `wrkspc_…`. La configuración manual se comprueba en la primera consulta, sin validar previamente la clave o el modelo.
4. Elige **Resumir con IA** o **Explicar documento** y selecciona el PDF. Puedes cambiar archivos sin volver a introducir la clave.
5. Elige páginas y pulsa **Revisar el texto que se enviará**. Se lee localmente y muestra las páginas exactas. Hasta 100 páginas y 60.000 caracteres, sin recorte silencioso.
6. Lee las condiciones de datos y posibles costes. Autoriza el envío y pulsa **Resumir con IA** o **Explicar con IA**.
7. Contrasta el informe con el original desde el visor y los botones de página; descarga el TXT si lo necesitas.

Si te equivocas de proveedor, puedes corregirlo sin volver a pegar la clave. **Clave introducida** confirma que el campo contiene datos; no significa que el proveedor ya la haya aceptado. La app reconoce algunos formatos de claves y modelos y avisa de incoherencias antes de enviar. No prueba la clave en varios proveedores ni cambia de cuenta automáticamente. Una clave genérica `sk-` no identifica por sí sola al proveedor.

Un campo vacío, una clave incompleta o con caracteres adicionales y un rechazo de autenticación muestran mensajes diferentes. Tras un error de conexión, la clave sigue en el formulario para corregir o reintentar. Cerrar sin conectar descarta el borrador.

Cambiar páginas, conexión o tipo de informe invalida la revisión anterior. La clave se conserva **solo en la memoria de esta pestaña**, para no repetirla en cada documento; no se escribe en localStorage, sessionStorage, cookies ni archivos. Se olvida al pulsar **Desconectar y olvidar clave**, recargar o salir de la pestaña. Al cerrar la configuración se vacía su campo, pero la conexión sigue disponible en memoria. No se cambia de proveedor ni se reintenta automáticamente. Un error o cancelación no garantiza que no haya consumo.

**El texto y la clave van de tu dispositivo al proveedor elegido por HTTPS.** En web/móvil el navegador hace la petición directamente. El paquete Windows/Mac utiliza el conector de tu propio ordenador (`127.0.0.1`), sin intermediario compartido de PDF Contigo. No se envían el archivo PDF, sus imágenes ni certificados. El código de la aplicación no almacena ni registra el contenido; los proveedores aplican sus condiciones. **Conectar** en modo automático envía la clave, sin texto. [Privacidad completa](PRIVACIDAD.md).

### Conexión directa y errores

Desde **2.4 beta 6** se retira el relay público. Recarga la web o actualiza el ZIP: los paquetes anteriores no tienen este conector local. No necesitas contratar un servidor ni introducir su dirección. La configuración muestra el recorrido que usa tu instalación.

En móvil y web el proveedor debe admitir peticiones desde el navegador (CORS). Si no las admite, o la cuenta las restringe, usa el paquete de escritorio o el resumen local. No se envían las claves a un proxy de terceros como alternativa. Un fallo de red no demuestra que la clave sea incorrecta.

DeepSeek consulta su catálogo y prefiere un modelo de texto Flash cuando está disponible. Usa Chat Completions y salida JSON, sin modo de razonamiento en esta tarea. No se presenta como API gratuita: revisa el saldo y las condiciones de tu cuenta.

### Sin API o con cuota gratuita

**Resumen gratuito sin API** funciona sin cuenta ni enviar datos: extrae frases literales, no genera un resumen con IA. En **Configurar IA → No tengo API** hay enlaces al proveedor y tres pasos para crear una clave.

Gemini ofrece un plan gratuito para ciertos modelos y cuentas. [Crea tu clave en Google AI Studio](https://aistudio.google.com/apikey) y comprueba que el proyecto figure en el plan gratuito. Consulta [cuotas y facturación](https://ai.google.dev/gemini-api/docs/billing) y [precios por modelo](https://ai.google.dev/gemini-api/docs/pricing). La selección automática no garantiza gratuidad: la app no conoce la facturación ni el saldo de tu cuenta. No activa facturación ni cambia de proveedor por su cuenta.

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

En 2.4 beta 7 se prueban la selección explícita del proveedor, corrección sin borrar la clave, cambios repetidos, eventos de cierre tardíos, pegado sin evento de entrada, reintentos y el recorrido OpenAI desde configuración hasta informe. Se comprueba que las incoherencias reconocibles y los errores de formato no producen ninguna petición. Estas pruebas de DOM usan respuestas simuladas; no equivalen a validación con una cuenta o un navegador real.

En 2.4 beta 6 el flujo se ejecuta en el dispositivo. Se comprueba en workerd real que la ruta pública antigua responde 410 y no contacta con proveedores. Se prueban destinos directos, conector local, redirecciones, cancelaciones y límites con proveedores ficticios. La configuración de OpenAI explica la separación entre API y ChatGPT; los errores diferencian autenticación, permisos, saldo/límite de gasto, ritmo/cuota y modelo. El código de diagnóstico aparece junto al mensaje de conexión, sin exponer detalles brutos del proveedor.

Los adaptadores de IA se verifican con respuestas simuladas para los seis proveedores, validación de citas, límites y consentimiento. No se ha realizado consumo con claves reales en esta entrega. Las conversiones Office se prueban con documentos ficticios y LibreOffice en Linux; Windows, Mac, navegadores y dispositivos reales siguen necesitando comprobación. No se presenta una prueba simulada como validación completa del servicio externo.

Referencias de implementación: [Gemini](https://ai.google.dev/gemini-api/docs), [OpenAI](https://platform.openai.com/docs/api-reference/responses), [Claude](https://platform.claude.com/docs/en/api/overview), [Grok](https://docs.x.ai/developers/rest-api-reference/inference), [Mistral](https://docs.mistral.ai/api/endpoint/chat), [DeepSeek](https://api-docs.deepseek.com/api/create-chat-completion/), [LibreOffice](https://help.libreoffice.org/latest/es/text/shared/guide/start_parameters.html).
