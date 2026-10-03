# Sistema de Aprendizaje Continuo e Instrucciones (`/learn`)

Este documento constituye la guía unificada y fuente de conocimiento acumulativo para agentes y desarrolladores en **`nodia-client`** y el ecosistema **Nodia**. Integra el protocolo operativo del comando interno `/learn` de Google Antigravity con las reglas globales, decisiones arquitectónicas y aprendizajes reales consolidados en el proyecto.

---

## 1. Protocolo Operativo del Motor `/learn`

El proceso y comando `/learn` tiene como misión destilar lecciones, correcciones del usuario y resoluciones de depuración en directrices persistentes para que futuras sesiones y agentes no repitan errores ni incurran en regresiones.

### 1.1 Identificación del Aprendizaje (Diagnóstico)
1. **Análisis de Mensajes del Usuario:** Priorizar el análisis de interacciones recientes buscando correcciones explícitas, restricciones, desautorizaciones o señalamientos directos (ej. *"no"*, *"en vez de esto..."*, *"eso falló"*, *"no cierres el modal"*).
2. **Aislamiento del Fix (Pivote):** Comparar los intentos fallidos con la resolución exitosa para aislar con precisión matemática el cambio determinante.
3. **Determinación de Causa Raíz vs. Síntoma:** Atacar la causa arquitectónica o conceptual subyacente, nunca el síntoma o parche superficial. Evaluar si la lección es universal o restringida a un dominio específico.
4. **Verificación de Necesidad:** Si la interacción no arrojó un comportamiento reutilizable, una nueva restricción o un refinamiento valioso, no saturar las reglas ni inventar lecciones artificiales.

### 1.2 Taxonomía Estricta: Reglas vs. Habilidades (Rules vs. Skills)
- **Regla (`Rule`):**
  - **Definición:** Guardrails universales de comportamiento, restricciones arquitectónicas, invariantes de formato y políticas innegociables.
  - **Ubicación:** `AGENTS.md`, `LEARN.md` o `.agents/rules/*.md`.
  - **Carga:** Always-on o contextual por directorio.
- **Habilidad (`Skill`):**
  - **Definición:** Procedimientos accionables paso a paso, cadenas de herramientas multi-paso, combinaciones complejas de flags o cheatsheets de implementación.
  - **Ubicación:** Carpeta `skills/<nombre>/SKILL.md`.
  - **Carga:** Progresiva (on-demand), solo se inyecta su resumen al prompt y su contenido se lee únicamente al activarse.

### 1.3 Criterio de Persistencia: Actualizar vs. Crear
- **Actualizar Existente (Opción Preferida):** Si ya existe una regla o skill activa sobre el tema pero falló, quedó desactualizada o no contemplaba un caso de borde, **se debe editar la existente**. Esto previene la fragmentación y saturación de contexto.
- **Crear Nueva:** Solo cuando el aprendizaje abarque un dominio o tecnología enteramente nueva no contemplada previamente.

### 1.4 Flujo Obligatorio de Propuesta (`Mandatory Proposal Workflow`)
Para mantener la integridad del repositorio, los agentes deben seguir un flujo estructurado al consolidar aprendizajes:
1. Formular la hipótesis de aprendizaje y su fundamentación técnica.
2. Generar o actualizar un artefacto de propuesta (`learning_proposal.md`) detallando la clasificación (Regla vs. Skill), la justificación técnica y el diff exacto propuesto.
3. Solicitar feedback explícito del usuario (`RequestFeedback: true`).
4. Aplicar los cambios en los archivos de reglas únicamente tras la confirmación o validación del usuario.

### 1.5 Presupuesto de Contexto y Deduplicación
- **Límite por archivo:** Máximo 24 KB (24,000 bytes) por archivo de regla para evitar desbordes de ventana.
- **Presupuesto compartido:** Mantener directrices atómicas, de alta densidad técnica y sin redundancias narrativas.
- **Deduplicación:** Las reglas se deduplican por ruta de archivo; no repetir directrices idénticas en múltiples archivos del mismo scope.

### 1.6 Jerarquía de Precedencia: Skills Locales vs. Superpowers y Plugins Globales
- **Prioridad Absoluta de Skills Locales:** Las skills del repositorio (`skills/<nombre>/SKILL.md`) tienen **prioridad estricta y absoluta** sobre cualquier skill o directriz provista por plugins globales como **Superpowers** (o equivalentes).
- **Armonización de Procesos:** Superpowers aporta una metodología agéntica general (TDD, brainstorming, planes de trabajo). No obstante, en todo lo relativo a diseño de componentes, arquitectura, manejo de estado, accesibilidad, testing y convenciones de código, **las skills locales del proyecto prevalecen siempre**.
- **Resolución de Conflictos:** Ante cualquier discrepancia entre una sugerencia de Superpowers y una skill local o convención del proyecto, **el agente debe acatar estrictamente la skill local**. Al ejecutar el comando `/learn`, toda directriz debe respetar y blindar esta jerarquía.

---

