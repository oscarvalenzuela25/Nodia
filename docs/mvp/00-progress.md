# Progreso del MVP — Nodia

> Estado general: en desarrollo
> Última revisión: 2026-09-12

## Checklist

- [x] 01. Entrevista aprobada — `01-interview.md`
- [x] 02. PRD V1 aprobado — `02-prd-v1.md`
- [ ] 03. Modelo de dominio ERD aprobado — `03-domain-model-erd.md`
- [x] 04. PRD V2 aprobado — `04-prd-v2.md`
- [x] 05. Sitemap aprobado — `05-sitemap.md`
- [ ] 06. Route Specs aprobados — `06-route-specs.md`
- [x] 07. Restricciones de diseño aprobadas — `07-design-constraints.md`
- [ ] 08. Stack frontend definido — `08-stack-frontend.md`
- [ ] 09. Stack backend definido — `09-stack-backend.md`
- [ ] 10. Stack DevOps definido — `10-stack-devops.md`
- [ ] 11. Arquitectura inicial aprobada — `11-architecture-overview.md`
- [ ] 12. Kanban revisado — `12-kanban.md`
- [ ] 13. Preparación para implementación aprobada — `13-readiness-review.md`

- [ ] 14. Guía de autenticación y operación — `14-authentication.md` (implementación completada; documento en revisión)

Las casillas reabiertas señalan documentos afectados por la ampliación de auth; la autorización total para desarrollar continúa vigente. No se han aprobado automáticamente nuevos documentos.

## Estado operativo

| Paso | Estado | Bloqueo o siguiente acción |
|---:|---|---|
| 01 | aprobado | Revisión aprobada y terminología `Resources` confirmada el 2026-08-17 |
| 02 | aprobado | Aprobado tal como estaba en revisión el 2026-08-19 |
| 03 | en revisión | Ampliación auth implementada; revisión documental pendiente. Historial:  Aprobado el 2026-08-26; actualizado el 2026-09-05 con PKs bigint universales; actualizado el 2026-09-07 con tabla translations para i18n centralizado (ADR-002) |
| 04 | aprobado | Aprobado el 2026-08-26; reconciliado modelo de acciones dinámicas e i18n con flujos de negocio |
| 05 | aprobado | Aprobado el 2026-08-21; incluye login con React OAuth2 y CRUDs por modales |
| 06 | en revisión | Ampliación auth implementada; revisión documental pendiente. Historial:  Aprobado el 2026-08-22; confirmada paginación server-side y acceso administrativo en Header |
| 07 | aprobado | Aprobado el 2026-08-22; incluye uso de MUI, Light/Dark theme y Full Responsive |
| 08 | en revisión | Ampliación auth implementada; revisión documental pendiente. Historial:  Aprobado el 2026-08-22; stack Vite+React+MUI confirmado, tokens y tema integrados en código |
| 09 | en revisión | Ampliación auth implementada; revisión documental pendiente. Historial:  Aprobado el 2026-08-22; stack NestJS + TypeORM + PostgreSQL + JWT propio |
| 10 | en revisión | Ampliación auth implementada; revisión documental pendiente. Historial:  Aprobado el 2026-08-22; Cloudflare Pages, Northflank, monorepo y pre-commit hooks |
| 11 | en revisión | Ampliación auth implementada; revisión documental pendiente. Historial:  Aprobado el 2026-08-22; consolidación técnica (diagrama general y flujo de auth) completada |
| 12 | en revisión | Ampliación auth implementada; revisión documental pendiente. Historial:  Aprobado el 2026-08-22; desglose en 7 épicas y tareas trazables |
| 13 | en revisión | Ampliación auth implementada; revisión documental pendiente. Historial:  Aprobado el 2026-08-24 por instrucción directa del usuario; control total de Nodia concedido |

## Bloqueos actuales

- Ninguno registrado.

## Decisiones que invalidaron pasos posteriores

