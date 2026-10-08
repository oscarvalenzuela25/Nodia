# Entrega para agente — Gestión global de proveedores de IA


## Aclaración vigente del usuario — 2026-10-06

Las API keys están permitidas, excepto las gratuitas de Gemini. La recuperación actual ofrece **Gemini: API/Web/Agentic** y **OpenAI: API**, con Codex Agentic implementado en código y migración preparada el 2026-10-08. BD/cuenta/QA aplazados por el usuario; Web deshabilitado. Ver [funcionalidad Codex](../features/ai-providers/openai-codex-agentic.md). Los tres `can_use_*` del catálogo definen modos configurables; los `use_*` de cada instancia habilitan sus canales y `default_mode` expresa la elección. Modelos y claves se mantienen por instancia/modo, sin fallback automático. Las referencias anteriores a «Cero API Keys», primera entrega Gemini/Mistral o un único modo habilitable quedan como antecedente histórico y son sustituidas por esta aclaración en el alcance recuperado.

Se conserva el requisito de datos operativos comprobables: una clave guardada o un catálogo consultado no prueban inferencia, capacidades ni cuotas. Antigravity continúa sin disponibilidad certificada. La recuperación no incluye restaurar la auditoría visual retirada ni cerrar todos los pendientes de la especificación histórica. Implementación, alternativas y límites en [ADR-015](../architecture/decisions/ADR-015-ai-api-provider-recovery.md). Los documentos mantienen su estado de revisión.

> Estado: en revisión; **no aprobado**
> Fecha: 2026-09-25
> Origen: [entrevista](15-ai-providers-interview.md)
> Objetivo: especificar una ampliación previa a producción sin alterar el comportamiento útil actual de análisis de facturas.

## 1. Objetivo y alcance confirmado

Construir `Ajustes Generales > IA` para que personal autorizado por roles pueda configurar y verificar proveedores de IA, gestionar API keys y recuperar la sesión web de Gemini desde Nodia. La configuración funcional es global de la plataforma y se persiste en PostgreSQL; no se define por negocio ni por usuario.

Primera entrega: **Gemini** y **Mistral**. Cada uno conserva su adaptador de código y campos de configuración tipados. Un registro arbitrario en BD no convierte automáticamente un proveedor nuevo en ejecutable.

- Gemini admite `web_session` (el «token plan» del usuario, usando el microservicio actual) y `api_key` (API oficial). Un administrador elige exactamente un modo activo de Gemini. No se cambia de modo automáticamente cuando falla uno.
- Mistral usa `api_key`.
- Gemini y Mistral pueden estar disponibles al mismo tiempo. La pantalla de importación muestra botones para los proveedores utilizables y la persona escoge cuál analiza cada factura.
- `verify-ia-providers` refleja disponibilidad de la **vía seleccionada** por proveedor. Al analizar, el cliente envía el proveedor; NestJS resuelve modo, configuración y key vigentes desde BD. Una key almacenada en un modo no seleccionado no hace que el proveedor aparezca disponible.
- Un proveedor puede tener varias API keys. Hay una key seleccionada y un switch por proveedor para permitir rotación automática. Ante un error de key pertinente, el análisis de **la misma factura** prueba la siguiente key elegible hasta éxito o agotamiento. Al agotarse, devuelve error sin cambiar de proveedor ni de modo.
- Las keys con problemas aparecen para revisión en Ajustes Generales. La persona que analizó recibe feedback en la aplicación. No hay correo ni notificaciones externas en esta entrega.
- Si caduca Gemini Web, la persona puede seguir usando Nodia; la comprobación ocurre al abrir el panel y al intentar usar IA. Una persona autorizada puede iniciar un login remoto desde un botón del panel.

## 2. Estado actual comprobado

