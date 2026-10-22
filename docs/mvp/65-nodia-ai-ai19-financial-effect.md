# NodiaAI — AI-19: primer efecto financiero y recibo atómico

> Estado: implementación solicitada; documento en revisión, sin aprobación automática
> Fecha: 2026-10-17
> Dependencias: [plan45](45-nodia-ai-implementation-plan.md), [Finanzas22](22-personal-finance-contracts.md), [contratos41](41-nodia-ai-v1-contracts.md), [arquitectura43](43-nodia-ai-execution-architecture.md), [política50](50-nodia-ai-ai04-runtime-policy.md), [propuestas63](63-nodia-ai-ai17-drafts-revisions.md) y [confirmación64](64-nodia-ai-ai18-human-confirmation.md)

AI-19 incorpora un ejecutor interno para crear un movimiento financiero desde **un único paso ya confirmado**, con el efecto y su recibo comprometidos en la misma transacción PostgreSQL. La regla financiera sigue siendo la de `CreateFinanceMovementUseCase`; el coordinador añade la identidad y el testigo de ejecución, sin implementar otro ledger. La decisión está en [ADR-046](../architecture/decisions/ADR-046-nodia-ai-local-financial-witness.md).

El registro productivo `NODIA_AI_EXECUTION_ADMISSION` permanece vacío. No se publica una herramienta MCP de preparación/ejecución ni un nuevo endpoint, y el worker sigue sin despachar estos efectos. AI-20 debe incorporar recuperación durable y cerrar sus gates antes de habilitar admisiones operativas. La ejecución interna y las pruebas aisladas de esta etapa no acreditan que Gemini pueda crear movimientos en la app configurada.

## Límite del primer efecto

Se admite internamente sólo una creación de movimiento con nombre, importe, tipo, estado, categoría, destinatario, vínculo opcional a obligación y actividad ya resueltos en la propuesta exacta. No se infiere que un gasto esté pagado. Dinero e IDs conservan strings decimales, incluidas cantidades superiores al entero seguro de JavaScript. `false`, `null` y ausencia mantienen sus significados propios.

La propuesta debe estar confirmada y contener un único paso de `nodia_finance_movements_prepare_create`, sin dependencias ni bindings. Esta etapa no implementa conjuntos de varios pasos, lotes, eliminación, edición de movimientos, otros dominios ni efectos externos. Si cambia una condición material, se requiere una preparación/revisión y confirmación nuevas; observar o recuperar la propuesta anterior no crea un nuevo efecto nativo.

## Puerto nativo y comando congelado

`nodia-ai-finance-effect/` exporta `ExecuteNodiaAiFinanceMovementEffectUseCase.execute(step, context) → {id, ownerId}`. Su entrada procede de la revisión persistida y del contexto autorizado del servidor. No es un contrato accesible al modelo.

`resolveConfirmedCommand` exige un template completo, normalizado y válido conforme a `CreateFinanceMovementDto`: no vuelve a preparar, recortar un nombre, inventar valores, completar defaults ni sustituir el snapshot aprobado. Exige todos los campos normalizados y sus orígenes, el scope exacto y el contrato registrado; rechaza campos extra, bindings y dependencias. Después revalida autoridad y precondiciones contra el dominio.

El puerto llama al caso de uso financiero existente conservando actor y sesión reales, destinatario explícito y `transaction: context.manager`. Ese manager debe tener una transacción activa. `FinanceLedgerService` y las lecturas/escrituras nativas usan el mismo manager; no se abre ni compromete una transacción financiera independiente. La respuesta se reduce a un ID decimal válido y el dueño comprobado. El puerto aislado no proporciona idempotencia: debe invocarse dentro del coordinador que conserva el recibo.

## Precondiciones y compatibilidad

El contrato interno es `nodia-ai-finance-movement-create/2`, con catálogo de preparación `nodia-ai-ai19-finance-effect/1`. El snapshot de categoría incluye ID, dueño, nombre, clave, actividad y timestamp. Así, un cambio de nombre o clave invalida la propuesta incluso si `updated_at` resulta idéntico o pierde precisión al convertirse en `Date`. No se presenta ese timestamp como un contador de versión preciso.

Para pagos de obligaciones se conservan las comprobaciones nativas y el snapshot de obligación, importe/dirección/actividad, movimiento inicial/estado y total confirmado. Las lecturas usan los locks del ledger; una variación material produce409 `nodia_ai:preconditions_changed` y revierte el efecto. La regla nativa vuelve a verificar capacidad y asociaciones antes de guardar.

La nueva versión no reinterpreta propuestas con contratos anteriores. Un hash o catálogo obsoleto se rechaza; hace falta una nueva preparación. No hay alias ni fallback que transforme una aprobación antigua en un comando de esta versión.

## Transacción del coordinador

`nodia-ai-execution/` implementa `ExecuteNodiaAiFinancialExecutionUseCase.execute(identity, executionId)`. El orden compartido es autoridad → puerta de cola → chat → job/ejecución → locks de dominio. Se comprueban nuevamente identidad de origen, revisión/hash, estado confirmado, IDs y hashes de pasos, actor/dueño, scope y catálogo. No se acepta una ejecución con lease, fence, intentos o estado previo incompatible con este recorrido local.