- El 2026-08-17 se separaron `Modules` y `Resources` como submódulos de `Ajustes Generales`; el PRD V1 en revisión ya reconcilia este cambio.
- El 2026-08-21 se eliminaron `/auth/google`, `/auth/callback`, y las rutas de detalle/edición `/:id` en el Sitemap; las ediciones se harán con modales.
- El 2026-08-22 se decidió que la paginación será asíncrona (server-side) desde el principio para evitar deuda técnica.
- El 2026-08-26 se eliminó la entidad `Resources` en favor de acciones dinámicas (`actions`). Se agregaron campos `key` para soportar multiidioma y se removió `users.is_allowed`. Esto invalidó el PRD V2.
- El 2026-09-05 se actualizó el modelo de datos (`03-domain-model-erd.md`) adoptando `bigint` autoincremental de forma universal para todas las tablas (entidades principales y tablas pivote `user_roles`, `role_actions`) en lugar de UUIDs, optimizando el rendimiento de índices y almacenamiento en PostgreSQL.
- El 2026-09-07 se incorporó la tabla `translations` (ADR-002) para centralizar la gestión de traducciones multiidioma (i18n) en el backend y PostgreSQL, utilizando un catálogo indexado por `key` y `locale`.
- El 2026-09-08 se actualizó el modelo de dominio (`03-domain-model-erd.md`) con 8 tablas iniciales (aplanamiento de `modules`, desacoplamiento de `actions`, `user_modules` y `translations`). Posteriormente el mismo día, se aprobó la incorporación de la novena tabla `module_groups`, reemplazando el atributo string `group_by` en `modules` por una clave foránea normalizada `module_group_id` con índice dedicado `idx_modules_module_group_id`.

## Próxima acción recomendada

Comenzar con la implementación técnica del proyecto, desarrollando los módulos, componentes y endpoints acordados, y avanzando en las épicas descritas en el tablero Kanban (`12-kanban.md`).

## Seguimiento técnico

- 2026-09-12: opción A de [ADR-003 — Rate limiting distribuido](../architecture/decisions/ADR-003-api-rate-limiting.md) aprobada por el usuario e implementada con `@nestjs/throttler` y Redis. Compatibilidad con NestJS 12 resuelta mediante overrides acotados y verificada localmente. Incluye cuotas por IP, `429`/`Retry-After`, `503` ante fallo de Redis y feedback es/en del cliente. Pendientes de operación: confirmar Redis/proxy y ajustar cuotas con tráfico de staging. Login y cuotas por usuario se completan en la ampliación posterior a auth registrada abajo. No se realizó despliegue.

- 2026-09-12: autenticación solicitada e implementada en [ADR-004](../architecture/decisions/ADR-004-auth-sessions.md) y [guía operativa](14-authentication.md). Login Google, JWT propio, refresh rotativo HttpOnly, guard global, contexto real, persist, avatar/logout y migración. Pendientes externos: Google Cloud/cuenta real y despliegue. Autorización fina por acciones sigue en T3.4b. Se reabren las revisiones documentales afectadas por ampliar la estrategia de sesiones.
- 2026-09-12: requisito adicional de sesión activa implementado. Visitantes sin token no llaman a la API; la recuperación valida/renueva antes de habilitar datos. Consultas y transporte Axios bloqueados sin sesión activa. Guard global comprobado para rutas de negocio, con excepciones públicas por método. Se actualizan ADR-004 y documentos 08, 11 y 14 sin marcarlos aprobados.
- 2026-09-12: refactor solicitado de configuración HTTP: `axiosInstance.ts` queda dedicado al transporte, `authSession.ts` concentra la lógica de sesión y `api.ts` compone ambos con un gestor compartido. Se actualizan imports, pruebas y documentación, conservando el contrato de autenticación y el estado de revisión de los documentos.
- 2026-09-12: navegación separada en `GuardStrict` (sesión y módulo asignado en `/settings/*`), `Guard` (demo o sesión) y `NoGuard` (login). La carga de contexto precede a páginas estrictas, incluidos accesos directos por URL. Menú y tarjetas ocultan módulos sin sesión validada. Se actualizan las reglas documentales sin aprobar nuevas versiones.
- 2026-09-12: integración pendiente de rate limiting con auth completada. Login incorpora 10 intentos/minuto por IP; usuario verificado, 300 solicitudes/minuto y 30 escrituras/minuto compartidas entre sesiones/IPs. Registro global explícito IP → JWT/sesión → usuario; refresh/logout mantienen protección por IP. Backend: build/lint y 73 pruebas correctos, más comprobación HTTP de auth con dos procesos y Redis temporal real. Se actualizan ADR-003 y documentos dependientes conservando su estado de revisión. Continúan pendientes la validación de Redis/proxy y calibración en el despliegue.
