# Panel Kanban — Nodia Parte 1

> Estado: en revisión — ampliaciones auth, Finanzas y Reservas; aprobación histórica del MVP conservada
> Última actualización: 2026-10-05
> Dependencias: Documentos 01 al 11 aprobados

## Objetivo

Derivar la especificación técnica en tickets o tareas funcionales trazables, organizados por épicas, para facilitar la implementación secuencial del MVP.

## Épica nueva: Contactos de proveedores — implementación local 2026-10-05

- [x] Registrar horario propio de cada contacto y autorización de implementación en [31](31-provider-contacts-proposal.md); ADR-014 conserva revisión.
- [x] Entidad `personal_info_provider`, migración incremental, contratos estrictos y recurso vertical; creación idempotente y actualización con versión.
- [x] ProvidersTab con sección Contactos por proveedor y formulario de teléfonos/horarios; i18n, estados y recuperación ante errores.
- [x] Verificar casos de uso y componentes; suites completas 561 Server / 841 Client, checks estáticos/build e integración HTTP/PostgreSQL temporal con migración reversible.
- [x] QA navegador con alta/edición, horario inválido, respuesta perdida, escritorio/móvil, ES/EN y claro/oscuro.
- [x] Inventariar baseline/historial y respaldar BD local configurada; aplicar únicamente contactos y verificar ambos listados vía HTTP en modo lectura.
- [ ] Smoke autenticado con sesión real y aplicación en otros entornos.
- [ ] Revisión y aprobación explícita de documentos actualizados; despliegue.

El primer pendiente operativo es el smoke con sesión real. La migración de contactos ya se aplicó en la BD local configurada con respaldo; otros entornos y migraciones ajenas no están verificados por esta entrega. La incidencia y evidencia HTTP están en 31.

## Épica nueva: Finanzas personales — Backend local completo; Client pendiente

- Modelo/documentación: cinco tablas y nueve FKs incorporadas a 03 y al diagrama de Obsidian; migración incremental implementada y ensayada en PostgreSQL aislado.
- Contrato previo: [22-personal-finance-contracts.md](22-personal-finance-contracts.md).
- Backend: [26 tareas FB-01..FB-26](23-personal-finance-backend-plan.md) cerradas localmente con evidencia; 19 operaciones HTTP, 369 pruebas correctas y ensayo PostgreSQL de constraints, rollback, concurrencia y respaldo/restauración.
- Frontend: [25 tareas FC-01..FC-25](24-personal-finance-client-plan.md), ruta constante/guard, tabs/General, tablas, modales, Filter/default activos, inputs reutilizables y QA.
- Orden: fijar contratos/entidades/migración; lecturas y escrituras de Server; agregados; integración. Client puede avanzar estructura/tipos con contrato y fixtures, pero la integración real requiere Server.
- Las tareas detalladas viven en esos planes. Client continúa pendiente; la BD configurada no recibió migración/seed y no hubo despliegue. La implementación no aprueba automáticamente los documentos.

## Épica 1: Infraestructura y Setup

- **[T1.1] Setup Backend:** Inicializar el proyecto NestJS (`nodia-api`), conectar a PostgreSQL y configurar TypeORM.
- **[T1.2] Setup Calidad:** Configurar Husky, lint-staged, Prettier y ESLint para frontend y backend.
- **[T1.3] Setup DevOps:** Crear flujos iniciales de GitHub Actions para CI (lint/tests en pull requests).

## Épica 2: Base de Datos y Seed

- **[T2.1] Entidades TypeORM:** Modelar en código las tablas `users`, `roles`, `modules`, `resources`, `actions`, `role_resource_actions` y `user_roles` (con UUIDs, borrados lógicos `is_active` e índices únicos).
- **[T2.2] Seeder Base:** Crear script/seeder que inyecte el catálogo fijo de acciones (`view`, `create`, `update`, `delete`) y un usuario inicial con el rol `super admin`.

## Épica 3: Autenticación (Core)

- [x] **T3.1 UI Login:** botón oficial GoogleLogin, credencial ID token, loading y errores traducidos.
- [x] **T3.2 Endpoint Login:** `POST /api/v1/auth/login`, usuario precreado/activo, JWT propio y refresh cookie.
- [x] **T3.3 Perfil/contexto:** `GET /api/v1/auth/me` y `/api/v1/authorization/context` con identidad validada.
- [x] **T3.4a AuthGuard:** JWT, sesión activa y usuario activo, API protegida por defecto.
- [ ] **T3.4b PermissionsGuard:** autorización fina por acciones en endpoints; pendiente independiente de autenticación.
- [x] **T3.5 Estado Auth:** store existente con persist, Axios Bearer, renovación y control de respuestas tardías.
- [x] **T3.6 Sesiones renovables:** refresh de siete días, rotación atómica, hash en DB y revocación ante replay.
- [x] **T3.7 Logout y perfil UI:** Home tras login, avatar, menú, cierre remoto y limpieza local.
- [ ] **T3.8 Operación:** validar cuenta real/orígenes en Google Cloud y desplegar migración/configuración según [guía auth](14-authentication.md).

