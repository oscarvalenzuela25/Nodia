# NodiaAI AI-21 — operaciones financieras individuales

> Estado documental: en revisión; sin aprobación automática.
> Fecha: 2026-10-17.
> Dependencias: [plan45](45-nodia-ai-implementation-plan.md), [Finanzas22](22-personal-finance-contracts.md), [contratos41](41-nodia-ai-v1-contracts.md), [arquitectura43](43-nodia-ai-execution-architecture.md), [autoridad54](54-nodia-ai-ai08-transversal-authority.md), [efecto65](65-nodia-ai-ai19-financial-effect.md) y [recuperación66](66-nodia-ai-ai20-execution-recovery.md).

## Alcance y publicación

AI-21 amplía el efecto de AI-19/20 a las doce escrituras individuales existentes de Finanzas: crear, actualizar y eliminar movimientos, categorías, grupos y obligaciones. La preparación queda registrada en código, y el worker despacha únicamente una operación financiera confirmada por propuesta. No se introduce otro ledger, SQL generado por el modelo, lotes, pasos dependientes ni un coordinador de transacciones entre servicios.

La familia mantiene las once lecturas publicadas de AI-15: obtener/listar movimientos, categorías, grupos y obligaciones; resumen general y desgloses por categoría/grupo. Estas consultas conservan sus schemas, autoridad, aislamiento y límites. El catálogo general continúa con sus 67 capacidades de lectura/referencia y 27 fragmentos. **Los preparadores MCP financieros siguen sin publicar**: registrar puertos internos y actualizar esta documentación no da al modelo acceso a nuevas herramientas ni acredita una escritura preparada por Gemini.

La [decisión de puertos y recibos](../architecture/decisions/ADR-048-nodia-ai-financial-operation-ports.md) evita duplicar reglas y conserva las aprobaciones históricas del primer movimiento. La [ficha de efectos confirmados](../nodia-ai/knowledge/personal-finance/features/confirmed-movement-effect.md) amplía el borrador existente; las cuatro fichas funcionales aprobadas de lectura no cambian.

## Matriz de escrituras

Los nombres siguientes identifican registros internos de preparación. Cada ejecución llama al caso de uso nativo de la fila con actor, sesión, destinatario y `transaction: context.manager`.

| Recurso | Preparadores internos | Escritores nativos y efectos |
|---|---|---|
| Movimientos | `nodia_finance_movements_prepare_create`, `_update`, `_delete` | `CreateFinanceMovementUseCase`, `UpdateFinanceMovementUseCase`, `DeleteFinanceMovementUseCase`; creación/corrección/eliminación del movimiento, conservando dirección, fase y reglas de liquidación |
| Categorías | `nodia_finance_categories_prepare_create`, `_update`, `_delete` | `CreateFinanceCategoryUseCase`, `UpdateFinanceCategoryUseCase`, `DeleteFinanceCategoryUseCase`; eliminar sólo sin movimientos vinculados y retirar sus pertenencias a grupos |
| Grupos | `nodia_finance_category_groups_prepare_create`, `_update`, `_delete` | `CreateFinanceCategoryGroupUseCase`, `UpdateFinanceCategoryGroupUseCase`, `DeleteFinanceCategoryGroupUseCase`; asociaciones reemplazadas atómicamente; eliminación conserva categorías y movimientos |
| Obligaciones | `nodia_finance_obligations_prepare_create`, `_update`, `_delete` | `CreateFinanceObligationUseCase`, `UpdateFinanceObligationUseCase`, `DeleteFinanceObligationUseCase`; creación junto al movimiento inicial, cambio de principal junto a su importe inicial y eliminación de ambos sólo sin pagos |

En cada fila, `_update` y `_delete` sustituyen el sufijo `_create` del nombre completo. Los saldos calculados no son un quinto recurso de escritura: resultan del mismo ledger y se consultan mediante las lecturas existentes. No se acepta editar `paid_amount`, `remaining_amount`, `user_id`, timestamps o IDs de identidad.

## Preparación y revisión exacta

El preparador acepta sólo los campos explícitos del DTO de la operación. Una creación incompleta devuelve aclaraciones y no ejecuta escritores. Actualizar exige identificar el registro y aportar al menos un campo; eliminar exige el destinatario y la identidad del objetivo. El destinatario omitido conserva el ámbito propio; operar para otra persona requiere seleccionarla expresamente. No se infiere que un gasto esté pagado ni se convierten importes o IDs bigint a `Number`.

Las nuevas operaciones congelan un envelope cerrado con `schema_version`, `owner_id`, `id` para actualización/eliminación, `command` y `origins`. El binding incluye ese envelope completo, además de herramienta, contrato y scope, para que el objetivo no pueda cambiar conservando la misma identidad. Los orígenes distinguen datos aportados y defaults reales; no se completa una duda de negocio con un default técnico.

