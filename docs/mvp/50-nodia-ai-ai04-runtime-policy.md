# NodiaAI — AI-04: admisión, presupuestos y conservación mínima

> Continuidad AI-09: [persistencia55](55-nodia-ai-ai09-conversation-persistence.md) materializa contratos cerrados de esfuerzo/routing/etapas/presupuesto y migración M1, sin publicar rutas, worker o inferencias. Modelo completo revisión3:23 tablas/298 columnas/62 FKs; M1:11/151. La auditoría vinculada al chat pasa a CASCADE conforme50; pendientes mínimos siguen separados. Las menciones anteriores de wire/ERD pendiente describen el baseline anterior; runtime permanece AI-10..12.

> Estado: política técnica validada offline; implementación y gates productivos pendientes, documento en revisión
> Fecha: 2026-10-15
> Fuentes: [plan45](45-nodia-ai-implementation-plan.md), [contratos41](41-nodia-ai-v1-contracts.md), [modelo42](42-nodia-ai-erd.md), [arquitectura43](43-nodia-ai-execution-architecture.md), [routing48](48-nodia-ai-mode-routing-policy.md), [Web47](47-nodia-ai-ai02-gemini-web-viability.md), [Agentic49](49-nodia-ai-ai03-gemini-agentic-viability.md)
> Decisión: [ADR-037](../architecture/decisions/ADR-037-nodia-ai-admission-and-minimal-retention.md). Contexto funcional: [ficha](../nodia-ai/knowledge/nodia-ai/features/runtime-policy.md).

## Decisiones y alcance de la entrega

El usuario confirma el2026-10-15 notas de voz de **5 minutos**, archivos de **20 MiB** y expresa que no le interesa conservar cosas al expirar el chat. Sustituir la propuesta de auditoría180 días y receipts durante toda la vida del registro por **cero archivo adicional de auditoría, recibos resueltos e intentos terminados** después de borrar el chat. Permanecen las decisiones anteriores: caducidad90 días desde último mensaje nuevo del dueño, adjuntos/transcripciones con el chat, preferencias aceptadas independientes y datos de negocio conservados en sus módulos.

Los restantes números son presupuestos técnicos iniciales de Nodia, revisables mediante nueva versión y evidencia. No representan cuotas, ventana de tokens, funciones multimodales o garantías comerciales del proveedor. Esta entrega fija la configuración y los contratos de operación; no implementa worker, parser, rutas, almacenamiento o MCP productivos ni aprueba documentos automáticamente.

La fuente numérica es [runtime-policy.json](nodia-ai-v1-runtime-policy.json), validada por [JSON Schema cerrado](nodia-ai-v1-runtime-policy.schema.json) y [verificador semántico](../evidence/scripts/validate-nodia-ai-ai04.cjs). No copiar números como defaults dispersos. AI-09/11 empaquetarán este recurso validado con Server/worker; el arranque debe rechazar archivo ausente, propiedades desconocidas, tipos incorrectos o incompatibilidades entre campos, sin corregir ni rellenar silenciosamente. Persistir versión **y hash de contenido** del release aplicado por turno. No permitir overrides parciales por variables sin componer y validar otra política completa/versionada. No hay consumidor productivo aún.

## Entradas, contexto y respuestas