## Épica 4: Frontend Transversal y Enrutamiento

- **[T4.1] Layout Administrativo:** Crear la UI base (Header, Menú lateral, vistas 404 y Maintenance).
- **[T4.2] Rutas Protegidas:** Implementar *Guards* de React Router para proteger el acceso a `/settings/*` basado en el contexto de Zustand (si el usuario no tiene permisos, mostrar 404).

## Épica 5: Gestión de Módulos y Recursos

- **[T5.1] API Módulos y Recursos (Back):** Endpoints paginados (server-side) para CRUD de Modules y Resources. Validar inmutabilidad del campo `key`.
- **[T5.2] UI Módulos (Front):** Vista `/settings/modules` (Tabla paginada + Modal de creación/edición).
- **[T5.3] UI Recursos (Front):** Vista `/settings/resources` (Tabla paginada + Modal de creación/edición referenciando a los módulos).

## Épica 6: Gestión de Roles y Permisos

- **[T6.1] API Roles (Back):** Endpoints CRUD de Roles. La actualización debe permitir reescribir las asociaciones en la tabla pivote `role_resource_actions`.
- **[T6.2] UI Roles (Front):** Vista `/settings/roles` (Tabla paginada).
- **[T6.3] Matriz de Permisos (Front):** Implementar componente visual en el modal de rol para seleccionar las acciones (`view`, `create`, `update`, `delete`) por cada recurso disponible.

## Épica 7: Gestión de Usuarios

- **[T7.1] API Usuarios (Back):** Endpoints CRUD paginados de Users (alta por correo, edición de estados booleanos y edición en pivote `user_roles`). Implementar regla que evite quedarse sin un super admin operativo.
- **[T7.2] UI Usuarios (Front):** Vista `/settings/users` (Tabla paginada con filtros).
- **[T7.3] Edición de Usuario (Front):** Modal para alterar `is_allowed`, `is_active` y asignar/remover roles.

## Hechos confirmados
- El trabajo está dividido respetando el orden lógico: Infraestructura -> BD -> Autenticación -> Interfaz transversal -> ABMs de negocio.
- Cada ticket refleja una pieza del PRD V2, ERD y Route Specs.

## Preguntas abiertas
- Ninguna. Documento listo para revisión.

## Épica nueva: Tools → Reservas de alojamiento

- [x] Diagrama27 presentado y aceptado explícitamente el 2026-10-04.
- [x] Incorporar las11 tablas al JSON de Obsidian con respaldo y preservar los objetos anteriores; sincronizar DBML03 y documentación afectada.
- [ ] Revisión/cierre de [contratos 28](28-rental-reservations-contracts.md) y [plan Backend 29](29-rental-reservations-backend-plan.md), preparados para agentes con archivos/dependencias/pruebas.
- [x] Implementar Backend y migración incremental según 29; ensayar FK/checks, concurrencia, replay, revocación y caja en PostgreSQL aislado.
- [x] Preparar [plan Client30](30-rental-reservations-client-plan.md) después del Backend, con revisión de tres subagentes; documento en revisión.
- [x] Implementar RC-01..37/39 de30 con tres carriles e integrador; verificar contratos, componentes, QA y Client→Server→PostgreSQL temporal.
- [ ] RC-38: migraciones/seed/asignación individual y smoke real, con baseline/respaldo según29.

La aceptación del ERD no aprueba otros documentos ni aplica migraciones objetivo. Backend tiene evidencia local; planes/contratos mantienen revisión y despliegue pendiente; no se modifica la BD configurada.

### Reservas — entrega Backend local 2026-10-04

RB-01..RB-34 implementadas y verificadas según [29](29-rental-reservations-backend-plan.md), sin aplicación objetivo. [Client30](30-rental-reservations-client-plan.md) implementado: RC-01..37/39 cerradas localmente, 822 pruebas/144 archivos, typecheck/lint/build y doce capturas de QA. Navegador→API→PostgreSQL temporal verifica directo/Airbnb, caja, cancelación/refund/gastos, recambio mismo día, bloqueos, respuesta perdida y revocación. Próximo paso operacional RC-38. Migración/seed/smoke de entorno real quedan como operación separada documentada, con respaldo e inventario de migraciones pendientes.
