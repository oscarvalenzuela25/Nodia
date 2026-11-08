---
{
  "schema_version": 1,
  "document_id": "general-settings.module-presentation-and-order",
  "product_id": "general-settings",
  "kind": "feature",
  "revision": 8,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "FX-04: Server DnD R03/Client pagination R07 en VM Linux local. Cambios positivos de grupo/módulo desde UI autenticada, invalidación y sidenav sin recarga, persistencia tras recarga, filtros restaurados, cruce de página por teclado y alta/grupo vacío inactivo verificados. Corregido size→limit en transporte Client/locator. Ocho movimientos reales, grupo de ensayo eliminado tras autorización humana y orden original restaurado;58 tablas ajenas sin cambios. Pendientes alta de módulo desde formulario (rutas ocupadas), dos administradores reales y renovación natural completa. Concurrencia de dos principales, permisos y proyección MCP probados aisladamente. No añade herramientas ni publicación. 2026-11-01: rutas canónicas independientes del grupo; Teacher ofrecido en selector y accesos móviles identificados por moduleKey estable. Migración local de enlaces con IDs/asignaciones preservados y pruebas de mover/renombrar grupo."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento Core y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/87-core-feedback-module-order-plan.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/module/entities/module.entity.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/module-group/entities/module-group.entity.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/generalSettings/pages/Modules/CONTRACT.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/module-order/move-catalog-order.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/module-order/next-sort-order.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/module-order/order-metadata.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/migrations/1793200000000-AddModuleSortOrder.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/generalSettings/pages/Modules/Modules.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/generalSettings/pages/Modules/infrastructure/useServices.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/generalSettings/pages/Modules/infrastructure/orderSchemas.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/module/module.service.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/module-order/order-policy.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/generalSettings/pages/Modules/hooks/useOrderDrag.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/generalSettings/pages/Modules/components/DragOrderHandle/DragOrderHandle.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/generalSettings/pages/Modules/infrastructure/services.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-31",
    "evidence_paths": [
      "docs/evidence/core-fx02-order-validation-r01.json",
      "docs/evidence/core-fx03-order-validation-r01.json",
      "docs/evidence/core-fx04-live-delivery-r01.json",
      "docs/evidence/core-fx04-live-modules-r01.png",
      "docs/evidence/core-module-drag-delivery-r01.json",
      "docs/evidence/core-fx04-live-acceptance-r02.json",
      "docs/evidence/sidenav-collapsed-tooltips-20261031-r25.json"
    ],
    "notes": "FX-04: Server DnD R03/Client pagination R07 en VM Linux local. Cambios positivos de grupo/módulo desde UI autenticada, invalidación y sidenav sin recarga, persistencia tras recarga, filtros restaurados, cruce de página por teclado y alta/grupo vacío inactivo verificados. Corregido size→limit en transporte Client/locator. Ocho movimientos reales, grupo de ensayo eliminado tras autorización humana y orden original restaurado;58 tablas ajenas sin cambios. Pendientes alta de módulo desde formulario (rutas ocupadas), dos administradores reales y renovación natural completa. Concurrencia de dos principales, permisos y proyección MCP probados aisladamente. No añade herramientas ni publicación. R25: ayudas visuales del Sidenav verificadas ES/EN en12perfiles, mouse/teclado/Escape y adopción Client con respaldo. No cierra pendientes funcionales FX-04, acredita dispositivo físico ni amplía contexto/herramientas/publicación."
  },
  "approval": null
}
---

# Módulos agrupados y orden persistido — contexto funcional

## Corte vigente — aceptación UI y paginado corregido, 2026-10-25

FX-04: Server DnD R03/Client pagination R07 en VM Linux local. Cambios positivos de grupo/módulo desde UI autenticada, invalidación y sidenav sin recarga, persistencia tras recarga, filtros restaurados, cruce de página por teclado y alta/grupo vacío inactivo verificados. Corregido size→limit en transporte Client/locator. Ocho movimientos reales, grupo de ensayo eliminado tras autorización humana y orden original restaurado;58 tablas ajenas sin cambios. Pendientes alta de módulo desde formulario (rutas ocupadas), dos administradores reales y renovación natural completa. Concurrencia de dos principales, permisos y proyección MCP probados aisladamente. No añade herramientas ni publicación.

