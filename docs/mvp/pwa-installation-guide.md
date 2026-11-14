# Instalar y desinstalar Nodia

Estado: instrucciones para el candidato PWA-001. La publicación y las pruebas
de instalación por dispositivo se registran en [plan103](103-pwa-progressive-implementation-plan.md).
La presencia de estos pasos no acredita soporte comprobado en una plataforma.

## Qué ofrece la primera entrega

Nodia se instala con su nombre e icono y puede abrirse en una ventana propia.
Mantiene las funciones online y los permisos de tu cuenta. **Necesita conexión
a internet**: esta entrega no permite consultar datos ni guardar operaciones
sin red, y no incorpora notificaciones push.

Usa el origen público acordado, [Nodia](https://nodia-1ge.pages.dev/), cuando la
versión PWA esté publicada. Un enlace de preview o un servidor local sirve para
pruebas y crea una instalación distinta; no lo confundas con la app pública.

## Windows con Chrome o Edge

1. Abre Nodia desde el navegador y espera a que cargue.
2. Usa el control de instalación de la barra de direcciones o busca la acción
   de instalar esta página como aplicación en el menú del navegador. Su nombre
   y ubicación dependen de la versión del navegador.
3. Revisa que aparezcan **Nodia** y la N turquesa/azul/violeta y confirma.
4. Cierra la ventana y vuelve a abrir Nodia desde el acceso de aplicaciones de
   Windows. Debe abrir una ventana propia y resolver tu sesión o mostrar login.

Si sólo se crea un enlace que abre una pestaña normal, no se ha comprobado la
instalación standalone. La ausencia de un banner automático no demuestra un
fallo: usa los controles del navegador. Si no aparece la acción, registra
navegador/versión y origen y revisa su compatibilidad.

Para desinstalar, usa la administración de aplicaciones del navegador o
**Configuración → Aplicaciones** de Windows y selecciona Nodia. Revisa cualquier
opción adicional de borrar datos antes de confirmarla.

## Android con Chrome

1. Abre la dirección de Nodia en Chrome.
2. Desde su menú, usa la opción de instalar la aplicación o añadirla a la
   pantalla de inicio y completa los pasos que ofrezca el dispositivo.
3. Abre el icono y comprueba nombre, imagen y ventana propia; un acceso que
   sólo abra una pestaña no acredita instalación PWA.

Para desinstalar, usa la opción del sistema al mantener pulsado el icono o
busca Nodia en la administración de aplicaciones del dispositivo.

Android requiere prueba en dispositivo real antes de anunciar compatibilidad.
Un viewport móvil de escritorio no sustituye esa comprobación.

## Safari en iPhone o iPad — pendiente de verificación

El recorrido a comprobar es abrir Nodia en Safari, usar **Compartir → Añadir a
pantalla de inicio** y abrirla desde ese icono. Según la versión puede aparecer
una opción adicional para abrirla como aplicación. Para retirarla, usar las
opciones del sistema sobre el icono de la pantalla de inicio.

No se anuncia soporte iOS hasta comprobar instalación, reapertura y Google
login/logout en un dispositivo real. La sesión de Safari y la de la app
instalada pueden tener almacenamiento diferente; puede ser necesario iniciar
sesión otra vez.

## Sesión, recuperación y retirada

Instalar no concede acceso a módulos ni amplía la duración de la sesión.
Inicia sesión mediante el flujo habitual de Google. Si cancelas o falla,
conserva el navegador abierto y utiliza el reintento disponible. Cerrar sesión
debe ocultar el contenido privado también al reabrir el icono.

Ante problemas de red, restaura la conexión y vuelve a abrir o recargar la
aplicación. No interpretes una petición fallida como una operación guardada.
La instalación no crea una cola que envíe operaciones al recuperar la red.

Desinstalar y borrar los datos del sitio son acciones diferentes. La entrega
no borra automáticamente almacenamiento del dispositivo ni datos de tu cuenta.
Cambiar de dominio puede requerir una nueva instalación. La retirada de una
release usa el procedimiento existente de CI/CD, sin reconstruir artefactos ni
invalidar sesiones por instalar/desinstalar.

Referencias técnicas: [instalación PWA en MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
y [márgenes de iconos adaptables en web.dev](https://web.dev/articles/maskable-icon).
