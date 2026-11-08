# ADR-094 — Host Gemini Teacher acotado sobre SDK y OAuth personal

> Estado: propuesto, sin aprobación documental. Seguimiento técnico2026-11-03: NativeR11/ServerR03 y ClientR03 adoptados; nueva calificación Gemini y material normal por Worker completados, con cierre y ambos ACK. SDKfe412 conserva un POST/FINISH DONE; los timeouts anteriores permanecen unknown sin replay. Sólo recuperación/backup finales pendientes en el corte de [evidencia actual](../../evidence/teacher-v1-vm-process-20261103-r01.json). Los apartados técnicos inferiores conservan su fecha/historia; esto no aprueba el ADR.
> Fecha: 2026-11-02.

## Contexto

El usuario solicita completar Gemini Agentic en Teacher en la VM. La restricción de97 exige selección exacta, ninguna herramienta ejecutable, presupuesto anterior al envío y cierre comprobado sin replay. El resultado Codex no acredita Gemini.

La prueba del CLI1.3.1 real, aislada y sin cuentas, mostró `finish` más `manage_task` en la petición del modelo. El análisis estático cerró la inyección de ese componente fundamental: el control interno que la evita no está expuesto por el loader Markdown utilizado; el loader JSON está deshabilitado en esa ruta. También existe una inferencia auxiliar de título con una resolución de modelo independiente. Una única comparación con1.4.12 conservó ambos comportamientos. `init.tools` sigue siendo un inventario global; retirarlo del parser no corrige esos problemas.

El servidor oficial ACP permite filtrar builtins con una lista vacía explícita, pero su bucle genérico reconstruye/reintenta sesiones y no transmite todos los límites SDK necesarios. Su OAuth personal sí tiene un gestor/proxy separable. En Linux utiliza un archivo propio, distinto de la sesión CLI: no acredita reutilización de las credenciales existentes. Su flujo oficial es PKCE/state con callback loopback dinámico y navegador; requiere una nueva autenticación humana si se adopta.

## Opciones consideradas

### Mantener el CLI con prompts, hooks o actualización de versión

Se descarta como solución comprobada: el hook deniega ejecución, pero conserva herramientas en contexto y permite continuaciones; ambas versiones ensayadas generan además títulos. No inventar flags ni habilitar Teacher a partir del catálogo global.

### Usar directamente el servidor ACP genérico

Su filtro explícito es útil, pero no basta para conservar el presupuesto y el límite sin replay de Teacher. No heredar su bucle de recuperación, descubrimiento de skills/MCP o cambio de sesión.

### Host propio con configuraciones públicas del SDK y puente OAuth oficial fijado

Es el candidato seleccionado para verificación. Evita modificar el motor y el bucle ACP; añade una composición acotada y dependencias que deben fijarse, probarse y conservar sus avisos. Si no supera la prueba aislada, Gemini Teacher continúa bloqueado.

## Decisión candidata

Preparar un host exclusivo de texto Teacher dentro del adaptador privado existente, sin nuevo microservicio público ni cambio a API key. Usar el punto de extensión público `AgentConfig` con una configuración Teacher tipada y la estrategia local estándar. No usar `ProxyAgentConfig`, cuya estrategia omite `budget_config` y otros argumentos en el paquete inspeccionado. Tampoco alterar diccionarios privados del SDK: el `LocalAgentConfig` ensayado añade un modelo IMAGE predeterminado durante validaciones y copias; la configuración específica debe conservar exactamente el destino TEXT explícito hasta el `HarnessConfig` real.

