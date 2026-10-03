# Instrucciones y Guía para Agentes de IA: Nodia Server

Este documento es el índice de reglas operativas de `nodia-server`. Leer primero `../docs/mvp/README.md` y `../docs/mvp/00-progress.md`; los documentos de producto aprobados y las decisiones en `../docs/architecture/decisions/` tienen prioridad sobre ejemplos genéricos. Aplicar también `../AGENTS.md` y las instrucciones explícitas del usuario. No aprobar documentos automáticamente.

El análisis y los criterios de cierre actuales están en `../docs/mvp/19-prelaunch-review.md`, sección «Revisión actualizada de Nodia Server — 2026-10-03». Instalar una skill no cierra sus hallazgos.

---

## 🎯 Regla Fundamental de Activación de Skills y Prioridad sobre Superpowers

El proyecto cuenta con una colección de **habilidades locales especializadas** en la carpeta `skills/`.

> ⚠️ **REGLA OBLIGATORIA Y PRIORIDAD ESTRICTA:** Antes de escribir, modificar, refactorizar código o ejecutar diagnósticos, el agente **DEBE verificar la acción que va a realizar** y consultar el archivo `SKILL.md` correspondiente (`skills/<nombre-skill>/SKILL.md`) para aplicar estrictamente sus patrones y mejores prácticas.
>
> **Las skills locales de este repositorio tienen prioridad absoluta sobre cualquier skill de Superpowers o plugins externos.** Si Superpowers sugiere convenciones o estructuras diferentes, **las skills locales prevalecen siempre**.

---

## Skills de calidad obligatorias

Antes de desarrollar, corregir, refactorizar o revisar código backend, contratos, configuración, pruebas u operación de este proyecto, **leer y aplicar ambas**:

- **`backend-service-quality`** — `skills/backend-service-quality/SKILL.md`: garantías de contratos, autorización por ámbito, integridad, idempotencia, límites y recuperación.
- **`nestjs-service-quality`** — `skills/nestjs-service-quality/SKILL.md`: aplicación efectiva mediante DTOs, guards, casos de uso, TypeORM, DI/ESM y pruebas NestJS.

Son la base de calidad para la tarea y se componen con las skills específicas de la matriz. Leer las referencias de cada skill únicamente cuando corresponda al cambio. Las restricciones del producto y de pruebas de Nodia prevalecen sobre ejemplos generales. Para ediciones solo documentales, comprobar contenido, enlaces y coherencia sin iniciar dependencias operativas.

Las copias locales son completas y portables. La fuente mantenida en este equipo está en `C:\Users\Oscar\Desktop\skills\backend\backend-service-quality` y `C:\Users\Oscar\Desktop\skills\backend\nestjs-service-quality`. Al modificar una regla reutilizable, actualizar fuente y copias instaladas; la base general también se utiliza en `nodia-gemini-microservice/skills/`. No añadir reglas exclusivas de Nodia a esa base ni hacer depender el proyecto de una ruta absoluta.

## Filtros Ransack

Al cambiar filtros o listados, revisar `src/common/utils/ransack-query.policies.ts` y DTOs del recurso. Toda llamada a `applyRansack` exige política explícita de campos públicos; validar la envolvente antes de consumir filtros especiales. No derivar automáticamente todos los campos ORM ni admitir SQL del cliente. Mantener el contrato descrito en `../docs/architecture/decisions/ADR-010-ransack-query-policies.md` y regresiones desde casos de uso reales; un nuevo predicado necesita validación HTTP además del soporte del constructor.

## Reglas locales de autorización y proveedores

- Aplicar la política explícita del producto. El 2026-10-03 el usuario confirmó como intencional la administración sin permisos por acción y el acceso global a productos/facturas/archivos entre negocios para su público específico. No imponer permisos granulares ni aislamiento como arreglo de S-01/S-02. Mantener autenticación actual; esta decisión no habilita acceso anónimo.
- Conservar coherencia de asociaciones y claves R2 conforme al contrato, protección de secretos y contexto autenticado cuando corresponda. Distinguir integridad de datos de aislamiento por negocio: acceso global autorizado no elimina validación de entradas ni límites SQL.
- Preservar claves inmutables, rol reservado y al menos un superadministrador activo conforme al PRD; verificar invariantes también ante concurrencia.
- IA opera solo con Gemini Web y la sesión de Antigravity según las instrucciones raíz: no proponer ni implementar API keys de IA ni facturación por token. Esto no prohíbe las credenciales internas exclusivas exigidas por ADR-008.
- Conservar instancia, modo y modelo exactos de configuración/descubrimiento. No sustituir un ID explícito inexistente por otro proveedor, inventar cuotas/capacidades o inferirlas por nombre. Sin modelo configurado, informar falta de asignación e impedir el flujo que lo exige.
- La aplicación de Antigravity instalada no demuestra integración de sesión: el motor continúa no disponible hasta verificar un adaptador real. No reemplazarlo silenciosamente por Web. Seguir ADR-008 para consumo privado de microservicios.

