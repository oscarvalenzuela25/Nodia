# ADR-063 — Descubrimiento automático de herramientas por etapas acotadas

> Estado: propuesto
> Fecha: 2026-10-18

## Contexto

AI36-C01..C04 implementaron84 candidatos adicionales a las67 lecturas publicadas. La primera publicación selectiva C05 incorpora siete: crear un movimiento financiero y seis ayudantes comunes. Hay74 capacidades publicadas globalmente; las77 candidatas restantes conservan su gate. El catálogo completo y la selección que recibe el proveedor son objetos distintos.

El adaptador admite74 herramientas y131072bytes de catálogo por generación. Añadir los siete descriptores técnicos existentes a las74 capacidades daría81, antes de medir bytes. Aumentar límites o truncar herramientas ocultaría el problema. Un chat general tampoco debe obligar al usuario a conocer un perfil técnico para pedir operaciones entre productos.

El usuario eligió explícitamente «Descubrimiento automático por etapas». Esa decisión de interacción permite implementar la selección; no aprueba este ADR ni acredita ejecución con Gemini. La publicación estrecha se ampara en la [autorización C05](../../evidence/nodia-ai-ai36-c05-publication-authorization.md).

## Opciones consideradas

### Enviar todo el catálogo o aumentar sus límites

Reduce etapas, pero excede el transporte, eleva el coste de contexto y no satisface sus presupuestos independientes. Se descarta truncar, omitir herramientas silenciosamente o ampliar techos por conveniencia.

### Perfiles explícitos elegidos por el usuario

Ofrecen conjuntos pequeños y reproducibles, pero convierten una decisión interna en una obligación de navegación y dificultan solicitudes que combinan módulos. El perfil `finance_assistance` se conserva como selección explícita de API/backend para pruebas y compatibilidad; no se añade un selector de perfiles a la UI.

### Descubrimiento automático seguido de selección y ejecución

Una generación acotada descubre las capacidades publicadas autorizadas y propone IDs exactos. Tras su cierre conciliado, una etapa local activa la selección y una generación siguiente recibe sus contratos reales. Añade una generación Agentic normal y necesita pruebas de presupuesto, cancelación y recuperación entre etapas. Es la opción elegida.

## Decisión

