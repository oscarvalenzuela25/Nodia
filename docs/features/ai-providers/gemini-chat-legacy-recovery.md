# Recuperación conservadora de CHAT Gemini legacy

> Estado: contrato propuesto y candidato implementado, 2026-10-24. QA offline y ensayo kernel Linux aislado verificados. Imagen desplegada en VM; la continuación por controles actuales completó conciliación/ACK y retiró el binding. El fallo previo de paridad HostConfig permanece histórico y desconocido. Sin aprobación documental ni publicación MCP.

La [evidencia vigente](../../evidence/nodia-ai-ai40-remaining-validation-r01.json) separa el ensayo kernel de cuatro garantías y las ocho regresiones Linux de archivos/cleanup, todos aislados y con los recursos de prueba retirados. El intento real original terminó abandoned_unknown con cierre físico, un ACK comprobado y cero replay; API/worker R08 se reanudaron después. Esto no recupera su respuesta perdida. La [limpieza cancelable del CLI](../../evidence/nodia-ai-ai40-agentic-cli-cleanup-validation-r01.json) pasa 550 pruebas y omite tres por plataforma; esas pruebas no atribuyen una causa al incidente histórico ni acreditan inferencia con cuenta real.

## Problema y alcance

El recibo CHAT v1 armado protege el perfil frente a reenvíos, pero no conserva owner/cgroup por intento. Ni un runtime nuevo, ni un PID ausente, ni el cierre de un contenedor distinto pueden convertirlo en terminal. Se propone reutilizar la autoridad host de ADR-054 para una cadena legacy explícita y limitada, conforme a [ADR-077](../../architecture/decisions/ADR-077-gemini-chat-legacy-containment-recovery.md).

Esta entrega distingue tres pruebas: la identidad operacional previa de la generación original; el binding inmutable del registro ARMED a esa raíz capturado antes de pararla; y la certificación posterior del cierre kernel de esa raíz. Ninguna aislada sustituye a las otras. La cadena compuesta no se describe como owner persistido al dispatch original: esa propiedad no existía.

El caso objetivo es CHAT Gemini Agentic Linux v1 ya armado y sin respuesta terminal. No se incorpora un botón de resolver, SQL arbitrario, herramienta MCP de administración ni permiso para que el modelo aporte un certificado. El host y el consumidor nativo son los únicos responsables de sus respectivas pruebas.

## Fronteras del contrato

| Componente | Responsabilidad | Prohibición |
|---|---|---|
| Productor host | Validar testigos previos y vincular scope/bytes ARMED a la generación Docker/cgroup original antes de la parada; persistir el binding privado e inmutable | No editar NativeAttemptProof, slots, grants, jobs o resultados SQL |
| Helper de contención | Preservar raíces referenciadas por login y CHAT y certificar su cierre kernel real, con identidad de raíz y host/boot | No inferir cierre desde restart, namespace nuevo o ausencia de proceso sin contención |
| Consumidor nativo | Validar certificado/binding/ledger exactos y emitir sólo `abandoned_unknown` mediante el ledger propio | No fabricar respuesta, `completed`, ACK de Server ni nueva inferencia |
| Server | Reutilizar descriptor y UC de conciliación/cleanup existentes, comprobar prueba exacta y efectuar ACK habitual | No liberar perfil por un archivo de operador, ni reenviar un resultado incierto |

### Certificado cerrado acordado para el candidato

El certificado público mantiene la ruta privada de contención existente. La versión1 de login conserva sus cinco campos. La versión2 tiene exactamente `version`, `root_device`, `root_inode`, `host_boot`, `closed_roots`, `chat_bindings`, con `version: 2`. La propiedad es root, sin bits de escritura, lectura sin seguir symlinks y máximo32768 bytes. Se conserva el límite128 de `closed_roots`; `chat_bindings` admite como máximo8 entradas. El certificado no contiene rutas host ni credenciales.

Cada binding público es un objeto cerrado con estos14 campos:

| Campo | Regla |
|---|---|
| `version`, `kind` | `1`, `legacy_chat_pre_stop` |
| `binding_id` | UUID válido, identidad del binding inmutable |
| `engine` | Sólo `agentic` en esta extensión |
| `attempt_id`, `operation_ref` | UUID exactos e iguales |
| `resource_key` | `gemini-profile:` seguido de64 caracteres hexadecimales |
| `session_generation` |32 caracteres hexadecimales |
| `record_sha256`, `record_bytes` | SHA256 de los bytes originales; tamaño entero1..4096 |
| `record_observed_at`, `bound_at` | Fechas ISO con zona; captura anterior o igual al binding |
| `generation` | Objeto cerrado: `container_id`64hex, `started_at`ISO con zona, `boot`UUID, `device` y `parent_inode` enteros positivos |
| `lineage_sha256` | SHA256 de la cadena privada de testigos validada por el productor host; no un hash elegido por el consumidor/modelo |