| Área | Estado del repositorio | Cambio requerido |
|---|---|---|
| Selección de factura | `nodia-client/.../ProductInvoiceImport.tsx` muestra botones Gemini/Mistral; `AnalyzeInvoiceUseCase` elige adaptador por `ai_provider`. | Mantener elección, renderizar solo proveedores disponibles y resolver el modo en NestJS desde BD. |
| Verificación | `VerifyIaProvidersUseCase` comprueba Gemini y devuelve `mistral: true` sin verificación. | Verificar configuración, vía seleccionada y disponibilidad real de ambos. |
| Gemini Web | FastAPI expone `/auth/status`, `/auth/login`, `/auth/refresh`; perfil y cookies se guardan en disco. `/auth/login` abre Chrome en el host del microservicio. | Login operable desde pestaña temporal, estado asíncrono y volumen persistente en VPS. |
| Gemini API | `ADR-005` retiró el uso de `GEMINI_API_KEY` en NestJS; no existe adaptador oficial en este flujo. | Añadir adaptador API y selección manual de modo en BD; revisar ADR-005. |
| Mistral | La key y modelos se leen del entorno al construir `MistralService`; hay reintentos transitorios y paso OCR/Vision. | Leer configuración/keys vigentes desde BD sin perder el comportamiento OCR/Vision. |
| Despliegue | Cloudflare Pages para frontend, R2 para archivos; el documento DevOps histórico ubica API/BD en Northflank y excluye Docker. | NestJS y microservicio en VPS; PostgreSQL en Neon o Northflank; Redis gestionado; Docker para microservicio y volumen de sesión. |

**Archivos de referencia:** `nodia-server/src/invoice/use-case/analyze-invoice.use-case.ts`, `verify-ia-providers.use-case.ts`, `nodia-server/src/common/ai/{gemini,mistral}.service.ts`, `nodia-gemini-microservice/{main,browser_manager,gemini_service}.py`, `nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/ProductInvoiceImport.tsx`.

## 3. Flujos funcionales

### 3.1 Configuración

1. Un usuario con permiso de lectura abre `/settings/ai` y ve una tarjeta por proveedor: habilitado, modo seleccionado, estado comprobado, último chequeo y problemas que requieren atención. Nunca se devuelven cookies ni keys completas.
2. En `/settings/ai/:providerKey`, un usuario con permisos adecuados modifica campos tipados del adaptador, modo activo, switch de rotación y keys. Toda mutación registra actor, fecha y resultado.
3. Cambiar entre Gemini Web y Gemini API es manual. El cambio se guarda en BD y afecta solicitudes nuevas; solicitudes ya iniciadas terminan con la configuración capturada al empezar.
4. Para keys: crear con etiqueta, ordenar, seleccionar, deshabilitar, probar y reactivar. La UI muestra solo una huella no sensible (por ejemplo últimos cuatro caracteres) y su estado. Nunca ofrece leer la key completa después de guardarla.

### 3.2 Verificar y analizar factura

1. El cliente consulta `GET /invoices/verify-ia-providers`. Mantener los booleanos `gemini` y `mistral` para compatibilidad. Si el chequeo falla, mostrar error y permitir reintento; no asumir que Mistral está disponible.
2. El cliente renderiza botones solo para proveedores habilitados y utilizables; los controles quedan inhabilitados durante chequeos y mutaciones.
3. `POST /invoices/analyze` recibe `ai_provider`. NestJS valida permiso de uso de IA, resuelve proveedor, modo, configuración y key desde BD, y ejecuta el adaptador. Si el proveedor deja de estar disponible entre `verify` y `analyze`, responder con error explícito y seguro.
4. Si la rotación de keys está apagada, se intenta solo la key seleccionada. Si está encendida, las keys elegibles se recorren en orden estable, cada una a lo sumo una vez por análisis. Al funcionar otra, queda seleccionada para solicitudes futuras mediante actualización transaccional; solicitudes concurrentes no deben desordenar la selección.
5. Tras agotar keys, fallar el análisis sin guardar una factura parcial y sin cambiar a otro proveedor o modo. Mantener los datos que el usuario ya había ingresado para que pueda reintentar.

### 3.3 Clasificación propuesta de fallos de API key

Estas reglas son una **propuesta técnica** a confirmar con los códigos reales de cada adaptador, no una decisión adicional del usuario:

| Causa | Estado de key | Rotación automática | Feedback |
|---|---|---|---|
| Credencial inválida o revocada (`401` y errores equivalentes) | `needs_review` | Sí | Aviso persistente para administradores; mensaje seguro al usuario. |
| Cuota/límite de esa credencial (`429` y equivalentes) | `cooldown` hasta `Retry-After` o nuevo chequeo | Sí | Mostrar cuota y próxima revisión si el proveedor informa cuándo. |
| Fallo temporal global (`5xx`, red, timeout) | Conservar estado; registrar incidente del proveedor | Reintento acotado sobre la misma key; no marcar todas defectuosas | Error temporal si persiste. |
| Archivo inválido, modelo no disponible o fallo de parseo | Conservar estado | No | Error correspondiente al análisis/configuración. |

