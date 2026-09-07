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

## Peticiones HTTP y Notificaciones (Snackbars / Toasts)

- Después de **cualquier petición HTTP** (creación, actualización, borrado lógico o errores de transporte/servidor) es **obligatorio** emitir una notificación / snackbar utilizando `sileo` (`sileo.success(...)`, `sileo.error(...)`, `sileo.warning(...)`, etc.).
- Todos los mensajes y títulos de las notificaciones **deben usar su respectiva traducción internacionalizada** (`t("namespace:key")` o `i18n.t(...)`) tanto en español (`src/translate/es/*`) como en inglés (`src/translate/en/*`).
- No hardcodear texto en los mensajes de feedback al usuario.

## Manejo de Estados en Frontend (`nodia-client`): Carga, Vacío y Error

### 1. Estados de Carga con TanStack Query (`isLoading`, `isFetching` e `isMutating`)
- **Diferenciación estricta de flags:**
  - `isLoading`: Corresponde al primer fetch inicial cuando aún no existen datos en el caché de React Query.
  - `isFetching`: Corresponde a revalidaciones o refetches posteriores (por ejemplo, tras `invalidateQueries` o actualización en background) cuando ya existen datos en el caché.
  - `isMutating`: Corresponde a una o más mutaciones activas en proceso.
- **Tablas, Paneles, Listas y Bloques Informativos (Objetos de datos NO accionables / al hacer clic no pasa nada):**
  - Para `isLoading` (primer fetch sin datos): Es **obligatorio** utilizar la librería **`boneyard-js`** (`boneyard-js/react`, envolviendo el componente con `<Skeleton loading={isLoading}>...</Skeleton>`).
  - Para `isFetching` o `isMutating` (revalidación con datos ya presentes o mutación en vuelo): **PROHIBIDO** volver a mostrar el Skeleton de Boneyard o desmontar la vista. Debe utilizarse un **soft loading** o representación interna y sutil del estado de carga (ej. `LinearProgress` discreto en cabecera, spinner diminuto o leve opacidad) que no tape la información previa ni estropee la UI. También es válido no realizar cambios invasivos en la UI.
- **Botones, Formularios, Inputs y Controles Accionables (Interactivos / al interactuar generan una acción):**
  - Los 3 estados (`isLoading`, `isFetching` o `isMutating`) **deben dejar al componente en estado `loading` o `disabled`** (`disabled={isLoading || isFetching || isMutating}` o `disabled={isPending}`). Quedan inhabilitados para evitar interacción, dobles envíos o condiciones de carrera en medio de peticiones HTTP.
  - Los inputs y botones **no deben utilizar skeletons**.

### 2. Estados Vacíos (`Empty State`)
- **Prohibido dejar vistas en blanco o nulas:** Si la petición HTTP devuelve un resultado vacío (ej. array vacío `[]` o sin registros), nunca se debe dejar el espacio en blanco ni retornar `null` sin feedback visual.
- **Tablas, Paneles y Métodos Informativos:**
  - Deben implementar un estado vacío (`Empty State`) claro (genérico o custom por sección) que informe al usuario que no hay información disponible actualmente (ej. *"No hay elementos para mostrar actualmente. Agregue un nuevo [elemento] para iniciar"*), preferentemente acompañado de un llamado a la acción (botón/CTA) si corresponde.
  - Todos los textos deben estar traducidos en `src/translate/es/*` y `src/translate/en/*`.
- **Botones e Inputs:**
  - **No** tienen estado vacío con mensajes custom. Si el endpoint responde vacío o sin datos, los inputs simplemente permanecen vacíos en su estado normal / por defecto.

### 3. Estados de Error (`Error State`)
- **Notificación obligatoria mediante Toast (`sileo.error(...)`):**
  - Ante cualquier fallo de petición HTTP, es mandatorio emitir un toast de error.
  - Si la respuesta del backend incluye un mensaje de error específico (`error.response?.data?.message`), debe incluirse en la descripción del toast.
  - Si no viene un mensaje específico, se debe emitir un mensaje genérico internacionalizado (ej. *"Error en el servidor. Por favor, inténtelo más tarde"*).
- **Tablas, Paneles y Métodos Informativos:**
  - Aparte del toast global que se dispara por el fallo HTTP, en componentes de contenido es obligatorio/necesario mostrar un estado visual de error en el propio componente (ej. un `Alert` de MUI con `severity="error"` o bloque de error custom con opción de reintentar), en lugar de dejar la pantalla rota o en blanco.
- **Botones e Inputs:**
  - **No** muestran estados ni mensajes custom de error de datos generales; si el endpoint falla, los inputs se quedan en su estado normal o vacío (los errores de validación de campos se gestionan aparte mediante React Hook Form y Zod).

## Arquitectura Backend y Testing (`nodia-server`)

- Seguir estrictamente el patrón modular vertical de recursos detallado en `nodia-server/AGENTS.md` (modelo de referencia `src/user/`).
- **Controladores delgados (Skinny Controllers):** Solo definen rutas HTTP, Swagger y validan DTOs; delegan inmediatamente a Casos de Uso (`use-case/`). Cero lógica de negocio.
- **Entidades TypeORM:** En relaciones bidireccionales, usar obligatoriamente `Relation<T>` de TypeORM para evitar errores de referencia circular (`ReferenceError`) en Node.js ESM.
- **Testing exclusivo de Casos de Uso:** Únicamente se crean y mantienen pruebas unitarias para casos de uso (`use-case/*.use-case.spec.ts`). Está terminantemente prohibido crear pruebas de controladores o servicios (`*.controller.spec.ts`, `*.service.spec.ts`), priorizando tests que aporten verdadero valor de negocio.

