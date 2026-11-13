# Teacher upgrade — cierre de los55criterios, R02 del2026-11-11

Estado: **55/55 verificados para el alcance R02; sin defectos bloqueantes abiertos**. Cierre del upgrade en Windows, código candidato y selección API key exacta configurada. Complementa el corte histórico R01 y no extiende sus resultados a otras selecciones/entornos.

La matriz conserva los55criterios de [101](../mvp/101-nodia-teacher-adaptive-upgrade-plan.md) sin reducirlos. Cada resultado combina la comprobación aplicable de dominio/SQL, navegador HTTP/JWT real de laboratorio, inferencias reales y revisión de contenido. Un solo recibo puede respaldar varios criterios; no se infiere de nuevo para llenar filas. La revisión pedagógica es independiente por otro agente, no aprobación humana ni calibración psicométrica.

La selección observada fue conexión 4, API key, modelo configurado `gpt-6.1-sol`, esfuerzo `medium`, Windows y política `5c37c4194d11ed8b9f40f065b4289f772bfba080fef7147878223e6060edf524`. Son18POST de campaña, incluyendo un primer canary cerrado cuyo eco no pasó y su nueva comprobación tras corregir el protocolo. Los siete propósitos quedaron comprobados con17resultados de la política actual y cierre/ACK; el original fallido conserva su evidencia y no habilita el scope nuevo. No hubo unknown remoto en esta muestra; sus fallos/no-replay se verificaron en el runtime real con transporte controlado.

No se cambiaron proveedores/modelos ante fallos, claves, perfiles, datos de negocio, pins o servicios operativos; la configuración se consultó con conexión PostgreSQL READ ONLY y los efectos quedaron en DB desechable. Las aceptaciones no se copiaron a operación. La entrega no despliega ni aprueba ADR098/fichas. Audio/OCR/visión, código arbitrario, plugins descargables, FSRS, inferencia automática del grafo y eficacia humana a largo plazo siguen fuera del alcance habilitado; se prueban sus negativas/estados desconocidos donde aplica. No son55criterios reetiquetados como eficacia universal.

## Evidencias compartidas

| ID | Evidencia | Alcance observado |
|---|---|---|
| CORE | [teacher-upgrade-core-qa-20261111-r02.json](teacher-upgrade-core-qa-20261111-r02.json) | 6regresiones SQL,128filas129→1query y aislamiento de contexto/versión |
| ENRICH | [teacher-upgrade-enrichment-qa-20261111-r02.json](teacher-upgrade-enrichment-qa-20261111-r02.json) | 11macroescenarios SQL,26pruebas focales, PDF/tiempo/relaciones y2hilos |
| REAL | [teacher-upgrade-real-20261111-r02.json](teacher-upgrade-real-20261111-r02.json) | 18HTTP reales, selección/manifest/prueba por propósito, cierre/ACK; restore102tablas37secuencias827restricciones |
| PED | [teacher-upgrade-pedagogical-review-20261111-r02.md](teacher-upgrade-pedagogical-review-20261111-r02.md) | 7materiales,47ítems y47SELECT/CTE;4bancos revisados con cobertura limitada explícita |
| UI | [teacher-upgrade-ui-qa-20261111-r02.json](teacher-upgrade-ui-qa-20261111-r02.json) | 12escenarios integrados, JWT/HTTP/SQL reales de fixture, ES/EN y320/1280 |
| PERF | [teacher-upgrade-ui-qa-20261111-r02.json](teacher-upgrade-ui-qa-20261111-r02.json) | 12mediciones finales alternadas contraHEAD, variante regresiva descartada y costes conocidos |
| DOM | [teacher-upgrade-local-20261111-r02.json](teacher-upgrade-local-20261111-r02.json) | 14garantías de dominio, final90 exacto y pending/claves/versiones |
| RUN | [teacher-upgrade-local-20261111-r02.json](teacher-upgrade-local-20261111-r02.json) | 29garantías de slots/presupuesto/unknown/cierre/recuperación |
| PURPOSE | [teacher-upgrade-local-20261111-r02.json](teacher-upgrade-local-20261111-r02.json) | 13garantías del protocolo por propósito y4tests CLI/args |
| HTTP | [teacher-upgrade-local-20261111-r02.json](teacher-upgrade-local-20261111-r02.json) | 9garantías HTTP/DTO/UTF8/ownership/idempotencia |
| BUILD | [teacher-upgrade-local-20261111-r02.json](teacher-upgrade-local-20261111-r02.json) | 140pruebas Server y186Client; builds y assets correctos |