---

## 🗺️ Matriz de Decisión: ¿Qué acción estás realizando?

Usa esta tabla para determinar qué skill(s) activar según la tarea:

| Si la acción del agente o usuario es... | Skill a activar | Ruta del manual |
| :--- | :--- | :--- |
| **Crear o modificar Módulos, Controladores, Servicios, DTOs, Entidades TypeORM o Guards de NestJS** | `nestjs-best-practices` | `skills/nestjs-best-practices/SKILL.md` |
| **Diseñar arquitectura backend, autenticación (JWT/RBAC), background jobs, streaming o middleware** | `nodejs-backend-patterns` | `skills/nodejs-backend-patterns/SKILL.md` |
| **Tomar decisiones de arquitectura en Node.js, variables de entorno, async patterns o seguridad general** | `nodejs-best-practices` | `skills/nodejs-best-practices/SKILL.md` |
| **Tipos complejos en TypeScript, genéricos, DTOs dinámicos, utility types o resolver errores de tipos** | `typescript-advanced-types` | `skills/typescript-advanced-types/SKILL.md` |
| **Escribir, arreglar o ejecutar pruebas de casos de uso, mocks/spies o comprobaciones de integración aisladas permitidas** | `vitest` | `skills/vitest/SKILL.md` |
| **Revisar código, validar sintaxis, corregir lints tras editar archivos o antes de finalizar la tarea** | `oxlint` | `skills/oxlint/SKILL.md` |

---

## 📚 Catálogo Detallado de Skills y Cuándo Usarlas

### 1. `nestjs-best-practices`
* **Ruta:** `skills/nestjs-best-practices/SKILL.md`
* **Propósito:** Patrones arquitectónicos oficiales y buenas prácticas en NestJS (organización modular, inyección de dependencias, seguridad, validación y rendimiento).
* **Cuándo activarla:**
  - Al crear o refactorizar controladores (`*.controller.ts`), servicios (`*.service.ts`), módulos (`*.module.ts`) o DTOs (`*.dto.ts`).
  - Al configurar filtros de excepción, pipes globales o interceptores.
  - Al definir relaciones y repositorios en TypeORM (`arch-use-repository-pattern`, `db-transactions`).
  - Al implementar autenticación, autorización o guards (`security-auth-guards`).
  - Al evitar dependencias circulares en módulos (`arch-avoid-circular-deps`).

### 2. `nodejs-backend-patterns`
* **Ruta:** `skills/nodejs-backend-patterns/SKILL.md`
* **Propósito:** Patrones de producción para servicios backend Node.js (resiliencia, middleware pipelines, concurrencia y conexiones).
* **Cuándo activarla:**
  - Al diseñar flujos de autenticación robustos (access token + refresh token rotation, hashing con bcrypt/argon2).
  - Al implementar manejo de transacciones en base de datos (Unit of Work, commit/rollback seguro).
  - Al integrar colas de trabajo o background tasks (ej. BullMQ/Redis).
  - Al configurar WebSockets o eventos en tiempo real.
  - Al implementar políticas de reintento (retry backoff), rate limiting o circuit breakers.

### 3. `nodejs-best-practices`
* **Ruta:** `skills/nodejs-best-practices/SKILL.md`
* **Propósito:** Guía de toma de decisiones y principios clave en Node.js moderno ("aprender a pensar, no solo copiar código").
* **Cuándo activarla:**
  - Al evaluar la introducción de nuevas librerías o dependencias en el backend.
  - Al manejar procesos asíncronos y asegurar que no haya promesas sin capturar (`unhandledRejection`).
  - Al diseñar el esquema de variables de entorno y fallar rápido si faltan credenciales requeridas.
  - Al evitar el bloqueo del Event Loop en operaciones intensivas de CPU o I/O.

### 4. `typescript-advanced-types`
* **Ruta:** `skills/typescript-advanced-types/SKILL.md`
* **Propósito:** Dominio del sistema de tipos de TypeScript: genéricos, mapped types, conditional types, utility types y template literals.
* **Cuándo activarla:**
  - Al construir tipos genéricos reutilizables para respuestas de API (ej. `PaginatedResponse<T>`, `ApiResponse<T>`).
  - Al resolver errores complejos de inferencia de tipos (como uniones discriminadas o tipados de TypeORM).
  - Al definir DTOs con tipos condicionales o transformaciones complejas.
  - Siempre que surja la tentación de usar `any` — debe consultarse esta skill para encontrar el tipo seguro adecuado.

