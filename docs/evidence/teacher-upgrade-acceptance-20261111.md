# Teacher upgrade — matriz de aceptación local del 2026-11-11

Estado: **QA parcial, sin aceptación integral**. Cubre los55TU de [101 R03](../mvp/101-nodia-teacher-adaptive-upgrade-plan.md) y los bloques Q de [102 R02](../mvp/102-nodia-teacher-phased-implementation-and-final-qa.md). Esta matriz registra evidencia de construcción F0–F9 y comprobaciones locales; no redefine los criterios ni los convierte en aprobados por contar tests.

Revisión observada: checkout local integrado del 2026-11-11, sin release desplegado o commit limpio acreditado por este documento. El [recibo consolidado JSON](teacher-upgrade-local-20261111-r01.json) conserva comandos/resultados finales. Un resultado posterior sólo sustituye su propio alcance; no invalida ni reinterpreta evidencias históricas de96. ADR098 sigue propuesto; fichas draft/partial/unregistered/approval:null, sin publicación.

## Evidencia y límites

| ID | Comprobación observada | Resultado y alcance |
|---|---|---|
| UT-S | Suites Teacher y ai-generation de Server |133tests/25suites pasados; políticas, parsers, contratos y generación sintética |
| UT-C | Suites Teacher de Client |174tests/29suites pasados; lógica/componentes/hooks de la muestra, no QA completo de navegador |
| SQL-C | [teacher-upgrade.integration.mjs](../../nodia-server/test/teacher-upgrade.integration.mjs) |8checks pasados en PostgreSQL descartable; diagnóstico, metadatos, mapeos, evidencia, snapshot y CAS |
| SQL-E | [teacher-enrichment.integration.mjs](../../nodia-server/test/teacher-enrichment.integration.mjs) |10checks pasados incluyendo restore aislado; repaso, privacidad, recibos, fuentes, actividades, hilos y equivalencias. Revalidación P2 pasada:6regresiones atómicas nuevas y10checks SQL afectados |
| DOM | [teacher-domain.integration.mjs](../../nodia-server/test/teacher-domain.integration.mjs) |14garantías históricas pasadas con esquema integrado y transporte sintético; no sustituye evidencia educativa/proveedor |
| RUN | [teacher-runtime.integration.mjs](../../nodia-server/test/teacher-runtime.integration.mjs) |29checks pasados y3POSTs locales sintéticos; presupuesto, slot, cierre y no replay. Ninguna inferencia remota |
| HTTP | [teacher-upgrade-http.integration.mjs](../../nodia-server/test/teacher-upgrade-http.integration.mjs) |9checks pasados de nuevas rutas/DTOs/ownership/idempotencia con SQL aislado |
| BUILD | Builds Server y Client |Ambos pasados en checkout local; no acredita instalación productiva o calidad pedagógica |
| KN | knowledge:check |87fuentes/43excluidas,44documentos/46fragmentos aprobados conservados byte-idénticos; manifiesto local1a1489… y bindings conservados. Builds emiten assets locales; sin publicación o cambio de pins operativos |
| PURPOSE | [teacher-purpose-qualification.integration.mjs](../../nodia-server/test/teacher-purpose-qualification.integration.mjs) |13garantías pasadas con3POST HTTP sintéticos: scope antiguo rechazado, setup no habilita helper, ancla/final/owner, recuperación sin POST, política histórica sin promoción y restore con prueba poblada; parser CLI1test/3escenarios negativos |
| RESTORE | Dump/restore en SQL-E y PURPOSE |pg_dump custom y pg_restore exit-on-error a nueva base del mismo contenedor descartable; SHA256 del JSON ordenado de todas las tablas public idéntico. Incluye plan/material/final, fuentes/hilos/eventos/recibos, operación unknown sintética y prueba por propósito poblada en PURPOSE; sin workers ni POST al restaurar |
| UI | Navegador móvil/escritorio320/1280px |Pasada por alcance sintético:320px ES/oscuro y1280px EN/claro, borradores, vacío, confianza0, revelado/rating, éxito/error400 y toast. No recorrido integral real ni auditoría WCAG completa |
| PED | Muestra pedagógica |Pendiente: dos temas, lingüístico escrito y no lingüístico, banco/explicaciones/feedback/transferencia revisados. No hay eficacia educativa medida |
| REAL | Calificación por proveedor/selección/propósito/entorno91/92 |Pendiente para contratos/prompts modificados y contextual_reply; las calificaciones históricas no se heredan automáticamente |
| PERF | Comparación por ruta/perfil/volumen |Pendiente: no se midió baseline equivalente de rendimiento, utilidad o coste |