| Recurso | Presupuesto inicial | Aplicación y exceso |
|---|---|---|
| JSON HTTP de coordinación | 64 KiB;8 partes por mensaje; título256B UTF-8 | Acotar cuerpo antes del parser; texto total/partes y DTO se comprueban además. Archivos por canal separado |
| Texto de mensaje | 32 KiB UTF-8 | Bytes reales antes de admitir; no caracteres JS ni tokens |
| Archivo | 20 MiB; hasta4 por mensaje y40 MiB acumulados | Dos archivos completos caben; cuatro sólo si su suma cabe. Uploads separados, no cuerpo multipart gigante |
| Voz | 300s y20 MiB | Ambos límites; duración decodificada, no metadata enviada por cliente |
| PDF/imagen | 100 páginas;12 millones de píxeles por imagen | Límites de contenido decodificado; no son soporte demostrado de una modalidad |
| Almacenamiento | 100 adjuntos/100 MiB por chat;500 MiB por dueño | Reservar bytes y cantidad atómicamente antes de subir; pendientes, temporales y derivados cuentan |
| Carga/parser | 60s upload; intent900s; parser15s/256 MiB | Un upload por dueño/dos globales; parser aislado bajo ese cupo. Hasta512 MiB de asignación de parsers, sin incluir API/worker/SDK/OS |
| JSON de herramienta | 64 KiB por argumentos y resultado; profundidad16/128 elementos por colección | Medir entrada antes de parsear; validar DTO después. Rechazo explícito, no cortar JSON |
| Contexto ensamblado | 256 KiB UTF-8, incluidas fichas y resultados | Techo propio, no ventana del modelo. Contar todo el contenido enviado; URLs privadas/archivos no eluden el límite de adjuntos |
| Respuesta | 32 KiB texto;2 MiB por stream stdout/stderr del adaptador | Acotar acumulación/deltas antes de persistir; agotamiento explícito, no respuesta exitosa truncada |
| Eventos | 256 outbox por actividad; deltas agrupados1 KiB/250ms;2 conexiones SSE/dueño | Reservar espacio para estados/final; reconectar lee eventos, no reinicia trabajo |
| Consulta/informe | Página25/máximo100 filas;100 grupos;20 filtros | Agregados antes de paginar y sin doble conteo. Si excede, pedir acotar/paginar; artefacto sólo con contrato propio publicado |

Subidas requieren upload intent privado del chat/actor vigente, comprobación por streaming y cuotas incluso sin Content-Length. Validar firma, formato permitido, contenido y tamaño decodificado en aislamiento antes de enviar al proveedor. No descargar URLs arbitrarias. Un PDF cifrado/no interpretable o archivo inválido produce error accionable y conserva el mensaje como borrador; nunca genera comandos supuestos. Audio/imágenes/PDF permanecen bloqueados para cada combinación exacta adaptador/modo sin verificación AI-32/33. Esta política no habilita formatos por extensión o nombre del modelo.

Compactación: máximo una por turno dentro del mismo presupuesto de envíos. Preservar decisiones, dudas, referencias y recibos existentes conforme43, con manifiesto y trazabilidad; no reinterpretar efectos ni volver a ejecutar herramientas históricas. No inventar un tokenizador o ventana. Cuando el proveedor entregue límite y medición compatibles, aplicar también ese límite; si no, declarar capacidad desconocida y comprobar entrada/adaptador en AI-12/34. Si no cabe después de compactar o el adaptador la rechaza, pedir reducir contexto/iniciar otro chat; sin cortar historia silenciosamente ni cambiar de modelo.

No persistir una fila por token. El agrupador respeta fronteras UTF-8 y deja espacio para tool/status/final; al alcanzar cupo de deltas deja de emitir parciales, acumula respuesta bajo32 KiB y sella mensaje canónico final con la reserva restante. Ni drops de estados finales ni filas de retry por cada reconexión. Reservar cupos atómicamente por actividad y probar carga/reconnect en AI-11/16/37. Una execution confirmada tiene su propia actividad; no hereda permiso para recrear efectos o aumentar pasos.

## Presupuesto durable del turno y delegación

Un único run lógico conserva la unicidad por user_message_id de42. No crear otro mensaje del dueño, reiniciar caducidad o abrir un segundo run para conseguir más presupuesto. Máximos acumulados: **12 solicitudes de herramienta**, **128 mensajes RPC MCP entrantes**, **3 envíos generativos al adaptador**, **una compactación**, **una delegación Web→Agentic** y **8 pasos por propuesta**. RPC incluye discovery, rechazos y duplicados; tool_calls incluye intentos duplicados/denegados, aunque un mismo call_id válido recupere su resultado sin repetir efecto. Tamaños y límite de transporte siguen aplicándose al replay.

