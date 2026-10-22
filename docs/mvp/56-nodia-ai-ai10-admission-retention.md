# AI-10 — Admisión y retención del chat

Estado: implementado y verificado localmente; no aprobación documental ni publicación productiva. Depende de [55](55-nodia-ai-ai09-conversation-persistence.md), [política50](50-nodia-ai-ai04-runtime-policy.md) y [arquitectura43](43-nodia-ai-execution-architecture.md). [Ficha funcional](../nodia-ai/knowledge/nodia-ai/features/chat-admission-retention.md).

## Comportamiento implementado

Siete rutas de coordinación bajo `/api/v1/nodia-ai/conversations`: crear, listar, detalle, actualizar título/fijado/archivo, guardar selección y listar/admitir mensajes. La selección es una preferencia estructural; guardarla no acredita disponibilidad. No hay operaciones de datos de negocio, SQL libre, herramientas MCP ni confirmaciones implícitas.

La admisión distingue dos fases. Primero autoriza el chat y recupera un mensaje duplicado antes de comprobar la revisión consumida o consultar el proveedor. La observación externa ocurre sin transacción SQL. Después una transacción corta vuelve a autorizar, comprueba revisión, selección, observación y capacidad de cola, y crea mensaje, run, grant y job junto con la puerta de actividad. La misma clave con otro texto produce conflicto. Los límites de bytes, partes, almacenamiento y cola provienen de la política empaquetada.

Las conversaciones ajenas son404 para ordinarios; un chat propio conocido que venció es410 mientras exista. `super_admin` puede inspeccionar chats vivos de otros con auditoría vinculada al chat, sin suplantar al dueño ni enviar mensajes en su nombre. Las proyecciones públicas excluyen grants, sesiones técnicas y hashes privados. Los mensajes con procedencia revocada o inválida se presentan restringidos. Búsqueda sobre título y texto propio/asistente, fijado y archivado conservan filtros y paginación por cursor; los cursores guardan precisión PostgreSQL y rechazan IDs inválidos.

## Retención

Creación fija inicialmente90 días. Sólo un mensaje nuevo del dueño renueva el plazo; leer, renombrar, cambiar selección, recuperar un duplicado o responder en background no lo renueva. `expires_at` y la hora actual de PostgreSQL deciden la elegibilidad después de adquirir locks. La expiración no depende de localStorage ni de abrir el navegador.

El caso de uso de mantenimiento cerca trabajos, revoca grants y elimina chat, mensajes, partes, runs y auditoría mediante las FKs M1 existentes. Una operación terminada se elimina aunque conserve una referencia técnica histórica. Un dispatch incierto conserva únicamente la identidad operacional necesaria para conciliación, separado del chat y sin prompt/selección/historial. Un lease vencido nunca demuestra cierre remoto. Adjuntos y preferencias todavía no tienen tablas en M1: sus consumidores deberán respetar esta política en sus etapas, sin simular su eliminación hoy.

## Transporte y operación

JSON limitado a65.536 bytes antes de parsing; errores usan `ApiErrorResponse`, correlación y `Cache-Control: no-store`. La saturación local comunica `Retry-After`. Los DTOs rechazan campos desconocidos. El servidor no guarda ni registra texto bruto del error del SDK. La API no inicia consumidores; el worker explícito de [57](57-nodia-ai-ai11-durable-worker.md) invoca el mantenimiento al arrancar y cada900s.

## Verificación y límites

Comandos reproducibles en Server: `npm run test:nodia-ai:admission` o `npm run test:nodia-ai:chat` para las tres integraciones. Requieren Docker local y crean/eliminan sus propias bases y credenciales sintéticas. `npm run worker:nodia-ai` arranca el proceso operativo sólo contra un entorno preparado; no usarlo como prueba sobre la BD de uso sin instalar las migraciones correspondientes.

Integración con Nest compilado y PostgreSQL16 desechable; el puerto de disponibilidad del proveedor se sustituye expresamente por un fixture sintético. Pruebas de casos de uso cubren dedup, autorización, concurrencia, revisiones, cursors, límites y retención. La evidencia final se registra en [validación conjunta](../evidence/nodia-ai-ai10-ai12-validation.json).

No se instalaron migraciones en la BD configurada ni se construyó la interfaz del chat. El borrado físico de archivos, restauración de backups, SSE y aceptación productiva siguen en sus etapas. La UI actual continúa informando que el chat no está disponible.

El almacenamiento de texto M1 se suma por dueño/chat bajo el gate SQL de admisión. Esto evita contadores denormalizados prematuros, pero su coste crece con el historial retenido. Antes de aceptación productiva medirlo cerca de los topes100/500MiB y revisar contadores transaccionales o cuotas reservadas si supera el presupuesto; las pruebas locales pequeñas no acreditan esa escala.
