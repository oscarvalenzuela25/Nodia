# ADR-079 — Piezas validadas de metadatos Agentic con vigencia propia

> Estado: propuesto; implementación offline autorizada, sin aprobación documental ni aceptación operativa
> Fecha: 2026-10-25

## Contexto

Una observación no generativa en la época cf652/a626 registró un proceso usage entre aproximadamente0,25–9,52s y models entre9,77–12,02s, cuando venció el presupuesto12s. El muestreo identifica fases/procesos, no éxito del comando, autenticación o contenido. El módulo desplegado valida usage después de models: no permite afirmar que aquella primera fase entregó evidencia válida. El resultado observado fue `agentic_timeout`; cero inferencias nuevas. No se atribuyen a este hallazgo los dos rechazos históricos C03 por `eligibility_changed`, cuyos motivos exactos no se conservaron.

[ADR-071](ADR-071-bounded-agentic-profile-observations.md) conserva exclusión del perfil, serialización FIFO y presupuestos acotados. El estado completo ya tenía TTL30s, pero un timeout de la segunda lectura descartaba la primera y la siguiente comprobación repetía ambas. La decisión afecta salud, descubrimiento y login; necesita definición explícita de vigencia e invalidación, sin trasladar autoridad a una caché.

## Opciones consideradas

### Opción A — Repetir ambas lecturas después de cualquier timeout

- Ventaja: conserva el tratamiento existente de un snapshot indivisible.
- Desventaja: vuelve a consumir el paso ya validado y puede vencer repetidamente antes de completar el catálogo.

### Opción B — Ampliar plazos o ejecutar CLI en paralelo

- Ventaja: podría completar dos comandos lentos en un solo intento.
- Desventajas: oculta el cuello con mayor espera o rompe la exclusión de un CLI físico. No se elige.

### Opción C — Reutilizar sólo piezas privadas validadas y aún vigentes

- Ventajas: una nueva observación explícita puede completar sólo el paso faltante; evita publicar un éxito parcial y conserva el presupuesto por comprobación.
- Costos: requiere timestamps por pieza, invalidación exhaustiva y descarte de respuestas tardías entre runner/sesión/login.

## Decisión

Implementar C, con un único módulo candidato `agentic_service.py` derivado de a626. El módulo local integra la misma lógica de metadatos conservando sus cambios ajenos de OCR; no se adopta ese archivo local completo ni se cambia `agentic_cli.py` o una versión CLI.

Validar retorno, envelope no generativo y groups de usage inmediatamente, antes de iniciar models. Guardar sólo su proyección permitida de cuota/autenticación: cuota parseada o null, fuente y fecha observada. Después validar código y parser de catálogo. No conservar stdout ni reportes crudos en las piezas. Cero real permanece cero; cuota desconocida sigue null, sin fabricar capacidad.

Cada pieza pertenece a la instancia de servicio, identidad del runner y generación de sesión, con época interna de invalidación. Tiene como máximo los30s existentes desde su propia validación. Un timeout nativo, exterior o `ServiceError(agentic_timeout)` conserva exclusivamente piezas ya validadas; la siguiente observación completa las ausentes. Otro error de autenticación, retorno no cero, parser o transporte invalida todas. El punto existente de invalidación tras un resultado de ejecución fallido también invalida ambas piezas: borrar sólo el snapshot permitiría reconstruir indebidamente el estado anterior. Es una sustitución de una instrucción en esa rama, sin portar otros cambios de OCR. No hay polling, retry interno ni generación repetida.

Un estado positivo y el catálogo público sólo se derivan cuando ambas piezas siguen vigentes. `_observed` es el timestamp más antiguo; ensamblar o leer no renueva esos30s. Si una pieza vence durante el otro comando, no se publica positivo: el siguiente intento debe renovarla. Cada lectura devuelve copias separadas. El snapshot completo es una proyección derivada, no una tercera caché con vida propia.

Begin/finish de login, cierre, cambio de runner o sesión invalidan las piezas. Capturar el contexto y comprobarlo tras cada await y antes de devolver un positivo evita commits/respuestas de otra época. Cancelación propaga y espera cleanup; conserva sólo piezas ya validadas de la misma época, sin aceptar la salida tardía de un runner que absorba cancelación. Esto también permite completar metadatos cuando el deadline exterior de salud cancela antes del deadline interno12s. Ningún resultado parcial se publica ni una pieza recibe más vigencia por cancelarse una espera. Se conservan la exclusión/admisión física, el single-flight existente y los presupuestos12/18s; no hay CLI paralelo.

Esta decisión precisa la prohibición de compartir resultados de ADR-071: pueden reutilizarse sólo metadatos independientes de la selección, dentro del mismo runner/sesión y TTL. **No se cachea la observación final de elegibilidad**. Cada solicitud mantiene su comando `/model` con modelo/esfuerzo exactos y las pruebas MCP/modalidad ligadas a configuración/modelo/esfuerzo/sesión. Salud o catálogo no crean esas pruebas ni reservan inferencia futura. No se comparte evidencia entre perfiles/runner/sesiones ni se añade fallback/modelo estático.

## Consecuencias

- Las comprobaciones sucesivas pueden terminar una lectura que antes repetía usage; ninguna observación parcial anuncia disponibilidad o modelos.
- El tiempo de cuota conserva su observación original. Un resultado dentro del TTL sigue siendo una observación acotada, no una promesa de inferencia o credenciales perpetuas.
- Regresiones atómicas con FakeRunner/reloj cubren parcial→sólo paso faltante→positivo, TTL desde la pieza más antigua, expiración durante trabajo, errores, cancelación, login, runner/sesión y respuesta tardía; cuota0/null y copias independientes.
- Las regresiones existentes de perfil siguen verificando selección distinta con `/model` propio, exclusión, FIFO, cancelación y plazos. Los fixtures que manipulaban sólo el snapshot anterior se adaptan a la evidencia por piezas sin quitar sus assertions.
- El candidato requiere empaquetado selectivo, adopción quiet y nueva época con recalificación MCP+PNG/PDF/WAV/WebM antes del próximo C03. Pruebas sintéticas no acreditan esa entrega, sesión real ni aceptación.
- C03 revisión3, knowledge publicado fda151/42 y fichas aprobadas permanecen congelados: no hay contrato público, permiso, herramienta o capacidad nuevos. La evaluación de impacto es interna a la veracidad/vigencia de salud; no requiere republicar conocimiento para habilitarla ni permite declarar la optimización desplegada.

## Referencias

- [Contrato funcional IA](../../mvp/ai-provider-feature-contract.md), [ADR-068](ADR-068-nodia-ai-pre-dispatch-observation-timeout.md) y [ADR-071](ADR-071-bounded-agentic-profile-observations.md).
- [Paquete y linaje offline](../../../ops/lab/artifacts/c03-agentic-status-evidence-cache-r01/README.md).
- [Evidencia de implementación y límites](../../evidence/nodia-ai-agentic-status-evidence-cache-20261025-r01.json).
