# CERT_INTEGRITY pendiente · alcance del diagnóstico local de Windows

**Corrección de interpretación, 15/10/2026:** el usuario comunica que utiliza normalmente su certificado en Windows. El informe de la versión 1 devolvió `WINDOWS_TAMBIEN_RECHAZA`, pero ese nombre era demasiado concluyente. Solo se ejecutó `PFXVerifyPassword` sobre el archivo y la entrada de contraseña de esa prueba. No se probó la importación completa, el certificado instalado ni una firma con Windows/AutoFirma. El resultado **no descarta un fallo de la app o del diagnóstico**, ni demuestra contraseña incorrecta, archivo dañado o que Windows no pueda utilizar el certificado. No se debe pedir una nueva exportación basándose únicamente en ese informe.

La versión 2 del script conserva la misma comprobación limitada, informa del nombre y resultado exactos de la API y retira la conclusión general sobre Windows. No es un nuevo motor de firma ni una corrección del certificado. No se ha vuelto a entregar al usuario como paso obligatorio.

El usuario ha probado la revisión de seguridad 2 y sigue recibiendo `CERT_INTEGRITY`. Su certificado concreto **no está resuelto**. Este código indica rechazo del MAC del P12/PFX antes de leer las claves; la corrección de PBES2 de la revisión 2 actúa más adelante y no explica por sí sola este caso.

Antes de añadir más variantes al lector, se prepara una comprobación con un motor independiente: `PFXIsPFXBlob` y `PFXVerifyPassword`, de Crypt32 de Windows. Estas APIs comprueban el contenedor y la contraseña sin importar datos al almacén de certificados. No se llama a PFXImportCertStore, no se firma ni se exportan claves.

## Uso

1. Extraer todo `PDF_Diagnostico_Certificado_Windows.zip` en una carpeta.
2. Abrir `COMPROBAR_CERTIFICADO.cmd` con doble clic, sin permisos de administrador.
3. Seleccionar exactamente el mismo P12/PFX que falla en PDF y escribir la misma contraseña en la consola; no se muestra al escribirla.
4. Compartir solo `RESULTADO_PARA_COMPARTIR.txt`, generado en esa carpeta.

El CMD inicia Windows PowerShell 5.1 sin perfil y con una política de ejecución limitada a ese proceso. No cambia la configuración permanente de PowerShell. Las políticas corporativas pueden impedir su ejecución: en tal caso se comunica el bloqueo, no se modifican.

## Resultado e interpretación

- `API_PFX_VERIFICA`: `PFXVerifyPassword` devuelve `TRUE` para el archivo y entrada usados. No equivale a una importación completa ni a una prueba de firma. Si PDF falla con los mismos datos, investigar la diferencia entre lectores.
- `API_PFX_NO_VERIFICA`: la API devuelve `FALSE` en esta prueba. No identifica la causa ni indica si el certificado instalado funciona en otras aplicaciones. Los nombres `WINDOWS_ACEPTA_PFX_Y_PASSWORD` y `WINDOWS_TAMBIEN_RECHAZA` pertenecen al informe anterior y deben interpretarse con estos mismos límites.
- `WINDOWS_NO_RECONOCE_PFX`: no se reconoce la estructura externa como P12/PFX.
- `NO_SE_PUDO_EJECUTAR` / `CANCELADO`: no hay resultado criptográfico.

El informe usa campos cerrados. No contiene nombre/ruta del archivo, titular, empresa, emisor, NIF, número de serie, huella, contraseña, longitud de contraseña ni bytes del certificado. No copia textos de excepciones. La contraseña se recibe como SecureString y se libera el búfer nativo; no se promete borrado físico completo de la memoria del sistema. El programa no contiene funciones de envío o subida de archivos. La comprobación se delega en las APIs nativas de Windows.

## Estado de comprobación

Código revisado contra la documentación oficial. No se ha ejecutado en un Windows real en este entorno. El usuario ejecutó la versión 1 y comunicó el resultado de la API; eso no identifica la causa de su incidencia. Se ha reproducido y corregido por separado un caso de `CERT_INTEGRITY` debido a codificación antigua en el lector de la app: véase [revisión de certificados 3](REVISION_CERTIFICADOS_3.md). Su certificado concreto sigue pendiente de validación.

Fuentes: [PFXVerifyPassword](https://learn.microsoft.com/en-us/windows/win32/api/wincrypt/nf-wincrypt-pfxverifypassword), [PFXIsPFXBlob](https://learn.microsoft.com/en-us/windows/win32/api/wincrypt/nf-wincrypt-pfxispfxblob) y [liberación del búfer de contraseña](https://learn.microsoft.com/en-us/dotnet/api/system.runtime.interopservices.marshal.zerofreeglobalallocunicode).
