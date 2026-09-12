# Stack DevOps — Nodia Parte 1

> Estado: en revisión — ampliación auth 2026-09-12; aprobación histórica del MVP conservada
> Última actualización: 2026-09-12
> Dependencias: 08-stack-frontend.md y 09-stack-backend.md aprobados

## Objetivo

Definir la estructura del repositorio, la infraestructura de despliegue, y las herramientas de integración y entrega continua (CI/CD) para el MVP de Nodia.

## 1. Estructura del Repositorio

- **Estrategia:** Monorepo (repositorio único).
- **Justificación:** Mantiene todo el código relacionado de la Parte 1 centralizado.
- **Estructura base:**
  ```text
  Nodia/
  ├── nodia-client/   # Frontend (React + Vite)
  └── nodia-api/      # Backend (NestJS)
  ```
- **Despliegues aislados:** Aunque comparten repositorio, el frontend y el backend se desplegarán de forma independiente basados en los cambios de sus respectivas carpetas.

## 2. Infraestructura y Hosting

### Frontend
- **Proveedor:** **Cloudflare Pages**.
- **Justificación:** Excelente capa gratuita para MVPs, distribución global (CDN rápida), integraciones nativas con repositorios y tiempos de compilación muy rápidos para proyectos Vite/React.

### Backend y Base de Datos
- **Proveedor:** **Northflank**.
- **Servicios:**
  1. Un servicio para la API de **NestJS** (conectado directamente a GitHub).
  2. Un addon/servicio para la base de datos **PostgreSQL**.
- **Justificación:** Northflank provee una experiencia PaaS moderna, sencilla y con capa gratuita/barata para MVPs, permitiendo conectar la API y la BD fácilmente en el mismo clúster.

## 3. Contenedores (Docker)

- **Decisión:** Excluido para el MVP.
- **Justificación:** Dado que Cloudflare Pages y Northflank resuelven el entorno de ejecución conectándose al repositorio (buildpacks nativos o Node.js runtime), no se invertirá esfuerzo en configuración de Docker o Docker Compose en esta etapa temprana.

## 4. Integración y Entrega Continua (CI/CD)

### GitHub Actions (Automatización de Despliegues)
- Se configurarán pipelines para despliegue automático hacia Cloudflare Pages (cuando detecte cambios en `nodia-client`) y Northflank (mediante su integración de repositorio o webhook al detectar cambios en `nodia-api`).

### Pre-commit Hooks (Calidad Local)
- **Herramienta:** `Husky` + `lint-staged`.
- **Estrategia:** El linting, formateo de código (Prettier/ESLint) y la ejecución de tests unitarios básicos se forzarán en local antes de permitir un commit. Así se asegura que el código que sube al repositorio ya cumple los estándares, evitando gastar minutos de CI en GitHub Actions por errores de sintaxis.

## Hechos confirmados

- Monorepo con carpetas separadas para front y back.
- Frontend alojado en Cloudflare Pages.
- Backend y PostgreSQL alojados en Northflank.
- Despliegue automático vía GitHub Actions.
- Control de calidad local (lint/test) mediante pre-commit hooks (Husky).
- Docker excluido temporalmente.

## Preguntas abiertas

### Requisitos de despliegue del rate limit — 2026-09-12

La implementación de [ADR-003](../architecture/decisions/ADR-003-api-rate-limiting.md) usa Redis compartido en entornos desplegados. Sigue pendiente confirmar/provisionar ese servicio en Northflank, sus permisos de scripts y su política de memoria/evicción. No se ha desplegado ni contratado infraestructura como parte de esta entrega.

Configurar conexión Redis, prefijo por entorno y `TRUST_PROXY` con los IPs/CIDRs reales del ingreso. Su valor vacío confía solo en la conexión directa. Verificar identificación del cliente a través de la ruta pública y calibrar cuotas en staging. Una caída de Redis produce `503` en endpoints protegidos; memoria se admite exclusivamente en desarrollo/test.

Tras integrar auth, configurar también `RATE_LIMIT_LOGIN_*`, `RATE_LIMIT_USER_*` y `RATE_LIMIT_USER_WRITES_*` de forma uniforme entre réplicas. Defaults: login 10 intentos/minuto por IP; usuario verificado 300 solicitudes/minuto y 30 escrituras/minuto, adicionales a los límites por IP existentes. TTL y bloqueo se expresan en milisegundos. No requiere migración de base de datos ni nuevas dependencias; las claves de estas políticas son independientes de las cuotas por IP.

### Decisiones originales del MVP

- Ninguna. Documento listo para revisión.

## Operación auth — 2026-09-12

Se requieren `GOOGLE_CLIENT_ID`, `AUTH_JWT_SECRET`, `AUTH_ALLOWED_ORIGINS` y configuración SameSite/Secure. CORS usa orígenes concretos con credenciales. Producción requiere HTTPS y migración de auth sobre el esquema existente; `synchronize` se desactiva en producción. Preferir frontend/API bajo el mismo sitio para evitar cookies de terceros. Ver [14-authentication.md](14-authentication.md).