Orden temporal mínimo: `generation.started_at <= record_observed_at <= bound_at`. El productor demuestra adicionalmente que el binding fue persistido antes de la parada; el orden de esas tres fechas por sí solo no demuestra causalidad. Para resolver un intento, el consumidor exige que la tupla de generación original `{boot, device, parent_inode}` difiera de la raíz actual y esté certificada en `closed_roots`. La existencia de una entrada `chat_bindings` sin ese cierre no permite consumirla.

El formato público no sustituye los pins y testigos privados del productor: `lineage_sha256` sólo es útil porque el productor root valida su procedencia. Los lectores de login aceptan v1/v2 con sus reglas, sin derivar una resolución de login desde un binding CHAT. El parser candidato valida ese contrato y falla cerrado ante campos extra, duplicados o identidades ambiguas. La compatibilidad login v1/v2 conserva sus reglas; no se afirma despliegue por disponer del parser.

## Cadena de identidad necesaria

1. Evidencia comprobable anterior al despacho liga el contenedor original, su generación de arranque y la raíz real del cgroup. Una observación operacional del endpoint previsto identifica esa misma generación; el servicio/configuración y único escritor del ledger se contrastan, sin copiar credenciales.
2. Antes de parar el original, el productor comprueba los bytes actuales del ARMED y su SHA, motor, attempt/operation, perfil y generación de sesión. Contrasta también el marcador de cuarentena cuando forme parte del scope y rechaza duplicidad, symlinks, permisos inseguros, generación o escritor distintos.
3. El binding se escribe exclusivamente una vez, se sincroniza/relee y se revalida la generación original viva y el registro exacto antes de declarar bound_pre_stop. Si falla el postcheck, se conserva el archivo incierto y se prohíbe activar el sucesor o detener el original a partir de él. Se conserva con sus referencias de raíz. Una ejecución posterior no lo reemplaza por el contenedor nuevo. El helper no poda una raíz antigua aún necesaria por CHAT aunque no tenga logins pendientes.
4. Tras una parada autorizada, el helper certifica cierre de la raíz original mediante observación kernel y la publica con propiedad root y sólo lectura. No equivale a una marca manual «resuelto».
5. El consumidor sólo transforma un registro `dispatch_armed` que aún coincida byte por byte con el SHA enlazado y con todas sus identidades. Las pruebas faltantes, corruptas, de otra raíz, otro intento o posteriores a la parada como supuesto origen fallan cerradas.
6. El proof nativo terminal pasa por `ReconcileGeminiNodiaAiRuntimeUseCase`, la reconciliación SQL y su cleanup/ACK usual. La evidencia final debe mostrar intento terminal, ausencia de trabajo nativo activo, reserva resuelta y cero replay. Hasta entonces, el binding no libera el perfil.

## Propietario vivo del mismo runtime

El candidato conserva un camino distinto del certificado host para Agentic: el mismo proceso que admitió el intento aún dispone de su ID en `attempts`, usa un `CliRunner` real con binario verificado y coincide en sesión/perfil. Además, el intento no puede permanecer en `active_attempts`, no puede tener procesos CLI pendientes y debe conservar el tuple exacto ARMED/`process_closed: false`/`terminal_proof_id: null`. La lectura del registro usa FD Linux regular,0600 exacto, owner actual, un enlace, sin seguir symlinks ni bloquear ante FIFO; sus bytes decodificados deben coincidir con el proof leído.

Ese conjunto permite emitir únicamente `abandoned_unknown` tras validar que el gate/marcador pertenece a la misma operación. Un objeto parecido a un runner, un epoch por sí solo o un mapa nuevo vacío tras restart no autorizan este camino. Si falta el propietario vivo exacto, se exige toda la cadena HOST descrita arriba. Validación de perfil precede a la mutación del ledger; un owner diferente o una cuarentena sin identidad comprobable se conservan.

## Semántica y errores

El único resultado nuevo permitido es `abandoned_unknown`: el proceso local ya no seguirá trabajando, pero el resultado remoto sigue desconocido. No acredita que Gemini no recibiera la petición, no recupera texto perdido y no deshace efectos previos.

Un intento ya terminal válido conserva su identidad y resultado. La resolución repetida es una lectura/conciliación de esa identidad, nunca una oportunidad de iniciar otra generación. Un mismatch no puede degradarse a «ya no existe» o éxito; mantiene el estado y la cuarentena existentes. Las rutas antiguas de login y sus certificados conservan su contrato validado.

