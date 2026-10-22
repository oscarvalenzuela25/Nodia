# NodiaAI AI-23 — conjuntos de operaciones dependientes

> Estado documental: en revisión; sin aprobación automática.
> Fecha: 2026-10-17.
> Estado técnico: implementación, integración SQL/HTTP/procesos y activación del laboratorio privado verificadas; publicación de preparadores MCP y aceptación de escrituras con Gemini pendientes.
> Dependencias: [plan45](45-nodia-ai-implementation-plan.md), [contratos41](41-nodia-ai-v1-contracts.md), [arquitectura43](43-nodia-ai-execution-architecture.md), [borradores63](63-nodia-ai-ai17-drafts-revisions.md), [confirmación64](64-nodia-ai-ai18-human-confirmation.md), [recuperación66](66-nodia-ai-ai20-execution-recovery.md), [Finanzas67](67-nodia-ai-ai21-financial-operations.md) y [Negocios68](68-nodia-ai-ai22-business-operations.md).

## Alcance y límites

La unidad de revisión deja de estar limitada a una operación: el coordinador puede reunir de uno a ocho borradores de la misma conversación y actor en una propuesta ordenada. Los 26 puertos nativos existentes conservan contratos, permisos y escritores; no se convierte una secuencia en una importación masiva ni se habilitan los handlers bulk excluidos de v1.

El primer enlace de datos habilitado es crear un proveedor comercial y después crear su contacto: `nodia_providers_prepare_create.id → nodia_provider_contacts_prepare_create.provider_id`. La existencia de `outputKeys` y `bindableFields` no habilita combinaciones no implementadas. No hay SQL, expresiones, rutas JSON, búsqueda para adivinar el ID ni interpolación del resultado textual del modelo.

Las operaciones se ejecutan de manera secuencial. Cada efecto local conserva su transacción atómica con recibo; el conjunto completo puede terminar parcialmente. No existe una transacción distribuida o compensación automática. Un fallo detiene los pasos siguientes, aunque no dependan del paso fallido.

El registro coordinador utiliza `nodia-ai-ai23-workflow/1`; cada paso conserva también su herramienta y hash de contrato nativo. Los preparadores siguen siendo internos, sin publicación MCP por esta entrega. Conservar los gates de R2 y Gemini de AI-15/22 y los adjuntos nuevos/traslado de facturas con archivo de AI-32.

## Preparación desde borradores

`nodia_workflows_prepare` recibe `catalog_version`, una lista ordenada `draft_ids` sin duplicados y, cuando corresponda, bindings explícitos con `draft_id`, `target_field_key`, `from_draft_id` y `output_key`. La lista determina el orden; el coordinador no reordena silenciosamente la intención del usuario.

Server comprueba pertenencia, conversación, actor, vigencia, versiones de contrato, autoridad actual, mínimos y compatibilidad de referencias. Los borradores individuales se reclaman una sola vez. Sus propuestas listas anteriores pasan a `superseded` en la misma coordinación que crea la conjunta; no puede admitirse la propuesta individual y el conjunto para duplicar una intención.

Una dependencia sólo puede referir un paso anterior de la misma revisión. Se rechazan referencias cruzadas, a sí mismo, futuras, duplicadas o incompatibles. `depends_on` y `output_bindings` describen el mismo enlace; no se mantiene una tabla de aristas ni se añade un scheduler de grafos.

El contacto necesita su negocio y sus demás datos mínimos completos. Sólo el ID registrado del proveedor puede quedar futuro. La vista previa no inventa un ID, deja `after:null`, `after_present:false`, `origin:future_step` para `provider_id` y muestra la referencia tipada al paso anterior. Campos opcionales conservan los defaults reales del escritor; se pregunta lo ambiguo o requerido.

## Revisión y confirmación humana

La propuesta congela todos los pasos, su orden, scopes, precondiciones y enlaces. El botón de la app confirma una revisión y hash exactos para el conjunto; una aceptación textual del modelo no sustituye el canal humano de AI-18.

