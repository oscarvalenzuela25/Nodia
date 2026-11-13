# Teacher: validación del upgrade en development

Recorrido de la sesión del 2026-11-11, terminado durante el 2026-11-12 UTC. **Upgrade validado en la VM de development**, con autenticación habitual, proveedor real, correcciones y respaldo/restauración final. Sin promoción a master, publicación de conocimiento ni aprobación documental nueva. El [recibo técnico](teacher-upgrade-development-vm-20261111-r01.json) conserva selección, trabajos, hashes, límites y referencias a los paquetes privados locales.

| Comprobación | Resultado observado |
| --- | --- |
| Instalación efectiva | Server R14 / Client R41; 48 migraciones y 102 tablas |
| Autenticación e históricos | Google normal; lectura del curso DNS anterior y de la nueva sesión QA, sin usar cursos personales como fixtures |
| Diagnóstico previo al plan | Banco manual de 2 ítems, 2/4; confianza cero y evidencia asistida conservadas |
| Evidencia por objetivo | Dos mapeos explícitos; error de filtrado propone discriminación/refuerzo y acierto asistido propone comprobación independiente |
| Material adaptativo | 6 bloques, fuente sintética admitida por hash y 5 ítems de práctica; ejemplos SQL revisados |
| Práctica | 12/14, con error deliberado; escrita 6/6, borrador y metadatos conservados al recargar |
| Aclaración contextual | Hilo anclado real, respuesta pertinente; completar su calificación original no repitió inferencia |
| Ajuste del plan | Candidata cambia sólo el título solicitado; se conserva el plan aceptado y sus resultados |
| Final | 12 respuestas congeladas; 40/40: 16/16 objetivas y 24/24 en cuatro escritas. Dos objetivos cubiertos con 6 ítems y 20 puntos cada uno |
| Restricciones durante la final | Lectura del hilo anterior permitida; editor/envío de nuevas aclaraciones bloqueados; correcciones tras la entrega completa |
| Otros recursos | Fuente, tarjeta/repaso, actividad manual, gráfico declarativo y concepto guardados y releídos por su alcance |
| Reanudación | API/Worker R14, Native saludable con el mismo contenedor/imagen, keyrings y timers activos; 15 comprobaciones finales satisfactorias |

La nueva sesión QA es `6e944c6b-7a40-4ab2-8fdf-965ee3748b01`. El plan aceptado `94802aac-0a16-4865-81d9-5d8d27abca2d` conserva su hash `f411234188a80247ee9cf6025ed5f3c348c7b2b108ce6bdbe8b83a486a626a33`. La candidata de ajuste no se activó.

## Selección real y contabilidad

La selección procede de la configuración persistida: OpenAI, Agentic, `gpt-6.1-sol`, esfuerzo `medium`, conexión `1`. El modelo no se introduce como fallback en código. Se comprobaron transporte de texto, planificación, material, aclaración contextual, ajuste, evaluación y corrección escrita en el runtime común.

La campaña reservó 11 generaciones en dos fixtures: 10 dispatches Native iniciados y 10 trabajos `ready`; una reserva inicial terminó `failed_known` antes del transporte, con cero dispatches iniciados. Todas las operaciones quedaron cerradas y con ambos ACK aplicables. Los HTTP/POST internos de Agentic son **desconocidos**, no se presentan como diez POST. No hubo nuevos unknown, replay de resultados inciertos ni cambio de proveedor/esfuerzo.

La calificación contextual usa un propósito separado del canario de transporte. R14 completó el job original mediante el CLI oficial `--complete-job-id`, sin otro dispatch, sin cambiar selección anclada, snapshot, respuesta o hash. La posterior aclaración real y ambas correcciones escritas cerraron correctamente.

## Fallos corregidos y revalidación

1. **Observación concurrente del perfil:** las invalidaciones del flujo educativo reconsultaban proveedor/elegibilidad y podían disputar el perfil con Worker. Se reprodujo el mecanismo sin inferencia; la excepción interna del primer intento no se conserva y no se atribuye una causa exacta no demostrada. R40 acota esas invalidaciones y actualiza evidencia/resultado derivado. Las solicitudes reales posteriores de conversación y plan no solaparon GET de proveedor durante el trabajo. R41 conserva la corrección.
2. **Assets históricos en Nginx:** la cadena de redirecciones devolvía 500 para un asset inexistente. Se sustituyó por búsqueda plana; R41 conserva 76 destinos previos y añade el nuevo como candidato 77. Verificados 202 archivos actuales y assets de R40/R39/R38, además de 404 para ausentes y 401 para Teacher anónimo.
3. **Calificador contextual:** el texto publicado se canonicalizaba con trim y el verificador lo comparaba con la selección original terminada en saltos de línea. R14 exige la coincidencia con esa canonicalización, manteniendo estrictos el contenido interno y los hashes del ancla. La conciliación del mismo trabajo no vuelve a generar.
4. **Ajuste con selección sin guardar:** R41 bloquea botón y callback cuando la selección está pendiente o no está disponible. La UI comprobó `low` sin guardar → ajuste bloqueado; Cancelar → `medium` calificado y ajuste habilitado. La edición manual permanece disponible y el texto del ajuste se conserva.