- Modelo/esfuerzo desde la selección persistida o su descubrimiento comprobado, sin fallback. Un proxy local valida el modelo y limita a uno los POST generativos antes de remitirlos al proveedor. No atribuirle una clave API externa: el destino real conserva OAuth personal.
- No solicitar créditos adicionales. La implementación oficial inspeccionada omite el campo de opt-in de créditos; validar esa equivalencia de petición y rechazar cualquier opt-in inesperado. Esto acredita la intención del cliente, sin inventar una garantía de facturación del backend.
- Presupuesto SDK de una llamada al modelo y un control final, reintentos de API/salida en cero, esquema de respuesta explícito y ninguna capacidad ejecutable. La frontera HTTP propia compone `toolConfig.functionCallingConfig` con `mode: ANY` y `allowedFunctionNames: [finish]`; el único control final no habilita I/O. Reconoce sólo el `NONE` exacto emitido por el SDK fijado o la configuración `ANY/finish` ya exacta, compone un objeto propio y vuelve a validar selección, prompt, esfuerzo, esquema y contexto antes de OAuth/contador/envío. `AUTO`, nombres adicionales y configuraciones desconocidas se rechazan; no se modifica el motor ni un diccionario privado del SDK. Deshabilitar subagentes, herramientas de cliente, MCP, skills y descubrimiento de contexto del usuario. Validar estos efectos en la petición y el ejecutor reales, no sólo en los objetos Python.
- SDK, binario LocalHarness compatible, dependencias y subconjunto OAuth/CCPA oficial con hashes y procedencia. Mantener las fuentes vendor byte-idénticas y sus avisos; no ejecutar el bootstrap general del paquete ACP. La licencia del SDK no se transfiere al material ACP. El entorno del host se aísla de las dependencias del FastAPI actual.
- Perfil OAuth Teacher separado lógicamente del CLI, sin copiar sus tokens ni sustituir su sesión. El login es explícito. El host de inferencia debe impedir por construcción que una renovación fallida abra un navegador o inicie autenticación interactiva; un precheck de credenciales por sí solo no elimina esa carrera.
- Compartir las barreras de perfil/capacidad y los contratos Teacher de ownership, descriptor, presupuesto, journal, publicación, conciliación y ACK. La identidad incluye host, SDK, motor, puente OAuth, política, selección y época real de la sesión. No trasladar calificaciones antiguas.
- Mantener el prompt y el resultado fuera de logs/journals técnicos, sin persistencia de archivos planos de respuesta ni exposición de credenciales. El proceso y sus hijos tienen dueño, plazo, cierre comprobado y entorno mínimo. Timeout o cierre del lector no prueban cancelación remota.

## Consecuencias

No cambian los modos públicos Agentic/API key ni el proveedor elegido. Codex y el chat/OCR Gemini actual conservan sus transportes. La composición OAuth depende de un paquete vendor fijado y necesita regresiones de contrato antes de cualquier actualización.

Las pruebas locales del motor con proveedor sintético, presupuesto, selección y negativos no equivalen a inferencia real autenticada. La integración Native conserva la reserva exterior al cerrar metadatos, mantiene cuarentena durable ante cierre incierto y exige prueba kernel por descendientes. El runtime incluye manifiesto/host/Native, ejecutable y biblioteca Python en su identidad; una época privada se rota sólo tras login explícito exitoso.

El OAuth personal oficial se completó explícitamente en R03. Las adopciones R06–R09 no convierten sus unknowns cerrados/ACK en éxito. Native R10/SDK R05 sí calificó la selección persistida exacta. Generación normal por Worker, recorrido y revisión del contenido de96 §25 conservan su cierre separado. Nada de esta propuesta publica fichas ni aprueba íntegramente V1.

## Corte técnico parcial SDK R03 / Native R07 — 2026-11-02

El recibo operacional `coordinated-oauth-r03-execute.json` acredita autenticación humana del perfil personal Teacher, cierre del proceso de login y reanudación coordinada, con cero peticiones generativas. No se copiaron credenciales CLI ni se empleó una API key externa. El intento posterior en Native R06 conservó resultado remoto `unknown`; su publicación/calificación no se acepta y el original no se reenvía. El lector Native anterior perdió el detalle seguro del terminal SDK, por lo que no puede reconstruirse retrospectivamente la causa del resultado real.

La reproducción local con Owner, Host y motor reales encontró una contradicción de protocolo: el SDK emitía `NONE` aunque declaraba el control `finish`; el primer mock fabricaba un finish sin respetar ese modo. Ese positivo anterior no prueba que un proveedor real pueda completar ese protocolo. La corrección de la frontera propia fuerza `ANY/finish`; el nuevo mock TLS respeta esa configuración y verificó exactamente un POST local, FINISH actual DONE ligado al resultado y cierre kernel del Owner, sin cuenta, egress, VM ni inferencia real. Esta evidencia demuestra la corrección local del contrato; **no demuestra que NONE fuera la causa del unknown R06**.

El paquete público SDK R03 está congelado con manifiesto `9cca2eb53a7f64336b95ba7050f51912baa1506c02af1b7e207b6cc23cc8b862`. Reutiliza la imagen SDK/dependencias fijadas: sólo política, guard y manifiesto cambian respecto de R02; Host, vendor, Python, bibliotecas y lock permanecen idénticos. Native R07 añade la corrección y un journal diagnóstico acotado sin texto, prompt, credenciales ni stdout crudo. Ambos paquetes están preparados; este corte no acredita construcción/adopción de la imagen R07 en VM, autenticación de otra cuenta o nueva calificación. Plan96 §24 y el consolidado parcial `candidate/docs-r07-r01/status-draft.json` conservan fuentes, hashes y pendientes.

## Defecto de composición de permisos y corte R08 local