Los ensayos no tocaron base operativa, claves o perfiles nativos. RESTORE no acredita backup operativo, retención de días, continuidad productiva o borrado físico. Los archivos de trabajo/logs permanecen ignorados; esta matriz y el JSON son los registros duraderos.

## Cómo leer los resultados

`Parcial` significa que hay contrato/código integrado y evidencia técnica acotada, pero falta al menos una comprobación del TU completo. `Pendiente` indica que la comprobación central aún no se realizó. `Fallido` identifica un defecto concreto observado pendiente de revalidación; no se cierra sólo por escribir el fix. Ninguna fila declara aceptación integral o eficacia. Las columnas de pendientes conservan requisitos que exceden el alcance local construido.

Las referencias de evidencia son compartidas: no se vuelve a consumir una inferencia para llenar otra fila. UT-S/UT-C no demuestran por sí solos todos los escenarios narrados en un TU; las comprobaciones restantes están explícitas.

## Matriz de55TU

| TU de101 | Q | Resultado | Evidencia técnica / escenario local | Pendiente para el criterio completo |
|---|---|---|---|---|
| TU-E0-01 | Q1 | Parcial | BUILD, matriz y recibo identifican checkout local y gates | REAL y entorno destino; manifiesto de candidata operativa; no cerrar V1 por este lote |
| TU-E0-02 | Q1 | Parcial | DOM, SQL-C: compatibilidad, claves privadas, final y CAS; RUN recuperación | Continuidad integrada de usuario/UI y selecciones reales; conservar pendientes históricos de96§32 |
| TU-E0-03 | Q1 | Parcial | UT-S: orden estable por intento y protección de referencias posicionales/orden significativo; lector consume IDs estables | Recarga y dos pestañas en UI integrada sobre muestra revisada |
| TU-E0-04 | Q9 | Parcial | RUN, HTTP: conciliación/unknown sin replay y recibos sintéticos | REAL para cada propósito/selección modificados; no atribuir disponibilidad a3POSTs locales |
| TU-E1-01 | Q2 | Parcial | SQL-C, HTTP: ownership, referencias de objetivo/plan y snapshot; SQL-E mapeos propios | Ampliar muestra de referencias incompatibles entre revisiones y continuidad UI |
| TU-E1-02 | Q2 | Parcial | UT-S, SQL-C, HTTP: null/cero, validación y revisión de metadatos; UT-C controles | Recorrido integrado de borrador ante errores, envío y concurrencia; PED |
| TU-E1-03 | Q2 | Parcial | Declaración separada y congelada sin modificar nota; UT-S/SQL-C | No hay hipótesis estructurada automática; revisar explicación incoherente con respuesta correcta en PED |
| TU-E1-04 | Q2 | Parcial | SQL-C/SQL-E: recibos y evidencia append; asistencia registrada; DOM independencia | Muestra completa primer intento→ayuda→comprobación posterior apta y procedencia temporal |
| TU-E1-05 | Q2 | Parcial | SQL-C: evidencia acotada/hash en admisión; snapshots de jobs inmutables | Normalización ISO revalidada con regresión; falta dato tardío integrado y REAL |
| TU-E1-06 | Q2 | Parcial | UT-S: evidencia ausente/revisión no pertinente no inventa dominio; pending conserva estado | Hipótesis contradictorias no tienen modelo automático; PED y pertinencia temporal avanzada |
| TU-E1-07 | Q2 | Parcial | Consultas acotadas y paginación/contexto con cotas; SQL-C/SQL-E/HTTP | PERF por volumen/ruta y verificación medida de ausencia de regresión/N+1 |
| TU-E2-01 | Q2 | Parcial | SQL-C/HTTP: blueprint descriptivo antes de plan y diagnóstico persistido | Pausa/retoma y calidad de dimensiones en PED y UI |
| TU-E2-02 | Q2 | Parcial | SQL-C/HTTP: banco manual con declaración reviewed por actor; sin banco no admite diagnóstico inventado | Revisión pedagógica independiente y vigencia por tema; no presentar declaración como banco calibrado |
| TU-E2-03 | Q2 | Parcial | Diagnóstico opcional/finito sin dispatch IA; baseline declarada sigue disponible | PED/UI de omitir/pausar/salir y parada; no hay probing adaptativo calibrado |
| TU-E2-04 | Q2 | Parcial | SQL-C: dimensiones y mapeos explícitos/versionados a candidata o plan, sin fusionar por título | Revisar cambios de candidata en PED; hipótesis estructuradas automáticas pendientes |
| TU-E2-05 | Q2 | Pendiente | Contrato admite evidencia/target_focus/response_details; SQL-C verifica snapshot | Comparación pedagógica de mismo objetivo con evidencia distinta en dos temas y salida real calificada |
| TU-E2-06 | Q2 | Parcial | DOM, RUN: revisiones/fences/candidata/aceptación preservadas; mapeos no cambian plan | Recorrido integrado de cambio de objetivo/base declarada y resultado tardío en selección real |
| TU-E2-07 | Q2 | Parcial | RUN/DOM: JSON inválido/unknown/presupuesto preservan estado; diagnóstico no verifica sección | Fallos reales por selección y recuperación de usuario integrada; REAL |
| TU-E3-01 | Q3 | Parcial | UT-S/SQL-C: recomendación con objetivo/motivo/política/evidencia y alternativa base | PED/UI: explicación útil y elección explícita sin personalización fingida |
| TU-E3-02 | Q3 | Parcial | UT-S: error/ayuda mantienen refuerzo; historial append y foco de respuesta en snapshot | PED de error repetido y apoyo pertinente; prueba de nueva comprobación apta |
| TU-E3-03 | Q3 | Pendiente | Modos declarados y prompt exige discriminación/composición/cambio de situación | PED revisada de recuperación/discriminación/composición/transferencia; no basta cambiar etiquetas o barajar |
| TU-E3-04 | Q3 | Parcial | Asistencia por intento/helper y evidencia original congelada; DOM independencia | No hay escalera completa de pistas/ejemplo/solución con hipótesis; revisar temporalidad de cada ayuda en PED |
| TU-E3-05 | Q3 | Parcial | DOM, UT-C: navegación/pausa/borradores base; lectura/interacción no genera nota | Recorrido integrado de saltar/solicitar ejemplo/terminar con red fallida y cursor |
| TU-E3-06 | Q3 | Parcial | DOM/SQL-E: final90 exacto, pending no cero, claves privadas y repaso sin verificación | Continuidad integral de usuario sobre final existente y selección real; no se alteró política para obtener aprobación |
| TU-E3-07 | Q3 | Parcial | SQL-C/SQL-E/RUN: rutas deterministas sin inferencia; generación explícita con presupuesto/no replay | Comprobar recorrido UI completo sin POST ocultos; REAL para generación nueva |
| TU-E3-08 | Q3 | Parcial | SQL-C/SQL-E/HTTP: recibos recuperados/CAS y un único escritor; RUN resultado tardío | Dos pestañas y autosave tardío en navegador integrado |
| TU-E4-01 | Q3 | Parcial | Parser/DTO admite prediction/check; SQL-C respuestas voluntarias sin nota; UT-C lector | PED de lección mixta y UI continua; responder no es prerrequisito de lectura |
| TU-E4-02 | Q3 | Parcial | Bloque/versión en interacción y cursores previos; SQL-C/DOM | Recarga/pausa/dos pestañas de contenido nuevo y continuidad de borrador en UI |
| TU-E4-03 | Q3 | Parcial | Snapshot incorpora interacciones separadas y texto/error; no reescribe plan | PED de reparación apoyada en error y de predicción frente a aplicación posterior |
| TU-E4-04 | Q3 | Parcial | Paquete persistido y rutas de lectura sin inferencia, SQL-C/DOM | PERF de latencia/peticiones/fricción frente al lector anterior |
| TU-E5-01 | Q4 | Parcial | UT-S/SQL-E: estados/fechas de teacher-intervals/1, tarjetas manuales | UI integrada de nuevo/aprendizaje/repaso; no FSRS ni predicción de dominio |
| TU-E5-02 | Q4 | Parcial | SQL-E/HTTP: rating/recibo/CAS aplicado una vez y sin verificación | Recarga/HTTP perdido en UI integrada y revisión temporal de la muestra |
| TU-E5-03 | Q4 | Parcial | Política pura zona IANA/mediodía local y rating urgente UTC con casos temporales | Completar revisión de cambios de zona/DST/límite de día por los perfiles incluidos |
| TU-E5-04 | Q4 | Parcial | Política versionada y revisión por tarjeta; SQL-E no duplica eventos | Revelar fuera de vencimiento permite consultar sin rating o cambiar calendario; no se ofrece editar política/pistas retroactivamente. Completar QA integrado de esos efectos y cambios de política futuros |
| TU-E5-05 | Q4 | Parcial | SQL-E: rating no crea ni revoca verificación; no muestra retención estimada | PED/UI de olvido→refuerzo con verificación histórica conservada |
| TU-E5-06 | Q4 | Parcial | Tarjetas manuales/revisión determinista; ninguna generación periódica/notificación | PED de calidad de tarjetas y UI sin inferencia por lectura; generación automática no implementada |
| TU-E6-01 | Q5 | Parcial | SQL-E: hilo atado a bloque/versión/selección y fence de publicación | UI de reabrir/cambiar paso/ancla inválida y respuesta tardía |
| TU-E6-02 | Q5 | Parcial | UT-C: estado de hilo/borrador; Server publica por thread_id/ancla | Navegador integrado: cierre/remontaje, foco, pérdida de conexión y cambio de hilo |
| TU-E6-03 | Q5 | Parcial | SQL-E: rechazo Server con final activa; contexto público sin claves | UI manipulada y recorrido final completo; REAL del nuevo helper pendiente |
| TU-E6-04 | Q5 | Parcial | SQL-E: ayuda marca práctica pertinente asistida, no verificación | PED temporal de ayuda vista y nueva respuesta; no inferir ausencia de ayuda externa |
| TU-E6-05 | Q5 | Parcial | PURPOSE, RUN, SQL-E: propósito en runtime común, ancla/recibos; sin replay sintético | REAL de contextual_reply y dos consultas concurrentes con stream/guardado perdido |
| TU-E7A-01 | Q6 | Parcial | SQL-E/HTTP: fuentes privadas owner-scoped, páginas/hash; entrada PDF/texto sin path de host | Revisión completa de identidad/versión en UI; descarga de binario original no implementada |
| TU-E7A-02 | Q6 | Parcial | UT-S/SQL-E: fence de fuente/hash/página/quote contra extracto admitido y BD; exclusiones revalidadas | Revisar citas/contradicciones y fuentes históricas en material real de PED/REAL |
| TU-E7A-03 | Q6 | Parcial | Parser acotado, worker con recursos/timeout y PDF textual; casos de formato/límites en UT-S | Ampliar muestra PDF corrupto/sin texto/parcial y feedback UI; no hay OCR ni reconstrucción de huecos |
| TU-E7A-04 | Q6 | Parcial | Fuentes como datos sin herramientas; extracción local limitada y deduplicación, SQL-E/RUN | REAL/PED de documento con instrucciones incrustadas y recuperación UI sin duplicar trabajo |
| TU-E7B-01 | Q7 | Parcial | Allowlist/versiones de tipos internos y validación sin ejecutar históricos; UT-S/UT-C | UI de tipo/versión desconocidos; no hay plugins descargables |
| TU-E7B-02 | Q7 | Parcial | SQL-E: contratos/corrección manual y resultados assisted=true, grants_verification=false | PED de objetivos/rúbricas; no desagregar evidencia multiobjetivo ni presentar autoría propia como independencia |
| TU-E7B-03 | Q7 | Parcial | Componentes declarativos, UT-C y CAS Server por ocurrencia | Navegador/teclado/lector de pantalla/móvil y borrador ante remount/error |
| TU-E7C-01 | Q7 | Parcial | Allowlist barras/timeline sin código/red libre y validadores acotados; UT-S | Renderer inválido/desconocido y fallback recuperable en UI integrada |
| TU-E7C-02 | Q7 | Parcial | Visual persistido, alternativa textual y panel cargado por intención; UT-C/BUILD | PERF memoria/bundle/fluidez por perfil; procedencia/UI accesible integrada |
| TU-E8-01 | Q8 | Parcial | SQL-E: conceptos con condiciones e IDs propios; equivalencia propuesta/aceptada/revertida | PED de igual nombre/distinta condición y revisión de equivalencia útil |
| TU-E8-02 | Q8 | Parcial | SQL-E: sólo owner y revisiones actuales; referencias sin transferir nota/verificación | ISO de observed_at revalidado; falta pertinencia temporal/modalidad revisada en PED, sin caducidad universal inventada |
| TU-E8-03 | Q8 | Parcial | Mapa focal manual sin porcentaje global; evidencia enlazada no concede verificación | Distinguir todos los estados del TU con datos reales pertinentes; retención/independencia no se inventan |
| TU-E8-04 | Q8 | Parcial | Conceptos/equivalencias conservan origen e historial; SQL-E | No hay modelo automático completo de contradicciones/cadenas conjuntas; inspección integrada hasta respuestas/fuentes |
| TU-E8-05 | Q8 | Parcial | Búsqueda/paginación20/cotas500 por tipo; panel por intención, HTTP/UT-C | Navegador foco/teclado/móvil y PERF de utilidad/coste; no lienzo global/extracción automática |