- El modo predeterminado usa descubrimiento automático. La generación de descubrimiento recibe los siete descriptores técnicos existentes y `nodia_capabilities_select`, ocho en total; no recibe de golpe los74 contratos de dominio/comunes. Los ayudantes técnicos conservan sus reglas nativas y no obtienen permisos nuevos por pertenecer a esta etapa.
- El catálogo global publicado/autorizado tiene una identidad/hash congelados. La búsqueda y descripción permiten conocer los IDs exactos permitidos. Publicar, descubrir y seleccionar no amplían la autoridad del actor ni habilitan un recurso ajeno.
- `nodia_capabilities_select` propone entre1y67IDs exactos, únicos y publicados contra ese catálogo; la lista vacía es inválida. La selección y su recibo transaccional quedan ligados al run/intento, hash, autoridad y ámbito concedidos. No se acepta SQL, endpoints, nuevos schemas, nombres de clases ni una orden genérica para ejecutar herramientas.
- Una selección no activa contratos dentro de una generación en vuelo. Primero debe cerrarse la generación de descubrimiento, comprobarse su prueba terminal y completarse el ACK del protocolo nativo. La etapa local `tool_selection` no hace inferencia: revalida publicación, autoridad, recibo y presupuestos, reemplaza la allowlist del grant por la selección validada, sin exceder los módulos y el ámbito congelados ni los permisos vigentes del actor, y reanuda `inference` o `delegated_inference` según el camino ya autorizado.
- La generación de ejecución recibe únicamente los contratos seleccionados más los siete descriptores técnicos anteriores:67seleccionados+7técnicos pueden ocupar las74plazas. `nodia_capabilities_select` desaparece de esa generación. Los bytes de contratos pueden hacer inválido un conjunto incluso con menos IDs; el catálogo final se construye completo y se valida antes de armar el envío, nunca se trunca para hacerlo caber.
- Se conservan74herramientas/131072bytes de catálogo, cardinalidad JSON128, grant SQL128 y contexto ensamblado262144bytes. Son controles distintos. Ni descubrir una lista válida ni caber en SQL/JSON demuestra que el catálogo de ejecución quepa en bytes o en el contexto final.
- El camino Agentic que solicita y valida capacidades seleccionadas utiliza dos generaciones presupuestadas: descubrimiento y ejecución. Un saludo, aclaración o consulta que basten con las herramientas técnicas puede completar en una sola generación sin selección. Los ayudantes técnicos de informes pueden consultar datos mediante sus contratos nativos acotados; descubrimiento no significa ausencia total de lecturas SQL. No se habilitan preparadores de dominio o confirmaciones dentro de esa generación. Web continúa conversacional; cuando el usuario habilita la delegación opt-in de la misma conexión y existe Agentic válido, el camino presupuestado puede requerir tres: Web, descubrimiento Agentic y ejecución Agentic. El presupuesto acumulado vigente de tres también incluye compactación: si ésta consume una generación en la misma operación Web delegada, puede agotarse antes de la continuación. No se eleva ni reinicia el contador para evitar ese rechazo. No se cambia proveedor, modelo o modo por error ni se añade un reintento generativo para resolver un resultado incierto.
- Se reutilizan manifiesto de contexto, grants, recibos, intentos y etapas existentes. La transición local no crea una tabla, migración o servicio. La implementación de este bloque reside en Server; no cambia Python ni la UI.
- Las preparaciones publicadas sólo crean borradores/propuestas. La selección automática no confirma cambios ni acepta memoria. El botón humano exacto y los escritores/recibos nativos mantienen sus garantías.
- Se conserva el `catalog_release` opaco heredado `nodia-ai-ai15-reads/1` porque participa en los hashes de contrato y de recuperación. Las adiciones compatibles cambian `release_id`, que fija el nuevo contenido/bindings; el nombre histórico del epoch no restringe sus clases de capacidad. Las67 lecturas anteriores deben conservar exactamente sus hashes y metadata tras componer el lote nuevo.

## Consecuencias

- El usuario conserva un único chat capaz de combinar productos sin elegir perfiles técnicos. La ampliación futura requiere contratos/bindings aprobados y pruebas; añadir Markdown o una entrada del catálogo no concede disponibilidad.
- Hay un coste generativo y de latencia adicional explícito. Se requiere medirlo en la selección real; no se deducen cuotas, ventanas, precios o soporte de herramientas del nombre del modelo.
- Crash, revocación, cancelación, presupuesto agotado, callback repetido y respuesta incierta pueden ocurrir entre etapas. La transición sólo continúa con recibo y cierre acreditados; nunca vuelve a generar automáticamente para adivinar un resultado desconocido. Un ACK fallido permite únicamente el reintento acotado de limpieza previa al dispatch; no reenvía la inferencia. Cancelación o resultado desconocido impiden iniciar la segunda generación.
- El catálogo global potencial tiene74 capacidades y ocho nombres técnicos de descubrimiento:82nombres en su unión. No se envían simultáneamente. En ejecución hay siete técnicos y un subconjunto explícito; los límites finales se comprueban sobre sus bytes reales.
- Esta decisión y sus pruebas continúan en revisión. Contratos, publicación en fuentes, pruebas SQL aisladas, inferencia con la cuenta real y aceptación productiva son evidencias independientes. C05/AI36 no cierran por publicar el primer lote.

## Referencias

- [Entrega AI36 y C05](../../mvp/82-nodia-ai-ai36-integral-coverage.md).
- [Plan por etapas](../../mvp/45-nodia-ai-implementation-plan.md).
- [Publicación del conocimiento52](../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md).
- [Arquitectura43](../../mvp/43-nodia-ai-execution-architecture.md) y [política50](../../mvp/50-nodia-ai-ai04-runtime-policy.md).
- [Preparación MCP y botón humano, ADR-061](ADR-061-nodia-ai-mcp-write-preparation.md).
- [Publicación selectiva verificable](../../evidence/nodia-ai-ai36-c05-publication-validation.json).
