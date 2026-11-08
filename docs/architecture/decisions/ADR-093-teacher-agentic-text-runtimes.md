# ADR-093 — Texto Teacher en Codex y Antigravity con capacidades restringidas

> Estado: propuesto; implementación y calificación en curso, sin aprobación documental implícita.
> Fecha: 2026-11-01.

## Contexto

El usuario solicita desplegar Teacher en la VM y disponer de Agentic tanto con OpenAI/Codex como con Gemini/Antigravity. La implementación previa sólo calificó API key en Windows. El modo Agentic, una sesión autenticada o `dynamicTools: []` no demuestran que el runtime haya eliminado sus herramientas nativas. Deben conservarse las fronteras de97: selección exacta, cero acceso ejecutable a archivos/shell/red/MCP/negocio, presupuesto anterior al envío, owner Teacher real y cierre sin replay.

Codex0.161.0 no expone una política global de herramientas vacía mediante los RPC del app-server. Su API Rust pública sí permite pasar `ToolPolicy.allowed_tools = Some(vec![])` al construir una sesión. Antigravity1.3.1 ya admite roles propios y un hook previo que deniega ejecución; su terminación estructurada usa `finish`.

## Opciones consideradas

1. Reutilizar el app-server de Codex sólo con sandbox read-only, flags parciales o instrucciones. No demuestra catálogo vacío ni bloquea necesariamente herramientas futuras; se descarta.
2. Convertir Agentic en API key o instalar otro SDK sin probar reutilización de su autenticación. Cambia el modo o la identidad; se descarta.
3. Mantener un fork del ejecutable Codex. Añade mantenimiento de parches al proveedor; se evita mientras la API pública permita un host acotado.
4. Host Teacher sobre crates oficiales Codex fijadas por commit, y carril cerrado del CLI Antigravity existente. Permite imponer la restricción dentro de cada motor y conservar las sesiones, con coste de integración, compilación y pruebas propio.

## Decisión

Se implementa la opción4, sin sustituir los transportes de chat/OCR existentes ni crear otro microservicio público. Cada selección permanece no calificada hasta superar sus pruebas reales en el entorno de ejecución.

### Codex

Un binario específico de texto Teacher usa `codex-core` del commit oficial `979011409de0a60b52f179721948e65531d26144` (tag0.161.0), sin modificar upstream. Inserta la política vacía antes de crear el thread y usa aislamiento de sesión sin entornos de ejecución. No admite herramientas dinámicas, adjuntos, configuración arbitraria del usuario o modelos de respaldo. El perfil y su autenticación ChatGPT son los existentes; no se exportan credenciales ni se crean cuentas nuevas.

El host recibe un comando privado acotado y emite únicamente eventos de inicio/resultado/error seguro. El catálogo vacío y el rechazo de llamadas inesperadas se comprueban contra un backend sintético antes de usar una cuenta real. Los reintentos del transporte se deshabilitan. El wrapper Node comparte el candado/perfil del runtime actual y prueba el cierre del grupo de procesos; no introduce un segundo candado o un perfil alternativo para evadir ocupación.

La ruta del binario, su hash, el commit y la política forman parte de la identidad calificada. `--capabilities` no lee perfiles ni realiza inferencias. El app-server habitual conserva su ejecutable, su protocolo y sus cualificaciones previas.

### Antigravity

El carril candidato reutiliza CLI, sesión, supervisor y journal actuales y configura un rol con `tools:[finish]`. Su habilitación exige demostrar el contexto efectivo y la denegación previa de cualquier otra herramienta, con recibos verificables; el frontmatter no acredita esa restricción. MCP, skills, adjuntos, slash commands y subagentes deben permanecer deshabilitados en el carril Teacher.

El rol reside en `.gemini/config/agents/nodia-teacher-text/agent.md` dentro del HOME temporal aislado de cada preparación, con `excludeDefaultComponents:true`; no se escribe en el HOME autenticado real. El diagnóstico offline del CLI1.3.1, sin red ni credenciales y con los mismos bytes del rol, lo descubrió en esa ubicación global aislada y no en `.agents/agents/…` del workspace. No se añade `--project` ni se supone una causa upstream. Este hallazgo sólo prueba descubrimiento: el catálogo efectivo real debe verificarse mediante EOF y la inferencia válida se califica después por selección exacta.

`finish` es exclusivamente el control de devolución final estructurada: no concede I/O, consultas a Nodia, acceso a archivos, shell, red o delegación. El contrato exige que la lista de **capacidades ejecutables** de Teacher permanezca vacía; no se declara cumplido para Gemini. No se describe falsamente el catálogo literal del CLI como `[]`. Este detalle de protocolo no autoriza otras herramientas ni amplía permisos. Ausencia, fallo o timeout del hook impiden aceptar el resultado.

