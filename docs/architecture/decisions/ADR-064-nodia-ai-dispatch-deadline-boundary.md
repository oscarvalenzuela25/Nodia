# ADR-064 — Plazo de preparación y plazo único por envío de NodiaAI

> Estado: propuesto
> Fecha: 2026-10-19

## Contexto

La [política50](../../mvp/50-nodia-ai-ai04-runtime-policy.md#cola-deadlines-retry-y-ciclo-del-perfil) define120s por envío al proveedor y600s por turno desde su admisión. El worker iniciaba un temporizador de120s al reclamar la etapa; después, el coordinador construía otra fecha de vencimiento al llamar al adaptador. Observación de disponibilidad, preparación del contexto, reserva y commit consumían parte de la primera ventana. Ambas fechas describían fronteras diferentes: el adaptador podía recibir una fecha posterior al aborto del worker.

Esta discrepancia es un defecto local comprobable de interpretación del plazo. No demuestra que sea la causa de las esperas nativas anteriores al primer callback observadas en C05-R01. Las cohortes históricas mantienen sus resultados, hashes, tiempos y conciliaciones; no se reetiquetan como pruebas del comportamiento corregido. La aceptación real posterior exige otra cohorte del compilado exacto.

El usuario priorizó explícitamente High: «Sino prueba solo con el high que es el que se usara por excelencia». Esta instrucción dirige los siguientes ensayos a la selección High exacta configurada y observada; no permite deducir correspondencias entre modelo e intensidad por sus nombres. La petición de separar modelo base y razonamiento queda pendiente de definición e implementación de producto, sin renombrar IDs ni modificar el catálogo en este cambio.

## Opciones consideradas

### Mantener120s desde el claim de la etapa

- Ventajas: un temporizador sencillo y preparación acotada.
- Desventajas: el tiempo de preparación reduce la ventana efectiva del envío; la fecha entregada al adaptador puede contradecir el plazo exterior y la política por envío.

### Aumentar el límite del proveedor o renovarlo en cada llamada

- Ventajas: puede permitir terminar un ensayo lento.
- Desventajas: cambia la política por conveniencia, oculta la frontera defectuosa y permitiría prolongar trabajo mediante llamadas repetidas. Se descarta; un resultado incierto tampoco autoriza un reintento.

### Separar preparación acotada y primer envío armado

- Ventajas: aplica120s por envío con una fecha absoluta compartida, conserva una preparación finita y mantiene el límite global600s.
- Desventajas: exige probar carreras de cancelación, pérdida de fence y commit del armado; una etapa puede durar más de120s incluyendo preparación y envío.

## Decisión

Implementar la tercera opción bajo la autorización de desarrollo vigente; este ADR permanece propuesto y su redacción no constituye aprobación documental ni aceptación real del proveedor.

1. La preparación comienza con el claim y se acota a `min(120s, plazo restante del job y del run)`. Los120s proceden de la política existente; no se añade otro valor persistido.
2. El primer `armDispatch` confirmado tras su commit inicia la ventana de envío de `min(120s, plazo restante del job y del run)`, únicamente si la señal y la autoridad/fence siguen vigentes. El contrato del contexto devuelve una sola fecha absoluta al coordinador.
3. El worker y el adaptador utilizan esa misma fecha para inferencia normal, delegación y compactación. El coordinador no fabrica otra ventana al construir la petición.
4. Un segundo armado dentro de la misma etapa no renueva el temporizador ni la fecha. El presupuesto durable sigue reservado antes de enviar; no se reinician contadores, cola, deadline global o identidad de la operación.
5. Cancelación, pérdida del lease/fence o vencimiento antes de finalizar el armado impiden continuar hacia el adaptador. Un commit de armado incierto conserva la clasificación conservadora `unknown`; no se supone rollback porque el await haya fallado.
6. Timeout tras un envío armado sigue requiriendo prueba terminal, conciliación y ACK. No libera el perfil, reenvía inferencia, cambia modelo/intensidad ni habilita otra generación por sí mismo.

La política mantiene600s de run y150s de drain. El drain conserva su desglose130s de parada y20s de margen/cancelación/flush; no se amplía para acomodar la preparación. El stop externo sigue abortando la etapa y aplica el flujo de incertidumbre existente. No se cambian DDL, cuotas, número de herramientas, presupuestos de inferencias o herramientas, proveedor ni campos de configuración.

## Consecuencias

- Consecuencias positivas: la ventana120s empieza en una frontera durable explícita y ambos lados aplican el mismo plazo; la preparación continúa acotada.
- Costos o riesgos aceptados: preparación y envío pueden ocupar ventanas sucesivas dentro del mismo límite global. Es obligatorio probar armado tardío, fecha mínima job/run, segundo armado, observación lenta, compactación, cancelación y pérdida de autoridad. Los tests no prueban latencia o disponibilidad de Gemini.
- Trabajo posterior: completar regresiones y el delta reproducible del compilado; verificar High real sin retry de incertidumbre; mantener separado el problema de espera upstream. Modelo base/razonamiento, otras selecciones y aceptación productiva siguen pendientes.

Los tres documentos funcionales afectados permanecen draft/unregistered. El runtime y sus tipos no figuran en los hashes de implementación de las74 capacidades publicadas ni en las fuentes de fragmentos aprobados. El compilador debe comprobar que el release publicado sigue idéntico; los nuevos artefactos de ejecución sí necesitan hashes del nuevo compilado. La evidencia aceptada de una cohorte anterior sólo acredita ese compilado histórico, aunque el contrato de herramienta sea compatible.

## Referencias

- [Política50](../../mvp/50-nodia-ai-ai04-runtime-policy.md), [worker57](../../mvp/57-nodia-ai-ai11-durable-worker.md), [contexto58](../../mvp/58-nodia-ai-ai12-context-execution.md).
- [Worker durable](../../nodia-ai/knowledge/nodia-ai/features/durable-worker.md), [contexto y ejecución](../../nodia-ai/knowledge/nodia-ai/features/context-execution.md), [compactación](../../nodia-ai/knowledge/nodia-ai/features/long-context-compaction.md).
- [Continuación C05-R01](../../evidence/nodia-ai-ai36-c05-r01-acceptance.md), [entradas explícitas del validador](../../evidence/nodia-ai-ai36-c05-r01-inputs.json).