Un envío es la operación observada por Nodia, no una cifra de inferencias HTTP/tokens/cuota interna del CLI. Agentic puede hacer varias acciones internas en un proceso. Herramientas nativas ajenas al catálogo denegadas por hook/aislamiento; si el proveedor no entrega su coste interno, se conserva desconocido. Terminar el proceso al agotar tiempo/bytes/RPC, manteniendo incertidumbre remota cuando corresponda.

Los contadores se reservan **antes** del dispatch y se actualizan condicionalmente en PostgreSQL con fence/epoch y release. Un crash después de reservar no devuelve presupuesto: no sabemos si se consumió. Callbacks de varios procesos del mismo run comparten contador en ToolGateway, no sólo variables del MCP. Sin BD/grant vigente no aceptan callbacks. Las lecturas pueden consumir cuota; no se reenvían inferencias inciertas. La confirmación crea execution con presupuesto de8 pasos/deadline propios y consentimiento independiente; la ejecución no llama al modelo para aprobarse ni gana8 pasos nuevos al recuperar.

### Identidad y consentimiento que deberá materializar AI-09/12

1. Preferencia del chat apagada por defecto, revisionada, con destino exacto de la **misma conexión**. Modelo/esfuerzo Agentic propios, obtenidos de configuración/descubrimiento; API excluida. Cambio de destino material exige volver a aceptar, no trasladar consentimiento a otro modelo/cuenta.
2. Al admitir el run congelar selección base, snapshot tipado de consentimiento/destino, catálogo, política/hash y presupuesto. Mantener selection_snapshot como origen inmutable; cada intento de43 representa **una etapa** y fija su selección ejecutada. No reetiquetar una inferencia Web como Agentic.
3. Web sólo produce respuesta o solicitud tipada de necesidad de herramientas; Server decide autorización, nunca el contenido recuperado. Una delegación ocurre después de respuesta Web válida, o por solicitud estructurada del coordinador sin ejecutar Web; no por timeout/error. No publicar Tools Web del spike47.
4. Antes de admitir la fase Agentic comprobar consentimiento aún habilitado y su revisión/destino exactos, módulos/actor, generación de sesión/configuración y elegibilidad. Observación de sesión/discovery de hasta300s **más** prueba de viabilidad del protocolo/adaptador exacto aún compatible; ninguna de ellas sola prueba disponibilidad actual. No inferencia artificial para pintar salud. Validar de nuevo en dispatch; fallo no selecciona otra conexión/modelo.
5. Admisión de fase ordenada transaccionalmente con cambio del switch. Desactivar antes impide admitirla; después no cancela por sí sola la fase admitida ni una ejecución confirmada. Cancelación explícita tiene su propio flujo. Como máximo una transición y sin rebote Agentic→Web dentro del turno. Siguiente turno usa Web como base; mostrar siempre procedencia de cada fase.
6. Reservar el perfil Agentic real después de cerrar/liberar Web **sólo si su finalización está comprobada**. Historial canónico autorizado común. Sin destino/evidencia, ofrecer cambio manual; no inventar resultado de BD. Switch nunca confirma escrituras.

No añadir tablas de fases, nuevos runs anidados ni un workflow genérico. Contratos de snapshot/contadores/selección por etapa, eventos de procedencia y PATCH revisionado deben incorporarse **juntos** al schema común, rutas y ERD en AI-09/12. Son delta identificado sobre baseline23 tablas/284 columnas, no campos JSON libres disponibles hoy. AI-04 cierra semántica/presupuestos; el wire contract y la migración siguen como gate explícito, sin publicar el switch ni cambiar el baseline a medias.

## Cola, deadlines, retry y ciclo del perfil

