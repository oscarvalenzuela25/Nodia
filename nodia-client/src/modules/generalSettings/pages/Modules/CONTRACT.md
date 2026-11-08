# Contrato de módulos y grupos de módulos

## Destinos independientes del grupo — 2026-11-01

El selector usa las rutas canónicas de `routes/navigationOptions.ts`, incluida `/nodia-teacher`. Mover un módulo o renombrar su grupo conserva `link`, identidad y asignaciones. Teacher es un dominio propio fuera de tools/utils; el grupo del menú no define su ruta ni concede acceso. ADR-092 registra mapa, compatibilidad histórica y migración local de los enlaces existentes; no hubo alta/asignación masiva ni cambio de APIs de dominio.

Actualizado 2026-10-25 (FX-02/03/04) desde entidades, DTOs, consultas y casos de uso de nodia-server. Base `/api/v1`. IDs bigint PostgreSQL enviados como strings; no convertir a Number. Módulos pertenecen a grupos mediante `module_group_id`; no existe jerarquía parent/submodule en este contrato. Server DnD R03/Client pagination R07 adoptados en la VM Linux local, sin migración adicional sobre historia30. UI autenticada verifica movimientos positivos, sidenav, persistencia, filtros, grupo vacío/inactivo y cruce de página; el ensayo restaura el orden original y elimina su grupo de prueba con autorización. [Recibo vigente](../../../../../../docs/evidence/core-fx04-live-acceptance-r02.json). FX-04 sigue parcial por alta de módulo desde formulario, dos administradores reales y renovación natural completa.

## Lecturas y campos

Inicio (`/`) es una entrada fija del Sidenav y de la navegación móvil; no pertenece al catálogo de rutas asignables al crear un módulo. Retirar su opción del formulario no elimina la ruta registrada ni condiciona Inicio a registros/asignaciones de módulos. El backend y los registros históricos no cambian por este ajuste del selector.

`GET /modules` y `GET /module-groups` (aliases singulares conservados) devuelven `{ data, meta: { page, limit, total_items, total_pages } }`.

- `page` empieza en 1; `limit`/`size` controlan el tamaño. `all=true` obtiene el catálogo para opciones.
- Client normaliza `size` al parámetro HTTP canónico `limit`, también para el locator de orden; un `limit` explícito prevalece. La VM evidenció que enviar sólo `size=5` conservaba el `limit=10` inicializado por el DTO compartido. Este ajuste no modifica ese DTO global ni promete corregir el alias para otros consumidores directos del backend.
- Módulos aceptan `includes`; con true se incluye `module_group`. Los selectores usan `all=true&includes=false`.
- Filtros Ransack utilizados: `q[is_active_eq]=true|false`, `q[key_cont]`, y en módulos `q[key_in]`, `q[module_group_id_in]`. Todos omite is_active_eq.
- Grupo: `id`, `key`, `icon`, `is_active`, timestamps y `translates`.
- Módulo: mismos campos más `link`, `module_group_id` y relación `module_group` cuando se solicita.
- Traducciones: `{ key: "key", es, en }` para el nombre. Datos ausentes no permiten inventar nombres ni disponibilidad.

## Orden persistido — FX-02

Grupo y módulo incorporan `sort_order` integer no negativo, administrado por Server, sin DEFAULT0 compartido. Grupos: unicidad global; módulos: unicidad por `module_group_id`. Menor valor aparece antes. El número no tiene que ser consecutivo: borrar deja huecos.

- Alta realmente nueva: MAX+1 del ámbito completo, incluidos inactivos; vacío empieza0. Editar/reactivar/upsert por key existente conserva posición. Cambiar un módulo de grupo lo agrega al final del destino.
- CRUD no acepta sort_order arbitrario. La validación HTTP rechaza campos desconocidos y el escritor nativo también rechaza ese campo si se llama internamente.
- Orden predeterminado de grupos: sort_order/id ascendente. Módulos: grupo.sort_order/grupo.id/módulo.sort_order/módulo.id ascendente, antes del paginado. Un `q[s]` válido explícito conserva su semántica y desempate estable; no ampliar la gramática Ransack ni enviar tuplas SQL.
- El contexto autenticado ordena sus arrays antes de cachear; Sidenav respeta ese orden, sin reverse ni prioridades por clave. Conserva filtrado de acceso/actividad y traducciones.

### Lectura para ordenar

`GET /modules?ordering=true&page=1&limit=10&includes=true` y `GET /module-groups?ordering=true&page=1&limit=10`. Alias nativos conservados.

