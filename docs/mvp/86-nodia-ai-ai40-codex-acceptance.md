# AI-40 — Codex en el drawer y aceptación Linux

> Estado: borrador de trabajo, sin aprobación ni publicación automática.
> Fecha: 2026-10-22. Autorización: el usuario solicita integrar Codex en el drawer, verificar su cuenta y MCP, levantar los servicios y utilizar subagentes.

## Fuentes y alcance

Este documento organiza [AI-40 del plan 45](45-nodia-ai-implementation-plan.md#e11--codex-agentic-en-nodiaai), después de la [integración AI-39](85-nodia-ai-ai39-codex-runtime.md#continuación--integración-del-adaptador-worker-journal-y-gateway). Conserva el [contrato de proveedores](ai-provider-feature-contract.md), el [canal seguro de Codex](../features/ai-providers/openai-codex-agentic.md) y las reglas de [adopción y reversión](../evidence/nodia-ai-ai38-delivery-runbook.md). El historial de AI-38 y sus gates permanecen independientes.

El objetivo es seleccionar explícitamente una conexión `openai` en `token_plan_agentic`, con modelo/esfuerzo observados, y utilizar el mismo historial y gateway de NodiaAI. API y OpenAI Web no se incorporan; la delegación opt-in Web→Agentic sigue dentro de su conexión Gemini. El modo predeterminado de las conexiones no cambia al elegir Codex en un chat.

## Estado comprobado al comenzar

- AI-39 integra adaptador, router, worker, journal privado y gateway; sus ensayos usan PostgreSQL real y un peer JSONL sintético. No prueban una generación real de la cuenta. Su [entrega](../evidence/nodia-ai-ai39-worker-runtime-r01.md) identifica los snapshots y límites.
- El código inicial de `CodexNodiaAiAdapterUseCase.observe` devuelve `supportsMcp:false` y arrays vacíos de originales verificados. Autenticación y catálogo correcto no permiten convertir esos campos en disponibles sin evidencia propia.
- Existe un panel de cuenta Codex en Ajustes IA, exclusivamente en la pestaña Agéntico de OpenAI. Usa el código de dispositivo oficial, ownership por actor y respuestas `no-store`; no necesita un flujo OAuth paralelo para el chat.
- El ensayo Ubuntu histórico de sesión/OCR no acredita la sesión ni inferencia actuales, ni los formatos del nuevo chat. La conexión Linux debe descubrirse en ese entorno; no reutilizar el ID de una conexión Windows por coincidencia de proveedor.
- No se ha ejecutado ninguna comprobación nueva de VM, cuenta, UI o proveedor al redactar esta matriz. Las filas pendientes no se consideran aceptadas por su definición.

## Matriz de aceptación

Cada evidencia debe identificar paquete Server/Client, binario Codex y hash, entorno, conexión, generación de sesión/configuración, modelo e intensidad efectivos, fecha del servidor y alcance exacto. Un fallo permanece en su recibo original; una prueba sucesora no lo reescribe.

| Gate | Verificación | Evidencia mínima | Estado inicial |
|---|---|---|---|
| C40-01 | Entorno y reversión | Servicios efectivos, paquetes/manifiestos, esquema, pendientes SQL/nativos, configuración protegida y backup cifrado fresco | Pendiente de observación actual |
| C40-02 | Cuenta y catálogo | Sesión propia consultada desde Nodia, ausencia de credencial plana, IDs/esfuerzos entregados por el runtime | Pendiente actual; antecedente histórico insuficiente |
| C40-03 | Drawer | Conexión exacta, sólo modo Agentic para OpenAI, selección dinámica, ES/EN, permiso y errores recuperables; borrador/foco intactos | Pendiente de implementación y UI |
| C40-04 | Conversación real | Un mensaje autorizado, un `turn/start`, terminal propio, respuesta semántica, cierre y ACK; sin fallback ni replay | Pendiente |
| C40-05 | MCP técnico | Catálogo exclusivo de prueba, nonce no predecible devuelto por un callback autorizado, atestación terminal y ACK | Pendiente; no habilitar desde health/login |
| C40-06 | Lectura de producto | Herramienta publicada, actor/alcance revalidados, datos verificables contra origen, recibo y proyección UI | Pendiente por familia pertinente |
| C40-07 | Propuesta y efecto | Preparador ya publicado, revisión/hash exactos, botón pulsado por el humano, una ejecución/recibo/efecto visible | Pendiente; no publicar preparadores para completar el ensayo |
| C40-08 | Continuidad | Cambio explícito Gemini↔Codex entre turnos; historial, decisiones, preferencias y efectos conservados; salir/volver y recarga | Pendiente |
| C40-09 | Recuperación y autoridad | Cancelación y conciliación, incertidumbre sin replay, acceso retirado y exclusión con login/OCR; compactación por el contrato común | Fixtures AI-39 son antecedentes; aceptación real pendiente |
| C40-10 | Originales | Imagen, PDF y audio por MIME/modelo/conexión; resultado semántico y límites de app, sin transferir proofs OCR/Gemini | Bloqueados hasta su propia aceptación |
| C40-11 | Entrega | Manifiestos congelados y fuentes coincidentes, aceptación acotada y limpieza; runbook actualizado sin afirmar Windows/producción | Pendiente |

## Primer recorrido de cuenta y herramientas

1. Observar la VM y comprobar que no haya operaciones SQL/nativas activas antes de adoptar otra versión. Registrar qué servicios se reanudan y qué procesos permanecen intactos.
2. Abrir Ajustes IA de la conexión OpenAI del entorno y su pestaña Agéntico. Consultar sesión antes de iniciar login. Si hace falta autorización, recuperar primero el intento vigente mediante `GET /ai-providers/:id/session/login/current`; crear un intento sólo si no existe uno recuperable.
3. El usuario introduce el código exclusivamente en `https://auth.openai.com/codex/device`. Ni código ni tokens van a mensajes del chat, herramientas, fixtures o evidencias públicas. No copiar el `auth.json` ni el perfil de la app Codex.
4. Consultar la sesión final y sincronizar modelos a través de los contratos existentes. La elección debe proceder del catálogo real; conservar desconocidos y preferencias incompatibles de forma explícita, sin seleccionar el primer modelo ni una versión estática.
5. Con el paquete nuevo verificado, probar conversación de texto sin herramientas. Registrar una sola generación y conciliar su terminal antes del siguiente intento.
6. Ejecutar un canario MCP privado de lectura mediante el adaptador/gateway autorizado, con nonce y catálogo mínimo. El éxito necesita callback y terminal/ACK; `tools/list`, login y catálogo no son suficientes. El recibo técnico debe quedar ligado a la identidad/configuración efectivas para no heredarlo tras cambiar cuenta, binario o selección.
7. Probar desde la UI autenticada una lectura publicada y su correspondencia de datos. Preparar un cambio únicamente si su contrato ya está publicado; el agente no pulsa el botón humano ni convierte un consentimiento escrito en confirmación del hash.

El registry actual incluye los preparadores publicados `nodia_finance_movements_prepare_create`, `nodia_preferences_prepare` y `nodia_workflows_prepare`, además de `nodia_proposals_get`. Un gasto pendiente mínimo de prueba puede servir para C40-07 si el actor tiene acceso al módulo, una categoría válida y los datos obligatorios. La categoría/propietario se descubren en la VM; no se fijan los IDs de otra evidencia. La publicación no demuestra aceptación Codex de esas capacidades y no sustituye la comprobación humana del cambio concreto.

Una prueba que agota tiempo no se reenvía. Se consulta su journal y se concilia/cancela por la identidad persistida; un resultado incierto mantiene su reserva hasta obtener prueba válida. El diagnóstico público sólo contiene categorías, tiempos, contadores e identidades técnicas necesarias, sin argumentos privados, documentos, tokens o stdout libre.

## Adopción y reversión del paquete

El driver histórico `nodia-ai-ai38-owner-adopt.py` **no es un desplegador genérico**: fija dos releases, el bundle 418900…, conteos e inventario iguales y únicamente las cuatro diferencias del selector de propietario. No se debe ejecutar para AI-39/40 quitando sus validaciones. Los scripts históricos son referencias verificadas de su propio paquete.

Preparar un manifiesto y driver sucesores para un release nuevo, sin sobrescribir el anterior. El paquete incluye código/build/configuración pública; excluye `.env`, perfiles y `node_modules`. Verificar las dependencias Linux y sus hashes. La adopción debe cambiar juntos API y worker, preservando los descriptores privados del entorno, el journal externo, sus timers, credenciales protegidas y sesiones Gemini. El descriptor de backups también apunta al release: inventariar los drop-ins de API/worker y `backup-runner.env`, además del destino efectivo de la UI/proxy.

Antes de cambiar descriptores: backup cifrado fresco, prueba de recuperabilidad aplicable, admisión cerrada y drenaje comprobado; verificar esquema, configuración y paquetes del rollback. No aplicar migraciones o restaurar SQL por comodidad. La actualización de hashes de procedencia de AI-39 cambia su bundle local sin ampliar las 74 capacidades/31 fragmentos; el release operativo anterior sigue siendo un antecedente hasta una adopción registrada.

El código previo a AI-39 no interpreta los dispatch Codex schema 2. Por ello, la reversión de archivos sólo es segura cuando no quedan jobs/intentos/slots ni pruebas Codex sin conciliar, y los resultados terminados han quedado persistidos. Si un dispatch continúa incierto, mantener mantenimiento y el runtime capaz de conciliarlo; no borrar journal, liberar locks por antigüedad ni iniciar el prompt en el paquete previo. Un rollback no revierte efectos comerciales confirmados ni justifica un restore de BD.

La UI debe servirse desde el Client congelado cuyo manifiesto fue verificado. Un Vite local con código nuevo no acredita que nginx esté sirviendo ese build; registrar cada superficie realmente usada y conservar la reversión del proxy.

## Publicación y límites

El canario de transporte acredita herramientas dinámicas de esa combinación; no publica contratos nuevos ni certifica todas las operaciones de negocio. Los 77 candidatos de AI-36 conservan su proceso de aceptación/publicación. Las fichas documentan comportamiento y no autorizan herramientas. La falta de preparadores publicados bloquea C40-07 y se registra, sin reemplazar el gateway por SQL/shell ni alterar la publicación para producir un resultado positivo.

Las preferencias aceptadas y la retención de 90 días conservan sus contratos. Los originales siguen bloqueados por formato hasta evidencia nativa propia. El soporte Windows y la aceptación productiva/remota no se deducen del laboratorio Linux.

## Continuación

Registrar aquí las evidencias nuevas y el estado por gate después de ejecutar cada ensayo. Mantener separados implementación, fixtures, protocolo nativo sin cuenta, cuenta real, UI y adopción operativa. Este documento no cambia el estado aprobado del plan 45 ni marca AI-39/40 como completos.

## Evolución — implementación y QA, anterior a la adopción R01

Este corte sucede a la matriz inicial. Los recibos registran el 2026-10-23 en UTC; el trabajo corresponde a la continuación autorizada del 2026-10-22 en America/Santiago. No transforma los pendientes iniciales en aceptaciones reales. Al corte aquí descrito, el paquete AI40 R01 está preparado y staged; **no ha sido adoptado y no se ha enviado una generación Codex nueva**.

La página y el drawer incorporan selección explícita de OpenAI/Agentic, identificando la conexión y conservando modelos/esfuerzos dinámicos. El backend proyecta los esfuerzos Codex desde `available_models[].supportedReasoningEfforts`, sin fabricar Bajo/Medio/Alto ni presentar una preferencia histórica como compatibilidad. La selección guardada huérfana sigue disponible para corrección; Gemini conserva sus preferencias existentes. No se añade OpenAI Web/API ni delegación entre proveedores. Estos comportamientos tienen pruebas de componentes/casos de uso; aún no acreditan el recorrido UI autenticado de este paquete.

El adaptador incorpora el canario MCP privado y una aceptación técnica ligada a conexión, recurso, generación de sesión/configuración, modelo/esfuerzo, binario, código y política. El canario necesita una llamada autorizada a `nodia_knowledge_index`, nonce generado fuera del prompt, terminal completo y el ACK exacto del journal antes de certificar. Health, login y selección no llaman al canario ni realizan inferencia. Los originales siguen sin formatos acreditados. La [integración Linux del almacén privado](../evidence/nodia-ai-ai40-store-linux-r02.json) pasa 16 controles de persistencia, permisos, aislamiento entre procesos, rotación e invalidación; usa perfiles aislados sin cuenta ni generaciones reales.

Se preparan dos harness de operador: `nodia-server/test/nodia-ai-ai40-real-canary-parent.mjs` provisiona PostgreSQL desechable como root y `nodia-server/test/nodia-ai-ai40-real-canary.mjs` ejecuta el runtime como el usuario dueño del perfil existente. Las opciones privadas de ese PostgreSQL y las identidades del fixture viajan por stdin; no se amplían permisos de Docker. Se mantienen el ejecutable, la publicación, la observación de disponibilidad y el gateway reales. Ante resultado incierto, el contenedor se conserva para conciliación.

Ese recorrido reutiliza el `RunNodiaAiStageUseCase` y el contexto normales, pero instala un handler de inferencia exclusivamente diagnóstico, que delega las comprobaciones de lease/progreso a los métodos del caso de uso compilado. Su éxito futuro acreditaría transporte MCP con cuenta real y gateway/checkpoint SQL desechables. **No acreditaría por sí solo el worker autónomo, el drawer, la conversación humana ni los efectos comerciales de la BD operativa.** El nonce diagnóstico no se sella como mensaje de usuario ni se presenta como una respuesta funcional de chat.

La [suite Server](../evidence/nodia-ai-ai40-unit-qa-r01.json) pasa **4.635 pruebas en 252 archivos**, sin fallos u omisiones y con fuentes estables durante el comando. La suite Client final pasa **1.809 pruebas en 229 archivos**, con las 1.071 fuentes sin cambios durante su ejecución; el recibo local está en `.tmp/ai40-client-global-final-summary-r05.json`, con reporte SHA256 `8138fc2ad7612ba1823e6d84634114528dcf6ba3255b694d8c4f881b9d3d55cc`. Las pruebas no usan cuentas reales y no equivalen a QA visual autenticado. El [build Server](../evidence/nodia-ai-ai40-build-r01.json) y [lint/conocimiento](../evidence/nodia-ai-ai40-checks-qa-r01.json) pasan; lint conserva tres avisos históricos. El validador estructural histórico AI-15 sigue fallando porque limita su publicación a 0/67 frente a las 74 capacidades actuales; ese fallo se conserva, sin modificar el validador para ocultarlo.

El [paquete R01](../evidence/nodia-ai-ai40-package-r01.json) contiene **4.060 archivos y 2.887 outputs dist**, manifiesto `5815fc87fb5e7ce600267470774dddd9eaafdbae6ead388d0589b982205b4429`. El [staging Linux](../evidence/nodia-ai-ai40-stage-r01.json) verifica esos 4.060 archivos en `/opt/nodia/releases/nodia-server-ai40-r01`, sin activar servicios ni escribir en la BD configurada. El bundle local es `49935f292d476721ee9825fcc6e0cbce434da0d2461e2f6dd5a758faeb6840ca`. La [procedencia renovada](../evidence/nodia-ai-ai40-provenance-r01.json) cambia únicamente cuatro hashes de implementación del runtime compartido, conservando las 74 capacidades, sus contratos, scopes y aprobaciones; no acredita nueva publicación operativa.

Los preflight de adopción conservan sus rechazos observados. El [R03](../evidence/nodia-ai-ai40-adopt-preflight-r03.json) devuelve `codex_entry_invalid`; es un control previo fallido, sin adopción. Su diagnóstico/revisión debe quedar en un recibo sucesor. No se identifica la existencia de la cuenta histórica ni el staging legible como una generación o prueba MCP exitosa.

| Gate | Estado de este corte |
|---|---|
| C40-01 | Paquete/staging y driver preparados; preflight R03 rechazado. Adopción/reversión sucesoras y backup del cambio aún pendientes. |
| C40-02 | Conexión/configuración pública Linux identificadas en la [inspección de sólo lectura](../evidence/nodia-ai-ai40-runtime-inspection-r01.json), sin cuenta/inferencia nuevas en ese ensayo. La observación real del nuevo adaptador continúa pendiente. |
| C40-03 | Implementación y pruebas automatizadas de página/drawer y catálogo dinámico realizadas. UI autenticada real pendiente. |
| C40-04–C40-09 | Contratos y harness preparados; conversación, MCP real, familias de producto, confirmación/efecto y continuidad/recuperación reales pendientes. Los fixtures no cierran estos gates. |
| C40-10 | Originales bloqueados; ninguna modalidad Codex de chat aceptada. |
| C40-11 | Artefacto congelado y trazabilidad local comprobados; entrega/adopción operativa y aceptación final pendientes. |

Para construir la entrada del canario a partir de la configuración real se conserva el objeto completo de `fields.token_plan_agentic`. La copia de `updated_at`, que es `timestamp without time zone`, debe usar el texto SQL original (`updated_at::text`), sin convertirlo a Date/ISO antes de insertarlo de nuevo como `timestamp`; la corrección posterior se detalla debajo. El esfuerzo efectivo prioriza la propiedad `thinking_levels[selected_model]` cuando existe, incluido `null` explícito; sólo en su ausencia usa `thinking_level`. `null` viaja como JSON nulo, no como cadena, vacío u omisión. El canario no elige modelos ni razona a partir de su nombre.

Este apartado mantiene AI-40 abierto y no aprueba documentos, fichas o despliegue. Una observación posterior se añadirá con su identidad, alcance y recibo propios; las cifras de este corte no se trasladan automáticamente a otra versión.

## Evolución — adopción R01 y primer MCP con cuenta real

Este corte sucede al anterior y conserva sus fallos como antecedentes. El [preflight R05](../evidence/nodia-ai-ai40-adopt-preflight-r05.json) pasa sin mutaciones y la [adopción R01](../evidence/nodia-ai-ai40-adopt-r01.json) termina a las `2026-10-23T00:55:44Z`: API y worker apuntan al release `/opt/nodia/releases/nodia-server-ai40-r01`, manifiesto `5815fc87fb5e7ce600267470774dddd9eaafdbae6ead388d0589b982205b4429`, bundle 49935… y el binario Codex observado de su SDK. Los rechazos de preflight anteriores no se convierten en éxitos retroactivos.

La adopción conserva esquema, selección, configuración protegida, época Gemini y cobertura/época del journal externo; restaura los timers. Se verifica un backup cifrado fresco ready, capturado a las `00:55:26.345Z`, con vencimiento fijo a siete días y SHA256 `037295d6c422c15168f967cadb8e233888b93dd132c40dcbf644e01a02cb1133`. La comprobación posterior encuentra cero jobs, intentos o slots pendientes y cero pendientes Codex. Este ensayo no ejecuta migraciones, restores SQL, inferencias o efectos comerciales. La adopción de código no acredita por sí sola que la cuenta sea utilizable por esos procesos.

El [canario real R01](../evidence/nodia-ai-ai40-real-canary-r01.json) falla después de verificar el binario, en `live_account_and_catalog`: cero dispatches armados y cero callbacks. La cuenta no aparece autenticada a través del transporte de ese proceso. No se accede desde el harness a la BD operativa; su PostgreSQL desechable se elimina tras comprobar que no quedan recursos inciertos. Se conserva el rechazo, sin reenviar una generación que hubiera podido empezar: en ese ensayo no se llegó a armar ninguna.

La primera investigación observa una diferencia de transporte entre procesos del host: la API declara `DBUS_SESSION_BUS_ADDRESS=unix:path=/run/nodia-runtime/bus`, mientras el servicio de keyring usa `unix:path=/run/user/10000/bus` y su directorio XDG correspondiente. La [inspección del alias desde el host](../evidence/nodia-ai-ai40-keyring-metadata-r02.json) encuentra allí un archivo regular de cero bytes, no un socket; el [entorno público del servicio de keyring](../evidence/nodia-ai-ai40-keyring-transport-r01.json) proporciona el destino distinto que permite al operador conectarse fuera del sandbox. **El operador raíz interpretó erróneamente ese resultado del host como un defecto de configuración de la API.** La rectificación y reversión se detallan debajo; esa inspección no observaba el namespace de montajes de los servicios.

La comparación nativa acotada devuelve [cuenta ausente en R03](../evidence/nodia-ai-ai40-account-observe-r03.json) y [cuenta autenticada en R04](../evidence/nodia-ai-ai40-account-observe-r04.json) al usar el transporte público del servicio de keyring. Ambos ensayos registran cero generaciones. Esto demuestra qué dirección necesita ese proceso operador **fuera** del namespace de los servicios. No demuestra que el alias original de API/worker esté mal, ni atribuye una cuota o renueva una autorización. La cuenta observada desde la app conserva su gate independiente.

Con ese transporte, el [canario R02](../evidence/nodia-ai-ai40-real-canary-r02.json) **pasa sus 12 comprobaciones** entre `01:03:58.338Z` y `01:04:42.377Z`: aproximadamente 44 segundos del harness completo, incluido PostgreSQL. Usa cuenta y binario Codex reales, conexión Linux `1`, modelo observado `gpt-6.1-sol` y `effort_id:null`, sin esfuerzo explícito; no se interpreta ese nulo como intensidad Alta.

El ensayo acredita un único dispatch armado, una llamada real a `nodia_knowledge_index`, un nonce generado fuera del prompt, su recibo SQL completo, descriptor Codex schema 2 previo al envío, terminal y ACK exactos. Después del ACK, la aceptación técnica privada se observa como `supportsMcp:true` para esa combinación de sesión/configuración/modelo/esfuerzo/runtime **dentro del fixture**. La investigación posterior detecta que el timestamp de la copia de configuración era distinto del operativo; R02 no acredita una aceptación heredable por la configuración de la app. No se sustituyen observaciones, ejecutable o publicación. Se liberan los slots y el padre elimina el contenedor desechable; el perfil operativo permanece. El runtime no accede desde ese harness a la BD operativa ni crea efectos comerciales.

La respuesta que contiene el nonce no se sella como mensaje del asistente. El handler diagnóstico y sus identidades/grants de fixture conservan el alcance explicado antes: **R02 verifica MCP técnico real con gateway y SQL desechable, no el worker autónomo de la app, su UI autenticada o una familia de operaciones comerciales.** No hay confirmación humana, escritura de negocio, adjunto o formato aceptado por este ensayo. La certificación privada tampoco publica nuevas herramientas ni traslada a otros modelos/esfuerzos esa aceptación.

La matriz vigente de AI-40 queda así; las tablas anteriores conservan el estado de sus cortes:

| Gate | Último estado comprobado en este corte |
|---|---|
| C40-01 | Server R01 adoptado con backup fresco y journal/época preservados. El cambio posterior de entorno del keyring fue innecesario y se revirtió; alias originales restituidos, cero pendientes al terminar la reversión. Aceptación funcional posterior pendiente. |
| C40-02 | Cuenta real autenticada y selección efectiva comprobadas por el operador desde el host con su dirección correspondiente. Falta reobservar la misma cuenta desde API/worker con sus aliases originales y sus namespaces propios. |
| C40-03 | Implementación y QA automatizada del drawer completas al corte anterior; recorrido autenticado sobre el Client elegido pendiente. |
| C40-04 | La generación técnica de R02 completa y su respuesta verifica el nonce. Conversación funcional desde el worker/UI y mensaje persistido pendientes. |
| C40-05 | MCP técnico real aceptado en conexión 1/modelo observado/esfuerzo nulo, con un callback/recibo, terminal y ACK. Falta comprobar su disponibilidad desde los consumidores operativos con su configuración original restituida. |
| C40-06–C40-09 | Lecturas de producto por familia, propuesta/botón/efecto, continuidad entre proveedores y recuperación/autoridad reales pendientes. Ninguno se deduce del índice técnico. |
| C40-10 | Originales de imagen/PDF/audio siguen bloqueados y sin aceptación Codex de chat. |
| C40-11 | Adopción Server registrada y harness propio limpio; quedan configuración efectiva, Client/UI, aceptación funcional y cierre de entrega. |

AI-40 sigue parcial. No se modifican las aprobaciones documentales ni los gates independientes de AI-36/AI-38 por estos resultados.

## Rectificación operativa — host y namespace del keyring

La [configuración real del sandbox de la API](../evidence/nodia-ai-ai40-api-sandbox-r01.txt) declara `ProtectHome=yes` y `BindReadOnlyPaths=/run/user/10000/bus:/run/nodia-runtime/bus:rbind`. Por tanto, el alias que aparece como archivo regular en el host es el destino del bind mount que presenta el socket correcto dentro del namespace del servicio. API y worker utilizan sus aliases privados; la dirección absoluta visible al operador del host no debe copiarse sin revisar las restricciones del consumidor.

El error fue del operador raíz: extrapoló la inspección del host al entorno aislado de API/worker. El [cambio de entorno R01](../evidence/nodia-ai-ai40-keyring-apply-r01.json) aplicó la dirección `/run/user/10000/bus` a ambos consumidores. Sus barreras de drenaje, configuración, journal y cero pendientes pasaron, pero eso no acreditaba acceso al keyring dentro del sandbox. La dirección original de `/run/user` queda oculta por `ProtectHome`; la cuenta observada desde la app resultó ausente después de ese cambio. Un recibo `apply_completed` sólo prueba la transición de descriptores y sus controles, no el funcionamiento de la cuenta.

La [reversión R01](../evidence/nodia-ai-ai40-keyring-rollback-r01.json), terminada a las `2026-10-23T01:16:46Z`, restaura `unix:path=/run/nodia-runtime/bus` y XDG `/run/nodia-runtime` en API, y `unix:path=/run/nodia-ai-worker/bus` y XDG `/run/nodia-ai-worker` en worker. Conserva el release Server AI40 R01, el perfil y su recibo técnico, Gemini y el journal externo; verifica cero jobs, intentos, slots y pendientes Codex. No reinicia el keyring, no migra ni escribe en la BD configurada y no envía inferencias.

El resultado positivo del canario R02 mantiene su validez acotada: usó el socket accesible desde su propio proceso del host, la cuenta real y PostgreSQL desechable. No prueba ni refuta autenticación o MCP dentro de API/worker. La siguiente aceptación debe observar los consumidores en su namespace efectivo o pasar por sus rutas autenticadas; no requiere cambiar otra vez el transporte original ni ampliar permisos. Cuenta desde la UI, conversación/worker y disponibilidad MCP operativas siguen pendientes.

## Rectificación del espejo de configuración — timestamp y canario R04

La [observación dentro del namespace de la API](../evidence/nodia-ai-ai40-api-namespace-r01.json) confirma la configuración original restituida: `/run/nodia-runtime/bus` es un socket en ese namespace y `/run/user/10000/bus` no está disponible allí. No se leen credenciales. La diferencia host/servicio queda comprobada sin retirar `ProtectHome` ni cambiar de nuevo el transporte de los consumidores.

Después de los canarios R02 y [R03](../evidence/nodia-ai-ai40-real-canary-r03.json), la UI podía mostrar chat disponible y MCP sin acreditar. R03 también completa sus 12 controles de transporte, con un dispatch y un callback, terminal/ACK y limpieza. Eso no bastaba para que el consumidor operativo aceptara su registro técnico: la identidad de configuración no coincidía.

La [inspección del timestamp](../evidence/nodia-ai-ai40-timezone-inspect-r01.json) muestra `updated_at::text = 2026-10-23 01:20:10.685951`, mientras el driver devuelve Date `2026-10-23T04:20:10.685Z`. PostgreSQL declara zona UTC; el proceso no tiene `TZ` explícita y utiliza la zona del sistema Chile. **La ausencia de `TZ` no significaba UTC.** El wrapper anterior convertía ese Date a ISO y después lo insertaba como `::timestamp` en el fixture. Así desplazaba otra vez la hora civil y perdía los microsegundos al reconstruir el valor.

La revisión de paridad anterior fue insuficiente al dar por válido `TZ` ausente como garantía de UTC. Se rectifica ese supuesto: el hash del adaptador utiliza el Date que produce el driver al leer el timestamp; para copiar la columna, en cambio, debe preservarse su representación SQL sin zona. Son dos transformaciones diferentes. Los canarios R02/R03 siguen siendo pruebas reales de transporte y gateway, pero su configuración espejo era distinta y **no prueban aceptación operacional heredable**. No se cambia esa identidad ni se relaja su comparación para volverlos positivos.

El [wrapper de entrada R02](../evidence/scripts/nodia-ai-ai40-canary-input-r02.mjs) consulta `p.updated_at::text AS updated_at_raw` y transmite el texto completo al insert del fixture, conservando la hora civil y los microsegundos originales. Mantiene íntegros los campos públicos del modo, la selección dinámica y la precedencia de esfuerzo por modelo. No modifica configuración en la BD operativa ni el contrato de identidad del adaptador.

Con esa copia corregida, el [canario real R04](../evidence/nodia-ai-ai40-real-canary-r04.json) pasa **12 comprobaciones**, entre `01:29:26.269Z` y `01:30:07.831Z`: aproximadamente **41,6 segundos del harness completo**. Conserva conexión `1`, modelo observado `gpt-6.1-sol` y esfuerzo nulo explícito. Acredita un dispatch, un callback con nonce fuera del prompt, un recibo del gateway/SQL, terminal propio y ACK; la observación posterior del fixture devuelve MCP aceptado. El padre verifica que no quedan pendientes y elimina PostgreSQL desechable, conservando el perfil.

R04 comprueba el flujo técnico con la corrección del espejo. No es una prueba del worker autónomo ni un turno de UI: no sella mensaje del asistente, no confirma una propuesta y no tiene efectos comerciales o adjuntos. El siguiente paso es reobservar desde el drawer y completar un turno normal por API/worker con la identidad operativa exacta; hasta entonces **no se declara MCP operativo en la app**. Una coincidencia reconstruida correctamente en el fixture no sustituye ese recorrido.

| Gate | Estado vigente después de R04 |
|---|---|
| C40-01 | Server AI40 R01 adoptado; configuración original de keyring restituida y socket confirmado dentro del namespace. Mantiene backup/journal y sus comprobaciones previas; no hay adopción funcional completa por este hecho. |
| C40-02 | Cuenta real observada por el operador. La UI observa chat disponible; la aceptación completa de cuenta/configuración desde los consumidores se registra con su propio turno. |
| C40-03 | Implementación y QA automatizada del drawer conservadas; verificación autenticada final de selección, continuidad y errores pendiente. |
| C40-04 | Generaciones técnicas completas con cuenta real; conversación funcional mediante worker normal y respuesta persistida aún pendiente. |
| C40-05 | R04 acepta MCP técnico con espejo corregido, nonce/gateway/SQL/terminal/ACK y fixture limpio. R02/R03 no se heredan a la configuración operativa. MCP desde drawer y turno normal pendientes. |
| C40-06–C40-09 | Familias de producto, confirmación/efecto, continuidad y recuperación/autoridad reales permanecen pendientes. |
| C40-10 | Originales siguen bloqueados; no se acepta imagen, PDF ni voz Codex de chat. |
| C40-11 | Artefactos y adopción Server documentados; faltan recorrido Client/UI/worker y entrega funcional acotada. |

Las interpretaciones anteriores de namespace y de zona horaria quedan rectificadas, conservando sus recibos originales. AI-40 continúa parcial, sin nuevas capacidades, formatos o aprobaciones.

## Primer turno normal — recibo SQL completo y resultado rechazado por el canal

La [proyección SQL posterior R01](../evidence/nodia-ai-ai40-ui-sql-after-r01.json) registra un turno desde la app sobre conexión `1`/OpenAI/Agentic/modelo observado/esfuerzo nulo: un mensaje del dueño, un run `completed`, un mensaje del asistente sellado, un dispatch, una llamada de herramienta y un RPC. Existe un recibo `completed` de `nodia_knowledge_index`; el job termina `done`, el chat queda sin job activo y se observan cero pendientes/slots retenidos. La [proyección en vuelo](../evidence/nodia-ai-ai40-ui-sql-inflight-r01.json) conserva la etapa previa con un dispatch, sin callback todavía y con el slot adquirido. Son observaciones nuevas de sólo lectura; no imprimen mensajes, argumentos ni resultados privados.

El estado SQL completo acredita que el gateway atendió la consulta y persistió su recibo. **No basta para afirmar que el modelo recibió el resultado autorizado.** En este turno el canal nativo rechazó la serialización posterior del resultado y devolvió un error de herramienta, aunque el worker pudiera sellar una respuesta final. Por eso se conserva el fallo funcional y no se declara aceptada la lectura MCP del índice completo desde la UI.

La [política50, tabla de límites](50-nodia-ai-ai04-runtime-policy.md#entradas-contexto-y-respuestas) establece 64 KiB por argumentos/resultado, profundidad 16 y **128 elementos por colección**. El [serializador del canal](../../nodia-server/src/ai-provider/use-case/codex-chat-tool-channel.use-case.ts) incrementaba un contador global por cada nodo visitado y comparaba el total acumulado con ese límite por colección. Un índice con 31 fragmentos puede contener 251 nodos JSON y seguir teniendo todas sus colecciones por debajo de 128, profundidad y bytes válidos. La suma global estaba aplicando otra restricción que el contrato no define.

La secuencia explica la aparente contradicción: la llamada autorizada al gateway y su recibo SQL ocurren antes de serializar el resultado para el proveedor. Ese paso posterior puede fallar sin transformar retrospectivamente el recibo en una consulta de datos fallida. El terminal del agente tampoco demuestra que recibió un resultado útil: puede responder a un error de herramienta. Las capas deben verificarse por separado.

La lectura del [canario privado existente](../../nodia-server/src/nodia-ai-adapter/use-case/codex-nodia-ai-adapter.use-case.ts) confirma que ya transporta `{ result, verification_nonce }`: espera el resultado real del gateway y lo incluye. **No descarta el resultado.** Los canarios desechables usaban un actor con alcance de conocimiento menor y, por tanto, un payload más pequeño; sus positivos no cubrían el índice completo visible al actor de este turno. No corresponde modificar el adaptador ni cambiar el nombre de su envoltura para resolver este defecto.

El cambio candidato se limita a aplicar la cardinalidad por cada array/objeto en el canal, conservando los 64 KiB, profundidad 16, validación de datos, presupuestos, autoridad, rechazos y cero truncamiento. Su regresión debe atravesar el caso de uso real con un índice de 31 fragmentos/251 nodos, y conservar negativas por colección, profundidad y bytes excedidos. Hasta terminar QA, adoptar el candidato y repetir la lectura normal desde UI, ese arreglo no se considera operativo ni se transfieren los proofs de la versión anterior.

| Gate afectado | Estado después del primer turno normal |
|---|---|
| C40-03 | La selección de conversación ya persiste conexión/modelo/esfuerzo exactos y se ejecuta desde la app; quedan las verificaciones de experiencia/continuidad y entrega del Client. |
| C40-04 | Worker normal completa un run y sella respuesta. La respuesta útil sobre el índice no está aceptada porque la herramienta devolvió un error de serialización. |
| C40-05 | Gateway/recibo y contadores normales comprobados. Falta corregir y revalidar el transporte del resultado completo al proveedor; el canario técnico con payload menor no lo sustituye. |
| C40-06–C40-11 | Conservan los pendientes funcionales, formatos y entrega indicados antes. No hay nueva aprobación ni efecto de negocio. |

Este diagnóstico no cambia la política numérica ni amplía capacidades. El fallo queda registrado y la aceptación sigue parcial.

## Candidato Server R02 — intento de adopción detenido antes de cerrar admisión

La corrección del canal queda preparada en el [paquete R02](../evidence/nodia-ai-ai40-package-r02.json), manifiesto `a555aa8f35e3fffe22b9293e62f2585e2004d55a9c9ab5ecce78d8486bbc35dc`. Conserva 4.060 archivos/2.887 outputs, bundle 49935… y cambia únicamente la fuente del caso de uso del canal y sus dos outputs JavaScript/mapa respecto del paquete R01. Su [staging](../evidence/nodia-ai-ai40-stage-r02.json) verifica los archivos sin activar servicios ni modificar la BD configurada. La [suite Server sucesora](../evidence/nodia-ai-ai40-unit-qa-r02.json) pasa **4.647 pruebas/252 archivos**, sin fallos ni omisiones y con fuentes estables durante el comando. Es evidencia de código y artefacto, no de adopción funcional.

El [preflight inicial del fix](../evidence/nodia-ai-ai40-runtime-fix-preflight-r01.json) falla con `operator_command_failed` después de tres lecturas de estado del journal rechazadas. El [preflight sucesor R02](../evidence/nodia-ai-ai40-runtime-fix-preflight-r02.json) pasa sin mutaciones y conserva el contexto protegido: ausencia de los drop-ins de keyring retirados, transportes públicos originales y sockets comprobados en el namespace de cada consumidor, configuración/esquema y cero pendientes. El preflight pasado no prueba que se haya activado el candidato.

El [primer intento de adopción del fix](../evidence/nodia-ai-ai40-runtime-fix-adopt-r01.json) termina `adopt_failed` con `operator_command_failed`, **antes de cerrar la admisión** (`admission_closed:false`). Los timers se restauran. No hay recibo de backup nuevo para este cambio ni una adopción R02 completada: el éxito de los controles anteriores y el staging no deben presentarse como si R02 estuviera activo. La evidencia conservada no identifica todavía la causa concreta del comando rechazado; no se atribuye a cuota, credenciales, almacenamiento o agotamiento de recursos sin observación adicional.

La [lectura posterior del catálogo externo](../evidence/nodia-ai-ai40-backup-catalog-r01.json), a las `01:53:31.747Z`, observa las mismas **11 copias ready**, la última capturada a las `00:55:26.345Z` durante la adopción R01, cero entradas sin confirmar y `last_sequence:0`. El spool sólo enumera `.backup.lock`; esa presencia no acredita un backup nuevo ni, por sí sola, un bloqueo activo. La [verificación separada de los escritores](../evidence/nodia-ai-ai40-backup-writers-r01.json) devuelve `backup_writers_verified:true`, `backup_created:false` y cero escrituras SQL. Verificar los escritores no equivale a ejecutar o aceptar una copia nueva.

Se prepara un retry controlado de la **operación de despliegue**, conservando la evidencia del intento rechazado y las barreras de backup, drenaje, SQL/nativo/Codex, configuración y journal. No se repite una inferencia ni se ignora un resultado incierto. Hasta obtener recibos positivos de backup/adopción y repetir el canario/turno normal afectados por la nueva huella del canal, el estado vigente sigue siendo **Server R01 operativo, R02 candidato sin activar y AI-40 parcial**. UI, resultado útil de la lectura MCP, familias de negocio y formatos no se cierran con estos controles.

## Segundo rechazo de backup y continuidad explícita hacia Gemini Web

El [segundo intento de adopción del fix](../evidence/nodia-ai-ai40-runtime-fix-adopt-r02.json) también termina antes de cerrar la admisión, con timers restaurados. Esta vez el wrapper registra `backup_cli_failed` y el código seguro del CLI `nodia_ai:recovery_read_unavailable`: una ejecución del comando backup rechazada, exit 1, sin retry automático del backup. Esa categoría precisa la fase observada; no identifica por sí sola la causa del fallo de lectura ni autoriza a ignorar el requisito de copia fresca.

La [observación de catálogo R02](../evidence/nodia-ai-ai40-backup-catalog-r02.json), a las `02:03:45.437Z`, sigue mostrando 11 copias ready, cero entradas sin confirmar y el spool con `.backup.lock` como única entrada. No hay nueva copia ready acreditada para el despliegue R02 en ese recibo. Estas observaciones tampoco prueban cero CAS, ausencia de prune o inexistencia de cualquier operación interna anterior del CLI: el catálogo es un snapshot y el error no es una traza exhaustiva de todos sus pasos.

El [diagnóstico posterior de lectura](../evidence/nodia-ai-ai40-recovery-read-diagnostic-r01.json) realiza tres GET correctos, HTTP 200, con tiempos de 327, 919 y 446 ms. Registra cero mutaciones y cero peticiones al proveedor **en ese diagnóstico**. Acredita esas tres lecturas y sus tiempos, no disponibilidad continua ni una causa cierta del rechazo de backup anterior. No se presenta como una corrección del almacenamiento o como autorización para repetir una operación incierta.

El [preflight R04](../evidence/nodia-ai-ai40-runtime-fix-preflight-r04.json) pasa sin mutaciones, conserva las barreras y verifica el antecedente exacto del segundo intento rechazado. El nuevo work/driver identifica de forma estricta ese intento previo y no lo reproduce dentro de su directorio. Se inicia un tercer ensayo controlado; este corte todavía **no incorpora su resultado** y no afirma que Server R02 esté activo ni que haya un backup nuevo. Las evidencias de los dos rechazos permanecen inmutables.

En paralelo, desde el mismo chat de aceptación se realiza un cambio explícito de Codex/Agentic a Gemini Web entre turnos, guardado por el PATCH de selección del chat con su toast de éxito. La [captura de continuidad Web](../evidence/nodia-ai-ai40-continuity-web-ui-r01.png) muestra la misma conversación, sus eventos previos y el texto de borrador aún en el compositor después del cambio; el encabezado refleja Web y su modelo seleccionado. El operador no envía ese borrador ni inicia una generación durante esta comprobación.

Este recorrido acredita el cambio puntual Codex→Gemini Web con conservación visible del chat y del borrador. No demuestra todavía el sentido inverso, continuidad semántica de una nueva respuesta, una generación Gemini, efectos previos reconsultados, todas las variantes de recarga o ausencia de cualquier duplicado en otro ensayo. No es un fallback por error ni altera la delegación opt-in Web→Agentic dentro de la misma conexión.

Los gates de backup/adopción del fix, resultado útil MCP desde el worker normal y aceptación de entrega siguen abiertos en este corte. La continuidad observada se añade como comprobación parcial de C40-08, sin cerrar AI-40 ni ampliar capacidades.

## Adopción del fix R02 completada — aceptación funcional posterior pendiente

El [tercer intento controlado](../evidence/nodia-ai-ai40-runtime-fix-adopt-r03.json) termina `adopt_completed` a las `2026-10-23T02:07:31Z`. API y worker utilizan `/opt/nodia/releases/nodia-server-ai40-r02`, manifiesto `a555aa8f35e3fffe22b9293e62f2585e2004d55a9c9ab5ecce78d8486bbc35dc`. Este resultado sucede a los dos rechazos anteriores sin reescribirlos. El bundle sigue siendo 49935…; el cambio de código del canal no añade capacidades, contratos, scopes o aprobaciones.

La fuente del canal del [paquete R02](../evidence/nodia-ai-ai40-server-package-r02.json) tiene SHA256 `5b2f7c662eec87b56aa65ff4ebaf1daacf378f2ed422c171506c58b1ff36feef`, correspondiente al cambio de cardinalidad por colección y a la QA sucesora de 4.647 pruebas ya registrada. El despliegue conserva el entorno y los aliases de keyring originales, comprobados en los namespaces de los consumidores; no vuelve a aplicar la dirección del host a los servicios aislados. Conserva también época Gemini, configuración, esquema y era/cobertura del journal externo, sin bootstrap o cierre de su cobertura.

Esta vez existe un backup fresco confirmado para el cambio: ID `8931f497-bf7c-4824-8fde-acc7e9ff9f7b`, ready, capturado a las `02:07:00.495Z`, cifrado de 454.343 bytes y SHA256 `f20eca0bfcb7a9dbb662d652631c7fec729821c70a73ce740ec5e66b21dd4077`, con vencimiento fijo a siete días. El recibo restaura los timers y verifica cero jobs/intentos/slots pendientes y cero pendientes Codex después de la adopción. No ejecuta migraciones, restauraciones SQL, peticiones de inferencia ni efectos comerciales.

La activación acredita el paquete y sus barreras operativas. **Todavía no acredita que el índice completo llegue al modelo ni que la UI funcione correctamente sobre R02.** La huella del runtime cambia al modificar el canal: los positivos de versiones anteriores no habilitan MCP automáticamente en este código. Se inicia el canario R05 sobre el release R02, con el wrapper de lanzamiento sucesor y la entrada que conserva el timestamp SQL original; su resultado aún no forma parte de este corte.

El estado vigente pasa a **Server R02 adoptado, aceptación MCP y turno UI posteriores pendientes, AI-40 parcial**. La siguiente evidencia debe acreditar el nuevo canario y la lectura útil desde el worker normal, además de conservar los gates independientes de continuidad, familias de producto, confirmación humana, recuperación y formatos. No se declara cierre de UI, MCP funcional ni de AI-40 con el recibo de despliegue.

## Canario R05 sobre R02 y regreso explícito desde Web a Codex

El [canario R05](../evidence/nodia-ai-ai40-real-canary-r05.json) pasa sus **12 controles** sobre Server R02 entre `02:08:13.637Z` y `02:08:57.677Z`. Usa el binario real y la cuenta del perfil de conexión `1`, modelo observado `gpt-6.1-sol` y `effort_id:null`, con la entrada corregida que preserva el timestamp SQL original y el transporte del host correspondiente al proceso operador.

Registra un dispatch, un callback autorizado y su recibo SQL, nonce no incluido en el prompt, terminal y ACK exactos. La aceptación observada pasa de `false` a `true` para la huella actual del runtime R02. No hay overrides de ejecutable, publicación o disponibilidad; no se accede desde el harness a la BD operativa ni se crean efectos comerciales. El padre elimina el fixture tras verificar ausencia de pendientes y conserva el perfil. Este canario sucede a la corrección del canal, pero su actor/alcance desechable no sustituye el ensayo normal con el índice completo.

Después, el drawer autenticado muestra MCP verificado para la selección Codex actual. Se cambia explícitamente el mismo chat de Gemini Web a Codex/Agentic y se aplica la selección entre turnos. La [captura de continuidad Codex](../evidence/nodia-ai-ai40-continuity-codex-ui-r01.png) muestra el mismo chat, eventos anteriores, el encabezado Agentic con el modelo observado, el toast de guardado y un borrador nuevo marcado `BORRADOR-AI40-R02` conservado en el compositor. Este cambio no genera por sí solo una respuesta ni confirma escrituras.

Hay una limitación observada que impide afirmar conservación general del borrador: durante el reinicio del backend, la UI renovó la sesión y remontó la página; el borrador de la comprobación anterior desapareció. **No se acredita persistencia del borrador después de recargar, renovar/remontar la página o reiniciar servicios.** El borrador R02 de la captura se escribió posteriormente y sí se conservó durante el cambio de selección. No se atribuye la pérdida a un mecanismo concreto sin una reproducción que lo compruebe, ni se modifica aquí el diseño para suplir esa evidencia.

Las observaciones Codex→Web y Web→Codex acreditan ambos cambios explícitos de selección sobre el mismo historial, y la conservación visible de borrador dentro de esas interacciones concretas. No prueban continuidad semántica de una respuesta nueva, preferencias/efectos reconsultados o recuperación del borrador al recargar. La [proyección SQL tras la adopción](../evidence/nodia-ai-ai40-ui-sql-postdeploy-r01.json), anterior al cambio de vuelta a Codex, conserva los dos mensajes y el único run/recibo históricos mientras la selección base está en Web, con cero pendientes. Esa proyección no se presenta como una generación nueva.

Se envía una nueva solicitud de lectura del índice desde la UI mediante el worker normal para verificar el resultado después del fix. Su respuesta **todavía está pendiente en este corte**: el badge de MCP verificado y el positivo del canario no bastan para declarar que el índice completo llegó correctamente al modelo o cerrar C40-05 funcional.

| Gate afectado | Estado en este corte |
|---|---|
| C40-02 | Cuenta y selección actuales comprobadas en el canario real; la UI observa disponibilidad/MCP verificado con esa selección. No se generaliza a otras cuentas o modelos. |
| C40-03 | Drawer autenticado usado para ambos cambios explícitos, con guardado visible y selección dinámica. Quedan variantes de experiencia y entrega del Client. |
| C40-05 | Canario R05 aceptado para R02 y badge verificado en el drawer; resultado de la lectura completa por worker normal aún pendiente. |
| C40-08 | Continuidad visible de historial y borrador entre selecciones comprobada en ambos sentidos. Borrador perdido durante renovación/remontaje: recarga/restart y continuidad semántica siguen sin aceptación. |

AI-40 continúa parcial. No se aceptan efectos comerciales, adjuntos ni las demás familias o escenarios por mostrar MCP verificado en el drawer.

## Lectura técnica desde UI y worker normal aceptada en R02

La nueva lectura completa correctamente en el paquete R02. La [proyección SQL posterior R02](../evidence/nodia-ai-ai40-ui-sql-after-r02.json) registra el run `ce42fe7a-bace-4593-b8f6-c28b10f41d51`, creado a las `02:10:23.733Z` y completado a las `02:10:47.840Z`: **24,107 segundos del turno**, un dispatch, un tool call y un RPC. El worker normal sella el nuevo mensaje del asistente; `nodia_knowledge_index` deja el recibo `2742e752-9c01-4153-8c41-3ca5a6e75d4f` en estado `completed`. No se utiliza el handler diagnóstico de los canarios para ese turno.

La [respuesta visible](../evidence/nodia-ai-ai40-mcp-chat-ui-r03.png) conserva la palabra acordada `FARO-AI40` y enumera las áreas de documentación obtenidas. La [parte final de la respuesta](../evidence/nodia-ai-ai40-mcp-chat-ui-r04.png) muestra los cuatro dominios: `businesses`, `general-settings`, `nodia-ai` y `personal-finance`. La [proyección del resultado público y la recarga](../evidence/nodia-ai-ai40-ui-sql-reloaded-r01.json) los contrasta con el recibo: **22 items autorizados, 5.568 bytes UTF-8**, SHA256 `0c67ccfc9a5d56005c63a0e9cb6c167fda6bf1c20b3977f2e36248bb1514cece`. Se acredita correspondencia semántica entre el resultado del gateway y la respuesta visible, además de continuidad conversacional del marcador anterior.

Este índice es el autorizado para ese actor/contexto; sus 22 items no se presentan como el inventario universal de todos los productos ni como las 31 entradas del caso de regresión de cardinalidad. La comprobación es una lectura de metadatos de conocimiento. **No acredita consultas de registros de Negocios, Finanzas, Reservas o Core**, ni aceptación de todas sus herramientas por compartir dominio documental.

Al recargar se conservan la conversación, la selección exacta y los cuatro mensajes sellados/dos runs acumulados. Las [proyecciones posterior y recargada](../evidence/nodia-ai-ai40-ui-sql-reloaded-r01.json) mantienen los IDs y contadores: el primer run histórico conserva su fallo funcional de resultado, y el segundo es el positivo posterior al fix. La recarga no crea un mensaje, run o recibo adicional. El conjunto incluye dos recibos técnicos históricos; no se confunden con dos llamadas del último turno. La conservación del historial y selección tras recarga no amplía la evidencia de borradores: la pérdida observada durante renovación/remontaje sigue pendiente.

La [verificación operativa posterior](../evidence/nodia-ai-ai40-post-ui-environment-r01.json) confirma API/worker activos en R02, timers activos, esquema/configuración preservados, misma época Gemini y cobertura del journal externo. SQL, runtime nativo y Codex quedan sin trabajos/intentos/slots ni ACK pendientes; los recibos acusados pueden permanecer hasta su purga ordinaria. La inspección es de sólo lectura, sin nueva generación, escritura de negocio o reaplicación de configuración.

| Gate afectado | Alcance aceptado después de la lectura normal |
|---|---|
| C40-02 | Cuenta, conexión/modelo/esfuerzo exactos y disponibilidad real verificados para el turno observado en Linux. |
| C40-03–C40-04 | Drawer usado, selección guardada, solicitud desde UI, worker normal y respuesta útil persistida/visible comprobados. Se conservan las limitaciones de borradores y demás variantes de experiencia. |
| C40-05 | MCP técnico de conocimiento aceptado con gateway/recibo, resultado semántico, terminal/ACK y cero pendientes sobre R02. No se extiende a otras capacidades. |
| C40-08 | Marcador conversacional recuperado, ambos cambios de proveedor y recarga de historial/selección comprobados sin duplicar el turno. Preferencias/efectos, borradores tras recarga y demás escenarios conservan sus pendientes. |

La siguiente solicitud enviada desde la UI pide **preparar, sin ejecutar**, un gasto pendiente mínimo de prueba. Su propuesta, eventual ambigüedad, confirmación humana y efecto **todavía no forman parte de este corte**. No se declara un borrador de gasto creado ni un movimiento persistido a partir de esa intención. C40-07 y las demás familias/formatos/recuperación continúan abiertos; AI-40 sigue parcial aunque drawer, cuenta y MCP técnico ya tengan aceptación acotada.

## Propuesta financiera observada y reporte de confirmación humana

La preparación posterior ya presenta una propuesta revisable en la app. Se observa **revisión 1**, hash `90ccc1a13831d15b9c3ddb9efedc5dc66ecdd9b71e860353ef34efacc51ea06f`, para un movimiento de gasto pendiente de importe 1, descripción de prueba `AI40-UI-CODEX-R01`, ámbito financiero de usuario 1 y categoría 1 de aceptación AI38. Las [vistas de la propuesta](../evidence/nodia-ai-ai40-human-preview-ui-r02.png) muestran el cambio de estado/categoría y los orígenes de los valores. La [vista de confirmación](../evidence/nodia-ai-ai40-human-confirm-ui-r02.png) muestra el botón **«Confirmar revisión 1»** sobre esa propuesta; no es un consentimiento inferido de un mensaje de chat.

El [DTO financiero nativo](../../nodia-server/src/finance-movement/dto/create-finance-movement.dto.ts) acepta nombre, importe, tipo, estado, categoría y campos opcionales de obligación/actividad; **no acepta una fecha editable de compra o de ocurrencia**. La referencia a la fecha actual en la petición no añade un campo nuevo a ese contrato ni autoriza a inventar una fecha negociable. La propuesta se evalúa contra los mínimos y valores permitidos del contrato existente. Una fecha de negocio editable, si se necesitara, requeriría su propio cambio de producto/backend.

El humano pulsa el botón y reporta que la app muestra **Completada / Paso 1 completado / Movimiento 2**. Ese reporte acredita la interacción y la respuesta visible relatadas por la persona. La comprobación SQL independiente todavía está en preparación en este corte: **no se afirma aún una fila de movimiento, un recibo atómico persistido o ausencia de duplicados** a partir del texto de éxito. La siguiente observación debe contrastar revisión/hash, ejecución/paso/recibo y efecto real, y comprobar que recargar no lo repite.

Durante la revisión también se observa un aviso de selección no disponible con la propuesta aún visible. Se desarrolla en paralelo un ajuste de disponibilidad entre observaciones GET y limpieza/ACK para el estado ocupado. Ese trabajo sigue como candidato de código, sin paquete ni adopción acreditados aquí; no se considera resuelto ni se cambia el resultado de los ensayos anteriores por estar en implementación.

C40-07 avanza a propuesta y botón humano observados, con reporte de éxito pendiente de contraste SQL/idempotencia. La aceptación financiera y el estado global de AI-40 continúan parciales.

## Efecto financiero confirmado — propuesta exacta y recarga sin duplicado

La [verificación SQL del efecto](../evidence/nodia-ai-ai40-ui-effect-sql-r01.json) confirma el reporte humano. La propuesta `003c0802-e222-402d-a497-082fd48781a7` queda `confirmed` en revisión 1 y mantiene el hash exacto `90ccc1a13831d15b9c3ddb9efedc5dc66ecdd9b71e860353ef34efacc51ea06f` observado antes de pulsar el botón. Hay **un challenge y un consumo**, una ejecución `d663ce31-2d06-4704-af68-cb11b2402e2e` completada y un paso `9c1f9e20-38d6-4a13-94c2-ecc3739a9372` completado, con recibo mínimo presente y sin error.

El movimiento de dominio existe con ID **2**, importe exacto `"1"`, tipo `expense`, estado `pending`, usuario `"1"`, categoría `"1"` y actividad `true`. Es **un efecto financiero real, confirmado por el humano** en la VM de aceptación, no sólo una respuesta del modelo o una propuesta en memoria. La ausencia de escrituras de los observadores SQL de sólo lectura no significa ausencia de este efecto: su `configured_SQL_writes:0` describe la inspección, mientras la ejecución humana previa sí creó el movimiento.

El run de preparación `8c0fbe93-7666-448e-afe1-dae904074a87` termina `completed` en **44,506 segundos**, con **dos dispatches, cuatro llamadas de herramienta y cuatro RPC**. Sus recibos corresponden a `nodia_capabilities_select`, `nodia_finance_categories_list`, `nodia_users_list` y `nodia_finance_movements_prepare_create`. El descubrimiento y las lecturas preparan los recursos del contrato; ninguno reemplaza la confirmación humana. La ejecución financiera es un job separado, posterior a la propuesta y su botón.

Después de usar la reconsulta **«Actualizar estado»** y recargar, la [segunda proyección SQL](../evidence/nodia-ai-ai40-ui-effect-sql-reloaded-r01.json) conserva exactamente el mismo contenido salvo el timestamp de observación: seis mensajes sellados, tres runs, la misma propuesta/revisión/hash, una ejecución y un paso, un challenge consumido y el único movimiento 2. Los IDs y contadores no cambian y no aparecen nuevos efectos. La comparación offline de ambas proyecciones confirma su igualdad sin el timestamp. Se observan cero jobs pendientes/slots retenidos.

Esto acredita la no repetición del efecto ante esas lecturas GET y esa recarga. No se extiende a todos los fallos posibles de red, pérdida de COMMIT, doble POST o caída de procesos; esos escenarios conservan sus pruebas y gates propios. Tampoco prueba todas las operaciones financieras o familias de otros módulos a partir de este único gasto pendiente.

C40-07 tiene ahora un positivo acotado de **preparación publicada→vista previa exacta→botón humano→ejecución/recibo→efecto real→recarga sin duplicado** para esta selección y entorno. No hay nuevo preparador publicado ni ampliación del catálogo para lograr el resultado. La mejora de disponibilidad entre GET/ocupación/ACK y del seguimiento cliente continúa como código candidato para una entrega futura; no forma parte del paquete R02 activo ni queda aceptada por este efecto. AI-40 permanece parcial por las demás familias, formatos, recuperación/autoridad y límites de experiencia pendientes.

## Contraste visual del efecto y alcance final del corte R02

La [captura del recibo completado](../evidence/nodia-ai-ai40-effect-ui-r02.png) muestra **Estado de la operación: Completada / Paso 1: Completado / Operación verificada · Movimiento: 2**, con las acciones «Abrir Finanzas» y «Actualizar estado». La revisión ya no presenta un botón para volver a confirmar. La captura complementa los recibos SQL; no sustituye la validación independiente del movimiento ni convierte el recibo histórico en una consulta perpetua del estado actual del registro.

El operador abre **Abrir Finanzas→General** y observa la fila `AI40-UI-CODEX-R01`, importe 1, Gasto/Pendiente, categoría de aceptación AI38 y actividad activa. La fila histórica de aceptación AI38 permanece visible. No se guarda captura de esa pantalla porque el selector contiene un email personal. Esta es una observación UX del operador **sin imagen ni hash de la fila**; no se inventa una evidencia visual durable. El movimiento real y su identidad ya tienen el contraste SQL citado antes.

Al volver al chat, el operador observa la misma URL de conversación, historial y selección Codex. Junto con la recarga y la igualdad de proyecciones, esto acredita la ida al módulo y vuelta al chat del caso probado; no elimina la limitación de borradores perdida durante la renovación/remontaje anterior.

| Gate | Resultado acotado que puede afirmarse sobre R02 |
|---|---|
| C40-01 | Adopción Server, backup fresco y protecciones operativas comprobados en la VM Linux local. No aceptación productiva ni de otro entorno. |
| C40-02 | Cuenta y selección observada de conexión 1/Codex/modelo dinámico/esfuerzo nulo ejecutan inferencia real. No generalizar a otras cuentas/modelos/esfuerzos. |
| C40-03 | Drawer autenticado, cambios explícitos entre proveedores, guardado y recorrido local de chat comprobados. Disponibilidad entre GET/ACK y persistencia de borrador tras remontaje conservan límites. |
| C40-04–C40-05 | Conversación con marcador previo y lectura técnica MCP mediante worker normal, resultado semántico, persistencia y ACK comprobados. |
| C40-06 | Índice autorizado leído; recibos de categorías financieras y usuarios completados en la preparación. No aceptación exhaustiva de lecturas ni de familias de productos. |
| C40-07 | Un gasto pendiente real tras revisión/hash exactos y botón humano, recibo y movimiento visibles, sin duplicado por reconsulta/recarga. |
| C40-08 | Selecciones en ambos sentidos, historial/selección tras recarga y vuelta del módulo comprobados. Borrador tras renovación/remontaje, preferencias/efectos en todos los cambios y demás variantes pendientes. |
| C40-09 | Las pruebas de código/fixtures conservan sus garantías; falta aceptación real completa de cancelación/conciliación, incertidumbre, revocación y compactación para Codex. |
| C40-10 | Sin imagen/PDF/voz Codex de chat aceptados; originales bloqueados. |
| C40-11 | Entrega local parcial trazable. Faltan los gates funcionales y de experiencia restantes; no se cierra AI-40 ni se transfieren aprobaciones. |

## Evolución pendiente — candidato R03 de disponibilidad

El [paquete R03](../evidence/nodia-ai-ai40-package-r03.json) y su [staging](../evidence/nodia-ai-ai40-stage-r03.json) existen con manifiesto `0e769ded9a0a36e6d62a17415ea15d1843ce48735ff746ce5e238c5c3b2ea341`, 4.060 archivos/2.887 outputs y el mismo bundle 49935…. Sus recibos declaran `frozen_not_activated` y `staged_not_activated`: **R03 aún no está activo en este corte**.

Ese candidato aborda la disponibilidad entre observaciones GET, perfil ocupado y ACK, con cambios de seguimiento en el cliente en preparación. Ni su existencia ni la aceptación financiera de R02 prueban que el aviso de disponibilidad esté corregido en ejecución. Requiere sus controles, adopción y aceptación propios antes de atribuirle un resultado operativo. Los positivos anteriores mantienen la identidad del paquete R02 y la selección comprobada; no se heredan automáticamente al nuevo runtime.

El corte de lecturas/efecto R02 queda documentado con alcance parcial y sus fallos conservados. No añade modelos estáticos, herramientas, permisos, esquemas, formatos o aprobaciones documentales.

## R03 adoptada — disponibilidad pendiente de aceptación real posterior

El [recibo de adopción R03](../evidence/nodia-ai-ai40-availability-adopt-r01.json) sucede al staging anterior y declara `adopt_completed` a las `2026-10-23T02:35:29Z`. API y worker ejecutan `/opt/nodia/releases/nodia-server-ai40-r03`, manifiesto `0e769ded9a0a36e6d62a17415ea15d1843ce48735ff746ce5e238c5c3b2ea341`. El plan es `1edc3fa69a83d79be98d31831b1fcafd3da99b68b324b0cab1a79eeac52793b5` y el wrapper operador `d34a2d92fdadca4901282a4cc3ccf75d5948901e4a5c8a14e1915df1cf1f9b87`. **R03 es ahora el Server activo**; la sección de candidato conserva el estado histórico anterior.

La adopción dispone de backup fresco `21d90b35-d0f0-44fe-8400-0784f7343945`, `ready`, capturado a las `02:35:02.804Z`, de 501.322 bytes cifrados y SHA256 `cacbc29455b621687c0260a47619913506d8ccf1acab568ddb71f5929abba31c`, con vencimiento fijo a siete días. Preserva timers, era/cobertura del journal, aliases de transporte y restricciones de namespace, configuración/esquema y época Gemini. Las inspecciones posteriores registran cero jobs/intentos/slots SQL y pendientes nativos/Codex. El movimiento 2 del ensayo humano permanece; esta adopción no realiza escrituras SQL operativas, efectos comerciales, migraciones, restauraciones ni generaciones nuevas.

La [QA global Server R03](../evidence/nodia-ai-ai40-unit-qa-r03.json) pasa **4.651 pruebas en 252 archivos**, sin fallos ni pendientes y con las fuentes estables durante el comando. El [build R03](../evidence/nodia-ai-ai40-build-r03.json) termina con código cero, conserva las fuentes durante la compilación y produce el mismo conocimiento `49935f292d476721ee9825fcc6e0cbce434da0d2461e2f6dd5a758faeb6840ca`: no hay nueva publicación ni aprobación de capacidades.

En Client, el candidato incorpora hasta tres reconsultas GET adicionales, separadas por 500/1.000/2.000 ms, sólo ante `runtime_busy`, con cancelación al cambiar el contexto; también evita presentar como verificado un badge cuya observación expiró. El reporte focal comunicado por el agente responsable es de 126 pruebas correctas. Su suite global única sigue en ejecución en este corte, con fuentes congeladas: **todavía no se atribuye una QA global final ni aceptación visual del comportamiento automático**. Las reconsultas no autorizan una inferencia adicional ni un reenvío del turno.

La huella de código cambia con el adaptador R03 y recibe su comprobación propia: el [canario real R06](../evidence/nodia-ai-ai40-real-canary-r06.json) pasa **12 controles**, entre `02:36:05.233Z` y `02:36:57.548Z`. Verifica la cuenta/binario reales y la selección exacta de conexión 1, modelo observado `gpt-6.1-sol` y esfuerzo `null`, sin overrides de ejecutable, disponibilidad o publicación. Registra un dispatch, un callback autorizado al gateway con SQL desechable real, resultado con nonce oculto al prompt, terminal y ACK. Después del ACK la aceptación pasa de `false` a `true` para la huella actual. El padre elimina el fixture tras comprobar ausencia de pendientes y conserva el perfil operativo; el harness no accede a la BD operativa ni crea efectos de negocio.

El positivo R06 no sustituye la UI ni el worker autónomo: usa el handler diagnóstico de operador descrito antes. Los positivos R02 permanecen como evidencia histórica y no se heredan por la mera adopción. El nuevo turno de lectura mediante UI/worker normal R03 **está en curso, sin resultado acreditado todavía**; falta contrastar respuesta, terminal/ACK y retorno automático del compositor sin pulsar una reconsulta manual. No se afirma aún que el aviso de ocupación esté resuelto en la interacción real.

El [runbook de entrega](../evidence/nodia-ai-ai40-delivery-runbook-r01.md) conserva instrucciones y antecedentes de R02 al redactar este corte; está pendiente su actualización por el operador. No se debe tomar su versión activa ni su driver histórico como instrucciones vigentes para revertir R03. La operación requiere el plan, wrapper y comprobaciones correspondientes a la adopción actual, sin reutilizar un WORK consumido ni omitir conciliación de pendientes. AI-40 continúa parcial.

## Turno normal R03 correcto — ventana automática del Client insuficiente

La [lectura SQL posterior R03](../evidence/nodia-ai-ai40-ui-availability-sql-r01.json) confirma el run `22c28787-e460-4d21-ac1e-e787c6fa5bed` completado entre `02:37:35.707Z` y `02:37:52.317Z`: **16,610 segundos**, un dispatch, una llamada de herramienta y un RPC. El worker normal sella la respuesta y completa el recibo `ce80e48e-e6e5-4749-a5c1-c0409c476e9c` de `nodia_knowledge_index`. El operador observa la respuesta correcta con `FARO-AI40` y los 22 items. El resultado público conserva los 5.568 bytes y SHA256 `0c67ccfc9a5d56005c63a0e9cb6c167fda6bf1c20b3977f2e36248bb1514cece`, con los mismos cuatro dominios autorizados. Hay ocho mensajes sellados y cuatro runs históricos, sin job activo ni slots retenidos. Esto acepta MCP técnico y continuidad semántica del turno sobre R03; no todas las lecturas de producto.

Sin embargo, **falla el retorno automático del compositor**: la ventana acumulada de reconsulta del Client, de 3,5 segundos, se agota antes de observar disponible el runtime. Este resultado negativo permanece aunque la respuesta del modelo y el gateway sean correctos. No se presenta la interacción como recuperada automáticamente ni se oculta mediante un clic manual posterior.

La [primera inspección de ventana ACK](../evidence/nodia-ai-ai40-ack-window-r01.json) devuelve una lista vacía porque el operador consultó una ruta inexistente; **no acredita ausencia de recibos ni ACK**. La [inspección corregida](../evidence/nodia-ai-ai40-ack-window-r02.json) utiliza `chat-jobs` bajo el perfil correcto y observa el recibo completado, `acknowledged:true` y cero solicitudes sin reenviar. Para el último turno, `observed_at` es `02:37:52.269Z` y el archivo de metadatos tiene mtime `02:37:56.483783Z`, unos 4,17 segundos después de completar SQL. La comparación respalda que 3,5 segundos no cubrieron este caso observado. El mtime del archivo **no se define como instante exacto de ACK ni como SLA del proveedor**; tampoco justifica liberar bloqueos antes de verificar el estado real.

La proyección conserva la única propuesta confirmada, ejecución `d663ce31-2d06-4704-af68-cb11b2402e2e`, paso y challenge consumido, y el único movimiento 2 de importe 1. El turno técnico R03 no crea otro efecto comercial ni modifica la aceptación humana previa.

La [QA Client R02](../evidence/nodia-ai-ai40-client-qa-r02.json) completa **1.823 pruebas en 229 archivos**, sin fallos ni pendientes y con fuentes estables; pasa además el foco de 126 pruebas, tipado, lint y build. Es la QA del candidato de ventana de 3,5 segundos que acaba de fallar en la interacción real, **no del siguiente ajuste**. Se prepara un cambio exclusivamente de UX con reconsultas acotadas hasta 21 segundos y una regresión que libera el ACK a los seis segundos. Sus pruebas focales finales y build siguen pendientes en este corte. No cambia Server R03, no reenvía inferencias, no fuerza un desbloqueo ni convierte la observación GET en una nueva aceptación.

El estado vigente es **Server R03 adoptado, canario y lectura técnica normal positivos, recuperación automática del compositor todavía fallida y ajuste Client pendiente**. Hace falta un nuevo positivo desde la UI para aceptar ese comportamiento. El cierre general de AI-40 conserva los demás límites de familias, formatos, recuperación/autoridad y experiencia documentados.

## Recuperación automática comprobada — corte local final con alcance parcial

El ajuste Client sucesor recibe [QA focal de las fuentes actuales](../evidence/nodia-ai-ai40-client-busy-window-final-r01.json): **126 pruebas correctas en cuatro archivos**, tipado/build y lint sin errores. La política suma tres esperas GET de **1.000/5.000/15.000 ms**, sólo para el mismo actor, conversación y selección tras una transición de trabajo activo a inactivo seguida de `runtime_busy`. Se detiene al observar disponibilidad, un motivo distinto de ocupado, error HTTP, trabajo nuevo o cambio de contexto/sesión/montaje. Las pruebas incluyen un ACK disponible después de seis segundos y conservan nodo/borrador durante la recuperación. Los 21 segundos son la suma de esperas; se añade la latencia de cada consulta y **no constituyen una garantía de tiempo total ni un SLA del proveedor**. No se repite una inferencia o una ejecución.

La suite global anterior de **1.823 pruebas/229 archivos** corresponde al candidato de 3,5 segundos. **No es una ejecución global sobre las fuentes finales de 21 segundos.** El delta final tiene la QA focal anterior y el [build Client R03](../evidence/nodia-ai-ai40-client-build-r03.json); se conserva esta distinción en lugar de presentar la cobertura global anterior como una comprobación del HEAD exacto.

El nuevo ensayo desde la UI sí recupera el compositor. La [observación autenticada consolidada](../evidence/nodia-ai-ai40-live-ui-r01.json) y su [captura](../evidence/nodia-ai-ai40-availability-ui-r02.png) muestran respuesta `FARO-AI40`, turno completado, campo de mensaje habilitado con un borrador propio sin enviar y botón de envío habilitado, **sin clic manual de reconsulta ni navegación después del dispatch**. El operador retira ese borrador antes de recargar; no se envía como otra solicitud. El positivo sucede al fallo de 3,5 segundos, cuya evidencia permanece en la sección anterior.

La [proyección SQL final](../evidence/nodia-ai-ai40-ui-final-sql-r01.json) identifica el último run `804eef6f-378d-4227-9c16-e4e11c742992`, creado a las `02:44:41.926Z` y completado a las `02:44:56.738Z`. Este turno es conversacional, con un dispatch y cero herramientas/RPC; contrasta recuperación y continuidad del marcador, **no una llamada MCP adicional**. La aceptación MCP normal R03 corresponde a la lectura técnica de 22 items registrada antes. Los acumulados son diez mensajes sellados, cinco runs, seis dispatches y siete llamadas de herramienta.

La [proyección tras recargar](../evidence/nodia-ai-ai40-ui-final-sql-reloaded-r01.json) es idéntica a la anterior salvo el timestamp de observación, comprobado mediante comparación offline. Conserva historial/selección, la única ejecución `d663ce31-2d06-4704-af68-cb11b2402e2e`, su revisión/hash y el único movimiento 2; no aparecen nuevos mensajes, runs, herramientas o efectos. El compositor queda habilitado sin CTA de recuperación. Como el operador retiró su borrador antes de recargar, **esta prueba no acepta persistencia del borrador al recargar** y no elimina la pérdida anterior durante la renovación/remontaje.

La [inspección final de entorno](../evidence/nodia-ai-ai40-final-environment-r01.json), a las `02:47:12Z`, verifica API/worker activos sobre R03, cero pendientes SQL/nativos/Codex y cero ACK pendientes, timers activos y journal sin incertidumbres. Conserva esquema/configuración, perfiles y época Gemini. Es una inspección de sólo lectura, sin nuevas solicitudes al proveedor ni escrituras SQL; el movimiento humano anterior sigue existiendo. El [runbook actualizado](../evidence/nodia-ai-ai40-delivery-runbook-r01.md) ya identifica R03 y su wrapper/plan propios, sucediendo a su versión histórica R02. La reversión posterior a estos turnos no se considera ensayada.

La [consolidación de aceptación](../evidence/nodia-ai-ai40-validation-r01.json) identifica el estado **`partial_scoped_linux_acceptance`**, recibos y límites. La UI comprobada es Vite autenticado en `localhost:5174`: un build correcto no demuestra adopción de esos assets en nginx. Tampoco se transfiere aceptación a Windows, otro entorno, otras cuentas/modelos/esfuerzos o capacidades por compartir adaptador.

| Gate | Último resultado y límite vigente |
|---|---|
| C40-01 | Server R03 adoptado con backup fresco, controles protegidos, cero pendientes y runbook vigente. Reversión R03 posterior y Client compilado aún sin aceptación. |
| C40-02 | Cuenta real y selección exacta de conexión 1/modelo descubierto/esfuerzo nulo comprobadas. Sin fallback, cambios implícitos ni credenciales en evidencias. |
| C40-03 | Drawer autenticado, modos/modelos/esfuerzos dinámicos, enlace de cuenta seguro y recuperación automática GET del compositor aceptados en el caso local observado. UI compilada y variantes restantes pendientes. |
| C40-04 | Respuestas reales y marcador de continuidad comprobados mediante worker normal, persistencia, terminal/ACK y recarga sin turno adicional. |
| C40-05 | Canario R06 propio de R03 y lectura técnica normal de conocimiento aceptados con gateway, resultado semántico, recibo y ACK. El último turno de recuperación no añade otra prueba MCP. |
| C40-06 | Índice autorizado y lecturas de categorías/usuarios de la preparación comprobados. Familias de operaciones restantes sin aceptación exhaustiva. |
| C40-07 | Revisión/hash exactos y botón humano producen una ejecución/recibo y movimiento 2 único, visible en Finanzas y conservado tras reconsultas/recargas. No aceptación de todos los efectos de dominio. |
| C40-08 | Cambios explícitos Gemini↔Codex, marcador, historial/selección, ida/vuelta y recarga comprobados. Borrador durante selección sí; tras recarga/remontaje no. Preferencias/efectos en todas las variantes conservan su alcance pendiente. |
| C40-09 | Recuperación GET de disponibilidad comprobada. No sustituye cancelación real, conciliación de resultado incierto, revocación, compactación ni demás pruebas de autoridad Codex pendientes. |
| C40-10 | Imagen/PDF/audio nativos sin aceptación específica; originales permanecen bloqueados. |
| C40-11 | Entrega local parcial trazable con servicios activos. Sin cierre total de AI-40, aprobación documental automática ni aceptación productiva/Windows. |

Se conservan los fallos de transporte/namespace y sus rectificaciones, timestamp del fixture, serialización del primer turno, intentos de adopción previos y ventana de recuperación insuficiente. El positivo final no los elimina ni publica capacidades nuevas.


## Precisión final: relojes y consolidación

La [consolidación R02](../evidence/nodia-ai-ai40-validation-r02.json) sucede a R01 y añade la [comparación de relojes](../evidence/nodia-ai-ai40-clock-comparison-r01.json): host02:43:52 frente a VM02:50:21, aproximadamente389 segundos de adelanto observado de la VM. Los campos `*_host_utc` de QA/consolidación registran el reloj Windows y los campos SQL/nativos el reloj de la VM. No ordenar directamente ambos relojes ni reemplazar una fecha real por otra para aparentar una secuencia. La comparación SQL→ACK de4,17 segundos utiliza sólo el reloj de la VM y conserva su valor diagnóstico; la modificación del archivo reconocido no se presenta como un SLA.

No se modificaron relojes/NTP durante el ensayo. La aceptación temporal entre browser y servidor queda pendiente; el backend conserva autoridad sobre vencimientos, leases y confirmación. La [observación UI final](../evidence/nodia-ai-ai40-live-ui-r01.json) y las dos proyecciones SQL finales acreditan el contenido y sus identidades independientemente de ese desfase. El borrador propio de comprobación se retiró antes de la última recarga; no se afirma persistencia de borradores sin enviar al recargar.