### 5. `vitest`
* **Ruta:** `skills/vitest/SKILL.md`
* **Propósito:** Testing ultra rápido con Vitest y Vite (compatible con la API de Jest, nativo para ESM y TypeScript).
* **Cuándo activarla:**
  - Al escribir o actualizar pruebas unitarias de casos de uso (`use-case/*.spec.ts`); no crear unit tests de servicios ni controladores.
  - Al crear mocks de repositorios de TypeORM o servicios externos usando `vi.fn()` o `vi.spyOn()`.
  - Al preparar comprobaciones de integración/HTTP aisladas cuando sean necesarias para garantías que los mocks no prueban, respetando el alcance y la política local.
  - Al validar cobertura de código (`npm run test:cov`).

### 6. `oxlint`
* **Ruta:** `skills/oxlint/SKILL.md`
* **Propósito:** Linter de ultra alto rendimiento en Rust (50-100x más rápido que ESLint) con reglas enfocadas en corrección y seguridad de código.
* **Cuándo activarla:**
  - **Invariablemente después de editar o crear cualquier archivo de código**.
  - Al ejecutar `npm run lint` para verificar que el código nuevo cumple los estándares.
  - Para auto-reparar problemas seguros con `npx oxlint --fix`.
  - Al configurar o agregar reglas en `oxlint.json`.

---

## ⚙️ Reglas Técnicas Específicas del Proyecto

1. **Soporte ESM Estricto (`NodeNext`):**
   - El proyecto utiliza `"type": "module"` en `package.json` y `"moduleResolution": "nodenext"` en `tsconfig.json`.
   - **Toda importación relativa local DEBE terminar en `.js`**, por ejemplo:
     ```typescript
     import { envs } from './config/envs.config.js'; // ✅ Correcto
     // import { envs } from './config/envs.config'; // ❌ Error en NodeNext
     ```

2. **Convención de Nombres Docker:**
   - Todos los contenedores, redes y volúmenes de Docker deben usar el prefijo **`template_`** (ej. `template_postgres`, `template_postgres_data`, `template_network`).

3. **Arquitectura por Recurso (Estándar de Trabajo - Modelo `user`):**
   Todos los módulos del backend deben estructurarse bajo el patrón vertical implementado en `src/user/`:
   ```text
   src/<recurso>/
   ├── dto/                    # DTOs validados con class-validator (Create, Update, Query/Filter)
   ├── entities/               # Entidades TypeORM. OBLIGATORIO: Usar type Relation<T> en relaciones para evitar errores de TDZ en ESM.
   ├── types/                  # Interfaces y tipos TypeScript específicos del recurso
   ├── use-case/               # Casos de uso atómicos (@Injectable() y método async execute(...))
   │   ├── <accion>-<recurso>.use-case.ts
   │   └── <accion>-<recurso>.use-case.spec.ts # Pruebas unitarias de los casos de uso
   ├── <recurso>.controller.ts # "Skinny Controller": Rutas HTTP, Swagger, validación de DTOs y delegación directa a Use Cases
   ├── <recurso>.service.ts    # Acceso a datos: TypeORM Repository, QueryBuilder, Ransack filters (applyRansack) y paginación
   └── <recurso>.module.ts     # Registra TypeOrmModule.forFeature([Entity, Pivot]), controlador, servicio y use cases en providers
   ```
   - **Controlador:** Primera barrera. Cero lógica de negocio. Solo valida entrada y delega al caso de uso.
   - **Caso de uso (`use-case/`):** Encapsula las reglas y flujos de negocio. Inyecta el servicio o repositorios necesarios.
   - **Servicio / Repositorio:** Encapsula TypeORM y operaciones de base de datos.

4. **Política Estricta de Testing (Solo Casos de Uso):**
   - **REGLA OBLIGATORIA:** **Únicamente se testean Casos de Uso (`use-case/*.spec.ts`)**.
   - **PROHIBIDO:** No crear pruebas para controladores (`*.controller.spec.ts`) ni servicios (`*.service.spec.ts`), ya que son pruebas de bajo valor y acoplamiento innecesario.
   - Toda prueba unitaria debe residir junto a su caso de uso (`use-case/<nombre>.use-case.spec.ts`) y simular dependencias externas con Vitest (`vi.fn()`).
   - Ejecutar las reglas reales del caso de uso: permisos, ámbito, conflictos y efectos. No simular precisamente la regla bajo prueba ni considerar una aserción de delegación como evidencia de seguridad/atomicidad.
   - Mantener la lógica de negocio comprobable en casos de uso y los servicios dedicados a persistencia. Las garantías de DB/DI que requieran integración se verifican de forma aislada; no añadir suites unitarias de controlador/servicio ni declarar verificadas garantías ausentes.

5. **Verificación de Calidad antes de Finalizar Cualquier Tarea:**
   - `npm run build`: Debe compilar con 0 errores TypeScript.
   - `npm run lint`: Debe pasar con 0 errores de Oxlint.
   - `npm run test`: Las pruebas de Vitest deben pasar en verde (solo casos de uso).