Corregir una propuesta todavía lista produce otra revisión/hash, con IDs de paso nuevos y referencias remapeadas conjuntamente. Los campos editables pertenecen al par `step_id/field_key`, por lo que dos campos Nombre no se confunden. El campo `provider_id` futuro no se expone como un input de ID libre. Cambios materiales exigen mostrar y confirmar otra revisión; no se recalculan silenciosamente después del botón.

Tras un fallo, la reanudación conserva los mismos comandos y recibos. Corregir lo pendiente constituye otra propuesta con nueva confirmación; no convierte el consentimiento previo en permiso para otros valores. La relación `prior_execution_id` enlaza esa continuación con la ejecución anterior y sus pasos comprometidos. La preparación de esa corrección sigue siendo un caso de uso interno: no se inventa una nueva ruta HTTP o herramienta publicada por documentarla.

## Ejecución y first-bind

El worker procesa la siguiente operación elegible y nunca vuelve a ejecutar un paso `completed`. Para resolver un binding exige el recibo comprometido y validado del antecedente correcto. Sólo extrae la salida `id` registrada, manteniendo bigint como string; una salida textual parecida o un registro hallado por nombre no sirve de fuente.

El primer enlace guarda un envelope cerrado en `execution_steps.bound_command`, con `command_template`, `scope` y `preconditions`. Su hash y vínculo con la revisión permiten conservar exactamente la resolución inicial durante la recuperación. El comando enlazado no es una nueva propuesta redactada por el modelo. Debe preservar los demás campos, ámbitos y efectos aprobados, y validar la relación efectiva del proveedor con el negocio.

Este payload se escribe una vez bajo las barreras transaccionales del coordinador; no se cambia al reanudar. La resolución inicial tiene una transacción corta separada antes del efecto. El escritor nativo, su recibo y la transición del paso se comprometen juntos una vez; no se mantiene una transacción SQL abierta durante todo el conjunto. Se conserva el payload mientras exista su paso fuente y se elimina con la purga correspondiente. No se crea otra tabla de workflows, de enlaces o de recibos.

Cada escritor comparte el manager con el recibo y la transición del paso. La ejecución siguiente sólo puede utilizar una salida tras su commit comprobado. Si se pierde la respuesta de COMMIT, recuperar primero; no repetir un escritor ante incertidumbre. La caída de un proceso o la salida del navegador no sustituye la fuente durable SQL.

## Fallos, reanudación y cancelación

| Situación | Resultado esperado |
|---|---|
| Proveedor y contacto completados | Dos recibos, conjunto completado |
| Proveedor completado y contacto falla antes del efecto | Proveedor conservado, contacto fallido, conjunto parcial y pasos posteriores detenidos |
| Reanudar tras rollback probado del contacto | Mismo proveedor y mismo binding; sólo se intenta el contacto pendiente bajo autoridad y precondiciones actuales |
| Resultado incierto | Conciliación del recibo/identidad original antes de habilitar otro intento |
| Corregir datos pendientes | Otra propuesta y botón; enlace a ejecución previa, sin duplicar proveedor |
| Cancelar después del primer commit | Se conserva el proveedor; se detienen o concilian los pasos aún no comprometidos |
| Revocación de módulo/sesión o cambio material | Rechazo o invalidación conforme al contrato; el recibo histórico no se borra para fingir rollback |

La cancelación no es un deshacer de los datos de Negocios. El estado público muestra cada paso y su recibo, incluyendo los ya completados aunque el conjunto falle o se cancele. `can_resume` viene de Server; el navegador no deduce que reintentar sea seguro por ver un error. La posibilidad de cancelar lo pendiente es independiente de poder reanudar: un fallo de precondiciones puede bloquear resume y todavía permitir abandonar el sufijo. El botón desaparece cuando los pasos restantes ya están cancelados u omitidos.

## Persistencia, autoridad y retención

