# ADR-057 — Ciclo de vida privado de adjuntos y lectura multimodal verificada

> Estado: propuesto
> Fecha: 2026-10-17

## Contexto

AI-32 incorpora archivos y notas de voz sin I/O externo dentro de las transacciones de autoridad/efecto. El chat expira sin archivo permanente; un PUT o DELETE incierto necesita identidad mínima recuperable. Configuración y autenticación no prueban soporte multimodal.

## Opciones consideradas

### Contenido en JSON/BD y procesamiento dentro de API

Menos infraestructura inicial, pero mayor memoria/transporte SQL y acoplamiento del parser no confiable al servidor. Complica cuotas y recuperación tras caídas.

### Una tabla de adjuntos, objetos privados y jobs existentes

La tabla conserva identidad, cuotas y revisión. Los jobs reutilizan leases/fences/reintentos y sobreviven al borrado del chat sin copiar contenido. Exige probar carreras de publicación y limpieza.

## Decisión

Elegir la segunda opción: intención durable antes de PUT, metadata real o null, ownership y generación; parser Linux aislado sin red/exec con15 segundos/256 MiB, limpieza fuera de SQL. Reutilizar nodia_ai_jobs kind delete_blob con descriptor mínimo. No crear tablas por formato, transcripción o disponibilidad del proveedor. La interpretación aceptada se congela al vincular el mensaje.

El transporte privado envía originales efímeros sólo con prueba semántica de la selección exacta. La prueba vive en memoria y se invalida al reiniciar o cambiar sesión/configuración/modelo/esfuerzo. Web conserva su rol conversacional; los archivos no habilitan MCP. La copia a factura necesita key propia, intención durable y recibo atómico; una referencia a la key del chat caducaría incorrectamente con él.

## Consecuencias

Cuotas incluyen reservas, originales y derivados; las limpiezas pendientes consumen espacio hasta DELETE confirmado. No se crea archivo histórico adicional. Orden de locks chat→adjunto→job y publicación cercada contra PUT tardío, con SQL real. El aislamiento efectivo Linux no se atribuye a Windows. La evidencia de una modalidad no habilita otra ni garantiza cuota futura.

Los originales de turnos antiguos no se reenvían automáticamente: se mantienen referencia y respuesta; el usuario puede adjuntarlos explícitamente de nuevo. Compactación corresponde a AI-34. Estado técnico y gates en[entrega78](../../mvp/78-nodia-ai-ai32-attachments-voice.md).

## Referencias

- [Plan45](../../mvp/45-nodia-ai-implementation-plan.md)
- [Política50](../../mvp/50-nodia-ai-ai04-runtime-policy.md)
- [Ficha](../../nodia-ai/knowledge/nodia-ai/features/attachments-and-voice.md)


## Precisión de transporte R01 — 2026-10-18

El lector Agentic temporal ofrece exclusivamente view_file/finish y mantiene el hook con rutas exactas y comprobación de lecturas terminadas. La lectura con MCP conserva además el catálogo autorizado de esa ejecución. La preparación de audio WebM para el SDK Web conserva su MIME real sin alterar bytes; no se deriva soporte de esa preparación. Web reconoce únicamente citas nativas canónicas al final de un JSON íntegro y validado; no repara campos ni reenvía inferencias. Evidencia por imagen/sesión y gates en la revalidación de [entrega78](../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r01--2026-10-18). El ADR continúa propuesto.


## Precisión de formatos y legacy R02 — 2026-10-18

Las pruebas nativas se vinculan al MIME decodificado exacto, no sólo a imagen/pdf/audio. Un éxito WAV no autoriza WebM y uno PNG no autoriza JPEG. Server y microservicio exigen esa evidencia; el cliente distingue disponibilidad por formato y resumen por categoría, manteniendo desconocido ante ausencia. No se añaden tablas ni una transcodificación implícita.

Trasladar una factura legacy sin adjunto nuevo reutiliza el intent de subida y recibo existente: copia externa acotada y cercada, descriptor legacy v2 con key fuente y digest/tamaño observados tras GET, y asociación atómica en SQL. El preview conserva la identidad/key privada operacionalmente inmutable, sin prometer metadata de contenido anterior inexistente; sobrescritura externa bajo la misma key no tiene versión histórica para detectarse. Sin borrado de origen previo al commit. Evidencia y límites en [R02 de entrega78](../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r02--formatos-de-audio-y-traslado-legacy). Estado propuesto conservado.

