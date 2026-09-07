# 🚀 NestJS API Server Template

<p align="center">
  <img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" />
</p>

<p align="center">
  Template base moderno, robusto y listo para producción para construir APIs REST escalables con <b>NestJS 12</b>, <b>ESM puro (NodeNext)</b>, <b>TypeORM</b>, <b>PostgreSQL</b>, <b>Docker</b>, <b>Swagger</b>, <b>Vitest</b> y <b>Oxlint</b>.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-12.0-E0234E?style=flat&logo=nestjs&logoColor=white" alt="NestJS 12" />
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript 6" />
  <img src="https://img.shields.io/badge/ESM-NodeNext-F7DF1E?style=flat&logo=javascript&logoColor=black" alt="ESM NodeNext" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/TypeORM-1.1-FE0803?style=flat&logo=typeorm&logoColor=white" alt="TypeORM" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Vitest-4.1-6E9F18?style=flat&logo=vitest&logoColor=white" alt="Vitest" />
  <img src="https://img.shields.io/badge/Oxlint-Rust_Powered-orange?style=flat" alt="Oxlint" />
</p>

---

## 📖 Descripción General

Este repositorio está diseñado como un **punto de partida profesional** para cualquier servicio o microservicio backend. Viene preconfigurado con las mejores prácticas arquitectónicas de la industria, tipado estricto en TypeScript, contenedorización con Docker, documentación interactiva autogenerada y un sistema de validación y manejo de errores uniforme.

---

## 🛠️ Stack Tecnológico

