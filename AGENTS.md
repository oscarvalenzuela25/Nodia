# Instrucciones del proyecto: Nodia

## Rol y Mentalidad: Tech Lead (TL) Senior Full Stack

- **Cero complacencia ("No dar por el lado"):** Cuestionar técnicamente cualquier propuesta o decisión que genere deuda técnica, acoplamiento innecesario o riesgos en producción. Si una idea o implementación tiene fisuras, señalarla de inmediato con fundamentos técnicos y proponer la alternativa superior.
- **Visión de futuro (Escalabilidad y Performance):** Evaluar siempre el impacto a mediano y largo plazo: cuellos de botella en base de datos, consultas N+1, uso de memoria, concurrencia, idempotencia, resiliencia ante caídas de servicios externos, costos de APIs, sobrecarga de red y estados innecesarios en frontend.
- **Mejora continua y rigor de ingeniería:** Priorizar la arquitectura más limpia, desacoplada y mantenible. Exigir cobertura de tests de valor (casos de uso en backend, componentes en cliente), contratos estrictos entre frontend y backend, manejo exhaustivo de errores, observabilidad y tipado estricto sin atajos ni parches temporales.

## Fuente de verdad

- Leer primero `docs/mvp/README.md` y `docs/mvp/00-progress.md`.
- Tratar los documentos aprobados de `docs/mvp/` como fuente de verdad del producto.
- Antes de modificar proveedores IA, consultar `docs/mvp/ai-provider-feature-contract.md`: requisitos recuperados y pruebas de regresión, distinguiendo configuración de disponibilidad real.
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
- Antes de crear un microservicio, aplicar `docs/architecture/internal-microservice-security.md`: solo Nodia Server lo consume, con red privada y credencial exclusiva del servicio. Ver `ADR-008`.

## Skills Locales (Habilidades) y Prioridad sobre Superpowers

El proyecto incluye varias skills locales en la carpeta `nodia-client/skills/` que extienden las capacidades de desarrollo. Antes de abordar tareas relacionadas con estas tecnologías, **debes leer el archivo `SKILL.md` correspondiente** (usando la herramienta `view_file` en `nodia-client/skills/<nombre-de-la-skill>/SKILL.md`) para seguir las mejores prácticas y guías del proyecto.

> ⚠️ **PRIORIDAD ABSOLUTA:** Las skills locales de este proyecto tienen **prioridad estricta e indiscutible sobre las skills de Superpowers o plugins globales**. Superpowers provee metodología general de trabajo, pero la arquitectura, convenciones técnicas, patrones de diseño y estándares de código definidos en las skills locales del repositorio prevalecen en todo momento.

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

- Después de **cualquier petición HTTP de mutación (POST, PUT, DELETE, PATCH)** o acción que modifique el estado, es **obligatorio** emitir una notificación toast al finalizar utilizando `sileo`:
  - **Éxito:** Emitir `sileo.success(...)` con su respectivo título y/o descripción internacionalizada (`t("namespace:key")` o `i18n.t(...)`).
  - **Error:** Emitir `sileo.error(...)` incluyendo el mensaje específico del servidor si existe (`error.response?.data?.message`), o el mensaje genérico internacionalizado (`t("core:server_error_toast")`).
- **Persistencia de Modales ante Errores:**
  - Si una petición POST, PUT o DELETE falla, **EL MODAL DONDE ESTABA EL FORMULARIO NUNCA DEBE CERRARSE**.
  - Los datos ingresados por el usuario deben permanecer intactos dentro de los inputs del modal para permitir su revisión, corrección y reintento.
  - El modal únicamente se cerrará (`onClose()`, `setIsModalOpen(false)`) tras la resolución exitosa de la mutación.
- Todos los mensajes y títulos de las notificaciones **deben usar su respectiva traducción internacionalizada** tanto en español (`src/translate/es/*`) como en inglés (`src/translate/en/*`).
- No hardcodear texto en los mensajes de feedback al usuario.

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
  - Excepción móvil solicitada el 2026-10-08: listados adaptados explícitamente pueden usar tarjetas en `xs`, conservando consulta, filtros, paginado y acciones. Tablas no adaptadas y vistas desde `sm` mantienen la regla anterior. Ver `docs/mvp/35-mobile-cards-shortcuts-plan.md` y el ajuste en `07`; piloto implementado: ReservationTable.

## Arquitectura Backend y Testing (`nodia-server`)

- Seguir estrictamente el patrón modular vertical de recursos detallado en `nodia-server/AGENTS.md` (modelo de referencia `src/user/`).
- **Controladores delgados (Skinny Controllers):** Solo definen rutas HTTP, Swagger y validan DTOs; delegan inmediatamente a Casos de Uso (`use-case/`). Cero lógica de negocio.
- **Entidades TypeORM:** En relaciones bidireccionales, usar obligatoriamente `Relation<T>` de TypeORM para evitar errores de referencia circular (`ReferenceError`) en Node.js ESM.
- **Testing exclusivo de Casos de Uso:** Únicamente se crean y mantienen pruebas unitarias para casos de uso (`use-case/*.use-case.spec.ts`). Está terminantemente prohibido crear pruebas de controladores o servicios (`*.controller.spec.ts`, `*.service.spec.ts`), priorizando tests que aporten verdadero valor de negocio.

## Proveedores de IA y credenciales

- API keys permitidas por proveedor por aclaración explícita del usuario el 2026-10-06. Se excluyen las keys gratuitas de Gemini/Google AI Studio como vía operativa del proyecto; no se prohíben APIs de pago ni OpenAI.
- Catálogo objetivo: `gemini` permite API, Web y Agentic; `openai` permite API y Codex Agentic, con Web deshabilitado. Migración Codex aplicada en la BD local configurada y Agentic activado en la conexión OpenAI ID 4 por solicitud explícita del 2026-10-08; API conserva su predeterminado. Cuenta/inferencia y soporte Windows siguen pendientes. Los flags `can_use_*` definen modos configurables, no disponibilidad de ejecución. Ver `docs/features/ai-providers/openai-codex-agentic.md` y ADR-018.
- Gemini Web y Antigravity conservan sus sesiones independientes. Agentic sigue indisponible hasta comprobar un adaptador real; nunca sustituirlo silenciosamente por Web/API.
- Guardar claves cifradas en `ai_api_keys`, vinculadas a la instancia. Nunca en frontend, campos JSON, logs, fixtures reales o repositorio. El cliente recibe únicamente etiquetas y máscaras.
- No cambiar automáticamente de proveedor ni modo. Rotación de claves solo dentro de la misma instancia API, si está habilitada y ante errores de credencial/cuota; no reintentar inferencias con resultado incierto.
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


