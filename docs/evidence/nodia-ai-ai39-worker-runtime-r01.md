# AI-39 — integración del adaptador Codex con ejecución durable

Fecha: 2026-10-22. Continuación autorizada por el usuario; documentos y ADR conservan su estado de aprobación. Alcance: backend, runtime y pruebas aisladas. No se despliega el paquete ni se habilita Codex en la UI.

## Comportamiento implementado

El módulo de adaptadores resuelve la conexión y el catálogo exactos en SQL. OpenAI usa exclusivamente Agentic; Gemini conserva sus rutas. El checkpoint guarda la identidad Codex schema2 antes del envío, en la misma transacción que consume presupuesto. Conciliación y ACK usan esa identidad persistida aunque después se desactive la conexión. Los descriptores Gemini schema1 siguen siendo válidos.

La API observa sesión/modelos bajo el lease físico y cede el perfil al finalizar. El worker puede adquirirlo desde otro proceso. La generación lógica de sesión no depende del PID: login/logout la rotan. Salud conserva únicamente metadatos realmente observados, con un máximo de cuatro entradas y 30 segundos desde la observación original; no abre un proceso, renueva la fecha ni acredita inferencia o herramientas. La generación de otro proceso invalida esa caché.

La ejecución crea un thread efímero y realiza un solo `turn/start`. El catálogo autorizado llega como herramientas dinámicas; sus callbacks pasan por el gateway existente y revalidan actor, grant, retención, operación, leases y fences. Las escrituras continúan requiriendo propuesta y confirmación humana exacta. No se añade SQL libre, herramientas nativas, listener MCP, tabla o migración.

El journal privado persiste identidad, certificados Linux, deadline, hash del payload, contadores, cancelación y prueba terminal. No guarda mensajes, catálogo, argumentos, respuestas o credenciales. El certificado se sincroniza antes de permitir el arranque; la contabilidad de solicitudes precede al gateway y el cierre del grupo propio precede a la prueba terminal. Un lock no se reclama por antigüedad ni por el PID aislado.

Los frames de generación están acotados a 10.000 y 16 MiB; las solicitudes simultáneas, a 32. El contador persistido conserva también los bytes observados al desbordar ese límite: el valor registrado no amplía lo permitido. Notificaciones de texto no consumen un RPC de herramientas ni generan una escritura SQL por token. Solicitudes rechazadas, duplicadas o desconocidas sí consumen el presupuesto correspondiente.

## Verificación y procedencia

Verificación final R03: **4.608 pruebas unitarias en 252 archivos, sin fallos ni omisiones**, con fuentes estables durante el comando. Build R04 correcto; lint sin errores y tres avisos históricos fuera del cambio. Control vigente de conocimiento correcto. Los seis tests directos retirados están cubiertos por los siete escenarios Linux; la cifra menor respecto de R02 no representa pérdida de esos flujos. [QA unitario](nodia-ai-ai39-unit-qa-r03.json), [build](nodia-ai-ai39-build-r04.json) y [controles](nodia-ai-ai39-checks-qa-r03.json).

La [prueba SQL final](nodia-ai-ai39-worker-integration-r06.json) pasa 62 controles en cinco escenarios y usa PostgreSQL desechable y procesos distintos API/worker, con el código compilado completo en un snapshot Linux aislado. El peer JSONL, la cuenta y el modelo son sintéticos. Para alcanzar el gateway se sustituye sólo la readiness MCP en el fixture; el adaptador productivo conserva `supportsMcp:false` y formatos vacíos. No hubo solicitudes a OpenAI ni uso de las credenciales o BD configuradas.

Las primeras observaciones fallaron durante el arranque del fixture: R02 identifica exactamente una discrepancia entre el manifiesto vacío y las familias publicadas. Se actualizó el helper de pruebas para excluir las cinco familias reales, conservando la validación estricta del cargador. [R03](nodia-ai-ai39-worker-integration-r03.json) y [R04](nodia-ai-ai39-worker-integration-r04.json) pasan 46 controles en cuatro escenarios; son cortes anteriores al endurecimiento final y no se presentan como verificación de fuentes posteriores.

La [prueba del journal](nodia-ai-ai39-journal-integration-r06.json) pasa 16 controles y comprueba identidad entre instancias, rotación, permisos, purga de terminales con ACK tras su deadline original y conservación de desconocidos, no acusados o todavía vigentes. Rechaza symlinks sin leer el vecino. Sus certificados son sintéticos y no acredita parada de un proceso nativo por sí sola.

Los resultados finales de tests, build, lint, publicación, hashes y limpieza se consolidan en la [validación reproducible](nodia-ai-ai39-worker-validation-r01.json). Los ensayos de protocolo contra el binario real de C01 siguen siendo históricos: comprueban admisión/configuración sin cuenta ni turno generativo. Los ensayos nuevos usan un peer; no convierten esa evidencia en MCP real.

