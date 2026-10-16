# Mantenimiento PDF · 16 de octubre de 2026

## Alcance autorizado

Solo `joinsnipe/PDF` y su web PDF Contigo. No se cambia `snipe_app`, otros repositorios ni presupuestos de facturación de la cuenta.

## Causa del error de IA

`server/ai-service.mjs` enviaba las peticiones con `redirect: 'error'`. Node admite esa opción, pero workerd la rechaza al construir la petición. El catch convertía la excepción en `AI_NETWORK`, ocultando que no se había contactado con el proveedor. Las pruebas anteriores usaban fetch simulado y no detectaban la incompatibilidad.

Se reprodujo el error en el motor instalado con Miniflare/workerd. La corrección usa `manual` y rechaza cualquier respuesta 3xx sin seguir su Location. La prueba `tests/ai-worker.test.mjs` ejecuta el adaptador real en workerd, con un proveedor ficticio por outboundService: verifica listar modelos, generar un informe citado, bloquear redirecciones y distinguir saldo. No hace llamadas de pago ni usa claves reales.

Los errores HTTP se leen con límite de 16 KiB y se clasifican por estado/código. No se devuelven mensajes brutos del proveedor que puedan contener claves o datos. No se reintenta ni se cambia de proveedor. Solo una consulta autorizada de resumen puede generar consumo en el proveedor; la selección de modelos no verifica saldo ni garantiza gratuidad de futuras consultas.

Referencia del runtime: https://github.com/cloudflare/workerd/blob/main/src/workerd/api/http.c%2B%2B

## Acumulación de paquetes

El workflow anterior construía y subía `PDF-distributions` en cada push, con 14 días de retención, antes de comprobar si la versión ya existía. El inventario incluye diez ejecuciones del 14–15 de octubre. Nueve corresponden a versiones publicadas con cuatro ZIP y SHA256SUMS; la restante, `1ba5486`, solo cambió README sobre `v2.3.0-beta.4` y volvió a empaquetar esa versión.

Inventario exacto, IDs, tamaños y referencias: `scripts/actions-cleanup-20261016.json`.

Suma del inventario: **1.941.340.802 bytes** (aproximadamente 1,94 GB decimales). La ejecución de limpieza registra cuántos siguen presentes y cuántos se eliminan; la caducidad o una limpieza previa pueden reducir esa cantidad.

La limpieza verifica todos los elementos antes de borrar el primero: repositorio e ID de origen, rama, SHA, ejecución completada con éxito, nombre/tamaño y versión pública con todos los archivos esperados. Solo borra esos IDs de artefacto. También elimina cachés `node-cache-*` de este repositorio; son dependencias reproducibles y ya no se generan. No elimina ejecuciones/logs, versiones, etiquetas, historial ni código. Es idempotente: puede repetirse desde «Limpiar temporales de PDF» y deja el resultado en el resumen de Actions.

## Política a partir de esta versión

1. Los cambios de código y las PR se construyen y prueban. Los cambios exclusivamente Markdown o imágenes de documentación no activan el workflow de distribución.
2. En main, el trabajo release consulta primero la etiqueta de `release.json`. Solo una respuesta 404 permite crear una versión. Un error de API, borrador incompleto o archivos faltantes detiene la publicación.
3. Si existe una versión completa, no se instalan dependencias ni se crean ZIP en ese trabajo.
4. Para una versión nueva, se construye el cliente, se empaqueta y se sube directamente a un borrador de GitHub Releases. Se publica cuando termina la subida. No usa upload-artifact/download-artifact, caché npm ni almacenamiento intermedio de Actions.
5. Los paquetes temporales quedan únicamente en el disco del runner y desaparecen al terminar el trabajo. Las descargas públicas se conservan en Releases.

Si falla una subida, revisar el borrador y sus archivos antes de reejecutar: no se sobrescribe una versión por automatismo. Para una nueva entrega, actualizar package.json, package-lock.json, release.json, la etiqueta visible y sus notas. Mantener las pruebas.

Eliminar archivos reduce el almacenamiento actual; no anula consumo ya acumulado en el ciclo. No se ha verificado ni modificado el presupuesto global de la cuenta. Este cambio elimina la acumulación descrita, pero no constituye una garantía de facturación cero para otros productos o repositorios.

Referencias: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/remove-workflow-artifacts · https://docs.github.com/en/billing/concepts/product-billing/github-actions

## Validación previa a publicar

Construcción completa aprobada, 147 pruebas JavaScript y 25 Python aprobadas en Linux, sin omisiones. Incluye conversiones Office ficticias con LibreOffice, interacción de la configuración IA simulada, adaptador IA en workerd y rechazo de planes de limpieza con repositorio, ejecución o descarga incorrectos. No se ha probado una consulta autenticada con la cuenta de Rubén ni se presenta esa prueba como realizada.

## Resultado ejecutado y verificado

- Commit de código: `584309e1932d55e92dba4983f6cfeff090c6ae9e`.
- [Limpieza completada](https://github.com/joinsnipe/PDF/actions/runs/38940727756): eliminados los 10 artefactos (1.941.340.802 bytes) y 9 cachés npm (1.785.988.024 bytes). Total temporal retirado: 3.727.328.826 bytes. Una consulta posterior confirmó 0 artefactos en cada una de las diez ejecuciones.
- [Validación y distribución completadas](https://github.com/joinsnipe/PDF/actions/runs/38940727748): 147 pruebas JavaScript y 25 Python aprobadas también en GitHub. La nueva ejecución conserva **0 artefactos**.
- [Release v2.4.0-beta.5](https://github.com/joinsnipe/PDF/releases/tag/v2.4.0-beta.5): cuatro ZIP y SHA256SUMS publicados, sin borrador, vinculados al commit de código. Las versiones previas se conservan.
- Web PDF Contigo publicada correctamente como versión Sites 13, fuente `4213b32893dc68c4016fdc1279f44b894ff82e55`: https://snipe-pdf.snipex.chatgpt.site .
- No se han usado claves reales, consultas de IA de pago ni presupuestos globales. No se han modificado otros repositorios. La prueba autenticada de la cuenta del usuario y la revisión visual/nativa de navegador no se han realizado desde este entorno.

Esta anotación solo modifica Markdown: no necesita otra compilación ni otros paquetes.