R07 se adoptó realmente con SDK9cca; su calificación quedó unknown cerrado y con ambos ACK, sin resultado aceptado ni replay. El diagnóstico read-only saneado no encontró registro SDK y sólo conservó el código Native `lifecycle/cli_failed`; no permite afirmar cero POST del proveedor. La metadata comprobó `runtime_admission` UID10001/mode0755. La nueva reserva diagnóstica exigía0700 al padre compartido antes de crear su hijo y llamar al runner. El código9076 reprodujo exactamente ese rechazo en Linux aislado; no hace falta cambiar permisos del padre para corregir su contrato.

El fix63fc cambia sólo `_private_directory(parent, private=False)`: mantiene dueño correcto, path canónico, ausencia de symlinks y ancestros no escribibles por grupo/otros; el hijo sigue0700 y el registro0600/single-link/acotado. Tres métodos POSIX reales verificaron padre0755 sin chmod, rechazo de0777 antes de crear y restricciones privadas intactas. La suite completa post-fix pasó607casos total,597ejecutados correctamente y10omisiones,24.572s. SDK/Host/guard/política9cca no cambian. Esto acredita el fix local, no adopción R08, inferencia Gemini disponible o reinterpretación del original unknown.

[96 §25](../../mvp/96-nodia-teacher-implementation-plan.md#25-checklist-de-cierre-v1-por-capa--corte-r07-unknown--r08-local) audita el cierre de V1 por tarea/criterio. Runtime calificado, flujo completo VM con contenido real, recuperación/compatibilidad final y revisión documental tienen evidencias separadas. Los párrafos de preparación R07 anteriores conservan su fecha y se leen como historia. ADR y fichas permanecen sin aprobación/publicación.

## Corte real Native R10 / SDK R05: selección exacta calificada

El [consolidado técnico](../../evidence/teacher-gemini-sdk-vm-20261102-r01.json) fija OAuth personal R03 y adopciones reales R06–R10. R08 corrigió el padre0755 sin chmod; R09 corrigió SSE completo al EOF, multi-data y firma con texto vacío. R10 permite texto acompañante tipado y metadatos de firma como datos no ejecutables. Signature-only es una tolerancia explícita acotada, no una emisión REST o causa histórica demostrada. Unknown keys, I/O, llamadas ajenas, múltiples finish y texto sin finish se rechazan. El Host sólo publica el finish ligado al último paso SDK actual DONE y al hash, con política2479 intacta.

Los siete unknown históricos conservan cierre y ambos ACK, sin replay. Las reproducciones offline no reconstruyen las respuestas descartadas R08/R09. El SDK,48dependencias/vendor/avisos mantienen sus pins y el perfil OAuth es separado del CLI. Native actual pasó611casos total,601PASS y10omisiones. El primer fallo intermitente MCP R09 y su focal/segunda suite correctos permanecen preservados.

La calificación R10 dejó el trabajo922c779c… ready y la operaciónf0505be6… completed/cerrada con ACK SQL/Native. Su diagnóstico ligado acredita un POST upstream/HTTP200, FINISH DONE, hash de primera respuesta/objeto y cierre del hijo. MAX_MODEL_CALLS_EXCEEDED conserva el enum genuino y sólo se acepta con esa prueba completa; un límite por sí solo no es éxito. El CLI original conserva provider_internal_generation_posts:null; el uno procede del diagnóstico suplementario, sin reescribir el recibo.

El mensaje normal fue admitido por DI y consumido por el mismo Worker systemd real, pero terminó unknown/cerrado con ambos ACK y sin respuesta publicada. El Native retirado conserva lifecycle/cli_timeout; el journal SDK sólo tiene reserved, sin terminal ni contador del proveedor. No se conoce la causa más allá del timeout, ni se repite ese trabajo. La calificación no demuestra el recorrido completo con plan, material, evaluación, pausa o contenido revisado ni otras selecciones/modalidades. Persisten compatibilidad chat, recuperación/backup finales y consolidación. ADR propuesto y fichas draft/approval:null, sin publicación o aceptación V1 implícita. Los apartados anteriores conservan sus cortes históricos.

## Referencias

- [ADR093](ADR-093-teacher-agentic-text-runtimes.md), [contratos97](../../mvp/97-nodia-teacher-technical-contracts.md), [plan96](../../mvp/96-nodia-teacher-implementation-plan.md), [verificación91](../../mvp/91-ai-provider-onboarding-verification.md).
- [Semántica oficial de function calling](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/models/function-calling): NONE no permite llamadas; ANY exige una función y puede restringir sus nombres. No acredita disponibilidad del endpoint personal ni facturación.
- [SDK Python oficial](https://github.com/google-antigravity/antigravity-sdk-python), [integración ACP oficial](https://antigravity.google/docs/ide/extensions/zed/).
- Artefactos locales catalogados en `ops/lab/artifacts/teacher-vm-deployment-20261101-r01/native-probes/cli-effective-contract-20261102-r01/`, `gemini-effective-harness-20261102-r01/` y `acp-peer-review-20261102-r01/`.