Se reutilizan propuestas/revisiones/pasos, ejecuciones/pasos, grants, jobs, witness y outbox. La migración `1792700000000-AddNodiaAiWorkflowBindings` añade dos columnas, sin tablas nuevas: `nodia_ai_execution_steps.bound_command` JSONB nullable y `nodia_ai_proposals.prior_execution_id` UUID nullable. El campo `prior_execution_id` de la ejecución ya existía y ahora conserva el mismo linaje de su propuesta confirmada.

El envelope interno tiene tres claves permitidas y participa en el hash del comando enlazado; la restricción SQL exige objeto acotado, hash y paso fuente. Triggers impiden reescribir el payload/hash inicial y cambiar el linaje mientras exista su origen. Al retirar la fuente durante la purga se borra también el payload, incluso si el paso aún requiere conciliación. El rollback de la migración exige que no queden payloads ni relaciones de continuación vivos, para no perder intenciones silenciosamente.

Se comprueban los módulos NodiaAI y de destino, el actor/sesión y las reglas de cada dominio en preparación, confirmación y ejecución. `super_admin` conserva transversalidad bajo su propia identidad, sin autorizar a otro actor a confirmar su chat. El conjunto no concede permisos implícitos al paso dependiente.

La política de 90 días desde el último mensaje del dueño sigue vigente. Expirar el chat elimina comandos, referencias y recibos resueltos; no elimina los proveedores/contactos creados. Sólo se conservan descriptores mínimos no ejecutables de trabajos todavía inciertos hasta conciliarlos, conforme50/66. No se crea un archivo técnico perpetuo.

## Client y contexto funcional

La vista previa mantiene el orden recibido y muestra la dependencia y el ID futuro con etiquetas ES/EN. El editor agrupa campos por paso con identidad estable y conserva borradores/foco ante error o cambio de ancho. Los resultados parciales explican que los commits se conservan y que reanudar continúa lo pendiente. Recuperar estado usa GET; los POST humanos mantienen CAS e identidad de solicitud.

La invalidación de caché se deduplica por `step_id/recurso/id`, no sólo por recurso. Así un segundo paso que edite el mismo proveedor puede refrescar Negocios nuevamente, sin repetir escrituras por observar el estado. Las respuestas tardías de otra sesión no invalidan la caché del actor actual.

La [ficha de coordinación](../nodia-ai/knowledge/nodia-ai/features/conversation-coordination.md) y el [producto NodiaAI](../nodia-ai/knowledge/nodia-ai/README.md) registran esta ampliación como draft/unregistered. No se modifican los cuerpos aprobados de las lecturas. El backend sigue cargando assets compilados/filtrados; añadir documentación no publica preparadores ni habilita permisos.

## Verificación y continuidad

La [integración AI-23](../evidence/nodia-ai-ai23-postgresql.json) pasó **47 comprobaciones** con PostgreSQL16 desechable, HTTP compilado y procesos reales del worker en la VM privada. Incluye migración down/up en journal vacío y rechazo de rollback con payload vivo; preview proveedor→contacto, sustitución de propuestas individuales, carrera de confirmación/reclamación, revisión con IDs remapeados y secuencias de dos a ocho operaciones independientes. Las referencias inválidas se rechazan sin reclamar los borradores.

Se comprobaron el fallo SQL del contacto después de comprometer proveedor, reanudación repetida con el mismo ID/request_key/hash, corrección material con nueva propuesta y linaje, cancelación entre commits y cambio de proveedor antes del primer enlace. Un SIGKILL tras el primer commit conserva el proveedor; otro tras el first-bind permite recuperar el mismo payload. La pérdida de respuesta de COMMIT del contacto recupera ambos recibos sin replay. La caducidad elimina los journals y payloads resueltos, conserva los registros de negocio y concilia el paso pendiente expirado sin ejecutarlo.

