# ADR-040 — M1 de NodiaAI y snapshots tipados del turno

> Estado: propuesto; implementación local en AI-09, sin aprobación documental automática
> Fecha: 2026-10-15

## Contexto

El modelo completo prevé23 tablas, pero el plan incorpora por etapas sólo las estructuras necesarias. La política posterior50 exige consentimiento de routing y presupuesto durable compartido, y elimina el archivo adicional de auditoría tras borrar el chat. El baseline anterior todavía no materializaba esos campos.

## Opciones consideradas

### Migrar toda la v1 y publicar CRUD genérico

Adelanta referencias, modalidades y contratos sin consumidores probados. Añade superficie innecesaria y puede confundir persistencia con disponibilidad. Rechazada.

### Añadir fases/workflows o campos JSON libres

Duplica identidad/presupuesto y dificulta validar quién decidió cada etapa. Rechazada: un mensaje del dueño mantiene un run lógico y las etapas pertenecen a intentos ya existentes.

### Once tablas M1 con snapshots cerrados y puertos internos

Elegida: tres agregados internos, entidades sin relaciones ORM superfluas y constraints PostgreSQL explícitos. Se omiten FKs/columnas a grupos futuros; el host comparte un módulo de autorización sin ciclos. No se publican controladores del chat.

## Decisión

Guardar esfuerzo dinámico, consentimiento revisionado y destino Agentic en conversación; snapshot de routing/política/límites y cinco contadores escalares en run; selección ejecutada y procedencia en intento. Los contadores pueden reservarse mediante SQL condicional sin nuevas tablas ni interpretar un workflow genérico. Los casos de uso validan contratos anidados y relaciones entre selección, consentimiento y presupuesto. La reserva con fencing es trabajo de AI-11/12, no una propiedad atribuida a la migración.

FKs compuestas impiden cruces de chats, incluyendo actividad y slots. La referencia de actividad se difiere y debe liberarse antes de eliminar su job. La referencia directa job→chat también se difiere con NO ACTION: el cascade del run limpia el par sin un SET NULL intermedio inválido; mantenimiento sin run debe desanclarse explícitamente. Jobs pendientes y slots unknown sobreviven con referencias mínimas; la auditoría del chat usa CASCADE para cumplir50. Esta modificación sustituye la conservación nullable del diseño anterior; no crea un archivo de auditoría sin chat.

El build valida la política canónica y empaqueta únicamente la configuración consumida por creación. El runtime no busca docs ni usa defaults ante un paquete incompleto. La preparación de assets también forma parte de start/dev/debug para conservar el flujo de desarrollo con deleteOutDir. No añade dependencias, microservicios ni una BD nueva.

## Consecuencias

- El modelo completo pasa de284 a298 columnas, manteniendo23 tablas/62 relaciones; M1 migra sólo11/151.
- La creación interna mantiene owner/request/hash y vencimiento inicial sin abrir inferencia o admisión de mensajes. La autoridad actual y su transacción se reutilizan.
- Down elimina las tablas M1 y su contenido: se prueba en una BD desechable, no se ejecuta sobre la BD de uso. Despliegue/rollback con datos de uso necesita respaldo y procedimiento de rollout.
- La limpieza requiere un orden transaccional: liberar actividad, retirar trabajo resuelto y conservar únicamente pendientes mínimos. La FK no sustituye el scheduler ni garantiza limpieza física/backups.
- Worker, disponibilidad real, instrumentos de presupuesto, puertos MCP, adjuntos y aceptación productiva siguen las etapas previstas. Los documentos y flags no los habilitan.

## Referencias

- [Entrega55](../../mvp/55-nodia-ai-ai09-conversation-persistence.md), [plan45](../../mvp/45-nodia-ai-implementation-plan.md), [modelo42](../../mvp/42-nodia-ai-erd.md), [arquitectura43](../../mvp/43-nodia-ai-execution-architecture.md).
- [Política50](../../mvp/50-nodia-ai-ai04-runtime-policy.md), [ADR-037](ADR-037-nodia-ai-admission-and-minimal-retention.md), [ADR-039](ADR-039-shared-authority-transactions.md).
