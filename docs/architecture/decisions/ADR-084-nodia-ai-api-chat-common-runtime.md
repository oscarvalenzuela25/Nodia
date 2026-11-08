# ADR-084 — Chat API key sobre el runtime común de NodiaAI

> Estado: propuesto, borrador en revisión; implementación autorizada por petición explícita del usuario el 2026-10-27. Sin aprobación documental ni publicación automática.
> Fecha: 2026-10-27

## Contexto

La retirada Web deja Agentic y API key como únicos modos. El corte anterior acredita API OCR, pero no API chat. El usuario solicita ahora que API key participe en NodiaAI con las mismas funcionalidades, permisos y confirmaciones que Agentic. Ocultar su indisponibilidad o anunciar herramientas por tener una clave no satisface esta petición.

NodiaAI ya tiene admisión durable, contexto autorizado, ToolGateway, propuestas revisionadas, confirmación humana, ejecuciones/recibos e incertidumbre externa. Duplicarlos para API introduciría dos políticas de autoridad y riesgo de repetir efectos. El transporte HTTP, además, no puede afirmar cierre de un proceso nativo ni cancelación remota por abortar un fetch.

## Opciones consideradas

### A: chat API aislado con ejecución directa de funciones

- Ventajas: menor trabajo inicial para producir una respuesta de texto.
- Desventajas: duplica permisos, contexto, presupuestos y recuperación; facilita bypass de revisión/confirmación y no sostiene la paridad solicitada. Descartada.

### B: tratar API como MCP o simular un proceso Agentic

- Ventajas: reutilización superficial de indicadores y proofs existentes.
- Desventajas: declara un protocolo inexistente y confunde cierre local con resultado remoto; proofs falsos podrían liberar o repetir trabajo inseguro. Descartada.

### C: transporte API específico y autoridad/runtime comunes

- Ventajas: un gateway y canal humano, selección exacta y presupuestos compartidos; HTTP expresa su propia semántica terminal. Permite incorporar proveedores sin copiar lógica de negocio.
- Desventajas: exige ledger durable de HTTP, migración y nuevas regresiones de crash/POST/reconciliación. Elegida para la implementación candidata.

## Decisión

Implementar [plan92](../../mvp/92-nodia-ai-api-chat-parity.md). Server resuelve las claves cifradas de la conexión y transporta texto/function calling mediante OpenAI Responses o Gemini generateContent. El modelo y esfuerzo provienen de configuración/descubrimiento explícitos; no hay fallback de modelo, conexión o modo ni retries de inferencia incierta. Python continúa ejecutando Agentic y no recibe keys API.

Las funciones del proveedor se validan y pasan por el mismo ToolGateway, catálogo cerrado, permisos, preparación de propuestas y observación. El modelo no puede confirmar ni ejecutar una propuesta mediante su propio callback. El challenge y el botón humano siguen ligados al comando, revisión y hash exactos; los escritores nativos conservan transacción, idempotencia y recibo.

Introducir `supports_tools` como booleano independiente del transporte. `supports_mcp` sigue describiendo MCP real y permanece false para API. Client admite el campo nuevo opcional sólo por compatibilidad con Server anterior y resuelve `supports_tools ?? supports_mcp` sin coerción; un false explícito no se reemplaza. Elegibilidad/caché siempre corresponden a la selección exacta y no a otra vía de la misma cuenta.

Agregar metadata durable API al runtime existente: ledger por intento con identidad/hash, dueño local, contador de POST y prueba/ACK; calificaciones por proveedor/conexión/generaciones/modelo/esfuerzo/contrato. No persistir secretos, prompts o cuerpos crudos. Reservar cada intercambio generativo antes de transmitir, incluidas continuaciones de herramientas, dentro de los tres envíos por run de política50. Una reserva incierta no se devuelve y una nueva invocación del adaptador no reinicia el presupuesto.

El descriptor API privado es schema3, engine api_key, con identidad cerrada. Su terminal expresa `local_transport_closed` y `remote_outcome`, sin `process_closed`. Resultado completado requiere respuesta válida observada; timeout/abort/crash mantienen resultado remoto unknown. Conciliación y ACK requieren prueba durable exacta y cierre del dueño local demostrado. Cerrar la propiedad local nunca demuestra cancelación remota ni autoriza replay.

OCR reutiliza el core y su ruta autorizada para la selección API exacta; extracción/comparación siguen sin efecto comercial. Imagen/PDF/audio nativos y generación de imágenes se califican por selección y modalidad con evidencia terminal real. El carril de generación de imágenes es independiente del function calling y no se habilita por éxito de texto. La elegibilidad API puede incluir `supports_image_generation` booleano; false informa al usuario sin bloquear texto y ausencia no inventa una calificación. Ningún nombre de modelo, catálogo o Markdown concede capacidades.

## Consecuencias

- Consecuencias positivas: una sola autoridad y confirmación, paridad de funciones de negocio sin duplicar sus escritores, separación honesta tools/MCP y HTTP/Agentic, y verificación reusable para proveedores futuros.
- Costos o riesgos aceptados: migración aditiva y compatibilidad de release; presupuesto tres POST puede agotarse antes de terminar una cadena de funciones; no se promete cancelación ni exactly-once externos. Modalidades y cuentas requieren aceptación propia.
- Trabajo posterior: completar unidades/contratos, SQL aislado con concurrencia/crash/ACK y rollback compatible, proveedor real con consumo autorizado, gates91, paquete/backup/VM/UI y evidencia sanitizada. Actualizar fichas e índices con aprobación independiente. La existencia del código candidato no acredita estos hitos.

## Referencias

- [Especificación92](../../mvp/92-nodia-ai-api-chat-parity.md) y [verificación obligatoria91](../../mvp/91-ai-provider-onboarding-verification.md).
- [ADR-083: Agentic/API y retiro Web](ADR-083-agentic-and-api-only-ai-modes.md).
- [Arquitectura43](../../mvp/43-nodia-ai-execution-architecture.md), [política50](../../mvp/50-nodia-ai-ai04-runtime-policy.md) y [publicación52](../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md).
- [Ficha candidata API chat](../../nodia-ai/knowledge/nodia-ai/features/api-key-chat-parity.md): draft, aprobación/publicación pendientes.