No hay fallback a otra conexión/modo/modelo. Los campos de sesión/epoch no sustituyen el witness físico. El scope no se elige por un nombre de modelo ni por el usuario del chat.

## Pruebas necesarias antes de aceptación

- Binding sin testigos previos, origen posterior a la parada, SHA/scope cambiados, escritor/montaje ambiguos, symlink o permisos incorrectos: rechazo sin modificar ledger o BD.
- Certificado ausente, falso, editable por servicio, de root/boot distinto, raíz original aún poblada o contenedor antiguo aún vivo: rechazo; ningún terminal nuevo.
- Retención de la raíz CHAT al publicar una generación nueva; referencias de login conservadas y limpieza acotada sin podar un pendiente.
- Cadena válida con cierre kernel comprobado: una transición nativa a `abandoned_unknown`, terminal exacto estable, conciliación y ACK normales, sin segunda generación. Repeticiones y fallos de cleanup no repiten el dispatch.
- Lifetime: no retirar binding/certificado requerido antes de la conciliación; limpieza posterior acotada conforme a50 sin reabrir una operación antigua.

La [validación offline del consumidor](../../evidence/nodia-ai-ai40-gemini-chat-owner-consumer-validation-r01.json) conserva las fuentes candidatas y sus pruebas negativas de contrato/FD/owner. El corte final focal ejecuta34 casos:33 pasan y uno de FD/FIFO Linux se omite en Windows; el runner amplio anterior al último endurecimiento raw ejecutó545 casos,543 pasaron y dos se omitieron. Esos resultados no se suman ni se atribuyen al mismo pin final. El ensayo kernel preparado utiliza dos contenedores de fixture sin red y una sesión sintética: las implementaciones reales de ChatAdapter, ProfileAdmission, ledger, certificado y ACK consumen un binding explícitamente sintético. Sólo la dependencia Agentic es un fake, sin SDK; ese ensayo no ejecuta el productor del caso operativo ni acredita su cadena de testigos previa.

Pruebas unitarias no acreditan cierre kernel. Un ensayo aislado Linux no acredita automáticamente el runtime configurado, la cuenta real o Windows. El estado de implementación y los recibos operacionales se registrarán con alcance y pins propios; el presente documento conserva su estado propuesto.

## Impacto documental previsto

La extensión mantiene las reglas de43/50: unknown conserva reserva, no replay y cierre nativo verificable antes de liberar. No modifica catálogo, permisos, selección, API de confirmación, preferencias o política de negocio. Tras revisión de fuente/evidencia, Root actualizará el corte AI-40, runbook y evaluación de fichas; este borrador no cambia esos documentos ni los marca aprobados.

## Fuentes

- [ADR-054](../../architecture/decisions/ADR-054-durable-native-login-reconciliation.md).
- [Arquitectura43](../../mvp/43-nodia-ai-execution-architecture.md), [política50](../../mvp/50-nodia-ai-ai04-runtime-policy.md) y [AI-29](../../mvp/75-nodia-ai-ai29-secure-human-flows.md).
- [Ledger actual](../../../nodia-gemini-microservice/native_attempts.py), [admisión](../../../nodia-gemini-microservice/profile_admission.py) y [reconcile nativo](../../../nodia-gemini-microservice/nodia_ai_chat.py).
- [Helper de contención existente](../../evidence/scripts/attach-nodia-gemini-login-cgroup.py) y [lector de contención login](../../../nodia-gemini-microservice/login_cgroups.py).

### Fuentes candidatas revisadas

- [Parser/lector del binding CHAT](../../../nodia-gemini-microservice/native_chat_owner_bindings.py), [lector login compatible](../../../nodia-gemini-microservice/login_cgroups.py), [gate de perfil](../../../nodia-gemini-microservice/profile_admission.py) y [consumidor nativo](../../../nodia-gemini-microservice/nodia_ai_chat.py).
- [Productor host R04](../../evidence/scripts/nodia-ai-ai40-gemini-chat-host-binding-r04.py) y [helper sucesor R04](../../evidence/scripts/attach-nodia-gemini-chat-cgroup-r04.py): vuelve a comprobar generación, ledger, testigos, fuentes y único escritor después de persistir/fsync y releer el binding, antes de declarar bound_pre_stop. Un fallo conserva el archivo incierto, sin reintento o parada; no utilizar este enlace como autorización operacional.
- [Ensayo kernel preparado](../../evidence/scripts/verify-nodia-gemini-chat-cgroup-host-r02.py): no ejecutado en este corte.
