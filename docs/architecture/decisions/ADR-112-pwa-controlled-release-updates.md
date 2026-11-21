# ADR-112 — Actualizaciones controladas de la PWA

> Estado: propuesto
> Fecha: 2026-11-21

## Contexto

Nodia usa un único service worker raíz para actualizaciones y para los
recordatorios de visitas en el piloto de Web Push. Una publicación cambia
los nombres de archivos emitidos por Vite. En un mismo
perfil pueden convivir una pestaña con una edición en curso y otra lista para
usar la última versión. La suscripción y el destino de los avisos dependen
del registro raíz.

## Opciones consideradas

- Integrar Workbox en el worker actual. Aporta utilidades de caché, con mayor
  superficie de compilación y configuración para el alcance de PWA-002.
- Generar metadatos en el build de Vite para el worker existente. Permite
  conservar la recepción de push, acotar la caché y verificar el artefacto.
- Recargar todos los clientes al activar el worker. Simplifica las versiones
  concurrentes a costa de perder ediciones abiertas.

## Decisión

Generar un identificador reproducible y publicar el mismo valor en el HTML,
el worker y `/pwa-release.json`. CI valida las referencias y conserva la
comprobación de bytes del cuerpo del worker. La detección de versión y las
navegaciones usan red. El worker prepara el script y la hoja de estilos de
entrada. Las peticiones posteriores pueden reutilizar JavaScript, CSS y
fuentes con hash del build cuando ya estén en la caché pública de Nodia.

La activación usa el registro y la ruta raíz. Cada pestaña conserva su
documento hasta una acción explícita. La pestaña que solicita actualizar
comprueba otra vez la versión publicada, las ediciones activas y las
mutaciones antes de recargar. Cuando tiene trabajo en curso, puede abrir la
versión reciente en otra pestaña. En el piloto con Web Push, el worker activo
sigue procesando avisos durante la espera.

## Consecuencias

- Al activar un worker se conserva su caché y hasta dos anteriores para
  atender los archivos ya descargados después del cambio de versión.
- Un módulo diferido antiguo que el navegador aún no descargó depende de su
  disponibilidad en el origen. La recuperación de ruta requiere una acción
  del usuario. Las operaciones privadas conservan su contrato online.
- La reversión operativa vuelve por el flujo de publicación existente. El
  candidato del navegador valida la entrada del artefacto publicado antes de
  activarse. La retirada completa del registro requiere preservar o migrar
  antes la suscripción de push asociada.

## Referencias

- [PWA-002](../../mvp/103-pwa-progressive-implementation-plan.md#4-pwa-002--caché-estática-y-actualizaciones-controladas)
- [Ciclo del service worker](https://developer.chrome.com/docs/workbox/service-worker-lifecycle)
- [Recursos de versiones anteriores en Vite](https://vite.dev/guide/troubleshooting.html#failed-to-fetch-dynamically-imported-module)