Una compilación anterior de esta entrega pasó [229 comprobaciones de regresión](../evidence/nodia-ai-ai23-regressions.json): AI-17 (52), AI-18 (37), AI-20 (36), AI-21 (47) y AI-22 (57). Las47 finales también verifican cancelar un conjunto no reanudable y preparar otra propuesta cuando el proveedor cambió antes del primer binding; la ejecución original mantiene su rechazo estricto. Son **276 comprobaciones SQL/HTTP/procesos numeradas**, con hashes de artefacto separados y trazables, además de pruebas unitarias y QA. Los fixtures usan identidad y datos sintéticos, sin la base configurada, R2 ni el proveedor real; no se presenta el guard de autenticación sintético como prueba de una interacción humana física.

La suite Server final pasó **2.317 pruebas en190 archivos**, con cuatro workers,103,69s (`.tmp/ai23-server-release-tests.log`). Client pasó **1.403 pruebas en201 archivos**, con **30 pruebas focalizadas posteriores** del componente de ejecución tras el ajuste de cancelación no reanudable. No se suman esas30 al total de la suite completa, pues se superponen. Build, tipado y lint terminaron correctamente; Server conserva tres advertencias anteriores y Client la advertencia histórica de tamaño de chunks. La validación estática comprueba135 definiciones comunes,184 de dominio,134 contratos cerrados,340 fixtures y631 hashes fuente.

El [validador de conocimiento](../evidence/nodia-ai-ai23-knowledge-validation.json) pasó53 comprobaciones:52 fixtures del compilador y un control del corpus actual,46 fuentes/19 excluidas,27 documentos/fragmentos y67 capacidades de lectura. Se actualizó su expectativa histórica de inventario AI-19 para contrastar el release vigente de AI-22 y ambas fichas de escritura excluidas. Se mantienen los cuerpos aprobados, permisos y procedencia de AI-15, los fixtures negativos y el modo histórico; no se publicaron contenidos por ajustar el validador.

La [QA de navegador](../evidence/nodia-ai-ai23-ui-validation.json) usa el origen aislado5194 y transporte exclusivamente sintético. Verificó preview en español, dos campos Nombre separados por paso, borrador/foco al cambiar al viewport solicitado390×844, revisión2 con contacto corregido y proveedor conservado. En inglés verificó fallo parcial, recibo histórico del proveedor y reanudación explícita que conserva su bigint y añade el del contacto, con toast de éxito. Las capturas registran el tamaño real devuelto por el navegador y no acreditan un teléfono físico ni teclado virtual.

Capturas: [editor móvil ES](../evidence/nodia-ai-ai23/mobile-workflow-editor-es.jpg), [resultado parcial EN](../evidence/nodia-ai-ai23/desktop-partial-receipt-en.jpg) y [recibos tras reanudar EN](../evidence/nodia-ai-ai23/desktop-resumed-receipts-en.jpg). La pestaña temporal se cerró, se restauró el viewport y se detuvo sólo el servicio QA; la pestaña habitual5174 no se modificó.

La [activación del laboratorio](../evidence/nodia-ai-ai23-lab-activation.json) tomó backup y aplicó exclusivamente `AddNodiaAiWorkflowBindings1792700000000`. [Estado final](../evidence/nodia-ai-ai23-lab-runtime.json):25 migraciones,18 tablas NodiaAI/241 columnas,26 ejecutores, API/worker activos y cero jobs pendientes, intentos abiertos o slots retenidos/desconocidos. Los [820 archivos dist desplegados](../evidence/nodia-ai-ai23-deployed-equality.json) coinciden con el artefacto final de856 archivos `a88e0937…`. Entorno, dependencias y perfil Gemini conservados; Client5174 y túnel3100 iniciados y sus rutas HTTP/proxy verificadas. No se hicieron inferencias Gemini ni se publicaron preparadores MCP de escritura; el release conserva67 lecturas/referencias y27 fragmentos funcionales. La [evidencia consolidada](../evidence/nodia-ai-ai23-validation.json) distingue compilaciones, pruebas y pendientes.

[ADR-050 propuesto](../architecture/decisions/ADR-050-nodia-ai-dependent-workflows.md) documenta las alternativas y costes. No se aprueba la documentación ni se amplía el release de lecturas por implementar una etapa técnica.
