# Stack Backend — Nodia Parte 1

> Estado: en revisión — ampliación auth 2026-09-12; aprobación histórica del MVP conservada
> Última actualización: 2026-09-12
> Dependencias: 03-domain-model-erd.md, 04-prd-v2.md y 06-route-specs.md aprobados

## Objetivo

Definir el lenguaje, framework, base de datos, ORM y estrategia de autenticación del backend de Nodia para garantizar coherencia con el modelo de dominio y las necesidades del frontend.

## 1. Ecosistema y Lenguaje

- **Lenguaje:** TypeScript (Node.js).
- **Justificación:** Mantiene un ecosistema unificado con el frontend (`nodia-client`), permitiendo compartir interfaces, tipos (tipado fuerte end-to-end) y conocimientos entre ambas capas.

## 2. Framework Web

- **Herramienta:** **NestJS**.
- **Justificación:** Provee una arquitectura robusta, escalable y fuertemente opinada (basada en módulos, controladores y servicios), ideal para aplicaciones empresariales y backoffices. Facilita la inyección de dependencias y el testing.

## 3. Base de Datos y ORM

- **Motor de Base de Datos:** **PostgreSQL**.
- **Justificación:** Soporte nativo y eficiente para `uuid`, integridad referencial robusta y funciones JSONB que podrían ser útiles a futuro. Coincide perfectamente con el diseño del ERD.
- **ORM:** **TypeORM**.
- **Justificación:** Integración oficial de primera clase con NestJS (`@nestjs/typeorm`). Permite definir entidades mediante decoradores y usar migraciones de base de datos de manera controlada.

## 4. Estrategia de Autenticación y Sesión

- **Flujo inicial (Google):** `GoogleLogin` entrega un ID token que se envía con `provider: "google"` a `POST /api/v1/auth/login`. Se valida mediante `google-auth-library`, se busca el correo normalizado y se exige un usuario precreado activo. Se vincula `users.google_sub`; Google solo completa nombre/imagen vacíos.
- **Sesión propia:** `@nestjs/jwt` emite un access JWT de quince minutos, persistido en el store de Zustand, y un refresh JWT rotativo de siete días en cookie HttpOnly. `auth_sessions` almacena únicamente el hash del refresh y permite revocación inmediata.
- **Renovación y logout:** `/api/v1/auth/refresh` rota dentro de una transacción; replay revoca la sesión. `/api/v1/auth/logout` revoca y borra cookie. El guard comprueba JWT, sesión y usuario activo en cada petición.
- **Proveedores futuros:** la verificación Google está separada de `CreateSessionUseCase`; password u otros proveedores podrán emitir la misma sesión. No se implementan contraseñas en esta entrega.
- **Especificación y operación:** [Guía auth](14-authentication.md), [ADR-004](../architecture/decisions/ADR-004-auth-sessions.md).

## 5. Manejo de Contexto de Autorización (Permisos)

- El backend calculará los permisos efectivos del usuario (uniendo sus roles, recursos y acciones, sin duplicados) en el momento del inicio de sesión (o mediante un endpoint `/api/auth/me`).
- **Guardias en NestJS:** Se implementarán *Guards* de NestJS para proteger los endpoints, validando el JWT propio y verificando si el usuario cuenta con los permisos necesarios (`view`, `create`, `update`, `delete`) sobre los recursos.

## Hechos confirmados

### Rate limiting — actualización técnica 2026-09-12

- Se implementa `@nestjs/throttler` con almacenamiento Redis, conforme a la opción A aprobada en [ADR-003](../architecture/decisions/ADR-003-api-rate-limiting.md).
- Guards globales en orden explícito: cuotas por IP → validación JWT/sesión → cuotas por usuario. La IP limita ráfagas, tráfico general, escrituras y login (10 intentos/minuto). El usuario verificado dispone de cuotas iniciales de 300 solicitudes/minuto y 30 escrituras/minuto, compartidas entre sesiones e IPs; se mantienen también los límites de red.
- Contadores Redis atómicos; `429` con `Retry-After` al exceder cuota y `503` si el almacenamiento no está disponible. Configuración operativa y validación detalladas en el ADR.
- NestJS 12 se conserva. Dos overrides limitados a las versiones fijadas de throttler y su adaptador resuelven los peers publicados; deben retirarse al existir releases compatibles.

### Stack base

- Stack: NestJS + TypeScript + PostgreSQL + TypeORM.
- Autenticación mediante validación de token de Google y generación de JWT propio de la aplicación.
- JWT propio con estado de sesión en PostgreSQL para renovación/revocación; reemplaza la propuesta inicial enteramente stateless.

## Preguntas abiertas

- Ninguna. Documento listo para revisión.
