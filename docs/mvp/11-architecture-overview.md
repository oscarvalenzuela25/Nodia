# Arquitectura Inicial — Nodia Parte 1

> Estado: en revisión
> Última actualización: 2026-08-22
> Dependencias: Documentos 01 al 10 aprobados.

## Objetivo

Proveer una visión unificada de cómo interactúan los distintos componentes tecnológicos y lógicos del sistema (Frontend, Backend, Base de Datos y despliegue) basándose en las definiciones acordadas previamente.

## 1. Diagrama de Alto Nivel

```mermaid
flowchart TD
    subgraph Cliente [Frontend - React / Vite]
        UI[Componentes MUI]
        AuthStore[Zustand - Auth]
        Router[React Router]
        ReactQuery[TanStack Query]
    end

    subgraph Auth_Externo [Proveedores de Identidad]
        Google[Google OAuth2]
    end

    subgraph Nube_Backend [Backend - NestJS]
        AuthController[Auth Controller]
        ModulesController[Modules / Users / Roles Controllers]
        AuthGuard[Guards de Autorización]
        ORM[TypeORM]
    end

    subgraph Base_Datos [Persistencia]
        PG[(PostgreSQL)]
    end

    %% Relaciones
    UI --> |1. Login via React OAuth2| Google
    Google --> |2. Retorna Credencial JWT| UI
    UI --> |3. POST /api/auth/login| AuthController
    AuthController --> |4. Verifica y crea JWT Propio| UI
    ReactQuery --> |Peticiones autenticadas (JWT)| ModulesController
    ModulesController --> AuthGuard
    AuthGuard --> ORM
    ORM <--> PG
```

## 2. Componentes del Sistema

### 2.1. Frontend (Nodia Client)
- **Tecnologías:** React 19, Vite, TypeScript, Material UI (MUI), Zustand, TanStack Query, React Router v8.
- **Responsabilidades:**
  - Gestionar el inicio de sesión OAuth2 directo con Google.
  - Almacenar el JWT de sesión en el estado global (o cookie).
  - Proveer la interfaz de usuario `Full Responsive` soportando temas Claro/Oscuro.
  - Manejar las validaciones iniciales de rutas para bloquear vistas a las que el usuario no tiene permiso.
- **Despliegue:** Cloudflare Pages (Distribución global, CDN, build rápido).

### 2.2. Backend (Nodia API)
- **Tecnologías:** Node.js, NestJS, TypeScript, TypeORM.
- **Responsabilidades:**
  - Recibir la credencial de Google, validar el correo normalizado y comprobar si el usuario está activo y permitido en la BD.
  - Generar un JWT propio para el manejo de sesiones *stateless*.
  - Exponer endpoints RESTful para la gestión administrativa de Usuarios, Roles, Recursos y Módulos.
  - Interceptar peticiones mediante `Guards` para validar que el usuario tenga los permisos exactos (`view`, `create`, `update`, `delete`) sobre el recurso objetivo.
- **Despliegue:** Northflank (PaaS, contenedorizado/orquestado por el proveedor).

### 2.3. Persistencia (Base de Datos)
- **Motor:** PostgreSQL (alojado en Northflank como Addon/Servicio).
- **Diseño (ERD):** Implementa claves foráneas estrictas, índices únicos compuestos para evitar permisos y roles duplicados, y borrado lógico (`is_active = false`) universal en todas las tablas y tablas pivote. Usa `UUIDs` nativos.

## 3. Flujo Crítico de Autenticación y Autorización

1. **Autenticación Frontend:** El visitante hace click en "Iniciar sesión" y obtiene su token desde Google.
2. **Autenticación Backend:** El frontend manda el token al backend. El backend extrae el email, busca en PostgreSQL (`users.email`), valida `is_allowed = true` y `is_active = true`. Si es válido, genera un JWT que contiene el ID de usuario.
3. **Cálculo de Permisos:** Al recuperar el perfil (`/api/auth/me` o en el login), el backend hace un JOIN entre `user_roles`, `role_resource_actions`, `resources` y `actions` para entregarle al frontend la lista plana y deduplicada de permisos del usuario.
4. **Protección de Rutas (UI):** React Router lee los permisos desde `Zustand` para decidir si renderiza un menú, un botón o manda a `404`.
5. **Protección de API:** Los *Guards* de NestJS interceptan cada request de CRUD, decodifican el JWT, y validan en tiempo real contra los permisos cacheados o la BD.

## 4. Estrategia de CI/CD y DevOps

- **Estructura:** Monorepo (`nodia-client` y `nodia-api`).
- **Pruebas Locales:** Uso de `Husky` y `lint-staged` para forzar linting y pre-commits locales, garantizando calidad del código antes del *push*.
- **Despliegue Continuo:** GitHub Actions (y las integraciones nativas de Cloudflare/Northflank) detectan cambios en las carpetas respectivas y redespliegan el Frontend y el Backend por separado, de manera automática.

## Preguntas abiertas
- Ninguna. Documento consolidado.
