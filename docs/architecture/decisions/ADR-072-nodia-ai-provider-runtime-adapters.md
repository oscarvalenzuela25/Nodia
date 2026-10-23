# ADR-072 — Adaptadores de ejecución de NodiaAI por proveedor e identidad nativa

> Estado: propuesto; implementación autorizada, sin aprobación documental automática.
> Fecha: 2026-10-22.

## Contexto

El usuario pidió iniciar AI-39 después de investigar Web en AI-38. El [plan45, E11](../../mvp/45-nodia-ai-implementation-plan.md#e11--codex-agentic-en-nodiaai) permite preparar contratos y fixtures independientemente de la aceptación pendiente de Gemini. Codex debe reutilizar `openai`/`token_plan_agentic`, el perfil privado por conexión y el supervisor de [ADR-018](ADR-018-openai-codex-agentic.md).

La composición actual de `NodiaAiAdapterModule` dirige ejecución y conciliación sólo a Gemini. La observación tipada y los descriptores de recuperación asumen su contrato y prefijo de recurso. Codex ya tiene sesión, modelos, exclusión física del perfil y OCR; su JSONL rechaza por defecto las solicitudes de herramientas. Añadir sólo un nombre al selector no resuelve estos límites ni acredita chat/MCP.

La documentación oficial de [Codex App Server](https://learn.chatgpt.com/docs/app-server), consultada el 2026-10-22, describe generación de esquemas ligados a la versión del binario. También identifica `dynamicTools` e `item/tool/call` como experimentales. Esta referencia orienta el ensayo; no demuestra que el binario instalado acepte la política exacta de Nodia.

## Opciones consideradas

### Ampliar la clase Gemini para seleccionar Codex internamente

- Reduce archivos inicialmente.
- Mezcla HTTP privado de Gemini con JSONL, procesos y recuperación de Codex; invita a dirigir un ACK al runtime equivocado y dificulta preservar regresiones.

### Adaptadores separados y selección común cerrada

- Cada runtime conserva observación, medición del payload, ejecución y conciliación propias; el gateway, autoridad, presupuestos, propuestas y efectos continúan compartidos.
- Exige versionar la identidad recuperable y comprobar compatibilidad de trabajos históricos antes de enlazar el segundo adaptador.

### Crear otro servicio o reutilizar el perfil de la app Codex

- Un servicio separado permitiría aislamiento adicional, pero añade una frontera operativa sin necesidad demostrada en este corte.
- La sesión personal de la app, sus archivos de autenticación, configuración y herramientas no pertenecen a Nodia y quedan excluidos.

## Decisión

Preparar adaptadores independientes detrás de los puertos comunes existentes. Resolver ejecución por catálogo/ID de conexión y modo validados; resolver recuperación por la identidad nativa persistida del intento. No seleccionar por modelo, nombre visible, proveedor predeterminado, error ni estado actual de otra conexión. Combinaciones no implementadas fallan explícitamente antes del envío.

### Identidad y compatibilidad

1. La recuperación debe identificar sin ambigüedad adaptador, motor, intento, recurso físico, generación de sesión y operación. No basta `engine='agentic'`: Gemini y Codex comparten ese modo funcional.
2. Los descriptores Gemini v1 ya persistidos siguen legibles y con la misma interpretación. El nuevo contrato usa una discriminación cerrada/versionada; no se admite un prefijo arbitrario ni se vuelve permisivo el parser histórico.
3. La selección de conciliación/ACK no depende de una consulta mutable a la conexión: desactivar, eliminar o cambiar su configuración no autoriza abandonar un proceso anterior ni enviar su limpieza a otro runtime.
4. Un timeout conserva incertidumbre y exclusión hasta obtener una prueba propia de cierre. Una prueba Gemini no libera un recurso Codex. Caída del supervisor no prueba la muerte del hijo; comprobar identidad de proceso, arranque del SO y fence antes de actuar.

### Herramientas y política del proceso

El transporte de herramientas para chat se elige tras verificar el protocolo del binario fijado. Las herramientas dinámicas pueden adaptar el catálogo autorizado al callback común sin publicar un listener adicional; su carácter experimental exige una prueba nativa exacta sin inferencia antes de adoptarlas. Si no pasan, registrar el gate y evaluar MCP dedicado explícitamente; nunca habilitar una vía alternativa de SQL, shell o archivos.

La apertura de un handler de solicitudes del servidor es privada, exclusiva del lease del chat y limitada al método/identidad esperados. Las solicitudes desconocidas, de permisos, comandos o archivos se rechazan. OCR conserva su política de herramientas deshabilitadas. Cada callback atraviesa el gateway vigente con catálogo congelado, límites y reautorización; una aprobación nativa del agente no confirma una propuesta de Nodia.

### Perfil, contexto y persistencia

Se reutiliza `CodexRuntimeModule` y el lock físico por conexión para chat, login, OCR, catálogo y observación. Los slots/fences/presupuestos durables de NodiaAI complementan ese lock; no lo reemplazan con un mutex local ni se fuerza su retirada por caducidad. El competidor cancelado no detiene al dueño.

El historial canónico, las fichas autorizadas, preferencias y compactación siguen en Nodia. Para el primer corte se prefiere contexto nativo efímero por generación; cualquier referencia remota necesaria para conciliación es privada. No crear una tabla o JSONB de threads por conveniencia: [M-provider del plan45](../../mvp/45-nodia-ai-implementation-plan.md#migraciones-por-necesidad) es condicional a una necesidad probada. El recibo/journal mínimo debe sobrevivir al proceso cuando sea necesario para acreditar cierre y evitar duplicados, siguiendo retención/purga comunes.

Modelos, esfuerzos, modalidades, disponibilidad y medidas de contexto proceden de configuración/descubrimiento/verificación real. No introducir nombres de modelo, cuotas, modalidades o ventanas de tokens de respaldo. Si falta un dato, permanece desconocido o se bloquea el flujo que lo exige.

## Consecuencias

- Gemini conserva sus contratos y pruebas; sus defectos o su aceptación Web pendiente no se transfieren a Codex.
- AI-39 prepara backend/runtime/contratos y pruebas. AI-40 conserva selector, cambio explícito entre proveedores, aceptación con cuenta y modalidades por formato. No habilitar UI ni disponibilidad por pasar fixtures.
- OpenAI Web y delegación Gemini→Codex permanecen fuera del alcance. API key no se incorpora como fallback.
- La compatibilidad del protocolo, recuperación entre procesos y exclusión física son gates de implementación, no detalles aplazables al despliegue.
- El estado inicial es diseño propuesto; este ADR no publica herramientas, conocimiento ni un nuevo modo operativo.

## Referencias

- [Entrega AI-39](../../mvp/85-nodia-ai-ai39-codex-runtime.md), [arquitectura43](../../mvp/43-nodia-ai-execution-architecture.md), [política50](../../mvp/50-nodia-ai-ai04-runtime-policy.md).
- [Contrato de proveedores](../../mvp/ai-provider-feature-contract.md), [Codex existente](../../features/ai-providers/openai-codex-agentic.md).
- [Ficha de contexto/ejecución](../../nodia-ai/knowledge/nodia-ai/features/context-execution.md#extensión-planificada-codex-ai-3940).
- [Codex App Server oficial](https://learn.chatgpt.com/docs/app-server).

## Comprobación inicial AI39-C01/C03

El [ensayo nativo sin cuenta](../../evidence/nodia-ai-ai39-experimental-protocol-r02.json) del binario0.161.0 identificado por SHA verifica el parser experimental y un thread efímero. Se eligen herramientas dinámicas como transporte candidato, sin afirmar una llamada real. El [canal privado](../../mvp/85-nodia-ai-ai39-codex-runtime.md#primitiva-c03--canal-privado-de-herramientas-sin-integración-operativa) queda implementado y probado con gateway/peer sintéticos, sin instalarlo en el supervisor ni conceder disponibilidad. La contabilidad durable completa del overflow y la prueba terminal propia continúan como gates de integración. El estado de este ADR sigue propuesto.

El [corte C02](../../evidence/nodia-ai-ai39-c02-reconciliation-r01.json) concreta la compatibilidad: Gemini conserva schema1 y Codex declara schema2 con proveedor/contrato/conexión explícitos. La igualdad de prueba terminal incluye esa identidad y la implementación Gemini rechaza Codex antes del transporte. No hay router nuevo o runtime activo; producir/atestiguar la identidad durable y recuperar un proceso Codex siguen pendientes. [C01 con el inicializador real](../../evidence/nodia-ai-ai39-native-initializer-r01.json) comprueba además configuración efectiva y cierre en un perfil vacío, sin turno generativo.

## Continuación AI-39 — composición y recuperación entre procesos

Implementación en curso por solicitud explícita del usuario del 2026-10-22. Este apartado sucede al corte anterior; no cambia su evidencia ni aprueba automáticamente el ADR.

La composición enlaza ambos adaptadores mediante la identidad de conexión/proveedor/modo verificada en SQL. La recuperación y el ACK utilizan exclusivamente el descriptor persistido, aunque cambie o desaparezca la configuración de la conexión. El worker guarda schema2, conexión y versión Codex en la misma transacción que arma el envío; la identidad histórica Gemini mantiene schema1. Ninguna ruta selecciona proveedor por el nombre del modelo o por un error.

La API libera su perfil después de observar sesión/modelos: mantener un app-server ocioso bloquearía al worker de otro proceso. Una generación lógica de sesión privada por conexión es independiente del PID y se invalida por login/logout. La ejecución comparte exclusión física con OCR/login, inicia un thread efímero y persiste el certificado Linux del proceso gated antes de permitir su arranque. Un lock residual no se reclama por antigüedad ni únicamente por ausencia del PID supervisor.

El journal contiene sólo identidad, hash de payload, certificados de proceso/grupo/boot/birth, deadline original, contadores, intención de cancelación y prueba terminal/ACK. No conserva prompt, catálogo, argumentos, respuesta, credenciales o contenido de adjuntos. Cerrar el canal no prueba cierre del proceso: liberar requiere la parada del grupo propio y su cierre durable. Un resultado incierto se concilia sin otra generación. La purga sólo puede retirar terminales acusados cuyo deadline original pasó; nunca intentos desconocidos o pruebas sin ACK. La barrera SQL del worker protege la readmisión de intentos ya purgados; no se promete deduplicación nativa eterna.

Para Codex, el presupuesto compartido de RPC de herramientas cuenta solicitudes nativas servidor→cliente, incluidos métodos desconocidos, rechazos, duplicados y desbordamientos. Las notificaciones de texto y respuestas del app-server pertenecen al transporte de generación y se limitan/observan por frames y bytes; no equivalen a mensajes del puerto MCP stdio de Gemini. Cada intento de herramienta que no alcanza el gateway se contabiliza como rechazado, sin cargar dos veces el que sí entra en su transacción. La contabilidad de solicitudes precede al gateway; el snapshot final y cierre preceden a la prueba terminal. Esto no inventa el coste interno de tokens/inferencias del proveedor.

El gateway y sus grants, presupuestos, permisos, propuestas y confirmación humana continúan siendo los existentes. Codex no recibe SQL libre ni herramientas nativas de shell, archivos, agentes, permisos, conectores o MCP externo. Medir el payload controlado y probar el protocolo no habilita formatos ni certifica MCP para una cuenta real: esa aceptación permanece en AI-40. Los resultados y límites se consolidan en [la entrega AI-39](../../mvp/85-nodia-ai-ai39-codex-runtime.md).


Salud puede conservar sólo metadatos de observaciones reales (cuatro entradas, 30 segundos desde su checkedAt original), sin abrir el perfil ni extender su vigencia; el marcador de generación invalida observaciones de otra sesión. Tras la purga de un ACK vencido, la ausencia tipada del recibo sólo permite terminar limpieza si existe un job SQL de ACK arrendado/vigente con la misma identidad y prueba terminal exactas. Esa excepción no atestigua cierre ni libera slots y no aplica a corrupción o identidad distinta. El [ensayo compilado](../../evidence/nodia-ai-ai39-worker-runtime-r01.md) verifica el rollback posterior al ACK y su recuperación, separando peer sintético de aceptación del proveedor.
