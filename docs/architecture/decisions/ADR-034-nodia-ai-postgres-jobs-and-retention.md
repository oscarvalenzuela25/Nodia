# ADR-034 — Jobs PostgreSQL y retención de NodiaAI

> Estado: propuesto; decisiones funcionales confirmadas, implementación pendiente
> Fecha: 2026-10-14

## Contexto

NodiaAI conserva conversación, continúa al cerrar la página y ejecuta comandos confirmados secuencialmente, con efectos parciales recuperables. El usuario precisa borrado automático a 90 días del último mensaje del dueño, adjuntos/transcripciones con el chat y preferencias aceptadas independientes hasta borrado explícito.

El backend ya usa PostgreSQL/TypeORM y posee un worker de recuperación de uploads con claims SQL. RedisService es caché tolerante a fallos y no proporciona una cola transaccional con receipts. La existencia de ioredis no acredita BullMQ o un sistema de jobs. Los adaptadores Web/Agentic pueden compartir perfiles con OCR/login; una lease de Server no termina un proceso externo.

El usuario propone check en localStorage y endpoint para comprobar antigüedad. Usarlo como autoridad deja chats sin borrar cuando nadie abre la app y mezcla relojes/dispositivos. Server debe comprobar/ejecutar la caducidad; el check del cliente puede evitar consultas redundantes.

## Opciones consideradas

### Opción A — Trabajo y limpieza en navegador o promises del proceso API

- Ventajas: poco código/persistencia inicial.
- Desventajas: pérdida al desconectar/reiniciar, sin coordinación entre procesos ni dedup transaccional; limpieza depende de visitas y datos locales.

### Opción B — PostgreSQL durable y worker del mismo proyecto

- Ventajas: admitir job/estado/outbox en transacción, conservar recibos y contenido con políticas separadas, reutilizar infraestructura y casos de uso.
- Desventajas: desarrollar scheduler, leases/fencing, índices/limpieza y medir carga; no convertir polling en consultas ilimitadas o prometer exactly-once externo.

### Opción C — Broker Redis/BullMQ con journal PostgreSQL

- Ventajas: ecosistema de entrega/prioridad y scheduling especializado.
- Desventajas: nueva dependencia y puente/outbox entre commits PostgreSQL y broker; no evita receipts/idempotencia ni incertidumbre remota. Requiere administración operativa adicional.

## Decisión

Proponer B para v1: jobs tipados/attempts/outbox en PostgreSQL, con claims cortos SKIP LOCKED, lease_owner/fence y estado durable. Worker Nest standalone del proyecto Nodia Server, con módulos/casos de uso compartidos y sin puerto HTTP; no crear un microservicio. Redis o notificaciones son aceleradores opcionales del wakeup, sin reemplazar la política Redis de rate limiting existente.

Una entrega puede repetirse; efecto local+receipt/outbox comparten transacción o se verifican mediante journal idempotente nativo. Estrategias registradas por capacidad: transactional_witness, native_idempotent, external_reconciled o unsupported. Operación unsupported no se publica. No anidar transacciones independientes y afirmar atomicidad.

Slots de runtime se derivan del perfil/proceso realmente compartido. Fencing sólo rechaza efectos/resultados controlados por Nodia; lease vencida después de dispatch obliga a conciliación/cuarentena hasta comprobar finalización. Gateway compartido debe cubrir OCR/login/chat que consuman el recurso, sin bloquear DB durante red.

Proponer barreras transaccionales de autoridad compartidas por lectores y escritores de roles/asignaciones, orden de locks explícito y pruebas por dominio. No considerar suficiente que sólo el worker adquiera el lock. Último superadmin, asociaciones atómicas y claves reservadas de NI-13 siguen pendientes.

Retención: expires_at desde último mensaje del dueño; chat vacío desde created_at como propuesta técnica. No reinician lectura/configuración/confirmación/respuestas automáticas. Server filtra contenido vencido y scheduler purga independientemente de visitas. localStorage sólo guarda metadata opcional; nunca autoriza borrado, omite autenticación o extiende el plazo.

Separar payload conversacional de journal mínimo. Purga cierra grants/admisión, incrementa retention_epoch e invalida propuestas; elimina contenido y conserva receipts/recovery mínimos sin copiar mensajes. Preferences sobreviven con origen nullable. Antes de quitar metadata de objetos, guardar cleanup durable de key/generation para PUT tardío. Archivo incorporado al dominio recibe key independiente y su protocolo de integridad.

Concreción posterior del2026-10-15: [AI-04/50](../../mvp/50-nodia-ai-ai04-runtime-policy.md)/[ADR-037](ADR-037-nodia-ai-admission-and-minimal-retention.md). Sin archivo adicional de datos técnicos resueltos; sólo descriptores mínimos de tareas aún inciertas/de limpieza hasta cerrar. Luego eliminar también esos receipts/jobs/attempts/audit, sin repetir efectos ni afectar al negocio. Objetivo24h y backups máximo7 días/restore sin replay propuestos, con gates pendientes. Independencia FK no implica conservación perpetua.

El [ERD42](../../mvp/42-nodia-ai-erd.md) propone, tras [revisión44](../../mvp/44-nodia-ai-data-model-review.md), 23 tablas previstas/62 FKs y 3 referencias existentes; adapter_states es condicional según [ADR-035](ADR-035-nodia-ai-bounded-persistence-and-knowledge.md); su PK UUID pública no cambia IDs de dominio. [Arquitectura43](../../mvp/43-nodia-ai-execution-architecture.md) define fases/estrategias/autoridad/observación. Esta decisión no elige SDK o acredita chat/MCP disponible en Web/Agentic.

## Consecuencias

- Positivas: continuidad y recuperación independientes del navegador, consentimiento separado y purga sin borrar registros de negocio.
- Costos/riesgos: scheduler propio, disciplina de UoW/locks/receipts, coordinación con runtimes existentes y políticas de conservación separadas.
- Trabajo posterior: migraciones/desarrollo por etapas, viabilidad Web/Agentic, schemas de dominio, índices/presupuestos con carga medida, conservación de receipts/audit/jobs y plazo de limpieza física/backups.
- Evaluar C posteriormente si mediciones justifican cambiar delivery. Las identidades de operación y journal permanecen fuera del broker.
- Sin estado operativo inventado: API key/configuración/login o lease no prueban inferencia, soporte de herramientas o fin remoto.
- Documentos en revisión, sin aprobación automática; autorización general del proyecto vigente.

## Referencias

- [ADR-033](ADR-033-nodia-ai-confirmation-and-sequential-recovery.md), [ERD42](../../mvp/42-nodia-ai-erd.md), [ejecución43](../../mvp/43-nodia-ai-execution-architecture.md).
- [Contratos41](../../mvp/41-nodia-ai-v1-contracts.md), [catálogo40](../../mvp/40-nodia-ai-tool-catalog-v1.md).
- [Worker de uploads](../../../nodia-server/src/invoice/invoice-upload-recovery.worker.ts), [recovery SQL](../../../nodia-server/src/invoice/use-case/recover-invoice-uploads.use-case.ts), [RedisService](../../../nodia-server/src/common/redis/redis.service.ts).
- [PostgreSQL SELECT/SKIP LOCKED](https://www.postgresql.org/docs/16/sql-select.html), [Nest standalone](https://docs.nestjs.com/standalone-applications).
- [ADR-008](ADR-008-internal-microservices-only.md), [ADR-013](ADR-013-rental-integrity-and-idempotency.md).
