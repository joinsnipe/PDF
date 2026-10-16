# Funciones y límites de PDF

## Herramientas

| Área | Funciones |
| --- | --- |
| Páginas | Unir, dividir, organizar, girar, numerar, recortar y cambiar tamaño |
| Conversión | JPG/PNG a PDF, PDF a JPG/PNG, extraer TXT, PDF a Word editable o visual, Office a PDF en escritorio, escala de grises |
| Edición | Comprimir, marca de agua, añadir texto y reparar estructura |
| Firma y seguridad | Firma a mano sin certificado, proteger con AES-256, desbloquear con contraseña conocida, firma con AutoFirma o P12/PFX RSA, quitar metadatos y ocultar una zona |
| Formularios | Rellenar campos AcroForm y aplanar sus apariencias |
| Lectura | Visor con páginas, zoom y búsqueda, resumen local o con IA, comparar texto y OCR |

### Apertura con contraseña

En **Visor de PDF** o **Desbloquear PDF**, selecciona el PDF protegido e introduce su contraseña una vez. Se abre un visor del resultado y se prepara una copia sin contraseña. Se admite dejarla vacía cuando el PDF abre sin contraseña y solo tiene restricciones. La contraseña no se guarda. Si la protección corresponde a la web de una administración, descarga antes el PDF desde esa web: esta herramienta procesa archivos locales. Conserva el original si contiene firmas digitales, porque reescribirlo puede invalidarlas.

### Descargas

Después de procesar: **Descargar**, **Guardar como…** (cuando el navegador permite elegir ubicación) o **Abrir resultado** para usar el lector del navegador. Los resultados múltiples incluyen ZIP y enlaces individuales cuando hay hasta 30 archivos. Los enlaces se renuevan por resultado y no se revocan durante `pagehide`. Se liberan al vaciar/cerrar la herramienta. En móviles compatibles, **Compartir archivo…** abre el menú del sistema para elegir Archivos u otra aplicación. Las pruebas de DOM verifican los bytes y los enlaces; no sustituyen una comprobación del guardado en un navegador real.

## Alcance de las funciones nuevas

- OCR: español e inglés, hasta 30 páginas elegidas; produce PDF con imagen y texto reconocido, más TXT. Puede equivocarse en cifras y nombres.
- Resumen: modo local con frases literales o modo IA con clave propia de Gemini, OpenAI, Claude, Grok, Mistral o DeepSeek. El modo IA envía solo el texto revisado por el usuario, desde su dispositivo al proveedor, sin servidor compartido de PDF Contigo; no envía el PDF, imágenes o certificado. Hasta 100 páginas y 60.000 caracteres. Citas contrastadas con el texto extraído, interpretación no verificada. Aplica OCR primero si no hay texto seleccionable.
- Comparación: diferencias de frases y duplicados. Ignora imágenes, diseño y cambios de orden.
- Word: hasta 80 páginas. Modo editable con tamaños de letra y tablas sencillas alineadas, sin imágenes; puede perder distribución, columnas y tablas complejas. Modo aspecto: cada página es una imagen en el DOCX, sin texto editable.
- Office a PDF: DOCX, XLSX y PPTX de hasta 25 MB con LibreOffice instalado en Windows/Mac. Las hojas usan sus áreas de impresión guardadas. No admite formatos antiguos DOC/XLS/PPT, cifrado, macros, objetos incrustados ni datos externos. Revisa cambios por fuentes ausentes.
- Firma a mano: imagen colocada en el documento, sin certificado.
- Firma con AutoFirma: en Windows/Mac, selecciona el certificado instalado y la marca visible en AutoFirma; después guarda el PDF recibido. Requiere AutoFirma 1.9 o posterior. No se lee el P12 en PDF para esta vía ni se configura sello de tiempo. [Guía y límites](AUTOFIRMA.md).
- Método P12/PFX alternativo: CMS con certificado personal o de empresa RSA P12/PFX que incluya su clave privada, cálculo local. Permite comprobar el archivo antes de firmar y elegir página y zona de una marca visible con titular, organización si consta, fecha UTC y motivo. La marca es opcional; la firma criptográfica cubre el documento completo. Comprueba caducidad, correspondencia de clave/certificado y uso de firma si está declarado. No valida cadena de confianza ni revocación; sin sello de tiempo, DNIe, tarjetas, ECDSA o cofirmas. Rechaza firmas previas. Aplana formularios antes de firmar. El visor interno no verifica firmas: revisa el resultado y la confianza del certificado en un lector que sí lo haga.
- Ocultar una zona: renderiza todas las páginas y cubre el rectángulo elegido antes de crear un nuevo PDF de imágenes. Elimina los objetos originales, texto seleccionable, enlaces y campos. Revisa cada página antes de compartir.
- Recorte: visual, no elimina información oculta. Metadatos: solo campos generales Info/XMP, no es anonimización completa.
- Reparación: reescribe la estructura con qpdf; no recupera bytes ausentes ni garantiza reparar cualquier corrupción.
- Formularios: AcroForm de texto, casillas, listas y radios. No admite XFA ni campos de firma en esta herramienta.

No incluye PDF a Excel/PowerPoint, PDF/A validado, edición del texto original ni traducción. [Guía de IA y Office](IA-Y-OFFICE.md).

## Límites y privacidad

100 MB y 100 archivos por tarea, 500 páginas por PDF o unión. Conversión a imágenes: 150 páginas, con límite de 16 megapíxeles por imagen. OCR: 30 páginas. Archivos complejos pueden agotar memoria o bloquear temporalmente la interfaz.

Las herramientas PDF habituales usan documentos, certificados y contraseñas en memoria. Office utiliza temporales locales que elimina al terminar normalmente; un cierre abrupto puede dejarlos. La IA opcional envía texto y clave desde el dispositivo al proveedor elegido (conector del propio equipo en escritorio), con autorización por consulta. No hay historial ni almacenamiento de documentos en la aplicación. Los resultados descargados quedan en tu dispositivo. Liberar referencias no garantiza borrado físico de la memoria del sistema. La versión web se ha abierto al público por petición expresa del propietario. El acceso público a la app no publica los documentos que cada visitante procesa.

Los motores se alojan con la app. PDF.js recibe bytes locales, con `isEvalSupported: false`; no se ejecutan scripts del PDF. La aplicación no se presenta como sanitizador. Modificar un documento firmado puede invalidar su firma. Unión/extracción no garantizan conservar marcadores, adjuntos o estructuras globales de accesibilidad. La compresión con imágenes pierde contenido interactivo y texto seleccionable.

