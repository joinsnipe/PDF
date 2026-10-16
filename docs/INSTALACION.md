# Instalar y utilizar PDF

La forma más rápida es [abrir la web](https://snipe-pdf.snipex.chatgpt.site). Para usarla sin conexión en un ordenador, descarga un paquete de [Releases](https://github.com/joinsnipe/PDF/releases).

## Windows

**Versión actual: 2.4.0-beta.4.** Descarga el paquete Windows de esta versión para actualizar también los accesos directos.

1. Descarga `PDF-2.4.0-beta.4-windows-x64.zip`.
2. Botón derecho en el ZIP → **Extraer todo**. Conserva juntos todos los archivos.
3. Abre la carpeta `PDF` y haz doble clic en **Instalar_PDF.cmd**, una sola vez.
4. Abre **PDF** desde el icono del escritorio o desde **Inicio → PDF Herramientas → PDF**.

Se abre en tu navegador sin mantener PowerShell ni una consola abiertos. La instalación copia la app a `%LOCALAPPDATA%\PDF-Herramientas`; después puedes eliminar el ZIP y su carpeta extraída. Añade PDF como opción de lectura sin cambiar el lector predeterminado. No se añade al arranque de Windows. Si ya existe un acceso directo ajeno llamado PDF, el instalador lo conserva y avisa.

Para abrir un documento desde Windows: botón derecho sobre el archivo `.pdf` → **Abrir con → Elegir otra aplicación → PDF** (el texto puede variar con la versión de Windows). Si quieres usarlo siempre, elige la opción correspondiente en ese diálogo. El archivo llega directamente al visor; si está protegido, te pide su contraseña. El original no se sobrescribe.

Para usarla sin instalar, abre **PDF.cmd** desde la carpeta extraída. También funciona en segundo plano, pero tendrás que conservar esa carpeta. El modo portátil no se registra en «Abrir con».

Abrir el mismo icono varias veces reutiliza el proceso de esa versión; puede abrir otra pestaña. Cerrar una pestaña no detiene el proceso local. Para cerrarlo, guarda tus resultados y pulsa **Salir de PDF**, al pie de la pantalla principal. Las otras pestañas de esa versión dejarán de funcionar; para volver a abrirla usa el icono PDF. También se detiene al cerrar la sesión de Windows. Un acceso web antiguo creado desde Chrome/Edge no sustituye este icono: su dirección local cambia al reiniciar la app.

Windows 10/11 de 64 bits y navegador actualizado. Instalación para el usuario actual, sin solicitar permisos de administrador. No necesitas Python/Node instalado; incluye Python 3.14.8 embebido. No se ha probado Windows ARM ni 32 bits. La creación real de accesos directos, el menú «Abrir con» y el arranque con `pythonw.exe` requieren todavía comprobación en Windows: las pruebas de este entorno son de lógica y archivos en Linux.

### Si el acceso directo aparece sin imagen

La revisión 2.4 beta 2 incluye el icono blanco y rojo en siete tamaños (16–256 px), con formatos compatibles con el lector de iconos de Windows. El instalador vuelve a asignarlo desde la carpeta instalada y notifica a Windows que actualice los accesos directos. No depende de la carpeta de Descargas.

Guarda tus documentos, usa **Salir de PDF**, extrae el ZIP actualizado y ejecuta **Instalar_PDF.cmd**. Usa el acceso **PDF** que crea el instalador; un acceso web antiguo del navegador es independiente. Si todavía aparece en blanco, cierra y vuelve a iniciar tu sesión de Windows. No hace falta borrar la caché del sistema ni tocar tus PDF. El resultado visual necesita comprobarse en Windows real.

## Mac

1. En ** → Acerca de este Mac**, mira el procesador: Apple M1/M2/M3/etc. → ZIP `macos-arm64`; Intel → ZIP `macos-x64`.
2. Descarga el ZIP correspondiente y extráelo entero.
3. Dentro de `PDF`, abre **PDF.command**. Se abre Terminal y después el navegador.
4. Mantén Terminal abierto. Para salir pulsa Ctrl+C y cierra la ventana.

Este paquete todavía no se ofrece como lector en «Abrir con» de macOS. Requiere macOS 13.5+ (runtime Node 24 incluido) y navegador actualizado. No necesitas instalar Node. El paquete no es una `.app` firmada/notarizada por el proyecto. Si macOS bloquea la apertura, sigue la opción específica de **Ajustes del Sistema → Privacidad y seguridad** después de intentar abrirlo, solo si reconoces el paquete. No desactives la protección general. [Guía oficial de Apple](https://support.apple.com/es-es/102445).

Si Terminal indica que `PDF.command` no es ejecutable, escribe `chmod +x ` en Terminal, arrastra ese archivo y pulsa Intro. El ZIP conserva permisos; algunas herramientas de extracción pueden cambiarlos. En equipos administrados consulta al responsable si la política impide abrir scripts.

## Android

1. Abre [PDF](https://snipe-pdf.snipex.chatgpt.site) en **Chrome**.
2. Pulsa **Instalar PDF**. Si Chrome muestra su confirmación, acepta.
3. Si aparece la ayuda, abre **⋮ → Añadir a pantalla de inicio**, o la opción de instalación que muestre tu versión.
4. Abre PDF desde su icono y selecciona archivos con el selector de Android.

Para guardar pulsa **Descargar** y revisa Descargas/Archivos. Si el navegador admite compartir archivos, aparece **Compartir archivo…**. No hay APK ni suscripción. Esta app web todavía no se registra como lector en «Abrir con» de Android; selecciona el documento dentro del visor.

## iPhone y iPad

1. Abre [PDF](https://snipe-pdf.snipex.chatgpt.site) en **Safari**.
2. Pulsa **Compartir**; puede estar dentro del menú del navegador.
3. Elige **Añadir a pantalla de inicio**. Si aparece **Abrir como app web**, actívalo y confirma **Añadir**.
4. Abre el icono **PDF**. Elige documentos en Archivos; si están en iCloud, espera a que se descarguen.

Para guardar, pulsa **Compartir archivo… → Guardar en Archivos** y elige una carpeta. El botón aparece cuando el navegador admite compartir ese archivo. Como alternativa, pulsa **Abrir resultado** y usa **Compartir → Guardar en Archivos** desde el lector de Safari. Si se ofrece descarga directa, consulta las descargas de Safari.

No hay IPA ni versión de App Store, ni integración con «Abrir en» desde Archivos; selecciona el documento dentro del visor. Instalar el icono no añade caché offline: necesitas conexión para cargarla. Las pruebas automáticas simulan estos flujos; su comportamiento final requiere prueba en un iPhone/iPad real. [Instrucciones oficiales de Apple](https://support.apple.com/es-es/guide/iphone/iph42ab2f3a7/ios).

## Firma con AutoFirma

En Windows o Mac instala AutoFirma desde su [página oficial](https://firmaelectronica.gob.es/descargas). En PDF, abre **Firmar con certificado → AutoFirma** y sigue la selección de certificado y zona visible en la aplicación nativa. Al terminar vuelve a la pestaña para descargar el resultado. [Guía y errores de comunicación](AUTOFIRMA.md). La versión móvil no incorpora esta conexión.

## Primera operación

1. Elige una herramienta, como **Imágenes a PDF**, **Marca de agua** o **Unir PDF**.
2. Añade archivos y ajusta opciones. En un PDF protegido introduce su contraseña conocida.
3. Procesa, espera a **Archivo preparado**, guarda y abre la copia para revisarla.

Los originales no se sobrescriben. Guarda el resultado antes de vaciar/cerrar la herramienta. No hay recuperación desde un historial.

## Problemas frecuentes

| Problema | Qué hacer |
| --- | --- |
| Faltan archivos | Extrae todo el ZIP; no abras el lanzador dentro del ZIP |
| index.html queda vacío | Inicia el lanzador: los módulos y workers necesitan HTTP local |
| No se abre el navegador | En Windows, PDF muestra un aviso con la dirección local; en Mac puedes copiarla de Terminal |
| Un icono antiguo deja de funcionar | Usa el acceso creado por Instalar_PDF.cmd; un acceso web del navegador no inicia la app local |
| No encuentro el resultado | Revisa Descargas/Archivos o usa Guardar como, Compartir o Abrir resultado |
| No aparece Instalar | Usa el menú del navegador; si ya está instalada el botón se oculta |
| No abre offline en móvil | La versión móvil requiere conexión para cargar la app |
| Se cierra con PDF grande | Reduce páginas o resolución; OCR e imágenes requieren más memoria |
| PDF protegido de una administración | Descárgalo desde su sede e introduce la contraseña del archivo, no las credenciales de la web |
| Firma de un documento oficial | Conserva el original: editar o desbloquear puede invalidar sus firmas |

## Actualizar o quitar

Web/móvil: cierra y vuelve a abrir con conexión. Mac: descarga el nuevo ZIP en una carpeta nueva, sin mezclar versiones; para quitarlo cierra Terminal y elimina su carpeta.

Windows: guarda tu trabajo, pulsa **Salir de PDF**, extrae la nueva versión y ejecuta **Instalar_PDF.cmd**. Se copia a otra carpeta de versión y se actualizan los accesos; no se sobrescribe una versión en ejecución. Para quitarla, elige antes otro lector predeterminado si usabas PDF. Abre **Inicio → PDF Herramientas → Quitar integración de PDF** para retirar «Abrir con»; también puedes ejecutar `Quitar_integracion_Windows.cmd` de la versión instalada. Después cierra PDF, elimina `%LOCALAPPDATA%\PDF-Herramientas` y los accesos PDF creados en el escritorio y en Inicio. Esta instalación por usuario no se registra todavía en la lista de aplicaciones de Windows. No se eliminan documentos de Descargas ni de otras carpetas del usuario.

## Office e IA en 2.4

Para DOCX/XLSX/PPTX a PDF instala LibreOffice desde https://www.libreoffice.org/download/download-libreoffice/ y abre el paquete de escritorio actualizado. En «Office a PDF», pulsa «Comprobar instalación». No se incluye LibreOffice en el ZIP. La web y los móviles no ejecutan este motor local.

Para IA abre «Resumir y entender», elige el modo IA, proveedor y modelo, pega tu propia clave, revisa el texto y autoriza la consulta. Necesita internet incluso desde un paquete local. El modo de frases locales sigue disponible sin cuenta. [Guía completa](IA-Y-OFFICE.md).

## Compartir la app

Pulsa **Compartir** arriba a la derecha, también disponible en móvil y al abrirla como app instalada. Si el navegador permite compartir, abre el menú nativo para elegir una aplicación o destinatario. Si no lo permite, aparece el enlace con **Copiar enlace**; cuando el portapapeles está bloqueado, puedes seleccionarlo y copiarlo manualmente.

Comparte siempre la dirección pública de PDF Contigo, también desde el paquete local de Windows/Mac. No incorpora documentos ni direcciones de sesión. Para compartir un resultado PDF, utiliza **Compartir archivo…** después de procesarlo.

## ¿Depende de ChatGPT Pro o de una web activa?

Los paquetes Windows/Mac llevan los motores y recursos de PDF. Las herramientas habituales no comprueban una cuenta de ChatGPT ni necesitan que siga activa la web pública. Puedes conservar y redistribuir el ZIP bajo sus licencias. IA externa requiere tu clave, conexión y condiciones del proveedor; Office/AutoFirma requieren sus programas locales.

Android/iPhone utilizan actualmente la web añadida a inicio: necesitan que siga disponible el alojamiento, no son una app nativa con todos los recursos incluidos. No se garantiza que un alojamiento externo sea permanente ni que su disponibilidad se conserve tras cambiar la suscripción del propietario. Puedes alojar el paquete `web` en un servicio HTTPS propio; desde beta 6 la IA conecta directamente con el proveedor, sujeta a CORS.
