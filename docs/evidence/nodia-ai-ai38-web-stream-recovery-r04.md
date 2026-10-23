# AI-38: recuperación Web dentro del plazo existente — R04

Estado técnico del2026-10-22: corrección implementada, pruebas aisladas y adopción Linux completadas. [QA y vínculos congelados](nodia-ai-ai38-web-stream-recovery-qa-r04.json). Esta evidencia no acredita una inferencia ni los adjuntos reales de la nueva época; el coordinador raíz realiza esas pruebas por separado.

## Problema demostrado y cambio acotado

La instrumentación previa mostró un stream con CID/RID, dos frames válidos y224 bytes, sin candidatas, estado de cola, análisis o errores clasificables. El caller corta la generación a120 segundos; el SDK2.1.1 tenía watchdog120 y espera un chunk durante watchdog+5. Eso impedía dar una oportunidad temprana al mecanismo ya existente de leer el historial del mismo CID. La causa del silencio upstream permanece desconocida.

`GeminiWebService._generate_content` acepta ahora un presupuesto opcional exclusivo del chat/probes de NodiaAI. Durante esa generación reduce el watchdog a `min(original, max(1, presupuesto/2-5))`; para120 segundos,55. El SDK puede leer el historial de la conversación recién creada sin reenviar la generación. El timeout original del SDK y el deadline del caller permanecen; timeout y watchdog se restauran al finalizar, fallar o cancelar. Los consumidores OCR omiten el argumento y conservan su comportamiento.

La revisión encontró dos requisitos adicionales de esta nueva rama, resueltos antes de adoptar:

- El SDK puede escribir el texto de un rechazo en sus logs aun con `verbose=False`. La construcción explícita de `GeminiWebService` deshabilita sólo el namespace `gemini_webapi` mediante la API pública de Loguru. Conserva los handlers y diagnósticos Nodia; no ejecuta esa configuración al importar. La política dura toda la vida del servicio y no se reactiva al terminar una petición.
- Si falla la recuperación y el SDK ya cerró su transporte, el wrapper podía conservar `is_initialized=True`. Se confirmó con la implementación real del SDK y un transporte sintético. Sólo ante error del chat y del mismo cliente actualmente instalado, con transporte realmente ausente, se invalida el flag. La próxima inicialización explícita reconstruye el cliente y rota su generación; no reenvía el intento anterior.

## Pruebas y alcance de la adopción

Diez pruebas nuevas ejecutan el parser, generación, decoradores, batch, `read_chat`, candidata y protección estructurada del SDK real con transporte/arranque sintéticos. Comprueban una sola generación, consulta del mismo CID, JSON con entidades intacto, errores, cancelación, restauración, presupuesto pequeño, compatibilidad OCR, reconstrucción y conservación de generación tras éxito. La prueba de privacidad habilita expresamente el logger del SDK antes del constructor; una [mutación en memoria que quita únicamente la guarda](nodia-ai-ai38-web-stream-recovery-privacy-mutation-r02.json) provoca el fallo esperado por texto del proveedor, sin modificar fuentes instaladas.

Suite Windows:527 pruebas,525 correctas y dos omisiones de plataforma. [Build Linux aislado](nodia-ai-ai38-web-stream-recovery-build-r04.json):496 pruebas sin omisiones, sin red/perfiles/credenciales, sobre46 fuentes de pruebas congeladas y una nueva fuente con diez casos. Las19 guardas del driver y cinco del wrapper MCP pasaron; ningún wrapper de proveedor fue ejecutado por este agente.

La [prueba del delta selectivo](nodia-ai-ai38-web-stream-recovery-selective-patch-r04.json) reconstruye los hashes anteriores del servicio al retirar únicamente los cambios revisados. `nodia_ai_chat.py` se obtuvo de la fuente pública desplegada `ca8fdd…`, se preservó CRLF y se insertó un solo argumento; el resto de cambios ajenos del chat en el workspace quedó fuera. La imagen incorpora dos fuentes modificadas y una nueva,49 en total;46 fuentes y las dependencias/Config de la base permanecen idénticas.

Tras [preflight](nodia-ai-ai38-web-stream-recovery-adopt-preflight-r04.json), la [adopción R04](nodia-ai-ai38-web-stream-recovery-adopt-r04.json) activó la imagen `sha256:6b9e2f7e3273f89c4c2285c852135213bb82a3391bfe06895f523554033acb49`, contenedor `c4814c5a184b55cd95c751ed904d0c957c0311148f8732169928ce6c3b2d5bd3`, época `2026-10-22T21:50:29.621768018Z`. Backup cifrado nuevo listo por siete días; API/worker activos, timers restaurados, configuración/mounts/entorno/nginx/Server/SQL conservados, seis contadores nativos y tres SQL pendientes en cero. No hubo inferencias, efectos de negocio ni migraciones durante la adopción.

R01, R02 y R03 son candidatos intermedios congelados que nunca se adoptaron. Se preservan sus informes y límites de revisión.

## Límites que conserva R04

El watchdog reducido se utiliza en la rama idle del SDK. Las ramas de cola o análisis utilizan su timeout original. Headers o heartbeats tardíos todavía pueden consumir el deadline120; la corrección habilita una oportunidad de recuperación y no garantiza que Gemini responda.

El SDK lee el historial por el CID recién creado y compara RCID con el anterior; no acredita una comparación exacta entre RID del stream y RID recuperado. Las pruebas verifican el mismo CID y mantienen esa limitación explícita. El contexto estructurado sigue ligado a la misma tarea y protege/verifica también el texto reconstruido desde el historial.

La admisión física del perfil continúa siendo obligatoria. Las pruebas de inferencia, MCP y formatos de épocas anteriores requieren nueva aceptación. Este documento no atribuye una respuesta a otra conexión, modo o modelo ni declara cerrada AI-38.
