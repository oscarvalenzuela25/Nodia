# NodiaAI — AI-09: persistencia y módulos de conversación

> Estado: implementado y verificado localmente; revisión documental pendiente
> Fecha: 2026-10-15
> Fuentes: [plan45](45-nodia-ai-implementation-plan.md), [contratos41](41-nodia-ai-v1-contracts.md), [ERD42](42-nodia-ai-erd.md), [arquitectura43](43-nodia-ai-execution-architecture.md), [routing48](48-nodia-ai-mode-routing-policy.md), [política50](50-nodia-ai-ai04-runtime-policy.md), [autoridad54](54-nodia-ai-ai08-transversal-authority.md).

## Resultado y límites

M1 incorpora once tablas y151 columnas: conversaciones, mensajes, partes, runs, llamadas de herramientas, eventos, jobs, intentos, concesiones, slots de runtime y auditoría. Migración `1792200000000-CreateNodiaAiConversationPersistence`, once entidades TypeORM y tres módulos verticales internos agrupan conversación, turnos y runtime. Un módulo de autorización separado evita dependencias circulares en la composición del host NodiaAI. No se añade un módulo ni controlador por tabla de soporte.

Es persistencia interna: no publica endpoints del chat, herramientas, worker, sesiones del proveedor, selección de modelos por defecto o inferencias. La página existente sigue informando que el chat no está disponible. Crear/listar/admitir mensajes, purgar automáticamente y ordenar actividad corresponden a AI-10; claim/fence/dispatch a AI-11/12. Tener columnas y constraints no demuestra que sus consumidores estén implementados.

## Migración por necesidad

Se omiten todas las referencias a tablas futuras: attachment_id y partes de archivos, context_snapshot_id, adapter_state_id, execution_id y el hash de comandos de concesiones para ejecuciones. M1 admite sólo partes text; los jobs no permiten kind execution. Las siguientes migraciones añadirán columnas, FKs y modalidades juntas. No crea UUIDs sueltos apuntando a tablas inexistentes.

PKs UUID opacas, bigint como cadenas en Node, timestamps timestamptz, hashes hexadecimales y revisiones positivas. Secuencias, fence, límites de bytes, estados, unicidad de mensajes/runs/calls/recibos e índices de cola se respaldan en PostgreSQL. Los índices parciales cubren expiración, actividad del run, jobs ready/leased. Los CHECK de JSON validan forma/tamaño y presupuestos; los contratos semánticos cerrados se validan además en casos de uso. Un objeto JSON válido no se considera una capacidad o autorización.

Los pares message/run/tool/event/job/chat impiden mezclar conversaciones. La actividad usa FK compuesta y diferida entre chat y job; debe liberarse antes de borrar un job activo. Slots vinculan job/chat coherentes y conservan su estado unknown/fence al perder referencias. Se verifica el ciclo y su reversión como conjunto.

## Routing, esfuerzo y presupuesto tipados

La revisión3 del modelo completo mantiene23 tablas y62 relaciones, añadiendo catorce columnas a las284 anteriores: **298 columnas de diseño completo**, de las cuales sólo151 pertenecen a M1. No hay tablas de fases ni runs anidados.

- Selección: effort_id opcional y nullable en la entrada, obligatorio y nullable en snapshots canónicos. Es un identificador dinámico del proveedor; no un nivel universal ni un fallback. Modelo exacto sin listas comerciales cerradas.
- Conversación: routing_enabled apagado por defecto, routing_revision positivo y destino Agentic exacto de la misma conexión, con generaciones de configuración/sesión. Ocultar el switch o cambiar de modo no elimina la preferencia guardada. Disponibilidad y vigencia se comprueban antes de admitir/despachar en AI-12.
- Run: conserva selection_snapshot como base inmutable; routing_snapshot, policy_hash y budget_snapshot fijan consentimiento y límites. Cinco contadores acumulados registran herramientas, RPC, envíos, compactaciones y delegaciones. PostgreSQL rechaza negativos y uso superior al snapshot. Reservar antes del dispatch y proteger con fence/epoch sigue pendiente AI-11/12.
- Intento: selection_snapshot y routing_phase describen una etapa base o delegada, con stage_key/stage_seq. No se reetiqueta un intento Web despachado como Agentic. Web no obtiene herramientas; API no es destino automático en v1.