## Precisión de transporte R03 — 2026-10-18

Sólo el turno estructurado NodiaAI Web compensa la decodificación HTML de Candidate mediante un scope por cliente/tarea y verifica huellas pre/post de la candidata elegida y resultado final. OCR conserva comportamiento previo. La garantía comienza después de _parse_candidate y su limpieza de artefactos; no repara JSON ni acredita el origen del texto ya inválido. La etiqueta privada de prueba pasa a /3; selección/MIME/sesión exactos y MCP conservan sus barreras. Upload y cadencia se observan sin contenido ni peticiones adicionales. Evidencia y gates en [R03 de entrega78](../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r03--entidades-html-y-diagnóstico-por-fase); estado propuesto conservado.

## Precisión de audio Web R04 — 2026-10-18

El descriptor de generación identifica explícitamente audio y MIME, a partir del adjunto validado, sin cambiar bytes, nombre, referencia o upload del SDK. Scope por cliente/tarea, cardinalidad y alineación exactas; OCR/imagen/PDF/texto conservan ruta. La metadata nace de un protocolo propuesto en el PR179 histórico, cerrado sin merge; la aceptación depende de canarios actuales, no de esa propuesta. Versión privada de prueba /4, sin contrato público o tabla nueva. Diagnóstico previo al parser ligado a candidata elegida distingue fuente/limpieza/Candidate sin texto ni reparación. [R04 de entrega78](../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r04--clasificación-explícita-del-audio-web) registra dos frases WebM/Ogg correctas, límites, regresiones y pendientes. El ADR continúa propuesto.

## Revalidación AI-32-R05 — almacenamiento y compositor

El SDK no repite PUT de NodiaAI aunque haya persistencia previa a una respuesta perdida: cliente reutilizable con maxAttempts1, separado del cliente nativo de facturas/GET/DELETE, con cierre de ambos en shutdown. La intención durable conserva conciliación y compensación. HTTP sintético con SDK real prueba la no repetición; canario R2 y app verifican bytes exactos, no un contador cloud inexistente.

El compositor contiene su contenido con un scroll propio en pantallas desde600px, sin scroll adicional de Adjuntos; móvil crece naturalmente. No cambia ownership, mounts, revisión o autorización. R2 y micrófono físico confirmados en el flujo Web desde la app, sin atribuir esa prueba a retención, promoción o producción. [Entrega/evidencia R05](../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r05--r2-micrófono-y-contención-del-compositor). Estado propuesto conservado.

## Revalidación AI-32-R06

La [evidencia R06](../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r06--purga-y-copias-de-factura-con-r2-real) contrasta en SQL desechable y R2 real la separación entre objeto del chat y copia de factura, intents previos al PUT, recibos/consumo atómicos, compensación y purga por generación. La pérdida de ACK de DELETE se inyecta localmente después del efecto real; el witness permanece hasta conciliación y luego desaparece. Son verificaciones de la decisión existente, sin nueva arquitectura o aprobación. Estado propuesto conservado.

## Revalidación técnica AI-32-R07

R07 cierra técnicamente AI-32 en laboratorio: cuatro casos nuevos de lifecycle del inspector correctos Windows/Linux; diez checks SQL/R2 sobre PUT posterior al commit de expiración y janitor en PID distinto, sin modificar ventana70s. Un PUT/un DELETE y GET404 en cota superior real70.01s; nueve guardas offline. Falla inicial de montaje DI del arnés antes de PUT preservada, corregida sólo en pruebas. Sin código/configuración/migraciones/inferencias de aplicación nuevos; base y objeto sintéticos retirados, chat R05 intacto. No prueba SLA/producción ni publica MCP. [Entrega78](../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r07--aceptación-técnica-y-recuperación-tras-put-tardío) y [consolidado R07](../../evidence/nodia-ai-ai32-r07-validation.json). Fichas y ADR conservan sus aprobaciones previas; el build de conocimiento no publica borradores.