La primera activación de R41 devolvió `current_entrypoint_http_mismatch` después de una única recarga de Nginx. Se conservaron intención y fallo; una verificación posterior pasó todos los archivos y componentes protegidos, **sin repetir la activación ni la recarga**. La causa exacta de esa observación inicial no se estableció.

R14 pasó compilación, lint y 79 pruebas en 12 archivos; R41, build/tipos de 889 archivos, lint y 195 pruebas en 34 suites. Son corridas con ámbitos solapados con entregas anteriores y no se suman como cobertura adicional. La revisión independiente posterior a la entrega no encontró inconsistencias en los 12 ítems, cuatro rúbricas, cobertura o evidencia del intento final. Las preguntas/soluciones privadas sólo se leyeron después de verificar las 12 respuestas congeladas.

## Respaldo final y restauración

Tras cerrar trabajos y ACK se detuvieron ordenadamente API, Worker, Native, keyrings y timers, manteniendo PostgreSQL/Redis. Se generaron claves DPAPI nuevas y dos streams AES-256-GCM; no se guardaron dumps ni archivos de configuración descifrados en el host.

| Captura | Cifrado | Restauración aislada |
| --- | --- | --- |
| Base | 1.217.294 bytes; SHA `c59bd97e374322685aca0931e2943996b096422c776c65024e02ca04f5a04f80` | 102 tablas, 37 secuencias, 48 migraciones; filas, columnas y semántica de constraints iguales |
| Configuración | 47.341.255 bytes; SHA `25857d6bb9167ab79de2f9373016865f7431f4765e23d2985be7af79fd4b0df4` | 8.856 entradas y 561.105.376 bytes de archivos; contenido, uid/gid, permisos, mtime, xattrs y symlinks iguales |

GCM se autenticó antes de restaurar, en recursos propios sin red, sin arrancar aplicaciones/proveedores ni ensayar migraciones. Los recursos aislados se retiraron tras comprobar los resultados. Once sockets Unix inactivos sin listeners se inventariaron como IPC no persistente: se excluyen del tar y se conservan sus originales. Los respaldos previos al upgrade permanecen intactos.

La recuperación es **compuesta, `self_contained:false`**: requiere también custodia DPAPI, roles/configuración del motor, paquetes R14/R41/R40, Node, dependencias compartidas, imágenes/runtime Native y los roots históricos de assets. El catálogo no afirma que estén exportadas todas esas dependencias. No es una restauración completa de una VM reconstruida ni prueba retención temporal o recuperación de R2.

Los servicios se reanudaron. La comparación conserva manifests, entorno, Nginx, archivos/autoridad de unidades, ledger e identidad/metadata de los 13 unknown históricos cerrados entre ambas observaciones. PID, start ticks y arranque del contenedor cambian por el mantenimiento autorizado. La UI autenticada recargada conserva `Completado` y 40/40.

Los recibos locales usan el reloj de Windows, observado aproximadamente 441 segundos detrás de la VM; se conservan sus bytes originales. El orden se acredita con la secuencia de operaciones, inventario y `finished_at` remoto, sin reescribir fechas/hashes o alterar el reloj de la VM.

## Alcance del cierre

Este recorrido complementa el [QA55/55 R02](teacher-upgrade-acceptance-20261111-r02.md) de Windows/API key exacta. No constituye 55 pruebas nuevas en Linux ni acredita otras selecciones o producción. La final `assisted:false` significa ausencia de ayuda registrada en ese intento: agentes QA introdujeron respuestas sintéticas; no demuestra autonomía, retención o eficacia humana.

Esta muestra VM generó cero bloques `prediction` y cero citas estructuradas. No se les atribuye aceptación real por este recorrido. Se conserva autoría manual y alcance de repaso/actividades/conceptos; no se anuncia FSRS, banco psicométrico, OCR, extracción automática o transferencia de notas. ADR098 sigue propuesto; las 11 fichas Teacher siguen draft/partial/unregistered/approval:null y los cuerpos aprobados no se publicaron ni cambiaron.

No quedan pendientes técnicos del recorrido autorizado de development. La revisión/versionado Git del lote local se mantiene separada: esta entrega no crea commit, push ni promoción a master.