Acotar intentos y tiempo total: el flujo Mistral puede hacer OCR y una segunda llamada al modelo, por lo que reintentar con otra key puede consumir cuota otra vez. Preservar el paso OCR/Vision existente y evitar persistencia duplicada en Nodia.

### 3.4 Recuperación de Gemini Web

**Avance local 2026-09-28:** el botón de Settings inicia/consulta/cancela un trabajo de login a través de NestJS, protegido por `ai:manage`, solo si NestJS está en desarrollo y Gemini en loopback. FastAPI conserva una sola tarea interactiva a la vez y no entrega cookies al cliente. Chrome aparece en el equipo que ejecuta Python. Esto valida el contrato administrativo local; **no** implementa la pestaña de navegador remoto ni demuestra viabilidad en VPS. Los pasos siguientes siguen pendientes.

1. En el detalle de Gemini, «Iniciar sesión» crea una sesión temporal de navegador remoto en el VPS y abre una nueva pestaña de Nodia. La pestaña muestra el navegador que ejecuta Playwright en el servidor, no una pestaña local de `gemini.google.com`.
2. Propuesta: navegador visible sobre Xvfb y visor web noVNC o equivalente, con sesión de control de una sola persona a la vez, token corto ligado al usuario, límite de tiempo, cierre al terminar y registro de auditoría. El canal gráfico y FastAPI quedan en una red interna; solo NestJS y el proxy autenticado exponen operaciones permitidas.
3. El operador escribe las credenciales directamente en el navegador remoto. El backend no pide ni guarda usuario/contraseña. Al completarse, el microservicio extrae cookies, actualiza la sesión y persiste `browser_profile/` y `session_state/` en volumen Docker. Después se cierra la vista remota y se actualiza el estado del panel.
4. La renovación silenciosa existente sigue disponible cuando el perfil lo permite. Si no lo permite, el panel indica que se requiere login interactivo.
5. Convertir el `/auth/login` actual (que bloquea hasta 300 segundos) en un flujo iniciar/consultar/cancelar, o un trabajo equivalente. Evitar varias ventanas simultáneas sobre el mismo perfil.

**Prueba previa obligatoria:** en un VPS de ensayo, con la cuenta real y una factura sintética, demostrar login remoto, extracción, rotación de cookies, reinicio del contenedor y recuperación del perfil. Si Google impide el login remoto o el método web falla, registrar el resultado y revaluar la vía antes de depender de ella en producción.

## 4. Modelo de datos consolidado (Catálogo y Multi-instancia)

El diagrama JSON de Obsidian (`C:\Users\Oscar\Documents\Obsidian Vault\obsidian-notes\Diagramas DB\nodia.json`) y el esquema DBML han sido actualizados para reflejar la decisión arquitectónica del 2026-09-27: se desacopla la tabla maestra de proveedores del mercado (`ai_provider_catalog`) de las instancias operativas en `ai_providers`, permitiendo registrar múltiples conexiones por proveedor (ej. plan web principal + API Key secundaria de contingencia).

