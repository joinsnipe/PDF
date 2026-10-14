# Contribuir a PDF

Abre una issue o pull request describiendo problema, cambio y comprobación. Mantén los textos en español, el nombre PDF y la interfaz blanca y roja. Sigue [la guía técnica](docs/DESARROLLO.md).

Conserva el procesamiento local. Una función que envíe documentos a terceros debe plantearse expresamente antes de incorporarla. Evita telemetría y dependencias externas durante el uso.

No adjuntes documentos personales, claves, certificados ni contraseñas. Utiliza muestras mínimas ficticias y certificados temporales en pruebas.

Si cambias una operación, verifica contenido y páginas de salida; si cambias descargas, bytes, nombre y reutilización. El DOM simulado complementa la prueba real de navegador. Documenta límites sin prometer equivalencia total con productos comerciales.

Conserva licencias. Revisa lockfile, hashes y avisos al actualizar dependencias. No subas node_modules, cachés, paquetes de distribución o archivos de usuario.