[Recibo vigente](../../../../evidence/core-fx04-live-acceptance-r02.json). Los rangos administrativos siguen fuera de los contratos MCP. Un límite canónico HTTP permite que contador, filas y locator compartan tamaño; no modifica el DTO compartido ni el alias de otros consumidores.

## Corte histórico — arrastre adoptado y aceptación acotada, 2026-10-25

Server DnD R03/Client DnD R02 adoptados en la VM Linux local, sin migración adicional sobre historia30. Backup cifrado previo,60 tablas/orden/configuración/época Gemini y150 contratos/41fragmentos conservados; journal abierto sin entradas no confirmadas o backups expirados.171 assets HTTP/SHA/MIME, SPA/API200 y asset ausente404 comprobados. [Recibo](../../../../evidence/core-module-drag-delivery-r01.json) y [corte operativo87](../../../../mvp/87-core-feedback-module-order-plan.md#adopción-de-la-ampliación-de-arrastre--2026-10-25).

UI real autenticada muestra asas y no ofrece Copiar ID. Dos drops before adyacentes —grupo2 antes de4 y módulo6 antes de7— devolvieron HTTP200 unchanged; readback SQL posterior conserva datos y orden, sin cambio positivo guardado por el operador. Los cambios efectivos/sidenav se aceptan sólo en SQL aislada y navegador sintético, no se extrapolan a esa cuenta. [Módulos](../../../../evidence/core-module-drag-modules-live-r01.png), [grupos](../../../../evidence/core-module-drag-groups-live-r01.png), [móvil emulado](../../../../evidence/core-module-drag-mobile-r01.png). La emulación táctil no admitió el gesto; no se afirma aceptación física.

Rollback DnD R03→R02/Client R02→R01 preparado, no ejecutado, conserva esquema30; no sustituye un plan revisado para volver a R09/esquema previo. Corte final Client73/8 y Server71/3 focales, builds/tipos/lints y SQL99/64/18 correctos; no sumar recuentos superpuestos. FX-04 sigue parcial por efectos positivos autenticados, concurrencia y ciclo completo de sesión. Ficha6 draft/partial/unregistered, approval null, sin nueva inferencia, herramienta o publicación MCP.

## Ampliación de arrastre — implementación aislada, 2026-10-25

Por petición del usuario, Ordenar incorpora un asa antes de ID y antes de las tarjetas xs; Pointer ratón/touch permite colocar antes/después de una fila cargada del mismo ámbito. Los grupos se arrastran desde su panel global, incluidos vacíos, no desde las cabeceras repetidas de módulos. Target44px; con el asa enfocada, ↑/↓ conserva pasos adyacentes y cruce de página, Escape cancela. Copiar ID se retira de tablas/tarjetas, con IDs visibles y Copiar URL conservados. La ayuda de entrada permite descubrir el modo sin modificar filtros normales.

Un drop envía como máximo un PATCH before/after con rangos/IDs esperados de origen y destino, más padre esperado para módulos. Server rota sólo los rangos del intervalo dentro de la transacción Core, conserva huecos e inactivos y nunca cambia el módulo de grupo. Sin arrays globales, swaps HTTP encadenados, nueva migración o ampliación MCP. Tres invalidaciones, localización y recuperación de sólo lectura se conservan; las precondiciones no prometen detección ABA ni idempotencia permanente.

[Plan87](../../../../mvp/87-core-feedback-module-order-plan.md#ampliación-de-arrastre--implementación-y-qa-aislada-2026-10-25) distingue verificaciones atómicas/SQL desechable de Pointer de navegador sobre datos sintéticos: salto de Usuarios detrás de Módulos y de Administración detrás de Herramientas reflejados en tabla/sidenav. Este corte local precedió la adopción R03/R02 registrada arriba; no acredita dispositivo físico ni efectos positivos sobre la BD de uso. Ficha revisión6 draft/partial/unregistered, approval null, sin publicar capacidades.

## Corte FX-04 — adopción operativa parcial, 2026-10-25

Migración1793200000000 y runtime Server R02/Client R01 adoptados en la VM Linux local autorizada, con backup cifrado previo y escritores drenados. Historia29→30, backfill y constraints comprobados; proyección SQL ajena al orden conserva datos, autoridad y asignaciones. Redis eliminó una clave de contexto y comprobó cero restantes. El sucesor Server R02 sólo alinea dos metadatos src de conocimiento con dist; no repite migración y conserva exactamente150 contratos/41fragmentos R09, configuración, época Gemini y orden migrado. [Corte y evidencias](../../../../mvp/87-core-feedback-module-order-plan.md#adopción-operativa-parcial-de-fx-04--2026-10-25).

Client compilado servido por nginx comprobado por171 assets HTTP/SHA/MIME, SPA/API200 y asset ausente404. La página de módulos se leyó desde una sesión real: tabla agrupada, modo Ordenar, metadata válida y extremos de flechas coherentes. [Captura](../../../../evidence/core-fx04-live-modules-r01.png). No se ejecutaron movimientos ni CRUD desde esa cuenta, ni inferencias IA; faltan aceptación funcional de altas/movimientos, actualización del sidenav, concurrencia y ciclo de sesión. FX-04 permanece abierto y esta ficha draft/partial/unregistered, approval null. [Evidencia consolidada](../../../../evidence/core-fx04-live-delivery-r01.json).

En ese corte R02 no se ejecutó rollback: el operador preparado para R01 era histórico y sus guards no correspondían a R02. Volver de aquel R02 a un runtime anterior al esquema30 exigía un plan revisado, backup nuevo y escritores detenidos; no bastaba cambiar un descriptor y reutilizar escritores antiguos con columnas sin DEFAULT. El corte DnD vigente de arriba sí incorpora un operador específico R03→R02 bajo el mismo esquema30, preparado y no ejecutado.

## Corte FX-03 — implementación parcial, 2026-10-25

Tabla/tarjetas agrupadas y controles de orden implementados en fuentes; cada movimiento invalida listas y `authorizationKeys.all`, actualizando el contexto del sidenav sin recargar ni anunciar un éxito genérico de permisos. Lecturas ordering=true y locate_id conservan el ancla en la página actual del servidor tras éxito/conflicto. Recuperación sólo GET, sin replay de PATCH, con bloqueo si no puede releerse y fences de actor/sesión. [Contrato de UI](../../../../../nodia-client/src/modules/generalSettings/pages/Modules/CONTRACT.md) y [evidencia por capa](../../../../evidence/core-fx03-order-validation-r01.json).

En este corte se observó orden de módulos/grupos y reflejo en sidenav en navegador con fixture sintética, además de cruce de página y responsive390/1280. No equivale a aceptación autenticada operativa. Migración/adopción de la BD de uso y FX-04 seguían pendientes entonces; el corte sucesor de arriba registra la adopción parcial. Documento draft/unregistered y approval null conservados.

## Corte FX-02 — implementación parcial, 2026-10-25

Columnas y migración, asignación nativa de posición, endpoints administrativos de movimiento, lectura ordering y contexto ordenado implementados en fuentes. La integración SQL usa PostgreSQL desechable y HTTP con actor sintético; no es aceptación de una cuenta real. [Contrato ejecutado](../../../../../nodia-client/src/modules/generalSettings/pages/Modules/CONTRACT.md) y [evidencia](../../../../evidence/core-fx02-order-validation-r01.json). En este corte los controles seguían planificados; el corte sucesor FX-03 de arriba registra su implementación local.

## Qué resuelve y qué significa

[Plan87](../../../../mvp/87-core-feedback-module-order-plan.md) propone agrupar visualmente el listado administrativo por module-group y controlar desde BD el orden de grupos y de módulos dentro de cada grupo. No hay jerarquía padre/submódulo adicional. Navegación y administración deben consumir el criterio persistido. Esta ficha no altera la [publicación de lecturas existente](modules-and-groups.md).

## Solicitudes en lenguaje natural

| Ejemplo | Estado y aclaraciones |
|---|---|
| «¿Qué módulos pertenecen a este grupo?» | Usar únicamente filtros y lecturas actualmente publicados, aclarando el grupo ambiguo. |
| «Muestra antes este grupo» | Usar los controles administrativos de orden de la tabla; no hay herramienta de reordenamiento habilitada por esta ficha. |
| «Pon Reservas después de Negocios» | Aclarar si se refiere a grupos o módulos y a qué entidades; no fabricar valores o ejecutar por SQL libre. Requiere contrato MCP posterior. |

## Operaciones y contratos

FX-02 implementa `sort_order` entero no negativo con unicidad global en grupos y por grupo en módulos. Server asigna MAX+1 al final sólo en altas reales; editar/reactivar/upsert de un existente conserva su orden y cambiar de grupo agrega al final del destino. Huecos tras borrar son válidos. No se edita el número libremente en formularios. [ADR-078 propuesto](../../../../architecture/decisions/ADR-078-module-order-and-atomic-moves.md).

Los PATCH administrativos `/module/:id/order` y `/module-group/:id/order`, con aliases plurales, aceptan pasos up/down de dos vecinos y colocaciones before/after respecto de un destino. Una colocación rota los rangos del intervalo en una transacción Core, sin modificar huecos o padres; un paso usa vecinos globales incluso en otras páginas. Valida ID/rango esperados de origen/vecino o destino, más grupo para módulos; conflicto409 sin efectos, extremo o colocación ya coincidente no-op. Metadata por conjuntos, no por fila. No enviar listas completas ni coordinar escrituras múltiples desde Client. No expone estas operaciones por MCP.

FX-03 conserva paginación de módulos y repite cabeceras si un grupo cruza páginas. Un contador de página no representa el total de hijos del grupo. Ordenar habilita asas en filas de módulos y del panel global de grupos, muestra Todos sin filtros parciales y guarda filtros normales para restaurarlos al salir. Terminar no revierte movimientos guardados. Grupos vacíos se ordenan desde el listado de grupos existente; no se inventan módulos para representarlos. El drag sólo apunta a filas cargadas; el teclado usa vecinos globales.

Adoptados en la VM Linux local: migración/backfill históricos, reglas de alta/cambio de grupo, DTOs up/down/before/after, unicidad diferible, metadata de vecinos/locator, orden previo al paginado y asas Client DnD R02 sobre Server DnD R03. PENDIENTE: completar aceptación funcional positiva autenticada FX-04; lectura y dos drops unchanged no acreditan un cambio real de orden. No se registran herramientas nuevas ni se cambia el schema MCP; tampoco se permite escribir sort_order por el chat.

## Datos mínimos y resolución de dudas

Identificar grupo o módulo por su ID string y ámbito vigente. El orden es administrado por Server: primer registro0, siguientes al final del conjunto completo; mínimo0, máximo del tipo PostgreSQL integer. No aceptar posiciones arbitrarias de CRUD ni deducir prioridad por texto traducido. Los movimientos requieren dirección y rangos/IDs esperados de origen y vecino o destino; before/after no acepta destino null o idéntico al origen. Módulos requieren el mismo grupo esperado en ambos extremos. Los valores iniciales distintos por ámbito deben quedar definidos y comprobados en el backfill; no DEFAULT0 para todas las altas.

## Reglas, acceso y restricciones

Conservar autoridad administrativa e invariantes Core actuales, incluida la transversalidad de super_admin. Ordenar no asigna acceso ni modifica módulos, roles o acciones del usuario. Invalidar contexto sólo después del commit; no reemplazar la autorización backend con la visibilidad de navegación.

## Filtros e informes

Mantener filtros y metadatos existentes: activos por defecto, inactivos o todos explícitos, clave, grupo, búsqueda y paginado. No añade agregados ni total completo de hijos. Las herramientas actuales siguen sus proyecciones y schemas cerrados.

## Vista previa, confirmación y recuperación

Desde la tabla, cada movimiento se guarda por petición y emite un toast específico al completarse; entrar/salir del modo no anuncia cambios de BD. Deshabilitar controles durante la petición y conservar datos/estado ante error. Timeout/resultado incierto exige releer y conciliar, sin replay automático; las posiciones esperadas no son una versión monotónica ni garantizan idempotencia permanente. Después de cruzar página, mantener visible la fila según metadata backend.

Los hooks esperan invalidación de módulos, grupos y contexto de autorización tras cada movimiento. El store del sidenav recibe el contexto revalidado; FX-01 conserva el silencio de lecturas automáticas. La respuesta y metadata accionable se validan antes de usarse; identidad/cambio de sesión descarta resultados tardíos. `GET /modules?ordering=true&locate_id=...` ubica el ancla y lee su página dentro de un snapshot; si falla la recuperación, quedan bloqueadas nuevas escrituras hasta releer, no se repite el movimiento.

Los formularios CRUD conservan su error/modal/valores y no solicitan un número de orden. Para un futuro cambio por NodiaAI siguen siendo obligatorios preparador, propuesta exacta, confirmación humana y garantías nativas; no se habilitan por documentación. No se añade lote de reordenamiento ni múltiples escrituras pretendidamente atómicas desde Client.

## Integración y evidencia

- [x] Orden BD, altas al final, movimientos/precondiciones y consulta estable implementados y probados en entorno aislado.
- [x] Contexto y Sidenav alineados en fuentes, runtime adoptado y caché Redis operativo invalidado en el corte; prioridades por nombre retiradas. Refresco posterior a movimientos reales pendiente.
- [x] Tabla/tarjetas agrupadas, asa Pointer y teclado ↑/↓ comprobados con navegador sintético; filtro y página normales restaurados al terminar. Ampliación adoptada y UI autenticada con dos unchanged comprobada; efectos positivos autenticados, continuidad y dispositivo físico conservan sus límites pendientes.
- [ ] Regresiones de autorización, proyecciones MCP y errores conservadas.

La ficha se valida por path explícito pero permanece excluida de publicación. Existe evidencia operativa acotada de adopción y lectura autenticada, sin cierre de FX-04. Reordenamiento MCP requiere trabajo posterior de schema/hash/confirmación y aceptación.

## Evolución y compatibilidad

| Revisión | Cambio | Compatibilidad |
|---|---|---|
| 1 | Plan87 por solicitud del 2026-10-25 | Sin implementación ni publicación nueva; preserva ficha y capacidades aprobadas existentes. |
| 2 | Altas al final y orden desde filas/cabeceras; sustituye números manuales/empates por movimientos atómicos | Planificación solicitada, no implementación ni aprobación documental general; sin cambios MCP. |
| 3 | FX-02 backend y consumo del orden Server en Sidenav implementados/verificados aisladamente | Sin migración de BD de uso, controles FX-03, aceptación FX-04 ni ampliación MCP; draft/unregistered. |
| 4 | FX-03 tabla agrupada, controles, contexto invalidado y locator de sólo lectura | Verificación local/SQL y navegador sintético por capas; sin adopción operativa, aprobación general o ampliación MCP. |
| 5 | FX-04 adopción en VM Linux local, migración única y Server R02/Client R01 con lectura UI autenticada | Aceptación parcial sin movimientos/CRUD reales; alta, concurrencia y sesión pendientes. Draft/unregistered, sin aprobación o ampliación MCP; rollback R01 superado por R02. |
| 6 | Asa antes de ID, Pointer/teclado, eliminación de Copiar ID y colocación before/after atómica por intervalo; adopción R03/R02 | Positivos en SQL aislada/navegador sintético; UI real acredita dos unchanged y SQL intacto. Sin dispositivo físico, migración adicional o publicación MCP; draft/partial/unregistered y FX-04 parcial. |


## Evaluación visual R25 — 2026-10-31

El menú lateral colapsado identifica Inicio y cada módulo con su nombre traducido mediante Tooltip a la derecha y nombre accesible. El foco de teclado permite la misma ayuda y Escape la cierra conservando el foco. El menú expandido y el drawer móvil siguen mostrando etiquetas, sin tooltip duplicado. Se reutilizan el contexto autorizado y la resolución de traducciones existentes: no cambia el orden, la navegación, los permisos, las consultas ni la interpretación de resultados. No afecta el contexto funcional de NodiaAI y no requiere una ficha, herramienta o publicación nueva. [Evidencia R25](../../../../evidence/sidenav-collapsed-tooltips-20261031-r25.json) distingue checks locales, QA y adopción. Esta evaluación no concede aprobación ni cierra pendientes de FX-04.


Rutas2026-11-01: el grupo puede renombrarse o el módulo moverse sin cambiar su URL/folder/autoridad. Teacher aparece en el selector como `/nodia-teacher`; la asignación es individual mediante mantenedor. Ver [ADR092](../../../../architecture/decisions/ADR-092-stable-module-navigation-routes.md).
