# Firma de escritorio: revisión de AutoFirma · 15/10/2026

Estado actualizado: el 15/10/2026 el usuario confirma que firma PDF directamente en AutoFirma con el mismo certificado. Se implementa esa vía en PDF 2.3.0-beta.1 con AutoScript 1.9.0, sin reabrir el P12 en nuestra app. La integración dispone de pruebas automáticas; falta la comprobación completa en el Windows del usuario. [Guía actual](AUTOFIRMA.md).

## Hallazgo en el proyecto

`signing-src/certificate.js` abre el P12/PFX con node-forge; `signing-src/sign.js` no comienza la firma PDF hasta que termina esa lectura. `dist/sign-worker.js` no tiene conexión con AutoFirma o el almacén de Windows. El error observado pertenece a la comprobación MAC del contenedor; no identifica por sí solo su causa. Las pruebas ficticias aprobadas no acreditan compatibilidad con el certificado concreto.

## Recomendación

Integrar AutoFirma como vía principal de firma en Windows mediante el componente oficial AutoScript. AutoFirma debe estar instalado en el equipo; se invoca la aplicación nativa, no basta con incorporar un JavaScript al ZIP. La documentación oficial confirma acceso al almacén del sistema, firma de PDF y selección de una zona visible.

Flujo propuesto: seleccionar PDF en nuestra app, pulsar «Firmar con AutoFirma», elegir el certificado instalado y confirmar en AutoFirma, recibir el PDF firmado y descargarlo. La app no debe pedir el P12 ni su contraseña para esta vía. El acceso a la clave privada queda a cargo del proveedor nativo, con los diálogos que este requiera.

La alternativa de implementar directamente un puente con Crypt32/SignedCms exigiría desarrollar y validar también la integración nativa y la construcción de la firma PDF. AutoFirma ya proporciona esas capacidades; es la opción recomendada para el objetivo de documentos administrativos del usuario.

## Decisión previa y alcance

Comprobación obtenida: el usuario confirma que el mismo certificado firma PDF en AutoFirma. Si ya lo hace habitualmente, basta con esa confirmación; no se necesita repetir diagnósticos del P12. Si no está comprobado, usar un PDF de prueba sin datos privados. No solicitar su certificado ni su contraseña.

Después: fijar una versión del componente oficial y sus licencias; implementar firma PAdES local de escritorio y retorno de bytes; conservar selección explícita de certificado y consentimiento; manejar cancelación, ausencia de AutoFirma y fallos de comunicación sin atribuirlos a una contraseña. No activar servicios intermedios o firma trifásica de ejemplos móviles ni enviar documentos a terceros como fallback. Confirmar el recorrido completo en Windows: abrir AutoFirma, elegir certificado, firmar, descargar y verificar el PDF en un lector independiente. Las pruebas simuladas no sustituyen esta comprobación.

Android/iOS requieren revisión independiente de sus aplicaciones y métodos de comunicación. No se infiere compatibilidad móvil a partir de la integración Windows.

## Fuentes primarias revisadas

- [Componentes oficiales: AutoFirma, AutoScript y servicios](https://github.com/ctt-gob-es/clienteafirma/wiki).
- [Descargas oficiales y manual de usuario 1.9](https://firmaelectronica.gob.es/descargas): uso del almacén, invocación externa y comunicación local cifrada con el navegador.
- [Selección de certificados](https://github.com/ctt-gob-es/clienteafirma/wiki/Help-desktop-select-certs).
- [Marca visible de firma PDF](https://github.com/ctt-gob-es/clienteafirma/wiki/Help-desktop-visible-pdf).
- [Problemas de ejecución e integración](https://github.com/ctt-gob-es/clienteafirma/wiki/Faq-autofirma-execution).

El 15/10/2026 el usuario autoriza subir los cambios a GitHub al terminar. El historial anterior se conserva para explicar el cambio de estrategia; no se presenta la lectura P12 anterior como corregida para ese certificado.
