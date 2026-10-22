# NodiaAI AI-20 — worker de efectos, recuperación y cancelación

> Estado documental: en revisión; sin aprobación automática.
> Fecha: 2026-10-17.
> Dependencias: [plan45](45-nodia-ai-implementation-plan.md), [contratos41](41-nodia-ai-v1-contracts.md), [arquitectura43](43-nodia-ai-execution-architecture.md), [política50](50-nodia-ai-ai04-runtime-policy.md) y [efecto65](65-nodia-ai-ai19-financial-effect.md).

## Alcance

Conectar al worker independiente el único efecto financiero verificado en AI-19: crear un movimiento mediante una revisión exacta confirmada. El registro de admisión usa los metadatos del preparador nativo, sin duplicar su hash o versión. Rechaza múltiples pasos, dependencias y output bindings; las demás operaciones financieras siguen en AI-21. Web conserva su rol conversacional.

La preparación MCP sigue sin publicar: su ficha permanece draft/unregistered. Habilitar un ejecutor interno no aprueba el conocimiento, no amplía el catálogo de herramientas del modelo y no demuestra que Gemini haya preparado una escritura. La verificación del flujo completo de esta entrega prepara revisiones con el caso de uso interno en PostgreSQL desechable.

## Dispatch y prueba del efecto

El worker alterna la prioridad entre turnos y ejecuciones y comparte el límite global/por dueño de trabajos leased. Un efecto SQL no reserva perfiles ni consume inferencias. El claim admite un trabajo ready, incrementa fence/intento y deja ejecución/paso running, con evento durable. Una segunda transacción corta comprueba sesión, módulos, grant, epoch, fence, intento, versión, hash y precondiciones antes del escritor financiero nativo.

El movimiento, recibo, cierre de intento/job/grant/ejecución, liberación del chat y evento completed comparten commit. No se mantiene SQL abierto durante una llamada a IA. Un worker antiguo no puede ejecutar con otro fence; el resultado completed sigue inmutable y puede observarse después de perder una respuesta.

Orden de locks: autoridad compartida → cola → chat → job → ejecución → pasos → recursos financieros. Cancelar y recuperar toman las mismas barreras. Las esperas SQL están acotadas por la política existente; un timeout del control humano devuelve409 `nodia_ai:execution_busy` y conserva el estado, sin afirmar que se canceló el efecto.

## Recuperación y reanudación

Una caída antes de la transacción o durante ella deja un claim sin recibo. Recuperar debe adquirir las barreras del escritor: sólo después de terminar esa transacción la ausencia del witness demuestra que el efecto local no comprometió. El recuperador no invoca el escritor; cierra el intento y marca un rollback local verificable. Una respuesta COMMIT perdida con recibo completed se conserva tal cual.

Un witness inconsistente o un despacho que no pueda acreditarse permanece unknown; no se convierte en una creación nueva. Las observaciones repetidas de unknown no consumen revisiones/eventos indefinidamente. Esta prueba SQL local no se generaliza a HTTP, proveedores, archivos ni otros efectos externos.

`POST /nodia-ai/operations/:id/resume` requiere una acción humana, la revisión esperada y `client_request_id`. Sólo admite un fallo con rollback local probado, sin recibo, con el contrato original registrado, precondiciones materiales intactas, chat libre y capacidad de cola/outbox. Reutiliza ejecución, paso, job, clave nativa, versión y primer binding; renueva el grant para la sesión humana actual y conserva un único marcador acotado de la última reanudación en `recovery_descriptor`. Su replay devuelve el estado actual; una solicitud vieja después de otra reanudación falla por revisión.

La prueba de confirmación original no se vuelve una confirmación de contenido distinto. Si cambiaron categoría, obligación u otra precondición material, se persiste el resultado no reanudable y se exige nueva propuesta/revisión/botón. `can_resume` considera dueño, registro vigente, witness y espacio para los eventos queued/running más la reserva terminal; nunca concede permisos por sí mismo.

## Cancelación y observación

`POST /nodia-ai/operations/:id/cancel` valida identidad y revisión. Si el efecto ya comprometió, devuelve `already_terminal` y su recibo. Si adquirió primero las barreras de un efecto aún no comprometido, cancela, incrementa fence, cierra el intento, revoca el grant y libera el chat. No borra ni compensa movimientos creados. Super_admin puede inspeccionar otros chats, pero no confirmar/cancelar/reanudar bajo la identidad de su dueño.

`GET /nodia-ai/operations/:id` relee la cabecera después de adquirir el lock del chat para evitar mezclar estados anteriores con pasos recién completados. La interfaz muestra estados y referencias verificadas, acciones humanas y recuperación GET sin reenvío automático. Un error conserva la vista; revocación o respuesta inválida retira el contenido restringido. Sólo un recibo completado invalida la caché financiera; una admisión no cuenta como efecto.

Al reabrir la propuesta confirmada se recupera su ejecución original. El enlace abre el módulo financiero; el recibo acredita la creación histórica y no garantiza que el registro continúe existiendo sin cambios.

## Persistencia y retención

Sin tablas, columnas ni migraciones nuevas. Se reutilizan jobs, attempts, grants, encabezados/pasos y outbox. [ADR-047](../architecture/decisions/ADR-047-nodia-ai-local-execution-recovery.md) registra la elección.

Expirar el chat elimina contenido, propuestas y recibos resueltos según 90 días desde el último mensaje del dueño. Si la purga separó un claim local sin resolver, la conciliación usa sólo la identidad mínima retenida, adquiere las barreras del escritor y elimina el journal resuelto. No reconstruye mensajes/comandos ni borra datos financieros.

## Verificación y límites

La [evidencia consolidada](../evidence/nodia-ai-ai20-validation.json) identifica los artefactos y checks realmente ejecutados. La [integración PostgreSQL/HTTP](../evidence/nodia-ai-ai20-postgres-integration.json) usa proceso compilado, fallos de proceso y registros sintéticos desechables. QA de interfaz usa un transporte sintético aislado; no equivale a una escritura preparada por Gemini.

Conservar los gates de publicación, nuevas familias, inferencia real de preparación, backups/restauración/carga y aceptación productiva en sus etapas. No se atribuyen cuotas, disponibilidad de modelos ni capacidades nuevas a partir de esta ejecución SQL.


Verificación final:1.922 tests Server/177 archivos y1.326 Client/201 archivos; builds, tipado y lint correctos (tres warnings Server anteriores).36 checks nuevos y169 regresiones PostgreSQL/HTTP. API/worker activados con [respaldo](../evidence/nodia-ai-ai20-lab-activation.json), sin migraciones,24 entradas de ledger y18 tablas/239 columnas; [lectura final](../evidence/nodia-ai-ai20-live-state.json) confirma un ejecutor registrado y cero pendientes. El bundle conserva el digest y las67 capacidades/27 fragmentos de lectura. [QA sintético](../evidence/nodia-ai-ai20-browser-qa.json) verifica recuperación ES/oscuro, cancelación EN/claro390px y ausencia de errores tras corregir el observador de caché.
