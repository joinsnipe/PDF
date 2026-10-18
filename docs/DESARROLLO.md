# Desarrollo, empaquetado y publicación

## Estructura

| Ruta | Responsabilidad |
| --- | --- |
| `dist/index.html`, `style.css` | Interfaz responsive, Arial, blanco y rojo |
| `dist/app.js`, `advanced-ui.js` | Selección, opciones, procesos y descargas |
| `dist/core.js`, `advanced.js` | Operaciones PDF y límites |
| `dist/render.js` | PDF.js, renderizado y extracción |
| `dist/qpdf-worker.js`, `sign-worker.js` | Cifrado/reparación y firma |
| `dist/mobile.js`, manifiesto e iconos | Instalación web y marca |
| `dist/autofirma*.js`, `autofirma-bridge.html` | Adaptador local de AutoFirma y marco con CSP restringida |
| `third_party/autofirma/` | AutoScript oficial sin modificar, fuente fijada y licencias |
| `signing-src/` | Fuente de la firma CMS |
| `scripts/vendor.mjs` | Motores y modelos fijados por el lockfile |
| `local/` | Lanzadores Python/Node |
| `tests/` | Motores, UI simulada y controladores HTTP |
| `scripts/package.py` | ZIPs con runtimes, licencias y hashes |

El cliente PDF sigue siendo estático. `dist/ai-provider.js` implementa los seis proveedores en el cliente. `hosting/` entrega la web mediante Vinext/Cloudflare Workers; el antiguo `server/ai-service.mjs` solo responde 410, sin leer cuerpos ni ejecutar peticiones externas. `local/office.py` y `local/office.mjs` ejecutan LibreOffice opcionalmente. `dist/vendor/` se genera y se excluye del GitHub público para no almacenar binarios grandes. Instala las dependencias de raíz y `hosting/` para construir la web completa.

## Construcción y pruebas

Node 24 y npm; Python 3.10+; OpenSSL para las pruebas de firma. El lockfile fija dependencias e integridades.

```bash
npm ci
npm ci --prefix hosting
npm run build
python3 -m pip install -r tests/requirements.txt
npm test
python -B -m unittest discover -s tests -p 'test_*.py'
python local/launcher.py
```

Usa `python3` si así se llama el ejecutable. La batería completa se ejecuta en Linux y genera certificados RSA sintéticos temporales. Algunas comprobaciones usan rutas Linux: en Windows, utiliza WSL para ejecutar la batería completa. GitHub Actions permanece pausado desde el 18 de octubre de 2026.

`npm test` ejecuta primero el generador Python de cinco PDF ficticios cifrados. Solo se publica su código fuente: los documentos generados se excluyen de Git y no se distribuyen con la app. Las dependencias Python de `tests/requirements.txt` solo son necesarias para las pruebas.

El módulo de firma usa el mismo `dist/vendor/pdf-lib.js` mediante un alias de esbuild. No elimines ese alias: duplicar clases de pdf-lib rompe ByteRange. Los iconos PNG se regeneran desde el SVG propio con `npm run build:icons`.

`python local/launcher.py` sirve `dist` y abre el navegador. Alternativa: `node local/server.mjs` (en Mac abre el navegador; en otros sistemas copia la URL impresa). Ambos escuchan solo en loopback, con token aleatorio. La conversión Office acepta bytes del documento bajo controles de origen y tamaño; no recibe rutas del sistema. No los publiques como servidores accesibles por red.

## Paquetes

Después de construir:

```bash
python scripts/package.py
# O una sola distribución:
python scripts/package.py --platform windows-x64
python scripts/package.py --platform macos-arm64
python scripts/package.py --platform macos-x64
python scripts/package.py --platform web
```

Se descargan runtimes oficiales desde python.org y nodejs.org y se comprueban hashes SHA-256 fijados en el código. Windows incorpora Python embebido 3.14.8 x64; Mac, Node 24.19.0 de su arquitectura, sin npm. Se conservan sus licencias. Revisa fuente, versión y hash al actualizar runtimes.

Salida: `artifacts/*.zip` y `SHA256SUMS.txt`. Cada ZIP incluye `FILES-SHA256.txt`. El empaquetador verifica CRC y permisos ejecutables Mac. Construir en Linux no verifica la ejecución en otro sistema. El ZIP web contiene el cliente para alojamiento estático (sin backend de IA); los ZIP de escritorio no necesitan herramientas de desarrollo.

## GitHub Actions y Releases

**Automatización pausada desde el 18 de octubre de 2026 por instrucción expresa de no generar más gasto.** No reactivar Actions, reejecutar trabajos históricos ni publicar nuevas versiones sin autorización del propietario después de verificar los límites de facturación. [Auditoría y alcance](MANTENIMIENTO-2026-10-18.md).

Los dos workflows conservan el procedimiento para referencia, pero solo admiten `workflow_dispatch` y todos sus jobs tienen `if: ${{ false }}`. Los pushes y pull requests ya no disparan estas automatizaciones. Incluso una ejecución manual de estas definiciones omite los jobs antes de asignar un runner. Esta pausa del código no cambia los presupuestos globales ni impide que alguien reejecute una definición histórica: el propietario debe comprobar el límite de gasto de Actions en Billing.