`ordering` es booleano estricto, false por defecto. Con true: página acotada (limit<=100), all=false y q vacío; mostrar todos los estados sin filtros parciales. Combinación incompatible:400 `modules:invalid_order_view`. El snapshot HTTP REPEATABLE READ mantiene página, conteo, traducciones y vecinos consistentes; helpers internos reciben el manager de su transacción.

Cada fila añade `ordering:{previous:{id,sort_order}|null,next:{id,sort_order}|null}`. Módulos añaden `group_ordering` con la misma forma para la cabecera del grupo. Vecinos calculados sobre el ámbito completo antes de filtrar IDs de la página, incluidos inactivos y otras páginas; null sólo indica extremo real. Grupos incluyen también vecinos vacíos. Una página de módulos no incluye filas artificiales para grupos sin hijos.

Sin ordering=true no se añade esa metadata. includes=false sigue omitiendo module_group; el join many-to-one usado para ordenar no hidrata esa relación. La metadata se obtiene por conjuntos, sin consultas por fila ni descargar todo en Client. Estas opciones/columnas administrativas no se añaden a los schemas MCP publicados.

`GET /modules?ordering=true&locate_id=:moduleId&limit=10&includes=true` ubica la página del módulo ancla según el orden canónico actual y devuelve esa página dentro del mismo snapshot de lectura, con su `meta.page` real. El ID conserva rango bigint positivo; exige ordering=true y las mismas restricciones de filtros/tamaño. Ausente:404 nativo; locate_id fuera del modo:400 `modules:invalid_order_view`. Es una lectura acotada y no mueve, reintenta ni restaura registros. El Client la usa después de un movimiento o conflicto para conservar la fila visible; no consulta todas las páginas ni usa la página de grupos como página de módulos. Grupos no incorporan este parámetro.

### Movimiento individual atómico

`PATCH /module/:id/order` y `PATCH /module-group/:id/order` (aliases plurales conservados), bajo la autenticación y frontera de autoridad Core existentes. No configura un permiso distinto ni acepta actor enviado en body.

Body: `direction:"up"|"down"|"before"|"after"`, `expected_sort_order` entero0..2147483647 y `expected_neighbor` obligatorio. Para up/down, `expected_neighbor:{id:string,sort_order:number}|null` representa al vecino inmediato; null debe ser explícito cuando se espera extremo. Para before/after, debe contener ID/rango de la fila destino y nunca null ni la misma identidad de origen. Módulos requieren además `expected_module_group_id`; origen y destino deben pertenecer a ese mismo grupo. `page_size` opcional entero1..100, predeterminado10, sólo calcula la página de retorno. IDs conservan validación bigint positiva.

Respuesta200: `{status:"moved"|"unchanged",id,module_group_id?,sort_order,previous,next,position,page}`. Posición y página empiezan1; posición de módulos es global según orden canónico del catálogo completo, para mantener visible la fila al cruzar páginas. Grupos usan su propio catálogo. La respuesta sirve de observación del movimiento, no garantiza que otro administrador no cambie el orden después.

Server relee identidad/ámbito y las precondiciones dentro de la misma transacción Core. Up/down intercambia dos vecinos; before/after coloca el origen respecto del destino mediante una rotación de los rangos existentes del intervalo afectado, incluidos registros inactivos. Conserva huecos y no renumera el catálogo completo; aplica los cambios en una sola escritura SQL con unicidad diferida, sin encadenar PATCH de vecinos desde Client. Origen y destino se comparan por ID/rango y grupo; eso no constituye una versión monotónica ni detección ABA del intervalo. Extremo sin vecino o colocación que ya coincide devuelve unchanged sin circular al otro extremo. Un movimiento no cambia el grupo del módulo.

- Datos de movimiento inválidos:400 `modules:invalid_order`; CRUD con orden arbitrario:400 `modules:order_managed`.
- Cambio concurrente de posición/vecino/grupo:409 `modules:order_conflict`, sin efectos. Ausencia de recurso:404 nativo. Rango de posiciones agotado:409 `modules:order_exhausted`.
- Después de un movimiento efectivo, repetir inmediatamente las posiciones anteriores produce conflicto; un unchanged no modifica datos. No existe promesa de idempotencia permanente ni versión monotónica de orden. Timeout: releer/conciliar, no repetir automáticamente.
- Invalidar contexto Redis después del commit si hubo movimiento. Si el caso de uso hereda `actor.transaction`, el coordinador exterior conserva el commit/invalidación. Rollback no notifica éxito ni invalida anticipadamente.
- Client FX-03 debe emitir un toast específico de éxito/error, conservar datos y bloquear controles durante la petición; FX-01 mantiene las relecturas silenciosas. Los textos de error ES/EN están preparados.