Las entradas conservan effort_id opcional por compatibilidad; las proyecciones de selección lo devuelven explícitamente nullable. El schema común y las27 rutas diseñadas incorporan el PATCH revisionado de routing y eventos de procedencia. Todos los endpoints diseñados permanecen sin publicar. Se corrige la revisión0 de SelectionUpdateRequest para coincidir con revisiones positivas de persistencia. Las invariantes entre campos, identidad, bytes UTF-8 y presupuesto real se prueban separadamente del schema estructural.

## Puerto interno de creación y proyecciones

CreateNodiaAiConversationUseCase valida una entrada cerrada, normaliza ausencia de título/selección/esfuerzo, aplica la autoridad actual de AI-07 bajo la barrera AI-08 y toma al dueño de esa identidad. No crea chats para otro usuario por ser super_admin. client_request_id e input hash identifican la creación: misma intención recupera el registro; contenido distinto produce409. La unicidad y la relectura resuelven concurrencia, sin un ledger adicional.

La conversación nueva tiene revisión1, routing deshabilitado y ninguna actividad, mensaje, grant o job. La base temporal procede de PostgreSQL y la retención inicial de la política compilada. Recuperar una creación no renueva su fecha. Caducidad visible, borrado lógico y scheduler todavía requieren AI-10. La selección guardada representa una elección, no disponibilidad comprobada del adaptador; AI-12 conserva ese gate.

Las proyecciones públicas usan allowlists, bigint como cadena y fechas UTC; no retornan sesiones, hashes internos, fence, grants o payload arbitrario. La carga de datos de repositorios es interna, exige manager y ámbito donde existe; no constituye una interfaz pública autorizada por sí misma.

## Política empaquetada y retención

El build valida la política canónica50 y emite un subconjunto cerrado de versión/hash/días/tamaño del título para la creación. No lee docs en runtime ni adopta un default si falta el asset. Node verifica estructura y hash de contenido; un fallo impide construir el módulo. Esto comprueba integridad del paquete, no firma o aprobación humana. No declara operativos los ocho gates de50.

Los comandos start/dev/debug preparan el asset de fuente ignorado por Git, que Nest copia como asset también al compilar en watch. El build final lo emite en dist. Esta preparación evita que deleteOutDir elimine la política al iniciar desarrollo. No se añaden dependencias ni claves.

La auditoría vinculada al chat usa CASCADE conforme al cambio posterior50: no deja un archivo adicional al caducar. Jobs e intentos pendientes y slots unknown conservan únicamente lo necesario para conciliar/cerrar, y luego deberán borrarse. La referencia directa job→chat es NO ACTION diferida: evita que un SET NULL inmediato deje temporalmente run/chat incoherentes durante el cascade. La purga debe retirar primero trabajos resueltos, liberar actividad y desanclar explícitamente mantenimiento pendiente sin run, conservando sólo sus descriptores mínimos; esta etapa verifica el protocolo SQL, no un scheduler implementado. Negocios/Finanzas/Reservas y preferencias futuras permanecen independientes.

## Evidencia y continuidad

La suite completa Server pasa977 pruebas/122 archivos (65 casos nuevos), además de70 checks PostgreSQL y regresiones AI-07/AI-08 de28/39 checks. Build/lint correctos con dos avisos previos de imports en proveedores. No se modifica Client ni se atribuyen pruebas visuales nuevas. Se comprobó la copia del asset con compilación Nest y deleteOutDir, sin iniciar la API configurada o el watcher de desarrollo.

[Registro de entrega](../evidence/nodia-ai-ai09-persistence-validation.json) y [PostgreSQL desechable](../evidence/nodia-ai-ai09-postgres-integration.json) distinguen validación de contratos, persistencia/constraints/DI y mecanismos todavía pendientes. No se ejecutan migraciones sobre la BD de uso ni inferencias. No hay aprobación documental automática.

AI-09 queda cerrado en este alcance. El siguiente paso es **AI-10: admisión y retención del chat**, con listado/lectura/mensajes/cursor, reautorización y dedup antes de rechazar revisión,90 días sólo por mensaje nuevo del dueño, actividad y expiración independientes del navegador. AI-11/12 conservan gates de worker, runtime y routing real; AI-13 implementará la página operativa.