## 2. Regla Global e Invariantes Fundacionales

- **Inspección Previa Mandatoria:** En cada proyecto o subproyecto en el que se vaya a trabajar, **primero se debe revisar el archivo `AGENTS.md`** correspondiente para conocer las directrices operativas y la arquitectura antes de proponer o aplicar cambios.
- **Adopción Incondicional y Prioridad de Skills Locales:** Si `AGENTS.md` o el contexto del proyecto indica el uso de una o más `skills` locales (ej. `create-component`, `frontend-design`, `composition-patterns`, etc.), **se deben utilizar sin resistencia**, leyendo el `SKILL.md` correspondiente antes de tocar código. **Estas skills locales tienen prioridad absoluta sobre las skills generales de Superpowers.**
- **Mentalidad Tech Lead Senior:** Cero complacencia técnica ("no dar por el lado"), visión a mediano y largo plazo (performance, escalabilidad, memoria, concurrencia) y rigor de ingeniería con contratos estrictos y tests unitarios de valor.

---

## 3. Instrucciones y Fuentes de Verdad del Proyecto Nodia

### 3.1 Fuente de Verdad
- Leer primero `docs/mvp/README.md` y `docs/mvp/00-progress.md`.
- Tratar los documentos aprobados de `docs/mvp/` como fuente de verdad del producto.
- Tratar `docs/architecture/decisions/` como fuente de decisiones técnicas versionadas (ADRs).
- Si una conversación, memoria o suposición contradice un documento aprobado, detenerse y señalar la contradicción.

### 3.2 Continuidad y Rigor de Desarrollo
- Retomar siempre desde el primer paso incompleto o bloqueado del checklist.
- Leer los documentos dependientes antes de proponer cambios.
- Registrar información nueva en el documento correspondiente; no dejar decisiones críticas flotando únicamente en el chat.
- Diferenciar hechos confirmados, inferencias y pendientes.
- No marcar un documento como aprobado sin confirmación explícita del usuario.
- Crear un ADR (`docs/architecture/decisions/ADR-template.md`) cuando una decisión sea costosa de revertir o afecte múltiples áreas.
- **Autorización Previa:** El usuario ha concedido autorización explícita y total (Readiness Review aprobado). Se debe proceder de forma autónoma tomando las mejores decisiones técnicas, asegurando tests y calidad en cada commit/entrega.

### 3.3 Catálogo de Skills Locales (`nodia-client/skills/`)
Antes de abordar tareas relacionadas con estas tecnologías, consultar `nodia-client/skills/<nombre>/SKILL.md`:
- **`accessibility`**: Auditorías y mejoras de accesibilidad web (a11y) siguiendo WCAG 2.2.
- **`composition-patterns`**: Patrones de composición en React escalables (compound components, render props, context).
- **`create-component`**: **Obligatorio** al crear o modificar componentes, páginas o layouts en React (MUI, Emotion, Axios, TanStack Query).
- **`frontend-design`**: Interfaces con alta calidad visual, evitando estéticas genéricas ("AI slop").
- **`nodejs-backend-patterns`**: Patrones para servicios backend Node.js (Express/Fastify, REST, microservicios).
- **`nodejs-best-practices`**: Decisiones de arquitectura, seguridad y patrones asíncronos en Node.js.
- **`react-best-practices`**: Optimización de rendimiento para aplicaciones React (guía Vercel).
- **`seo`**: Optimización técnica SEO, meta tags y datos estructurados.
- **`typescript-advanced-types`**: Tipado estricto avanzado en TypeScript (genéricos, conditional types, utility types).
- **`vite`**: Configuración de Vite, plugins, SSR y optimizaciones.
- **`vitest`**: Testing unitario y de integración rápido (configuración, mocks, coverage).

---

## 4. Aprendizajes Técnicos Clave Consolidados en `nodia-client`

Estos aprendizajes provienen de correcciones reales y son reglas de obligado cumplimiento en el código de frontend:

### 4.1 Manejo de Estados de Carga (TanStack Query)
- **`isLoading` (Primer fetch sin datos en caché):**
  - **Tablas, Paneles y Métodos Informativos (No accionables):** Obligatorio envolver con `<Skeleton loading={isLoading}>` de `boneyard-js/react`.
  - **Botones e Inputs:** `disabled={isLoading}` o `loading={isLoading}`. **Prohibido** usar skeletons en inputs y botones.
- **`isFetching` o `isMutating` (Revalidación con datos presentes o mutación en vuelo):**
  - **ESTRICTAMENTE PROHIBIDO** volver a mostrar el Skeleton de Boneyard (evita parpadeos molestos y desmontaje de datos visibles).
  - Usar **soft loading** discreto (ej. `LinearProgress` sutil de 2px, opacidad leve o spinner diminuto en cabecera) o preservar la UI estable.
  - **Controles Accionables:** Los 3 estados (`isLoading`, `isFetching`, `isMutating`) deben dejar los controles en `disabled` o `loading` para prevenir clics concurrentes, dobles envíos y condiciones de carrera.

