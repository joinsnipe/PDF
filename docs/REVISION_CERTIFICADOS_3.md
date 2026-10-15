# Revisión de certificados 3 · 15/10/2026

**Resultado comunicado por el usuario a las 10:07 del 15/10/2026 (Canarias): sigue apareciendo `CERT_INTEGRITY`. Esta entrega NO resuelve su incidencia.** Se detienen las nuevas variantes especulativas del lector y se revisa [la integración con AutoFirma](DECISION_FIRMA_AUTOFIRMA.md).

**Revisión local, sin publicar. El caso del certificado del usuario sigue pendiente de validación.** Incluye las correcciones de seguridad de la revisión 2.

## Fallo reproducido

Con un certificado ficticio y un P12 que reproduce la codificación anterior a OpenSSL 1.1.0, el lector independiente de OpenSSL acepta la contraseña original y la revisión 2 de PDF devuelve `CERT_INTEGRITY`. Es un fallo de compatibilidad de PDF demostrado con un archivo de prueba; no se ha examinado el certificado del usuario ni se afirma que utilice esa variante.

Las exportaciones antiguas podían interpretar cada byte UTF-8 de una contraseña como un carácter Latin-1 antes de obtener la representación UTF-16 requerida por PKCS#12. El lector de OpenSSL conserva compatibilidad con ellas. Nuestro lector solo comprobaba la representación estándar del MAC, de modo que la adaptación de PBES2 de la revisión 2 no llegaba a ejecutarse.

## Cambio

Después de un rechazo del MAC y únicamente con caracteres no ASCII, se comprueba también esa codificación antigua de los mismos caracteres. Se mantiene la verificación completa del MAC en cada intento, sin recortar espacios, normalizar, adivinar contraseñas ni aceptar archivos alterados. La codificación de PBES2 se mantiene separada de la del MAC y del cifrado PBE antiguo. Los formatos actuales siguen siendo el primer intento.

La entrada de contraseña se ha revisado: no se trunca ni se aplica `trim`; la selección de archivo se lee en binario y el trabajador recibe una copia de los datos. Se conserva la limpieza de referencias y búferes al terminar. No se garantiza el borrado físico de memoria.

## Diagnóstico anterior

Se retira la conclusión general «Windows también rechaza». `PFXVerifyPassword` solo comprobaba el archivo y la entrada de esa ejecución: no probaba el certificado instalado, la importación completa ni la firma que el usuario utiliza regularmente. Un resultado negativo no permite culpar a la contraseña ni descartar un fallo de nuestra app o de la comprobación. Véase [alcance del diagnóstico](DIAGNOSTICO_CERTIFICADO.md).

## Verificación

33 pruebas focalizadas aprobadas: 20 de certificados y 13 de interfaz.

- Certificados de prueba externos con 3DES/RC2 + SHA-1 y 3DES + SHA-256, reproduciendo la codificación antigua. OpenSSL confirma independientemente que se abren con la misma contraseña original.
- Lectura del titular y firma CMS, verificada después con OpenSSL. Se rechazan contraseñas distintas y MAC alterados; siguen funcionando los P12 AES modernos tras cada intento de compatibilidad.
- Recorrido de interfaz simulada con el motor real: selección del P12, rechazo de contraseña incorrecta, comprobación correcta, firma y enlace de descarga. Los bytes descargados contienen un PDF cuya firma CMS se verifica con OpenSSL.
- Se conserva la batería de certificados y seguridad anterior. La comprobación CMS usa `-noverify`: verifica la integridad criptográfica, no confianza de una CA, revocación ni aceptación administrativa.

La ejecución se ha realizado en Linux con pruebas de interfaz simulada, no en un navegador y Windows reales. No se ha usado ni solicitado el P12/PFX del usuario. La revisión no habilita certificados del almacén de Windows, DNIe, ECDSA, sellado de tiempo ni cofirma.

## Entrega

Extrae todo `PDF_revision_certificados_3_Windows.zip` en una carpeta nueva y abre `PDF.cmd`. La cabecera debe indicar **Revisión de certificados 3**. El ZIP contiene la aplicación completa y la revisión de código; no hace falta usar otra vez el diagnóstico independiente.

La web pública y los paquetes públicos de GitHub no reciben esta revisión. La incidencia del usuario no se dará por cerrada hasta comprobar que su certificado abre, firma y permite descargar el resultado.

Referencias primarias: [codificación de contraseñas PKCS#12 en OpenSSL](https://docs.openssl.org/3.0/man7/passphrase-encoding/) y [alcance de PFXVerifyPassword](https://learn.microsoft.com/en-us/windows/win32/api/wincrypt/nf-wincrypt-pfxverifypassword).
