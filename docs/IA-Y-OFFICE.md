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

Proveedores incluidos: **Gemini, OpenAI, Claude, Grok y Mistral**. No hay clave compartida en el código ni suscripción a PDF Contigo. Cada proveedor puede cobrar consumo; sus cuotas gratuitas dependen de la cuenta, modelo, región y condiciones vigentes. Una suscripción de chat no implica crédito de API.

1. Selecciona el PDF y las páginas que quieres analizar.
2. Elige «Resumen o explicación con IA» y tu proveedor.
3. Pega tu clave. En Claude, si tu clave no está limitada a un workspace, introduce también su ID `wrkspc_…`, disponible en la consola del proveedor.
4. Pulsa «Cargar mis modelos» y elige uno, o escribe su identificador. El catálogo puede incluir modelos no compatibles; utiliza uno de texto que admita la API correspondiente.
5. Pulsa «Revisar el texto que se enviará». Este paso lee el PDF localmente y muestra las páginas exactas. Hasta 100 páginas y 60.000 caracteres; el texto no se recorta silenciosamente.
6. Lee las condiciones de datos y posibles costes del proveedor. Autoriza el envío y pulsa «Crear resumen».
7. Contrasta el informe con el original desde el visor y los botones de página; descarga el TXT si lo necesitas.

Cambiar páginas, proveedor, modelo, clave o tipo de informe invalida la revisión anterior. La clave se borra del campo después del intento de procesamiento o al cerrar. No se guarda para próximas visitas. No se cambia de proveedor ni se reintenta automáticamente. Si hay un error o una cancelación, revisa el consumo en tu proveedor antes de repetir.

El texto y la clave pasan por HTTPS por el servidor de PDF Contigo hacia el proveedor elegido. No se envían el archivo PDF, sus imágenes ni certificados. El código de la aplicación no almacena ni registra el contenido; los proveedores aplican sus propias condiciones. «Cargar modelos» envía la clave, sin texto. [Privacidad completa](PRIVACIDAD.md).

El servidor exige una cita literal y página para cada punto y comprueba que esa cita exista en el texto extraído. Una cita correcta **no demuestra que la interpretación de la IA sea correcta**. Revisa cifras, nombres, obligaciones y fechas en el original. No calcula plazos administrativos ni realiza gestiones. Los escaneados necesitan OCR; sus errores pueden trasladarse al informe. No es una revisión profesional ni sustituye el documento.

## Qué esperar de PDF a Word

El modo editable detecta filas de 2–8 columnas alineadas (al menos tres filas). Es una aproximación: columnas de texto, celdas fusionadas, fuentes complejas y diseños de formularios pueden cambiar. No reconstruye las imágenes del PDF. El modo aspecto coloca una imagen por página, por lo que conserva mejor el diseño, pero no permite editar su texto. Hasta 80 páginas por operación.

La vista de texto de la app no es una previsualización del diseño de Word. En modo aspecto, el visor se identifica como documento original. Abre el DOCX generado en Word o LibreOffice para revisar su resultado.

## Office a PDF en Windows y Mac

Instala [LibreOffice desde su web oficial](https://www.libreoffice.org/download/download-libreoffice/), abre el paquete de PDF Contigo actualizado y entra en «Office a PDF». «Comprobar instalación» confirma si se encuentra el motor. No necesitas Python ni Node instalados: el paquete ya incluye su lanzador; LibreOffice se instala aparte.

Admite **DOCX, XLSX y PPTX** hasta 25 MB. No admite DOC/XLS/PPT antiguos, contraseña, macros, objetos incrustados ni datos externos. Una conversión cada vez, con límite de 90 segundos. Las hojas de Excel utilizan las áreas de impresión y ajustes guardados: corrígelos en Excel/LibreOffice si salen demasiadas páginas. Las fuentes instaladas influyen en el diseño.

Se procesa en el ordenador, con temporales que se eliminan al finalizar normalmente. La web y Android/iOS no ejecutan LibreOffice: allí utiliza Exportar a PDF en tu aplicación de Office o realiza esta conversión en el ordenador. [Instalación](INSTALACION.md).

## Comprobación de esta beta

Los adaptadores de IA se verifican con respuestas simuladas para los cinco proveedores, validación de citas, límites y consentimiento. No se ha realizado consumo con claves reales en esta entrega. Las conversiones Office se prueban con documentos ficticios y LibreOffice en Linux; Windows, Mac, navegadores y dispositivos reales siguen necesitando comprobación. No se presenta una prueba simulada como validación completa del servicio externo.

Referencias de implementación: [Gemini](https://ai.google.dev/gemini-api/docs), [OpenAI](https://platform.openai.com/docs/api-reference/responses), [Claude](https://platform.claude.com/docs/en/api/overview), [Grok](https://docs.x.ai/developers/rest-api-reference/inference), [Mistral](https://docs.mistral.ai/api/endpoint/chat), [LibreOffice](https://help.libreoffice.org/latest/es/text/shared/guide/start_parameters.html).
