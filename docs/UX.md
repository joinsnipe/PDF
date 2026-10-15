# Experiencia visual de PDF Contigo

Revisión de las 29 herramientas en **2.4.0-beta.2**. La selección del archivo muestra sus páginas, cuando se pueden abrir. Las miniaturas se cargan de doce en doce y se liberan al cambiar de tarea. Los nombres largos se pueden consultar en la lista y las páginas seleccionables tienen estado accesible y foco de teclado.

## Antes y después

| Herramienta | Antes de procesar | Resultado que puedes revisar |
| --- | --- | --- |
| Unir PDF | Páginas de cada archivo; orden con flechas en la lista | PDF unido en el visor |
| Dividir PDF | Selección de páginas con clic o intervalo | PDF extraído; selector de documento si hay varios |
| Comprimir PDF | Miniaturas del original; explicación de cada modo | PDF generado y tamaño final |
| Organizar páginas | Miniaturas, orden, giro y exclusión por página | PDF reorganizado |
| Imágenes a PDF | Imágenes en el orden de la lista | PDF generado con los márgenes y tamaño elegidos |
| PDF a imágenes | Selección visual de páginas | Primeras 12 imágenes; descarga completa en ZIP |
| Girar PDF | Selección visual y giro de las páginas elegidas | PDF con la rotación aplicada |
| Marca de agua | Texto superpuesto de forma orientativa | PDF con la marca real |
| Numerar páginas | Numeración orientativa en las miniaturas | PDF con números reales |
| Extraer texto | Selección visual de páginas | Fragmento del texto y TXT completo |
| Visor de PDF | Página ajustada al ancho, zoom, navegación y búsqueda | Descarga del original sin reescribirlo |
| Firmar con certificado | Páginas del original; protección y colocación según el método | PDF firmado en el visor; validación independiente requerida |
| OCR | Selección visual e idioma | PDF buscable en el visor y texto reconocido |
| Proteger PDF | Páginas del original y contraseña confirmada | PDF cifrado descargable; no se descifra para previsualizarlo |
| Desbloquear PDF | Contraseña si es necesaria; miniaturas si ya es legible | Visor de la copia sin cifrado |
| Rellenar formularios | Páginas originales y campos editables | PDF con los valores guardados |
| Aplanar formularios | Páginas originales y explicación del cambio | PDF con campos fijados |
| Añadir firma a mano | Selección de páginas, dibujo y zona sobre una página | PDF con la imagen incorporada |
| Añadir texto | Selección de páginas y zona sobre una página | PDF con el texto añadido |
| Recortar márgenes | Selección de páginas y cantidad de margen | PDF con el área visible recortada |
| Cambiar tamaño | Selección de páginas, tamaño y orientación | PDF adaptado |
| Ocultar una zona | Selección de páginas y rectángulo sobre una página | PDF rasterizado; revisar cada página |
| Quitar metadatos | Páginas del original y alcance de la limpieza | PDF resultante; el aspecto puede ser idéntico |
| Reparar estructura | Miniaturas si el original es legible | Visor del documento recuperado, si se pudo reparar |
| Comparar texto | Miniaturas de ambos originales, A y B | Frases añadidas/eliminadas y TXT |
| Resumir y entender | Modo local o IA, conexión independiente, texto revisado y consentimiento | Informe descargable, citas y visor del original |
| PDF a Word | Selección de páginas y modo editable/visual | Texto extraído o visor del original, identificado como tal; DOCX descargable |
| Office a PDF | Archivo Office y comprobación de LibreOffice en escritorio | PDF generado en el visor |
| Escala de grises | Miniaturas en gris de forma orientativa | PDF rasterizado en el visor |

Las miniaturas muestran el **original** salvo los efectos orientativos indicados. Recorte, tamaño, texto, campos y calidad se comprueban en el resultado generado. No se presenta una simulación como si fuera el PDF final. Las vistas de texto se limitan a 22.000 caracteres; el archivo contiene el resultado completo.

## Selección y revisión

- Toca una página para incluirla o excluirla en las herramientas que admiten intervalos. «Seleccionar todas» y «Solo la primera» agilizan el trabajo. El campo de páginas sigue admitiendo intervalos escritos y duplicados para los casos que los necesiten.
- «Girar PDF» muestra el ángulo elegido solo en las páginas seleccionadas. El original no se modifica.
- El visor de resultados permite recorrer todas las páginas, ampliar y buscar texto. También aparece para OCR, aunque la descarga sea un ZIP con PDF y TXT.
- Un PDF cifrado o demasiado dañado no permite mostrar miniaturas antes de abrirlo o recuperarlo. Se explica en la herramienta; una miniatura que falla muestra «Vista no disponible».
- Los documentos firmados se pueden leer y descargar intactos. Las operaciones que cambian contenido o seguridad se bloquean para no invalidar sus firmas. La detección es estructural, no una validación criptográfica.

## Alcance de la comprobación

Pruebas de selección y descargas con JSDOM; miniaturas reales con PDF.js y Canvas, incluyendo render, giro, paginación y cierre durante carga. Los motores PDF se ejercitan con documentos ficticios y las firmas con OpenSSL. Está pendiente la revisión visual en navegadores y dispositivos reales. Véase [Validación](VALIDACION.md).

«Añadir firma a mano» pertenece a «Firma y seguridad». Su aviso explica que es una imagen y no equivale a una firma con certificado digital ni verifica la identidad del firmante.

## Configuración de IA en 2.4 beta 2

«Configurar IA» está visible en la barra superior (también en móvil), menú lateral y sección «Leer, analizar e IA». La conexión es proveedor → clave → Conectar. El modelo se elige automáticamente y la selección manual queda en opciones avanzadas. «No tengo API» explica cómo conseguirla, la posibilidad de cuota gratuita de Gemini y la alternativa local sin IA. La conexión se conserva solo en memoria de la pestaña entre documentos y se puede olvidar explícitamente. Cambiarla invalida el texto autorizado; cerrar o cambiar proveedor descarta respuestas de conexión tardías.
