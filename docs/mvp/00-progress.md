# Progreso del MVP — Nodia

> Estado general: en desarrollo
> Última revisión: 2026-09-05

## Checklist

- [x] 01. Entrevista aprobada — `01-interview.md`
- [x] 02. PRD V1 aprobado — `02-prd-v1.md`
- [x] 03. Modelo de dominio ERD aprobado — `03-domain-model-erd.md`
- [x] 04. PRD V2 aprobado — `04-prd-v2.md`
- [x] 05. Sitemap aprobado — `05-sitemap.md`
- [x] 06. Route Specs aprobados — `06-route-specs.md`
- [x] 07. Restricciones de diseño aprobadas — `07-design-constraints.md`
- [x] 08. Stack frontend definido — `08-stack-frontend.md`
- [x] 09. Stack backend definido — `09-stack-backend.md`
- [x] 10. Stack DevOps definido — `10-stack-devops.md`
- [x] 11. Arquitectura inicial aprobada — `11-architecture-overview.md`
- [x] 12. Kanban revisado — `12-kanban.md`
- [x] 13. Preparación para implementación aprobada — `13-readiness-review.md`

## Estado operativo

| Paso | Estado | Bloqueo o siguiente acción |
|---:|---|---|
| 01 | aprobado | Revisión aprobada y terminología `Resources` confirmada el 2026-08-17 |
| 02 | aprobado | Aprobado tal como estaba en revisión el 2026-08-19 |
| 03 | aprobado | Aprobado el 2026-08-26; actualizado el 2026-09-05 con PKs bigint universales; actualizado el 2026-09-07 con tabla translations para i18n centralizado (ADR-002) |
| 04 | aprobado | Aprobado el 2026-08-26; reconciliado modelo de acciones dinámicas e i18n con flujos de negocio |
| 05 | aprobado | Aprobado el 2026-08-21; incluye login con React OAuth2 y CRUDs por modales |
| 06 | aprobado | Aprobado el 2026-08-22; confirmada paginación server-side y acceso administrativo en Header |
| 07 | aprobado | Aprobado el 2026-08-22; incluye uso de MUI, Light/Dark theme y Full Responsive |
| 08 | aprobado | Aprobado el 2026-08-22; stack Vite+React+MUI confirmado, tokens y tema integrados en código |
| 09 | aprobado | Aprobado el 2026-08-22; stack NestJS + TypeORM + PostgreSQL + JWT propio |
| 10 | aprobado | Aprobado el 2026-08-22; Cloudflare Pages, Northflank, monorepo y pre-commit hooks |
| 11 | aprobado | Aprobado el 2026-08-22; consolidación técnica (diagrama general y flujo de auth) completada |
| 12 | aprobado | Aprobado el 2026-08-22; desglose en 7 épicas y tareas trazables |
| 13 | aprobado | Aprobado el 2026-08-24 por instrucción directa del usuario; control total de Nodia concedido |

## Bloqueos actuales

- Ninguno registrado.

## Decisiones que invalidaron pasos posteriores

- El 2026-08-17 se separaron `Modules` y `Resources` como submódulos de `Ajustes Generales`; el PRD V1 en revisión ya reconcilia este cambio.
- El 2026-08-21 se eliminaron `/auth/google`, `/auth/callback`, y las rutas de detalle/edición `/:id` en el Sitemap; las ediciones se harán con modales.
- El 2026-08-22 se decidió que la paginación será asíncrona (server-side) desde el principio para evitar deuda técnica.
- El 2026-08-26 se eliminó la entidad `Resources` en favor de acciones dinámicas (`actions`). Se agregaron campos `key` para soportar multiidioma y se removió `users.is_allowed`. Esto invalidó el PRD V2.
- El 2026-09-05 se actualizó el modelo de datos (`03-domain-model-erd.md`) adoptando `bigint` autoincremental de forma universal para todas las tablas (entidades principales y tablas pivote `user_roles`, `role_actions`) en lugar de UUIDs, optimizando el rendimiento de índices y almacenamiento en PostgreSQL.
- El 2026-09-07 se incorporó la tabla `translations` (ADR-002) para centralizar la gestión de traducciones multiidioma (i18n) en el backend y PostgreSQL, utilizando un catálogo indexado por `key` y `locale`.
- El 2026-09-08 se actualizó el modelo de dominio (`03-domain-model-erd.md`) con 8 tablas definitivas: aplanamiento de `modules` agrupados por `group_by` (eliminando `parent_id` y `type`), desacoplamiento de `actions` sin `module_id`, creación de la tabla pivote `user_modules` para navegación de usuario, y extensión cuádruple de `translations(source_entity, source_id, source_key, locale)`.

## Próxima acción recomendada

Comenzar con la implementación técnica del proyecto, desarrollando los módulos, componentes y endpoints acordados, y avanzando en las épicas descritas en el tablero Kanban (`12-kanban.md`).
