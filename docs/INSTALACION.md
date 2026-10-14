# Instalar y utilizar PDF

La forma más rápida es [abrir la web](https://snipe-pdf.snipex.chatgpt.site). Para usarla sin conexión en un ordenador, descarga un paquete de [Releases](https://github.com/joinsnipe/PDF/releases).

## Windows

1. Descarga `PDF-2.2.0-beta.1-windows-x64.zip` en **Assets**. «Source code» es para desarrolladores.
2. Botón derecho en el ZIP → **Extraer todo**. Conserva juntos todos los archivos.
3. Abre la carpeta `PDF` y haz doble clic en **PDF.cmd**.
4. Se abre el navegador. Mantén abierta la consola mientras trabajas; ciérrala para terminar.

Windows 10/11 de 64 bits y navegador actualizado. No necesita instalación, permisos de administrador ni Python/Node instalado. Incluye Python 3.14.8 embebido. No se ha probado Windows ARM ni 32 bits.

## Mac

1. En ** → Acerca de este Mac**, mira el procesador: Apple M1/M2/M3/etc. → ZIP `macos-arm64`; Intel → ZIP `macos-x64`.
2. Descarga el ZIP correspondiente y extráelo entero.
3. Dentro de `PDF`, abre **PDF.command**. Se abre Terminal y después el navegador.
4. Mantén Terminal abierto. Para salir pulsa Ctrl+C y cierra la ventana.

Requiere macOS 13.5+ (runtime Node 24 incluido) y navegador actualizado. No necesitas instalar Node. El paquete no es una `.app` firmada/notarizada por el proyecto. Si macOS bloquea la apertura, sigue la opción específica de **Ajustes del Sistema → Privacidad y seguridad** después de intentar abrirlo, solo si reconoces el paquete. No desactives la protección general. [Guía oficial de Apple](https://support.apple.com/es-es/102445).

Si Terminal indica que `PDF.command` no es ejecutable, escribe `chmod +x ` en Terminal, arrastra ese archivo y pulsa Intro. El ZIP conserva permisos; algunas herramientas de extracción pueden cambiarlos. En equipos administrados consulta al responsable si la política impide abrir scripts.

## Android

1. Abre [PDF](https://snipe-pdf.snipex.chatgpt.site) en **Chrome**.
2. Pulsa **Instalar PDF**. Si Chrome muestra su confirmación, acepta.
3. Si aparece la ayuda, abre **⋮ → Añadir a pantalla de inicio**, o la opción de instalación que muestre tu versión.
4. Abre PDF desde su icono y selecciona archivos con el selector de Android.

Para guardar pulsa **Descargar** y revisa Descargas/Archivos. Si el navegador admite compartir archivos, aparece **Compartir archivo…**. No hay APK ni suscripción.

## iPhone y iPad

1. Abre [PDF](https://snipe-pdf.snipex.chatgpt.site) en **Safari**.
2. Pulsa **Compartir**; puede estar dentro del menú del navegador.
3. Elige **Añadir a pantalla de inicio**. Si aparece **Abrir como app web**, actívalo y confirma **Añadir**.
4. Abre el icono **PDF**. Elige documentos en Archivos; si están en iCloud, espera a que se descarguen.

Para guardar, pulsa **Compartir archivo… → Guardar en Archivos** y elige una carpeta. El botón aparece cuando el navegador admite compartir ese archivo. Como alternativa, pulsa **Abrir resultado** y usa **Compartir → Guardar en Archivos** desde el lector de Safari. Si se ofrece descarga directa, consulta las descargas de Safari.

No hay IPA ni versión de App Store. Instalar el icono no añade caché offline: necesitas conexión para cargarla. Las pruebas automáticas simulan estos flujos; su comportamiento final requiere prueba en un iPhone/iPad real. [Instrucciones oficiales de Apple](https://support.apple.com/es-es/guide/iphone/iph42ab2f3a7/ios).

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
| No se abre el navegador | Copia la dirección de la consola y mantén esa ventana abierta |
| No encuentro el resultado | Revisa Descargas/Archivos o usa Guardar como, Compartir o Abrir resultado |
| No aparece Instalar | Usa el menú del navegador; si ya está instalada el botón se oculta |
| No abre offline en móvil | La versión móvil requiere conexión para cargar la app |
| Se cierra con PDF grande | Reduce páginas o resolución; OCR e imágenes requieren más memoria |
| PDF protegido de una administración | Descárgalo desde su sede e introduce la contraseña del archivo, no las credenciales de la web |
| Firma de un documento oficial | Conserva el original: editar o desbloquear puede invalidar sus firmas |

## Actualizar o quitar

Web/móvil: cierra y vuelve a abrir con conexión. Escritorio: descarga el nuevo ZIP en una carpeta nueva, sin mezclar versiones. Para quitarla, cierra el lanzador y elimina la carpeta o el icono web. Los documentos descargados quedan en la ubicación elegida y no se borran automáticamente.
