# Instrucciones del proyecto: Nodia

## Rutas independientes del menú y Teacher (2026-11-01)

Aplicar [ADR092](docs/architecture/decisions/ADR-092-stable-module-navigation-routes.md) y [traspaso98](docs/mvp/98-nodia-teacher-start-handoff.md): URLs funcionales sin prefijo de sección, Teacher en dominio propio y autoridad por destino canónico. La migración de enlaces preserva identidades/asignaciones; mover o renombrar grupos no concede acceso. APIs y evidencia histórica firmada conservan sus contratos.

## NodiaAI: ventas y reportes de solo lectura (2026-10-30)

Aplicar [plan94, R17](docs/mvp/94-business-point-of-sale-and-product-refactor.md#26-nodiaai-ventas-y-reportes-de-solo-lectura--r17-2026-10-30): NodiaAI sólo obtiene y muestra información de ventas/reportes. No prepara ni ejecuta creación, edición, confirmación, anulación o descarte de ventas, tampoco mediante propuestas antiguas. El POS manual permanece disponible. No confundir esta restricción comercial con SQL libre o con prohibir la persistencia técnica del chat. Las referencias anteriores al CRUD conversacional de ventas son históricas.

## Ampliación actual: API key en NodiaAI (2026-10-27)

API chat reutiliza ToolGateway, módulos/ownership, grants, propuestas, confirmación humana exacta, ejecución/idempotencia y recuperación de Agentic. Aplicar [plan92](docs/mvp/92-nodia-ai-api-chat-parity.md), [ADR084](docs/architecture/decisions/ADR-084-nodia-ai-api-chat-common-runtime.md) y las pruebas obligatorias de [plan91](docs/mvp/91-ai-provider-onboarding-verification.md) al añadir o modificar un proveedor. API funciona en Server con HTTP/function calling: supports_tools no equivale a MCP; proof3 exige cierre local y distingue resultado remoto unknown, sin replay ni cancelación remota supuesta. Cada POST consume presupuesto antes del envío. Modelo/clave/conexión exactos y modalidades calificadas por selección; catálogo o key no acreditan inferencia. Las seis revisiones R02 cuentan con aprobación humana documental y se adoptaron en VM con validación técnica; eso no aprueba el ADR, otras fichas ni todas las modalidades. El plan92 conserva el estado técnico y evidencias; referencias inferiores de API chat no soportado describen el corte anterior.

## Modos IA y proveedores nuevos (2026-10-27)

- La solicitud vigente retira Web y el nombre token plan; aplicar [plan90](docs/mvp/90-agentic-api-only-web-retirement.md) y [ADR083](docs/architecture/decisions/ADR-083-agentic-and-api-only-ai-modes.md). Los únicos modos operativos son `agentic` y `api_key`, presentados como Agentic/API key. El historial retirado no habilita ejecución.
- Al incorporar un proveedor, adaptador o modo, completar las pruebas aplicables del [plan91](docs/mvp/91-ai-provider-onboarding-verification.md) por proveedor/modelo/entorno, con inferencia real válida y capacidades no soportadas explícitas. Un flag, clave guardada, login o catálogo no prueba inferencia. Conservar integridad, no-replay y confirmación humana.

## Rol y Mentalidad: Tech Lead (TL) Senior Full Stack

- **Cero complacencia ("No dar por el lado"):** Cuestionar técnicamente cualquier propuesta o decisión que genere deuda técnica, acoplamiento innecesario o riesgos en producción. Si una idea o implementación tiene fisuras, señalarla de inmediato con fundamentos técnicos y proponer la alternativa superior.
- **Visión de futuro (Escalabilidad y Performance):** Evaluar siempre el impacto a mediano y largo plazo: cuellos de botella en base de datos, consultas N+1, uso de memoria, concurrencia, idempotencia, resiliencia ante caídas de servicios externos, costos de APIs, sobrecarga de red y estados innecesarios en frontend.
- **Mejora continua y rigor de ingeniería:** Priorizar la arquitectura más limpia, desacoplada y mantenible. Exigir pruebas de valor sobre lógica atómica (funciones, validadores, políticas, custom hooks, componentes atómicos y casos de uso), contratos estrictos entre frontend y backend, manejo exhaustivo de errores, observabilidad y tipado estricto sin atajos ni parches temporales.

## Fuente de verdad

- Leer primero `docs/mvp/README.md` y `docs/mvp/00-progress.md`.
- Tratar los documentos aprobados de `docs/mvp/` como fuente de verdad del producto.
- Antes de modificar proveedores IA, consultar `docs/mvp/ai-provider-feature-contract.md`: requisitos recuperados y pruebas de regresión, distinguiendo configuración de disponibilidad real.
- Tratar `docs/architecture/decisions/` como fuente de decisiones técnicas versionadas.
- Si una conversación, memoria o suposición contradice un documento aprobado, detenerse y señalar la contradicción.

## Continuidad

- Paralelismo autorizado por el usuario (2026-10-15): usar subagentes cuando haya subtareas independientes que permitan avanzar en paralelo. Asignar ámbitos de archivos claros, coordinar cambios compartidos y realizar una integración y verificación final comunes.

- Retomar desde el primer paso incompleto o bloqueado del checklist.
- Leer los documentos dependientes antes de proponer cambios.
- Registrar información nueva en el documento correspondiente; no dejar decisiones importantes solo en el chat.
- Diferenciar hechos confirmados, inferencias y pendientes.
- No marcar un documento como aprobado sin confirmación explícita del usuario.
- Si cambia una decisión anterior, revisar y desmarcar los documentos posteriores afectados.

## Contexto funcional para NodiaAI

- Al crear la especificación de un producto/feature o ampliar sus reglas, crear o actualizar sus fichas en `docs/nodia-ai/knowledge/` siguiendo el [estándar y checklist](docs/nodia-ai/knowledge/README.md) y sus plantillas de [producto](docs/nodia-ai/knowledge/_templates/product.md) y [funcionalidad](docs/nodia-ai/knowledge/_templates/feature.md). Enlazar especificación, fichas e índices; esta documentación forma parte de la entrega.
- Al implementar o modificar contratos/comportamiento, mantener las fichas coherentes con las fuentes aprobadas y el backend. Distinguir aprobación documental, implementación e integración real. Registrar la evaluación de impacto para cambios exclusivamente visuales conforme al estándar.
- El Markdown explica capacidades; no habilita herramientas ni permisos. Aplicar [catálogo40](docs/mvp/40-nodia-ai-tool-catalog-v1.md), [contratos41](docs/mvp/41-nodia-ai-v1-contracts.md), [arquitectura43](docs/mvp/43-nodia-ai-execution-architecture.md), [política50](docs/mvp/50-nodia-ai-ai04-runtime-policy.md) y [publicación52](docs/mvp/52-nodia-ai-ai06-knowledge-publication-contract.md): frontmatter único, paths explícitos y build validado; no publicar borradores, secretos ni capacidades supuestas.

## Límite previo al desarrollo

- El usuario ha concedido **autorización explícita y total** (Readiness Review aprobado). Se permite modificar código, refactorizar e implementar épicas sin pedir permiso paso a paso.
- Se debe proceder de forma autónoma tomando las mejores decisiones técnicas, asegurando tests y calidad en cada commit/entrega.
- Mantener `AGENTS.md` como índice de reglas; ubicar el detalle del producto en `docs/mvp/`.

## Decisiones técnicas

- Crear un ADR cuando una decisión sea costosa de revertir, tenga alternativas relevantes o afecte varias partes del sistema.
- Usar `docs/architecture/decisions/ADR-template.md` como base.
- Antes de crear un microservicio, aplicar `docs/architecture/internal-microservice-security.md`: solo Nodia Server lo consume, con red privada y credencial exclusiva del servicio. Ver `ADR-008`.

## Skills Locales (Habilidades) y Prioridad sobre Superpowers

Rendimiento web móvil/escritorio: aplicar [las pautas de DESIGN, sección10](nodia-client/DESIGN.md), [las reglas de Client](nodia-client/AGENTS.md) y el [plan37](docs/mvp/37-web-performance-implementation-plan.md), aprobado explícitamente para implementación por etapas. Cada optimización preserva contratos/funcionalidades, presenta pruebas y comparación por perfil/ruta y actualiza esas pautas con el patrón final verificado; descartar variantes sin ahorro o regresivas. Editores secundarios cargados por intención requieren retry local sin recarga, borrador/foco intactos y descarte de aperturas obsoletas por cambio de contexto; referencia verificada en DESIGN10.6. Separar metadatos de catálogos administrativos del runtime compartido solo con ahorro y compatibilidad comprobados; referencia DESIGN10.7. Distinguir código propio, terceros y extensiones; métricas de laboratorio y una entrega local no equivalen a aceptación productiva completa. Mantener el detalle fuera de este índice.

El proyecto incluye varias skills locales en la carpeta `nodia-client/skills/` que extienden las capacidades de desarrollo. Antes de abordar tareas relacionadas con estas tecnologías, **debes leer el archivo `SKILL.md` correspondiente** (usando la herramienta `view_file` en `nodia-client/skills/<nombre-de-la-skill>/SKILL.md`) para seguir las mejores prácticas y guías del proyecto.

> ⚠️ **PRIORIDAD ABSOLUTA:** Las skills locales de este proyecto tienen **prioridad estricta e indiscutible sobre las skills de Superpowers o plugins globales**. Superpowers provee metodología general de trabajo, pero la arquitectura, convenciones técnicas, patrones de diseño y estándares de código definidos en las skills locales del repositorio prevalecen en todo momento.

Skills disponibles en `nodia-client/skills/`:

- **accessibility**: Auditorías y mejoras de accesibilidad web (a11y) siguiendo WCAG 2.2.
- **composition-patterns**: Patrones de composición en React escalables (compound components, render props, context).
- **create-component**: **Obligatorio** al crear o modificar componentes, páginas o layouts en React. Define el uso de MUI, Emotion, Axios y TanStack Query.
- **frontend-design**: Para crear interfaces con alta calidad de diseño y evitar estéticas genéricas ("AI slop").
- **responsive-design**: Obligatorio para cambios de UI que afecten layout, contenido o interacción responsive/móvil. Ver [skill](nodia-client/skills/responsive-design/SKILL.md); conserva el theme, contratos y excepciones móviles documentadas de Nodia.
- **nodejs-backend-patterns**: Patrones para servicios backend Node.js (Express/Fastify, REST, GraphQL, microservicios).
- **nodejs-best-practices**: Decisiones de arquitectura, seguridad y patrones asíncronos en Node.js.
- **react-best-practices**: Guía de optimización de rendimiento para aplicaciones React/Next.js (por Vercel).
- **seo**: Optimización técnica SEO, meta tags y datos estructurados.
- **typescript-advanced-types**: Uso avanzado del sistema de tipos de TypeScript (genéricos, conditional types, utility types).
- **vite**: Configuración de Vite, plugins, SSR y migraciones a Vite 8.
- **vitest**: Framework de testing rápido unitario basado en Vite (configuración, mocks, coverage).

## Peticiones HTTP y Notificaciones (Snackbars / Toasts)

- Después de **cualquier petición HTTP de mutación (POST, PUT, DELETE, PATCH)** o acción que modifique el estado, es **obligatorio** emitir una notificación toast al finalizar utilizando `sileo`:
  - **Éxito:** Emitir `sileo.success(...)` con su respectivo título y/o descripción internacionalizada (`t("namespace:key")` o `i18n.t(...)`).
  - **Error:** Emitir `sileo.error(...)` incluyendo el mensaje específico del servidor si existe (`error.response?.data?.message`), o el mensaje genérico internacionalizado (`t("core:server_error_toast")`).
- **Persistencia de Modales ante Errores:**
  - Si una petición POST, PUT o DELETE falla, **EL MODAL DONDE ESTABA EL FORMULARIO NUNCA DEBE CERRARSE**.
  - Los datos ingresados por el usuario deben permanecer intactos dentro de los inputs del modal para permitir su revisión, corrección y reintento.
  - El modal únicamente se cerrará (`onClose()`, `setIsModalOpen(false)`) tras la resolución exitosa de la mutación.
- Todos los mensajes y títulos de las notificaciones **deben usar su respectiva traducción internacionalizada** tanto en español (`src/translate/es/*`) como en inglés (`src/translate/en/*`).
- No hardcodear texto en los mensajes de feedback al usuario.

## Filtro de actividad (`nodia-client`)

- Al usar `Filter`, el criterio activo/inactivo debe utilizar exclusivamente `ActiveStatusSelect` (`src/components/Filter/components/ActiveStatusSelect`), basado en `SelectSingleInput`, con tres opciones internacionalizadas: **Activo, Inactivo, Todos**. Prohibidos switches, checkboxes y selects de dos opciones para este criterio dentro de `Filter`.
- Iniciar la consulta y el selector en **Activo**; **Limpiar filtros** restaura Activo. **Todos** incluye activos e inactivos, sin aplicar el predicado de actividad. Conservar la selección aplicada al reabrir/redimensionar y reiniciar el paginado al aplicar o quitar el criterio.
- Esta regla se aplica únicamente a recursos que tienen actividad en su contrato; los estados comerciales y el switch de edición `is_active` conservan sus controles propios. Detalle en [nodia-client/AGENTS.md](nodia-client/AGENTS.md).

## Componentes de Formularios en Modales (`nodia-client`)

- **Ecosistema de Inputs Reutilizables:**
  - `TranslationInput`: Obligatorio para campos con traducciones dinámicas (`translates`).
  - `TextInput`: Para campos simples de texto.
  - `SelectSingleInput`: Selector individual con buscador y filtro integrado.
  - `SelectMultipleInput`: Selector múltiple con buscador, chips y botón de seleccionar todo.
  - `InputSearch`: Barra de búsqueda con debounce para tablas y listados.
  - `ConfirmDialog`: Diálogo de confirmación para acciones destructivas o cambios de estado (`Activar/Desactivar`).
- **Switch de Activo (`is_active` / `isActive`):**
  - Debe implementar **obligatoriamente el patrón visual de Core (`UserModal`)**:
    - Contenedor `SwitchWrapper`: Tarjeta con bordes redondeados, borde `theme.palette.divider` y fondo tenue adaptado al tema claro/oscuro.
    - `StyledFormControlLabel` con `labelPlacement="start"`: Ubica la etiqueta a la izquierda en negrita (`fontWeight: 600`) y el switch al extremo derecho.
    - `StyledSwitch`: Resaltado en color verde (`theme.palette.success.main`) cuando está activo.
    - Etiqueta estandarizada e internacionalizada (generalmente _"Activo"_ / _"Active"_).

## Estilo de Scrollbars (Barras de Desplazamiento)

- **Regla obligatoria de diseño para contenedores con scroll (`overflow: auto` / `overflow-y: auto` / `overflow-x: auto`):**
  - **Pista (`track`):** Debe ser siempre completamente transparente (`background: transparent !important`). Queda estrictamente prohibido mostrar fondos sólidos, blancos, grises u opacos en la barra de scroll.
  - **Botones de flecha (`button`):** Se deben ocultar totalmente (`display: none !important; width: 0; height: 0`).
  - **Barra/Indicador (`thumb`):** Debe ser sutil, redondeado (`border-radius: 9999px`), delgado (ancho/alto de 6px), sin bordes sólidos y adaptado al tema claro/oscuro con transparencia (`alpha("#ffffff", 0.2)` en dark, `alpha("#000000", 0.2)` en light, con efecto hover más visible al 0.35).
  - **Soporte estándar:** Definir siempre `scrollbar-width: thin` y `scrollbar-color: <thumbColor> transparent` junto con las pseudo-clases `::-webkit-scrollbar*` para compatibilidad total entre navegadores (Firefox, Chrome, Safari, Edge).

## Fuente de Verdad para Esquemas y Modelos (`nodia-server`)

- Cuando se vaya a implementar una funcionalidad, vista, formulario o integración en frontend y no se tenga absoluta certeza de qué campos o validaciones se requieren:
  - **Es obligatorio consultar el backend (`nodia-server`)**:
    - Entidades TypeORM: `src/<recurso>/entities/<recurso>.entity.ts` (columnas, tipos, valores por defecto, nulabilidad).
    - DTOs de validación: `src/<recurso>/dto/create-<recurso>.dto.ts` y `update-<recurso>.dto.ts` (decoradores de class-validator, campos opcionales vs requeridos).
    - Casos de uso: `src/<recurso>/use-case/` (lógica de negocio y contratos de entrada/salida).
  - Con base en estos esquemas del servidor se deben construir los formularios (React Hook Form + Zod) y las columnas de las tablas.

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
  - Deben implementar un estado vacío (`Empty State`) claro (genérico o custom por sección) que informe al usuario que no hay información disponible actualmente (ej. _"No hay elementos para mostrar actualmente. Agregue un nuevo [elemento] para iniciar"_), preferentemente acompañado de un llamado a la acción (botón/CTA) si corresponde.
  - Todos los textos deben estar traducidos en `src/translate/es/*` y `src/translate/en/*`.
- **Botones e Inputs:**
  - **No** tienen estado vacío con mensajes custom. Si el endpoint responde vacío o sin datos, los inputs simplemente permanecen vacíos en su estado normal / por defecto.

### 3. Estados de Error (`Error State`)

- **Notificación obligatoria mediante Toast (`sileo.error(...)`):**
  - Ante cualquier fallo de petición HTTP, es mandatorio emitir un toast de error.
  - Si la respuesta del backend incluye un mensaje de error específico (`error.response?.data?.message`), debe incluirse en la descripción del toast.
  - Si no viene un mensaje específico, se debe emitir un mensaje genérico internacionalizado (ej. _"Error en el servidor. Por favor, inténtelo más tarde"_).
- **Tablas, Paneles y Métodos Informativos:**
  - Aparte del toast global que se dispara por el fallo HTTP, en componentes de contenido es obligatorio/necesario mostrar un estado visual de error en el propio componente (ej. un `Alert` de MUI con `severity="error"` o bloque de error custom con opción de reintentar), en lugar de dejar la pantalla rota o en blanco.
- **Botones e Inputs:**
  - **No** muestran estados ni mensajes custom de error de datos generales; si el endpoint falla, los inputs se quedan en su estado normal o vacío (los errores de validación de campos se gestionan aparte mediante React Hook Form y Zod).

## Lineamientos de Diseño de Paneles, Espaciado y Responsividad (`nodia-client`)

- **Padding de Pantalla y Contenedores Principales (Responsive):**
  - **Móvil (`xs` / `<600px`):** **16px** (`p: 2` en MUI o `theme.spacing(2)`).
  - **Tablet (`sm` / `600px - 899px`):** **24px** (`p: 3` en MUI o `theme.spacing(3)`).
  - **Escritorio (`md`+ / `>=900px`):** **32px** (`p: 4` en MUI o `theme.spacing(4)`).
  - **Cero doble padding:** Queda prohibido añadir padding exterior en componentes de página hijas (`src/modules/*/pages/*`) cuando ya son renderizadas dentro de `PageContent` en `BaseLayout`.
- **Espaciado (Gap) entre Paneles:**
  - **Vertical:** Separación estándar de **24px** (`rowGap: 3` / `24px`).
  - **Horizontal:** Separación estándar de **16px** (`columnGap: 2` / `16px`).
- **Comportamiento Móvil de Botones y Acciones:**
  - En `xs` (`<600px`), los botones de acción principal en cabeceras y barras de herramientas (`TableTopBar`, `FilterBar`, diálogos modales) deben ocupar el **100% de ancho** (`width: "100%"` o `flex: 1`) para garantizar ergonomía táctil con el pulgar.
- **Tablas de Datos en Móvil:**
  - Obligatorio mantener `minWidth: 650` (aplicado globalmente en `theme.components.MuiTable`) dentro de `TableContainer` con scroll horizontal (`overflowX: "auto"`) y scrollbars transparentes, prohibiendo que las columnas se aplasten o se vuelvan ilegibles.
  - Excepción móvil solicitada el 2026-10-08: listados adaptados explícitamente pueden usar tarjetas en `xs`, conservando consulta, filtros, paginado y acciones. Tablas no adaptadas y vistas desde `sm` mantienen la regla anterior. Ver `docs/mvp/35-mobile-cards-shortcuts-plan.md` y el ajuste en `07`; referencias implementadas: ReservationTable, Modules (módulos/grupos), Users y Actions. Nuevos CRUD de registros siguen `nodia-client/DESIGN.md` 9.6.

## Arquitectura Backend y Testing (`nodia-server`)

- Seguir estrictamente el patrón modular vertical de recursos detallado en `nodia-server/AGENTS.md` (modelo de referencia `src/user/`).
- **Controladores delgados (Skinny Controllers):** Solo definen rutas HTTP, Swagger y validan DTOs; delegan inmediatamente a Casos de Uso (`use-case/`). Cero lógica de negocio.
- **Entidades TypeORM:** En relaciones bidireccionales, usar obligatoriamente `Relation<T>` de TypeORM para evitar errores de referencia circular (`ReferenceError`) en Node.js ESM.
- **Testing de lógica atómica (2026-10-23):** Priorizar funciones puras, validadores, políticas, parsers, transformaciones, helpers y casos de uso, probando su regla real junto a su unidad. Se elimina la exclusividad anterior de `use-case/`; no disfrazar helpers como casos de uso. No crear suites para controladores/servicios que sólo delegan o encapsulan persistencia. Conservar integración puntual y aislada para garantías entre capas, DB, transacciones, concurrencia, idempotencia y autorización que una unidad no demuestra.

## Proveedores de IA y credenciales

- API keys permitidas por proveedor por aclaración explícita del usuario el 2026-10-06. Se excluyen las keys gratuitas de Gemini/Google AI Studio como vía operativa del proyecto; no se prohíben APIs de pago ni OpenAI.
- Los modos operativos son Agentic y API key. Gemini y OpenAI tienen adaptadores comprobados por los alcances del [plan90](docs/mvp/90-agentic-api-only-web-retirement.md); los flags `can_use_*` sólo permiten configuración, no prueban disponibilidad. Web y su delegación están retirados; conservar históricos sin alias ejecutables. API OCR y API chat están implementados; consultar la [aceptación por alcance92](docs/mvp/92-nodia-ai-api-chat-parity.md). No extender un success de texto a otros formatos/modelos.
- Las sesiones Agentic de cada adaptador y sus perfiles son independientes. La disponibilidad exige evidencia real por proveedor/modelo/esfuerzo/entorno; no sustituir silenciosamente un modo o proveedor.
- Guardar claves cifradas en `ai_api_keys`, vinculadas a la instancia. Nunca en frontend, campos JSON, logs, fixtures reales o repositorio. El cliente recibe únicamente etiquetas y máscaras.
- No cambiar automáticamente de proveedor ni modo; elegir explícitamente Agentic o API key. La delegación Web→Agentic de la política48 es histórica y quedó retirada por la decisión del2026-10-27. Rotar claves sólo dentro de la misma instancia API cuando esté habilitado y ante error conocido de credencial/cuota; nunca reintentar inferencias de resultado incierto ni confirmar escrituras implícitamente.
- Modelos por descubrimiento/configuración, sin listas cerradas o versiones por defecto. No inventar cuotas, modalidades ni capacidad por el nombre. Una clave guardada o catálogo accesible no prueba inferencia exitosa.

## Prohibición Total de Modelos Estáticos y Fallbacks Hardcodeados (Cero Hardcoding de Modelos de IA)

- **Cero contenido estático o fallbacks de modelos:** Los modelos de Inteligencia Artificial evolucionan aceleradamente (semanalmente surgen versiones nuevas y obsoletas). Queda **terminantemente prohibido** hardcodear nombres o versiones de modelos como fallbacks en código (`|| "gemini-..."`, `|| "mistral-..."`, `|| "gpt-..."`, etc.) tanto en frontend, backend como en microservicios.
- **Resolución 100% Dinámica:**
  - Todo modelo a ejecutar debe provenir de la configuración persistida en base de datos (`provider.fields?.selected_model`, `provider.fields?.ocr_model`, `modeFields`), de la sincronización en vivo (`available_models`) o del SDK / endpoint de descubrimiento activo del proveedor.
  - Si un proveedor no tiene modelo asignado o seleccionado, la interfaz y el backend **nunca deben asumir un modelo fantasma o fallback obsoleto**:
    - En UI: Mostrar explícitamente _"Sin modelo asignado"_ o _"Sin asignar"_.
    - En Backend / Facturas: `can_use_model: false` y exigir al usuario configurar un modelo antes de procesar extracciones.
- **Microservicios y SDKs:**
  - Si no se especifica un modelo concreto en la petición o en el proveedor, delegar la resolución por defecto al propio SDK subyacente (ej. `model=None` en Antigravity) o requerir explícitamente el modelo configurado.
  - Queda prohibido mantener listas fijas cerradas que impidan el uso de nuevas versiones de modelos (ej. Gemini 4, Claude 5, etc.) lanzadas por los proveedores.

## Veracidad de Información Operativa y Fuentes Comprobables

- **Fuente Comprobable Obligatoria:** Toda información operativa debe tener una fuente comprobable. Antes de implementar cada dato de la interfaz, verificar su origen en el backend, SDK o respuesta real del proveedor.
- **Prohibición de Datos Inventados:** Prohibido inventar cuotas, límites, capacidades, disponibilidad, latencias, fechas de comprobación o funciones no implementadas. No deducir capacidades a partir del nombre del modelo.
- **Límites de Inferencia de Estado:** La configuración guardada no demuestra disponibilidad actual. Una sesión autenticada no demuestra que una inferencia funcione.
- **Tratamiento ante Datos No Entregados:**
  - Si el servicio no entrega un dato: devolver `null` o un estado explícito de desconocido.
  - Ocultar la cifra o capacidad correspondiente en frontend.
  - No agregar valores de respaldo ("placeholders" o defaults inventados) para completar la interfaz.
  - Conservar los ceros reales: cero (`0`) y desconocido (`null`/`undefined`) son conceptualmente distintos.
- **Aislamiento de Mocks:** Los datos simulados solo pueden existir en fixtures de pruebas, identificados claramente y separados del código de producción.
- **Verificación Previa a la Entrega:** Antes de entregar, probar datos ausentes, respuestas inválidas, servicio caído y configuración histórica. Indicar con precisión técnica qué se comprobó realmente y qué sigue pendiente.




## Pruebas de valor, temporales y finales de línea

- Priorizar regresiones de lógica en funciones, custom hooks y componentes atómicos. Probar comportamiento observable, errores y límites con el contexto mínimo. No generar por rutina suites de páginas, secciones completas o aplicaciones, ni duplicar sus combinaciones ya cubiertas en unidades pequeñas. Los recorridos integrados se justifican por un riesgo concreto entre unidades.
- No usar cantidad de tests/cobertura como objetivo ni añadir tests espejo o snapshots masivos. No quitar pruebas existentes sin evaluar qué garantías deben conservarse o trasladarse a unidades pequeñas.
- Texto propio y archivos editables en UTF-8/LF. `.gitattributes` y `.editorconfig` ya fijan LF; verificar los bytes al escribir desde scripts en Windows. No normalizar binarios, dependencias, secretos, perfiles ni sesiones. Los hashes históricos describen sus bytes originales: consultar el archivo de originales y su manifiesto en `ops/maintenance/`, sin reescribir evidencias para simular paridad.
- Generar experimentos, reportes intermedios y logs en `.tmp/` o `output/` ignorados. Conservar en `docs/evidence/` sólo evidencia duradera útil y consolidada, sin secretos. Paquetes locales de recuperación en `ops/lab/artifacts/`, con catálogo; el helper compartido de la VM está en `ops/lab/remote.py`. No acumular copias por cada intento ni usar temporales como única dependencia de un proceso mantenido.