### Instalación y corte

Migración `1793200000000-AddModuleSortOrder`: backfill determinista de grupos (prioridad histórica negocios/otros/ajustes, ID de desempate) y módulos (ID por grupo), checks/NOTNULL y uniques diferibles. Sin valores privados fijos. Down elimina sólo columnas/constraints y conserva registros. Bootstrap/seeds Core/Finanzas/Reservas/NodiaAI usan asignación al final y preservan posiciones al repetirse.

No ejecutar automáticamente en una BD de uso desde tests o arranque. Adoptar con escritores antiguos drenados, respaldo/corte supervisado y caché invalidada; el runtime anterior no asigna las nuevas columnas. FX-04 conserva la aceptación autenticada del flujo completo. [Plan87](../../../../../../docs/mvp/87-core-feedback-module-order-plan.md) y [ADR-078](../../../../../../docs/architecture/decisions/ADR-078-module-order-and-atomic-moves.md).

## Creación y edición

`POST /module`, `PUT /module/:id`; grupo: `POST /module-group`, `PUT /module-group/:id`.

- Crear grupo requiere `key`; icon, is_active y translates son opcionales.
- Crear módulo requiere `key`, `module_group_id` y `link`; icon, is_active y translates son opcionales.
- is_active por defecto true. DTOs de actualización permiten cambios parciales. Desactivar se conserva como operación distinta de eliminar.
- Consultar DTOs y casos de uso para las validaciones vigentes; los formularios reutilizan inputs, React Hook Form y Zod.

## Eliminación permanente

| Endpoint (singular o plural) | Resultado |
| --- | --- |
| `DELETE /module/:id`, `/modules/:id` | 204 sin cuerpo. Transacción elimina asignaciones user_modules, traducciones cuyo source_entity es modules y el módulo. Conserva su grupo. |
| `DELETE /module-group/:id`, `/module-groups/:id` | 204 sin cuerpo solo si no existe ningún módulo asociado, incluidos inactivos. Elimina sus traducciones de module_groups y el grupo. |

- ID inválido/fuera del rango bigint positivo: 400 `modules:invalid_id`.
- Módulo inexistente/repetición: 404 `modules:not_found`; grupo: 404 `modules:groups.not_found`.
- Grupo con módulos: 409 `modules:groups.delete_has_modules`; no se elimina nada.
- Lock pesimista de la fila y FK protegen asociaciones concurrentes. Fallo de limpieza revierte toda la transacción.
- Cache de autorización invalidada después del commit. Se conserva la protección global de autenticación/autorización existente.

## Interfaz

Por ajuste solicitado el 2026-10-09, el buscador de grupos se ubica en la fila sobre los registros, a la izquierda; Activos/Inactivos/Todos al extremo derecho desde sm. En xs ambos controles se apilan con ancho completo; la cabecera conserva Nuevo Grupo y expansión.

Ambos listados inician activos. Grupos ofrece Activos/Inactivos/Todos, exclusivo y con búsqueda persistente. Filtros cambian a página 1; borrar el último registro de una página posterior regresa a la anterior.

### Tabla agrupada y controles — FX-03

- Ajuste visual del 2026-10-25: el asa no muestra tooltip al pasar el puntero ni al enfocarla. Conserva nombre y descripción accesibles, teclado y eventos Pointer; no cambia el contrato de orden.
- Las cabeceras de agrupación muestran sólo el nombre traducido, sin prefijo «Grupo:» ni comentario de continuación entre páginas. Se mantiene la misma paginación y el mismo encabezado compartido para tabla y tarjetas.
- La tabla de módulos omite Nombre de Grupo e Identificador Grupal, ya representados por la agrupación. Las tarjetas móviles también omiten esos campos redundantes. Son siete columnas, u ocho con el asa al ordenar; estados vacíos y cabeceras de agrupación abarcan ese mismo número. No cambia la relación de grupo, sus filtros ni los formularios.

