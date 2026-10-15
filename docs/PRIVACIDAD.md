# Privacidad

Las herramientas de edición de PDF procesan archivos en la memoria del navegador; la vía AutoFirma de escritorio delega la firma en la aplicación nativa instalada. El código no envía documentos, certificados ni contraseñas a una API de conversión. No incorpora analítica, cuentas, publicidad, historial ni guardado de documentos en almacenamiento web. Motores, fuentes y modelos OCR se sirven junto a la aplicación.

La versión web descarga la aplicación de su alojamiento. El alojamiento recibe solicitudes de recursos y los datos técnicos habituales de conexión, como IP. Esto no equivale a subir el PDF. GitHub aloja el repositorio y las descargas bajo sus propias condiciones.

Los paquetes locales funcionan sin Internet. Su servidor escucha solo en 127.0.0.1 con puerto y ruta aleatorios. Rechaza otros Host, recorridos fuera de la carpeta y listados. Sirve los recursos de la aplicación. En Windows permite consultar si PDF está abierto, cerrarlo y entregar al visor el documento que has elegido mediante «Abrir con». El cierre exige la ruta de sesión, el origen local, una cabecera específica y una petición sin contenido.

La revisión de escritorio 4 guarda en `%LOCALAPPDATA%\PDF-Herramientas\state` la dirección local de la instancia, una clave aleatoria de comunicación entre lanzadores y un archivo de bloqueo para evitar procesos duplicados. No contienen documentos, contraseñas ni certificados. La dirección se elimina al terminar normalmente; un cierre abrupto puede dejar ese pequeño archivo de estado, que se reemplaza al reiniciar. La app sigue en segundo plano hasta pulsar **Salir de PDF** o cerrar la sesión de Windows. No se inicia automáticamente al encender el equipo.

Al usar «Abrir con» en Windows, el lanzador lee exclusivamente el PDF seleccionado y envía sus bytes al proceso de PDF en el mismo ordenador, nunca a un servicio externo. El servidor no admite rutas de archivos recibidas del navegador. La entrega requiere una clave local que no se proporciona a la página. Solo transmite el nombre del archivo, sin su ruta. El documento pendiente se conserva en memoria hasta que el visor lo recoge una vez, o durante un máximo de dos minutos; límite conjunto de 100 MB y ocho documentos pendientes. Después permanece en el visor mientras lo uses. No se crea una copia temporal en disco.

Cerrar o vaciar una herramienta libera referencias y enlaces; no garantiza borrado físico de memoria. Las descargas quedan donde las guardes y pueden sincronizarse con iCloud/OneDrive si eliges esas carpetas. **Compartir archivo** abre el menú del dispositivo: el destino elegido puede enviar el documento a terceros.

Contraseñas y certificados se usan para la operación actual. No hay recuperación de contraseñas. El visor desactiva la evaluación de scripts de PDF; no es un sanitizador ni un producto auditado de seguridad.

El repositorio y la web públicos no publican los documentos de visitantes. No adjuntes información personal a issues o pull requests: usa muestras ficticias.

## Firma con AutoFirma

Al confirmar una firma, el PDF pasa por una conexión WebSocket cifrada a AutoFirma en `127.0.0.1`, en el mismo ordenador. El componente oficial se carga desde los archivos de PDF, no desde un CDN. No se configuran servidores intermedios, firma trifásica ni servicio de sello de tiempo. Una política CSP limita las conexiones del componente a ese destino local. La app recibe el PDF firmado y lo conserva en memoria hasta que lo guardes o cierres. No recibe el P12, la contraseña ni la clave privada para esta vía. La elección del certificado y cualquier PIN se realizan en AutoFirma. AutoFirma mantiene sus propias preferencias, registros y conexiones de validación; PDF no sustituye su política de privacidad.
