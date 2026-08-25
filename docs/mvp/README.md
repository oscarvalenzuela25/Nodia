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
