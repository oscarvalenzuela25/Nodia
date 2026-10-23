# AI-39 — Runtime y adaptador Codex para chat y herramientas

> Estado: adaptador, worker, journal y gateway integrados y verificados de forma aislada; aceptación de la cuenta/proveedor pendiente. Los cortes de evidencia anteriores se conservan como históricos.
> Fecha: 2026-10-22. Autorización: solicitud explícita de continuar AI-38 y empezar AI-39 a continuación; no aprobación documental automática.

## Alcance y dependencias

La [tarea AI-39 del plan45](45-nodia-ai-implementation-plan.md#e11--codex-agentic-en-nodiaai) introduce backend/runtime para `provider_key='openai'`, `mode='token_plan_agentic'`. Reutiliza sesión, modelos y perfil de `CodexRuntimeModule`; no duplica proveedor ni amplía OCR. [AI-40](45-nodia-ai-implementation-plan.md#e11--codex-agentic-en-nodiaai) conserva drawer, cambio explícito de proveedor, cuenta real, aceptación de efectos y formatos propios.

El [ADR-072 propuesto](../architecture/decisions/ADR-072-nodia-ai-provider-runtime-adapters.md) se registra antes de modificar contratos comunes. [AI-38](84-nodia-ai-ai38-environment-acceptance.md) sigue parcial; preparar arquitectura/fixtures en paralelo no acredita sus gates de Web ni cierra las 77 capacidades candidatas de AI-36. Esta entrega no habilita UI, conexiones, herramientas o fragmentos nuevos.

## Inventario inicial previo a C02/C03

Este inventario describe la lectura inicial, antes de los cambios parciales detallados debajo. El parser de recuperación y RPC ya evolucionaron; composición, disponibilidad y dispatch Codex siguen sin habilitarse.

| Área | Fuente actual | Cambio requerido |
|---|---|---|
| Composición | `nodia-server/src/nodia-ai-adapter/nodia-ai-adapter.module.ts` | Los dos puertos usan exclusivamente Gemini; introducir selección cerrada por proveedor/modo y recuperación por identidad persistida. |
| Observación y payload | `nodia-ai-adapter/types/nodia-ai-adapter.types.ts` y `use-case/gemini-nodia-ai-adapter.use-case.ts` | Literales Gemini; separar identidad/medición propia y conservar validación estricta. |
| Recuperación durable | `nodia-ai-runtime/types/reconciliation.types.ts` y `use-case/runtime-reconciliation-descriptor.ts` | Parser schema1 sólo admite recurso `gemini-profile`; compatibilidad explícita y discriminación nueva, sin aflojar el parser. |
| Elegibilidad | `nodia-ai-conversation/use-case/observe-nodia-ai-eligibility.use-case.ts` y `list-nodia-ai-connections.use-case.ts` | OpenAI aún no es chat compatible; conservar bloqueo hasta que el adaptador esté implementado/verificado. |
| Retry de observación | `nodia-ai-context/use-case/process-nodia-ai-stage.use-case.ts` | La categoría temporal existente corresponde a Gemini; no aplicarla automáticamente a Codex. |
| Supervisor | `common/ai/codex/codex-runtime.service.ts` | Perfil fuera del repo, keyring, lock físico, identidad nativa y admisión compartidos; añadir chat conservando dueños y límites. |
| JSONL | `common/ai/codex/codex-rpc.ts` | Toda solicitud del servidor se rechaza por política OCR; cualquier handler nuevo debe ser privado del chat y fail-closed. |
| Extracción existente | `ai-provider/use-case/execute-codex-invoice.use-case.ts` | Preservar thread efímero, herramientas deshabilitadas, terminal, cancelación con propiedad y ausencia de replay. |

La presencia de `@openai/codex` fijado en `package.json` no certifica la versión/binario realmente adoptados en Linux. Tampoco una cuenta previamente autenticada demuestra inferencia actual de chat ni herramientas.

## Secuencia de implementación

1. **AI39-C01: protocolo nativo exacto y contrato.** Identificar binario/hash/versión; generar sus esquemas y comprobar inicialización, política de thread y ruta de herramienta sintética sin cuenta/inferencia. La [documentación oficial](https://learn.chatgpt.com/docs/app-server) trata herramientas dinámicas como experimentales: no adoptarlas sólo porque aparecen en una referencia actual.
2. **AI39-C02: identidad y selección comunes.** ADR, observaciones discriminadas, router de ejecución y de conciliación/ACK. Aceptar descriptores Gemini históricos, rechazar identidad cruzada y proveedor/modo no implementados; ninguna selección por fallback.
3. **AI39-C03: ejecución Codex y gateway.** Contexto autorizado y catálogo medidos; thread efímero, callback exclusivo de NodiaAI, respuestas acotadas y terminal propio. Modelos/esfuerzos descubiertos; originales adjuntos bloqueados hasta acreditación específica.
4. **AI39-C04: cierre y recuperación.** Journal mínimo durable con identidad/fences, cancelación, muerte/acuse/commit perdido y ACK sin repetir inferencia o efectos. Compartir perfil con login/OCR/modelos; un lock residual conserva cuarentena hasta conciliación comprobada.
5. **AI39-C05: integración y regresiones.** Casos de uso, PostgreSQL desechable y procesos separados API/worker; conservar Gemini/OCR y publicación vigente. Entregar límites comprobados y pendientes antes de la aceptación UI/cuenta de AI-40.

Esta división organiza el trabajo dentro de AI-39; no añade etapas nuevas al plan40 ni marca casillas cumplidas por definirlas.

## Garantías de aceptación técnica

- Selección estable de conexión/proveedor/modo, sin confundir dos conexiones o dos runtimes `agentic`.
- Estado no disponible/desconocido correcto ante plataforma no admitida, configuración ausente, cuenta revocada, catálogo inválido o perfil ocupado; sin inferencia de disponibilidad desde flags.
- Sólo herramientas del catálogo/grant vigentes; rechazo de método, thread, turn, call ID, argumentos y resultados inválidos, excedidos o duplicados.
- Autoridad revalidada al devolver al gateway, acceso retirado entre turnos/callbacks y escritura siempre mediante propuesta/botón/hash/recibo existentes.
- Cancelación del competidor conserva al dueño; lease/fence perdido no permite nuevas herramientas ni liberar un perfil incierto.
- Caída antes/después de envío, proceso perdido, ACK perdido y commit incierto conservan identidad y recuperación sin replay. La prueba terminal propia precede a la liberación.
- Byte budget real del payload y catálogo; sin inventar contexto en tokens, cuotas, modelos o capacidades por nombre.
- Sin tablas/migraciones nuevas mientras no se demuestre que los descriptores/jobs existentes no permiten la garantía requerida.
- Cero ampliación de herramientas OCR; regresiones Gemini y snapshots de publicación intactos.

## Corte inicial de estado y evidencia

Hecho confirmado: alcance del plan y diferencias de código identificadas mediante lectura. [Ficha funcional](../nodia-ai/knowledge/nodia-ai/features/context-execution.md#extensión-planificada-codex-ai-3940) actualizada como draft/unregistered. Pendientes: compatibilidad nativa de la política nueva, implementación, pruebas y aceptación; no se ha hecho una inferencia Codex nueva para esta entrega ni cambiado configuración/credenciales.

Los resultados técnicos posteriores se añadirán con su versión/hash y nivel de evidencia. AI-39 no se da por completado con este documento; AI-38 y AI-40 conservan sus gates propios.

## AI39-C01 — protocolo nativo observado sin cuenta ni inferencia

El binario de Nodia instalado en Linux declara `codex-cli 0.161.0`, SHA256 `9a820c17865fa825d04db416818679a9d63bd72e50835c396f496e5684626c9c`. Se resolvió desde las dependencias del paquete Server operativo; no se utilizó el Codex de la app ni un perfil de conexión.

La [primera observación](../evidence/nodia-ai-ai39-native-protocol-r01.json) exporta315 schemas estándar y acepta initialize + thread efímero con la política de sólo lectura/aprobación never. Archivar ese thread efímero devuelve `-32600`; no se afirma archivo o persistencia remota. El hijo termina con código0. El esquema estándar omite campos experimentales; esa omisión no demuestra falta de soporte.

La [ayuda nativa](../evidence/nodia-ai-ai39-schema-help-r01.txt) identifica `generate-json-schema --experimental`. La [segunda observación](../evidence/nodia-ai-ai39-experimental-protocol-r02.json) exporta445 schemas y verifica tres admisiones en perfiles aislados: `dynamicTools` con `experimentalApi:true` es aceptado; sin la capacidad se rechaza `-32600`; un nombre de herramienta numérico también se rechaza. Por tanto, el parser procesa el campo y no se limita a ignorarlo. No se ejecuta una herramienta del proveedor ni un turno generativo.

Todos los hijos nativos se ejecutan dentro de un namespace de red sin conectividad externa, con HOME/CODEX_HOME/XDG privados y sin bus de credenciales heredado. Cero solicitudes de login, lectura de cuenta, `model/list` o `turn/start`; ningún `auth.json` en esos perfiles. Los schemas exactos y sus manifiestos quedan en los directorios de verificación aislados. Esto acredita admisión/protocolo en ese binario; no sesión, modelos de la cuenta, MCP real o modalidades.

Se escoge `dynamicTools` como transporte candidato para adaptar el catálogo/gateway común. Esa adaptación no exige publicar otro servidor ni listener MCP; sigue pendiente la invocación nativa y las garantías de ejecución/conciliación de C03/C04.

La [comprobación final del inicializador real](../evidence/nodia-ai-ai39-native-initializer-r01.json) ejecuta `CodexRpc` del snapshot contra ese mismo binario, no un peer: initialize experimental, `config/read` con validación efectiva de `CODEX_SETTINGS` y thread efímero con herramientas dinámicas aceptados. Cinco comprobaciones correctas, hijo nativo recogido y ningún archivo de autenticación. No se envía `turn/start` ni se invoca una herramienta; tampoco se consulta cuenta/modelos. El snapshot/transpilado y la red/perfil aislados se distinguen de adopción operativa.

## C02 — identidad recuperable y barreras entre proveedores

El [corte C02](../evidence/nodia-ai-ai39-c02-reconciliation-r01.json) añade una unión discriminada para identidad de recuperación. Los descriptores Gemini schema1 conservan sus cinco campos y prefijo; Codex declara schema2 con ocho claves exactas: proveedor `openai`, contrato `nodia-ai-codex-chat/1`, conexión decimal BIGINT canónica, motor `agentic`, intento, referencia de operación igual al intento, recurso `codex-profile` y generación de sesión. Las formas de recurso/sesión son contratos propios de Nodia pendientes de producir/atestiguar por el adaptador, no observaciones del proveedor.

La validación terminal compara identidad completa, incluido proveedor/contrato/conexión. El caso de uso común revalida esa igualdad después de consultar la prueba; la implementación Gemini rechaza identidades Codex antes de realizar transporte/ACK. Así se prepara la separación sin reinterpretar trabajos históricos ni dirigir limpiadores Gemini a otro proveedor. No se ha implementado todavía el router de ejecución/conciliación Codex ni su registro DI: `NodiaAiAdapterModule` sigue enlazando Gemini.

C02 acredita179 pruebas focales en cinco archivos, tipado/lint correctos y build Nest final después de las barreras. La suite global final pasa4475 pruebas/246 archivos; una ejecución anterior falló en el límite existente de cinco segundos de un test DI mientras corría el build, sin cambiar timeout/assertions. Es cobertura unitaria/compilación, sin integración SQL del descriptor nuevo ni inferencia Codex. El validador estructural histórico AI-15 sigue rechazando su supuesto0/67 frente a las74 capacidades vigentes; registry idéntico a HEAD, sin modificar el validador congelado para ocultarlo. El recibo conserva estas distinciones y sus hashes.

## Primitiva C03 — canal privado de herramientas, sin integración operativa

`CodexRpc.initialize({experimentalChatApi:true})` opta únicamente por el protocolo; no habilita herramientas. El runtime existente continúa llamando initialize sin esa opción. `openChatToolChannel` exige después una instalación explícita única por el código dueño del perfil; su contrato indica que el caller debe poseer el lease físico. No se añade este llamado al runtime, adaptador o UI en este corte.

El caso de uso `codex-chat-tool-channel` recibe thread/turn exactos, catálogo congelado de nombres, señal/deadline y límites completos validados en ejecución. Acepta sólo `item/tool/call` sin namespace externo, valida ID/argumentos/JSON y consume el hook de presupuesto antes del gateway; revalida el lease antes/después del hook y del resultado. Serializa los callbacks y reclama call IDs antes de esperar: un replay no vuelve al gateway. Rechaza comandos, permisos, tools ajenas, llamadas de otro turno, datos inválidos y respuestas excedidas. El canal admite como máximo32 solicitudes en vuelo; identidad RPC duplicada en vuelo cierra el transporte. OCR conserva su rechazo original cuando no existe canal.

El presupuesto/deadline limita el canal local. El futuro adaptador debe ligar `assertLease`, `beforeRequest` y el callback al checkpoint/gateway/presupuesto durable reales. En particular, el overflow descartado por el transporte requiere contabilidad desde el observador de todos los frames; no se añade SQL posterior al aborto. Revocar el canal aborta callbacks y suprime respuestas obsoletas, pero no acredita la parada de una generación/proceso ni libera slots. Journal, prueba terminal, ACK y recuperación entre procesos siguen en C04.

Verificación de este corte:

- [93 pruebas en cuatro archivos](../evidence/nodia-ai-ai39-channel-vitest-r01.json):37 nuevas del caso de uso/receptor JSONL y56 regresiones de sesión, proveedores y OCR. Incluyen formas incompletas/extra de límites, acceso/lease retirado, presupuesto, tamaño/profundidad, cancelación, replay y rechazo OCR.
- [14 comprobaciones Linux con procesos y streams JSONL reales](../evidence/nodia-ai-ai39-channel-process-r02.json), peer/gateway sintéticos y red aislada. Una sola llamada al gateway de prueba, rechazos contados, dos procesos propios recogidos y cero efectos/inferencia reales. El snapshot transpila cinco fuentes exactas en un directorio aislado; no equivale a adoptar el build completo. R01 conserva el primer ensayo con el mismo resultado; R02 sólo elimina imports/estado de prueba no utilizados.
- Tipado de producción `tsc --project tsconfig.build.json --noEmit` correcto y lint focal sin errores/avisos. La primera observación de tipado coincidió con una edición concurrente de recuperación; al completarla, el chequeo común pasó.

La revisión independiente detectó que la forma de límites debía validarse explícitamente; se corrigió con seis claves exactas y cuatro negativas adicionales. Sin cambio de configuración, perfil operativo, esquema SQL, módulos DI, registry, UI o publicación. AI-39 permanece parcial: conectar la primitiva al adaptador durable y demostrar herramientas con el binario real son trabajos pendientes.

## Continuidad histórica anterior a la integración

C01 prueba la política/admisión del binario nativo; C02 prepara identidad y barreras; C03 aporta sólo la primitiva de herramientas. Ninguna de esas pruebas instala un modo operativo. Faltan el adaptador/router por proveedor y modo, identidad durable en `armDispatch`, journal de perfil/operación, leases/fences compartidos con API/OCR/login, observación/payload real, contabilidad de todos los RPC y la ejecución nativa con gateway. C04 conserva cierre/prueba terminal/ACK y recuperación entre procesos/SQL sin duplicados. No afirmar integración del runtime completo ni transferir a Codex los proofs Gemini.

No se desplegaron estos cambios ni se activaron modos, conexiones, herramientas, UI o conocimiento nuevo. La entrega por entorno/aceptación con cuenta y modalidades sigue en AI-40; AI-38 y AI-36 mantienen sus pendientes. Las evidencias congeladas de este corte identifican fuentes y nivel de verificación para poder reproducirlo.

La [validación final del corte parcial](../evidence/nodia-ai-ai39-partial-validation-r02.json) comprueba fuentes SHA, recibos nativos/sintéticos, pruebas, estados de ficha y enlaces. Ese verificador histórico exige las fuentes congeladas de su corte; no se espera un positivo sobre el workspace posterior. El comando `python docs/evidence/scripts/nodia-ai-ai39-partial-validation-r01.py` no hace inferencias, despliegues o publicación. La comprobación vigente de esta continuación es [worker-validation-r01](../evidence/nodia-ai-ai39-worker-validation-r01.json). `knowledge:check` conserva59 fuentes/28 excluidas/31documentos y fragmentos, release418900…; no se edita el plan45 aprobado para añadir una actualización de progreso que cambiaría su hash de fuente.

## Continuación — integración del adaptador, worker, journal y gateway

Solicitud explícita del usuario del 2026-10-22. Este apartado sucede a los cortes C01/C02/C03; sus recibos identifican las fuentes de aquel momento y no validan automáticamente las modificaciones actuales. La validación sucesora conservará esos recibos sin reescribir sus hashes.

El router nuevo resuelve conexión, catálogo y modo exactos; Codex consume exclusivamente OpenAI/Agentic, Gemini conserva sus modos existentes y API/OpenAI Web no se incorporan. El adaptador calcula la generación de configuración desde SQL, verifica modelo/esfuerzo descubiertos y mide la envoltura nativa controlada, con una cota explícita de thread ID y sin afirmar un contexto en tokens. Una medida excedida permite compactación; sólo el envío rechaza el exceso definitivo. Los originales de adjuntos permanecen bloqueados.

El worker transmite identidad Codex, generación de sesión y fence de recurso al armar el envío. La validación ocurre dentro del checkpoint transaccional y antes de consumir presupuesto. Los callbacks revalidan grant, actor, retención, lease, fence y operación; toda herramienta pasa por el gateway común. El reconciler y ACK se seleccionan por la identidad persistida, sin consultar la configuración mutable para escoger otro proveedor. Los descriptores históricos Gemini conservan su forma.

La observación API cierra y cede el perfil nativo antes de retornar, permitiendo al worker tomarlo en otro proceso. El journal privado conserva identidad y certificados Linux mínimos antes de liberar el start gate, nunca mensajes, credenciales, catálogo o resultados. La ejecución usa un thread efímero y una sola llamada `turn/start`; cancelación cruzada registra intención, el dueño cierra su grupo y la conciliación de un supervisor perdido verifica sus certificados y el lock exacto. No se reclama un perfil por su antigüedad.

La [ampliación del ADR-072](../architecture/decisions/ADR-072-nodia-ai-provider-runtime-adapters.md#continuación-ai-39--composición-y-recuperación-entre-procesos) distingue las solicitudes de herramientas de los frames de generación, ambos acotados. El presupuesto durable precede al gateway, incluidos rechazos y duplicados que no alcanzan su callback; los snapshots finales preceden a la prueba terminal. Las pruebas acusadas sólo se purgan al pasar su deadline original. Desconocidos y pruebas sin ACK no se borran para liberar capacidad.

La [entrega sucesora](../evidence/nodia-ai-ai39-worker-runtime-r01.md) verifica el build común y 62 controles de PostgreSQL/procesos en cinco escenarios, más 16 controles Linux del journal. Incluye ACK nativo aceptado, rollback SQL posterior, purga y retry con prueba exacta; no inventa una pérdida de red. Los reintentos de limpieza no liberan slots ni atestiguan un cierre ausente. La suite general y sus fuentes se registran en la [validación final](../evidence/nodia-ai-ai39-worker-validation-r01.json). Los fixtures usan una cuenta y un peer JSONL sintéticos en un perfil temporal. Para probar el camino de herramientas se sustituye explícitamente sólo la readiness MCP de la observación dentro del fixture: la observación productiva sigue devolviendo MCP sin acreditar. Esto verifica integración y reglas locales; no certifica MCP/inferencia con OpenAI. Cuenta real, selección UI, formatos y entrega propia permanecen en AI-40.


El supervisor público cede el perfil al terminar de observar. Salud mantiene como máximo cuatro observaciones reales durante 30 segundos desde su fecha original, sin iniciar proceso, renovar checkedAt ni inferir disponibilidad generativa; una generación de sesión externa invalida la caché. El snapshot de código R06 se verifica contra su manifiesto completo y no se adopta en los servicios operativos. Los hashes de implementación de cuatro lecturas existentes se renuevan; el bundle local pasa a3990dc… sin cambiar74 capacidades,31fragmentos, permisos o aprobaciones.


Cierre de esta continuación:4.608 pruebas/252 archivos sin fallos ni omisiones, build R04 y conocimiento vigente correctos; lint sin errores/tres avisos históricos. La reorganización obligatoria de unidades conserva40 escenarios mediante casos de uso reales y traslada seis pruebas directas de transporte a siete escenarios Linux. Los62 controles SQL y16 del journal se repiten en R06, con el mismo código productivo que R05. [Resultados y límites](../evidence/nodia-ai-ai39-worker-runtime-r01.md).