**Resultado R05, habilitación Gemini bloqueada:** el análisis estático reproducible del binario oficial fijado demostró que `init.tools` es un inventario global:63 nombres menos tres exclusiones fijas explican los60 observados. Ese campo no demuestra el catálogo efectivo del rol. La cadena inspeccionada sí consume `ToolNames`, pero añade los componentes `send_message` y `schedule`; no quedó acreditada la ausencia de converters/handlers ejecutables implícitos ni el contexto final del modelo. Se conserva el rechazo y no se registra calificación Teacher. Dos resultados históricos unknown permanecen cerrados y con ambos ACK, sin replay; R03–R05 sólo realizaron inspecciones EOF. El SDK oficial permite limitar capacidades, pero el código público revisado exige API key o Vertex y no acredita reutilización del OAuth personal del CLI; no se cambia de modo ni se instala como fallback. El [recibo VM](../../evidence/teacher-agentic-vm-20261101-r01.json) enlaza el reproductor, ASM y hashes conservados localmente. Una integración futura exige probar la restricción efectiva antes de otra inferencia, no retirar el gate del catálogo por el hallazgo del inventario global.

### Ownership y puerto compartido

El puerto de generación distingue API text, Codex Teacher text y Antigravity Teacher text. Usa los mismos slots/capacidad, orden de locks, límites de actor/sesión y configuración del proveedor. Conserva los IDs reales de sesión/job/intento Teacher; no crea conversaciones/runs de chat ficticios ni modifica los envelopes firmados legacy.

El contrato privado Agentic es `teacher-agentic-text/1`. Vincula operación, sesión, job, intento, actor, conexión, modelo/esfuerzo, hash de entrada, configuración, época de sesión y hashes de runtime/política. La preparación/observación externa no se ejecuta dentro de una transacción SQL con locks. Antes de inferir se revalidan autoridad, selección, lease y descriptor, y se consume presupuesto. No hay fallback entre proveedores o modos.

Un cierre del lector HTTP de Server no demuestra que el proceso nativo haya terminado. El slot sólo se libera con prueba del supervisor propietario, ligada al descriptor exacto; un timeout, PID ausente sin identidad o lease vencido no bastan. SQL confirma publicación/cierre antes del ACK externo. El ACK se recupera idempotentemente. Pérdida de resultado conserva `unknown` y nunca repite el envío original.

### Calificación y adopción

La calificación Agentic es independiente por proveedor/conexión/modelo/esfuerzo/entorno/configuración/época/runtime/política. Incluye texto estructurado real válido, intentos de herramientas prohibidas, fallos del control previo, cancelación, cierre y recuperación sin replay. La evidencia API de Windows no se traslada a la VM ni habilita Agentic.

La adopción exige respaldo cifrado y restauración ensayada, migraciones incrementales sin reescribir las aplicadas, consumidores drenados y reemplazo coordinado. Se conservan perfiles, claves, asignaciones, contratos de negocio y conocimiento aprobado. La capacidad de disco debe resolverse antes de staging o respaldos; cualquier archivo de datos privados retirado necesita copia íntegra recuperable y verificada fuera de la VM.

## Consecuencias

- Se dispone de controles técnicos por proveedor, sin confiar sólo en prompts.
- Se mantiene un pequeño host Rust adicional, con toolchain/dependencias fijadas, manifiesto de compilación y pruebas de protocolo. No se actualiza por inferir una versión nueva del proveedor.
- Las actualizaciones de binario/política invalidan la calificación correspondiente; no se amplía un éxito a otros modelos o modalidades.
- Se añade recuperación neutral para Teacher Agentic. La restauración exclusiva del chat sigue rechazando bases Teacher pobladas hasta disponer de un ensayo integral autorizado.
- El coste de implementar o compilar el host no permite rebajar las restricciones ni declarar disponible un carril no comprobado. Aprobación documental, publicación de fichas y aceptación operativa se registran separadamente.

## Referencias

- [Contratos Teacher97](../../mvp/97-nodia-teacher-technical-contracts.md), [plan96](../../mvp/96-nodia-teacher-implementation-plan.md), [verificación91](../../mvp/91-ai-provider-onboarding-verification.md).
- [ToolPolicy de Codex0.161.0](https://github.com/openai/codex/blob/rust-v0.161.0/codex-rs/ext/extension-api/src/tool_policy.rs), [ThreadManager](https://github.com/openai/codex/blob/rust-v0.161.0/codex-rs/core/src/thread_manager.rs).
- [Agentes Antigravity](https://antigravity.google/docs/subagents/), [hooks](https://antigravity.google/docs/hooks?tab=cli), [terminación estructurada](https://antigravity.google/docs/sdk/tools).
