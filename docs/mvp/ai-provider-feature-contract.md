# Contrato funcional de conexiones IA y regresiones

## OCR manual Gemini: diagnóstico R16 adoptado, extracción bloqueada — 2026-11-07

NativeR16 está adoptado con instrumentación estructural segura, pero la extracción OCR continúa bloqueada. El delta añade sólo la captura best-effort de cli.log/hook en finally, con el helper heredado intacto; errores de diagnóstico no alteran el resultado y no se registra texto libre.660pruebas Linux sin fallos/omitidas y fixture aislado sin red/perfil real correctos. La nueva intención explícita sobre el mismo archivoPNG conservado recibióHTTP504 tras250s en UI: deadline240s, inferencia242057ms, lectura view_file completada y0eventos finish/resultado. El hook observado contabilizó1decisión,0rechazos y0finish; el log examinó30835bytes/128líneas con truncado. Sus indicadores vacíos de transporte/proveedor/HTTP no identifican la causa ni prueban ausencia de fallo. Tras el cierre:0CLI/marcadores/proofs/grupos propios y22fuentes verificadas; archivo y controles recuperados. No hubo replay, otro POST de análisis, guardado o nueva vinculación tras este fallo. Los10rechazos health_status observados fueron metadatos, no inferencias adicionales. No se aisló causa remota; no se atribuye el fallo a Google ni se presupone que otro modelo/CLI funcione. Permanecen CLI1.3.1, SDK, prompt/modelo/esfuerzo y límites240/300/340/360s; resolver una estrategia compatible y demostrar una extracción válida sigue pendiente. [Evidencia R16](../evidence/invoice-gemini-timeout-20261107-r02.json).

## OCR manual Gemini: NativeR15 — 2026-11-07

NativeR15 adoptado en VM desde R14 con dos fuentes de producción: instrucción explícita de terminación finish, callback/contadores de progreso de archivo y guard de error falsey. Mantiene parser, role/hook, runner, modelo/esfuerzo seleccionado y los límites240/300/340/360s existentes; no cambia SDK ni dependencias.659pruebas Linux correctas sin omitidas y fixture aislado sin red/perfil real: cancelación, descendiente setsid, drenaje deIO y reutilización con intención nueva comprobados. La adopción preservó configuración de ServerR12 y ClientR37; API/Worker se detuvieron y arrancaron deliberadamente con configuración original, sinSQL, inferencias, acciones sobre marcadores legados o timers durante el cutover. La compatibilidad de terminación es una hipótesis de corrección, no causa demostrada del504anterior. NativeR15 está adoptado y sus659pruebas Linux/fixture de cierre aislado pasaron, pero no resolvió el timeout OCR real. La nueva intención explícita recibióHTTP504 tras251s observados en UI; el runtime agotó su deadline240s con duración de inferencia242051ms. El progreso observó view_file (dos eventos, una finalización), document_read_completed=true, tool_error_counts={} y result_event_count=0; no acreditó resultado ni finish. Al cierre se observaron0CLI, marcadores, proofs y grupos propios,21fuentes verificadas y archivoPNG conservado con controles habilitados. Cierre local no demuestra éxito remoto: el resultado sigue unknown, sin replay, sin guardado o nuevo matching. Los cambios de prompt/diagnóstico no demuestran la causa del fallo. Se prepara instrumentación segura de cli.log/hook en R16; sigue pendiente, sin ampliar240/300/340/360s. [Evidencia](../evidence/invoice-gemini-timeout-20261107-r01.json).

## Sesión Codex en el detalle Agentic — corrección de implementación, 2026-11-01

El detalle Agentic de OpenAI consulta ahora la sesión actual al entrar, compartiendo la lectura entre cabecera y panel. Antes consumía el snapshot de health fuera del modal: su caducidad o el reinicio de API podían mostrar sesión no verificada aunque las credenciales persistieran. La corrección consulta metadatos de cuenta y después habilita el descubrimiento de modelos, en ese orden porque ambos usan el lease exclusivo del perfil. No inicia login, desconecta, modifica selección ni genera inferencia. Un perfil ocupado y una observación desconocida conservan sus estados; no se presentan como sesión cerrada. La autenticación positiva tampoco convierte la inferencia en saludable.

