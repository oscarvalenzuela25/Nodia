---
{
  "schema_version": 1,
  "document_id": "studies.lessons-practice-and-review",
  "product_id": "studies",
  "kind": "feature",
  "revision": 24,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "QA55/55 R02 conservado para Windows/API key exacta. Continuación VM OpenAI Agentic sobre ServerR14/ClientR41 comprobada: diagnóstico/evidencia, plan/material, ayuda, práctica12/14 y final40/40; respaldo/restauración y reanudación operativa/UI pasados. Las respuestas son del agente de QA, no eficacia humana ni55nuevas pruebas VM. Revisión/versionado Git editorial pendiente; sin master, aprobación o publicación."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Estudios y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/95-studies-adaptive-learning.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/96-nodia-teacher-implementation-plan.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/97-nodia-teacher-technical-contracts.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/89-module-access-and-user-data-scope.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/teacher/use-case/teacher-attempt-persistence.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/components/QuestionCard/QuestionCard.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/ai-generation/teacher-generation-runtime.service.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/architecture/decisions/ADR-094-teacher-gemini-bounded-sdk-host.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/teacher/policies/teacher-validation.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/teacher/policies/teacher-publication-diagnostic.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/teacher/dto/teacher-reinforcement.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/teacher/policies/teacher-reinforcement.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/teacher/use-case/read-teacher.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/infrastructure/useReinforcementNavigation.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/components/ReinforcementPanel/ReinforcementPanel.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/teacher/policies/teacher-prompts.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/components/NewMaterialVersion/NewMaterialVersion.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/components/StudyJourney/StudyJourney.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/components/StudyJourney/styles.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/infrastructure/sessionList.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/infrastructure/useServices.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/pages/Teacher/Teacher.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/components/JobPanel/JobPanel.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/teacher/use-case/teacher-session-jobs.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/components/LessonMarkdown/LessonMarkdown.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/components/LessonMarkdown/styles.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/mvp/101-nodia-teacher-adaptive-upgrade-plan.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-098-teacher-learning-evidence-and-adaptive-progression.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/teacher/policies/teacher-learning.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/teacher/use-case/teacher-learning-persistence.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/components/AdaptiveWorkspace/LearningPanel.tsx",
      "kind": "implementation"
    },
    {
      "path": "docs/mvp/102-nodia-teacher-phased-implementation-and-final-qa.md",
      "kind": "specification"
    }
  ],
  "verification": {
    "checked_on": "2026-11-11",
    "evidence_paths": [
      "docs/evidence/teacher-local-implementation-20261101-r01.json",
      "docs/evidence/teacher-local-activation-20261101-r01.json",
      "docs/evidence/teacher-agentic-vm-20261101-r01.json",
      "docs/evidence/teacher-gemini-sdk-vm-20261102-r01.json",
      "docs/evidence/teacher-v1-vm-process-20261103-r01.json",
      "docs/evidence/teacher-gemini-journey-20261103-r01.json",
      "docs/evidence/teacher-study-journey-20261106-r01.json",
      "docs/evidence/teacher-code-blocks-20261106-r01.json",
      "docs/evidence/teacher-upgrade-local-20261111-r01.json",
      "docs/evidence/teacher-upgrade-local-20261111-r02.json",
      "docs/evidence/teacher-upgrade-acceptance-20261111-r02.md",
      "docs/evidence/teacher-upgrade-development-vm-20261111-r01.json"
    ],
    "notes": "Cierre funcional/operativo VM por recibos propios, separado de R02 Windows/API key. Final24/24escritos+16/16objetivos; assisted=false significa ausencia de ayuda registrada en ese intento respondido por el agente. Respaldo/restauración y recarga posterior comprobados. Sin eficacia humana, aceptación de otras selecciones, aprobación o publicación; revisión Git editorial pendiente."
  },
  "approval": null
}
---

> Continuidad VM del2026-11-11: ServerR14/ClientR41 adoptados en la VM de development, con autenticación Google normal y recorrido SQL desde la UI comprobados para la selección OpenAI Agentic configurada. Diagnóstico, evidencia por objetivo, propuesta/material, ayuda anclada, práctica y final quedaron registrados; el respaldo final posterior al QA pasó restauración de DB/configuración; la comprobación operativa y recarga de UI tras reanudar servicios pasaron. [Recibo VM](../../../../evidence/teacher-upgrade-development-vm-20261111-r01.json). El cierre55/55 R02 conserva su alcance Windows/API key; este recorrido no representa55pruebas nuevas en VM ni eficacia educativa humana. Sin promoción a master, aprobación documental o publicación. Los cortes inferiores conservan sus fechas.