## Lote de defectos y continuidad

| ID | Hallazgo | Estado al registrar este corte | TU impactados |
|---|---|---|---|
| C1-CAS | Raw UPDATE RETURNING de TypeORM daba recibo sin revision | Corregido con CTE SELECT y revalidado en SQL-C/HTTP | E0-02, E1-04, E3-08 |
| C2-CITATION | Cita válida en BD podía quedar fuera de fuentes/extractos admitidos | Corregido y revalidado: snapshot admitido + BD; regresiones atómicas y SQL-E10 pasadas | E1-05, E7A-02 |
| C2-DATE | Date de evidencia equivalente se canonicalizaba como {} antes de JSONB | Corregido a ISO antes del prompt/hash; regresión atómica y SQL-E10 pasadas | E1-05, E8-02 |
| C3-LIST/HEADINGS | El listado Client no admitía contextual_reply y los títulos saltaban h2→h6 | Enum corregido con regresión; h3/h4 semánticos y QA de paneles;174tests/29suites y build Client pasados | E0-02, E6-02, Q10 |
| C4-QUALIFICATION | Una prueba del transporte anterior podía heredarse al prompt nuevo o al helper | Scope API/Agentic ligado al manifiesto actual y prueba separada por propósito; PURPOSE13, CLI1 y RUN29 pasados; sin aceptación real nueva | E0-04, E6-05 |

