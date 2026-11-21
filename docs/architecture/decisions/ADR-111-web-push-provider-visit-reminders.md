# ADR-111 — Planificación y entrega de recordatorios Web Push

> Estado: propuesto
> Fecha: 2026-11-20

## Contexto

[PWA-004](../../mvp/103-pwa-progressive-implementation-plan.md#6-pwa-004--notificaciones-push)
plantea un aviso por visita de un contacto de proveedor. La hora se calcula
con el horario civil del contacto y la alarma opcional del proveedor. El
aviso debe poder llegar con la pestaña cerrada y respetar cambios de horario,
cancelaciones, preferencias y permisos del negocio.

## Opciones consideradas

### Temporizador en Client

- Mantiene el cálculo cerca de la interfaz y evita una cola persistida en Server.
- Depende de que Client esté ejecutándose y de sus datos locales. La duración
  de un service worker depende del navegador. Un cambio de permisos o de
  agenda en otro dispositivo requiere recuperar el estado de Server.

### Servicio de notificaciones con agenda propia

- Puede concentrar la programación, los reintentos y la entrega Web Push.
- Introduce otra fuente de estado y exige sincronizar revisiones, suscripciones
  y bajas con la autoridad de Negocios antes de cada envío.

### PostgreSQL y worker de Nodia para la agenda, Web Push para el transporte

- Reutiliza el ámbito transaccional de Nodia, permite consultar avisos pendientes
  y tolera reinicios sin depender de que haya una pestaña abierta.
- Requiere mantener un planificador con horizonte acotado, leases, caducidad,
  deduplicación y monitoreo de la cola y de los servicios push admitidos.

## Decisión propuesta

Adoptar PostgreSQL y un consumidor dedicado dentro del proceso worker de Nodia.
Los cambios de horario o actividad dejan trabajo durable de reconciliación
en la misma transacción. El planificador materializa un horizonte acotado de
avisos con identidad por visita y fecha civil, revisión del origen e instante
UTC de envío. Una reconciliación periódica completa el horizonte y recupera
pendientes tras interrupciones.

El consumidor reclama entregas con identidad por aviso y suscripción. Vuelve
a comprobar la autoridad del destinatario, el estado de la visita y la
suscripción antes de realizar el POST HTTPS fuera de la transacción. El
resultado de aceptación del transporte tiene estado propio. La visita y su
horario siguen resolviéndose en Negocios.

Client usa un único registro de service worker en el origen canónico de Nodia
para mostrar el aviso y dirigir al usuario a la aplicación. El acceso al
destino se evalúa con la sesión y los permisos vigentes. La agenda y la
suscripción se administran desde la UI autenticada. El mensaje muestra texto
genérico, incluso en la pantalla bloqueada.

## Consecuencias

- Se puede desplegar la recepción push por separado de la caché. PWA-002 y
  PWA-004 coordinan registro, scope, actualizaciones y rollback del worker.
- La aceptación del POST y la visualización son hechos distintos. Los reintentos
  deben respetar la caducidad del aviso y reconocer resultados remotos inciertos.
- Un cambio de permisos o una revocación se aplica al comprobar cada despacho.
  Un envío ya iniciado puede completarse y llegar más tarde. El contenido
  mínimo y la revalidación al abrir protegen los datos de la visita.
- Las suscripciones incluyen datos privados de entrega. Server custodia la
  clave VAPID privada, evita registrar los endpoints y limita las salidas a
  servicios de transporte admitidos.
- El piloto conserva sus gates por dispositivo, pruebas de reversión y política
  de retención en el plan. La adopción requiere validación técnica propia.

## Contrato por instalación

La preferencia se guarda por usuario y negocio, con consentimiento separado
para cada instalación. La revocación explícita de la sesión vinculada provoca
una baja durable. El vencimiento ordinario de navegación conserva el alta, y
abrir el destino sigue requiriendo sesión y autoridad actuales. El consumidor
evalúa la elegibilidad desde la cuenta, el negocio y la suscripción persistidos.
El detalle de revisiones, rotación y alcance está en
[PWA-004.01](../../mvp/103-pwa-progressive-implementation-plan.md#61-regla-de-hora-y-destinatario).

## Referencias

- [Plan PWA-004](../../mvp/103-pwa-progressive-implementation-plan.md#6-pwa-004--notificaciones-push),
  [horarios de Contactos](../../mvp/31-provider-contacts-proposal.md#día-de-visita-con-hora-por-confirmar--2026-11-20),
  [ámbito de Negocios](../../mvp/89-module-access-and-user-data-scope.md#contratos-y-barreras)
  y [rutas canónicas](ADR-092-stable-module-navigation-routes.md).
- [HTTP Web Push](https://www.rfc-editor.org/rfc/rfc8030.html),
  [cifrado de mensajes](https://www.rfc-editor.org/rfc/rfc8291.html) y
  [VAPID](https://www.rfc-editor.org/rfc/rfc8292.html).