## Práctica adaptativa y enseñanza locales — 2026-11-11

## Recorrido VM por alcance — 2026-11-11

Práctica SQL entregada12/14 y respuesta escrita6/6, con evidencia/feedback guardados y asistencia por respuesta; la observación anterior a la ayuda no se reescribió como asistida. El check cambia contexto, pero la muestra y las respuestas del agente no acreditan transferencia o retención humanas. Final40/40 separada de la práctica;0bloques prediction en el material revisado. [Recibo VM](../../../../evidence/teacher-upgrade-development-vm-20261111-r01.json).

## Cierre vigente del upgrade — 2026-11-11

Los55criterios quedaron verificados para el alcance Windows/API key configurado; [evidencia R02](../../../../evidence/teacher-upgrade-local-20261111-r02.json) y [matriz](../../../../evidence/teacher-upgrade-acceptance-20261111-r02.md) separan pruebas, muestras y límites. No se copian aceptaciones a operación, no hay nueva herramienta/binding y se conservan draft/unregistered/approval:null. Los apartados inferiores son cortes anteriores o detalle funcional no sustituido.

Política teacher-learning/1 propone refuerzo, comprobación independiente, recuperación o evidencia insuficiente a partir de respuestas pertinentes; muestra objetivo, motivo y modo recall/discrimination/composition. La nueva preparación recibe respuesta/error y pide variar el contexto, sin rebajar cobertura/final. Razón/confianza y ayuda conservan sus condiciones. Predicciones/checks se guardan sin nota. No se acredita transferencia real por la instrucción al modelo o por variantes sintéticas; la muestra pedagógica permanece pendiente. Repaso manual usa política propia teacher-intervals/1, no FSRS.

Corte histórico de construcción local y QA parcial: las comprobaciones sintéticas y los pendientes registrados entonces se conservan como historia. El cierre R02 y la continuación VM superiores contienen la evidencia posterior; no habilitan herramientas NodiaAI ni implican aprobación o publicación. Contratos en [97](../../../../mvp/97-nodia-teacher-technical-contracts.md), alcance/criterios en [101](../../../../mvp/101-nodia-teacher-adaptive-upgrade-plan.md) y campaña en [102](../../../../mvp/102-nodia-teacher-phased-implementation-and-final-qa.md).


## Upgrade por etapas: práctica adaptativa prioritaria — 2026-11-11

El [upgrade101](../../../../mvp/101-nodia-teacher-adaptive-upgrade-plan.md) prioriza E1 evidencia por objetivo, E2 diagnóstico conectado y E3 práctica adaptativa. V1 conserva su implementación parcial, evaluación/continuidad y evidencia histórica por alcance; los apartados inferiores mantienen sus fechas. El refuerzo V1 conecta objetivos fallados con unidades, sin ser todavía un scheduler ni selección generativa basada en la confusión concreta.

E3 propone recuperar conocimientos, discriminar qué técnica usar y combinar objetivos en situaciones nuevas. La política de selección explica por qué ofrece una actividad a partir de respuestas reales/versiones, sin usar porcentajes arbitrarios de dominio. Explicación y confianza del alumno son opcionales; confianza no declarada es `null`, y una hipótesis de error no modifica por sí sola la nota.

Las ayudas se gradúan y registran antes de volver a comprobar en otro contexto. Un acierto después de ayuda no cuenta como desempeño independiente. Se puede ver un ejemplo resuelto, volver a fundamentos, pausar o terminar; no se mantiene al alumno indefinidamente hasta acertar. Final independiente, ≥90% exacto, cobertura y no-replay se conservan.

E4 agrega predicciones/checks en puntos útiles sin fragmentar obligatoriamente cada paso o generar por interacción. La permutación de opciones será persistida por intento/IDs y compatible con el significado del ítem; no aleatorizar al renderizar. Se deben detectar opciones que dependan de «primera», «anterior» o un orden semántico antes de barajar.

