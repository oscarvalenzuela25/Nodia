# AI-17 — revisión independiente de contratos

Revisión read-only de fuentes al iniciar AI-17 (2026-10-16). No acredita implementación, publicación, ejecución de pruebas ni aprobación documental.

## Alcance concreto y opción de menor complejidad

AI-17 en plan45 incluye M2, borradores/aclaraciones, revisiones/pasos inmutables, PublicProposal reconstruida, DAG/bindings tipados, diff estructurado y JCS/hash normalizado. AI-18 incorpora desafío/confirmación/execution/grant/job/evento; AI-19 primer efecto financiero y garantía efecto+receipt; AI-20 recuperación/cancelación del ejecutor. Materializar sólo cuatro tablas de M2 ahora (drafts, proposals, proposal_revisions, proposal_steps), manteniendo las otras cuatro para consumidores posteriores, respeta ADR040 y la regla de migración incremental de45. Sin tabla de aristas ni envelope/public_preview duplicado, vectores, scheduler nuevo o CRUD genérico.

La infraestructura puramente genérica probaría estructura pero no cumpliría la comprobación de mínimos/normalización del caso real. Recomiendo primer preparador real interno de `nodia_finance_movements_prepare_create`, registrado en un registro tipado de preparación separado del catálogo publicado, con schemas cerrados de datos parciales/comandos/edición/precondiciones. Que pueda ejercitarse mediante caso de uso y PostgreSQL desechable. No habilitar MCP hasta cumplir los requisitos expresos del catálogo: human_confirmation_pipeline y durable_step_recovery. Mantener67 capacidades/27 fragmentos y gateway sólo read/read_artifact es coherente durante AI-17. El preparador no llama CreateFinanceMovementUseCase ni saveMovement.

## Wire que ya existe

* `PreparationResult`: status ready/needs_clarification/blocked, draft_id nullable, proposal nullable, missing_fields[], clarification_keys[], error nullable. ready exige propuesta ready completa y cero preguntas/error; needs_clarification no equivale a éxito/registro; blocked exige causa coherente.
* `PublicProposal`: proposal_id UUIDv4, revision integer positivo, hash SHA256hex, catalog_version, state, steps mínimo1, execution_id nullable, created_at, expires_at nullable. No challenge/token, comandos internos o claves.
* `PublicStep`: step_id UUIDv4, tool_name, kind domain_change/secure_flow/preference_change, target EntityRef|null, scope PublicScope, changes[], depends_on UUIDs únicos, effect_key, output_bindings[], precondition_summary opcional.
* `ChangedField`: field_key registrado, before/after ReviewValue, origin user/accepted_preference/database/contract_default/future_step, before_present y after_present. No confundir absent con null, false o0.
* `ReviewValue`: scalar o tagged ReviewArray(kind=array,items[]) o ReviewObject(kind=object,fields:[{field_key,value}]). Objetos deben rechazar field_keys semánticamente duplicados; arrays conservan orden. El tagged formato no es DSL ni JSON pointer ejecutable.
* `ProposalUpdateRequest`: expected_proposal_revision, expected_hash y edits mínimo1 de {step_id,field_key,value}. uniqueItems no detecta dos valores distintos para el mismo step/field: rechazar duplicado semántico. No aceptar command, SQL, path, scope, actor, preconditions, reemplazo de pasos o campos administrados.
* Rutas aprobadas: GET/PATCH proposals/:id. Canal PATCH humano; no tool de confirmar ni de editar con cookies del agente. GET no consume budget ni reejecuta preparación. WorkflowPrepareInput catalog_version+draft_ids únicos; no expected draft revisions en wire, por eso lock/revisión actual debe ser parte de la transacción del coordinador.

## Modelo M2 mínimo

* drafts: id/chat/actor/tool_call nullable/tool_name/catalog/revision/scope/partial_command/clarifications/state/claimed_proposal_id/timestamps. Estados incomplete,ready,claimed,cancelled,invalidated. Claimed requiere propuesta. UNIQUE(id,chat), FK chat cascade; actor restrict; tool_call/chat y claimed_proposal/chat compuestas NO ACTION diferidas.
* proposals: id/chat/actor/current_revision/created_at; UNIQUE(id,chat), FK chat cascade, actor restrict; FK(id,current_revision) a revisions diferida.
* revisions: PK(proposal_id,revision), state/hash/catalog/canonicalization/created_at/expires_at; propuesta cascade. ready congela contenido; estado puede avanzar sin mutar comando. No envelope/preview completos duplicados.
* steps: id PK, proposal/revision/position, tool_name/contract_hash/kind/effect_key/scope/command_template/public_step/output_bindings/preconditions. FK revisión cascade; UNIQUE(proposal,revision,position), UNIQUE(id,proposal,revision); position>0.
* La inmutabilidad debe cubrir INSERT tardío de pasos, UPDATE y DELETE directo; permitir cascadas de purga aprobadas, no bloquear expiración por triggers indiscriminados. Debe comprobarse SQL aislado, no sólo readonly TypeScript.
* No cambiar hash al invalidar/superseder/expirar: hash representa contenido congelado, no estado mutable. GET debe reconstruir/verificar hash del contenido persistido, no hacer nuevos reads de negocio para modificar preview. Reautorización y comprobación de disponibilidad actual son separadas.
* Policy: máximo8 pasos, JSON depth16/collection128, input/output65536 bytes, propuesta900s; caducidad no mayor que chat. No renovar90 días con GET/PATCH/confirm: sólo mensaje nuevo del dueño.

