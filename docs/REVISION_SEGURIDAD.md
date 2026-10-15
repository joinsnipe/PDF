# Revisión de seguridad 2 · 15/10/2026

Actualización posterior: [revisión de certificados 3](REVISION_CERTIFICADOS_3.md), con otro fallo del lector reproducido y corregido. La incidencia del usuario continúa pendiente de confirmación.

**Revisión local, no publicada.** Incluye las correcciones de [firma con certificado](REVISION_FIRMA.md) y la revisión de las cinco herramientas de la categoría Seguridad. Se han comprobado también el visor de documentos cifrados y la reparación, que utilizan el mismo motor.

## Fallos reproducidos y correcciones

| Herramienta | Resultado de la revisión |
| --- | --- |
| Firmar con certificado | Corregida la lectura de P12 AES con contraseñas Unicode. Motivo explicado, desplegable y opción sin motivo. Mensajes separados por causa. |
| Proteger PDF | Contraseñas que comienzan por `@` o `--` se interpretan como texto literal. Se rechaza antes de cifrar una contraseña que supera 127 bytes UTF-8; el contador anterior de caracteres permitía crear ciertos archivos que luego no se abrían. Se conserva AES-256. |
| Desbloquear PDF | Compatibilidad adicional con la codificación Latin-1 de PDF antiguos, probada con AES-128 y `ñ`. Se admiten contraseña de apertura, de propietario y vacía cuando el archivo abre sin ella. El contenido no se devuelve si falla la autenticación. |
| Quitar metadatos | Info y XMP generales se vacían también en sus objetos internos: antes se retiraban las referencias visibles, pero quedaban datos dentro del PDF. Se conserva el contenido de las páginas. |
| Ocultar una zona | Verificado que el PDF nuevo contiene páginas de imágenes y elimina texto original, campos y adjuntos. La zona negra se aplica a las páginas elegidas; todas se rasterizan. |

El motor WASM usado por la app no acepta los parámetros `print`/`printErr`: antes se ignoraban. Ahora se recoge su diagnóstico por el sistema de archivos interno del trabajador, sin mostrarlo en consola. Esto permite distinguir contraseña rechazada (`PDF_PASSWORD`), estructura dañada/incompatible (`PDF_STRUCTURE`), motor no disponible (`PDF_ENGINE`) y cifrado no admitido (`PDF_ENCRYPTION`, cuando el motor lo identifica). Los mensajes no prometen identificar con certeza toda corrupción del cifrado.

Las contraseñas se usan como se escriben; no se recortan espacios. Para leer PDF antiguos, el intento adicional cambia únicamente la codificación de los mismos caracteres, después de un rechazo de autenticación. No se buscan contraseñas desconocidas. Se limpian las referencias de contraseña y los archivos temporales del trabajador; liberar memoria no garantiza borrado físico.

## Comprobaciones

57 pruebas focalizadas aprobadas entre certificados, motores avanzados, seguridad e interfaz simulada:

- P12 exportados con OpenSSL: ASCII, tildes, símbolos, contraseña vacía, formatos antiguos, clave ausente, caducidad, MAC alterado y algoritmos no admitidos. Firma CMS verificada con OpenSSL y rechazo de contenido alterado.
- Proteger y desbloquear con ASCII, Unicode, espacios, `@`, `--`, emoji y el límite UTF-8. Los archivos nuevos también se abren con PDF.js, motor independiente del cifrado.
- PDF externos generados con pypdf: AES-256, AES-128, RC4-128 y RC4-40. Contraseñas de apertura y propietario; caso con apertura sin contraseña. Los formatos RC4 se prueban solo como entrada; no se generan desde la app.
- Falta de motor, PDF roto y contraseña incorrecta: errores diferentes. Limpieza de contraseña cuando falla el inicio del trabajador.
- Metadatos: ausencia de datos privados también en los objetos internos, con texto de página conservado. Ocultación: comprobación de píxeles y ausencia de texto, campos y adjuntos.
- Recorrido de interfaz simulada con el motor real: proteger → descargar → rechazar contraseña incorrecta → desbloquear → descargar y preparar el visor. Apertura desde el visor de un PDF cifrado sin contraseña de apertura.

Pendiente la prueba en un Windows y un navegador reales y con el certificado concreto del usuario. No se ha utilizado ni solicitado su certificado o contraseña. Las firmas de prueba no acreditan confianza de una CA ni validez para un trámite.

## Uso de esta revisión

Extrae todo el ZIP en una carpeta nueva y abre `PDF.cmd`. Arriba debe aparecer **Revisión de seguridad 2**. La web pública y los paquetes de GitHub siguen siendo la versión anterior.

Si algo falla, comunica el código y mensaje nuevo, la herramienta y si usas este paquete o la web. No envíes certificados, contraseñas ni documentos privados.

Reescribir un PDF firmado puede invalidar su firma. Proteger, desbloquear y quitar metadatos lo indican antes de procesar. Ocultar zonas crea un PDF de imágenes sin las firmas criptográficas originales. Conserva el documento original firmado. Quitar metadatos no elimina comentarios, adjuntos, datos visibles ni metadatos dentro de imágenes: no es anonimización completa.

Referencias técnicas: [qpdf 12.2 — cifrado y contraseñas](https://qpdf.readthedocs.io/en/12.2/cli.html), [compilación del motor WASM](https://github.com/neslinesli93/qpdf-wasm/blob/master/build.sh) y [codificación de contraseñas en OpenSSL](https://docs.openssl.org/3.0/man7/passphrase-encoding/).

## Caso del certificado del usuario: sigue pendiente

Después de probar este paquete, el usuario comunica `CERT_INTEGRITY`. Las pruebas anteriores no resolvieron su caso concreto. Se prepara un [diagnóstico nativo de Windows](DIAGNOSTICO_CERTIFICADO.md) para comparar lectores sin recibir su certificado ni contraseña. No se modifica de nuevo el lector por una hipótesis no confirmada.