| Área | Tecnología | Versión | Propósito / Beneficio |
| :--- | :--- | :--- | :--- |
| **Framework** | [NestJS](https://nestjs.com/) | `^12.0.1` | Arquitectura modular escalable e inyección de dependencias. |
| **Lenguaje** | [TypeScript](https://www.typescriptlang.org/) | `^6.0.2` | Tipado estricto con soporte moderno de módulos `NodeNext`. |
| **Módulos** | **ESM Nativo** | `"type": "module"` | Estándar oficial de JavaScript moderno para Node.js. |
| **Base de Datos** | [PostgreSQL](https://www.postgresql.org/) | `16-alpine` | Base de datos relacional de alto rendimiento. |
| **ORM** | [TypeORM](https://typeorm.io/) | `^1.1.1` | Mapeo objeto-relacional con carga automática de entidades. |
| **Contenedores** | [Docker & Compose](https://www.docker.com/) | Compose v2 | Orquestación local de PostgreSQL con healthchecks. |
| **Documentación** | [Swagger / OpenAPI](https://swagger.io/) | `^12.0.1` | Documentación interactiva en `/api/documentation`. |
| **Validación** | `class-validator` / `class-transformer` | `^0.15` / `^0.5` | Validación automática y estricta de DTOs en tiempo de ejecución. |
| **Testing** | [Vitest](https://vitest.dev/) | `^4.1.2` | Pruebas unitarias y e2e ultrarrápidas con Vite y soporte nativo ESM. |
| **Linter & Formato** | [Oxlint](https://oxc.rs/) + [Prettier](https://prettier.io/) | `^1.58` / `^3.4` | Linter en Rust 50-100x más veloz que ESLint tradicional. |
| **IA Assistant** | **Local Skills & `AGENTS.md`** | 6 skills | Guía y directrices operativas para asistentes de IA (Copilot, Gemini, etc.). |

---

## ✨ Características Principales

### 1. Arquitectura ESM Pura (`NodeNext`)
El proyecto está completamente adaptado a módulos ECMAScript nativos (`"type": "module"` en `package.json` y `"moduleResolution": "nodenext"` en `tsconfig.json`). Todas las importaciones relativas locales utilizan la extensión `.js` según la especificación moderna de Node.js.

### 2. Base de Datos Lista con Docker
Incluye un `docker-compose.yml` preconfigurado para levantar PostgreSQL en segundos con healthchecks activos y volúmenes persistentes bajo el prefijo `template_`:
```bash
docker compose up -d
```

### 3. Filtro Global de Excepciones Estandarizado (`AllExceptionsFilter`)
Todas las excepciones de la aplicación (tanto errores HTTP controlados como errores no capturados del servidor o de base de datos) se formatean en una respuesta JSON predecible y amigable para el frontend:
```json
{
  "statusCode": 400,
  "timestamp": "2026-09-04T02:00:00.000Z",
  "path": "/api/v1/auth/login",
  "method": "POST",
  "error": "Bad Request",
  "message": [
    "email must be an email"
  ]
}
```

### 4. Interceptor Global de Logs HTTP (`LoggingInterceptor`)
Mide en tiempo real la duración de cada petición entrante y registra el método, la ruta, el código de estado y la latencia en milisegundos:
```text
[HTTP] [GET] /api/v1 200 +3ms
[HTTP] [POST] /api/v1/users 201 +14ms
```

### 5. Documentación Interactiva OpenAPI (Swagger)
Swagger está configurado y habilitado por defecto en la ruta:
👉 `http://localhost:3000/api/documentation`

### 6. Validación Global de DTOs
Configurado con `ValidationPipe` global:
* `whitelist: true`: Elimina propiedades no deseadas que no estén en el DTO.
* `forbidNonWhitelisted: true`: Arroja error si el cliente envía propiedades desconocidas.
* `transform: true`: Convierte automáticamente los payloads a las instancias de clase DTO correspondientes.

### 7. Integración con Agentes de IA (`AGENTS.md`)
Incluye una matriz de decisión en `AGENTS.md` con **6 habilidades locales** en `skills/`:
* `nestjs-best-practices`: Patrones de módulos, inyección de dependencias y servicios.
* `nodejs-backend-patterns`: Resiliencia, middleware, background jobs y auth.
* `nodejs-best-practices`: Toma de decisiones de alto nivel en Node.js.
* `typescript-advanced-types`: Genéricos, mapped types y tipado avanzado sin `any`.
* `vitest`: Testing unitario y mocks con `vi.fn()`.
* `oxlint`: Verificación y corrección estricta de código en milisegundos.

---

## 📁 Estructura del Proyecto

```text
server-template/
├── .env                     # Variables de entorno locales
├── .env.example             # Plantilla de variables de entorno
├── docker-compose.yml       # Orquestación de PostgreSQL (template_postgres)
├── nest-cli.json            # Configuración de Nest CLI
├── package.json             # Scripts y dependencias del proyecto
├── oxlint.json              # Reglas de linting de alta velocidad
├── tsconfig.json            # Configuración de TypeScript (NodeNext / ESM)
├── vitest.config.ts         # Configuración de Vitest para pruebas unitarias
├── vitest.config.e2e.ts     # Configuración de Vitest para pruebas e2e
├── AGENTS.md                # Directrices y matriz de skills para agentes IA
├── skills/                  # Catálogo de skills locales (Nest, Node, TS, etc.)
│   ├── nestjs-best-practices/
│   ├── nodejs-backend-patterns/
│   ├── nodejs-best-practices/
│   ├── oxlint/
│   ├── typescript-advanced-types/
│   └── vitest/
├── src/
│   ├── common/              # Código transversal y utilidades compartidas
│   │   ├── filters/         # AllExceptionsFilter (manejo global de errores)
│   │   └── interceptors/   # LoggingInterceptor (registro de peticiones HTTP)
│   ├── config/              # Configuraciones de la aplicación
│   │   ├── db.config.ts     # Configuración tipada de TypeORM con PostgreSQL
│   │   └── envs.config.ts   # Carga y parseo seguro de variables con dotenv
│   ├── app.controller.ts    # Controlador raíz de prueba
│   ├── app.module.ts        # Módulo raíz de la aplicación
│   ├── app.service.ts       # Servicio base
│   └── main.ts              # Punto de entrada (bootstrap, CORS, Swagger, Pipes)
└── test/
    └── app.e2e-spec.ts      # Pruebas End-to-End con Vitest y Supertest
```

---

## 🚀 Inicio Rápido

### Prerrequisitos
* **Node.js**: `>= 20.x` (Recomendado Node 22 o superior).
* **Docker y Docker Compose**: Instalado y en ejecución.

### 1. Clonar e Instalar Dependencias
```bash
git clone <url-del-repositorio>
cd server-template
npm install
```

### 2. Configurar Variables de Entorno
Copia el archivo de ejemplo a `.env` (ya viene preconfigurado con valores listos para usar):
```bash
cp .env.example .env
```

Contenido por defecto de `.env`:
```env
PORT=3000

POSTGRES_DB=template_db
POSTGRES_PORT=5432
POSTGRES_HOST=localhost
POSTGRES_USER=template_user
POSTGRES_PASSWORD=template_password
```

### 3. Iniciar la Base de Datos con Docker
```bash
docker compose up -d
```
*(Para detenerla: `docker compose down`)*

### 4. Ejecutar la Aplicación en Modo Desarrollo
```bash
npm run start:dev
```

Una vez iniciada, verás en la consola:
```text
[Bootstrap] 🚀 Application running on: http://localhost:3000/api/v1
[Bootstrap] 📚 Swagger documentation: http://localhost:3000/api/documentation
```

---

## 🧪 Pruebas y Calidad de Código

### Ejecutar Pruebas (Vitest)
```bash
# Pruebas unitarias
npm run test

# Pruebas en modo interactivo / watch
npm run test:watch

# Reporte de cobertura de código
npm run test:cov

# Pruebas End-to-End (e2e)
npm run test:e2e
```

### Linter y Formato
```bash
# Ejecutar Oxlint (ultrarrápido)
npm run lint

# Formatear código con Prettier
npm run format

# Verificar tipos con TypeScript sin emitir archivos
npx tsc --noEmit
```

### Compilación para Producción
```bash
npm run build
npm run start:prod
```

---

## 📝 Convenciones para el Desarrollo

1. **Importaciones relativas:** Recuerda incluir siempre la extensión `.js` en imports locales debido a la resolución `NodeNext` de ESM:
   ```typescript
   import { postgresConfig } from './config/db.config.js'; // ✅ Correcto
   ```
2. **Entidades TypeORM:** Gracias a `autoLoadEntities: true` en `db.config.ts`, cualquier entidad registrada en un módulo mediante `TypeOrmModule.forFeature([MiEntidad])` será descubierta y sincronizada automáticamente sin necesidad de listarla manualmente en el módulo raíz.
3. **Prefijo de API:** Todas las rutas expuestas por la API responderán bajo el prefijo `/api/v1/*`.

---

## 📄 Licencia

Este proyecto está bajo la licencia [UNLICENSED](LICENSE). Puedes adaptarlo y usarlo libremente como base para tus proyectos.