## Matriz completa

| TU de101 | Resultado R02 | Evidencia | Comprobación y límite aplicable |
|---|---|---|---|
| TU-E0-01 | Verificado por alcance | BUILD REAL UI | Baseline HEAD, candidata por hashes y entorno Windows/API exactos; límites y modalidades excluidas explícitos. |
| TU-E0-02 | Verificado por alcance | CORE DOM RUN UI | Históricos, CAS, pausa/cursor, final directa,90 exacto frente89,6, claves privadas y pendiente sin cero preservados. |
| TU-E0-03 | Verificado por alcance | CORE UI | Mismo intento en dos pestañas y recarga conserva IDs/orden; orden semántico se preserva antes de barajar. |
| TU-E0-04 | Verificado por alcance | RUN PURPOSE REAL UI | Recibos/llegada tardía/unknown sin replay;7propósitos observados con selección/política actual y calificación separada del helper. |
| TU-E1-01 | Verificado por alcance | CORE ENRICH UI | Ownership, revisión/objetivo y mapeo explícito; referencias ajenas o incompatibles rechazadas y orígenes inspeccionables. |
| TU-E1-02 | Verificado por alcance | CORE UI | Reflexión opcional, null frente0, inválidos rechazados; borrador/conflicto retenidos y reflexión congelada al enviar. |
| TU-E1-03 | Verificado por alcance | CORE PED UI | Respuesta correcta con explicación incoherente mantiene2/2; la declaración separada no crea dominio ni modifica nota. |
| TU-E1-04 | Verificado por alcance | CORE ENRICH REAL | Error, ayuda, repetición asistida y tarea realmente nueva conservan eventos/fechas separados; recibos no duplican evidencia. |
| TU-E1-05 | Verificado por alcance | CORE REAL PED | Snapshot admitido conserva IDs/hash/política/ISO frente a respuesta tardía; reparación posterior tiene snapshot propio. |
| TU-E1-06 | Verificado por alcance | CORE ENRICH PED | Ausencia/pending/revisión no pertinente son explícitos; declaraciones/relaciones propuestas no se convierten en hechos o dominio. |
| TU-E1-07 | Verificado por alcance | CORE ENRICH PERF | Filtrado pertinente antes del límite;128filas129→1SQL equivalente, página20 y22consultas constantes con5/500conceptos. |
| TU-E2-01 | Verificado por alcance | CORE UI PED | Blueprint/dimensiones descriptivas previas al plan; diagnóstico guardado, pausa/retoma y declaraciones preservados. |
| TU-E2-02 | Verificado por alcance | CORE REAL PED UI | Cuatro bancos de prueba revisados independientemente con IDs/hashes/claves/cobertura parcial; banco ausente visible y no genera evaluación ficticia. |
| TU-E2-03 | Verificado por alcance | CORE UI | Diagnóstico opcional/finito sin dispatch; omitirlo o dejarlo en curso permite plan manual, conserva observaciones y pausa sin inventar nivel. |
| TU-E2-04 | Verificado por alcance | CORE PED | Mapeos a candidata/plan explícitos, versionados y revisados; mismo ID/título en otra revisión no transfiere evidencia. |
| TU-E2-05 | Verificado por alcance | REAL PED | Mismo objetivo y política en dos temas con error, acierto asistido y ausencia: apoyos reales distintos y explicables; incertidumbre preservada. |
| TU-E2-06 | Verificado por alcance | CORE DOM REAL | Ajuste real queda candidato, conserva IDs/política y no sustituye el plan aceptado; fences/versiones rechazan resultado obsoleto. |
| TU-E2-07 | Verificado por alcance | RUN CORE REAL UI | JSON inválido, presupuesto, fallo/unknown y recuperación no borran plan/respuestas ni reenvían; diagnóstico no verifica sección. |
| TU-E3-01 | Verificado por alcance | CORE PED REAL | Actividad incluye objetivo/motivo/evidencias/política; sin evidencia ofrece recuperación base sin afirmar personalización. |
| TU-E3-02 | Verificado por alcance | CORE PED | Error→ayuda→acierto asistido mantiene necesidad de otra comprobación; repetición conocida se marca asistida y no reescribe origen. |
| TU-E3-03 | Verificado por alcance | PED REAL | 47ítems revisados: recuperación/discriminación/composición y aplicaciones cercanas con cambio estructural, incluidos anti-match y COUNT. |
| TU-E3-04 | Verificado por alcance | CORE REAL PED | Pista/ayuda y solución vista quedan separadas del primer resultado; ayuda real marca práctica asistida sin conceder verificación. |
| TU-E3-05 | Verificado por alcance | CORE DOM UI | Navegar sin responder, pausar y archivar conserva respuesta vacía y nota/porcentaje null; borradores y cursor se conservan. |
| TU-E3-06 | Verificado por alcance | CORE DOM REAL | Final mantiene claves hasta entrega completa, política/denominador90 exacto y notas por intento; ayuda/repaso no rebajan requisitos. |
| TU-E3-07 | Verificado por alcance | CORE ENRICH RUN UI | Leer/revelar/corregir determinísticamente no infiere; generación nueva es intención presupuestada y resultado incierto no se repite. |
| TU-E3-08 | Verificado por alcance | CORE UI | Dos pestañas/autosave tardío producen409 sin perder radio/texto; recibo recuperado aplica un solo efecto y publicación vieja no migra el intento. |
| TU-E4-01 | Verificado por alcance | CORE REAL PED UI | Material real contiene lectura/predicción/check voluntarios, identificación estable y navegación sin responder ni nota por lectura. |
| TU-E4-02 | Verificado por alcance | CORE UI | Interacciones current-version/kind/ISO/CAS, historial del paquete y borradores por sesión/versión/bloque; no migración silenciosa. |
| TU-E4-03 | Verificado por alcance | REAL PED CORE | Dos interacciones erróneas guardadas alimentan reparación real específica; plan aceptado y versiones originales permanecen. |
| TU-E4-04 | Verificado por alcance | CORE PERF UI | Paquete guardado sin inferencia por bloque; una consulta acotada embebida evita waterfall/CLS. Comparación baseline/rechazada/final y costes registrados. |
| TU-E5-01 | Verificado por alcance | ENRICH UI | Nuevo/aprendizaje/repaso, fecha real, zona IANA y política guardada; política desconocida legible sin rating. |
| TU-E5-02 | Verificado por alcance | ENRICH UI | Rating/recibo/CAS una sola vez; pérdida HTTP con commit recupera GET de recibo sin repetir POST o efecto. |
| TU-E5-03 | Verificado por alcance | ENRICH UI | Casos DST/límite del día y zona de tarjeta versionada; render usa la IANA guardada, no cambia calendario por zona del navegador/servidor. |
| TU-E5-04 | Verificado por alcance | ENRICH UI | Revelado antes de vencer permite consultar sin rating/calendario; política inmutable y versiones futuras no ejecutan reglas actuales por fallback. |
| TU-E5-05 | Verificado por alcance | ENRICH UI | Olvido crea refuerzo trazable al rating y mantiene verificación histórica; estados se muestran separados sin retención inventada. |
| TU-E5-06 | Verificado por alcance | ENRICH PED UI | Tarjetas manuales con intención, calidad de fixture revisada y lectura determinista; no inferencia periódica/cuotas/notificaciones implícitas. |
| TU-E6-01 | Verificado por alcance | ENRICH REAL UI | Consulta real anclada a bloque/versión/selección; historial no se inserta en otro paso y ancla inválida se rechaza. |
| TU-E6-02 | Verificado por alcance | UI CORE | Panel/hilo conserva borrador, caret y foco ante ocultación/refetch; respuesta tardía se lee sólo en su hilo original. |
| TU-E6-03 | Verificado por alcance | PURPOSE ENRICH REAL UI | Server rechaza nuevo helper durante final antes de POST; índice/pregunta/contexto no revelan claves o feedback privados. |
| TU-E6-04 | Verificado por alcance | ENRICH REAL PED | Ayuda real publicada marca práctica pertinente asistida;14/14 de fixture conocido no crea verificación ni dominio. |
| TU-E6-05 | Verificado por alcance | ENRICH PURPOSE RUN REAL UI | Prueba por propósito/epoch exactos;2hilos con CAS, recibos perdidos y publicación inversa mantienen destino y no infieren otra vez al conciliar. |
| TU-E7A-01 | Verificado por alcance | ENRICH HTTP UI | Fuentes/fragmentos exigen owner/versión; formato no admite paths del host o identidad ajena; inspección pausada/archivada sigue autorizada. |
| TU-E7A-02 | Verificado por alcance | ENRICH REAL PED UI | Cita valida fuente/hash/página/quote dentro de extracto admitido y BD; snapshot nuevo preserva cita/origen anterior sin sobrescribirlo. |
| TU-E7A-03 | Verificado por alcance | ENRICH UI | PDF real corrupto/sin texto/parcial/13páginas/exceso de texto y recuperación tras fallo; avisos explícitos, límites/worker y sin OCR supuesto. |
| TU-E7A-04 | Verificado por alcance | ENRICH REAL PED RUN | Instrucción incrustada SYSTEM OVERRIDE no ganó autoridad ni pidió keys; fuentes son datos sin herramientas y extracción/idempotencia no se duplican. |
| TU-E7B-01 | Verificado por alcance | ENRICH UI | Tipo/esquema histórico desconocido permanece identificable y no disponible por ocurrencia; no ejecuta ni derriba el panel. |
| TU-E7B-02 | Verificado por alcance | ENRICH PED | Cuatro tipos validan respuesta/solución/objetivo, CAS y ayuda; resultado authored siempre asistido y sin verificación o desagregación inventada. |
| TU-E7B-03 | Verificado por alcance | UI ENRICH | Los4tipos se recorrieron por teclado/árbol accesible en320/1280; borradores exactos y remount no envía respuestas; fallback seguro por ocurrencia. |
| TU-E7C-01 | Verificado por alcance | ENRICH UI | Barras/timeline declarativas; parámetros/tipo/esquema desconocidos no ejecutan HTML/JS/red y tienen alternativa/error recuperable. |
| TU-E7C-02 | Verificado por alcance | UI PERF ENRICH | Visual persistido por intención, alternativa accesible y procedencia; mediciones de assets/heap/latencia/CLS con coste explícito. |
| TU-E8-01 | Verificado por alcance | ENRICH UI | Identidades/condiciones distintas aun con igual nombre; equivalencia propuesta/revisada/revertida conserva historial y no fusiona. |
| TU-E8-02 | Verificado por alcance | ENRICH CORE | Referencia escrita con fecha/modalidad/revisión actual y mapeo revisado; reversión o revisión futura excluye evidencia, sin copiar notas/verificaciones o cruzar owner. |
| TU-E8-03 | Verificado por alcance | ENRICH UI | Estados separados de visita, comprobación escrita, independencia, retención desconocida y final; sin porcentaje global ficticio. |
| TU-E8-04 | Verificado por alcance | ENRICH UI | Inspección focal hasta respuesta/fuente exacta, relación proposed/contradiction y conjunto ALL-of con procedencia y condiciones intactas. |
| TU-E8-05 | Verificado por alcance | ENRICH UI PERF | Foco/búsqueda/teclado/móvil y GET focal, página20/cap500; consulta constante y coste medido sin cargar todo el grafo. |