C2 revalidado y QA de paneles320/1280 pasado por alcance sintético. C3 corrigió el enum contextual_reply del listado Client y la jerarquía h3/h4;174tests/29suites y build Client pasados. Siguiente: calificación por política/propósito actual y comprobaciones externas, sin extrapolar estas variantes. RESTORE ya está comprobado sólo en laboratorio aislado. Después completar PED, REAL y PERF de los alcances que se habiliten, preservando los pendientes históricos relevantes de96. No se requieren nuevas aprobaciones rutinarias por función; no ejecutar inferencias inciertas como reintento.

## Alcance funcional efectivo frente al diseño completo

La construcción local cubre todas las ramas F0–F9 con contratos y UI conectados, pero no equivale a realizar íntegramente cada TU. El diagnóstico y las actividades son de autoría humana: reviewed es declaración del actor, no auditoría independiente ni banco psicométrico. Sus respuestas conocidas se etiquetan asistidas. La adaptación combina política determinista con prompts y necesita revisión del material generado; no hay hipótesis pedagógicas estructuradas automáticas ni prueba de transferencia por haber cambiado un campo.

El repaso usa teacher-intervals/1, no FSRS, y no predice retención. Las fuentes son snapshots privados textuales/PDF limitado, sin OCR ni conservación garantizada del PDF binario. Los visuales son barras/timeline declarativas, no ejecución arbitraria o simulación general. Los conceptos y equivalencias son manuales/reversibles; reutilizar referencias de evidencia nunca transfiere notas o verificaciones y no acredita dominio entre planes. La normalización ISO y la pertenencia de las citas al snapshot están corregidas y revalidadas en pruebas locales.

Los55TU permanecen presentes una vez cada uno en la tabla. La ausencia de evidencia de proveedor real, muestra pedagógica y baseline de rendimiento impide declarar upgrade completamente aceptado o eficaz. La comprobación técnica local es útil y se conserva; sus límites no se ocultan con una etiqueta de aprobación global.
