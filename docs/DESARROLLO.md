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
| `signing-src/` | Fuente de la firma CMS |
| `scripts/vendor.mjs` | Motores y modelos fijados por el lockfile |
| `local/` | Lanzadores Python/Node |
| `tests/` | Motores, UI simulada y controladores HTTP |
| `scripts/package.py` | ZIPs con runtimes, licencias y hashes |

La app es estática: sin backend de conversión, base de datos, claves de API ni dependencias remotas durante el procesamiento. `dist/vendor/` se genera y se excluye del GitHub público para no almacenar binarios grandes. `npm ci && npm run build` produce la aplicación completa.

## Construcción y pruebas

Node 24 y npm; Python 3.10+; OpenSSL para las pruebas de firma. El lockfile fija dependencias e integridades.

```bash
npm ci
npm run build
npm test
python -B -m unittest discover -s tests -p test_launcher.py
python local/launcher.py
```

Usa `python3` si así se llama el ejecutable. La batería completa se ejecuta en Linux y genera certificados RSA sintéticos temporales. Algunas comprobaciones usan rutas Linux: en Windows, utiliza WSL o GitHub Actions para ejecutar la batería completa.

El módulo de firma usa el mismo `dist/vendor/pdf-lib.js` mediante un alias de esbuild. No elimines ese alias: duplicar clases de pdf-lib rompe ByteRange. Los iconos PNG se regeneran desde el SVG propio con `npm run build:icons`.

`python local/launcher.py` sirve `dist` y abre el navegador. Alternativa: `node local/server.mjs` (en Mac abre el navegador; en otros sistemas copia la URL impresa). Ambos escuchan solo en loopback, con token aleatorio y sin endpoints de subida. No los publiques como servidores accesibles por red.

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

Salida: `artifacts/*.zip` y `SHA256SUMS.txt`. Cada ZIP incluye `FILES-SHA256.txt`. El empaquetador verifica CRC y permisos ejecutables Mac. Construir en Linux no verifica la ejecución en otro sistema. El ZIP web está listo para alojamiento estático; los ZIP de escritorio no necesitan herramientas de desarrollo.

## GitHub Actions y Releases

`Validar y distribuir PDF` se ejecuta en pushes a main, pull requests y ejecución manual. Instala desde el lockfile, construye, prueba y empaqueta. Las pull requests solo validan y generan artifacts temporales.

En main, un segundo job publica la Release indicada en `release.json` si no existe. `contents: write` se limita a ese job y utiliza el `GITHUB_TOKEN` del repositorio, sin secretos personales. No sobrescribe versiones existentes.

Para actualizar:

1. Cambia `package.json`, lockfile, `release.json`, versión visible y `CHANGELOG.md`.
2. Añade `docs/releases/vVERSION.md` con cambios y límites.
3. Comprueba la matriz manual en `docs/VALIDACION.md`.
4. Integra en main y revisa Actions y Releases.

La primera versión es prerelease hasta comprobar los dispositivos reales. Mantén `prerelease: true` mientras corresponda. Si Actions está desactivado, el propietario debe activarlo; los comandos de empaquetado también funcionan localmente.

## Publicar la web

Aloja todo `dist/` en un servicio estático con HTTPS, con index.html en su raíz y MIME correctos para JS/MJS/WASM. No requiere claves ni variables de entorno. Las rutas relativas permiten alojar en subdirectorios como `/PDF/`.

GitHub Pages es una opción: activa Pages en los ajustes del repo y usa su workflow oficial para construir y publicar dist. El workflow incluido distribuye Releases: **no configura Pages**. La web enlazada en el README se aloja por separado; una Release no actualiza ese alojamiento automáticamente.

No hay service worker ni caché offline garantizada de la web. Los paquetes locales sí contienen todos los recursos.
