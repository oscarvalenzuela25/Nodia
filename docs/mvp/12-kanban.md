# Panel Kanban — Nodia Parte 1

> Estado: en revisión
> Última actualización: 2026-08-22
> Dependencias: Documentos 01 al 11 aprobados

## Objetivo

Derivar la especificación técnica en tickets o tareas funcionales trazables, organizados por épicas, para facilitar la implementación secuencial del MVP.

## Épica 1: Infraestructura y Setup

- **[T1.1] Setup Backend:** Inicializar el proyecto NestJS (`nodia-api`), conectar a PostgreSQL y configurar TypeORM.
- **[T1.2] Setup Calidad:** Configurar Husky, lint-staged, Prettier y ESLint para frontend y backend.
- **[T1.3] Setup DevOps:** Crear flujos iniciales de GitHub Actions para CI (lint/tests en pull requests).

## Épica 2: Base de Datos y Seed

- **[T2.1] Entidades TypeORM:** Modelar en código las tablas `users`, `roles`, `modules`, `resources`, `actions`, `role_resource_actions` y `user_roles` (con UUIDs, borrados lógicos `is_active` e índices únicos).
- **[T2.2] Seeder Base:** Crear script/seeder que inyecte el catálogo fijo de acciones (`view`, `create`, `update`, `delete`) y un usuario inicial con el rol `super admin`.

## Épica 3: Autenticación (Core)

- **[T3.1] UI Login (Front):** Implementar `/login` usando `@react-oauth/google`.
- **[T3.2] Endpoint Login (Back):** Crear `POST /api/auth/login`. Valida el token de Google, verifica estado del usuario (`is_allowed`, `is_active`) y genera el JWT propio.
- **[T3.3] Endpoint Perfil (Back):** Crear `GET /api/auth/me`. Retorna el usuario y la matriz calculada y deduplicada de sus permisos.
- **[T3.4] Guards (Back):** Implementar AuthGuard (valida JWT) y PermissionsGuard (valida acción requerida sobre recurso objetivo).
- **[T3.5] Estado Auth (Front):** Configurar store en Zustand para retener la sesión y un interceptor de Axios para inyectar el JWT en las cabeceras.

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
