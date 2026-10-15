# Revisión local de firma 2 · 15/10/2026

Actualización posterior: la [revisión de certificados 3](REVISION_CERTIFICADOS_3.md) añade compatibilidad para una codificación antigua del MAC. No se ha confirmado todavía el certificado concreto del usuario.

**No publicada en GitHub, Releases ni en la web.** El usuario comunica que su P12/PFX de empresa y su contraseña son correctos, pero aparece «No se pudo desbloquear el certificado». Se ha reproducido ese mensaje con un certificado ficticio exportado por OpenSSL con AES y una contraseña Unicode correcta. No se ha recibido ni utilizado el certificado del usuario: esta revisión no acredita todavía que su caso concreto esté resuelto.

## Corrección de la revisión 2

- El lector confundía la cadena Unicode de la contraseña con los bytes requeridos por PBES2/PBKDF2. Se codifica en UTF-8 únicamente en esa frontera. No se modifica la contraseña del usuario, no se recortan espacios ni se normalizan caracteres y no se omite la verificación MAC.
- Se conservan los formatos antiguos de Forge con contraseña Latin-1. El intento de compatibilidad solo se permite si se ha llegado a PBES2 y no ha fallado el MAC. La adaptación del lector es síncrona, local al trabajador de firma y se restaura incluso cuando hay un error.
- El aviso anterior confundía errores de algoritmos con contraseñas por buscar genéricamente la palabra inglesa «password». Ahora distingue `CERT_ALGORITHM` (formato/cifrado no admitido), `CERT_INTEGRITY` (MAC no verificado; no determina si es contraseña, codificación o alteración), `CERT_DECRYPT` (contenido no descifrado) y `CERT_FORMAT` (estructura ilegible). Los códigos se muestran tanto al comprobar como al firmar.
- Motivo explicado y desplegable: aprobar, dar conformidad, dejar constancia de revisión, aceptar presupuesto, presentar ante una administración, sin motivo o texto propio. Se conserva la elección en la firma; «Sin indicar motivo» ya no repone el texto predeterminado.

Referencia técnica sobre las diferencias de codificación: https://docs.openssl.org/3.0/man7/passphrase-encoding/. La incompatibilidad descrita se ha verificado con los motores reales de esta app y archivos ficticios exportados con OpenSSL.

## Cambios

- P12/PFX RSA con clave privada en keyBag o pkcs8ShroudedKeyBag. Compatibilidad con contraseña vacía y ausencia de contraseña, que PKCS#12 representa de forma diferente.
- Diagnóstico local: archivo incompatible, fallo de integridad o descifrado, ausencia de clave privada, múltiples identidades, caducidad y uso de clave. Un fallo de MAC no demuestra por sí solo que la contraseña sea incorrecta.
- Nombres UTF-8 del certificado mostrados correctamente. Metadatos PDF codificados con UTF-16 y escapes, conservando acentos, paréntesis y barras.
- CMS con el nombre de emisor ASN.1 original del certificado. Evita que la reconstrucción de atributos UTF-8 o RDN múltiples impida localizar el certificado del firmante en un verificador independiente.
- Comprobar certificado antes de firmar: titular, empresa si consta, emisor y caducidad. No comprueba confianza de CA ni revocación.
- Marca visible opcional con titular, empresa, fecha UTC del equipo y motivo. Selección de página, zona, movimiento y ajuste de tamaño. Se incorpora como apariencia del campo de firma, antes de calcularla.
- «Borrar firma» se sustituye por «Limpiar dibujo» en la herramienta de imagen. No hay función para eliminar una firma criptográfica en esta app.

## Qué significa la firma

La firma permite comprobar integridad del contenido firmado y relacionarlo con un certificado. No impide físicamente eliminar un archivo o generar una copia distinta sin firma. La copia alterada ya no conserva la misma evidencia válida sobre ese contenido. La marca visible por sí sola no prueba la firma: comprueba el panel de firmas del lector.

No se garantiza validación «para siempre». No se incorpora sello de tiempo confiable ni evidencias de revocación/LTV. La fecha visible procede del reloj del equipo. El certificado puede caducar, y la comprobación a largo plazo requiere evidencias y políticas adicionales. Tampoco se afirma compatibilidad con requisitos de una administración concreta.

## Límites conservados

Solo RSA P12/PFX con clave privada. Sin selección directa del almacén Windows/macOS, DNIe, tarjetas, ECDSA, cofirmas ni conservación de firmas previas. Se rechazan PDFs con firma o campo de firma anterior. Los formularios se aplanan antes de firmar. La fuente de la marca visible cubre caracteres latinos; si un nombre contiene caracteres no representables se informa y puede usarse firma invisible con metadatos Unicode completos.

## Prueba del usuario

1. Extrae TODO el ZIP nuevo en otra carpeta y abre PDF.cmd. Confirma que arriba aparece «Revisión de seguridad 2», que incluye esta corrección. La web y el ZIP anterior no incluyen esta corrección.
2. En «Firmar con certificado», selecciona un PDF ficticio y el P12/PFX de tu equipo. No envíes el certificado a nadie.
3. Introduce su contraseña y pulsa «Comprobar certificado». Si falla, comunica solo el código/mensaje nuevo, la extensión del archivo y si utilizas la web o este paquete. No envíes el P12/PFX ni su contraseña.
4. Elige página y zona, confirma y pulsa «Firmar PDF». Descarga el resultado y comprueba su firma en un lector que permita validarla.

## Comprobaciones de esta revisión

39 pruebas focalizadas aprobadas (motores avanzados, certificados e interfaz simulada). Pruebas con identidades ficticias y claves temporales; verificación CMS independiente con OpenSSL, conservando la comprobación de rechazo por alteración de bytes de la batería previa. Se prueban exportaciones externas AES con ASCII, Unicode, espacios y contraseña vacía, además de 3DES/RC2 con Unicode, compatibilidad con AES antiguo de Forge, contraseña incorrecta, MAC alterado y algoritmo no admitido. Se comprueba la transmisión del motivo elegido y la firma sin motivo.

No se ha verificado confianza de una CA real. Marca renderizada y comprobada en páginas con CropBox y giros 0/90/180/270; inspección visual de muestras en la revisión anterior, cuya apariencia no cambia. Flujos de comprobación de certificado y envío de página/zona verificados en DOM simulado.

No se ha utilizado el certificado de empresa del usuario ni un Windows real. Se mantiene pendiente esa comprobación. No se ha ejecutado una interfaz de navegador real en este entorno.

Fuentes conceptuales: https://helpx.adobe.com/acrobat/desktop/e-sign-documents/learn-about-signatures/signed-pdf-limitations.html y https://helpx.adobe.com/acrobat/desktop/e-sign-documents/fill-sign-documents/add-verification.html.

La revisión posterior de todas las herramientas de seguridad se documenta en [REVISION_SEGURIDAD.md](REVISION_SEGURIDAD.md).