| Tabla | Campos esenciales | Regla |
|---|---|---|
| `ai_provider_catalog` | `id` BIGINT PK, `key` VARCHAR(64) único (`gemini`, `openai`, `anthropic`, `mistral`, `deepseek`, etc.), `name` VARCHAR(128), `is_active`, `created_at`, `updated_at` | Catálogo maestro de proveedores conocidos en el mercado. Fuente de verdad para el selector de proveedores. |
| `ai_providers` | `id` BIGINT PK, `catalog_id` BIGINT FK nullable, `name` VARCHAR(128) nullable, `key` VARCHAR(64), `mode` (`web_session`/`api_key`), `fields` JSONB, `fields_version`, `auto_rotate_api_keys`, `is_active`, `created_at`, `updated_at` | Instancia operativa configurada. `catalog_id` vincula al proveedor del catálogo. `name` permite nombrar la instancia descriptivamente (ej. "Gemini Web Principal", "OpenAI Backup"). `mode` define la vía activa (`web_session` o `api_key`). `fields` almacena configuración tipada: `available_models`, `selected_model`, `ocr_focus_model` y `enable_extended_thinking`. |
| `ai_api_keys` | `id` BIGINT PK, `provider_id` FK, `label`, `secret_ciphertext`, `secret_fingerprint`, `display_hint`, `sort_order`, `is_selected`, `is_active`, `health_state`, `last_error_code`, `last_error_message` redactado, `last_error_at`, `last_success_at`, `cooldown_until`, `created_at`, `updated_at` | Pool de keys asociado directamente al proveedor (`provider_id`). Orden estable de rotación. Valor secreto cifrado con AES-256-GCM. `display_hint` permite reconocerla enmascarada. |
| `ai_provider_events` | `id` BIGINT PK, `provider_id` FK, `api_key_id` FK nullable, `actor_user_id` FK nullable, `event_type`, `reason_code`, `message` redactado, `metadata`, `is_active`, `created_at`, `updated_at` | Registro inmutable de transiciones, rotaciones y auditoría. Vinculado directamente al proveedor y a la key si aplica. Actor nulo para eventos automáticos. |

**Relaciones:** `ai_provider_catalog` 1:N `ai_providers` (vía `catalog_id`); `ai_providers` 1:N `ai_api_keys` (vía `provider_id`); `ai_providers` 1:N `ai_provider_events` (vía `provider_id`); `ai_api_keys` 1:N `ai_provider_events` (vía `api_key_id`). Índices únicos: `(provider_id, secret_fingerprint)` en keys y `key` en catálogo. `health_state` de key: `untested`, `valid`, `needs_review`, `cooldown`.

Los modelos de cada proveedor se sincronizan bajo demanda (`POST /ai-providers/:id/sync-models`) contra la API externa o microservicio, persistiendo la lista en `fields.available_models`. El modelo ejecutor de inferencia y facturas es estrictamente `fields.selected_model`. `fields.ocr_focus_model` es un indicador informativo para visibilidad en interfaz. Si el modelo cuenta con capacidad `reasoning`, puede habilitarse `fields.enable_extended_thinking`.

`is_active` indica habilitación administrativa. La disponibilidad real se **deriva** del modo elegido, la salud reciente de la sesión/credencial y el estado del servicio; no se usa un booleano persistido como prueba de salud.

Las keys se cifran antes de escribirlas en BD con una clave maestra custodiada fuera de esa BD (AES-256-GCM con `AI_ENCRYPTION_KEY`).

## 5. Autorización y seguridad

- Reutilizar el catálogo de acciones y roles existente. Acciones semánticas sugeridas: `ai.view`, `ai.manageProviders`, `ai.manageKeys`, `ai.manageSession`, `ai.analyzeInvoice`. El super admin obtiene todas; otros roles reciben solo las necesarias. Las rutas `/settings/ai/*` requieren módulo asignado y acción; **cada endpoint** valida la acción correspondiente.
- `verify-ia-providers` entrega solo disponibilidad a quienes pueden usar IA. El panel administrativo entrega detalles únicamente a quienes tengan `ai.view`. La apertura del navegador remoto exige `ai.manageSession`.
- FastAPI, VNC/noVNC y puertos de depuración no se publican directamente en Internet. Quitar el CORS permisivo actual del microservicio o limitarlo a la red interna necesaria. Usar HTTPS en los puntos públicos, tokens de sesión de un solo uso/vida breve, límites de tiempo, bloqueo de sesiones concurrentes y auditoría.
- Redactar logs, respuestas HTTP y eventos. No incluir API keys, cookies, perfiles, credenciales Google ni contenido de facturas en mensajes de error o auditoría. No subir el volumen al repositorio. Asegurar permisos restrictivos y copias cifradas.
- El flujo no oficial de Gemini Web tiene riesgo técnico y de condiciones del proveedor. Revisar las condiciones aplicables antes de usarlo como dependencia de producción; la vía Gemini API debe estar disponible como elección manual, no como fallback oculto.

## 6. Pantallas y contratos

