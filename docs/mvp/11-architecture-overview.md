# Arquitectura Inicial — Nodia Parte 1

> Estado: en revisión — ampliaciones auth, IA y Reservas y cambio de despliegue; aprobación histórica del MVP conservada
> Última actualización: 2026-10-04
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
    UI --> |3. POST /api/v1/auth/login| AuthController
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
- **Despliegue actualizado:** VPS para NestJS. El microservicio Gemini también residirá allí, aislado de Internet y con volumen Docker persistente para la sesión web. Ver [ampliación IA](16-ai-provider-management-handoff.md).
- **Límite de futuros microservicios:** solo Nodia Server los consume mediante red privada y credencial independiente por servicio. Los clientes se autentican y autorizan en NestJS. Ver [ADR-008](../architecture/decisions/ADR-008-internal-microservices-only.md) y la [guía de implementación](../architecture/internal-microservice-security.md). La comprobación operativa del VPS sigue pendiente.

### 2.3. Persistencia (Base de Datos)
- **Motor:** PostgreSQL gestionado externamente; Neon o Northflank por decidir. Redis gestionado externamente y Cloudflare R2 para archivos.
- **Diseño (ERD):** Implementa claves foráneas estrictas, índices únicos compuestos para evitar permisos y roles duplicados, y borrado lógico (`is_active = false`) en las entidades pertinentes. El modelo actual adopta `BIGINT` autoincremental para claves primarias; ver `03-domain-model-erd.md`.

## 3. Flujo Crítico de Autenticación y Autorización

1. **Autenticación Frontend:** El visitante hace click en "Iniciar sesión" y obtiene su token desde Google.
2. **Autenticación Backend:** El frontend manda el token al backend. El backend extrae el email, busca en PostgreSQL (`users.email`), valida `is_active = true`. Si es válido, genera un JWT que contiene el ID de usuario.
3. **Cálculo de Permisos:** Al recuperar el perfil (`/api/auth/me` o en el login), el backend hace un JOIN entre `user_roles`, `role_resource_actions`, `resources` y `actions` para entregarle al frontend la lista plana y deduplicada de permisos del usuario.
4. **Protección de Rutas (UI):** React Router lee los permisos desde `Zustand` para decidir si renderiza un menú, un botón o manda a `404`.
5. **Protección de API:** Los *Guards* de NestJS interceptan cada request de CRUD, decodifican el JWT, y validan en tiempo real contra los permisos cacheados o la BD.

## 4. Estrategia de CI/CD y DevOps

- **Estructura:** Monorepo (`nodia-client`, `nodia-server` y `nodia-gemini-microservice`).
- **Pruebas Locales:** Uso de `Husky` y `lint-staged` para forzar linting y pre-commits locales, garantizando calidad del código antes del *push*.
- **Despliegue Continuo:** Cloudflare Pages conserva la entrega del frontend. El pipeline/rollback de NestJS y microservicio en VPS está pendiente de diseñar y probar.

## Preguntas abiertas

### Ampliación IA y VPS — 2026-09-25

La arquitectura detallada de adaptadores Gemini Web/Gemini API/Mistral, configuración en BD, rotación de keys, navegador remoto y seguridad de secretos se propone en [la especificación para agente](16-ai-provider-management-handoff.md). El diagrama histórico de Parte 1 aún requiere actualización antes de aprobar este documento. No se ha realizado despliegue ni prueba de login remoto en VPS.

### Rate limiting — actualización técnica 2026-09-12

La API registra los guards globales en `AppModule` en orden explícito: rate limit por IP → autenticación JWT/sesión → rate limit por usuario verificado. `@nestjs/throttler` consulta contadores atómicos en Redis mediante una conexión dedicada, independiente de la caché de autorización. Las cuotas por IP agregan solicitudes entre rutas y alias, con una política adicional para login. Las cuotas por usuario se comparten entre tokens, sesiones e IPs y solo consumen una identidad validada. Los rechazos devuelven `429`/`Retry-After` y los fallos de Redis `503`. El cliente conserva la traducción de esos errores mediante Axios. Véase [ADR-003](../architecture/decisions/ADR-003-api-rate-limiting.md).

La configuración del Redis y del proxy del entorno desplegado está pendiente de verificación operativa. El rate limit no implementa ni sustituye autenticación o permisos.

