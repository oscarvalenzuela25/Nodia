# Contrato vigente de Acciones — 2026-10-09

Estado: reconciliado con código/DTOs por solicitud del usuario; no implica aprobación documental automática.

## Datos y transporte

General: Action, tabla actions, ID bigint serializado como string exacto, key única, description nullable, is_active boolean y traducciones key/comment ES/EN. RoleAction referencia el registro; no existe module_id en la entidad actual. BusinessAction, tabla business_actions, tiene key, has_description, is_active y traducciones key/description (se admite comment histórico para presentación). No deducir descripción del flag ni inventar un nombre: usar traducción disponible/otro idioma/clave real. No convertir IDs a Number.

Rutas generales /api/v1/action y alias /api/v1/actions. Negocio /api/v1/business-action y alias /api/v1/business-actions. GET devuelve data y meta(page,limit,total_items,total_pages). Page/limit y alias size se validan por PaginationQueryDto. Filtros utilizados: q[key_cont], q[key_in] y q[is_active_eq] boolean. Los selectores generales conservan la consulta all existente; sin lecturas por fila.

POST/PUT/PATCH mantienen DTOs y formularios existentes. Backend conserva autenticación global y política de administración sin permisos granulares confirmada el2026-10-03; ocultar un menú no sustituye el control HTTP.

## Eliminación general

DELETE /api/v1/action/:id (también actions) devuelve204 sin cuerpo. ID decimal positivo dentro de bigint:400 actions:invalid_id; registro ausente:404 actions:not_found. El caso de uso bloquea la fila padre y limpia asignaciones a roles activas/inactivas, traducciones de actions y registro dentro de una transacción. Otro namespace con el mismo source_id se conserva. Una limpieza fallida revierte todos los datos; nuevas asociaciones quedan serializadas por lock/FK. Tras commit se intenta invalidar auth:context:* con el mecanismo Redis existente. Ver ADR-022.

Client invalida acciones, roles y contexto de autorización después del éxito; toast Sileo ES/EN de eliminación. Error muestra mensaje específico traducido si es una clave conocida, conserva modal y target. No hay reintento automático de mutación. ConfirmDialog comunica permanencia y eliminación de asignaciones/traducciones; menú Eliminar con trash/error.main. Negocio conserva su borrado existente y utiliza toast de eliminación.

## Presentación, filtros y estados

- Ajuste solicitado el2026-10-09: buscador de acciones de negocio en la fila sobre registros, a la izquierda; Activos/Inactivos/Todos al extremo derecho desde sm. En xs se apilan con ancho completo. Cabecera conserva Nueva Acción de Negocio y expansión; búsqueda/estado/página usan los mismos handlers.
- Ambos listados inician activos. Limpiar filtros generales restaura activos; quitar chip muestra todos. Negocio incorpora grupo exclusivo Activos/Inactivos/Todos, que reinicia página y envía true/false/ausencia de predicado. Búsqueda independiente por lista.
- xs (<600px): MobileRecordCard con título traducido o clave, estado textual, ID completo, identificador y descripción disponible. Actualizar abre el formulario existente; menú permite activar/desactivar, copiar ID y eliminar con los mismos handlers que escritorio.
- sm+: tablas de comparación existentes, mínimo650px con scroll local; una sola representación montada. Perspectivas dividida/general/negocio y expansión conservadas.
- Consultas, filtros y paginación compartidos entre tamaños; no duplicar datos ni resetear página por resize. Borrado del último registro en página posterior retrocede una página.
- Boneyard solo para contenido informativo inicial. Refetch/mutación conserva registros y bloquea controles; paginado fuera de Skeleton y del scroll horizontal. CTA móvil de ancho completo y44px; nombres accesibles ES/EN.
- Vacío y fallo diferenciados, error visual con reintento y feedback global de QueryCache. Modal de edición/confirmación permanece ante fallo y conserva valores/registro. Sin skeleton en inputs/botones.

## Evidencia reproducible

Tests Client en src/test/modules/generalSettings/pages/Actions y Backend en action/use-case/delete-action.use-case.spec.ts. Integración aislada: npm run test:actions:integration inicia PostgreSQL temporal, comprueba HTTP/DI, filtros, limpieza, rollback y carreras; no utiliza BD configurada ni identidad real. Navegador: src/test/manual/actions/README.md, producción con datos/transporte sintéticos. Aceptación física, cuenta real y despliegue no forman parte de esta evidencia.
