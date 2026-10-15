# Firmar con AutoFirma

Disponible desde PDF **2.3.0-beta.1** en Windows y Mac. AutoFirma debe estar instalada por separado desde la [página oficial](https://firmaelectronica.gob.es/descargas). La integración requiere AutoFirma 1.9 o posterior y un navegador actualizado con WebSocket.

## Uso

1. Abre **Firmar con certificado** y selecciona el PDF.
2. Deja **AutoFirma · certificado instalado**. No selecciones el P12 ni introduzcas su contraseña en PDF.
3. Elige un motivo o **Sin indicar motivo**. Deja marcada **Mostrar firma en la página** si quieres una marca visible.
4. Marca la confirmación y pulsa **Firmar con AutoFirma**. Si el navegador pide permiso para abrir AutoFirma, acéptalo.
5. Elige el certificado en AutoFirma. Si has pedido marca visible, selecciona la página y dibuja el recuadro allí. Cancelar esa selección cancela la firma. AutoFirma puede pedir el PIN o acceso a la clave privada en su propio diálogo.
6. Vuelve a la pestaña de PDF, pulsa **Descargar PDF** y revisa la firma en un lector independiente con panel de firmas.

Desmarcar la marca visible mantiene la firma criptográfica: no significa firmar solo una parte ni permitir borrar la firma sin consecuencias. El motivo explica el propósito de la firma y se elige antes de firmar. La marca gráfica no es una verificación de integridad.

## Si no se abre o no termina

| Qué ocurre | Qué comprobar |
| --- | --- |
| El navegador pregunta si puede abrir AutoFirma | Acepta la apertura; una pestaña puede perder el foco mientras aparece el diálogo nativo |
| No aparece AutoFirma | Comprueba que esté instalada, cierra la operación anterior y vuelve a intentar; si persiste, consulta su manual oficial o repara/reinstala AutoFirma siguiendo sus instrucciones |
| AutoFirma abre sola, pero la web no conecta | La comunicación navegador–AutoFirma necesita su certificado local instalado correctamente. Reinicia el navegador tras la instalación. No desactives la validación TLS ni la protección del equipo |
| No encuentro el certificado | En Windows se solicita el almacén de Windows y en Mac el de Apple. Comprueba que el certificado tiene clave privada y permite firmar directamente en AutoFirma |
| He cancelado | No se genera descarga; vuelve a pulsar cuando quieras firmar |
| Se supera el tiempo de espera | Tras cinco minutos se libera la conexión de PDF. Cierra la operación pendiente en AutoFirma antes de repetir para evitar confundir ventanas |
| El resultado no aparece como PDF firmado | No se ofrece una descarga de éxito si la respuesta no es un PDF con estructura de firma sobre la revisión recibida |
| Estoy en Android/iPhone/iPad | Esta conexión de escritorio no está habilitada. Las demás herramientas web siguen disponibles |

## Qué cambia respecto al fallo P12

El usuario confirmó el 15/10/2026 que puede firmar directamente en AutoFirma con el certificado que producía `CERT_INTEGRITY` en PDF. La nueva vía utiliza AutoFirma y su acceso a la clave privada, sin pasar ese certificado por node-forge. El método P12/PFX permanece como alternativa; **no se da por corregida la compatibilidad de ese archivo con el lector P12 anterior**.

## Implementación y límites

- AutoScript oficial **1.9.0**, tag `v1.9`, blob `2055f7be27238f2290c500f56c9848983daec870`. Fuente original sin modificar en `third_party/autofirma`; copia y licencias en `dist/vendor/autofirma` tras construir.
- Un marco por operación carga el componente localmente. Su CSP permite conexiones únicamente a `wss://127.0.0.1:*` y la invocación `afirma:`. No hay servidores de almacenamiento/recuperación, firma trifásica ni fallback remoto configurados.
- PAdES, SHA256withRSA, subfiltro ETSI.CAdES.detached. Certificado elegido en AutoFirma, sin mantener una selección fija entre operaciones. No se configura sello de tiempo. Esta integración no selecciona automáticamente algoritmos ECDSA.
- `visibleSignature=want` solicita selección nativa de la posición; `none` firma sin marca. No se envían coordenadas contradictorias desde la vista previa del método P12.
- Motivo limitado y escapado como Java Properties para impedir que se convierta en parámetros adicionales.
- Se pasan los bytes originales a AutoFirma y se entregan los recibidos sin reescribirlos. La comprobación de respuesta es estructural; **no verifica criptografía, confianza, revocación, firmas anteriores ni validez jurídica**. Comprueba el resultado con un verificador independiente.
- Un máximo de 100 MB de entrada; 110 MB de respuesta. Una operación por pestaña, tiempos de espera y limpieza del marco al terminar. El proceso nativo de AutoFirma conserva su propio ciclo de vida y configuración.

## Verificación de esta entrega

**Construcción completa; 96 pruebas JavaScript y 19 Python aprobadas en Linux.**

Pruebas automáticas del cliente oficial con WebSocket simulado: invocación nativa, destino exclusivamente local, solicitud PAdES, certificado Windows y respuesta. Pruebas del adaptador: consentimiento, cancelación, timeout/reintento, exclusión móvil, escape del motivo, respuesta inválida y conservación de bytes. La interfaz se prueba desde selección hasta descarga sin leer un P12; un PDF firmado con certificado ficticio conserva un CMS que OpenSSL verifica tras pasar por el adaptador.

Estas pruebas **no ejecutan AutoFirma nativa**. Está pendiente comprobar en Windows/Mac reales: permiso del navegador, conexión TLS local, selector de certificado, colocación visible, descarga y verificación del PDF de ese certificado. El funcionamiento autónomo de AutoFirma confirmado por el usuario no prueba todavía el puente nuevo.

Fuentes: [código oficial](https://github.com/ctt-gob-es/clienteafirma/tree/v1.9), [descargas y manuales](https://firmaelectronica.gob.es/descargas), [selección de certificados](https://github.com/ctt-gob-es/clienteafirma/wiki/Help-desktop-select-certs) y [marca visible](https://github.com/ctt-gob-es/clienteafirma/wiki/Help-desktop-visible-pdf).
