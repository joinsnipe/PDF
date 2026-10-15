# PDF ficticios para comprobar compatibilidad

Generados con `generate.py`, pypdf 6.10.0 y cryptography 50.0.2. No contienen datos privados: una página con el texto «PRUEBA SEGURIDAD PDF» y metadatos genéricos. Se publica únicamente el generador; los PDF cifrados se crean localmente y quedan excluidos de Git.

Instala `python3 -m pip install -r tests/requirements.txt` antes de ejecutar la batería. `npm test` regenera los cinco documentos mediante `pretest`; GitHub Actions hace lo mismo. Se mantiene un motor distinto de qpdf para comprobar la interoperabilidad sin publicar documentos cifrados.

| Archivo | Cifrado | Contraseña de apertura |
| --- | --- | --- |
| aes256-unicode.pdf | AES-256 | Contraseña-á€2026 |
| aes128-latin1.pdf | AES-128 | Señal-2026 |
| rc4-128.pdf | RC4-128 | Clave-2026 |
| rc4-40.pdf | RC4-40 | Clave-2026 |
| aes256-empty.pdf | AES-256 | vacía |

La contraseña de propietario ficticia es `Propietario-2026` en todos los casos. RC4 solo se incluye para probar lectura de archivos antiguos; la app crea nuevos archivos con AES-256.
