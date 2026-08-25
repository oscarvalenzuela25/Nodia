# Stack Backend — Nodia Parte 1

> Estado: aprobado
> Última actualización: 2026-08-22
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

- **Flujo inicial (Google OAuth2):** El frontend (React) utilizará la librería de Google para obtener un token de identidad (credential JWT de Google). Este token se enviará al endpoint `/api/auth/login` del backend. El backend validará el token de Google, buscará el correo en la base de datos de usuarios (`users`) y verificará que el usuario exista, esté activo (`is_active = true`) y tenga el acceso permitido (`is_allowed = true`).
- **Manejo de Sesión (JWT Propio):** Una vez validado el acceso, el backend generará y firmará un **JWT propio** (JSON Web Token) y lo retornará al frontend.
- **Justificación:** Usar un JWT propio para la sesión en lugar de depender exclusivamente del token de Google abstrae el método de autenticación. Esto preparará el sistema para soportar fácilmente el login tradicional con correo/contraseña en el futuro sin cambiar la arquitectura de sesiones.

## 5. Manejo de Contexto de Autorización (Permisos)

- El backend calculará los permisos efectivos del usuario (uniendo sus roles, recursos y acciones, sin duplicados) en el momento del inicio de sesión (o mediante un endpoint `/api/auth/me`).
- **Guardias en NestJS:** Se implementarán *Guards* de NestJS para proteger los endpoints, validando el JWT propio y verificando si el usuario cuenta con los permisos necesarios (`view`, `create`, `update`, `delete`) sobre los recursos.

## Hechos confirmados

- Stack: NestJS + TypeScript + PostgreSQL + TypeORM.
- Autenticación mediante validación de token de Google y generación de JWT propio de la aplicación.
- Arquitectura stateless para las sesiones (JWT).

## Preguntas abiertas

- Ninguna. Documento listo para revisión.