| Control | Política inicial | Garantía requerida |
|---|---|---|
| Actividad | Una por chat, una activa por dueño; hasta2 esperas/dueño y32 globales | Incluye super_admin; permisos no conceden capacidad infinita. Dedupe antes de consumir cupo |
| Workers | Dos foreground y uno maintenance; un holder por perfil real | Polling no reclama trabajo bloqueado indefinidamente. Maintenance independiente evita hambre de purga |
| Cola | Máximo300s; rechazo local429/retry-after5s | Plazo desde admisión inicial; redelivery no lo reinicia. Elegir próximo elegible sin saltarse autoridad |
| Turno | 600s desde admisión, incluida cola/compactación/delegación | Cada etapa usa min(límite propio, tiempo restante). No mantener worker esperando confirmación humana |
| Ejecución | 600s por admisión humana de ejecución, incluida cola/pasos | Confirmar o resume autenticado crea ventana acotada; retries automáticos no renuevan deadline ni número de pasos |
| Proveedor | 120s por envío | Cuatro tiempos AI-03 registrados:55,24/17,09/10,10/96,67s; margen23,33s respecto al mayor, sin percentiles ni SLA |
| Lectura/paso | 3s consulta;15s paso de dominio | Deadline de consulta/adapter efectivo, no sólo timeout HTTP. Timeout tras dispatch no demuestra rollback |
| Propuesta/challenge | 900s/120s | Challenge de un uso no excede vida de propuesta; confirmación no reinicia90 días |
| Lease/heartbeat | 30s/5s | Claim corto y fence monotónico. Tres intervalos de heartbeat no consumen toda la lease |
| Drain | 150s = margen sobre120+10 cancelación+10 flush | Detener admisión/claims; cerrar o poner en unknown. Timeout no libera perfil ocupado |
| Retry seguro | Dos retries previos a dispatch, esperas1/3s; cero ante dispatch incierto | Misma identidad, presupuesto/deadline; transporte/SDK no multiplican retries |
| Limpieza | Cinco intentos, esperas5/30/120/600s | Delete del objeto/generación propia idempotente; si sigue fallando, trabajo pendiente visible para operador |

Los números acotan recursos, no garantizan que toda la cola se complete:32 esperas de120s no caben en300s sobre un único perfil. Expirar trabajo **no despachado** como fallo conocido y liberar cupos; un perfil unknown deja de recibir trabajo y los no despachados conservan su deadline. No mantener jobs en retry continuo ni reiniciar plazos después de un deploy. Reprogramar sólo causas demostrablemente anteriores a dispatch; fallo de credencial/cuota exige acción explícita y respeta lo reportado, sin fallback.

Límites de entrada excedidos:400 invalid_input con error de campo cuando existe DTO; el proxy puede cortar cuerpo con413 antes de llegar a él y Client debe traducirlo sin perder borrador.429 execution_limit sólo expresa saturación/presupuesto de ejecución, no dato inválido. Una consulta sin filas es resultado vacío, no agotamiento. Indisponibilidad comprobada antes de admitir puede responder503 provider_unavailable. Después de202, publicar error/estado del job por eventos/consulta200; si hubo dispatch incierto conservar unknown y no reenviar. El wire público concreto se verifica con los consumidores de41.

Waiting_for_user cierra el intento/libera worker, no pausa un proceso con lease infinita. Al vencer la ventana no despachar pasos nuevos; conciliación puede continuar sobre efectos ya iniciados con etapas propias acotadas. Resume humano crea una admisión nueva de la **misma** ejecución sólo tras revalidar actor/sesión, revisión, comando/precondiciones y pasos/receipts originales, sin reseteo de identidades ni de los8 pasos. Un cambio material requiere otra propuesta/botón conforme41. Ninguna reanudación supera expiración del chat ni autoriza repetir un unknown; la UI debe distinguir este resume de un retry automático.

La clave de slot identifica deployment/perfil/proceso **realmente compartido**, no provider_id. Chat, OCR, login, logout y discovery deberán pasar por la misma puerta cuando comparten perfil. Web y Agentic conservan perfiles/sesiones independientes; no serializar globalmente recursos distintos sin evidencia. El guard de login incompleto observado en AI-02 es un **gate abierto AI-11**, no queda corregido por este archivo. Cambios de sesión invalidan observaciones; un callback no abre otro slot ni dispara OCR anidado sobre el mismo perfil retenido.