- Módulos aparecen bajo cabeceras de `module_group`; una cabecera repetida entre páginas representa únicamente el segmento visible. El paginado sigue contando módulos, no grupos ni totales de hijos completos. Grupos sin módulos se administran y ordenan desde su listado existente.
- «Ordenar» muestra un asa antes de ID en cada fila de módulo y de grupo; los grupos se arrastran desde su panel global, incluidos vacíos, no desde las cabeceras repetidas de módulos. Se solicitan páginas con ordering=true, todos los estados, sin q/filtros parciales; el estado normal de búsquedas/filtros no se modifica y sus páginas/tamaños se restauran al terminar. Fuera del modo se omite ordering=false para conservar las llamadas normales existentes. «Terminar» sale del modo; no revierte movimientos ya confirmados ni envía un array global de orden.
- Desde sm: columna de asa sticky a la izquierda, antes de ID, dentro del scroll local; xs: asa antes de cada tarjeta. El gesto Pointer permite ratón/touch y coloca antes/después de una fila visible del mismo tipo y grupo. Sólo se arrastra respecto de filas ya cargadas: no descarga otras páginas ni permite cambiar de padre. Una liberación genera como máximo un PATCH before/after. Paginar, cambiar vista o colapsar el grupo queda bloqueado durante el gesto para mantener estable la fuente.
- Asa con nombre accesible, ayuda ES/EN y target44px. Con el asa enfocada, ↑/↓ ejecuta un paso up/down respecto del vecino global del servidor, incluso al cruzar página; Escape cancela el gesto sin petición. Los botones de modo usan contained y conservan theme/layout. Se retiran acciones Copiar ID de ambas tablas y tarjetas; IDs siguen visibles y Copiar URL permanece.
- Los controles usan rangos/vecinos del servidor, no límites de la página cargada. Metadata ausente/histórica o inválida no habilita movimientos; Client valida IDs, rangos, parent y vecinos coherentes antes de usarlos. Una guardia síncrona común impide acciones de módulo/grupo concurrentes desde la página; controles bloqueados mientras se envía, revalida o ubica el ancla.
- Después de cada movimiento confirmado se esperan las invalidaciones `moduleKeys.all`, `moduleGroupKeys.all` y **`authorizationKeys.all`**. La última relee el contexto que actualiza el store del sidenav; éste refleja el nuevo orden sin recarga. La revalidación conserva datos y no muestra «Permisos actualizados», conforme a FX-01. Un movimiento emite un toast específico; unchanged se informa como sin cambios, no como orden modificado.
- Un409, timeout o respuesta inválida produce aviso y recuperación de sólo lecturas: no se reenvía el PATCH. Si falla la revalidación, el movimiento confirmado no se convierte en fallido; el modo queda bloqueado hasta recuperar la lectura. El locator ubica la fila después del movimiento o conflicto; si falla, muestra recuperación disponible y conserva el bloqueo.
- Actor y versión de sesión se capturan antes de enviar y se revalidan antes del dispatch/callbacks. Logout o cambio de usuario descarta efectos tardíos de UI, notificaciones y actualizaciones del contexto de la identidad anterior. Esto complementa la autorización backend; no la sustituye.

Validación por capas de FX-03: hooks/transporte, controles y agrupación atómicos; SQL/HTTP real desechable; navegador con fixture sintética a390px y1280px para orden, cruce de página y reflejo en sidenav. No acredita despliegue, cuenta autenticada operativa ni migración de la VM de uso. [Evidencia y cortes de checks](../../../../../../docs/evidence/core-fx03-order-validation-r01.json).

Ampliación de arrastre, 2026-10-25: pruebas atómicas de hook/asa y rotación/CAS, SQL/HTTP desechable y navegador Pointer con datos sintéticos. Se observó un salto de Usuarios detrás de Módulos y un movimiento de Administración detrás de Herramientas, ambos reflejados en tabla y sidenav. El corte sucesor Server DnD R03/Client DnD R02 fue adoptado y verificado por HTTP/SHA/MIME; UI real autenticada acredita dos drops unchanged con readback SQL intacto, sin efectuar un cambio positivo de orden. No acredita gestos en dispositivo físico ni cierre FX-04. Sin migración adicional o nuevas herramientas MCP. [Entrega y límites](../../../../../../docs/evidence/core-module-drag-delivery-r01.json).

En xs se usan MobileRecordCard; desde sm, tablas. Se comparten consultas, paginado y acciones. Menú Eliminar con trash/error.main y ConfirmDialog; cancelación no hace petición. Error conserva modal y target con Alert y toast traducido; éxito cierra, notifica y revalida listas/contexto (y usuarios al borrar módulo). Revalidación conserva información y bloquea controles. Ver DESIGN.md 9.6.

## Verificación reproducible

- Server: casos de uso `delete-module*.use-case.spec.ts`; `npm run test:modules:integration` usa PostgreSQL temporal en Docker y controladores/casos de uso reales, sin escribir en la BD configurada. Su guard de prueba comprueba una frontera sintética; no sustituye auditoría del sistema de login.
- Client: tests de Modules y MobileRecordCard; entrada visual aislada `src/test/manual/modules/README.md`.