### 4.2 Estados Vacíos (`Empty State`)
- **Prohibido dejar vistas en blanco o retornar `null`:** Si un endpoint responde un array vacío `[]` o sin datos, mostrar un componente explicativo con mensaje y llamado a la acción (CTA) cuando corresponda.
- **Botones e Inputs:** No tienen estado vacío con mensajes custom; permanecen en su estado normal/vacío por defecto.

### 4.3 Resiliencia de Modales y Manejo de Errores en Formularios
- **Persistencia Inquebrantable de Modales:** Si una mutación HTTP (POST, PUT, DELETE, PATCH) falla, **EL MODAL NUNCA DEBE CERRARSE**.
- **Conservación de Datos:** Los campos e inputs completados por el usuario deben permanecer intactos para permitirle revisar, corregir y reintentar sin perder su trabajo.
- El modal solo se cerrará (`onClose()`, `setIsModalOpen(false)`) tras una respuesta de éxito confirmada (2xx).

### 4.4 Notificaciones (Snackbars / Toasts) e Internacionalización
- Toda mutación o acción HTTP que modifique el estado debe emitir un toast final con `sileo`:
  - **Éxito:** `sileo.success(...)` con clave de traducción.
  - **Error:** `sileo.error(...)` priorizando el mensaje del servidor (`error.response?.data?.message`), con fallback al genérico internacionalizado `t("core:server_error_toast")`.
- **Cero Texto Hardcodeado:** Todo texto visible, título y mensaje de feedback debe contar con su correspondiente clave en español (`src/translate/es/*`) e inglés (`src/translate/en/*`).

### 4.5 Ecosistema de Formularios y Componentes Reutilizables
- Utilizar los componentes base estandarizados del sistema:
  - `TranslationInput`: Para campos con soporte de traducciones dinámicas (`translates`).
  - `TextInput`: Para campos de texto convencionales.
  - `SelectSingleInput` / `SelectMultipleInput`: Selectores con búsqueda y filtrado integrado.
  - `InputSearch`: Búsqueda con debounce para tablas.
  - `ConfirmDialog`: Diálogo para acciones destructivas o cambios de estado (`Activar/Desactivar`).
- **Switch de Activo (`is_active` / `isActive`):** Implementar obligatoriamente el patrón visual de Core:
  - Tarjeta contenedora `SwitchWrapper` con borde `theme.palette.divider` y fondo tenue adaptado al tema.
  - `StyledFormControlLabel` con `labelPlacement="start"` (etiqueta a la izquierda en negrita `fontWeight: 600` y switch a la derecha).
  - `StyledSwitch` con color verde (`theme.palette.success.main`) cuando está activo.

### 4.6 Estándar Visual de Scrollbars
En cualquier contenedor con scroll (`overflow: auto`, `overflow-y: auto`, `overflow-x: auto`):
- **Pista (`track`):** Totalmente transparente (`background: transparent !important`). Queda estrictamente prohibido mostrar fondos opacos.
- **Flechas (`buttons`):** Ocultas completamente (`display: none !important; width: 0; height: 0`).
- **Barra (`thumb`):** Sutil, redondeada (`border-radius: 9999px`), 6px de grosor, color adaptativo con transparencia según tema (`alpha("#ffffff", 0.2)` en dark, `alpha("#000000", 0.2)` en light, y hover a 0.35).
- Soporte multiplataforma con `scrollbar-width: thin` y `scrollbar-color`.

### 4.7 Espaciado y Layout de Paneles
- **Padding principal:** Tarjetas destacadas, paneles de configuración y vistas principales usan padding estandarizado de **32px** (`p: 4`).
- **Separación (Gaps):**
  - Vertical: **24px** (`rowGap: 3`).
  - Horizontal: **16px** (`columnGap: 2`).

### 4.8 Testing Estricto Espejo
- Runner: Vitest con entorno `jsdom` + React Testing Library.
- Todo componente o hook con lógica debe tener su test bajo `src/test/`.
- La ruta dentro de `src/test/` debe replicar 1:1 la ruta del componente en `src/` (ej. `src/modules/auth/pages/Login/Login.tsx` -> `src/test/modules/auth/pages/Login/Login.test.tsx`).
- Si la carpeta o test espejo no existen al modificar o crear un componente, se deben crear obligatoriamente.

### 4.9 Políticas de Inteligencia Artificial (Cero API Keys y Cero Modelos Hardcodeados)
- **Cuotas Duales Exclusivas:** Solo se permite operar con la **Cuota Agéntica** (sesión activa Antigravity) y la **Cuota Web** (Gemini Web vía sesión de navegador). Queda terminantemente prohibido el uso o requerimiento de API keys (gratuitas o de pago).
- **Cero Modelos Hardcodeados:** Prohibido escribir nombres o versiones de modelos fijos en código (`|| "gemini-..."`, etc.). La resolución de modelos es 100% dinámica desde la base de datos (`provider.fields?.selected_model`), sincronización activa o el SDK del proveedor.
