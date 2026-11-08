# ADR-092 — Destinos de módulos independientes de la navegación

> Estado: propuesto; implementación local verificada por alcance. No implica aprobación documental integral ni despliegue.
> Fecha: 2026-11-01.

## Contexto

La solicitud vigente de [98](../../mvp/98-nodia-teacher-start-handoff.md#solicitud-vigente-para-comenzar-ahora) fija Teacher en `/nodia-teacher` y exige retirar los prefijos de sección de todas las rutas funcionales Client. El nombre/grupo del menú es presentación: mover un módulo no debe cambiar su URL, carpeta o autoridad. Los enlaces existen en `modules.link`, router, guardas, navegación y protocolos NodiaAI.

El inventario read-only local (`localhost:5432/nodia_db`, contenedor `nodia_postgres`) encontró diez enlaces antiguos en `modules.link` y ninguna otra columna de texto/JSON con esos aliases. Dos registros activos, IDs16 (`nodiaai`) y21 (`nodia_ai`), ya compartían `/tools/nodia-ai`. No corresponde fusionar IDs/asignaciones para ocultar esa ambigüedad. Manifiestos, grants, recibos y contratos históricos NodiaAI sujetos a hash requieren compatibilidad sin reescribir sus bytes.

## Opciones consideradas

### Opción A Derivar rutas del grupo y añadir aliases por traslado

- Ventaja: pocos cambios iniciales.
- Desventajas: acopla presentación y autoridad, acumula identidades y exige migrar enlaces al renombrar un grupo.

### Opción B Destinos propios del recurso y migración explícita

- Ventajas: URL estable, identidades conservadas y revisión de cada enlace afectado.
- Desventajas: transición coordinada Client/Server/BD y compatibilidad deliberada con protocolos históricos.

## Decisión

Aplicar B. El mapa no cambia APIs de dominio ni carpetas existentes por arrastre. Teacher posee `src/modules/teacher` y `src/teacher`, independiente del menú.

| Origen | Destino canónico |
|---|---|
| `/tools/nodia-ai` | `/nodia-ai` |
| `/tools/reservations` | `/reservations` |
| `/tools/finances-personal` | `/finances-personal` |
| `/tools/business` | `/business` |
| `/tools/business/:id` | `/business/:id` |
| `/settings/users` y `/general-settings/users` | `/users` |
| `/settings/roles` y `/general-settings/roles` | `/roles` |
| `/settings/actions` y `/general-settings/actions` | `/actions` |
| `/settings/modules` y `/general-settings/modules` | `/modules` |
| `/settings/ai-providers` y `/general-settings/ai-providers` | `/ai-providers` |

`/nodia-teacher` y `/nodia-teacher/:sessionId` son destinos nuevos. La migración de enlaces no crea su módulo ni concede asignaciones: el mantenedor ofrece el destino base y el usuario administra el acceso. Los redirects enumerados sustituyen el historial, conservan query/hash/ID y llegan al guard canónico. No se elimina un prefijo arbitrario.

`CanonicalModuleLinks1793560000000` modifica sólo enlaces exactos enumerados. Conserva IDs, keys, grupos, orden, timestamps, permisos y relaciones. Su transacción toma la misma frontera de tablas de autoridad que los escritores Core y registra originales en `module_link_migration_179356`. La repetición no cambia filas ni ledger. `down` restaura enlaces únicamente si sus IDs/keys y destinos siguen presentes; rechaza edición/eliminación o colisión posterior en vez de sobrescribirla o recrear registros. El ledger no tiene una FK que impida el borrado normal del mantenedor.

Se rechaza una colisión **nueva entre enlaces distintos** que converjan a un destino. La duplicidad exacta previa NodiaAI se conserva y sigue denegada por identidad ambigua; migrar sus dos enlaces no fusiona sus asignaciones. Resolverla queda pendiente administrativo.

La autoridad actual proyecta sólo aliases explícitos a un destino antes de comparar. Un grupo no concede acceso: se conservan actividad/asignación y bypass super_admin ya definidos por89. Los accesos móviles guardados mantienen el formato v1 `{groupKey,moduleKey}`; su identidad usa la key de módulo globalmente única para conservarlos al trasladar el módulo. Keys ambiguas se excluyen del catálogo.

En NodiaAI, la normalización se aplica al comparar autoridad/visibilidad y componer familias publicadas con módulos actuales. No muta manifiestos, grants, hashes de origen ni resultados guardados. `ToolObservation.module_route`, `contractHash` y el hash de autoridad de recibos conservan la codificación v1 histórica `/tools/*` o `/settings/*`; Client convierte esa procedencia al href canónico. Se conserva también el orden histórico antes de calcular hashes. Los recibos completados requieren autoridad actual antes de recuperarse; unknown sigue sin replay. El schema/publicación v1 permanece intacto. Añadir capacidades o publicar otro contrato requiere una transición independiente. Esta compatibilidad no rehabilita escritores de ventas retirados.

## Consecuencias

- Renombrar un grupo o mover un módulo conserva URL/carpeta/asignaciones. Las regresiones Client y el ensayo SQL verifican también la revocación.
- Los enlaces antiguos llegan a la misma autoridad actual; no crean acceso alternativo.
- Se ensayó una restauración íntegra aislada del respaldo DPAPI con `up/down`, repetición, colisión y protección de ediciones posteriores; se eliminó la BD descartable al terminar.
- Se aplicó **sólo** esta migración a la BD de trabajo local indicada. No se desplegó en VM/producción ni se ejecutaron seeds o migraciones Teacher en esa operación. La adopción del código compilado/procesos sigue su procedimiento separado: SQL por sí solo no acredita una release en ejecución.
- Aprobación documental, publicación de conocimiento y disponibilidad real de selecciones IA siguen separadas. La ambigüedad NodiaAI previa continúa pendiente y cerrada para usuarios ordinarios.

## Referencias

- [Solicitud98](../../mvp/98-nodia-teacher-start-handoff.md) y [acceso89](../../mvp/89-module-access-and-user-data-scope.md).
- [Evidencia local](../../evidence/canonical-module-routes-20261101-r01.json).
- [Mapa Server](../../../nodia-server/src/authorization/canonical-module-route.ts) y [migración](../../../nodia-server/src/migrations/1793560000000-CanonicalModuleLinks.ts).
- [Mapa Client](../../../nodia-client/src/routes/moduleDestinations.ts), [router](../../../nodia-client/src/routes/index.tsx) y [catálogo](../../../nodia-client/src/routes/navigationOptions.ts).