Lease vencida antes de dispatch permite recuperación segura con fence nuevo; tras dispatch_armed/sent conserva outcome desconocido. Cancelar el await o matar CLI local no prueba que la operación remota no ocurrió. El supervisor debe atestiguar fin de proceso/hijos y conciliar outcome; sólo después libera perfil. En SDK/thread no cancelable, mantener reserva/cuarentena aunque el HTTP termine. Un worker antiguo no puede publicar efectos/resultados después de perder fence/epoch. Probar esto con BD y procesos reales, no mutex unitario.

## Búsqueda y conservación sin archivo adicional

Búsqueda de chats por título y texto de mensajes del dueño/asistente, consulta UTF-8 hasta256B, página25/máximo100, orden estable updated_at/id y cursor ligado a consulta/filtros/actor. Ordinarios sólo propios; super_admin debe elegir ámbito autorizado explícito. Archivados se pueden incluir por filtro; vencidos nunca, aunque scheduler aún no purgue. Índice PostgreSQL y consultas parametrizadas a validar con volumen en AI-35; sin Elasticsearch/vectores ni índice separado que sobreviva al contenido. Adjuntos, transcripciones, JSON de herramientas y preferencias no se incorporan automáticamente a esta búsqueda v1.

| Información | Mientras el chat está vigente | Al vencer/borrarse |
|---|---|---|
| Mensajes, snapshots, reportes, adjuntos, transcripciones y propuestas | Privados y autorizados | Denegar de inmediato; purgar contenido/índices y objetos propios |
| Audit NodiaAI, receipts resueltos, attempts/jobs terminales | Sólo metadata mínima, sin contenido/secretos | Eliminar sin180 días ni retención mientras viva el gasto |
| Trabajo no despachado | Permiso/fence/epoch válidos | Revocar/cancelar; no ejecutar ni recuperar propuesta vencida |
| Efecto incierto o proceso activo | Registro operativo mínimo de conciliación | Mantener **sólo** identidad/fence/hash/ref de operación/objeto y causa segura hasta conciliar; sin transcripción ni comando recuperable para ejecutarlo |
| Limpieza fallida/PUT tardío | Intent/descriptor de objeto y generación | Mantener trabajo de borrado hasta verificar desaparición; eliminarlo al cerrar |
| Gasto, reserva, proveedor y archivos promovidos | Autoridad y ciclo del módulo | Permanecen en dominio; usar journals nativos del módulo, sin cambiarles retención desde AI-04 |
| Preferencia aceptada | Memoria independiente | Conservar hasta borrado explícito según decisión previa; origen nullable |

El registro mínimo no es un archivo consultable de chats: es una tarea aún sin terminar. No se elimina por TTL fingiendo que unknown significa sin efecto. Debe tener responsable y estado operativo; intentos automáticos agotados requieren conciliación explícita de super_admin. Una resolución elimina ese pendiente cuando el chat ya no existe, sin abrir otro plazo de auditoría. No conservar recibos resueltos indefinidamente. Si una familia no permite conciliar sin retener contenido vencido, no publicar esa operación hasta resolver el contrato.

La purga se ordena con dispatch/commit: elevar epoch/revocar grants, impedir nuevos efectos, copiar únicamente descriptores mínimos necesarios a jobs de limpieza/reconciliación y borrar payload. No CASCADE ciego sobre slots/receipts que aún protegen un proceso o efecto. Cuando no queden pendientes, barrer explícitamente receipts/jobs/attempts/audit y sus referencias en orden FK. Guardar metadata de limpieza **antes** de perder storage_key/generation y contemplar PUT tardío/versiones/multipart incompletos. Capacidad de borrar datos técnicos no permite borrar registros de negocio.