Crear categoría exige nombre y clave. Crear grupo exige además `category_ids`, que puede ser `[]`. Actividad por defecto es `true`; `false` no se sustituye. En actualizaciones de grupo, omitir `category_ids` conserva la selección, `[]` vacía las asociaciones y una lista las reemplaza. Las pertenencias históricas inactivas no seleccionadas se conservan conforme al escritor nativo. La vista previa usa arrays/objetos etiquetados de `ReviewValue` para mostrar selecciones y referencias; los IDs de asociaciones no se convierten en campos de edición libre de la interfaz.

Crear obligación exige nombre, clave, tipo, importe y categoría del movimiento inicial. Descripción es opcional y nullable; actividad usa su default nativo. La vista previa muestra explícitamente el movimiento inicial derivado: loan genera expense/paid y debt genera income/received. Actualizar el principal muestra la propagación a su movimiento inicial; eliminar la obligación muestra ambos efectos. Los campos derivados describen reglas nativas y no se aceptan como comandos editables.

El movimiento de creación conserva exactamente el contrato interno `nodia-ai-finance-movement-create/2`, catálogo `nodia-ai-ai19-finance-effect/1`, binding y recibo de AI-19. AI-21 no reinterpreta sus revisiones ni modifica su identidad por enriquecimientos de presentación. Los nuevos puertos usan `nodia-ai-ai21-finance/1` y contratos de operación propios. El comando original de pago ya conserva importe, estado, obligación y las precondiciones del saldo; los saldos actuales se obtienen mediante las lecturas financieras. No se promete mostrar todos los agregados posibles de un movimiento en su preview.

## Reglas financieras y autoridad

Se conserva [Finanzas22](22-personal-finance-contracts.md): pesos enteros positivos dentro del bigint de cada fila, estados compatibles con dirección, transiciones legales, pagos parciales y ninguna asociación entre propietarios distintos. `is_active` controla visibilidad y no elimina la validez de un pago confirmado. No se agrega moneda, fecha económica propia, proveedor, intereses o recurrencia.

El importe de un movimiento inicial se corrige desde su obligación. Su eliminación directa está protegida. Una obligación con cualquier pago, incluso pendiente, cancelado o inactivo, no se elimina implícitamente; el usuario debe resolver esos registros mediante operaciones separadas. Categoría con cualquier movimiento vinculado tampoco se elimina. Borrar un grupo retira pertenencias y conserva las categorías y movimientos.

La preparación y el efecto vuelven a aplicar las reglas y permisos nativos. Usuario ordinario requiere NodiaAI y Finanzas asignados y actúa sobre su propio ámbito. `super_admin` vigente puede operar para otro destinatario conservando la propiedad y su identidad real. Inspeccionar un chat ajeno no permite confirmar, cancelar o reanudar como su dueño: el administrador prepara sus propias propuestas en su chat.

## Precondiciones y concurrencia

Los snapshots incluyen valores materiales, identidad y marcas temporales; no dependen únicamente de `updated_at`. Categorías/grupos conservan datos del objetivo, unicidad de clave y asociaciones relevantes. Grupos capturan metadatos de las categorías seleccionadas o conservadas; eliminar categoría/grupo muestra también pertenencias archivadas que se retirarán. Movimientos/obligaciones incluyen objetivo, categoría, obligación, movimiento inicial y liquidación cuando corresponda.

Los puertos comparten los locks de los escritores nativos: autoridad → cola → chat → job/ejecución/pasos → recursos financieros. En ledger se conserva obligación antes de movimiento y categoría. En grupos se conserva grupo → categorías ordenadas → pertenencias; una lectura preliminar de IDs no toma locks de pertenencias antes de las categorías. Las constraints siguen resolviendo colisiones concurrentes de clave/FK. Un cambio material antes del efecto produce conflicto y exige una revisión y confirmación nuevas.

La carga de asociaciones se acota con `results.json_collection_items`, actualmente 128. Se lee una fila adicional para detectar exceso y se rechaza la propuesta; **no se trunca silenciosamente el impacto de una eliminación**. Esta restricción de admisión del chat no cambia lo que permiten los endpoints nativos. También siguen vigentes los presupuestos de bytes, profundidad, consultas y tiempo de la política50.

## Efectos compuestos y recibos históricos

Una operación nativa compuesta sigue siendo un único paso: crear obligación y movimiento inicial, propagar su importe o retirar pertenencias se compromete dentro del mismo manager. No constituye una secuencia de propuestas ni una escritura masiva. El dominio, recibo, cierre de paso/ejecución/job/grant/chat y evento completed comparten commit.

Los nuevos recibos usan el schema cerrado `FinancialEffectReceipt`: versión, recurso financiero, operación create/update/delete, ID afectado y destinatario. Su referencia acredita el efecto histórico, incluso después de borrar el registro. Recuperarla no consulta su existencia actual para reconstruir éxito ni crea un reemplazo. Navegar a Finanzas vuelve a aplicar el estado y permisos actuales. El recibo original `FinancialMovementReceipt` de AI-19 continúa siendo válido sin añadirle retroactivamente el campo operation.