E5 [repaso espaciado](spaced-repetition.md) amplía el repaso V1 sin calendario; E6 [aclaraciones ancladas](contextual-clarifications.md) registra ayuda y bloquea el nuevo ayudante durante finales. E7b/E7c [actividades/visuales](activity-types-and-visuals.md) y E8 [mapa/memoria](concept-memory-and-map.md) quedan posteriores. AC por etapa en101 pendientes; ninguna capacidad, herramienta o publicación se habilita por estas fichas.

## Bloques de código y copia literal local — 2026-11-06

El cuerpo de lección usa LessonMarkdown local: fenced/indentados tienen marco, cabecera y pre monoespaciado; inline code no se convierte en bloque ni añade copiar. La cabecera traduce ausencia de lenguaje a Código y muestra extensión sólo por lenguaje declarado/alias; desconocidos conservan etiqueta real. Esa etiqueta no detecta contenido, valida sintaxis, ejecuta un lenguaje o añade syntax highlighting. Espacios/indentación/saltos se conservan, con desplazamiento horizontal local y región enfocada por teclado.

Copiar solicita Clipboard.writeText con el texto literal que entrega el renderer para ese bloque, incluido newline, sin cabecera o extensión. El control44px tiene tooltip/nombre accesible, se deshabilita mientras espera y usa guard síncrono para no duplicar la intención. Success sólo tras fulfilled; ausencia de API o rechazo produce error/guía para seleccionar y copiar manualmente, conservando el contenido. No hay selección automática, lectura del portapapeles o copia supuesta ante un error.