Caducidad exacta: ServerUTC, `base + 90*24h`, base último mensaje nuevo del dueño o created_at para chat vacío; vencido cuando now>=expires_at. Duplicados no renuevan. Leer, archivar, configurar, confirmar o inspección super_admin no renuevan. localStorage sólo cachea comprobación, no datos/autoridad. Scheduler cada900s por lotes100, bloqueo de lectura/admisión independiente del scheduler.410 sólo para propio conocido vencido; después de purga sin metadata404, nunca mantener tombstone de producto perpetuo para devolver410.

Client no persiste contenido de chats en localStorage/service worker. Invalidar caché en memoria al expirar/logout/cambiar cuenta; al volver de suspensión comprobar vigencia antes de presentar contenido cacheado. Navegador offline no decide prórrogas. AI-10/13/35 deben verificarlo; borrar en Server no demuestra por sí solo que una vista ya abierta deje de mostrar datos vencidos. Archivos promovidos al dominio no dependen de ese caché.

Limpieza física objetivo24h desde borrado lógico, **no garantía ya desplegada**. En caída de storage mantener acceso denegado y pendiente operacional, alertar edad/reintentos; no anunciar borrado físico completado antes de verificarlo. Logs no duplican títulos, textos o adjuntos. Observaciones agregadas sin IDs de chat/usuario/payload pueden sobrevivir; la auditoría general de otros módulos conserva su contrato y no se amplía aquí.

### Backups, restauración y copias remotas

Política técnica propuesta: backups que contengan contenido NodiaAI con horizonte máximo7 días, cifrados y acceso de operador; ninguna copia adicional90/180 días. La rotación incluye snapshots/exportaciones/versiones de objetos que permitan reconstruirlo. El [runbook actual](vps-first-test-deployment.md) aún no prueba rotación/restore externo, por lo que es gate antes de publicar, no configuración ya aplicada.

Restauración siempre en cuarentena: sin workers/egress/proveedores y sin servir contenido. Aplicar reloj actual y caducidad antes de abrir lecturas; no reanudar trabajos ni confirmaciones restauradas. Conciliar efectos contra estado de dominio actual, no replay del backup. Un borrado manual reciente puede no estar vencido en un backup: mantener fuera de ese backup una lista operativa mínima de IDs opacos/generaciones borrados, **sin mensajes ni motivo**, sólo hasta retirar todas las copias capaces de resucitarlos (máximo horizonte de backup+limpieza). Aplicarla en restore y eliminarla al retirar esas copias; si falta o está incompleta, no habilitar chats restaurados. No añadir una tabla de historial eterno para esto.

No prometer borrado físico de discos/WAL ni copias del proveedor a partir de un DELETE SQL. Documentar lo realmente verificable: filas/índices/objetos activos, versiones y expiración del backup propio. Chats nativos creados por Nodia se limpian sólo mediante contrato verificado del adaptador y ownership; nunca borrar sesión/perfil o chats ajenos. Si no se puede comprobar retención/borrado remoto, declararlo desconocido y cerrar ese gate antes de prometer esa garantía al usuario.

## Gates y verificación

Revisión de casos funcionales de diseño (no ejecuciones en BD):

| Caso de Nodia | Resultado exigido por la política | Tarea de verificación real |
|---|---|---|
| Gasto desde voz de301s o21 MiB | Rechazar antes de inferencia; no gasto ni transcripción inventada | AI-32/33 |
| Gasto20000 con estado pagado/pendiente ambiguo | Preguntar; otro mensaje nuevo del dueño sí renueva90 días, respuesta automática no | AI-10/17 |
| Proveedor creado y contacto falla | Dos pasos individuales, conserva proveedor/receipt; recuperar contacto sin recrear proveedor | AI-20/23 |
| Reserva con commit y respuesta perdida al expirar chat | Revocar/conciliar, no repetir reserva ni retener el chat como journal | AI-20/24..26 |
| Total por proveedor/mes con100+ grupos | Aclarar semántica económica y acotar/paginar, no sumar sólo página visible | AI-30/31 |
| Usuario pierde módulo Finanzas antes de Agentic | Rechazar autoridad aunque switch y sesión estén válidos; no fallback Web/API | AI-08/12 |
| Dos chats y OCR/login usan mismo perfil | Cola/cupos compartidos; una reserva real, sin doble dueño tras lease vencida | AI-11/28 |
| Borrar chat y restaurar backup anterior | Contenido denegado, limpieza aplicada y ningún job/confirmación se reenvía | AI-36/38 |

