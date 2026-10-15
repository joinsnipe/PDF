# Componentes de terceros

El código propio usa MIT. Esa licencia no sustituye las licencias de las dependencias. Los textos completos se conservan en `licenses/` y se copian a `dist/vendor/` durante la construcción (`app/vendor/` en paquetes de escritorio).

| Componente | Versión fijada | Licencia / origen |
| --- | --- | --- |
| pdf-lib | 1.17.1 | MIT — https://github.com/Hopding/pdf-lib |
| AutoScript | 1.9.0, tag oficial v1.9 | GPL-2.0 (alternativa elegida); fuente íntegra sin modificar y licencia en third_party/autofirma — https://github.com/ctt-gob-es/clienteafirma |
| PDF.js legacy | 5.6.205 | Apache-2.0 — https://github.com/mozilla/pdf.js |
| JSZip | 3.10.1 | MIT (opción elegida) — https://github.com/Stuk/jszip |
| Tesseract.js y core | 7.0.0 | Apache-2.0 — https://github.com/naptha/tesseract.js |
| Modelos spa/eng | paquetes 1.0.0, best_int | Apache-2.0 — https://github.com/naptha/tessdata |
| qpdf WASM | wrapper 0.3.0 / motor 12.2.0 | qpdf Apache-2.0 y NOTICE; wrapper declara ISC en su package.json — https://github.com/neslinesli93/qpdf-wasm |
| @signpdf | 3.3.0 | MIT — https://github.com/vbuch/node-signpdf |
| node-forge | 1.4.0 | BSD-3-Clause (opción elegida) — https://github.com/digitalbazaar/forge |
| buffer / base64-js | 6.0.3 / versión del lockfile | MIT |
| ieee754 | versión del lockfile | BSD-3-Clause |
| Python Windows | 3.14.8 x64 | PSF y avisos incluidos en runtime/LICENSE.txt — https://www.python.org/ |
| Node Mac | 24.19.0 arm64/x64 | MIT y avisos incluidos en runtime/LICENSE — https://nodejs.org/ |

PDF.js incluye fuentes, mapas y motores WASM con avisos adicionales dentro de sus carpetas. La construcción también conserva archivos LICENSE/NOTICE de paquetes instalados en `vendor/legal/`, con su versión y procedencia. Las herramientas de desarrollo y sus dependencias están fijadas en `package-lock.json` y conservan sus licencias originales.

El wrapper de qpdf declara ISC pero su paquete no incluye un archivo LICENSE independiente; se conserva su declaración en `vendor/qpdf/SOURCE.json`, además de la licencia y NOTICE de qpdf. No se atribuye autoría propia sobre estas bibliotecas.

La portada e icono vectorial del proyecto forman parte del código propio. No se incluyen logotipos, recursos gráficos o código de iLovePDF. No se distribuyen PDFs personales ni certificados de prueba privados.

AutoFirma nativa no se redistribuye: se instala por separado desde su web oficial. AutoScript se distribuye con su código fuente completo, procedencia y GPL-2.0; sus términos se conservan en el paquete construido. MIT se refiere al código propio de PDF y no sustituye las obligaciones de GPL del componente distribuido.
