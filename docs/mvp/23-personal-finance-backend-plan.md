# Finanzas personales — plan de implementación Nodia Server

> Estado: tareas implementadas y verificadas localmente — revisión documental pendiente
> Fecha: 2026-10-04
> Dependencias: 03, 20, 21, [contratos 22](22-personal-finance-contracts.md), [ADR-011](../architecture/decisions/ADR-011-personal-finance-ledger.md)

## Reglas para asignar tareas

Leer AGENTS raíz/Server y skills locales backend-service-quality/nestjs-service-quality. Aplicar específicas de NestJS/Node/Vitest/TypeScript/Oxlint cuando corresponda. Arquitectura vertical src/user como referencia de carpetas; no copiar casos de uso vacíos que trasladan reglas a un servicio mockeado. Lógica de negocio en use-case; controlador delgado y servicio solo persistencia. Tests unitarios exclusivamente use-case/*.use-case.spec.ts; DB/HTTP aislado aparte, sin controller.spec/service.spec.

Cada tarea tiene un único propietario de archivos. Dependencias se completan antes de consumir código; tareas en archivos comunes se integran secuencialmente. No crear microservicios, CQRS, nuevas divisas, intereses, motores de cuotas ni campos retirados. Todo agente entrega archivos tocados, comportamiento probado, comandos/checks y pendientes; no datos personales/secretos ni aprobación de documentos. No ejecutar migraciones sobre la BD del usuario por validar una tarea.

## Orden y paralelismo

1. Base: FB-01 → FB-02 → FB-03 → FB-04.
2. Con entidades/contrato fijados: lecturas FB-05, FB-07, FB-09 en archivos separados. Categorías FB-06, grupos FB-08 y obligaciones FB-11 respetan sus dependencias.
3. Escrituras: FB-10, FB-12 → FB-13 → FB-14, FB-15. FB-16, FB-17 son secuenciales sobre esos mismos archivos.
4. FB-18 y después FB-19. FB-21 (navegación) y FB-22 (resultado incierto) pueden avanzar sin editar la composición común.
5. Integrador FB-20 registra módulos/rutas una vez están disponibles; FB-23, FB-24 verifican; FB-25, FB-26 cierran.

No despachar dos agentes que escriban mismo recurso común o migración. Client puede preparar estructura con fixtures después de FB-01, pero no declarar integración antes de FB-25.

## Tareas asignables

### FB-01 — Contrato ejecutable, tipos y validadores comunes

- Estado: completado localmente — evidencia de cierre al final de este documento.
- Dependencias: ninguna; leer contrato 22 primero.
- Archivos/alcance exclusivo: nodia-server/src/finance-common/{dto,types,validation}/ y finance-query.ts; políticas finance locales sin alterar las políticas existentes.
- [x] Leer 03/20/21/22 y AGENTS/skills; tipar IDs/amount como strings decimales, enums TypeScript de type/status y proyecciones de respuesta, sin nuevas columnas.
- [x] Validar rango bigint, nombre/key/description, arrays acotados, booleanos estrictos y payload desconocido; no transformar decimal/exponente/vacío en dinero válido.
- [x] Definir DTO paginado propio: active default active, page/limit con máximo 100; q solo campos públicos y orden seguro. No permitir user_id ni all=true.
- [x] Registrar políticas explícitas mínimas de categorías/grupos/obligaciones/movimientos sin exponer amount a conversiones Number ni alterar políticas de negocio existentes.
- Cierre/pruebas: Casos de uso futuros ejercitan validación real; comprobar metadata de DTOs en HTTP aislado al integrar. Build de los tipos nuevos; fixtures compartidos sintéticos, no specs de servicio/controlador.

### FB-02 — Entidades de categorías, grupos y pertenencias

- Estado: completado localmente — evidencia de cierre al final de este documento.
- Dependencias: FB-01.
- Archivos/alcance exclusivo: src/finance-category/entities/; src/finance-category-group/entities/.
- [x] Crear tres entidades exactamente como 03; keys únicas por usuario y UNIQUE(user_id,id) en los extremos de relaciones compuestas.
- [x] Pivote con ID propio, user_id, category_group_id/category_id, activo y timestamps; unicidad de pareja por usuario, no delete-insert duplicando historia.
- [x] Usar Relation<T>, targets reales y .js en imports ESM; definir FKs de propietario/NO ACTION. No importar lógica de negocio en entidades.
- Cierre/pruebas: Inspeccionar metadata emitida y correspondencia campos/índices con JSON/DBML; sin conectar DB al importar para tests.

### FB-03 — Entidades de movimientos y obligaciones

- Estado: completado localmente — evidencia de cierre al final de este documento.
- Dependencias: FB-01, FB-02.
- Archivos/alcance exclusivo: src/finance-movement/entities/; src/finance-obligation/entities/.
- [x] Crear amount BIGINT positivo en ambas entidades; obligation_id nullable y category_id requerido; no purpose/cancellation_reason/currency/occurred_on.
- [x] Respaldar type/status con CHECK de combinación y referencias compuestas de usuario; timestamps timestamptz.
- [x] No persistir remaining_amount/paid_amount; Relation<T> y módulos sin ciclos tempranos en ESM; asociar índice por ámbito/fecha y obligación/tipo/estado.
- Cierre/pruebas: Revisar esquema por campo contra 03 y 21; arranque compilado sin TDZ se verifica en FB-25.

### FB-04 — Migración incremental y reversión

- Estado: completado localmente — evidencia de cierre al final de este documento.
- Dependencias: FB-02, FB-03.
- Archivos/alcance exclusivo: src/migrations/<timestamp>-CreatePersonalFinance.ts; registro de CLI si corresponde.
- [x] Crear únicamente cinco tablas, CHECKs, FKs compuestas e índices; no tocar datos, IDs o tablas existentes de auth/negocios/IA.
- [x] Definir up ordenado por dependencias y down eliminando solamente los objetos creados, explícitamente destructivo para datos financieros nuevos; registrar respaldo necesario.
- [x] Preparar ensayo sobre esquema sintético equivalente al existente, CLI synchronize=false; impedir que runtime synchronize de desarrollo invalide evidencia de migración.
- [x] No ejecutar migration:run contra BD de usuario/producción como parte de la tarea.
- Cierre/pruebas: FB-24 ensaya up/down/up aislado, preservation de tablas originales y FKs que rechazan cruce de usuarios.

### FB-05 — Lecturas personales de categorías

- Estado: completado localmente — evidencia de cierre al final de este documento.
- Dependencias: FB-01, FB-02.
- Archivos/alcance exclusivo: src/finance-category/dto/; types/; service de lectura; use-case/get-*.use-case.ts.
- [x] Implementar listado y por ID con user_id incondicional en selección/conteo; 404 uniforme para ID inexistente o ajeno.
- [x] Búsqueda nombre/key y active normalizado, paginación/order estables; proyección pública sin users anidados.
- [x] GET por ID puede hidratar opción histórica inactiva del mismo usuario; no habilitar selección nueva de esa categoría por ello.
- Cierre/pruebas: Specs junto a casos de uso: dueño A/B, paginación, activos por defecto/inactivos explícitos, vacío real y q inválido.

### FB-06 — Creación y actualización de categorías

- Estado: completado localmente — evidencia de cierre al final de este documento.
- Dependencias: FB-04, FB-05.
- Archivos/alcance exclusivo: src/finance-category/dto/create/update; use-case/create/update; persistencia de escritura.
- [x] Create con name/key/is_active, propietario de contexto; update parcial con lista blanca y conflicto de key por usuario.
- [x] Activar/desactivar mediante update, conservando referencias históricas. Key igual de otro usuario permitida; colisión del mismo usuario 409.
- [x] Ubicar decisiones de negocio en casos de uso; traducir UNIQUE/FK a error de dominio sin filtrar SQL.
- Cierre/pruebas: Specs create/update con ID ajeno, duplicado, payload user_id y no pérdida de historia.

### FB-07 — Lecturas de grupos y selección actual

- Estado: completado localmente — evidencia de cierre al final de este documento.
- Dependencias: FB-01, FB-02.
- Archivos/alcance exclusivo: src/finance-category-group/dto/get; types/; service lecturas; use-case/get-*.
- [x] Lista paginada por usuario con category_count mediante consulta por conjuntos, sin find por fila.
- [x] Detalle por ID devuelve selección actual acotada con IDs/labels/activo; categorías inactivas seleccionadas conservadas.
- [x] Distinguir grupo vacío de error; no exigir categoría al crear un agrupador.
- Cierre/pruebas: Specs A/B, categoría fuera de página, count sin duplicar miembros y grupo sin miembros.

### FB-08 — Escritura atómica de grupos y miembros

- Estado: completado localmente — evidencia de cierre al final de este documento.
- Dependencias: FB-04, FB-06, FB-07.
- Archivos/alcance exclusivo: src/finance-category-group/dto/create/update; use-case/create/update; servicio transaccional.
- [x] Validar category_ids del mismo usuario por conjunto y máximo 100; deduplicar de forma explícita o rechazar según contrato, sin ignorar IDs inválidos.
- [x] Crear/actualizar grupo y reemplazar asociaciones en un manager transaccional; omitido preserva, [] vacía, lista reemplaza.
- [x] Desactivar pivotes retiradas y reactivar existentes; no crear pares duplicados ni borrar categorías al retirar del grupo.
- Cierre/pruebas: Specs lista omitida/vacía, ajena, inactiva nueva, fallo intermedio/rollback coordinado. Constraint real en FB-24.

### FB-09 — Lecturas de movimientos y filtros de grupos

- Estado: completado localmente — evidencia de cierre al final de este documento.
- Dependencias: FB-01, FB-02, FB-03.
- Archivos/alcance exclusivo: src/finance-movement/dto/get; types/; service consultas; use-case/get-*.
- [x] Listado y detalle personal con category/obligation resumidas, sin N+1 ni payload ORM completo.
- [x] Aplicar active default active, búsqueda, tipo/estado/categoría/grupo/obligación, created_at y orden estable.
- [x] Grupos mediante EXISTS/equivalente; unión entre grupos e intersección con category_ids; mismo ámbito en data/meta.
- [x] Validar IDs de filtros ajenos sin revelar su contenido; no permitir q reemplace user_id ni duplicar total_items por JOIN.
- Cierre/pruebas: Specs múltiples grupos que comparten categoría, primera/siguiente página, activo reset y predicados maliciosos; SQL real en FB-24.

### FB-10 — Crear movimientos ordinarios

- Estado: completado localmente — evidencia de cierre al final de este documento.
- Dependencias: FB-04, FB-06, FB-09.
- Archivos/alcance exclusivo: src/finance-movement/dto/create; use-case/create; persistencia mínima.
- [x] Crear movimiento sin obligación con categoría activa del mismo usuario y combinación type/status válida.
- [x] Aceptar amount string entero positivo; default activo true; rechazar user_id/timestamps/saldos/purpose y campos retirados.
- [x] Devolver proyección del registro confirmado en servidor; errores claros, no éxito vacío.
- Cierre/pruebas: Specs cantidad inválida, relación ajena/inactiva, income/paid y expense/received rechazados; estado pending válido.

### FB-11 — Lecturas de obligaciones y cálculo de pendiente

- Estado: completado localmente — evidencia de cierre al final de este documento.
- Dependencias: FB-01, FB-03, FB-09.
- Archivos/alcance exclusivo: src/finance-obligation/dto/get; types/; service consultas; use-case/get-*.
- [x] Lista/detalle por propietario; amount inicial almacenado, paid_amount/remaining_amount exactos mediante agregación por conjuntos.
- [x] Loan suma income received; debt suma expense paid; incluir pagos confirmados archivados y excluir pending/cancelled.
- [x] Resolver movimiento inicial por dirección opuesta; no agregar campo de propósito. Origen anulado: remaining_amount null, no deuda ficticia.
- [x] Responder proyección inicial necesaria para editar; no calcular balance desde la página visible ni cargar todos los movimientos.
- Cierre/pruebas: Specs 100000 menos 20000+20000=60000; pago archivado mantiene 60000; saldo cero y origen anulado diferenciados.

### FB-12 — Crear obligación y movimiento inicial juntos

- Estado: completado localmente — evidencia de cierre al final de este documento.
- Dependencias: FB-04, FB-06, FB-10, FB-11.
- Archivos/alcance exclusivo: src/finance-obligation/dto/create; use-case/create; persistencia transaccional compartida necesaria.
- [x] Una solicitud con name/key/type/amount/description/category_id; owner de sesión.
- [x] Guardar obligación y único movimiento inicial de mismo importe: loan expense/paid; debt income/received; repositorios del mismo manager.
- [x] Fallo de categoría, key o segundo save revierte todo. No crear evento inicial mediante otra petición de Client.
- [x] Devolver obligación y movimiento inicial; no agregar tabla, saldo mutable o clasificación de eventos.
- Cierre/pruebas: Specs reglas reales con falla intermedia; FB-24 prueba rollback PostgreSQL.

### FB-13 — Crear pagos parciales vinculados

- Estado: completado localmente — evidencia de cierre al final de este documento.
- Dependencias: FB-10, FB-11, FB-12.
- Archivos/alcance exclusivo: src/finance-movement/use-case/create vinculado; contrato transaccional de pago.
- [x] POST movimientos con obligation_id solo admite liquidación: income loan o expense debt; relación activa/propietario validado.
- [x] Lock de obligación y suma exacta con lecturas frescas antes de confirmar; amount <= pendiente.
- [x] Pending no reserva principal; validación se repite al confirmar. No permitir otro desembolso inicial ni pago de origen anulado.
- [x] Mantener transacción corta, sin red externa ni mutex local como garantía multiproceso.
- Cierre/pruebas: Specs pago parcial/exacto/sobrepago/pending; FB-24 ejercita dos pagos concurrentes.

### FB-14 — Actualizar movimientos y conservar invariantes

- Estado: completado localmente — evidencia de cierre al final de este documento.
- Dependencias: FB-13.
- Archivos/alcance exclusivo: src/finance-movement/dto/update; use-case/update; servicio transaccional.
- [x] Editar ordinario según contrato 22; preservar campos omitidos y validar comando final type/status.
- [x] Para pago, conservar obligación/dirección y recalcular al cambiar monto/estado bajo lock; no permitir cruce de propietario.
- [x] Movimiento inicial no cambia amount desde este endpoint: dirigir al update de obligación; sí permite nombre/categoría/activo según contrato.
- [x] Actualización financiera y validación son indivisibles; sin lecturas por ID y update posterior sin ámbito.
- Cierre/pruebas: Specs ediciones permitidas, obligación distinta rechazada, aumento con sobrepago, estado combinado y rollback.

### FB-15 — Actualizar monto inicial de obligación

- Estado: completado localmente — evidencia de cierre al final de este documento.
- Dependencias: FB-12, FB-13.
- Archivos/alcance exclusivo: src/finance-obligation/dto/update; use-case/update; persistencia transaccional.
- [x] Editar nombre/key/description/activo; type/user_id permanecen fijos. Null borra descripción; omitido preserva.
- [x] Cambiar amount e importe inicial juntos bajo lock; rechazar monto menor a total liquidado.
- [x] Actualizar solo el movimiento inicial identificado por dirección, nunca todos los pagos; conservar category y estado.
- [x] Conflicto de key/monto retorna 409 sin dejar una de las dos filas modificada.
- Cierre/pruebas: Specs monto aumenta/disminuye legalmente, bajo pagos se rechaza y un fallo no deja importes divergentes.

### FB-16 — Matriz de activar/desactivar y relaciones históricas

- Estado: completado localmente — evidencia de cierre al final de este documento.
- Dependencias: FB-06, FB-08, FB-14, FB-15.
- Archivos/alcance exclusivo: casos de uso update existentes y sus specs; tarea secuencial sobre los cuatro recursos.
- [x] Verificar PUT {is_active} en categorías/grupos/obligaciones/movimientos; no DELETE ni cascadas.
- [x] Archivar pago no restaura principal; ocultarlo de lista activa sí respeta filtro. Archivar catálogo conserva referencias.
- [x] Reactivar conserva ID/historial. No permitir asociación nueva a un registro inactivo; permitir edición no relacionada de una asociación histórica.
- [x] Distinguir is_active de cancelled en resultados/API y no cambiar ambos a la vez implícitamente.
- Cierre/pruebas: Specs activos por defecto, desactivado visible solo al pedirlo y saldo invariante al archivar.

### FB-17 — Transiciones de estado y anulación

- Estado: completado localmente — evidencia de cierre al final de este documento.
- Dependencias: FB-14, FB-15.
- Archivos/alcance exclusivo: casos de uso update de movimiento/obligación y specs, sin campos nuevos.
- [x] Aplicar tabla de estados por type: pending a confirmado/cancelled; confirmado a cancelled; cancelled terminal para validez.
- [x] Cancelar pago lo excluye del saldo; no crear otro reverso ni motivo obligatorio.
- [x] Cancelar inicial solo sin pagos confirmados; bloquear pagos nuevos. UI puede corregir metadatos/activo sin reabrir una operación anulada.
- [x] Usar mismo lock/cálculo en todas las rutas de edición para no eludir regla con otro endpoint.
- Cierre/pruebas: Specs pendiente no amortiza, confirmar sí, cancelar restaura pendiente, origen con pagos se rechaza y races en FB-24.

### FB-18 — Auditoría de filtros Ransack y límites

- Estado: completado localmente — evidencia de cierre al final de este documento.
- Dependencias: FB-05, FB-07, FB-09, FB-11.
- Archivos/alcance exclusivo: DTOs de consulta finance y specs de get-*; common policies solo si hay defecto nuevo.
- [x] Verificar envolvente q antes de consumir filtros de dominio y allowlist de campos/orden; no heredar all ilimitado.
- [x] Regresiones campos desconocidos, expresiones SQL, operador incompatible, array sobredimensionado y booleanos inválidos.
- [x] Asegurar que búsqueda/active/reset/conteo usan el mismo propietario y normalización; no exponer amount con Number.
- Cierre/pruebas: Specs desde casos de uso con constructor real/policies; registrar SQL parametrizado sin afirmar integración no ejecutada.

### FB-19 — Agregados y tablas del centro de mando

- Estado: completado localmente — evidencia de cierre al final de este documento.
- Dependencias: FB-11, FB-18.
- Archivos/alcance exclusivo: src/finance-overview/dto/; types/; service consultas; use-case/get-overview/get-category-summary/get-group-summary.
- [x] Implementar tres lecturas de 22: totales/counts/obligaciones y breakdowns paginados por categoría/grupo con search.
- [x] Usar sumas completas de conjunto filtrado, no de la página; status financiero separado de active/created_at.
- [x] Saldo de obligaciones usa toda amortización confirmada aunque pago esté inactivo/fuera de período; devolver scope que lo indique.
- [x] Incluir ceros reales y catálogos vacíos; evitar N+1 y dobles importes por categorías presentes en varios grupos.
- Cierre/pruebas: Specs data mayor a una página, grupo solapado, cero válido, dueño A/B y pago archivado; medir planes en FB-24.

### FB-20 — Composición NestJS, controladores y Swagger

- Estado: completado localmente — evidencia de cierre al final de este documento.
- Dependencias: FB-06, FB-08, FB-14, FB-15, FB-17, FB-19, FB-21.
- Archivos/alcance exclusivo: controladores/módulos finance; src/app.module.ts; registro conjunto exclusivo de integrador.
- [x] Registrar módulos verticales, entidades y casos de uso; controladores solo rutas/Swagger/DTOs/identidad request.auth.user.id/delegación.
- [x] Mantener guard global de sesión y política own-user; no agregar aliases, rutas públicas ni dependencia de nombre de rol.
- [x] Verificar POST/PUT/GET y response types exactos, orden de rutas estáticas antes de :id y documentar 400/401/404/409.
- [x] Probar metadata runtime de DTOs con whitelist/forbidNonWhitelisted del main existente; no controller.spec/service.spec.
- Cierre/pruebas: Build y smoke HTTP aislado con principal sintético; rechazo de user_id/timestamps reales en pipe, sin Google.

### FB-21 — Registro idempotente de navegación de Finanzas

- Estado: completado localmente — evidencia de cierre al final de este documento.
- Dependencias: FB-01, FB-04.
- Archivos/alcance exclusivo: seed de navegación finance bajo use-case; integración con seed existente coordinada en FB-20.
- [x] Registrar module_groups.key=finances y modules.key=personal_finance con link=/finances/personal, icono y traducciones es/en del Core según contrato actual.
- [x] Repetir seed conserva IDs y no duplica keys/translations; no actualizar otros módulos ni asignar finanzas a todos los usuarios.
- [x] Documentar asignación manual por Settings y actualización del contexto de autorización; el registro no abre API anónima.
- [x] Crear mecanismo invocable coherente con seed existente, sin ejecutar contra la BD real en esta planificación.
- Cierre/pruebas: Ensayo PostgreSQL aislado del caso de uso de seed: doble ejecución conserva IDs, cuatro traducciones y cero asignaciones. CLI operacional explícito; no se agregó un endpoint público de seed.

### FB-22 — Recuperación de escrituras con resultado incierto

- Estado: completado localmente — evidencia de cierre al final de este documento.
- Dependencias: FB-12, FB-13.
- Archivos/alcance exclusivo: contrato 22, casos de uso de escritura si existe soporte reusable; sin ampliar unilateralmente ERD.
- [x] Inventariar soporte existente de idempotencia y separar doble clic de commit con respuesta perdida.
- [x] Primera versión: sin retry automático de POST/PUT; documentar refetch/revisión antes de repetir y error de resultado incierto.
- [x] Si se implementa idempotencia, exige misma intención/usuario/payload y reserva/resultado atómicos comprobables; actualizar ADR/contrato/diagrama antes de añadir almacenamiento.
- [x] No presentar Redis separado de PostgreSQL, un UUID por petición o un mutex local como garantía de efecto único.
- Cierre/pruebas: Escenario de respuesta perdida conserva resultado y distingue evidencia; registrar explícitamente si deduplicación de reintento continúa pendiente.

### FB-23 — Regresiones de aislamiento y contratos públicos

- Estado: completado localmente — evidencia de cierre al final de este documento.
- Dependencias: FB-18, FB-20.
- Archivos/alcance exclusivo: use-case/*.use-case.spec.ts de recursos finance, sin suites de controller/service.
- [x] Dos usuarios con mismas keys; leer/editar/activar/asociar IDs ajenos en todos los endpoints y agregados.
- [x] Comprobar no filtración en errores/proyecciones/conteos; las reglas ejecutadas viven en casos de uso reales, no mocked dentro de servicio.
- [x] Validar DTOs/metadata por smoke aislado sin cuentas reales; no cambiar tests existentes para aceptar un fallo.
- [x] Verificar límites/arrays, activo default y filtros compuestos adversarios.
- Cierre/pruebas: Matriz completa de A/B y payload inválido; evidencia unit vs HTTP separada.

### FB-24 — Ensayo PostgreSQL de migración, concurrencia y consultas

- Estado: completado localmente — evidencia de cierre al final de este documento.
- Dependencias: FB-04, FB-13, FB-14, FB-15, FB-17, FB-19.
- Archivos/alcance exclusivo: test/ comprobaciones aisladas según configuración existente; fixtures sintéticos, no src/*.service.spec.
- [x] Instancia aislada y esquema base sintético; up/down/up, FK compuesto cross-user, UNIQUE y CHECK real; restauración de backup sintético.
- [x] Rollback entre obligación y movimiento inicial; fallo al actualizar uno de los dos amounts.
- [x] Dos pagos simultáneos que juntos exceden principal: uno falla y saldo nunca negativo. Confirmación/cancelación simultánea mantiene consistencia.
- [x] Datos sobre una página y categorías en varios grupos; contrastar SUM/conteo/order y planes representativos sin declarar escala por inspección.
- Cierre/pruebas: Informe de SQL real, isolation/locks usados y comandos; si falta PostgreSQL registrar pendiente sin simular integración.

### FB-25 — Cierre de calidad, ESM y contrato API

- Estado: completado localmente — evidencia de cierre al final de este documento.
- Dependencias: FB-20, FB-21, FB-22, FB-23, FB-24.
- Archivos/alcance exclusivo: integración Server, manifiesto Swagger y evidencia; sin refactors ajenos.
- [x] Ejecutar npm run build, npm run lint y npm run test desde nodia-server; corregir defectos del alcance y separar advertencias anteriores.
- [x] Arrancar composición compilada en entorno aislado; verificar Relation<T>/DI/rutas y tipos de respuesta con importaciones .js.
- [x] Publicar fixtures completos de endpoints de 22 para Client; comparar contratos de errores/filtros/amount strings.
- [x] Registrar qué se verificó con mocks, HTTP aislado y PostgreSQL real; ningún check local declara despliegue aprobado.
- Cierre/pruebas: Checks correctos y evidencia reproducible; FB-24 no puede marcarse probado si faltó DB.

### FB-26 — Actualizar documentación al entregar Server

- Estado: completado localmente — evidencia de cierre al final de este documento.
- Dependencias: FB-25.
- Archivos/alcance exclusivo: docs/mvp/00-progress.md, 03, 21, 22, 23; ADR-011 según cambios reales.
- [x] Marcar solamente tareas implementadas con evidencia y commit/rutas cambiadas; registrar dependencias pendientes.
- [x] Reconciliar contrato si difirió de propuesta y comunicar cambios a tareas Client antes de integrar.
- [x] No marcar documentos aprobados ni ejecutar migración/deploy por cerrar el plan.
- Cierre/pruebas: Referencias válidas, especificación y Swagger coherentes; estado de despliegue/BD explícito.

## Plantilla para encargar una tarea a un subagente

Implementa [ID y título] del plan de Finanzas. Lee AGENTS y las skills locales aplicables; usa 03/20/21/22 como contrato y conserva las decisiones simplificadas. Dependencias terminadas: [IDs/evidencia]. Trabaja únicamente en [archivos asignados], conserva cambios de otros agentes y coordina cualquier archivo común antes de editarlo. Completa cada checklist y sus pruebas de valor. Devuelve archivos tocados, comportamiento implementado, comandos/checks con resultados, límites de evidencia y pendientes. No marcar documentación aprobada ni ejecutar migración/deploy fuera del entorno aislado de la tarea.


## Cierre de implementación — 2026-10-04

Se ejecutaron FB-01..FB-26 con tres agentes de implementación (catálogos, ledger, consultas/overview) y un integrador (base común, migración, composición, navegación y DB/HTTP). Los checklists se refieren a código/verificación local, no a aprobación documental ni despliegue. No se creó commit ni se modificó Client o la BD configurada.

| Evidencia | Resultado |
|---|---|
| Build TypeScript/Nest | Correcto; Node compilado sin errores ESM/DI |
| Oxlint | Cero errores/nuevos avisos; siete warnings históricos de IA/facturas |
| Vitest | 369 pruebas, 80 archivos, todas correctas; specs nuevos solo junto a casos de uso |
| PostgreSQL 16 aislado | up/down/up; metadata sin drift; FKs/UNIQUE/CHECK reales; rollback de ambas escrituras |
| Concurrencia real | Dos pagos 60/100: uno 201 y otro 409; saldo 40. Confirmaciones pending y cancelar origen vs pagar: invariantes conservadas |
| Agregados y filtros | 2000 filas, página10, total2000; grupos solapados sin duplicar; cero real; SUM mayor a bigint de fila |
| Respaldo/restauración | pg_dump sintético restaurado en otra BD aislada; Finanzas y datos previos conservados |
| Contrato HTTP | 19 operaciones/11 paths; DTOs runtime y filtro global; principal A/B sintético, sin Google/Redis |

### Archivos y diferencias concretadas

- Shared en src/finance-common; allowlists finance en finance-query.ts, no ampliar las políticas públicas de otros recursos.
- [Migración](../../nodia-server/src/migrations/1791085000000-CreatePersonalFinance.ts), [composición](../../nodia-server/src/app.module.ts), [prueba DB/HTTP](../../nodia-server/test/finance.integration.mjs).
- [Fixtures API](../../nodia-server/test/fixtures/finance-api.json), [OpenAPI](../../nodia-server/test/fixtures/finance-openapi.json), [plan SQL medido](../../nodia-server/test/fixtures/finance-query-plan.json). Los ejemplos son sintéticos; el plan de 2000 filas no certifica escala de producción.
- Updates omiten campos undefined de instancias DTO; descripción null borra contenido. Regresión corregida tras HTTP real.
- Lecturas de saldo/overview en REPEATABLE READ para evitar principal/pagos de snapshots distintos; manager único y consultas secuenciales, compatibles con pg actual.
- Grupo lee pivotes activas o incluidas en la selección nueva, en vez de cargar todo el historial archivado.
- Filtros IDs ajenos/inexistentes retornan vacío; por ID/mutación/asociación retornan 404. Campos money no se convierten a Number.

### Operación reproducible y límites

Desde nodia-server: npm run test:finance:integration crea y elimina su propio contenedor template_finance_integration_<pid>, puerto dinámico en 127.0.0.1, BD/usuarios sintéticos y synchronize=false. Requiere Docker y postgres:16-alpine. No lee .env ni usa DB del desarrollador. Para regenerar ejemplos, establecer FINANCE_UPDATE_FIXTURES=1 únicamente durante ese comando.

En la BD objetivo, aplicar npm run migration:run tras respaldo y luego npm run seed:finance. Ambos comandos operacionales usan la configuración del proyecto y no fueron ejecutados aquí. Asignar personal_finance desde Settings; el seed no concede acceso masivo. down destruye las nuevas tablas de Finanzas y debe precederlo un respaldo recuperable.

La primera versión conserva la limitación de idempotencia de FB-22: no reintentar automáticamente escrituras con resultado incierto; refetch y revisión antes de repetir. El ensayo descarta una respuesta ya confirmada y recupera la fila por lectura, sin simular una garantía persistente de deduplicación.

Client sigue pendiente según [24](24-personal-finance-client-plan.md). No se ejecutaron login real, AppModule con infraestructura real, migración de la BD del usuario ni despliegue. Los documentos y ADR siguen en revisión/propuestos donde correspondía.