| Gate de configuración | Tareas | Prueba requerida antes de publicación |
|---|---|---|
| postgres_admission_fencing | AI-09/10/11 | Dos réplicas/dispositivos, dedup, cupos sin oversubscription, lease/crash/fence y carrera expiry/commit con PostgreSQL aislado |
| shared_profile_all_entrypoints | AI-11/12/28 | OCR/login/logout/discovery/chat compiten por perfil; login rechaza bajo generación, fin de hijos/thread no cancelable, cuarentena sin doble dueño |
| durable_budgets_routing_contracts | AI-09/12/13 | Schema/ERD/eventos tipados, switch off/destino cambiado/observación caduca/cross-connection rechazados; dos procesos MCP comparten presupuesto; nueva fase no lo reinicia |
| modalities_per_exact_adapter | AI-12/32/33/34 | Bytes UTF-8, duración real, archivo inválido/descompresión, parser muerto, cuotas/temporales, compactación preserva hechos y soporte real por modalidad |
| effect_reconciliation | AI-17/18/20 | Commit con respuesta perdida/unknown, expiración borra payload sin repetir gasto/reserva/contacto; borrar receipts resueltos no revive grants |
| storage_late_put_version_cleanup | AI-32 | PUT después de purga, objetos versionados, fallo de delete, referencia promovida y eliminación independiente; medir24h real |
| backup_rotation_restore | AI-36/38 | Restaurar copia anterior al borrado/expiry sin chats visibles ni replay; purga verificable de todas las copias y lista operacional acotada |
| load_drain_deployment | AI-35/37/38 | Carga por perfil/ruta,2 uploads/512 MiB allowance, cola llena/deadline, drain real/worker forzado, seguridad y búsqueda a volumen |

Evidencia de AI-04: [validación reproducible](../evidence/nodia-ai-ai04-runtime-policy-validation.json). Ejecutar `node docs/evidence/scripts/validate-nodia-ai-ai04.cjs --write`: compila schema estricto, rechaza configuraciones peligrosas, comprueba relaciones de presupuesto y fronteras aritméticas y contrasta los cuatro tiempos registrados AI-03. No simula un scheduler para afirmar locks reales. No nuevas inferencias ni servicios necesarios para esta entrega. Los spikes47/49 siguen siendo evidencia histórica independiente; sus límites por proceso no se convierten en contador durable por redactar esta política.

AI-04 termina como configuración/semántica validada y gates asignados. Siguiente tarea AI-05. E0 tiene sus entregables de diseño/spikes; los gates de ejecución se verifican al implementar sus consumidores, antes de publicar cada capacidad. Documento/ficha/ADR permanecen en revisión y ningún flag cambia a disponible por este cierre.

## Materialización AI-34 — alcance observable del contexto

[Entrega80](80-nodia-ai-ai34-long-context-compaction.md) implementa el presupuesto UTF-8 con medición privada del constructor nativo, reserva explícita del primer tools/list y acumulado de todas las respuestas MCP entregadas. El mismo techo incluye instrucciones propias y definición de agente del CLI; no se equipara con una ventana de tokens ni con el contexto privado del proveedor. Los binarios mantienen límites y verificación de modalidad independientes.

La compactación utiliza una de las tres llamadas del presupuesto del run y como máximo una compactación. Reserva almacenamiento para snapshot y respuesta antes del envío bajo admisión compartida; unknown mantiene la reserva hasta conciliación. Citas literales, cobertura de mensajes nuevos y continuidad monotónica se validan sin atribuir autoridad al resumen. Originales y preferencias mantienen sus políticas de retención anteriores. SQL, Web y pruebas sintéticas se acreditan por separado de la aceptación Agentic; no se cierra el gate completo por un health200 o una sesión autenticada.