No hay tablas, columnas ni migraciones nuevas. Los triggers existentes mantienen inmutables el primer binding y los pasos/ejecuciones completed. Los recibos resueltos se borran al expirar el chat conforme a la política de 90 días; no constituyen un archivo permanente y no eliminan ni restauran registros del dominio.

## Worker, recuperación y cancelación

Las doce operaciones usan el mismo claim/fence, concesión acotada, transacción de efecto y observación de AI-20. Cancelar conserva lo que ya comprometió y no compensa registros. Recuperar adquiere las barreras del escritor y consulta el witness; no llama al escritor para averiguar si ocurrió el efecto. Sólo un rollback local probado ofrece reanudación humana con la misma ejecución, objetivo, comando, contrato, binding y clave nativa, bajo sesión y permisos actuales.

Una respuesta perdida después del commit se observa mediante la identidad original. Ausencia/inconsistencia de witness no autoriza retry de un efecto externo. Si cambió una precondición, se exige nueva preparación/revisión/botón; no se recalculan comandos silenciosamente. Estas garantías locales tampoco amplían el alcance a varios pasos, bindings, archivos o proveedores.

## Verificación y límites

[Evidencia consolidada](../evidence/nodia-ai-ai21-validation.json): 2.011 pruebas Server/180 archivos y 1.344 Client/201 archivos; builds, tipado y lint sin errores. El lint Server conserva tres avisos previos. La suite Client completa pasó con dos workers, sin cambiar assertions ni timeouts; el primer intento bajo alta concurrencia se interrumpió tras un fallo en ProvidersTab que no se reprodujo.

PostgreSQL/HTTP/procesos desechables: 47 comprobaciones nuevas, 205 regresiones de coordinación AI-16..20 y 17 financieras nativas: 269 en total. El Gateway de cuota también pasó con cinco recibos sintéticos, sin contarlos como comprobaciones numeradas. La prueba nativa espera ahora el listener TCP final de PostgreSQL antes de inicializar TypeORM; evita conectar contra el servidor temporal de inicialización de la imagen, sin cambiar los casos financieros.

Se comprobaron pagos parciales, principal, estados, asociaciones archivadas/ajenas, bigint máximo, snapshots alterados con igual timestamp, concurrencia de pago nativo/worker, rollback de grupo y pivotes ante fallo del recibo, crash antes de UPDATE, resume humano, cancelación con fence y pérdida de acuse de COMMIT de DELETE. Un worker compilado independiente ejecutó una operación nueva sin proveedor ni slot de inferencia.

La [revisión visual](../evidence/nodia-ai-ai21-ui-validation.json) usa transporte sintético aislado: derivados traducidos, borrador/foco conservados al pasar a móvil, advertencia de eliminación y recibo histórico tras refrescar. ES/oscuro y EN/claro, sin overflow horizontal; teclado físico móvil pendiente. Origen QA detenido, viewport restaurado y pestaña real de5174 intacta.

Laboratorio privado actualizado con backup: API/worker activos, doce registros de ejecutores, 24 migraciones, 18 tablas NodiaAI/239 columnas y cero jobs/intentos/slots pendientes. Sin cambios de esquema, datos financieros configurados, credenciales, dependencias o contenedor Gemini. Los 798 archivos dist desplegados coinciden con el paquete final. Conocimiento conserva release057a, 67 capacidades/27 fragmentos; los cuatro documentos actualizados siguen como borradores excluidos.

### Correspondencia con los escenarios de44

| Escenarios | Alcance comprobado y continuidad |
|---|---|
| NR-01 | Preparadores internos piden mínimos y semántica de estado; no se acredita interpretación de lenguaje natural por Gemini |
| NR-02..03 | Confirmación/deduplicación y recuperación del efecto original; regresiones AI-18..20 y nuevos UPDATE/DELETE |
| NR-04 | Snapshots materiales impiden sobreescribir una revisión desactualizada |
| NR-16/18 | Destinatario explícito del super_admin sin cambiar propiedad; autoridad actual y revocación en las barreras financieras comunes, sin acreditar casas/inferencia/secuencias generales |
| NR-05..07 | Finanzas conserva sus límites de proveedor/fecha/moneda; informes cruzados y agregación al grano correcto mantienen su aceptación integral en AI-30/31, según la matriz del plan45 |

Estas pruebas no acreditan preparación financiera por Gemini, publicación MCP ni aceptación de producción pública. Se conserva una operación por propuesta; lotes, secuencias de AI-23, informes de AI-30/31 y los gates anteriores de AI-15 siguen separados. Ninguna ficha ni ADR pasa a aprobado por esta entrega.
