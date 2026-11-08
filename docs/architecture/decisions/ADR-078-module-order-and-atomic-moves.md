# ADR-078 — Orden persistido y movimientos atómicos de módulos y grupos

> Estado: propuesto
> Fecha: 2026-10-25

## Contexto

El usuario solicita que la tabla administrativa represente el orden de navegación, separe módulos por grupo y permita mover filas mediante controles. Las altas deben quedar al final de su ámbito. Tras la planificación inicial autorizó FX-02/03 y la adopción parcial FX-04; posteriormente pidió un asa antes de ID para arrastrar. El ADR permanece propuesto: autorización de implementación no equivale a aprobación documental general. [Plan87, FX-02/03](../../mvp/87-core-feedback-module-order-plan.md#contrato-propuesto-de-orden--fx-02).

Las entidades actuales carecen de orden persistido y Sidenav fuerza prioridades por clave. Los escritores Core ya usan una frontera transaccional exclusiva antes de leer autoridad/dominio; añadir un coordinador de locks duplicaría esa garantía. El listado existente pagina módulos y traduce relaciones por conjuntos.

## Opciones consideradas

### Opción A — Editar sort_order manualmente y permitir empates

- Reutiliza PUT de formularios, pero obliga a la persona a conocer números y resolver colisiones.
- Intercambiar dos valores iguales no mueve una fila; dos PUT desde Client pueden dejar un cambio parcial.
- No representa directamente el control Subir/Bajar solicitado.

### Opción B — Posiciones distintas y movimiento semántico de dos vecinos

- Enteros no negativos por ámbito, asignados por Server al final de una creación real; huecos válidos tras eliminar/mover de grupo.
- Un movimiento valida vecinos/precondiciones y cambia dos filas atómicamente; no renumera el catálogo ni necesita tablas de orden nuevas.
- Necesita dos contratos administrativos pequeños y unicidad diferible para swaps, además de metadata de vecinos calculada por conjuntos.

### Opción C — Drag-and-drop y envío de la lista completa

- Permite desplazamientos largos, pero introduce borradores globales, reconciliación entre páginas y arrays potencialmente incompletos por filtros.
- No se necesita para el primer recorrido solicitado; no se planifica una API genérica de escrituras masivas.

### Opción D — Asa de arrastre con destino semántico atómico

- Atiende el gesto solicitado sin arrays de catálogo ni borradores globales: un PATCH before/after con origen/destino y rangos esperados, más grupo esperado para módulos.
- Rota sólo el intervalo afectado dentro de la frontera Core existente y conserva sus rangos/huecos. No encadena swaps HTTP ni requiere columnas, migraciones o tablas adicionales.
- Drag limitado a filas cargadas del mismo ámbito; teclado ↑/↓ conserva los vecinos globales y el cruce de página. Los grupos se arrastran desde su panel global, no desde cabeceras repetidas de módulos.

## Decisión propuesta

Elegir B para persistencia y pasos adyacentes, ampliada con D para el asa solicitada: `module_groups.sort_order` único global y `modules.sort_order` único por grupo, enteros PostgreSQL no negativos. `MAX+1` bajo la frontera Core existente sólo en altas reales o al cambiar de grupo. Primer registro0; edición/reactivación/upsert existente conserva orden. No DEFAULT0 común ni números editables libremente en CRUD.

`PATCH /module/:id/order` y `/module-group/:id/order` reciben dirección y precondiciones; módulos incluyen grupo esperado. Up/down compara el vecino inmediato global y cambia dos valores. Before/after compara ID/rango de origen y destino, exige el mismo ámbito y rota los rangos del intervalo completo, incluidos inactivos. Diferir las constraints únicas sólo durante la escritura atómica y validar antes del commit. Conservar huecos; no renumerar todo el catálogo. No duplicar locks ni añadir revisiones/journals de orden por anticipación.

Los cambios obsoletos son409 sin efectos. Extremo sin vecino es no-op explícito. No reintentar automáticamente un movimiento incierto: recuperar la vista y exigir nueva intención humana. Las posiciones no son una versión monotónica; no prometer detección ABA ni idempotencia permanente de replays. Si esas garantías pasan a ser requisito, revisar este ADR y el contrato antes de implementarlas.

En UI, modo Ordenar explícito sin filtros parciales, mostrando activos/inactivos con paginación acotada. Asa antes de ID y antes de la tarjeta xs, target44px, Pointer ratón/touch; teclado ↑/↓ y Escape para cancelar. Guardar por movimiento; Terminar sólo sale del modo. Restaurar filtros previos al salir. Drag sólo hacia filas cargadas; teclado obtiene vecinos por conjuntos y conserva visible la fila después de cruzar página. Grupos vacíos se ordenan desde su administración existente. Retirar Copiar ID redundante no elimina el ID ni Copiar URL.

## Consecuencias

- La tabla y navegación consumen un mismo orden backend, conservando sólo el subconjunto autorizado/activo de cada persona en la navegación.
- No se renumera tras cada eliminación ni se descarga todo para ordenar. Incluir datos reales de vecinos/página, con consultas acotadas y sin N+1.
- Un cambio de grupo agrega al final del destino; no reordena los hermanos del origen. El número almacenado es un rango de presentación, no una posición consecutiva garantizada.
- La migración debe backfillear posiciones distintas y ensayar seeds/upserts, escritores concurrentes, rollback e invalidación de contexto. Planificar corte con drenaje de escritores antiguos; no mezclar una versión antigua que omite sort_order con el nuevo esquema sin estrategia comprobada.
- Contratos MCP/proyecciones cerrados conservados; no se habilita reordenamiento por NodiaAI al añadir estas rutas administrativas. Su futura exposición requiere revisión y publicación propias.
- El estado propuesto no acredita aprobación general ni adopción operativa. Los cortes FX-02/03 de abajo distinguen implementación/verificación local de migración de BD de uso, despliegue y aceptación autenticada pendientes.

## Referencias

- [Plan87](../../mvp/87-core-feedback-module-order-plan.md).
- [Ficha funcional planificada](../../nodia-ai/knowledge/general-settings/features/module-presentation-and-order.md).
- [Frontera Core existente](../../../nodia-server/src/authorization/core-authority-transaction.ts) y [locks de autoridad](../../../nodia-server/src/authorization/authority-transaction.ts).
- [Creación/edición de módulos](../../../nodia-server/src/module/use-case/save-module.use-case.ts) y [grupos](../../../nodia-server/src/module-group/use-case/save-module-group.use-case.ts).

## Corte de implementación FX-02 — 2026-10-25

Implementado el backend y consumo del orden de contexto en Sidenav, con validación SQL/HTTP aislada y suites locales. [Entrega y límites](../../evidence/core-fx02-order-validation-r01.json). Controles de tabla FX-03, corte de migración/servicios y aceptación autenticada FX-04 siguen pendientes. El estado documental de este ADR permanece propuesto; ejecutar la etapa autorizada no registra una aprobación general.

## Corte de implementación FX-03 — 2026-10-25

Implementados tabla agrupada, modo Ordenar y controles por módulo/grupo; acciones sticky en escritorio y controles equivalentes en tarjetas móviles. Se conserva paginado por módulos, todos los estados sólo durante ordenación y restauración de filtros/páginas al terminar. El modo guarda cada movimiento individual y no envía listas completas.

Por instrucción explícita del usuario, los movimientos esperan invalidar listas de módulos/grupos y `authorizationKeys.all`: el contexto alimenta al sidenav y cambia su orden sin recarga ni toast genérico de permisos. Recuperación de conflictos/resultados inciertos sólo mediante GET; bloqueo hasta lectura recuperada, con guardias de actor/sesión y respuesta validada.

Se incorpora `locate_id` a la lectura administrativa de módulos en modo ordering=true. Calcula y lee la página del ancla en el mismo snapshot, sin mutación o búsqueda cliente de todas las páginas; mantiene visible el registro tras éxito/conflicto, incluido mover un grupo desde su cabecera. No cambia el contrato de movimientos ni añade capacidades MCP.

Pruebas locales, SQL/HTTP desechable y QA de navegador sintética se distinguen en [la evidencia FX-03](../../evidence/core-fx03-order-validation-r01.json). Adopción de migración/runtime, caché operativo y aceptación autenticada FX-04 siguen pendientes; la VM R09 de uso no fue migrada ni adoptó este código. El estado de este ADR sigue **propuesto**.

## Ampliación solicitada de arrastre — 2026-10-25

Implementada la opción D sobre la persistencia existente, sin migración adicional. El asa sustituye controles visibles de flecha, mientras ↑/↓ conserva el movimiento adyacente accesible y Escape cancela. Origen y destino congelados del gesto se validan en Client y nuevamente en Server; otro grupo/tipo no es destino. Before/after usa una rotación del intervalo y una sola escritura transaccional con restricciones diferibles. No se promete detectar cambios intermedios ABA cuando vuelven a coincidir rangos de los extremos.

Pruebas atómicas de hook/asa/rotación, integración SQL/HTTP desechable y Pointer de navegador con fixture sintética verificaron salto entre varias filas y grupos, reflejado en tabla/sidenav. [Corte de verificación y límites](../../mvp/87-core-feedback-module-order-plan.md#ampliación-de-arrastre--implementación-y-qa-aislada-2026-10-25). Ese corte local precedió la adopción registrada debajo; no amplió MCP ni cerró FX-04.

## Corte operativo de la ampliación — 2026-10-25

Server DnD R03/Client DnD R02 adoptados en la VM Linux local con backup cifrado reciente, cero migraciones nuevas e historia30, datos/orden/configuración/época Gemini y150 contratos/41fragmentos conservados.171 assets HTTP/SHA/MIME y UI autenticada con asas comprobados. Dos drops before adyacentes terminaron unchanged; no se guardó un cambio positivo de orden en la BD de uso. Los positivos de tabla/sidenav siguen acreditados por SQL aislada/navegador sintético. [Recibo vigente y límites](../../evidence/core-module-drag-delivery-r01.json).

Rollback de esta entrega R03→R02 y Client R02→R01 preparado, no ejecutado, sin cambiar esquema30; [operador](../../evidence/scripts/core-module-drag-delivery-r01.py). No sustituye la revisión necesaria para volver a R09/esquema previo ni autoriza down automático. FX-04 mantiene aceptación funcional positiva, concurrencia y ciclo completo de sesión pendientes; no se acredita dispositivo físico o inferencia IA nueva. El ADR continúa **propuesto**.

## Aceptación sucesora y tamaño de página — 2026-10-25

[Corte UI R02](../../evidence/core-fx04-live-acceptance-r02.json): Client pagination R07 corrige el envío del alias size usando limit canónico, incluido el locator. Server R03 y esquema30 no cambian. Movimientos positivos reales, sidenav sin recarga, persistencia tras reload, filtros, cruce de página y grupo vacío/inactivo comprobados; ocho movimientos y fixture retirada con autorización, orden original restaurado. Pendientes alta de módulo desde formulario, dos administradores reales y renovación natural completa. Concurrencia y permisos/MCP pasan aisladamente. El rollback Client histórico R02→R01 no abarca R07; conservar descriptor CAS y paquete homeR06 para una eventual reversión específica, sin ensayarla por rutina. No cambia la decisión de persistencia, publicación ni estado **propuesto** de este ADR.