La [primera suite general](nodia-ai-ai39-unit-earlier-r01.json) pasó 4.572/4.573 pruebas: falló el fixture de cancelación de lectura externa, que sustituía `get()` sin representar la propiedad real del perfil y esperaba un número fijo de microtareas. Se registró el dueño sintético exacto y se espera el RPC observado antes de cancelar; se conservan las comprobaciones de exclusión, parada única y liberación. El build R03 detectó referencias documentales a recibos todavía inexistentes; se retiraron del frontmatter durante el ensamblado y R04 pasó. Esos fallos iniciales se conservan y no se presentan como positivos.

La revisión de la política de testing encontró pruebas nuevas que entraban directamente por helpers/runtime. Se ajustaron 40 pruebas para entrar por los casos de uso reales de adaptación, conciliación, sesión y catálogo, conservando el runtime y validadores reales con transportes sintéticos. Los seis casos directos del receptor JSONL pasan a [siete escenarios Linux de integración](nodia-ai-ai39-protocol-integration-r06.json): barrera inicial, ráfaga de 80 notificaciones y duplicado, persistencia previa al gateway, parcial excedido, fallo de persistencia, contador real de overflow superior a 18 MiB y rechazo de una solicitud oculta durante initialize. Siete grupos propios cerrados, temporales retirados, cero cuenta/inferencia/SQL. El corte global R02 de 4.614 pruebas queda histórico; la suite final R03 verifica la organización vigente. La producción es idéntica a la de R05/build R04.

El [manifiesto R06](nodia-ai-ai39-worker-snapshot-r06.json) fija 4.298 archivos de código/compilado/pruebas y coincide con los tres ensayos Linux. Sus dependencias Linux existentes se reutilizan mediante symlink sin instalar paquetes; ese symlink no es un montaje de sólo lectura. R01 describía incorrectamente esa propiedad en el nombre del metadato; el stager R02 la corrige sin alterar las evidencias históricas.

## Recuperación verificada

| Escenario aislado | Resultado SQL | Envíos / recibos técnicos |
|---|---|---|
| Respuesta completada | Respuesta guardada; ACK desde el otro proceso | 1 / 1 |
| Caída del peer después de la herramienta | Desconocido conciliado; run fallido sin reenviar | 1 / 1 |
| Cancelación desde la API | Dueño cierra su grupo; conciliación y ACK | 1 / 1 |
| Muerte del worker después del recibo | Lease SQL recuperado; hijo propio cerrado; ACK | 1 / 1 |
| ACK nativo recibido y rollback SQL posterior | Purga al deadline original; retry con la prueba SQL exacta | 1 / 1 |

El quinto caso inyecta un rollback real mediante un trigger de prueba y usa un reloj sólo del fixture para llegar al deadline original. No modifica la política ni la fecha del journal y no se presenta como una pérdida de red observada. El fallback por ausencia del recibo privado exige un job de ACK arrendado/vigente y la misma identidad, proof ID, resultado y fecha persistidos. No prueba cierre nuevo ni modifica el slot, que ya podría pertenecer a otro turno; un recibo corrupto o de otra identidad no obtiene ese fallback.

Los cinco casos terminan sin jobs de ACK pendientes, contenedores, perfiles o procesos propios vivos. Usan una lectura técnica del índice de conocimiento, sin efecto de negocio confirmado. Esto verifica deduplicación del envío y del recibo del gateway, no un efecto financiero real con Codex.

## Publicación y límites de la entrega

Se actualizan exclusivamente los hashes de implementación del supervisor en cuatro lecturas existentes. No cambian schemas, permisos, scopes, aprobaciones ni el número de capacidades: 74 publicadas y 77 candidatas sin publicar. El [recibo de procedencia](nodia-ai-ai39-provenance-r03.json) distingue este cambio del registro anterior. El bundle local cambia a `3990dc…`; el paquete operativo de AI-38 no se actualiza.

El validador estructural histórico de AI-15 conserva su supuesto de 0/67 capacidades y rechaza el catálogo vigente. Esa limitación se registra con su salida; no se modifica el validador congelado para obtener un positivo. El build y el control actual de conocimiento verifican los contratos vigentes.

AI-39 permanece parcial hasta completar sus gates de aceptación nativa. AI-40 conserva cuenta real, selección en el drawer, cambio explícito Gemini↔Codex, callbacks con el binario/proveedor, efectos confirmados y formatos por modalidad. Si falta el certificado privado en una ventana incierta, no se inventa una prueba de cierre ni se libera el perfil automáticamente. Ninguna prueba aislada habilita disponibilidad, cuotas o modalidades por el nombre del modelo.

Referencias: [entrega85](../mvp/85-nodia-ai-ai39-codex-runtime.md), [ADR-072](../architecture/decisions/ADR-072-nodia-ai-provider-runtime-adapters.md) y [ficha de contexto](../nodia-ai/knowledge/nodia-ai/features/context-execution.md).


Reproducir la comprobación congelada sin servicios: `python docs/evidence/scripts/nodia-ai-ai39-worker-validation-r01.py --check`. Los ensayos Linux se ejecutan únicamente sobre el snapshot aislado, con entorno mínimo y los runners de evidencia; no contra el despliegue operativo.