| Superficie | Contenido/acciones |
|---|---|
| `/settings/ai` | Tarjetas Gemini/Mistral, modo activo, disponible/no disponible, motivo, último chequeo, número de keys con problemas, acceso al detalle. Estado inicial, vacío y error visibles. |
| `/settings/ai/:providerKey` | Configuración tipada del adaptador, selector de modo permitido, switch de rotación, tabla de keys, acciones de probar/reactivar, control de sesión Gemini y registro resumido de incidentes. Acciones ocultas o inhabilitadas según permisos. |
| Pestaña temporal de login | Visor remoto autenticado, estado de inicio/espera/éxito/error/caducidad y opción de cerrar. |
| Importación de factura | Botones de proveedores que `verify` indica disponibles, errores comprensibles y datos de formulario conservados si el análisis falla. |

Contratos sugeridos: conservar `GET /invoices/verify-ia-providers` con `{gemini:boolean,mistral:boolean}`; agregar endpoints protegidos para listar estado detallado, actualizar proveedor, CRUD/selección/prueba de keys, iniciar/consultar/cancelar login Gemini y consultar incidentes. Usar códigos de razón estables (`AUTH_REQUIRED`, `KEY_INVALID`, `QUOTA_EXHAUSTED`, `PROVIDER_UNAVAILABLE`, `ALL_KEYS_EXHAUSTED`) y traducciones es/en en cliente. Respuestas nunca contienen secretos.

Para frontend aplicar las reglas del proyecto: React Hook Form + Zod, MUI/Emotion, componentes reutilizables de formularios, `sileo` para todas las mutaciones y errores HTTP, modal abierto y valores preservados en fallo, Boneyard solo en primera carga de bloques informativos, revalidación discreta, controles inhabilitados durante peticiones, estados vacíos y errores visibles, accesibilidad y traducciones español/inglés.

## 7. Orden de implementación para el agente

1. **Reconciliar documentación y ADR:** revisar PRD/ERD/sitemap/route specs/stack/arquitectura/kanban afectados; proponer ADR para modos, custodia de secretos y navegador remoto; actualizar ADR-005. Mantener estados en revisión hasta aprobación explícita.
2. **Probar login remoto en VPS:** hacer el experimento de la sección 3.4 antes de construir la UI completa. Documentar recursos y límites reales del VPS.
3. **Persistencia y migración:** tablas, índices, cifrado, seed idempotente de Gemini/Mistral, plan para trasladar Mistral desde `MISTRAL_API_KEY` sin interrupción y configuración de modelos a `fields` validados.
4. **Backend vertical:** módulo de recursos IA con DTOs, entidades `Relation<T>`, servicios de datos, casos de uso y controladores delgados; adaptadores Gemini Web, Gemini API y Mistral; rotación acotada/concurrente; autorización por acciones; estado real y auditoría.
5. **Microservicio:** flujo de navegador remoto asíncrono, volumen persistente, red interna y endpoints de control protegidos. Preservar renovación y extracción existentes.
6. **Frontend:** navegación/guard, dashboard, detalle, keys y pestaña temporal; actualizar importación de facturas y mensajes es/en.
7. **Verificación:** pruebas unitarias **solo de casos de uso** en NestJS (modo seleccionado, permisos, rotación, agotamiento, concurrencia/error, verificación); pruebas de componentes con lógica en cliente; pruebas del ciclo de sesión en Python; build, lint y test de cada paquete. Prueba integrada con factura sintética y reinicio en entorno de ensayo.
8. **Operación:** proxy/TLS, volúmenes, secretos, backups, reinicio, health checks y runbook de login y recuperación de claves en VPS. No publicar hasta que los criterios de aceptación pasen.

## 8. Criterios de aceptación