Evaluación de contexto funcional: las fichas aprobadas de [credenciales/sesiones](../nodia-ai/knowledge/general-settings/features/ai-credentials-and-sessions.md) y [modelos/salud](../nodia-ai/knowledge/general-settings/features/ai-models-and-health.md) ya distinguen autenticación, disponibilidad generativa y contención del perfil. La corrección implementa esas reglas en la interfaz, sin cambiar conceptos, contratos públicos, autoridad, herramientas, modalidades ni gates de calificación. Se preservan los bytes de las 44 fichas aprobadas; no se revisan sus aprobaciones ni se registra o publica contexto nuevo. El patrón y sus fuentes están en [DESIGN10.12](../../nodia-client/DESIGN.md#1012-sesión-codex-consultada-por-intención--2026-11-01), `useCodexSessionObservation`, `codexSessionState`, `useCodexSession` y `ProviderDetail` del módulo Client AiProviders.

Comprobación: 64 pruebas focales en cuatro archivos con transporte sintético, tipos y lint correctos. Incluyen estado ausente/ocupado, autenticación sin inferencia, precedencia por fecha, error de reconsulta con datos retenidos, una lectura compartida por intención visible, cancelación por cambio de conexión y serialización cuenta/modelos. El Client R02 fue adoptado con manifest `8f2a8117eb473abb89f3fc9e494be652b36be7e288fb57b77a438327738156c7`. Tras recargar el detalle en navegador con la sesión Nodia existente, la VM mostró «Cuenta Codex conectada» y `checkedAt:2026-11-01T22:58:22.547Z`, Desconectar Codex y Actualizar modelos habilitados, modelo/esfuerzo persistidos conservados y estado de inferencia «Sin verificar»; el aviso agregado obsoleto desapareció. La inspección no inició login ni inferencia adicional. No acredita otras selecciones, todos los fallos en VM, rendimiento o aceptación móvil. La entrega no modifica perfiles, keyring, credenciales, runtime Server o Native; la calificación generativa Teacher tiene evidencia independiente.

## Ampliación actual del contrato: API chat — 2026-10-27

La [ronda real de OCR/multimedia](../evidence/api-ocr-media-verification-r01.json) completa diez POST instrumentados, sin retries ni fallback. OpenAI gpt-6-luna pasó el turno guiado de elección de proveedor→OCR con dos POST de planificación y uno de extracción; el setup inicial awaiting_supplier usa planificación sintética. Gemini gemini-3.1-flash-lite pasó PNG, PDF y WAV hablado; su extracción OCR aislada pasó con planificación sintética, pero el planner conversacional real devolvió HTTP400 antes de OCR y sigue bloqueado, con causa sin confirmar. La generación con gemini-3.1-flash-lite-image devolvió HTTP429: no produjo imagen ni calificación, y no se repitió. Ambas extracciones conservaron cuatro ceros/cuatro null; comparación y readback reutilizan el resultado sin otra inferencia, con rechazo de actor ajeno/módulo revocado y cero escrituras comerciales. No se inventó un precio para probar guardado: la confirmación humana/idempotencia conserva su gate común SQL16 separado. Server R02 `f1bd47…`/knowledge `ad41d3…` está adoptado: corrige las tres variantes OCR que sólo admitían Agentic y elimina la continuación API descartada antes del OCR. Mantiene el techo de tres POST/run, las 151 capacidades, 43 documentos y 45 fragmentos; 151 regresiones focales, Linux/rebuild y SQL19+16 pasaron. No hubo migración; los 65 fingerprints/32 migraciones, Client `17f5d1…`, Nginx y Native se preservaron. Respaldos cifrados antes/después verificados. Las pruebas usan PostgreSQL y almacenamiento de originales desechables; no se copian acceptances a conexiones operacionales ni se persisten las claves aportadas. Para habilitar formatos en una conexión de uso faltan configuración API y calificación con su propia credencial/epoch; otros formatos y UI/R2/retención real conservan sus gates. [Plan92](92-nodia-ai-api-chat-parity.md), [plan91](91-ai-provider-onboarding-verification.md) y el [corte anterior de chat API](../evidence/api-chat-verification-final-r01.json) distinguen los alcances.

## Decisión actual — retirada Web autorizada el 2026-10-27

Web fue retirado de los tres proyectos y de la BD de la VM; quedan **Agentic** (`agentic`) y **API key** (`api_key`). Sustituye Web y su delegación a Agentic. Ese cierre acreditó success real en Agentic y API OCR; todavía no incluía el chat API, incorporado por la ampliación vigente superior. Ver [plan90 y mapa por proyecto](90-agentic-api-only-web-retirement.md), [matriz y evidencia final](../evidence/ai-two-modes-verification-final-r01.json), [verificación reusable91](91-ai-provider-onboarding-verification.md) y [ADR083](../architecture/decisions/ADR-083-agentic-and-api-only-ai-modes.md). Sólo las seis revisiones documentales aprobadas expresamente se publicaron. Los cortes inferiores son históricos y no describen el runtime actual.

Alcance de pruebas confirmado por el usuario el2026-10-26: ejecutar por ahora únicamente Codex Agéntico y Antigravity/Gemini Agéntico. Web y API key quedan fuera de estas pruebas. La intención de retirar Web es futura; API key permanece en el catálogo objetivo. Esta decisión no solicita retirar ahora adaptadores, modos, credenciales ni contratos existentes y no autoriza sustituciones automáticas entre conexiones.

Contexto funcional NodiaAI del2026-10-15: [Ajustes Generales](../nodia-ai/knowledge/general-settings/README.md), fichas de[conexiones](../nodia-ai/knowledge/general-settings/features/ai-connections.md), [modelos/salud](../nodia-ai/knowledge/general-settings/features/ai-models-and-health.md) y[credenciales/sesiones](../nodia-ai/knowledge/general-settings/features/ai-credentials-and-sessions.md). [AI-05](51-nodia-ai-ai05-product-knowledge.md) sólo contrasta/documenta; no cambia esta política, configuración, inferencia, requisitos ni publicación.

Decisión explícita 2026-10-12: OpenAI conserva API key y Codex agéntico; su integración token_plan_web fue descartada y retirada por solicitud del usuario. Se conservan los campos y contratos Web que utiliza Gemini. La decisión y evidencia se resumen en [ADR-029](../architecture/decisions/ADR-029-chatgpt-web-browser-adapter.md). [Ensayo VM local](vps-local-vm-lab.md).

Fecha: 2026-10-06. Estado documental: en revisión; requisitos pedidos explícitamente por el usuario e implementados, sin aprobación automática del documento. Complementa los documentos 15/16 y ADR-015. Una modificación que retire un requisito exige una nueva decisión explícita y actualizar sus pruebas; no eliminar funcionalidades por interpretar una política histórica.

Decisión de UI del 2026-10-13: «Cuenta Codex», sus acciones y cuotas aparecen exclusivamente en la pestaña Agéntico de OpenAI. API key conserva su gestión de claves sin ese panel, con independencia del modo predeterminado. Una alerta de autenticación abre primero Agéntico y espera sus consultas antes de mostrar el modal de Codex; cambiar de pestaña no desconecta la sesión.

## Indicadores del topbar — 2026-10-08

Decisión del2026-10-13: Gemini Web dispone de un [visor de login desde Nodia](../features/ai-providers/gemini-web-login-viewer.md), en desarrollo y producción ([ADR-030](../architecture/decisions/ADR-030-gemini-web-login-viewer.md)). Pantalla y entradas limitadas viajan por la API autenticada/`ai:manage`, con ownership en Server y Python, TTL300s y no-store. No publicar FastAPI/VNC ni exportar contraseñas/cookies. Rechazo de Google y aceptación de cuenta real se distinguen de abrir/controlar correctamente el visor; no modificar Gemini Agentic/API ni Codex. Si el intento desaparece, permitir cerrar/reintentar; errores de envío conservan borrador, visor y mensaje visible.

Por decisión del usuario del2026-10-13, el predeterminado muestra únicamente los indicadores de sus modos habilitados, consumiendo la misma caché de salud. Modos apagados se omiten; sin modos habilitados se omite el grupo. Los flags explícitos false prevalecen sobre el modo histórico. OpenAI sin Web habilitado muestra API/Agéntico. Un modo habilitado sigue visible aunque falte su clave o sesión, con estado pendiente. Web/Agéntico en verde exigen sesión disponible/autenticada. Por decisión explícita del usuario del2026-10-12, API en verde significa exclusivamente clave guardada, sin exigir modelo ni inferencia; tooltip «API key configurada», conservado con datos previos ante fallo de reconsulta. El detalle API y conexiones exclusivamente API no muestran chip de estado; Web/Agéntico lo conservan. El health del backend no cambia a saludable por almacenar una clave. El clic abre el ID y pestaña exactos en Ajustes IA. Sin predeterminado o permisos, se omite el grupo. La autorización contempla acción `ai:manage` o rol `super_admin`, además del módulo asignado, conforme al backend. Revalidación no desmonta los iconos; un fallo invalida el verde de las sesiones. Contrato, pruebas y límites: [funcionalidad del topbar](../features/ai-providers/topbar-mode-health.md).

## Esquema y separación de responsabilidades

### Actualización manual de los indicadores — 2026-11-06

El grupo de salud añade un botón de actualización manual para la sesión Nodia validada, conservando el acceso vigente por módulo canónico `/ai-providers` y bypass `super_admin`. No se monta para visitantes ni amplía autorización HTTP. Consume una sola reconsulta compartida de `GET /ai-providers/health`; polling y staleTime120s permanecen. Mientras consulta, conserva los indicadores y bloquea sus acciones con carga local; clics rápidos no duplican petición ni toast. Éxito indica observación actualizada, incluso si el motor sigue no disponible; error usa QueryCache una sola vez y conserva datos para un nuevo intento manual. No reconecta cuentas, cambia selección, verifica inferencia ni fuerza invalidación de cachés privadas del proveedor. [Detalle](../features/ai-providers/topbar-mode-health.md#actualización-manual-desde-la-cabecera--2026-11-06).

Verificación NodiaAI del 2026-10-16: la ocupación nativa `runtime_busy` no demuestra sesión expirada. Salud conserva valores no verificados; las proyecciones MCP de salud/motores devuelven autenticación desconocida. El timestamp nativo de cuota en segundos Unix se convierte explícitamente a ISO/null en MCP, conservando cero y rechazando fechas inválidas; REST conserva su contrato. La admisión cancelable de Codex convierte únicamente sus errores conocidos de entorno/perfil en observaciones no disponibles, sin inferencia, sin interrumpir otro perfil y sin absorber abortos o errores inesperados de admisión. [Evidencia y límites AI-15](61-nodia-ai-ai15-product-reads.md#publicación-y-verificación-real--2026-10-16).

Instalación vacía 2026-10-10: catálogo inicial de 16 identidades preservado y Moonshot/Kimi añadido por `CompleteAiProviderCatalog1791640000000`, con sus tres canales apagados y sin adaptador nuevo. Gemini/OpenAI conservan sus flags configurables vigentes; insertar identidades no prueba disponibilidad ni amplía el selector de compatibles. Ver [instalación e inventario](database-installation.md) y ADR-027. Ningún modelo, clave o cuota se incorpora al seed.

| Recurso | Contrato vigente |
|---|---|
| `ai_provider_catalog` | `key`, nombre, activo y booleanos `can_use_api_key`, `can_use_token_plan_web`, `can_use_token_plan_agentic`. Gemini permite los tres; OpenAI API/Agentic con migración Codex aplicada en BD local el 2026-10-08, Web deshabilitado. Son permisos de configuración, no pruebas de disponibilidad. |
| `ai_providers` | `catalog_id`, nombre, `use_api_key`, `use_token_plan_web`, `use_token_plan_agentic`, `default_mode`, `is_default`, `is_active`, `auto_rotate_api_keys`, `fields`, timestamps. Los tres `use_*` son booleanos independientes. |
| Columnas retiradas | `key`, `mode` y `fields_version` no son columnas de `ai_providers`. Los getters/proyecciones de compatibilidad pueden conservar `key`/`mode`; nunca recrear las columnas por copiar DTOs antiguos. |
| `ai_api_keys` | Claves cifradas por ID de conexión; solo máscara pública. Exclusividad de selección bajo bloqueo transaccional de la instancia. |
| Modelos y opciones | `fields[modo]`; descubrimiento dinámico y selección explícita. Sin fallback de modelos ni herencia entre modos separados. |

Entidades TypeORM y migraciones son el contrato del almacenamiento. Los DBML del repositorio y `nodia.json` de Obsidian deben representar los mismos campos. El script `nodia-server/scripts/update-ai-catalog-diagram.mjs` respalda el JSON, modifica solo catálogo/instancias IA y comprueba tablas/relaciones e IDs; repetirlo no vuelve a agregar campos. No repetir la migración histórica que eliminaba configuración para reparar un diagrama.

## Formularios y paneles

- Carga inicial de Ajustes IA: mientras falte la primera respuesta de conexiones o health, mostrar un panel Boneyard visible con estado de carga ES/EN, también en enlaces directos al detalle; no mostrar un vacío ni estados operativos prematuros. Con datos en caché, la revalidación conserva el contenido con progreso sutil y el fallo muestra recuperación. El selector y las acciones de cabecera se bloquean durante la petición.
- Login Codex: `available:false` bloquea Conectar y muestra aviso dentro/fuera del modal, con reconsulta explícita. Un POST rechazado conserva modal y mensaje del servidor; `codex_runtime_unavailable` exige una observación posterior disponible antes de habilitar otro intento. Una consulta de sesión fallida también bloquea login aunque el health anterior fuera disponible. El frontend no deduce el SO del servidor ni cambia proveedor/modo.
- Etiquetas neutrales por solicitud del 2026-10-08: **Sesión Agéntica**, **Sesión Web** y **Entorno Agéntico**, sin nombres de proveedor/adaptador o plan entre paréntesis; equivalentes ES/EN. Tarjetas, formularios, detalle y avisos de sincronización usan descripciones del proveedor, sin atribuir Antigravity/Google One a otros adaptadores ni cuotas/costos fijos. Estas etiquetas no cambian el estado operativo recibido ni los contratos de autenticación.

- Añadir/editar conexión incluye el switch **Predeterminado antes de Activo** y envía `is_default`. Para la primera conexión conocida se propone activado; el usuario puede cambiarlo. Elegir otra conexión predeterminada desmarca la anterior en Server.
- El selector permite Gemini/OpenAI según el catálogo activo y su adaptador. OpenAI ofrece API y Agentic tras aplicar la migración Codex (ya aplicada en BD local); Web queda deshabilitado. La conexión OpenAI ID 4 tiene Agentic habilitado por solicitud explícita, con API como predeterminado; cuenta/inferencia y Windows pendientes. Gemini ofrece API/Web/Agentic. La autorización de API keys está vigente; excluir Gemini gratuito no significa desactivar todas las API keys.
- **Modelos precede a API keys**. Las tablas siguen el tema MUI y el contenedor/paginación del resto de Ajustes; mínimo 650 px y scroll horizontal transparente en móvil.
- Seleccionar clave usa un switch con nombre accesible. Encender una desmarca las restantes de esa conexión, incluso entre páginas y peticiones simultáneas. Con varias claves se permite apagar la seleccionada; esto deja el canal sin selección hasta elegir otra y no habilita un fallback.
- Una única clave activa queda seleccionada y su switch deshabilitado. Crear la primera, editarla o eliminar hasta dejar una normaliza esa selección en Server. Una clave inactiva no se presenta como utilizable. La migración `1791330000000` repara pools históricos con una sola clave activa sin tocar secretos ni pools múltiples.
- Eliminar es un **icono de papelera con tooltip “Eliminar clave”**, nombre accesible y `ConfirmDialog`. Fallos conservan el diálogo/formulario y sus datos; éxitos/errores tienen toast traducido ES/EN. Revalidar conserva contenido y bloquea controles durante la petición.

## Etiquetas de cuota Web

Visor Gemini Web simplificado por solicitud explícita del2026-10-13: solo acción «Enviar texto» y ojito de visibilidad dentro del TextInput; conserva borrador/foco al mostrar/ocultar. Quitar botones auxiliares de teclado/scroll/actualización/zoom, conservar clic en pantalla y cancelación del modal. Centrado vertical respecto al input desde600px; xs ancho completo con acción debajo. Recuperación automática de lecturas fallidas cada10s, un toast por episodio, sin repetir mutaciones ni borrar borrador. El polling de health de proveedores sigue120s.

Cambio de cuenta Gemini Web solicitado el2026-10-13: botón «Cambiar cuenta» exclusivo del canal Web, con confirmación del alcance compartido de servidor. Limpiar cliente/renovación, perfil y caché privados antes de abrir otro login; persistir desconexión que impida resucitar la semilla histórica tras reinicio. Operación ocupada409, fallo conserva confirmación y exige reintentar limpieza. API keys/Agentic/Codex independientes. Contrato/operación/pruebas en [visor Gemini](../features/ai-providers/gemini-web-login-viewer.md).

| ID recibido, conservado | Etiqueta de presentación |
|---|---|
| `None-11` | Gemini Flash |
| `None-4` | Gemini Pro |
| `current_5h` | Quota 5h |
| `weekly` | Quota semanal |

El diccionario fue definido por el usuario para presentación; no demuestra un vínculo oficial con IDs ejecutables de modelos. El ID original se conserva en el dato y tooltip. IDs nuevos muestran su nombre recibido. No agregar porcentajes/consumos entre ventanas, inventar límites ni sustituir valores ausentes por cero. Se mantiene la validación de origen Web, autenticación y antigüedad de la observación; `0%` real debe seguir visible.

El resumen de proveedores y el panel de detalle reutilizan el mismo diccionario internacionalizado ES/EN. En las tarjetas, el alias traducido reemplaza al ID dentro de los paréntesis de «Uso Web reportado»; los IDs desconocidos siguen visibles y el tooltip conserva el ID original. Regresión de tarjetas cubre los cuatro aliases, ambos idiomas y ceros reales.

## Razonamiento: configuración frente a ejecución

**API key:** OpenAI permite elegir Low/Medium/High/XHigh/Max; Gemini mantiene Low/Medium/High. Ultra está deshabilitado en API y el Server lo rechaza. Son preferencias del protocolo, también sin capacidades observadas; no certifican soporte por modelo. Guardar en `fields.api_key.thinking_levels[id]` y en `thinking_level` para el modelo seleccionado. Sin modelos Gemini oculta los controles; OpenAI API permite guardar una preferencia general sin inventar un modelo. No seleccionar Medium automáticamente ni heredar niveles de Web/Agentic. El análisis envía el nivel explícito del DTO o resuelve mapa del modelo → preferencia general del canal → ausencia (decisión del proveedor). Validar la configuración final antes de obtener secretos o llamar a la API. OpenAI Responses recibe `reasoning.effort`; Gemini generateContent recibe `generationConfig.thinkingConfig.thinkingLevel` en mayúsculas. No inventar presupuestos de tokens ni detectar soporte por nombre. Ante rechazo del nivel, propagar error seguro sin retirar la opción, cambiar modelo ni reintentar con otra clave por HTTP 400. Fuentes: [OpenAI Docs: reasoning](https://developers.openai.com/api/docs/guides/reasoning), [Gemini ThinkingConfig](https://ai.google.dev/api/generate-content#ThinkingConfig). Este parámetro expresa profundidad de razonamiento; no cambia el nivel comercial o de facturación del servicio.

**Agentic:** Codex presenta los esfuerzos entregados por el catálogo para el modelo exacto. Gemini presenta Low/Medium/High como preferencias de configuración por modelo en `thinking_levels[id]`; agrupa sólo variantes explícitas e inequívocas del catálogo y selecciona su ID real según el esfuerzo, conservando OCR independiente. Para el modelo seleccionado también guardar `thinking_level`; sin modelos Gemini oculta los controles, sin asignar un modelo fantasma. No seleccionar Medium automáticamente. Estas opciones no prueban soporte, autenticación ni inferencia. El adaptador CLI autorizado publica disponibilidad/sesión según evidencia real; sin binario/hash/perfil configurados mantiene `session_adapter_unverified`. En el flujo CLI con esfuerzo separado, enviar la preferencia a `--effort` comprobando el mismo ID en `/model`; rechazar sustituciones implícitas. La elección humana de una variante Gemini usa únicamente su ID explícito del mismo catálogo y tarjeta, sin fabricar equivalencias. Ningún toggle crea sesión ni consume Web. Ver [plan 32](32-agentic-cli-implementation-plan.md) y [runbook](agentic-cli-runbook.md).

**Web (integrado el2026-10-13):** selector Bajo/Medio/Alto por modelo en `fields.token_plan_web.thinking_levels[id]`; guardar también `thinking_level` para el modelo seleccionado o preferencia general cuando no hay modelos. Sin selección automática ni herencia API/Agentic. Prioridad de análisis: overrideDTO → entrada propia del mapa (null limpia) → preferencia del modo → ausencia. El booleano histórico se conserva y ejecuta solo si no hay preferencia explícita de nivel; elegir un nivel lo sustituye para esa ejecución, sin migración arbitraria. OCR permite un override temporal independiente por conexión/modelo sin modificar preferencias persistidas. Nivel y booleano explícitos juntos se rechazan, incluso false.

`gemini-webapi==2.1.1` solo publica booleano; `web_reasoning_adapter.py` utiliza un registro externo de observaciones nativas por ID/número de modelo/versión/layout. El perfil comprobado del Flash descubierto transmite Bajo1/Medio4/Alto2 en body80/header15; uploads/auth siguen en el SDK sin sustitución. `supported_options.thinking_levels_by_model` solo incluye perfiles que coinciden con el descubrimiento vivo. Otros modelos continúan configurables; un nivel explícito sin perfil produce422 y `can_use_model:false`, sin sustitución, inferencia ni fallback. Registro ausente/inválido y SDK/layout incompatible conservan errores explícitos. La aceptación del parámetro no acredita profundidad interna ni cuota.

OCR integrado privado en Ubuntu: Bajo/Medio/Alto devolvieron200 con factura sintética y ocho comprobaciones correctas por nivel. Se separa disponibilidad Gemini de R2: extracción en memoria requiere URL/token privado, no almacenamiento; guardar adjuntos conserva su contrato R2. [Implementación/evidencia](../features/ai-providers/gemini-web-login-viewer.md), [ADR-031](../architecture/decisions/ADR-031-gemini-web-reasoning-levels.md). Pruebas y aceptación VPS documentadas por separado; no generalizar un perfil a otras cuentas/modelos.

No deducir razonamiento de “Pro”, “Flash”, “Thinking” o “Gemini”. No afirmar que el proveedor razonó solo porque aceptó configurar un booleano. La integración CLI Windows con cuenta real y documentos sintéticos se comprobó por separado; suites unitarias aisladas sin cuota. Cuenta Linux-VPS y pantalla real pendientes.

## Regresiones obligatorias al modificar IA

| Caso | Garantía que debe conservarse |
|---|---|
| Crear OpenAI y marcar predeterminado | API y Agentic según catálogo migrado (Web deshabilitado); sin migrar conserva flags previos; `is_default:true` enviado y switch antes de Activo. |
| Editar conexión histórica | ID estable; no apagar API/rotación ni reemplazar modelos de otro modo. |
| Dos claves, selección concurrente | Una sola seleccionada; duplicado revierte sin perder selección anterior. |
| Primera clave / borrar hasta quedar una | Única activa seleccionada; UI activada y disabled. |
| Tabla paginada | Selección global en Server; acciones por icono y estados de carga/error/vacío recuperables. |
| Cuotas conocidas, ID nuevo y cero | Etiquetas del diccionario, fallback de ID y cero recibido; no cifras sin procedencia. |
| SDK Web compatible/incompatible | Publicar opción; enviar booleano exacto o rechazar antes de generar. Nunca inferir por nombre. |
| SDK Web con respuesta incierta | Desactivar reenvíos internos de generación (`current_retry=0` en SDK fijado); permitir solo recuperación de historial de la misma solicitud dentro del deadline. Regresión con forwarding/decorador reales del SDK, sin red. |
| Timeout/recuperación fallida en análisis | Conservar `upstreamRequestId` y `upstreamErrorCode` permitido: `analysis_timeout`/504, `provider_timeout`/504, `agentic_timeout`/504 o `provider_response_error`/502. Descartar headers desconocidos/estado incompatible y cuerpos privados; no reintentar ni cambiar motor/modelo. Plazos coordinados: upload 30 s, Python 300 s, CLI hasta 240 s, Server 340 s y Client 360 s. |
| Progreso parcial de inferencia Agentic | Conservar resumen de eventos stdout ante timeout/cancelación sin registrar texto, rutas, stderr o credenciales; datos diagnósticos inválidos/excesivos no cambian la validación de extracción. Terminar procesos propios y temporales, sin segunda generación. Un resultado observado o herramienta terminada no demuestra éxito. |
| Cancelación del OCR manual Gemini | Identidad propia antes del despacho, recibo ligado al recurso/generación/operación y contención real antes de ejecutar. Conciliar sólo tras cierre positivo del cgroup propio, retirada comprobada, líder recogido e IO cerrado; error, crash, recibo ajeno/incompatible o marcador histórico sin identidad conservan bloqueo. El terminal/ACK es local y mantiene desconocido el resultado remoto cancelado. Nueva intención explícita puede usar el archivo conservado; no replay, cambio de selección ni guardado comercial. Véanse [plan94 §37](94-business-point-of-sale-and-product-refactor.md#37-recuperación-identificada-del-ocr-manual-y-motivo-real-de-bloqueo--2026-11-06) y [ADR096 propuesto](../architecture/decisions/ADR-096-manual-invoice-ocr-cancellation-recovery.md). |
| Conflicto de admisión OCR y disponibilidad | Native y Server conservan únicamente `runtime_busy`, `native_proof_missing` y `native_proof_mismatch` con HTTP409; cuerpo privado y códigos/estados incompatibles no se propagan. La consulta devuelve `availability_reason` seguro o null, conserva la selección y no deduce sesión expirada. Client muestra el motivo y bloquea Analizar durante la comprobación GET o ante su fallo, aun con caché anterior; comprobar disponibilidad no envía la factura. Probar el handler ASGI real además de los consumidores Server/Client. |
| Cliente Web compartido/cancelación | Un análisis por cliente; un segundo recibe 503 antes de inferir. Al cancelar, cerrar transporte antes de esperar el stream, recoger la tarea y liberar admisión; la próxima solicitud reconecta. No atribuir a Google disponibilidad por aumentar plazos. |
| Razonamiento API por modelo | Low/Medium/High guardados por instancia/canal/modelo, transmitidos al proveedor; precedencia explícita y rechazo seguro sin fallback. |
| Estado ausente/malformado/caído | Thinking Web deshabilitado; cuotas desconocidas; configuración conservada. |
| Agentic sin adaptador/modelos | Preferencia configurable; estado indisponible intacto y sin ejecución Web. |
| Login Agentic desde otro equipo | Botón independiente en detalle Gemini/Agentic; enlace/código oficial remoto, sesión compartida explícita y verificación no generativa antes de éxito. Sin cambios de modelos, claves, catálogo o sesión Web. |
| Alerta de salud Agentic | Adaptador disponible sin sesión → aviso de sesión pendiente y modal de autenticación; adaptador caído/estado desconocido → reconsulta real, sin abrir edición del proveedor. Sesión disponible → sin alerta. Etiquetas/categorías ES/EN, controles bloqueados durante petición y sin éxito ficticio tras error. |
| Comprobación unificada de salud | `GET /ai-providers/health` incluye `engines` de la misma observación usada para badges/alertas, una consulta privada por petición compartida entre conexiones. Client consume una sola caché, polling/staleTime120s por solicitud del2026-10-13 y reconsulta manual única; carga inicial e invalidaciones de configuración/login conservadas. No consulta `gemini-engines` en paralelo. Liveness Docker y cachés privadas de sesión/cuota conservan sus plazos. Falta de observación → estado sin verificar. Con API predeterminada conserva la observación de sesiones habilitadas sin afirmar inferencia API. |
| Login concurrente, actor ajeno y cancelación | Un trabajo por microservicio, ownership por actor autenticado, análisis Agentic bloqueado; cancelación/plazo/shutdown limpian procesos y admisión incluso antes de iniciar la tarea. |
| Identidad real en las cinco rutas de login | `X-Nodia-Actor-Id` conserva `users.id` como cadena decimal canónica positiva dentro del rango BIGINT PostgreSQL; aceptar IDs superiores a `Number.MAX_SAFE_INTEGER` sin confundir IDs adyacentes. Rechazar UUID, ausencia, signos, ceros iniciales, espacios y desbordamientos. |
| Error de validación interna en login | GET/current y errores de actor no se presentan como código OAuth inválido. 422 público por código únicamente en POST/code con categoría privada explícita `login_invalid_code`; otros 422 privados son fallo de integración/502. Sin reflejar inputs ni cuerpos privados. |
| OAuth malformado/cuerpos excesivos | Enlace Google/callback/PKCE validado, código acotado sin controles, respuestas sin tokens ni trazas; límites HTTP y `no-store`, sin terminal genérica ni reintentos ocultos. |
| Tarjeta resumen API (OpenAI / Gemini) | Distingue canal API habilitado de tarjeta vacía; panel con modelo, OCR, razonamiento, conteo y máscara de clave seleccionada (`display_hint`); sin secretos completos; requisitos pendientes dirigen a configurar en detalle. Sin chip en conexiones exclusivamente API; API del topbar verde por clave guardada, sin acreditar inferencia ni inventar latencia, fechas o cuota. |
| Mutación rechazada | Modal e inputs intactos, feedback específico seguro y posibilidad de reintentar. |

Pruebas de componentes en Client, casos de uso en Server, integración PostgreSQL desechable (`test:ai-api:integration`) y runner aislado `nodia-gemini-microservice/run_tests.py`. Ver la evidencia ejecutada y limitaciones en `19-prelaunch-review.md`.

## Transporte Agentic recuperado — 2026-10-07

Login remoto añadido por autorización expresa: [funcionalidad en features](../features/ai-providers/gemini-agentic-authentication.md) y [ADR-017](../architecture/decisions/ADR-017-gemini-agentic-remote-login.md). El navegador cliente autentica el CLI del servidor mediante enlace/código oficial. Mantener `{job:null}` en el endpoint público de intento actual; no convertir ausencia en cuerpo HTTP vacío. El código de autorización no se persiste en BD/campos/logs y se elimina de la mutación tras enviar; si el POST falla, conservar el input para revisión/reintento. No restaurar el requisito anterior de login exclusivamente en terminal ni unirlo al botón Web. Cuenta/persistencia VPS aún requieren comprobación en ese entorno.

Rutas/opciones del frontend conservadas; Server utiliza CLI para health/modelos/sync/verify/analyze. Modelo dinámico exacto, esfuerzo elegido, sin fallback ni API/overage. Sync modifica solo `fields[modo]`, conserva otros scopes y no asigna el primer modelo. Regresión HTTP: `test/agentic-cli.integration.mjs`; integración real explícita `--live-cli` con documentos sintéticos. Retirar estas garantías exige nueva decisión y evidencia; no restaurar el stub por copiar ADR-009 histórico.

## Evaluación de plan ChatGPT — 2026-10-07

**Solicitud retomada — plan de Codex Agentic:** el usuario solicita `openai` + `token_plan_agentic`, conservando API key y sin habilitar OpenAI Web. El [plan 33](33-chatgpt-integration-pending.md) contiene CG-01..12; sustituye la prioridad exploratoria anterior de comenzar por inferencia directa. Propone descubrimiento dinámico de modelos/esfuerzos, sesión independiente por conexión, enrutamiento health/sync/verify/analyze en NestJS y migración incremental. Al implementarse y verificarse, reconciliar las garantías API-only de este contrato/AGENTS y documentar en `docs/features/ai-providers/` antes de retirar el plan. Actualización 2026-10-08: adaptador y UI Codex implementados; migración preparada, no aplicada. El usuario aplaza BD/cuenta/QA. No hay sesión/inferencia Codex real comprobada; ver el [runbook](../features/ai-providers/openai-codex-agentic.md) y ADR-018.

Continuidad: el usuario pidió conservar la integración para retomarla posteriormente en [33-chatgpt-integration-pending.md](33-chatgpt-integration-pending.md). La implementación de código comenzó el 2026-10-08; CG-01/cuenta y aceptación operativa quedan aplazados por el usuario. Los hallazgos siguientes no habilitan capacidades operativas.

Antecedente documental del 2026-10-07, anterior a la implementación actual; **sin aprobación automática de documentos**. OpenAI sigue habilitado únicamente por API key en el contrato vigente. La documentación oficial actual permite estudiar estas alternativas:

- **Agéntico:** Codex admite autenticación por cuenta ChatGPT y ofrece SDK/app-server para integraciones. Para una app con autorización propia de uso del plan, la guía de Sign in with ChatGPT describe app-server con un proveedor Responses y el access token OAuth de esa app; no requiere un segundo login de Codex. No copiar las credenciales de este chat ni reutilizar la identidad de registro de otra aplicación.
- **Inferencia directa con el plan:** la capacidad opcional ChatGPT plan usage permite solicitudes elegibles a `https://api.openai.com/v1/responses` usando OAuth, no la sesión/cookies de ChatGPT web ni sus endpoints privados. `store:false`, `stream:true`, catálogo activo de la cuenta y esperar `response.completed` son requisitos. El SDK debe configurarse sin reintentos automáticos de inferencia incierta. No confundir este transporte con API key de pago.
- **Disponibilidad y límites:** la ruta está en preview y la guía consultada se dirige a apps de código abierto y alojadas localmente; para apps de pago o alojamiento remoto remite a un proceso de interés/acceso específico, con una guía adicional de VMs autohospedadas. Verificar el encaje del despliegue concreto de Nodia y el permiso efectivo `chatgpt.tokens.use.direct` antes de inferir. Un login de identidad por sí solo no habilita consumo del plan. No asumir dos bolsas independientes “Web/Agentic”, cuotas, modelos o funciones iguales a ChatGPT web; exponer solo datos observados.
- **Documentos:** el flujo directo admite texto, imágenes y archivos cuando el modelo elegido los acepta; su Files upload API y herramientas hospedadas como Code Interpreter no están soportadas por esta ruta. Comprobar factura PNG/PDF, salida validada, cancelación, renovación OAuth y error de cuota en una prueba aislada antes de habilitar capacidades. Esa prueba no se ejecutó en esta consulta.

**Cuota identificada en documentación oficial:** la guía de usuario [Sign in with ChatGPT](https://learn.chatgpt.com/docs/sign-in-with-chatgpt) establece que las solicitudes elegibles de apps conectadas consumen el uso incluido de **Codex / ChatGPT Work**. Conectar una app no añade una asignación; su límite semanal es un tope sobre el uso del plan, no una bolsa reservada. Por tanto, en la integración propuesta tanto Responses directo como app-server usarían esa familia de cuota; llamar al directo “Web” no lo convierte en acceso al cupo de conversaciones de chatgpt.com. No confundir esta cuota con el cupo de la función Agent de ChatGPT. Codex con login ChatGPT también usa acceso por suscripción; con API key se factura en Platform. El [app-server oficial](https://learn.chatgpt.com/docs/app-server) permite consultar `account/rateLimits/read` para autenticación compatible y obtener las ventanas/buckets que entregue el servicio, sin fijar duración, porcentaje ni disponibilidad de la cuenta del usuario. Esta aclaración documental no verifica acceso efectivo ni inferencia en Nodia.

**Ubicación propuesta, sin aprobación ni implementación:** iniciar la integración como módulo/adaptadores de Nodia Server. La inferencia directa es HTTP/SSE asíncrono; el transporte agéntico necesita el runtime Codex como proceso aparte, supervisado desde Node/NestJS y conectado por stdio. El ejemplo oficial de [app-server](https://learn.chatgpt.com/docs/app-server) usa `node:child_process`; por tanto no exige un nuevo microservicio HTTP. Preservar los contratos de negocio y separar OAuth, ejecución directa y supervisor agéntico. Aislar perfiles/temporales por conexión, no heredar el entorno completo con secretos de NestJS, limitar concurrencia/tiempo/salida y limpiar procesos al cancelar o apagar. Un proceso hijo por sí solo no constituye aislamiento de seguridad: para herramientas con ejecución de comandos o acceso amplio a archivos, evaluar un worker/contenedor con privilegios mínimos antes de habilitarlas. También separar ejecución si requiere escalado o despliegue independiente, siguiendo ADR-008 cuando exista microservicio. Para una factura→JSON sin herramientas, preferir el adaptador directo; la cuota documentada no obliga a ejecutar un agente. Acceso OAuth, binario, aislamiento y funcionamiento en el despliegue real siguen pendientes de prueba.

Propuesta técnica por evaluar: dos adaptadores detrás de los contratos de Nodia (directo y agéntico), con registro/consentimiento OAuth propio, tokens protegidos y selección explícita del canal. La implementación necesitará reconciliar el catálogo, las reglas del proyecto y un ADR; no habilitar flags solo por la existencia de documentación. Fuentes oficiales consultadas: [autenticación](https://learn.chatgpt.com/docs/auth), [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk), [ChatGPT plan usage](https://developers.openai.com/siwc/token-sharing-open-source), [modelos e inferencia](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference), [Codex app-server](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server) y [limitaciones preview](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations).

## Codex Agentic preparado — 2026-10-08

La petición del usuario fija local primero y QA temporal con TryCloudflare después; posteriormente pide implementación sin levantar BD y verificación real futura. Código de Server/Client y migración preparados; no se aplicó la migración ni usó una cuenta de esta conversación.

| Regresión añadida | Garantía del código |
|---|---|
| Sesión Codex por conexión | `ai:manage`, actor derivado de autenticación, jobs privados por BIGINT/string y no-store; API no valida el canal Agentic. |
| Login remoto | Código de dispositivo oficial, polling y cancelación; código borrado en estado terminal. Modal permanece ante fallo; recuperar job evita reenviar login incierto. |
| Modelo/esfuerzo | ID exacto, esfuerzos/modos/modalidades observados; sin primer modelo automático ni herencia API. Preferencia incompatible visible/corregible; null por modelo elimina el esfuerzo. |
| Cuota | Buckets y ventanas separados, null/0 distintos; denegación solo por `ordinaryUsageAllowed:false` o error real del proveedor. |
| Analyze | Adapter Codex independiente, mismo multipart/JSON de factura; nuevo contexto, terminal validado, presupuesto global, cancelación y sin replay/fallback. |
| Aislamiento | Perfil privado/keyring fuera del repo; entorno restringido, features/sandbox verificados, solicitudes de herramientas rechazadas, procesos/salida/documentos acotados. No equivale a VM. |
| Catálogo/reversión | Migración objetivo API true/Agentic true/Web false; flags de instancias, claves/modelos y predeterminados intactos; backup de flags para down. No aplicada ni comprobada en PostgreSQL aún. |
| Alertas | OpenAI conserva ID de conexión para gestionar Codex; no abre el login Gemini ni elige la primera instancia del mismo catálogo. |

[ADR-018](../architecture/decisions/ADR-018-openai-codex-agentic.md) y [funcionalidad/runbook](../features/ai-providers/openai-codex-agentic.md). CG-01..12 conservan las aceptaciones reales pendientes en el plan 33; no borrarlo ni marcar disponible por pruebas sintéticas.

## Consola observable del análisis — 2026-10-08

[Plan 34 y evidencia](34-invoice-analysis-console-plan.md#8-entrega-local--2026-10-08), [ADR-019](../architecture/decisions/ADR-019-invoice-analysis-observations.md). Implementación local autorizada; aceptación operativa pendiente.

- Consola visible junto al drag and drop desde 900 px útiles y debajo en anchos menores; controles compartidos y borrador editable posterior. No guarda factura ni stock al terminar extracción.
- Reserva de observación sin inferencia, claim atómico antes de multipart/DTO y lectura autenticada por actor/ID/cursor, contexto exacto, no-store y límites/TTL. Reutilizar ID falla antes de otro envío; otra identidad recibe 404.
- Hitos exclusivamente observados. API/Web ofrecen detalle del adaptador; Agentic categorías del NDJSON; Codex thread/turn propios. Ningún texto de documento, stdout libre, argumentos, secretos ni reasoning. Modelos resueltos dinámicamente; desconocidos permanecen null.
- Recuperar seguimiento nunca reenvía análisis. Respuesta principal perdida sigue siendo incierta aun con extracción terminal en snapshot; no hay recuperación durable de JSON. Errores conservan entradas/archivo y un aviso por episodio; histórico fallido conserva el catálogo existente.
- Señal principal llega a API/Gemini/Codex con deadlines existentes. Cancelación Codex solo detiene el lease adquirido; eventos de turnos ajenos quedan excluidos. Renovar token pausa seguimiento; logout/cambio de sesión/negocio/desmontaje invalidan su ejecución y respuestas tardías.
- Store en memoria permite un proceso por capa. Antes de múltiples réplicas/workers, exigir TTL compartido o afinidad verificada también en Python. No acreditar disponibilidad real ni performance por los mocks/pruebas locales.


## Presentación móvil — 2026-10-09

El usuario solicita una vista más cómoda en celular con menos padding interno. AiProviders conserva los contratos y reduce paneles de listado/detalle/modelos a12px en xs, sin duplicar los16px externos de PageContent. El detalle móvil usa su cabecera propia; escritorio conserva la cabecera general. Pestañas verticales en xs, horizontales desde sm y navegación de teclado correspondiente, misma conexión/modo seleccionado sin mutaciones al cambiar vista/ancho. Nombres/IDs dinámicos envuelven; preferencia de razonamiento y foco OCR se apilan. Panel Web con label flexible y switch dentro del ancho a320px; cuotas desconocidas siguen sin cifras inventadas.

API keys presenta tarjetas en xs y tabla650px desde sm, manteniendo una consulta paginada por conexión, la máscara recibida, el switch de selección y papelera directa. Paginar/redimensionar no dispara peticiones por tarjeta ni cambia la selección global. Pendientes bloquean los controles; errores de guardado/borrado conservan formulario/confirmación y permiten reintentar. El chip del detalle se reserva a Web/Agéntico; distingue `unverified` (Sin verificar / Unverified, color neutro) de `unconfigured`.

Regresiones añadidas: selección de clave inactiva bloqueada en tarjetas, confirmación y reintento de borrado, paginación remota sin N+1, navegación vertical por teclado sin guardar otro predeterminado y estado sin verificar. Fixture aislado en `src/test/manual/ai-providers`: no usa cuentas reales, no autentica ni ejecuta inferencias. La evidencia visual no acredita disponibilidad de ningún proveedor; aceptación física y pendientes operativos previos permanecen abiertos.


## Ampliación NodiaAI AI-11/AI-12 — 2026-10-15

El adaptador de conversación privado comparte admisión por perfil físico con OCR,
login, discovery, refresh y logout. Login retiene reserva hasta el cierre real;
discovery Agentic deja de ejecutar comandos paralelos sobre el mismo perfil. La
configuración por conexión no multiplica capacidad de una misma sesión. Ante una
generación incierta, el marcador mínimo persistente conserva cuarentena sin replay,
incluido tras reinicio de proceso. No libera el perfil el borrado de un chat ni un
nuevo login. La conciliación privada exige una prueba nativa de cierre ligada a
la identidad exacta; si el proceso cayó antes de producirla o el marcador histórico
no tiene identidad, la resolución manual y su interfaz siguen AI-20/37. El recibo
mínimo se elimina con acuse posterior al commit SQL, sin conservar mensajes.

Regresión: intentar login/OCR/discovery/refresh/logout mientras chat posee el perfil
rechaza antes del SDK; cancelar login antes de iniciar libera sólo cuando finaliza
la tarea. Cancelar una generación o perder su respuesta conserva unknown, bloquea
los consumidores del mismo perfil y no reenvía. Dos perfiles distintos conservan
capacidad independiente. Modelos/esfuerzos exactos se validan contra observación
viva y protocolo soportado, sin fallback. `configuration_generation` se deriva de
la configuración propia del modo y `session_generation` cambia al reemplazar
cliente/autenticar; ninguna es una cuota ni prueba nueva de inferencia.

Web acepta únicamente conversación/solicitud de delegación; no hay tools Web.
Agentic conversacional se ejecuta en home/cwd descartables, MCP vacío y hook global
sólo `finish` con recibo validado. Para conocimiento técnico, Server puede registrar
un catálogo cerrado y atender callbacks mediante start/events/results, sin URLs de
retorno ni credenciales internas en el CLI. Se aplican presupuestos de protocolo,
autorización vigente y cierre real antes de la prueba terminal. `supports_mcp`
exige prueba explícita completa del loop real, perfil/sesión/modelo/esfuerzo,
generación de configuración y protocolo; no habilitarlo por autenticación ni health.
El gateway de negocio sigue AI-14. No cambia OCR, API key, selección dinámica ni
disponibilidad histórica de Codex. La suite aislada no equivale a aceptación con
cuenta real del nuevo runtime.

El límite de12 solicitudes por run incluye cada `tools/call`, aunque resulte
inválido, denegado o sea un replay. Native cuenta antes de validar; el intento13
termina el puente sin reenviar un callback. Los eventos IPC transportan el total
acumulado `tool_requests`; el polling privado entrega `unforwarded_tool_requests`
como total menos callbacks emitidos a Server. El adaptador valida monotonía y
presupuesto combinado. Server reserva sólo el delta oculto por intento junto al
avance RPC, y cada callback visible reserva durablemente una solicitud antes de
validación o recuperación idempotente, mediante una transacción separada que no
se revierte por el rechazo posterior. Repetir progreso no consume dos veces;
recuperar un resultado previo no repite efectos ni vuelve gratuita la solicitud.
Delegación y cambios de etapa conservan los contadores del mismo run.

Evidencia aislada del presupuesto final: Windows235 casos Python (233 correctos y
dos omisiones históricas de symlinks), Linux235/235 en imagen final con red
deshabilitada y sin montar cuentas, y55 casos unitarios del adaptador Server.
Estos resultados no certifican la aceptación final del worker con cuenta Gemini;
esa comprobación queda separada en la evidencia de integración real.


## AI-34 — contexto largo y límite observable

[Entrega80](80-nodia-ai-ai34-long-context-compaction.md) añade medición privada del prompt nativo inicial, reserva del primer listado MCP y contador acumulado de respuestas JSON-RPC completas bajo el mismo techo de 256 KiB de Nodia. No informa una ventana de tokens del proveedor ni altera el modelo/esfuerzo/motor elegido. La compactación conserva la selección exacta y no habilita herramientas, archivos ni continuación nativa opaca.

Registro de investigación AI-34: los canarios iniciales verificaron SQL y Web (extracción/continuidad); Agentic largo y una llamada MCP breve agotaron el plazo después del mensaje inicial, sin callbacks. Los intentos fueron conciliados y acusados sin replay; autenticación/catálogo/ready y cuota compartida observada no acreditaban inferencia. La instrumentación posterior detectó herramientas ajenas durante texto; un agente propio de sólo finalización permitió verificar compactación y continuidad Agentic, con citas y recibos terminales. Un rol MCP experimental terminó ERROR y se retiró, conservando el transporte y gate anterior. No se atribuye una causa que el diagnóstico no conservó ni se inventa la sintaxis de MCP en agentes personalizados. [Entrega80](80-nodia-ai-ai34-long-context-compaction.md) mantiene los resultados posteriores, imágenes, recibos y estado de aceptación vigente; estos antecedentes no lo sustituyen. Reiniciar invalida las pruebas locales de modalidad: las pruebas de texto/MCP no revalidan adjuntos por MIME. No se registran prompts ni secretos en el diagnóstico estructural.

## Operación productiva del login — 2026-11-12

La habilitación del host de [99§17](99-production-deployment-and-cicd-plan.md#17-login-de-codex-y-antigravity-infraestructura-preparada--2026-11-12)
reutiliza los flujos existentes, sin añadir capacidades, endpoints o permisos.
Codex requiere su keyring estricto y el proceso Antigravity requiere contención
real por generación del contenedor. Preparar un paquete o instalar esos servicios
no autentica una cuenta ni califica modelos, modalidades o inferencias.
Las sesiones se autorizan manualmente en los flujos oficiales, con ownership y
cierre existentes; no se copian sesiones del PC ni se sustituyen por API key.
Ver [operador](../../ops/production/ai-runtime/README.md) y [ficha candidata](../nodia-ai/knowledge/general-settings/features/ai-login-host-setup.md).

## Ajustes locales de interfaz, acceso y preferencias — 2026-11-12

Implementación en `codex/enable-ai-provider-login`, desde development. Este lote es posterior a la habilitación del login del host y todavía no está desplegado. [verificación consolidada](#verificación-consolidada-de-preferencias-y-acceso--2026-11-12) y [ficha candidata](../nodia-ai/knowledge/general-settings/features/ai-provider-interface-and-module-access.md).

- **Acciones de proveedores:** gestionar/conectar cuenta, desconectar, abrir la autorización oficial, comprobar estado y sincronizar modelos usan botones contained en los controles modificados de Codex/Gemini. Se conservan handlers, estados ocupados, confirmación y flujos oficiales. Cambia la presentación; no concede permisos ni acredita disponibilidad.
- **NodiaAI y actor actual:** el menú obtiene el contexto mediante la consulta de autorización identificada por el usuario de la sesión actual. Sin actor/contexto válido no muestra módulos. Para usuarios ordinarios, menú y guard exigen el destino canónico exacto `/nodia-ai` y la clave `nodia_ai`, sin destinos ambiguos. Renombrar un grupo, usar una clave parecida o un prefijo no concede acceso. Se preserva el bypass del super_admin activo confirmado por el usuario. El contexto cacheado sirve para navegar; el Server comprueba sesión, actividad y asignación actuales en las peticiones protegidas. No se promete actualización instantánea del menú al revocar una asignación ni se da por probada la causa del síntoma observado en producción. Ver [política89](89-module-access-and-user-data-scope.md).
- **Tarjetas Gemini Agentic:** variantes explícitas del catálogo pueden compartir tarjeta cuando etiqueta y sufijo del ID identifican inequívocamente una misma familia y los esfuerzos low/medium/high. Las variantes ambiguas permanecen separadas. Elegir esfuerzo conserva un ID real de esa tarjeta; no fabrica un modelo base ejecutable. Una tarjeta no seleccionada conserva la elección local sin cambiar silenciosamente el modelo activo. La selección OCR permanece independiente y muestra su variante concreta cuando difiere. Una preferencia guardada contradictoria se advierte; no se corrige silenciosamente ni demuestra capacidad por el nombre.
- **Preferencias API:** OpenAI admite low/medium/high/xhigh/max como valores del protocolo; Gemini mantiene low/medium/high. Ultra está deshabilitado con explicación en API y se rechaza en Server. Esta validación no afirma soporte de cada modelo: un rechazo del proveedor conserva el error, sin degradación automática, cambio de modo, conexión o modelo. Catálogo, clave, login y preferencia guardada no prueban inferencia.

Verificación local al registrar este corte: build Server completo, 60 pruebas de políticas de autorización, 74 comprobaciones HTTP de guardas y 249 regresiones de preferencias API correctas. El ensayo HTTP usa routing/guardas Nest reales con fronteras sintéticas de sesión/persistencia; no equivale a PostgreSQL o proveedor real. Build Client (TypeScript sólo durante build), lint global, ProviderDetail38 y helper5 correctos; QA Chromium320/1280 ES oscuro Gemini/Codex y EN claro API sin desbordamiento y con controles44px/acciones contained comprobada. Suite global Client: 2812 casos/349 archivos; dos fallos de fixtures de Home corregidos y revalidados junto al hook real (12/12). ProviderDetail38 pasó por separado; 2850 casos únicos verificados, sin repetir la suite global tras el ajuste exclusivo del fixture. Sin inferencias reales, publicación de fichas aprobadas o despliegue de este lote.

## Consumo de salud y observación Codex — candidato local, 2026-11-12

La cabecera consumía el snapshot agregado de `/ai-providers/health`, mientras la gestión de cuenta consultaba la sesión Codex. Esas fuentes pueden tener distinta antigüedad; un snapshot process-local no verificado no demuestra desconexión actual. El cambio Client añade una observación compartida acotada de la cuenta para la instancia OpenAI predeterminada activa con Agentic habilitado y sesión de aplicación válida. La identidad de la consulta incluye sesión autenticada/versión e instancia; no se reutiliza una cuenta de otro actor o conexión. No cambia los endpoints, permisos administrativos o autoridad Server.

Actualizar consulta primero salud y después la observación de la instancia predeterminada resultante; comparte la petición exacta en vuelo y no informa éxito si falla la lectura. No añade polling de sesión. Ausencia de observación, error o estado desconocido se mantiene no verificado; denegaciones explícitas de autenticación/uso no se convierten en verde. Estado de sesión disponible y autenticada sigue describiendo sesión, no inferencia o capacidad del modelo; API conserva su indicador de configuración separado.

Es un lote local verificado por alcance junto a [Teacher96§42](96-nodia-teacher-implementation-plan.md#42-alta-guiada-selección-visible-y-estado-agentic--candidato-local-2026-11-12), con [verificación consolidada](96-nodia-teacher-implementation-plan.md#verificación-local-y-diagnóstico-de-producción--2026-11-13). Build/lint Client, 382 regresiones en51archivos y QA Chromium320/1280 correctos; SQL READ ONLY productivo confirmado:0recibos Agentic y tabla por propósito ausente en f01; no se atribuye una causa operativa universal ni se acredita despliegue, login, inferencia o publicación.

### Verificación consolidada de preferencias y acceso — 2026-11-12

Cambio local de acciones contained, identidad ordinaria NodiaAI y preferencias/modelos: build Server y Client correctos, TypeScript sólo dentro de cada build; lint Client global correcto. Regresiones Server:249 de preferencias API/8archivos,60 de autorización y74 comprobaciones HTTP de Nest con fronteras sintéticas de sesión/persistencia. Regresiones Client:83 de acceso,38 de ProviderDetail y5 del helper de tarjetas. Suite global2812 casos/349archivos: inicialmente2810 correctos y2 fallos de fixtures Home; se corrigieron y revalidaron con Home5+hook7, sin repetir toda la suite. ProviderDetail38 pasó por separado;2850 casos únicos verificados al consolidar esos cortes. Estos cortes y subconjuntos pueden solaparse: no son ejecuciones productivas ni deben sumarse indiscriminadamente.

QA Chromium sintético, a320/1280px: Gemini Agentic y Codex ES/oscuro, OpenAI API EN/claro; documento310/1270px sin overflow. Acciones contained/targets44px comprobados; esfuerzos API envuelven y Ultra permanece deshabilitado. No se usaron cuentas ni inferencias reales y no se aisló una causa productiva del síntoma de acceso.

Los7 bindings técnicos de preparación de proveedores/API keys conservan IDs, revisiones, esquemas de entrada/salida y módulos. El refresco fija `build-nodia-ai-provider-operations.use-case.ts` a `55c264e5d4d97a64b34182cff700493ec220be2bb30c5aef063d00e8f830cb9c` e incorpora `common/ai/api-reasoning.ts` con SHA-256 `eae4856f7a74d37cad55ac72ab03971c5252d5ac75f2406532c622a2931f2b16`. Esta sección conserva la evidencia sustantiva para sus referencias; no es una aprobación documental ni una nueva herramienta. Los44 documentos aprobados siguen intactos; fichas candidatas draft/unregistered/approval:null. Sin despliegue del lote, inferencia real, fallback o nueva publicación solicitada.

## Ajustes de presentación y consultas autenticadas — 2026-11-12

Solicitud explícita vigente: en Gemini, sin modelos disponibles no se muestran
Low/Medium/High ni la explicación de esa preferencia, en Agentic y API key. La
capacidad histórica de persistir una preferencia general no obliga a ofrecer
ese control sin modelos. No borrar thinking_level/thinking_levels existentes,
asignar un modelo de respaldo ni cambiar la selección al ocultar el bloque.
Con modelos presentes continúan las preferencias por modelo y su distinción
respecto de disponibilidad/inferencia. El comportamiento de otros proveedores
se conserva.

Los avisos Codex de runtime no disponible/error de observación usan recarga
mediante IconButton de 44×44, nombre accesible y tooltip ES/EN «Volver a comprobar
estado». Conservan el mensaje y las restricciones de Conectar; se bloquea la
reconsulta durante la petición. El icono sólo solicita estado y no inicia login,
inferencia o una configuración del servidor.

Las observaciones health/Codex y lecturas de login esperan una sesión Nodia
validada. Health deja de sondear tras 401/403 y admite reconsulta explícita;
los fallos de servicio mantienen su estado real/cadencia existente. Gemini 503
no se convierte en «sin trabajo» o «sesión cerrada»; puede indicar servicio
privado no configurado o indisponible y necesita diagnóstico del servidor.
No se acreditó la causa exacta de los 401 de la captura del usuario.

El frontend Pages declara Cross-Origin-Opener-Policy: same-origin-allow-popups,
igual que el servidor Vite de desarrollo, para compatibilidad con el popup de
Google. No se modifica el login, permisos, CORS o política global de sesión.
El warning del SDK no acredita un fallo de Gemini y no se garantiza su ausencia
sin comprobar el despliegue y el flujo Google reales. [Fuente Google](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid#cross_origin_opener_policy).

Implementación local en codex/fix-ai-provider-state-ui desde development (9495751a);
sin despliegue/VPS/login/inferencias reales. [Ficha candidata](../nodia-ai/knowledge/general-settings/features/ai-connection-settings-ui.md)
y [verificación consolidada del alcance PR4](#verificación-consolidada-del-arreglo-ui-incorporado-desde-pr4) separan pruebas
sintéticas, build y comprobación visual de la aceptación productiva pendiente.

### Verificación consolidada del arreglo UI incorporado desde PR4

Alcance original `codex/fix-ai-provider-state-ui`, base development9495751a: Gemini sin controles de potencia ni explicación cuando no hay modelos en Agentic/API key; recarga Codex por IconButton44px; consultas protegidas por sesión y fin del polling de salud tras401/403;503 conserva error real. Pages incluye el header COOP `same-origin-allow-popups`, con artefacto verificado en build; no acredita el popup Google desplegado ni modifica CORS, login o autorización.

El corte original pasó144 pruebas del directorio IA/13archivos y156 finales IA+cabecera/14archivos. La suite inicial completa tuvo2842 casos/349archivos:2830 correctos y12 fallos de fixture de sesión validada en AiProviderIndicators. El fixture se corrigió y los12 casos quedaron cubiertos por el lote focal final; no se repitió la suite completa. Lint global previo y lint del test corregido correctos. Build correcto, con TypeScript sólo dentro de `npm run build`, warning de chunk grande existente y `_headers` presente. Son resultados del alcance previo, no una revalidación del merge con los cambios posteriores.

QA Playwright CLI con fixture sintético a320/1280px: Gemini vacío sin botones de esfuerzo, documento móvil320/scroll320; recarga Codex44×44 sin texto visible, tooltip/nombre accesibles y Conectar bloqueado cuando el runtime no está disponible. Sin OAuth/cuentas/inferencias reales; correcciones del servidor temporal de QA/ruta simulada no cambiaron la configuración de seguridad de Vite.44 documentos aprobados conservaron sus bytes; la compilación de conocimiento no publicó otra revisión. Causa exacta de los401, disponibilidad real Gemini y warning COOP productivo pendientes de evidencia propia. Ver [ficha candidata](../nodia-ai/knowledge/general-settings/features/ai-connection-settings-ui.md), que sigue draft/partial/unregistered/approval:null.