No se han borrado Releases, paquetes públicos, etiquetas ni código de la aplicación. La web se aloja por separado y sigue con la versión publicada; no se requiere un nuevo despliegue para esta pausa. Las pruebas y el empaquetado se pueden realizar localmente cuando corresponda, sin GitHub Actions.

El procedimiento conservado publica paquetes directamente en GitHub Releases solo cuando hay una versión nueva y completa. No utiliza artefactos temporales de Actions ni caché npm. Antes de una futura entrega autorizada:

1. Verifica el presupuesto y la política de ejecución con el propietario.
2. Cambia `package.json`, lockfile, `release.json`, versión visible y `CHANGELOG.md`.
3. Añade `docs/releases/vVERSION.md` con cambios y límites.
4. Comprueba localmente las pruebas y la matriz de `docs/VALIDACION.md`.
5. Acuerda la vía de publicación; no retires la pausa como parte incidental de otra corrección.

Mantén `prerelease: true` mientras no estén comprobados los dispositivos reales.

## Publicar la web

Aloja todo `dist/` en un servicio estático con HTTPS, con index.html en su raíz y MIME correctos para JS/MJS/WASM. Las herramientas locales no requieren claves ni variables de entorno. Desde beta 6 la IA directa también funciona en un alojamiento estático si el proveedor admite CORS; no requiere `/api/ai`. Las rutas relativas permiten alojar en subdirectorios como `/PDF/`.

GitHub Pages sería una opción futura, previa autorización para activar sus automatismos. No lo actives durante la pausa de gasto. El workflow incluido distribuye Releases: **no configura Pages**. La web enlazada en el README se aloja por separado; una Release no actualiza ese alojamiento automáticamente.

No hay service worker ni caché offline garantizada de la web. Los paquetes locales sí contienen todos los recursos.

La integración AutoFirma se prueba con el cliente oficial y un WebSocket simulado; `tests/autofirma.test.mjs` cubre el protocolo y el retorno. No configura servicios intermedios. La prueba nativa completa requiere Windows/Mac y AutoFirma instalada; véase `docs/AUTOFIRMA.md`. Mantén intactos los bytes firmados y no conviertas un error de comunicación en error de contraseña.

## IA directa y extensibilidad

`dist/ai-contract.js` define proveedores y valida citas; `dist/ai-ui.js` exige revisión y consentimiento; `dist/ai-client.js` llama directamente al proveedor desde web/móvil o al conector de la propia sesión local de escritorio. `dist/ai-provider.js` fija los destinos y formatos de los seis proveedores. `local/ai.py` y `local/ai.mjs` permiten únicamente las rutas y cabeceras de `local/ai-policy.json`, sin endpoints arbitrarios, redirecciones, reintentos ni secretos compartidos. El endpoint local exige sesión aleatoria, Host, origen, cabecera específica, JSON y límite de 512 KiB. Las respuestas se acotan a 1 MiB (16 KiB en errores). Los modelos se consultan con la clave del usuario; se puede escribir el identificador manualmente. Las peticiones llevan un máximo de 60.000 caracteres/100 páginas y 4.096 tokens de salida. No se activan herramientas, navegación ni acciones del modelo. Una cita que no aparece en su página hace rechazar el informe completo; esto no valida la interpretación.

Para añadir un proveedor, incorpora su etiqueta, endpoint y adaptadores de autenticación, listado, petición y respuesta, y actualiza la CSP y `local/ai-policy.json`. Añade fixtures en `tests/ai.test.mjs` y verifica la paridad de ambos conectores en `tests/ai-transport.test.mjs`. No uses una clave común en JavaScript, ni añadas registros de cuerpos de petición. Claude admite el workspace opcional para claves que lo requieren. No se guardan claves de servidor en este proyecto.

`npm run build:client` basta para los ZIP locales o el cliente estático. `npm run build` prepara también `dist/client` y `dist/server`, que no se incluyen en los ZIP de escritorio. `scripts/build-hosting.mjs` copia el cliente a `hosting/public`, ejecuta el build de Vinext conservando la integración `sites()` y recoge el Worker. No añadas un relay compartido al alojar una copia: la IA del cliente utiliza los destinos HTTPS declarados en la CSP. Las políticas CORS externas pueden bloquear web/móvil; los conectores de escritorio operan desde el equipo del usuario. El servicio retirado se mantiene solo para indicar que los clientes antiguos deben actualizarse.

Para pruebas de conversión real instala LibreOffice (Writer, Calc e Impress). El procedimiento de CI conservado (actualmente pausado) lo instala, genera DOCX/XLSX/PPTX ficticios y convierte con ambos adaptadores; no distribuye esos archivos. Las pruebas de IA usan respuestas simuladas, no consumen APIs reales. Ver `docs/VALIDACION.md`.