## DAG, bindings y concurrencia

Orden estable position, único por revisión. Rechazar step_ids duplicados, self/forward/cross-revision, dependencias repetidas, binding a predecessor no declarado, salida desconocida/no apta, target no editable/ya concretado, tipo/representación no compatible y dos bindings al mismo target. Validar que todo obligatorio esté conocido o cubierto por binding permitido; ni SQL ni interpolación ni JSON pointer. La v1 secuencial se detiene en fallo; no scheduler paralelo.

Workflow: locks en orden estable y bajo la misma autoridad/chat, comprobar todos los borradores del mismo actor/chat/catálogo y estado, reclamar una sola vez y superseder las propuestas individuales. No permite confirmar ambas; rollback completo si uno no disponible. No convertir batch masivo excluido en workflow permitido.

PATCH: expected revision+hash, lock propuesta/chat, reautorizar módulos/recursos/destinatario, verificar ready/no expired/no confirmed, descriptor exacto y claves. Preparar valores normalizados y nueva revisión desde snapshot previo; nunca sobrescribir contenido. Conflicto entre dispositivos o edición doble conserva una sola current_revision y obliga refrescar. Actor real nunca es owner ajeno por inspección super_admin. No locks mantenidos mientras espera edición o inferencia.

## JCS y hash

Fuente primaria consultada: https://www.rfc-editor.org/rfc/rfc8785.html . Verificar vectores §3.2 y AppendixB. JCS usa orden de claves por unidadesUTF16 raw (no localeCompare), escaping/números ECMAScript, -0→0, Unicode sin normalización y rechaza lone surrogates/NaN/Infinity. Rechazar undefined, funciones, bigintJS, ciclos, arrays sparse, toJSON/Date/prototipos no JSON y entradas ambiguas, no aceptarlas porque JSON.stringify las convierte silenciosamente. Usar parser estricto existente antes de perder claves duplicadas; no prometer detectar redondeo original después de JSON.parse. Dinero/IDs se mantienen strings y son los contratos de dominio quienes rechazan Number.

`canonicalKnowledge` actual no es por sí solo frontera JCS segura: sorter+JSON.stringify sin estas defensas; no cambiar su algoritmo de hashes de publicación para arreglar propuestas. Canonicalizer nuevo con versión propia; envelope reconstruido desde propuesta/revisión/steps ordenados incluye versión, actor/destinatario, catalog, scopes, tool/contract/effect, templates, bindings, precondiciones y public_step exacto. Verificar todos los campos que alteran efectos/proyección cambien hash; no confundir approval_hash con futuro bound_command_hash/request_hash nativo.

## Primer caso financiero real

Fuente: CreateFinanceMovementDto/CreateFinanceMovementUseCase/finance-ledger.rules/finance-validation. Obligatorios name trim1..255, amount positivo decimal string<=9223372036854775807, category_id misma representación, type income/expense, status explícito pending/received/paid/cancelled. validateMovementState permite income pending/received/cancelled y expense pending/paid/cancelled. No inferir paid por 'voy a comprar'. Optional: obligation_id nullable; is_active por defecto true. Normalizado obligation_id:null/is_active:true debe aparecer origen contract_default en preview. Sin tipos/fechas/currency inexistentes inventados.

Categoría debe pertenecer al destinatario y estar activa. Obligación opcional debe pertenecer al destinatario, estar activa, initial movement válido no cancelado y dirección repayment compatible; ensureRepaymentCapacity si confirmado. El preparador puede reutilizar reglas nativas de validación sin duplicar el ledger y capturar precondiciones exactas/versiones reales. Preparación válida no garantiza ejecución futura: AI19 necesita revalidar precondiciones bajo transacción del efecto.

## Riesgos de integración a vigilar

1. Gateway actual reserva toolCall.id sólo DESPUÉS del handler; al integrar preparación futura deberá preasignar/enlazar ID en misma tx o dejar FKnull mientras sea interno. Nunca adapter_call_id externo como UUID FK.
2. Replays de preparación deben recuperar el mismo receipt/draft/proposal con autoridad actual, no crear revisiones nuevas. Input de continuación debe incluir identidad/revisión del draft si se publica, con contrato explícito; no buscar 'último draft' heurísticamente.
3. M1 journal tiene proposal_ready con refs, pero eventos requieren run_id. No fingir origen run para ediciones humanas offline; extender contrato de observación cerrado sólo si lo exige un consumidor real.
4. PublicScope no conserva por sí solo session/retention_epoch y no debe usarse como prueba de autoridad. Reutilizar AuthorizeNodiaAiConversationUseCase actual y authority transaction; actor/session nunca argumentos del modelo.
5. Campos internos adicionales para reconstruir/hash deben estar persistidos en lugares no duplicados. No obtener destinatario o defaults de datos actuales al volver a abrir una propuesta vieja.
6. Ready visible AI17 debe decir que aún no se ejecuta/confirmación pendiente AI18, sin botón que prometa writes o habilitar publicación sólo por completar preview.

