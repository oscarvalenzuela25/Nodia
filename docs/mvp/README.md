# Especificación del MVP — Nodia

Esta carpeta contiene la definición del producto previa al desarrollo. Debe permitir que una persona o agente retome el proyecto sin depender de conversaciones anteriores.

## Cómo continuar

1. Leer `00-progress.md`.
2. Abrir el primer documento pendiente, en progreso o bloqueado.
3. Leer sus dependencias aprobadas.
4. Completar preguntas y registrar las respuestas dentro del documento.
5. Solicitar aprobación antes de marcarlo como completado.
6. Al cambiar una decisión previa, revisar los documentos posteriores afectados.

## Orden de documentos

| Paso | Documento | Propósito |
|---:|---|---|
| 1 | `01-interview.md` | Comprender contexto, problema, actores y resultado esperado |
| 2 | `02-prd-v1.md` | Definir funcionalmente la primera versión |
| 3 | `03-domain-model-erd.md` | Modelar datos y relaciones preliminares |
| 4 | `04-prd-v2.md` | Reconciliar producto y modelo de dominio |
| 5 | `05-sitemap.md` | Definir las rutas mínimas del MVP |
| 6 | `06-route-specs.md` | Especificar comportamiento por ruta |
| 7 | `07-design-constraints.md` | Registrar restricciones y sistema visual |
| 8 | `08-stack-frontend.md` | Definir herramientas de frontend aplicables |
| 9 | `09-stack-backend.md` | Definir herramientas de backend aplicables |
| 10 | `10-stack-devops.md` | Definir operación, entornos y despliegue |
| 11 | `11-architecture-overview.md` | Unificar componentes y decisiones técnicas |
| 12 | `12-kanban.md` | Derivar tickets trazables para implementación |
| 13 | `13-readiness-review.md` | Verificar si el MVP está listo para programarse |
| 14 | `14-authentication.md` | Implementación, configuración y operación de la autenticación |

## Ampliación previa a producción en revisión

| Documento | Propósito |
|---|---|
| `15-ai-providers-interview.md` | Entrevista y decisiones confirmadas sobre gestión global de IA |
| `16-ai-provider-management-handoff.md` | Especificación de entrega para un agente implementador |
| `17-security-hardening-plan.md` | Plan por etapas para asegurar Nodia API, Gemini y su despliegue |
| `18-security-deployment-runbook.md` | Secuencia y pruebas de despliegue seguro, migración y reversión |
| `19-prelaunch-review.md` | Revisión de Client, Server y Gemini; riesgos y plan de corrección previo al lanzamiento |
| [Contrato de funcionalidades IA](ai-provider-feature-contract.md) | Esquema vigente, switches, claves, cuotas, thinking y matriz de regresiones que debe conservarse |
| [32-agentic-cli-implementation-plan.md](32-agentic-cli-implementation-plan.md) | Reemplazo agéntico mediante CLI oficial: doce pasos, rutas, contratos estables, autenticación operativa y aceptación con documentos reales; plan en revisión, AG-01 pendiente |

## Integraciones pendientes de retomar

Funcionalidad añadida por solicitud del usuario: [Autenticación Gemini Agentic desde Ajustes IA](../features/ai-providers/gemini-agentic-authentication.md). Login remoto con enlace/código del CLI del servidor, independiente de Web; contratos, límites, pruebas y pendientes del VPS en esa sección. Decisión [ADR-017](../architecture/decisions/ADR-017-gemini-agentic-remote-login.md).

| Documento | Estado y primer paso |
|---|---|
| [33-chatgpt-integration-pending.md](33-chatgpt-integration-pending.md) | Plan solicitado de OpenAI Codex `token_plan_agentic`: doce pasos propuestos, modelos dinámicos y API key conservada. Primer pendiente CG-01: acceso/autenticación compatible con despliegue. NestJS + app-server supervisado; catálogo actual aún API únicamente. Al completar, trasladar a `docs/features/ai-providers/` y retirar el plan. |

## Finanzas personales — ampliación y planes

- [Finanzas personales](20-personal-finance-interview.md): decisiones funcionales confirmadas. [ERD propuesto](21-personal-finance-erd.md) y [ADR-011](../architecture/decisions/ADR-011-personal-finance-ledger.md) pendientes de revisión documental del esquema completo; Backend implementado y BD aislada de pruebas verificada, sin modificar la BD configurada.

| Documento | Propósito |
|---|---|
| [22-personal-finance-contracts.md](22-personal-finance-contracts.md) | Contratos propuestos, endpoints, payloads, filtros, saldos y navegación compartidos entre Server y Client |
| [23-personal-finance-backend-plan.md](23-personal-finance-backend-plan.md) | 26 tareas pequeñas asignables a subagentes, con dependencias, archivos, checklists y pruebas |
| [24-personal-finance-client-plan.md](24-personal-finance-client-plan.md) | 25 tareas: UI implementada y QA local; FC-24 conserva integración completa pendiente |