### Decisiones originales del MVP
- Ninguna. Documento consolidado.

## Ampliación auth — 2026-09-12

El JWT propio dura quince minutos y se persiste en Zustand. La renovación usa un refresh JWT en cookie HttpOnly y `auth_sessions` en PostgreSQL, con transacción, rotación, replay y revocación. El guard consulta sesión/usuario además de validar el JWT. Por tanto, la sesión ya no es enteramente stateless. Los permisos se obtienen mediante `/api/v1/authorization/context` con la identidad autenticada; se eliminó el correo fijo de desarrollo. Detalles y límites: [ADR-004](../architecture/decisions/ADR-004-auth-sessions.md).

Antes de iniciar consultas de datos, el cliente requiere una sesión validada con JWT vigente. La persistencia es una pista de recuperación: una recarga comprueba `/auth/me` o renueva el JWT, y solo después habilita TanStack Query. Axios aplica la misma restricción en el transporte. El guard global protege todos los controladores salvo métodos marcados explícitamente `@Public()`; la comprobación definitiva de identidad y sesión siempre pertenece al servidor.

En el cliente, `config/api.ts` compone el transporte de `axiosInstance.ts` con el gestor de `authSession.ts`, al que inyecta el cliente HTTP. Los servicios consumen esa API configurada. La lógica de sesión queda fuera de la fábrica Axios y todas las instancias derivadas coordinan el refresh mediante el mismo gestor, sin imports circulares.

La navegación distingue `GuardStrict` para `/settings/*` (sesión validada y módulo asignado al destino) de `Guard` para rutas públicas que permiten demo sin consultas remotas. El menú usa las mismas asignaciones; escribir una URL no evita el guard. `NoGuard` queda reservado a login. Este control de interfaz no reemplaza la autorización fina por acciones del backend.

## Reservas de alojamiento — ampliación 2026-10-04

Dominio vertical dentro de Nodia Server, NestJS/TypeORM/PostgreSQL. Casa es el ámbito compartido por propietario y colaboradores; independencia de Business, Finanzas personales y proveedores IA. No requiere otro servicio ni integración de pagos externos. [ERD 27](27-rental-reservations-erd.md) aceptado, [ADR-012](../architecture/decisions/ADR-012-rental-property-collaboration.md) y [ADR-013](../architecture/decisions/ADR-013-rental-integrity-and-idempotency.md) conservan revisión técnica.

Controladores delgados, DTOs estrictos y casos de uso con acceso/autoría derivados de sesión. Escrituras transaccionales con protocolo común de lock casa → reserva cuando corresponda; acceso se revalida tras lock, incluyendo revocación. Efecto, auditoría append-only y respuesta idempotente se confirman con el mismo EntityManager. Consultas acotadas/paginadas y agregados por conjuntos, sin N+1 por reserva. Relaciones compuestas impiden asociar datos de otra casa; no sustituyen control de acceso.

[Contratos28](28-rental-reservations-contracts.md), [plan Backend 29](29-rental-reservations-backend-plan.md) y [plan Client30](30-rental-reservations-client-plan.md) fijan endpoints, responsables, dependencias y pruebas. Migración incremental con synchronize deshabilitado en ensayos aislados; no conectar nuevas entidades a la BD del usuario durante planificación. Client30 implementa caché por sesión/casa, ack/GET, UUIDv4 y recuperación, feedback único y tres carriles tras base común. Contratos runtime y allowlists de listas; sin escrituras optimistas ni reenvío automático de mutaciones. Renovación401 conserva UUID/body con transporte común. Ruta estricta y pertenencia por casa son controles distintos.

### Implementación local de Reservas — 2026-10-04

Server compone recursos verticales rental dentro de AppModule y centraliza transacciones/locks/idempotencia en rental-common. Controladores delgados y casos de uso tipados; dependencias compartidas no importan módulos Nest de recurso. Se desactiva synchronize en runtime para todos los entornos; esquema mediante migraciones explícitas, baseline histórico necesario. PostgreSQL aislado verifica las garantías de [29](29-rental-reservations-backend-plan.md); Client implementado: 822 pruebas/144 archivos, typecheck/lint/build y navegador→API→PostgreSQL temporal. BD configurada y smoke real pendientes RC-38; intenciones en memoria sin persistencia de PII. Solo ERD27 aprobado; desarrollo no aprueba documentos.
