# ADR-074 — Borradores de texto del chat limitados a la pestaña

> Estado: propuesto
> Fecha: 2026-10-23

## Contexto

C40-08 observa pérdida del texto todavía no enviado al renovar la sesión o remontar la página. La conversación y los mensajes admitidos ya pertenecen a Server. La política50 prohíbe guardar contenido en localStorage/service worker y obliga a revalidar vigencia y autoridad; no habilita almacenamiento offline ni una copia autoritativa del historial.

## Opciones consideradas

### Estado del componente o memoria global

Conserva el texto entre algunas interacciones, pero se pierde al recargar. Una memoria global sin identidad puede mezclar actores o conversaciones.

### Persistencia de borradores en Server

Proporcionaría continuidad entre dispositivos. Añade un nuevo contrato, escrituras y conflictos para texto que aún no constituye un mensaje; queda fuera de este arreglo.

### sessionStorage por pestaña, actor y conversación

Permite recuperar sólo el texto sin enviar después de recargar, sin almacenamiento permanente compartido entre pestañas. Requiere límites, limpieza y una consulta autorizada antes de restaurarlo.

## Decisión

Utilizar sessionStorage como caché prescindible del texto aún no enviado. Aislar por actor y conversación, limitar el texto persistido a los 32 KiB UTF-8 del contrato de admisión de Nodia y vincular el descarte al vencimiento comunicado por Server. Un exceso editable queda sólo en memoria; no se presenta como una cuota del modelo ni como un campo nuevo del API. Nunca almacenar adjuntos, transcripciones, mensajes enviados, prompts compilados, tokens, selección de credenciales, claves de idempotencia ni resultados del proveedor.

Restaurar únicamente después de obtener el detalle autorizado y editable de ese chat. La caché no concede acceso ni prolonga la retención. Cerrar sesión, cambiar actor, revocar acceso o expirar elimina los borradores afectados; la renovación de sesión del mismo actor conserva el texto. No deducir prórrogas desde el reloj del navegador.

Cada montaje, cambio de actor/sesión/chat y reanudación exige un GET nuevo completado. Un recibo técnico de lectura, compartido por los observadores de la misma consulta y sin contenido del chat, distingue ese resultado de una inyección o reutilización de caché. Una lectura cancelada o iniciada antes de esa frontera no autoriza la restauración. Durante la comprobación se bloquea el editor; un error transitorio conserva la copia sin restaurarla por primera vez. Si el texto ya estaba autorizado en la misma época, el error lo mantiene visible y bloquea las acciones. Una denegación explícita retira el borrador afectado.

Retirar la copia restaurable antes de iniciar la admisión del mensaje. Un remount nunca debe transformar un envío incierto en una nueva intención lista para enviar. La conciliación existente mantiene su identidad y no se sustituye por esta caché. Un fallo de almacenamiento no bloquea la edición en memoria.

## Consecuencias

- No hay migraciones ni nuevas rutas, herramientas o permisos.
- El contenido sigue siendo accesible al JavaScript del mismo origen; sessionStorage no es una bóveda. La revalidación y limpieza son obligatorias.
- No se promete sincronización entre pestañas/dispositivos ni recuperación de archivos sin enviar.
- La aceptación del comportamiento se registra por separado de los tests atómicos del almacén y del hook. Esta decisión no cierra las pruebas reales pendientes de Codex.

## Referencias

- [Política50](../../mvp/50-nodia-ai-ai04-runtime-policy.md), conservación y caché del navegador.
- [AI-40](../../mvp/86-nodia-ai-ai40-codex-acceptance.md), gate C40-08.
- [Ficha de organización](../../nodia-ai/knowledge/nodia-ai/features/conversation-organization.md).
