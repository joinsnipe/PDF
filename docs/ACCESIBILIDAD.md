# Accesibilidad y lectura cómoda

PDF Contigo incorpora mejoras para leer y manejar la interfaz con menos esfuerzo. Desde 2.4.0-beta.6, el acceso **Accesibilidad · lectura cómoda** aparece debajo del título, también en móvil.

| Ajuste | Efecto |
| --- | --- |
| Texto más grande | Amplía textos y controles; las herramientas pasan a una columna en móvil |
| Más contraste | Oscurece textos y bordes y usa rojo oscuro en acciones |
| Reducir movimiento | Desactiva animaciones y transiciones de la interfaz |
| Restablecer | Quita esos ajustes y borra sus preferencias guardadas |

Se respeta la reducción de movimiento del sistema aunque no marques la opción. Los cambios afectan a la interfaz, no a los documentos ni a la apariencia de las páginas exportadas. El zoom del navegador sigue disponible.

## Teclado y lectura de texto

- El primer enlace permite **Saltar al contenido** y llevar allí el foco.
- Los controles, enlaces, desplegables y áreas de texto tienen un contorno visible al enfocarlos con teclado.
- Los cuadros de diálogo usan títulos accesibles; los estados de proceso y errores se anuncian mediante regiones de estado. La barra de progreso tiene nombre.
- En **Visor de PDF**, abre **Texto de esta página**. Es texto seleccionable que admite foco de teclado y se ajusta al ancho. El lector de pantalla puede recorrerlo; la imagen del lienzo no sustituye este texto.
- Los escaneados sin texto necesitan OCR. El orden extraído de columnas o tablas puede ser incorrecto; contrasta con el original.

Se recuerdan únicamente tres preferencias visuales en el navegador. Si no permite almacenamiento, funcionan para esa visita. Las claves de IA y los documentos no forman parte de esas preferencias. El origen del lanzador local puede cambiar entre aperturas y, por tanto, no recuperar la misma preferencia. [Privacidad](PRIVACIDAD.md).

## Alcance y comprobación

Se comprueban en DOM la aplicación, restauración y borrado de preferencias; la alternativa cuando el almacenamiento está bloqueado; el enlace de salto, los nombres de controles y el progreso. El flujo de las herramientas se cubre con pruebas funcionales simuladas.

Queda por comprobar en dispositivos reales: teclado completo, foco y cierre de diálogos, VoiceOver/TalkBack/NVDA, contraste de todos los estados, zoom al 200–400 % y reflujo en pantallas pequeñas. No se ha realizado una auditoría WCAG ni se declara conformidad WCAG o PDF/UA. Estas mejoras no crean etiquetas, descripciones de imágenes ni estructura accesible dentro de un PDF.

Si encuentras una barrera, abre una issue con herramienta, navegador, sistema y pasos; utiliza un documento ficticio sin datos personales.