Antes del efecto se verifican el grant exacto, sesión y permisos actuales, epoch del chat, job activo y deadlines. El presupuesto local se acota por `domain_step_seconds`, sesión, grant, job y caducidad del chat; también se comprueba después del efecto y antes de terminar el trabajo transaccional. No hay llamadas al proveedor ni trabajo externo mientras se mantienen estos locks.

Una sola transacción compromete:

- El movimiento financiero creado por el caso de uso nativo.
- El paso completed, su hash de comando resuelto, tiempos y recibo mínimo.
- La ejecución completed y su revisión nueva.
- El job done y el grant revocado.
- La liberación de `conversation.active_job_id` y el evento outbox `execution_changed`.

Cualquier fallo anterior al commit revierte el conjunto, incluido un fallo al insertar el evento o al proyectar el resultado final. Ninguna respuesta de éxito se obtiene de una escritura de movimiento aislada del recibo. Repetir la identidad de una ejecución completada recupera su resultado bajo autoridad actual y no vuelve a invocar el puerto financiero ni exige que el snapshot de negocio permanezca inmutable después de su efecto.

## Recibo y persistencia

El `minimal_receipt` tiene exactamente cuatro campos:

```json
{
  "schema_version": 1,
  "resource_key": "finance_movements",
  "resource_id": "31",
  "subject_user_id": "1"
}
```

Los valores del ejemplo son sintéticos. La identidad de paso/ejecución, clave nativa, hashes y tiempos permanecen en sus columnas existentes; no se duplican dentro del JSON ni se guarda otra copia del comando. No se añade tabla o columna ni se incorpora `execution_payloads` para este único paso sin bindings.

La migración `1792600000000-FreezeNodiaAiFinancialWitness` añade triggers que congelan el primer `bound_command_hash` no nulo, el estado/recibo/tiempos/error de un paso completed y el estado/revisión/tiempo de una ejecución completed. Complementa las invariantes de identidad de AI-18 sin impedir su ciclo de purga autorizado. Los registros financieros creados conservan su ciclo de vida propio; borrar el chat no elimina el movimiento.

## Observación y errores

`GET operations/:id` conserva el canal de lectura de AI-18 y proyecta la referencia `EntityRef` del recibo sólo después de reautorizar la operación y su origen. Un recibo acredita el efecto comprometido, no la presencia ni el estado actual del movimiento: su posterior edición/eliminación no debe provocar un nuevo efecto al recuperar la operación. Navegar a la entidad aplica los permisos y respuestas actuales de su módulo.

Si falla el transporte del commit después de terminar el callback, el resultado puede ser incierto:503 `nodia_ai:execution_result_unknown`, sin reejecución automática. Un error SQL que acredita rollback definitivo se devuelve como409 de conflicto. AI-20 resolverá la conciliación durable; AI-19 no transforma una pérdida de respuesta en permiso para ejecutar otra vez.

## Verificación y continuidad

La [evidencia AI-19](../evidence/nodia-ai-ai19-validation.json) debe distinguir pruebas de casos de uso, PostgreSQL/HTTP aislado, regresiones y cualquier despliegue efectivamente comprobado. Este documento no atribuye conteos, migraciones aplicadas ni resultados de cuenta real antes de registrarlos allí.

Los casos necesarios cubren efecto/recibo/outbox conjuntos, rollback después del efecto, concurrencia y observación repetida sin duplicados, revocación/propiedad, contrato obsoleto, precondiciones modificadas, bigint exacto, error del commit, integridad de los triggers y conservación del registro financiero al purgar el chat. La validación de mocks no sustituye la prueba de esas garantías en PostgreSQL.

Siguen fuera de esta etapa el claim de execution jobs, leases/fences del worker, cancelación/resume y conciliación durable de resultados inciertos; también ejecución secuencial general, bindings, efectos externos, publicación MCP y admisión productiva. El catálogo de lecturas/contexto existente conserva sus gates independientes. Esta entrega no aprueba automáticamente sus documentos ni constituye aceptación de producción.

Ficha funcional: [movimiento confirmado](../nodia-ai/knowledge/personal-finance/features/confirmed-movement-effect.md), draft/unregistered. El fragmento de lecturas aprobado de movimientos conserva su contenido y autorización.

## Verificación realizada

1.877 pruebas Server/174 archivos,53 casos finales de coordinador/proyección y109 Client/8 archivos; build/tipado/lint correctos, con tres advertencias Server anteriores. La suite completa Server precedió la corrección del identificador SQL reservado `grant`; los53 casos focales y la integración PostgreSQL ejecutaron la versión final.32 checks nuevos y137 regresiones SQL/HTTP verifican atomicidad, rollback, concurrencia, COMMIT con acuse perdido, autoridad, importe exacto, abonos y purga. Los efectos ocurrieron sólo en PostgreSQL desechable; no hubo inferencias ni gastos creados en la BD configurada.

[Activación con respaldo](../evidence/nodia-ai-ai19-lab-activation.json) y [estado leído](../evidence/nodia-ai-ai19-live-state.json):24 migraciones,18 tablas/239 columnas,API/worker activos y cero trabajo pendiente. La nueva ficha excluida cambia únicamente registry_sha256/release_id del bundle; [comparación](../evidence/nodia-ai-ai19-knowledge-delta.json) acredita contratos, documentos y fragmentos publicados idénticos. La habilitación operativa y aceptación pública permanecen pendientes.