Se conservan ReactMarkdown/skipHtml e img prohibidas: no se ejecuta HTML o código ni se cargan imágenes del Markdown. No cambia contenido almacenado, versiones/material/evaluación, Server, modelos o renderer compartido NodiaAI; no añade dependencias. Evaluación de impacto: nueva interacción local de lectura/copia en la ficha existente, sin herramienta o permiso de NodiaAI. ClientR27 activo con6pruebas/1suite9,88s, tipos/lint/build y adopción correctos; CUA1088/320 confirmó presentación/scroll y toast, sin verificar bytes del clipboard OS. [96§41](../../../../mvp/96-nodia-teacher-implementation-plan.md#41-bloques-de-código-copiables-en-lecciones-teacher--2026-11-06) y [evidencia](../../../../evidence/teacher-code-blocks-20261106-r01.json) distinguen tests sintéticos, clipboard real y entorno. Draft/partial/unregistered/approval:null y bloqueadoresV1 conservados, sin publicación. Cortes inferiores históricos.

## Recorrido compacto de secciones y unidades — 2026-11-06

StudyJourney presenta «Tu recorrido»22px/700 y secciones numeradas a partir del plan real. El acordeón abre la sección de la unidad seleccionada; objetivos quedan en details/summary de segundo nivel. Cada unidad muestra libro y ordinal real, selección contained/aria-current=step, resto/final outlined. No añade progreso, porcentajes o completitud inferidos. Una unidad externa sigue su sección incluso A→B→A; mientras esa unidad no cambia se conserva la expansión manual. La final depende del allowed_actions.start_final existente, con los mismos IDs/callbacks de cursor/CAS/startAttempt.

Desde md900, la columna de navegación usa minmax(240px,320px) junto al contenido; móvil conserva el acordeón exterior controlado y altura propia del panel. No cambia breakpoints o material. Actualizar disponibilidad de material es contained, ancho auto y centrado incluso móvil por excepción expresa; Solicitar nueva generación contained conserva sus condiciones y recuperación, sin permitir generación por el cambio de estilo.

La persona puede volver manualmente a Mis planes mientras sigue el Worker. El chip de trabajo de la tarjeta se deriva del batch autorizado del servidor, separado del estado de sesión: queued/running más reciente, en otro caso último por fecha/ID. Refetch/pollingGET5s sólo para actividad visible; blocked_paused/unknown/terminales o error no se transforman en actividad. Navegar no cancela ni repite inferencia. Ready significa resultado guardado, no unidad leída o curso aprobado.

Impacto: composición visual de navegación y contexto de consulta del trabajo, sin nueva práctica, contenido, operación ejecutiva o permiso. ClientR26/ServerR09 adoptados con50pruebas Client/8suites y2Server/1suite, tipos/lint/build correctos; PostgreSQL aisladoR03 pasó5checks. CUA1915/320 verificó recorrido/controles y cuatro tarjetas reales con ready/failed_known, sin generación activa observable o nuevas inferencias. [96§40](../../../../mvp/96-nodia-teacher-implementation-plan.md#40-recorrido-compacto-y-generación-visible-en-mis-planes--2026-11-06), [contrato97](../../../../mvp/97-nodia-teacher-technical-contracts.md#proyección-de-generación-en-el-listado-teacher--2026-11-06) y [evidencia](../../../../evidence/teacher-study-journey-20261106-r01.json) separan pruebas y operación. La muestra histórica de práctica/contenido conserva su alcance; bloqueadoresV1, draft/partial/unregistered/approval:null intactos, sin publicación. Cortes inferiores históricos.

## Gemini Teacher: selección calificada en Native R10 — 2026-11-02

La [evidencia técnica](../../../../evidence/teacher-gemini-sdk-vm-20261102-r01.json) acredita OAuth personal separado, adopción Native R10/SDK R05 y calificación real de la selección Gemini Agentic persistida exacta: un POST upstream, FINISH DONE, cierre y ambos ACK. Sólo el finish verificado aporta respuesta; texto acompañante no concede herramientas ni reemplaza el resultado. Siete unknown históricos cerrados/ACK permanecen sin replay y sus respuestas descartadas no se reconstruyen.

El mensaje normal admitido por DI y consumido por el mismo Worker real terminó unknown/cerrado/ambos ACK y sin publicación: lifecycle/cli_timeout; SDK reserved, sin terminal ni contador del proveedor. La canary sigue calificada, pero Worker normal no pasó. No repetir el original. No acredita aún recorrido VM completo con plan/material/evaluación/pausa o contenido revisado, ni otras selecciones/modalidades. La muestra API DNS conserva su alcance, sin garantía universal. Compatibilidad chat/recuperación/backup final y V1 abiertos. ADR094 propuesto; ficha draft/partial/unregistered/approval:null, sin publicación. Apartados siguientes históricos.


## Corte histórico de cierre V1 — R07 unknown / R08 local

La [auditoría96 §25](../../../../mvp/96-nodia-teacher-implementation-plan.md#25-checklist-de-cierre-v1-por-capa--corte-r07-unknown--r08-local) distingue lo implementado/probado localmente de lo aceptado en VM. Codex acredita calificación y respuesta técnica por Worker; no el recorrido completo del alumno con plan, material y evaluación reales. R07 se adoptó pero Gemini terminó unknown cerrado/ambos ACK; R08 sólo tiene fix de permisos y pruebas locales, sin disponibilidad aceptada. Faltan operación Gemini exacta, recorrido VM/contenido revisado, compatibilidad/recuperación final y consolidación. No se repiten unknowns ni se fabrican notas/progreso. Ficha draft/partial/unregistered/approval:null, sin publicación; cortes inferiores históricos.


## Corte parcial Gemini Teacher — 2026-11-02

[96 §24](../../../../mvp/96-nodia-teacher-implementation-plan.md#24-reanudación-gemini-teacher-y-candidato-sdk--2026-11-02) y [ADR094 propuesto](../../../../architecture/decisions/ADR-094-teacher-gemini-bounded-sdk-host.md) distinguen OAuth personal R03 completado de disponibilidad de inferencia. Native R06 se adoptó, pero su intento Teacher terminó unknown, cerrado y con ambos ACK, sin calificación ni replay. Su causa no puede reconstruirse desde el detalle terminal perdido.

La corrección propia ANY/finish pasó una prueba local con TLS sintético que respeta el modo, Owner/Host/motor reales, un POST y FINISH DONE. Ese resultado no demuestra la causa del unknown real ni habilita Gemini Teacher. SDK R03 y Native R07 están preparados; la adopción R07, calificación nueva de la selección exacta y generación normal por Worker siguen pendientes en este corte. Guardar/leer contenido Teacher ya existente conserva sus contratos; esta revisión no acredita material, diagnóstico, práctica o final nuevos generados con Gemini. Estado draft/partial/unregistered, approval null, sin publicación. Los apartados inferiores mantienen sus cortes históricos.


## Estado comprobado en VM — 2026-11-01

La [evidencia VM](../../../../evidence/teacher-agentic-vm-20261101-r01.json) registra Codex conectado y Teacher verificado por Worker/publisher real con la selección persistida exacta, cierre y ambos ACK; smoke autenticado sin otro mensaje. NodiaAI texto/MCP pasó en Codex y Gemini, alcance independiente. Gemini Teacher sigue bloqueado: init.tools es un inventario global y no se demostró el contexto efectivo sólo finish/cero I/O. Tres borradores técnicos archivados; ambos unknown Gemini conservados sin replay. Respaldo DB POST restaurado; captura privada posterior consistente y copia local GCM verificadas. La ficha permanece draft/partial/unregistered/approval:null; cortes inferiores históricos.


> Implementación local2026-11-01: consultar [recibo](../../../../evidence/teacher-local-implementation-20261101-r01.json). Las descripciones históricas de propuesta inferiores conservan su corte; esta revisión sigue draft/unregistered/approval:null.


# Lecciones, práctica y repasos — contexto funcional para NodiaAI

## Alcance operativo local — 2026-11-01

La [ampliación de 96 §22](../../../../mvp/96-nodia-teacher-implementation-plan.md#22-activación-local-por-operador) y su [recibo de activación](../../../../evidence/teacher-local-activation-20261101-r01.json) registran el módulo Teacher asignado únicamente a Oscar, con las 18 asignaciones anteriores y roles intactos. El operador creó un borrador técnico mediante DTOs/casos de uso bajo su sesión real existente, sin crear JWT ni sesiones de autenticación.

Un POST real adicional calificó `teacher-text/1` en la selección API persistida exacta del recibo: resultado completed, cierre local, ACK y elegibilidad confirmados. El borrador técnico se archivó conservando su historial y sin otra generación. API, Client y Worker locales quedaron activos; HTTP público 200 y Teacher anónimo 401 acreditan entrada local y protección. Sigue pendiente el recorrido autenticado en navegador. En ese corte local, Agentic permanecía no calificado y no se operaron servicios de la VM; el estado VM posterior se documenta arriba.

La calificación no crea ni corrige una lección o práctica real del alumno. Teoría, quiz, final y continuidad mantienen su evidencia aislada previa; no se extiende a voz u otras modalidades. Las fichas siguen draft/unregistered/approval:null. Los textos y checklists inferiores conservan su corte histórico; el baseline inicial de tablas/calificaciones vacías no describe esta activación posterior.

## Qué resuelve y qué significa

El recorrido solicitado incluye teoría y quiz para cualquier tema. [Propuesta95 R02 §3–6](../../../../mvp/95-studies-adaptive-learning.md#3-experiencia-propuesta) y [plan96](../../../../mvp/96-nodia-teacher-implementation-plan.md) añaden ejemplos, producción propia, feedback y repasos por objetivos de cada sesión. Jornadas y tópicos comparten las mismas unidades/versiones. El método personal de Obsidian es referencia de continuidad; su traslado no está implementado.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Datos faltantes/ambigüedad | Aclaración esperada |
|---|---|---|---|
| «Continúa donde quedamos» | Reanudar clase | Plan cuando haya varios | Recuperar fase/pregunta reales |
| «Quiero explicar este error de una aplicación» | Practicar producción | Objetivo y ejercicio activo | Ajustar el ejemplo sin registrar un aprobado |
| «¿Qué errores debo repasar?» | Consultar evidencia propia | Alcance del plan | Usar respuestas registradas, no ejemplos inventados |
| «Evalúa mi pronunciación con esta transcripción» | Evaluación sin medio adecuado | Falta evidencia oral | Explicar límite y ofrecer práctica escrita o tarea oral disponible |

## Operaciones y contratos

| Operación semántica | Clase/efecto | Herramienta y estado real | Endpoint/DTO/caso de uso | Resultado público |
|---|---|---|---|---|
| Leer lección y repaso | Lectura | No registrada | PENDIENTE | Contenido persistido autorizado |
| Guardar respuesta y corregir | Evidencia/progreso | No registrada | PENDIENTE | Respuesta, asistencia y feedback de esa versión |
| Pedir variante o explicación | Generación con posible coste | No registrada | PENDIENTE | Material nuevo identificado, sin alterar intento activo |

## Datos mínimos y resolución de dudas

| Dato/concepto | Obligatoriedad propuesta | Significado y fuente | Resolución/aclaración |
|---|---|---|---|
| Lección, ejercicio y versión | Necesarios | Qué se está respondiendo,95 §4/7 | Resolver contexto persistido |
| Respuesta y ayuda recibida | Para evaluación | Evidencia y condiciones | No confundir «No lo sé», respuesta omitida y fallo técnico |
| Rúbrica y alcance | Antes del quiz | Qué puede comprobarse | Mantener denominador y objetivos explícitos |

## Reglas, acceso y restricciones

Aplicar [política89](../../../../mvp/89-module-access-and-user-data-scope.md); destino pendiente. Separar error, alternativa más natural y variante válida: no exigir una frase literal cuando otra cumple el objetivo. Selección múltiple usa clave del servidor; producción abierta exige rúbrica y feedback incierto explícito. Una caída de IA no penaliza al alumno. Practicar con pistas no demuestra dominio independiente. Aprobar texto no acredita habla, escucha ni pronunciación.

## Filtros e informes

Medidas propuestas: recorrido completado, objetivos con evidencia, modalidad evaluada y repasos pendientes, cada una con procedencia y versión. No existen contratos de agregación/reportes; no resumirlas en una cifra de «inglés aprendido» ni mostrar habilidades desconocidas como cero.

## Vista previa, confirmación y recuperación

Antes de evaluar, mostrar alcance y criterios. Guardar borrador, fase y pregunta pendiente; recuperar tras error sin perder la respuesta. El usuario responde directamente en UI, sin propuesta de chat por cada interacción. Cambios preparados por NodiaAI respetan confirmación según su efecto. Contratos pendientes deben demostrar idempotencia y concurrencia: reenviar la misma respuesta no duplica avance ni vuelve a cobrar una corrección recuperable.

[95 R04](../../../../mvp/95-studies-adaptive-learning.md#presentar-teoría-práctica-y-quiz-r04) propone teoría por bloques con ejemplos, práctica guiada y quiz de una pregunta por paso. Fijar content/assessment_version y orden de preguntas/opciones al iniciar el intento. Abrir o recorrer pantallas no acredita dominio. Borrador autoguardado no evalúa ni avanza; enviar fija la respuesta de esa pregunta. Un autoguardado tardío no puede sobrescribir ese envío.

Selección se corrige con clave en Server sin IA; completar usa alternativas/normalización explícitas. Producción abierta puede devolver feedback_pending con job recuperable: conservar respuesta y no asignar cero/aprobado por fallo, ambigüedad o unknown. El feedback sólo revela soluciones autorizadas de preguntas enviadas; la siguiente pregunta se abre por acción explícita. Ayudas/consulta de soluciones se registran bajo las condiciones de ese intento.

[La pausa R04](../../../../mvp/95-studies-adaptive-learning.md#pausar-y-retomar-la-lección-r04) guarda cursor/borrador y estado juntos con revisión/recibo, antes de salir. Mostrar guardando/guardado/cambios sin guardar reales; un fallo conserva la pantalla y el borrador. Reanudar recupera misma versión, fase, ancla de bloque/ejercicio/pregunta, orden, respuestas y feedback/job pendiente, sin regenerar. Cerrar sin confirmación sólo garantiza el estado previo guardado en Server. Dos pestañas no sobrescriben silenciosamente; caché/retorno se aíslan por usuario/sesión. Retomar sesión no despacha trabajos retenidos por pausa sin otra acción explícita.

### Distinción de práctica y final R05

El feedback por respuesta de R04 corresponde a **unit_practice**: mostrar correcta/alternativas y porqué al enviar, sin exigir90% en cada ejercicio para poder continuar la lectura. La [final de sección R05](../../../../mvp/95-studies-adaptive-learning.md#17-práctica-y-prueba-final-de-sección-r05) usa **section_final**; guardar/navegar respuestas no revela claves, puntuación parcial o explicaciones. Entregar congela todo el intento y permite corregir/publicar feedback. Si falta corrección necesaria, queda pending sin nota final. La pausa no entrega automáticamente.

Usuario confirma≥90% para aprobar esa final. La propuesta para un resultado completo inferior es refuerzo focal y nuevo intento con variantes de cobertura completa, no releer toda la materia ni repetir literalmente las preguntas corregidas. El envío final no se puede eludir usando el endpoint de corregir una pregunta de práctica. Condiciones/versiones y procedencia quedan fijadas; no se suman puntos entre intentos. Los detalles de feedback y repetición siguen pendientes de revisión/implementación, sin publicación.

El [contrato97](../../../../mvp/97-nodia-teacher-technical-contracts.md) concreta estados del intento/resultados, acciones derivadas por Server, índice/GET de preguntas, puntuación entera y rúbrica V1, cobertura, asistencia y navegación/pausa con versiones. Los defaults y criterios de formato son propuestas técnicas versionadas; el único umbral confirmado es≥90% en la final. Implementar/verificar con96 y su mensaje98, sin tratar un contrato redactado como desempeño real del alumno.

## Integración y evidencia

- [x] Objetivo personal y distinción de modalidades documentados.
- [x] Diseño V1 de corrección, variantes, ayuda y avance concretado en97; repaso por errores/feedback sin cronograma automático.
- [ ] Reglas atómicas e integración de progreso/autoridad comprobadas.
- [ ] Client responsive y estados de carga/vacío/error/continuidad verificados.
- [ ] Modalidades IA necesarias y calidad pedagógica comprobadas.
- [ ] Herramientas/contexto, confirmación y publicación autorizados.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Herramientas/contexto afectados | Compatibilidad/propuestas pendientes |
|---|---|---|---|
| 1 | Lecciones, producción breve y repasos propuestos | Sin herramientas actuales | Voz y otros temas necesitan sus propias tareas, rúbricas y evidencia |
| 2 | Lecciones genéricas, generación progresiva y cursor por sesión Teacher según95/96 | Sin herramientas actuales | Otros temas son alcance inicial; voz mantiene cualificación propia; no reemplazar progreso con prompts |
| 3 | Teoría/quiz y pausa/retorno de primera lección ampliados en95 R04/96 R03 | Sin herramientas actuales | Orden/versión fijos, borrador/envío distintos, corrección/pendiente y continuidad confirmada; sin evaluación real |
| 4 | Quiz formativo y final de sección separados por95 R05/96 R04 | Sin herramientas actuales | Umbral final confirmado, feedback según propósito y reintento con variantes propuestos; sin evaluación real |
| 5 | Estados, puntuación/formatos y contratos de continuidad concretados en97 | Sin herramientas actuales | Plan de implementación completo96/98; sin cambiar historial o acreditar evaluación real |
| 7 | Activación local por operador según 96 §22 y recibo20261101: asignación individual y selección API exacta calificada | Sin herramientas, capacidades o bindings nuevos; ficha candidata | Conserva historial y gates de navegador, Agentic, pedagogía, aprobación y publicación |

## Incorporación técnica en VM — 2026-11-01

La incorporación técnica en VM añadió el esquema Teacher y ownership neutral mediante cinco migraciones, con filas, IDs, grants y asignaciones anteriores conservados. Los carriles Native están instalados; esto no acredita inferencia Teacher Agentic ni transfiere la calificación API local. El [recibo VM](../../../../evidence/teacher-agentic-vm-20261101-r01.json) distingue el estado operativo y los pendientes. Esta ficha conserva draft/unregistered/approval:null, sin aprobación ni publicación.

## Verificación de proceso y plazo autorizado — 2026-11-03

El alcance técnico operativo está comprobado por el recorrido VM: Codex acredita la final directa/refuerzo/material/práctica y conserva elegibilidad actual sin otra generación; Gemini R11 publicó su material real con un POST/FINISH DONE/cierre y ambos ACK. Su muestra revisada incluye cuatro bloques y la primera pregunta de práctica2/2; no se afirma práctica/final Gemini completas. Se conservan los unknown anteriores sin replay y los seis borradores técnicos están archivados por UI.

ClientR03 respeta latest_job_id del Server y el cursor guardado. La UI autenticada verificó recarga del quiz/corrección y bookmark de escritorio/móvil sin nueva inferencia. Chat actual verificó su compatibilidad de forma independiente; no se habilitan herramientas Teacher o escritores comerciales por estos resultados. DB final/restore/GCM y captura privada final/copia/GCM/reanudación pasaron.

La ampliación autorizada300s sólo aplica a learning_packet/assessment_only, con120s en los demás propósitos y menor deadline efectivo; conserva un POST/cero retries/no replay. La revisión pedagógica es una muestra acotada con límites de ejemplos, sin psicometría o garantía universal. La ficha sigue draft/partial/unregistered/approval:null y no se publica por esta entrega.

Fuentes: [evidencia de proceso](../../../../evidence/teacher-v1-vm-process-20261103-r01.json), [96 §26](../../../../mvp/96-nodia-teacher-implementation-plan.md#26-recorrido-directo-vm--2026-11-03) y [contrato97](../../../../mvp/97-nodia-teacher-technical-contracts.md).


### Recorrido Gemini completo y refuerzo focal R05

La práctica real terminó14/14; la primera final20/40 dio refuerzo únicamente al objetivo0/20 y su segunda unidad canónica. Navegar consultó material y guardó el cursor sin generar; preparar fue otra acción. Tras seis bloques/lecturas y práctica14/14, una evaluación nueva conservó cobertura/40p y publicó variantes distintas; el intento2 terminó40/40, verificó sección y dejó la sesión completed. No se sumaron notas ni se usaron ayudas de la aplicación; el recorrido QA no certifica nivel personal.

R05 muestra puntos por recuperar sin umbral por objetivo ni claves, y el histórico no enlaza al plan actual. Conservó foco, borrador, pausa/recarga y destino móvil; un guardado incierto se concilió por receipt sin reenvío manual. Codex conserva elegibilidad actual y su calificación histórica, sin otra generación. Las preguntas/feedback revisados tienen límites DNS y de variación posicional; no se promete eficacia/precisión universal ni calibración. La pista opcional sospechosa se omite sin cambiar rúbrica, pudiendo dejar ayuda no disponible; la causa del primer rechazo histórico no se reconstruye. DB POST/GCM/restore y runtime reanudado pasaron. La captura original falló al reanudar y conserva su estado; auditoría independiente del par cifrado existente, sin recaptura. Ambas copias pasaron GCM íntegro por verificación independiente; el catálogo externo cifrado es un snapshot previo a restaurar timers y no se declara igual al actual. El runtime fresh y la UI final quedaron operativos, sin reclasificar la captura original fallida. [Recorrido27](../../../../mvp/96-nodia-teacher-implementation-plan.md#27-recorrido-completo-gemini--continuación-solicitada).


### Ejemplos completos y reemplazo explícito — 2026-11-04

Los ejemplos de lenguaje usan identificadores ficticios no sensibles; no recomiendan compartir contraseñas, claves o credenciales. El deletreo conserva cada carácter en orden, incluidos dígitos, símbolos y repeticiones, distinguiendo nombres de letras de pronunciación de palabras. La guía reduce errores de generación, pero no sustituye la revisión del material real ni garantiza calidad universal.

Generar otra versión del material confirma una única solicitud por la ruta existente variant=new. Conserva la versión anterior y sus intentos; no cambia respuestas ni notas anteriores. El contexto y CAS se capturan al abrir y no se rebasean automáticamente. Error/resultado incierto conserva recuperación del recibo original sin reenvío; cerrar explícitamente el diálogo no borra la intención pendiente. Un intento activo se retoma hasta concluirlo normalmente; una evaluación nueva no hereda sus respuestas o puntos. [Reglas y QA30](../../../../mvp/96-nodia-teacher-implementation-plan.md#30-corrección-de-ejemplos-y-continuación-de-práctica--2026-11-04).

QA R08/R14 en VM: cinco bloques nuevos revisados, dev_42/bug-7/tag-3 deletreados completos y sin referencia a compartir credenciales. La práctica nueva concluyó14/14, con Gemini escrito6/6 y pausa/recargaQ5/explicación/nota; la anterior conservó14/14 por separado. Finalizar con feedback pendiente mostró estado pendiente sin nota anticipada. Las tres respuestas correctas de selección única aparecieron primero: límite de esta muestra, sin calibración/garantía universal, pronunciación certificada o curso completo. [Evidencia actual](../../../../evidence/teacher-material-correction-practice-20261104-r01.json).