1. Gemini y Mistral pueden aparecer disponibles simultáneamente y la persona autorizada escoge por factura.
2. Cambiar en BD el modo de Gemini altera solicitudes nuevas sin cambiar automáticamente de modo ante fallo.
3. `verify` devuelve `false` si la vía elegida está deshabilitada, sin credencial utilizable o con sesión inválida; nunca presenta Mistral disponible por valor fijo.
4. Con rotación apagada se intenta una key; encendida, una key fallida por credencial/cuota permite completar **la misma factura** con la siguiente. Se señala la fallida y se selecciona la que funcionó.
5. Al agotar keys, no hay cambio a otro proveedor/modo, no se guarda factura parcial y el usuario conserva su formulario.
6. Una caída temporal del proveedor no invalida todas las keys; el administrador ve causa y fecha del problema.
7. Un operador con permiso puede iniciar login Gemini desde una pestaña de Nodia y recuperar uso tras reiniciar el contenedor; sin permiso no puede iniciar sesión ni acceder al canal gráfico.
8. La configuración funcional sobrevive reinicios; keys y cookies nunca se muestran completas ni aparecen en logs. API de microservicio y visor no quedan públicamente accesibles.
9. Navegación, endpoints y análisis obedecen roles; errores y feedback de UI están traducidos y siguen las reglas locales de loading, toast y modal.
10. Pruebas, compilación, lint y prueba integrada en VPS de ensayo pasan con Gemini Web, Gemini API y Mistral según credenciales disponibles.

## 9. Decisiones técnicas propuestas que debe validar el experimento

- Usar noVNC (o visor equivalente) para mostrar Chrome del VPS en una pestaña temporal controlada por Nodia.
- Usar `ai_providers.fields` como JSONB versionado y discriminado por proveedor/modo, con formularios tipados; no editor JSON libre en la UI estándar.
- Cifrado de API keys en BD con clave maestra externa, auditoría sin secretos y selección transaccional de key.
- Considerar errores `401` como revisión, `429` como enfriamiento y `5xx`/red como incidente transitorio, ajustando la clasificación por proveedor tras verificar respuestas reales.

## 10. Riesgos y límites conocidos

- El login automatizado de Google en un navegador de VPS debe probarse con la cuenta real; la factibilidad no está demostrada por las pruebas locales actuales.
- El adaptador Gemini Web es no oficial y puede cambiar sin aviso. Revisar condiciones de uso y datos de facturas antes del lanzamiento.
- Guardar configuración en BD introduce dependencia de BD para seleccionar IA; definir error claro cuando BD no esté disponible. La clave de cifrado y las credenciales de infraestructura no pueden residir únicamente en esa misma BD.
- El VPS requiere operación: parches, proxy, copias, monitoreo, permisos del volumen y recuperación. PostgreSQL y Redis gestionados siguen fuera del VPS.
- El repositorio contiene cambios de trabajo ajenos a esta especificación; el agente debe preservarlos y coordinar cualquier edición concurrente.

Referencias externas para comprobar viabilidad y condiciones: [Playwright en Docker](https://playwright.dev/python/docs/docker), [perfil persistente de Playwright](https://playwright.dev/python/docs/api/class-browsertype), [noVNC](https://github.com/novnc/noVNC), [términos de Google](https://policies.google.com/terms) y [acceso a Gemini API](https://ai.google.dev/gemini-api/docs/get-started).

## 11. Encargo listo para entregar a un agente

> Implementa la gestión global de proveedores de IA descrita en `docs/mvp/16-ai-provider-management-handoff.md`. Lee primero `AGENTS.md`, `docs/mvp/README.md`, `docs/mvp/00-progress.md`, la entrevista `docs/mvp/15-ai-providers-interview.md` y `docs/architecture/decisions/ADR-005-gemini-web-session.md` y `ADR-006-ai-provider-configuration.md`. Conserva los cambios ajenos ya presentes en el workspace y respeta las skills locales antes de modificar código. Empieza por una prueba de login remoto de Gemini Web en un VPS de ensayo; documenta su resultado y ajusta la propuesta si falla. Luego implementa persistencia/seguridad, adaptadores, rotación de API keys en la misma factura, autorización por roles, panel de IA y despliegue operativo. Mantén Gemini y Mistral seleccionables por factura, no hagas fallback automático entre proveedores ni entre Gemini Web y Gemini API. Completa pruebas de casos de uso, componentes y ciclo de sesión, build/lint y verificación integrada. Revisa los documentos dependientes y no los marques aprobados sin confirmación explícita del usuario.
> Contrato recuperado vigente (2026-10-06): consultar [funcionalidades IA y regresiones](ai-provider-feature-contract.md) antes de modificar esquema, formularios, modelos, cuotas o claves. Sus requisitos explícitos del usuario actualizan los antecedentes históricos de este documento; no retirar controles por aplicar la antigua prohibición general de API keys.