## Cierre y límites operativos

El backup/restore comparó todas las tablas, secuencias y restricciones del laboratorio final, con pruebas/recibos reales y final pendiente preservados, sin workers ni POST al restaurar.27CHECK cambiaron su representación SQL; se reparsaron por PostgreSQL con los tipos de ambas bases para verificar el mismo predicado, sin borrar tokens ni alterar datos.

La final de prueba permanece sin entrega deliberadamente: su estado pending y sus claves ocultas forman parte del escenario. La práctica real asistida quedó14/14 sin verificación. Las pruebas deterministas cubren90 exacto/89,6 y límites del grader; el único feedback remoto de esta muestra es un positivo conocido y no demuestra exactitud general del modelo.

El lector corregido eliminó la consulta secundaria y los desplazamientos observados. CLS mediano final0,01315/0,00581(móvil/escritorio); LCP4,236/0,840s frente4,196/0,812s de baseline bajo throttling. El coste observado es+17453bytes gzip y un aumento de heap, no una mejora global de velocidad. El objetivo móvil de campo no queda acreditado por este laboratorio; la regresión de layout sí quedó corregida y revalidada.

No hay defecto abierto del alcance R02 ni TU pendiente dentro de esa selección/perfil. La puesta en operación requiere su propio despliegue, sesión/selección y calificación en el entorno que se adopte; los bloqueos históricos de96§32 y de otros proveedores se conservan. El paquete local de recuperación está catalogado en ops/lab/artifacts/teacher-upgrade-qa-r02/catalog.json; no contiene credenciales operativas y no autoriza trasplantar aceptaciones.
