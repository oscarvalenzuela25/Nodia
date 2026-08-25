# Instrucciones del proyecto: Nodia

## Fuente de verdad

- Leer primero `docs/mvp/README.md` y `docs/mvp/00-progress.md`.
- Tratar los documentos aprobados de `docs/mvp/` como fuente de verdad del producto.
- Tratar `docs/architecture/decisions/` como fuente de decisiones técnicas versionadas.
- Si una conversación, memoria o suposición contradice un documento aprobado, detenerse y señalar la contradicción.

## Continuidad

- Retomar desde el primer paso incompleto o bloqueado del checklist.
- Leer los documentos dependientes antes de proponer cambios.
- Registrar información nueva en el documento correspondiente; no dejar decisiones importantes solo en el chat.
- Diferenciar hechos confirmados, inferencias y pendientes.
- No marcar un documento como aprobado sin confirmación explícita del usuario.
- Si cambia una decisión anterior, revisar y desmarcar los documentos posteriores afectados.

## Límite previo al desarrollo

- El usuario ha concedido **autorización explícita y total** (Readiness Review aprobado). Se permite modificar código, refactorizar e implementar épicas sin pedir permiso paso a paso.
- Se debe proceder de forma autónoma tomando las mejores decisiones técnicas, asegurando tests y calidad en cada commit/entrega.
- Mantener `AGENTS.md` como índice de reglas; ubicar el detalle del producto en `docs/mvp/`.

## Decisiones técnicas

- Crear un ADR cuando una decisión sea costosa de revertir, tenga alternativas relevantes o afecte varias partes del sistema.
- Usar `docs/architecture/decisions/ADR-template.md` como base.

## Skills Locales (Habilidades)

El proyecto incluye varias skills locales en la carpeta `nodia-client/skills/` que extienden las capacidades de desarrollo. Antes de abordar tareas relacionadas con estas tecnologías, **debes leer el archivo `SKILL.md` correspondiente** (usando la herramienta `view_file` en `nodia-client/skills/<nombre-de-la-skill>/SKILL.md`) para seguir las mejores prácticas y guías del proyecto.

Skills disponibles en `nodia-client/skills/`:
- **accessibility**: Auditorías y mejoras de accesibilidad web (a11y) siguiendo WCAG 2.2.
- **composition-patterns**: Patrones de composición en React escalables (compound components, render props, context).
- **create-component**: **Obligatorio** al crear o modificar componentes, páginas o layouts en React. Define el uso de MUI, Emotion, Axios y TanStack Query.
- **frontend-design**: Para crear interfaces con alta calidad de diseño y evitar estéticas genéricas ("AI slop").
- **nodejs-backend-patterns**: Patrones para servicios backend Node.js (Express/Fastify, REST, GraphQL, microservicios).
- **nodejs-best-practices**: Decisiones de arquitectura, seguridad y patrones asíncronos en Node.js.
- **react-best-practices**: Guía de optimización de rendimiento para aplicaciones React/Next.js (por Vercel).
- **seo**: Optimización técnica SEO, meta tags y datos estructurados.
- **typescript-advanced-types**: Uso avanzado del sistema de tipos de TypeScript (genéricos, conditional types, utility types).
- **vite**: Configuración de Vite, plugins, SSR y migraciones a Vite 8.
- **vitest**: Framework de testing rápido unitario basado en Vite (configuración, mocks, coverage).