El [documento 03](03-domain-model-erd.md) contiene las cinco tablas y nueve FKs financieras. Se actualizó también el diagrama de Obsidian solicitado, conservando los objetos anteriores. Backend implementó los contratos22 y cerró localmente las26 tareas de23, con evidencia DB/HTTP aislada. Client24 implementa la UI y sus contratos; pruebas locales correctas, con flujo completo contra la BD objetivo pendiente (FC-24). No se aplicaron migraciones a la BD del usuario ni se aprobaron documentos automáticamente.

Estos documentos no están aprobados. Amplían el alcance previo al lanzamiento y requieren reconciliar los documentos del MVP afectados antes de implementación definitiva.

## Tools — reservas de alojamiento

| Documento | Propósito y estado |
|---|---|
| [25-rental-reservations-interview.md](25-rental-reservations-interview.md) | Requisitos confirmados y contexto de una casa completa, canales manuales, CLP, colaboradores y gastos |
| [26-rental-reservations-spec.md](26-rental-reservations-spec.md) | Especificación funcional en revisión; decisiones aceptadas del ERD diferenciadas de detalles de contrato |
| [27-rental-reservations-erd.md](27-rental-reservations-erd.md) | **Esquema aceptado explícitamente el 2026-10-04**, once tablas; incorporado a 03 y JSON de Obsidian con respaldo |
| [28-rental-reservations-contracts.md](28-rental-reservations-contracts.md) | Contratos Backend implementados localmente, en revisión documental: rutas, payloads, dinero, cancelación, preparación y recuperación de escrituras |
| [29-rental-reservations-backend-plan.md](29-rental-reservations-backend-plan.md) | Plan de desarrollo Backend para múltiples agentes, con tareas, dependencias, archivos y evidencia de cierre; en revisión |
| [30-rental-reservations-client-plan.md](30-rental-reservations-client-plan.md) | Client implementado con tres carriles e integrador; RC-01..37/39 verificadas localmente, RC-38 aplicación objetivo pendiente |

Obsidian conserva los objetos anteriores y contiene ahora37 tablas/69 relaciones. Se reconciliaron 03/05/06/07/11/12. [ADR-012](../architecture/decisions/ADR-012-rental-property-collaboration.md) y [ADR-013](../architecture/decisions/ADR-013-rental-integrity-and-idempotency.md) conservan estado propuesto. Backend implementado y verificado en PostgreSQL/HTTP aislados, con 44 operaciones y once entidades; migración/seed objetivo pendientes. Client30 implementado y verificado: 822 pruebas/144 archivos, typecheck/lint/build y navegador→HTTP→PostgreSQL temporal. Primer paso operacional pendiente RC-38: baseline, migración/seed/asignación y smoke con sesión real. Solo 27 está aprobado; no se aprueban automáticamente otros documentos.

Para añadir microservicios internos, consultar la [guía de seguridad](../architecture/internal-microservice-security.md) y [ADR-008](../architecture/decisions/ADR-008-internal-microservices-only.md). Todos se consumen únicamente desde Nodia Server.

## Contactos de proveedores

[31-provider-contacts-proposal.md](31-provider-contacts-proposal.md) registra los requisitos, contratos y evidencia de contactos de proveedores, con horario propio por contacto confirmado el 2026-10-05. Server/Client implementados; en detalle de negocio → Proveedores → Contactos. [ADR-014](../architecture/decisions/ADR-014-provider-contacts.md), ERD, rutas y Kanban reconciliados, sin aprobación automática. Tras la incidencia de endpoints, se corrigió Ransack y aplicó únicamente la migración de contactos en BD local configurada con respaldo previo; ambos listados responden 200 en smoke HTTP de solo lectura. Suites: 566 Server / 841 Client; integración aislada y QA responsive correctos. Sesión real, otros entornos y despliegue pendientes.

## Estados

- `pendiente`: aún no trabajado.
- `en progreso`: tiene información parcial.
- `bloqueado`: necesita una decisión que impide avanzar.
- `en revisión`: completo como borrador, pendiente de aprobación.
- `aprobado`: confirmado por el usuario.
- `no aplica`: descartado conscientemente y confirmado.

## Jerarquía de información

1. Documentos aprobados de esta carpeta.
2. ADR dentro de `docs/architecture/decisions/`.
3. `AGENTS.md`.
4. Conversación o memoria externa.

Creado el 2026-08-15.

Operación del transporte agéntico implementado: [runbook Antigravity CLI](agentic-cli-runbook.md). Retomar pendientes de entorno/pantalla del plan 32 conservando los contratos IA recuperados.
