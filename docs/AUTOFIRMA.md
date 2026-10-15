# Firmar con AutoFirma

Disponible desde PDF **2.3.0-beta.1** en Windows y Mac. AutoFirma debe estar instalada por separado desde la [página oficial](https://firmaelectronica.gob.es/descargas). La integración requiere AutoFirma 1.9 o posterior y un navegador actualizado con WebSocket.

## Uso

1. Abre **Firmar con certificado** y selecciona el PDF.
2. Deja **AutoFirma · certificado instalado**. No selecciones el P12 ni introduzcas su contraseña en PDF.
3. Elige un motivo o **Sin indicar motivo** y la protección: **Permitir otras firmas** o **Certificar sin cambios**. Deja marcada **Mostrar firma en la página** si quieres una marca visible.
4. Espera a que aparezca **Conector preparado**, marca la confirmación y pulsa **Firmar con AutoFirma**. Si aparece un segundo botón **Abrir AutoFirma**, púlsalo: renueva el clic que el navegador necesita para abrir aplicaciones. Acepta la apertura y el permiso de acceso a la red local si se solicitan.
5. Elige el certificado en AutoFirma. Si has pedido marca visible, selecciona la página y dibuja el recuadro allí, de al menos unos 5,3 × 1,9 cm y más amplio para nombres largos. Cancelar esa selección cancela la firma. AutoFirma puede pedir el PIN o acceso a la clave privada en su propio diálogo.
6. Vuelve a la pestaña de PDF Contigo, revisa el resultado y pulsa **Descargar PDF** y revisa la firma en un lector independiente con panel de firmas.

Desmarcar la marca visible mantiene la firma criptográfica: no significa firmar solo una parte ni permitir borrar la firma sin consecuencias. El motivo explica el propósito de la firma y se elige antes de firmar. La marca gráfica no es una verificación de integridad.

## Si no se abre o no termina

| Qué ocurre | Qué comprobar |
| --- | --- |
| El navegador pregunta si puede abrir AutoFirma | Acepta la apertura; una pestaña puede perder el foco mientras aparece el diálogo nativo |
| `AF_COMPONENT_TIMEOUT` | El conector web no terminó de cargar en 30 segundos. Comprueba la conexión y vuelve a pulsar Firmar; el certificado todavía no se ha solicitado |
| `AF_COMPONENT_ASSET` o `AF_COMPONENT_VERSION` | Falta un archivo web o se han mezclado versiones. Cierra la pestaña y abre la web actualizada |
| `AF_COMPONENT_SCRIPT` | La política de seguridad ha bloqueado específicamente AutoScript. Comunica el código para revisar el conector; no cambies el certificado |
| `AF_COMPONENT_FRAME` o `AF_COMPONENT_ORIGIN` | Marco bloqueado o página inaccesible desde PDF. Abre la web directamente desde su enlace; si persiste, comunica el código |
| `AF_COMPONENT_INIT` | Fallo al inicializar el conector. Recarga y comunica el código si persiste |
| `AF_COMPONENT_BLOCKED` | Mensaje de la beta 2: no distinguía un fallo real de un script ajeno bloqueado. Recarga hasta ver beta 4 |
| `AF_LOCAL_BLOCKED` o permiso de red local | Revisa el permiso del sitio para comunicarse con AutoFirma en el propio equipo. No desactives TLS ni las protecciones del navegador |
| No aparece AutoFirma | Comprueba que esté instalada, cierra la operación anterior y vuelve a intentar; si persiste, consulta su manual oficial o repara/reinstala AutoFirma siguiendo sus instrucciones |
| AutoFirma abre sola, pero la web no conecta | La comunicación navegador–AutoFirma necesita su certificado local instalado correctamente. Reinicia el navegador tras la instalación. No desactives la validación TLS ni la protección del equipo |
| No encuentro el certificado | En Windows se solicita el almacén de Windows y en Mac el de Apple. Comprueba que el certificado tiene clave privada y permite firmar directamente en AutoFirma |
| He cancelado | No se genera descarga; vuelve a pulsar cuando quieras firmar |
| Se supera el tiempo de espera | Tras cinco minutos se libera la conexión de PDF. Cierra la operación pendiente en AutoFirma antes de repetir para evitar confundir ventanas |
| El resultado no aparece como PDF firmado | No se ofrece una descarga de éxito si la respuesta no es un PDF con estructura de firma sobre la revisión recibida |
| `AF_APPEARANCE` | AutoFirma devolvió una firma, pero su zona es demasiado pequeña o no se encuentra una marca visible. La app no ofrece ese resultado como descarga. Repite con una zona mayor o desactiva la marca visible |
| `AF_CERTIFICATION` | Se pidió cerrar el documento, pero la respuesta no declara DocMDP P=1; no se ofrece como certificada |
| `AF_PREVIOUS_SIGNATURE` | La respuesta no conserva el original como prefijo y una firma adicional; no se ofrece para evitar sustituir una firma previa |
| `PDF_SIGNED_DOCUMENT` / `PDF_SIGNATURE_LOCKED` | La edición o nueva firma está bloqueada por una firma previa o las restricciones declaradas. Utiliza la copia original sin firmar si necesitas cambios |
| Estoy en Android/iPhone/iPad | Esta conexión de escritorio no está habilitada. Las demás herramientas web siguen disponibles |

## Qué cambia respecto al fallo P12

El usuario confirmó el 15/10/2026 que puede firmar directamente en AutoFirma con el certificado que producía `CERT_INTEGRITY` en PDF. La nueva vía utiliza AutoFirma y su acceso a la clave privada, sin pasar ese certificado por node-forge. El método P12/PFX permanece como alternativa; **no se da por corregida la compatibilidad de ese archivo con el lector P12 anterior**.

## Aprobación y certificación

**Permitir otras firmas** crea una firma de aprobación. Otra persona puede añadir una firma si el PDF lo permite. Eso no autoriza a cambiar el contenido ya firmado. La app exige una respuesta incremental que conserve los bytes anteriores; el lector independiente debe verificar todas las firmas.

**Certificar sin cambios** incorpora una certificación DocMDP P=1 como primera firma. Declara que no se permiten ediciones ni firmas posteriores. La restricción está dentro de los bytes firmados, no es una contraseña ni un bloqueo físico del archivo. Modificar una copia fuera de la app sigue siendo posible: una modificación prohibida no conserva intacta la certificación. No es posible convertir la segunda firma de un documento en su primera certificación.

PDF Contigo bloquea operaciones de contenido y seguridad sobre cualquier PDF en el que detecta firmas. Permite lectura y extracción sin modificar el original. Las restricciones FieldMDP o DocMDP incompletas bloquean conservadoramente nuevas firmas: no se interpreta cada combinación de permisos de campos.

## Marca visible

La marca usa «Firmado digitalmente», titular y fecha; el motivo y los datos del certificado se consultan en las propiedades de la firma. En AutoFirma se solicita `visibleAppearance=default`, `layer2Text` con variables del certificado y fecha, y `layer2FontSize=0`. El código oficial ajusta el texto al rectángulo. La app comprueba al recibir el PDF una zona mínima de 150 × 54 puntos (admite orientación intercambiada). Esta comprobación ocurre después de la firma nativa: no mide el texto ni demuestra por sí sola que un nombre excepcionalmente largo resulte legible.

El método P12 alternativo ajusta el texto y rechaza una zona que no puede contenerlo con el tamaño mínimo de letra. No recorta nombres para hacer sitio al motivo. No añade a posteriori imágenes o cambios que invalidarían la firma.

## Implementación y límites

- AutoScript oficial **1.9.0**, tag `v1.9`, blob `2055f7be27238f2290c500f56c9848983daec870`. Fuente original sin modificar en `third_party/autofirma`; copia y licencias en `dist/vendor/autofirma` tras construir.
- Un marco por operación se prepara mientras se eligen el PDF y las opciones. El bootstrap se carga antes del cliente oficial y comunica disponibilidad mediante `postMessage`, comprobando origen, ventana emisora y versión. No depende de `iframe.onload` y no entrega el PDF durante la precarga. Si no queda activación del usuario, un botón explícito renueva el clic antes de invocar AutoFirma. Su CSP permite conexiones únicamente a `wss://127.0.0.1:*` y la invocación `afirma:`. No hay servidores de almacenamiento/recuperación, firma trifásica ni fallback remoto configurados.
- PAdES, SHA256withRSA, subfiltro ETSI.CAdES.detached. Certificado elegido en AutoFirma, sin mantener una selección fija entre operaciones. No se configura sello de tiempo. Esta integración no selecciona automáticamente algoritmos ECDSA.
- `visibleSignature=want` solicita selección nativa de la posición; `none` firma sin marca. No se envían coordenadas contradictorias desde la vista previa del método P12.
- Motivo limitado y escapado como Java Properties para impedir que se convierta en parámetros adicionales.
- Se pasan los bytes originales a AutoFirma y se entregan los recibidos sin reescribirlos. La comprobación de respuesta es estructural; **no verifica criptografía, confianza, revocación, firmas anteriores ni validez jurídica**. Comprueba el resultado con un verificador independiente.
- Un máximo de 100 MB de entrada; 110 MB de respuesta. Una operación por pestaña, tiempos de espera y limpieza del marco al terminar. El proceso nativo de AutoFirma conserva su propio ciclo de vida y configuración.

## Verificación de esta entrega

**Resultados de beta 4 en [Validación](VALIDACION.md).**

Pruebas automáticas del cliente oficial con WebSocket simulado: invocación nativa, destino exclusivamente local, solicitud PAdES, certificado Windows y respuesta. Pruebas del adaptador: consentimiento, cancelación, timeout/reintento, exclusión móvil, escape del motivo, respuesta inválida y conservación de bytes. La interfaz se prueba desde selección hasta descarga sin leer un P12; un PDF firmado con certificado ficticio conserva un CMS que OpenSSL verifica tras pasar por el adaptador.

La beta 2 añade carga del HTML real y del cliente oficial con recursos controlados en JSDOM, archivo ausente, señal lista sin `onload`, origen/emisor incorrectos, timeout de carga, versiones mezcladas, cierre durante precarga y renovación/cancelación del clic. JSDOM no verifica permisos ni CSP de un navegador real.

Estas pruebas **no ejecutan AutoFirma nativa**. El usuario confirmó posteriormente que el puente de beta 3 ya abre AutoFirma y firma en su Windows. Esa confirmación no acredita el nuevo modo de certificación ni la apariencia compacta de beta 4. Quedan por comprobar esas opciones en Windows y el flujo completo en Mac, junto con la validación independiente del PDF real.

Fuentes: [código oficial](https://github.com/ctt-gob-es/clienteafirma/tree/v1.9), [descargas y manuales](https://firmaelectronica.gob.es/descargas), [selección de certificados](https://github.com/ctt-gob-es/clienteafirma/wiki/Help-desktop-select-certs) y [marca visible](https://github.com/ctt-gob-es/clienteafirma/wiki/Help-desktop-visible-pdf).

## Incidencia web del 15 de octubre de 2026

El usuario confirmó que la web mostraba 2.3, pero recibió `AF_COMPONENT` antes de abrir AutoFirma. Se verificó por HTTP que el HTML del conector y AutoScript estaban publicados y que este último coincidía con la fuente oficial. La redirección del alojamiento de `.html` a una ruta sin extensión conservaba los recursos relativos.

La implementación anterior esperaba el evento `load` del marco durante diez segundos y creaba ese marco después del clic. Ese mensaje no permitía distinguir una carga lenta o bloqueada, y un marco creado después del clic no recibe la activación previa. La beta 2 corrige ambas debilidades. Sin una traza del navegador del usuario no se atribuye la incidencia original a una causa de red concreta ni se da por comprobada la firma nativa completa.

Referencias del navegador: [activación del usuario](https://html.spec.whatwg.org/multipage/interaction.html#tracking-user-activation), [acceso local en Chrome 147](https://developer.chrome.com/release-notes/147).

### Revisión del aviso AF_COMPONENT_BLOCKED (beta 3)

Se reprodujo un defecto del detector: una violación CSP de un script ajeno, emitida entre el arranque del bootstrap y la disponibilidad de AutoScript, anulaba el conector. La prueba falla con beta 2 y pasa con beta 3. Ahora se comprueba el recurso concreto, se ignoran las políticas que solo informan y se separan los fallos de marco, origen e inicialización. La misma restricción se aplica a los errores de scripts y a las conexiones locales. No se han ampliado los permisos CSP ni modificado AutoScript.

La descarga HTTP del conector publicado, también con cabeceras de navegación de un marco, devolvió los archivos esperados. Los registros del alojamiento no mostraron errores. Estas comprobaciones no identifican cuál de las ramas disparó el aviso en el navegador del usuario; si persiste, el nuevo código permite distinguirlas. No se atribuye automáticamente a su navegador ni al certificado.

Cinco regresiones adicionales comprueban scripts ajenos, bloqueo del cliente requerido, políticas informativas, restricciones del marco/origen y bloqueo de WebSocket local. Son eventos simulados con el HTML y cliente oficiales; no sustituyen la prueba nativa.

## Fuentes para certificación y ajuste de texto

- [Parámetros PAdES oficiales de AutoFirma 1.9](https://github.com/ctt-gob-es/clienteafirma/blob/v1.9/afirma-crypto-pdf-common/src/main/java/es/gob/afirma/signers/pades/common/PdfExtraParams.java).
- [Apariencia PDF de la biblioteca oficial](https://github.com/ctt-gob-es/clienteafirma-external/blob/master/afirma-lib-itext/src/main/java/com/lowagie/text/pdf/PdfSignatureAppearance.java): tamaño de fuente menor o igual a cero activa el ajuste de texto.
- [Certificación de documentos en Acrobat](https://helpx.adobe.com/acrobat/desktop/e-sign-documents/protect-documents/certify-pdfs.html).
