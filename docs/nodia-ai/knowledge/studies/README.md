---
{
  "schema_version": 1,
  "document_id": "studies",
  "product_id": "studies",
  "kind": "product",
  "revision": 35,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "QA55/55 R02 conservado para Windows/API key exacta. Continuación VM OpenAI Agentic sobre ServerR14/ClientR41 comprobada: diagnóstico/evidencia, plan/material, ayuda, práctica12/14 y final40/40; respaldo/restauración y reanudación operativa/UI pasados. Las respuestas son del agente de QA, no eficacia humana ni55nuevas pruebas VM. Revisión/versionado Git editorial pendiente; sin master, aprobación o publicación. Candidato local2026-11-12: formulario guiado, idioma validado conservando etiqueta histórica y selección IA visible/48px con ayuda; catálogo sin esfuerzos explicado sin inventarlos. Cabecera Codex consulta observación acotada compartida, sin polling. Build/lint,382regresiones/51archivos y QA320/1280 correctos; f01productivo tiene0recibos Agentic y carece de tabla por propósito; sin despliegue/inferencia o publicación del lote."
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
      "path": "docs/architecture/decisions/ADR-089-versioned-study-plans-and-content.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/89-module-access-and-user-data-scope.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/teacher/teacher.controller.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/teacher/teacher.service.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/pages/Teacher/Teacher.tsx",
      "kind": "implementation"
    },
    {
      "path": "docs/architecture/decisions/ADR-093-teacher-agentic-text-runtimes.md",
      "kind": "specification"
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
      "path": "nodia-server/src/ai-generation/teacher-generation-runtime.service.ts",
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
      "path": "nodia-client/src/modules/teacher/components/SetupConversation/SetupConversation.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/components/JobPanel/JobPanel.tsx",
      "kind": "implementation"
    },
    {
      "path": "docs/architecture/decisions/ADR-071-bounded-agentic-profile-observations.md",
      "kind": "specification"
    },
    {
      "path": "nodia-client/src/modules/teacher/infrastructure/presentation.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/components/MessageComposer/MessageComposer.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/hooks/useVoiceDictation.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/components/VoiceActivity/VoiceActivity.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/components/SelectionPanel/SelectionPanel.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/infrastructure/modelOptions.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/components/inputs/TextInput/styles.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/components/QueryErrorAlert/QueryErrorAlert.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/components/TeacherLoading/TeacherLoading.tsx",
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
      "path": "docs/mvp/102-nodia-teacher-phased-implementation-and-final-qa.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-098-teacher-learning-evidence-and-adaptive-progression.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/teacher/teacher-learning.controller.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/teacher/teacher-enrichment.controller.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/teacher/use-case/teacher-learning-persistence.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/components/AdaptiveWorkspace/AdaptiveWorkspace.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/ai-generation/teacher-qualification-policy.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/ai-generation/teacher-contextual-qualification-policy.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/scripts/qualify-teacher-text.mjs",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/components/SessionForm/SessionFields.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/components/FieldHelp/FieldHelp.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/infrastructure/schemas.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-11-12",
    "evidence_paths": [
      "docs/evidence/teacher-local-implementation-20261101-r01.json",
      "docs/evidence/teacher-local-activation-20261101-r01.json",
      "docs/evidence/teacher-agentic-vm-20261101-r01.json",
      "docs/evidence/teacher-gemini-sdk-vm-20261102-r01.json",
      "docs/evidence/teacher-v1-vm-process-20261103-r01.json",
      "docs/evidence/teacher-gemini-journey-20261103-r01.json",
      "docs/evidence/teacher-preparation-ux-20261105-r01.json",
      "docs/evidence/teacher-final-qa-20261105-r01.json",
      "docs/evidence/teacher-chat-ui-20261105-r01.json",
      "docs/evidence/teacher-inline-status-20261105-r01.json",
      "docs/evidence/teacher-model-effort-20261105-r01.json",
      "docs/evidence/teacher-ui-controls-20261106-r01.json",
      "docs/evidence/teacher-study-journey-20261106-r01.json",
      "docs/evidence/teacher-code-blocks-20261106-r01.json",
      "docs/evidence/teacher-upgrade-local-20261111-r01.json",
      "docs/evidence/teacher-upgrade-local-20261111-r02.json",
      "docs/evidence/teacher-upgrade-acceptance-20261111-r02.md",
      "docs/evidence/teacher-upgrade-development-vm-20261111-r01.json",
      "docs/mvp/96-nodia-teacher-implementation-plan.md"
    ],
    "notes": "Cierre funcional/operativo VM por recibos propios, separado de R02 Windows/API key. Final24/24escritos+16/16objetivos; assisted=false significa ausencia de ayuda registrada en ese intento respondido por el agente. Respaldo/restauración y recarga posterior comprobados. Sin eficacia humana, aceptación de otras selecciones, aprobación o publicación; revisión Git editorial pendiente. Corte2026-11-12: inspección de contratos y código local; build/lint Client,382regresiones/51archivos y QA Chromium320/1280 correctos; diagnóstico vivo confirmado en recibo propio: f01/45migraciones,0recibos Agentic y tabla por propósito ausente, sin trasladar la aceptación anterior."
  },
  "approval": null
}
---

> Continuidad VM del2026-11-11: ServerR14/ClientR41 adoptados en la VM de development, con autenticación Google normal y recorrido SQL desde la UI comprobados para la selección OpenAI Agentic configurada. Diagnóstico, evidencia por objetivo, propuesta/material, ayuda anclada, práctica y final quedaron registrados; el respaldo final posterior al QA pasó restauración de DB/configuración; la comprobación operativa y recarga de UI tras reanudar servicios pasaron. [Recibo VM](../../../evidence/teacher-upgrade-development-vm-20261111-r01.json). El cierre55/55 R02 conserva su alcance Windows/API key; este recorrido no representa55pruebas nuevas en VM ni eficacia educativa humana. Sin promoción a master, aprobación documental o publicación. Los cortes inferiores conservan sus fechas.

## Recorrido VM por alcance — 2026-11-11

Diagnóstico2/4 con confianza0 y asistencia, dos mapeos explícitos, fuente/hash admitidos, material contextual y práctica12/14 con escrita6/6 quedaron comprobados desde UI. La final obtuvo40/40 con escrita24/24 y passed/assisted=false persistido; las respuestas fueron del agente de QA, sin eficacia humana acreditada. La ayuda real quedó anclada y el ajuste candidato sólo cambió título, sin activación. El material revisado emitió0bloques prediction y0citas estructuradas. Fuente, tarjeta/repaso, actividad/visual y concepto manuales conservan sus límites; no hay FSRS, hipótesis pedagógicas automáticas o transferencia de notas/verificaciones. [Recibo VM](../../../evidence/teacher-upgrade-development-vm-20261111-r01.json).

## Upgrade local parcial — 2026-11-11

## Cierre vigente del upgrade — 2026-11-11

Los55criterios quedaron verificados para el alcance Windows/API key configurado; [evidencia R02](../../../evidence/teacher-upgrade-local-20261111-r02.json) y [matriz](../../../evidence/teacher-upgrade-acceptance-20261111-r02.md) separan pruebas, muestras y límites. No se copian aceptaciones a operación, no hay nueva herramienta/binding y se conservan draft/unregistered/approval:null. Los apartados inferiores son cortes anteriores o detalle funcional no sustituido.

El usuario autorizó la implementación de todas las fases de101/102. El código local incorpora evidencia por objetivo, banco diagnóstico manual revisado, personalización/práctica por evidencia y bloques interactivos; además repaso manual con política teacher-intervals/1, aclaraciones con contextual_reply, fuentes textuales/PDF pequeño y citas comprobables, actividades/visuales internos y conceptos/equivalencias privadas. Los modelos, DTOs y límites efectivos se registran en [contratos97](../../../mvp/97-nodia-teacher-technical-contracts.md). Las seis fichas nuevas pasan de planned a partial; las cuatro funciones base siguen partial.

La [evidencia consolidada](../../../evidence/teacher-upgrade-local-20261111-r01.json) recoge comprobaciones técnicas, SQL aislado y QA acotado de paneles en navegador con transporte sintético, sin inferencia real nueva o adopción. No hay55TU íntegramente aceptados. Banco, tarjetas, actividades y conceptos se crean manualmente; conocer la solución impide tratar esas respuestas como independencia acreditada. El scheduler propio no es FSRS; la instrucción de transferencia al modelo no demuestra transferencia real. La integración de fuentes se limita a texto/PDF textual, sin OCR o voz.

Se conserva el dominio `/nodia-teacher`, privacidad89, revisión humana del plan, final independiente≥90%, claves privadas, estado pendiente y recuperación sin replay. Sin cambios de retención, aprobación, herramientas/bindings publicados o despliegue. Los cortes documentales inferiores mantienen su fecha; sus avisos previos de sólo documentación no sustituyen esta autorización posterior ni acreditan funcionalidades por sí mismos.


## Upgrade pedagógico por etapas — 2026-11-11

El usuario solicita documentar el [upgrade101](../../../mvp/101-nodia-teacher-adaptive-upgrade-plan.md) después del análisis estático de LearnHarness, sin implementar código. [ADR098 propuesto](../../../architecture/decisions/ADR-098-teacher-learning-evidence-and-adaptive-progression.md) separa contenido, evidencia y verificación sobre Teacher y su runtime actual. La propuesta está en revisión; no es aprobación documental, despliegue o publicación.

El [plan102](../../../mvp/102-nodia-teacher-phased-implementation-and-final-qa.md) recoge la preferencia posterior confirmada: construir de forma continua por fases, con controles técnicos breves, y concentrar QA integrado/correcciones al final. No se pide aprobación o prueba completa por función. Construcción terminada y aceptación comprobada siguen siendo estados diferentes; los55TU se verifican en una campaña agrupada. Esta revisión sólo cambia el método de entrega y no añade capacidades, evidencia funcional o publicación.

Prioridad: E1 evidencia por objetivo con razonamiento/confianza opcionales, E2 diagnóstico acotado que alimenta plan/material y E3 práctica adaptativa con asistencia/transferencia. E0 conserva los gates operativos vigentes de96; las ampliaciones posteriores son E4 lecciones interactivas, E5 repaso, E6 aclaraciones, E7 fuentes/actividades/visuales y E8 memoria/mapa. Dependencias y AC verificables viven en101; estas fichas explican semántica, límites y solicitudes, sin duplicar sus contratos técnicos.

La evidencia diagnóstica no sustituye la final independiente de ≥90%. Leer, sentirse seguro o ver una idea en un mapa no demuestra aprendizaje. Confianza sin declarar permanece `null`; ayuda, pendiente y desconocido no se convierten en independencia o cero. El historial V1 y los snapshots aceptados se preservan; no se fabrican evidencias retrospectivas para las sesiones existentes.

Las cuatro funciones base conservan estado parcial; las seis nuevas están planned/draft/unregistered/approval:null. El módulo Teacher usa `/nodia-teacher`, propiedad y autoridad89/ADR092; mover el menú no cambia permisos. Sin herramientas NodiaAI nuevas, acceso a otros productos, modelos fijos, fallback o replay de resultados inciertos. El nuevo ayudante queda bloqueado durante finales y los archivos propios/actividades nuevas requieren sus gates específicos. Los cortes inferiores conservan su fecha, sin acreditar cierre V1 o capacidades del upgrade.

## Código de lecciones con copia local — 2026-11-06

LessonMarkdown del ClientR27 activo muestra bloques fenced/indentados con cabecera y código monoespaciado. La extensión es presentación del lenguaje declarado y sus aliases, sin detección por contenido o syntax highlighting. Un lenguaje desconocido conserva su etiqueta; sin lenguaje se muestra Código traducido. Inline code permanece inline. Las líneas/espacios se conservan con scroll horizontal local y controles de foco/teclado, sin reflow del código.

El IconButton44px copia sólo el texto del bloque renderizado, incluido newline, sin cabecera/extensión. Disabled e inFlight evitan duplicados; Sileo success sólo tras Clipboard.writeText fulfilled. Sin API o con rechazo, error/guía manual y texto seleccionable, sin fingir copia o seleccionar automáticamente. La interfaz no ejecuta código, HTML o archivos; mantiene skipHtml e img prohibidas, sin cambiar el renderer NodiaAI compartido ni añadir dependencias.

Evaluación de impacto: copiar es una nueva interacción local, por lo que se actualizan producto/lecciones existentes; no añade herramienta, permiso o capacidad ejecutiva de NodiaAI.6pruebas/1suite9,88s, tipos/lint/build y adopción correctos. CUA1088/320 verificó bloques/scroll/copy44px y toast tras writeTextfulfilled; no se verificaron bytes del portapapeles OS. [96§41](../../../mvp/96-nodia-teacher-implementation-plan.md#41-bloques-de-código-copiables-en-lecciones-teacher--2026-11-06) y [evidencia](../../../evidence/teacher-code-blocks-20261106-r01.json) separan esos cortes. Contenido persistido, Server/modelos y bloqueadoresV1 conservados; draft/partial/unregistered/approval:null, sin publicación. Cortes inferiores históricos.

## Recorrido compacto y generación en Mis planes — 2026-11-06

ClientR26/ServerR09 adoptados reúnen StudyJourney compacto y una proyección autorizada del trabajo en las tarjetas. Tu recorrido usa22px/700, ordinales reales, sección actual expandida y objetivos en segundo nivel; unidad seleccionada contained/aria-current=step, resto/final outlined, sin atribuir progreso. Se preservan IDs, callbacks/CAS y acciones permitidas. Navegación acotada en escritorio y acordeón exterior móvil existentes. Actualizar disponibilidad de material queda contained, auto/centrado incluso móvil por excepción expresa; Solicitar nueva generación contained mantiene sus guards.

Se puede volver manualmente a Mis planes mientras el Worker continúa la intención admitida, sin redirección automática. latest_job contiene sólo job_id/state/purpose: prioriza queued/running más reciente, en otro caso último por fecha/ID; batch máximo50sobre la página propia, sin N+1 ni contenido privado. Chip de trabajo separado de estado de sesión; ready no completa el curso. GET cada5s sólo mientras haya queued/running visible; unknown/blocked_paused/terminal/error detienen sondeo. Refetch conserva tarjetas y un error señala último estado confirmado con reintento GET. Navegar no cancela el Worker ni reenvía.

Impacto: navegación visual e información funcional del trabajo fuera del detalle, sin nueva ejecución, migración, herramienta o permiso.50pruebas Client/8suites y2Server/1suite, tipos/lint/build correctos; PostgreSQL aisladoR03 pasó5checks. CUA1915/320 verificó recorrido/controles y cuatro tarjetas reales con ready/failed_known, sin generación activa observable o nuevas inferencias. [95§20](../../../mvp/95-studies-adaptive-learning.md#mis-planes-y-trabajo-en-segundo-plano--ampliación-del-2026-11-06), [96§40](../../../mvp/96-nodia-teacher-implementation-plan.md#40-recorrido-compacto-y-generación-visible-en-mis-planes--2026-11-06), [contrato97](../../../mvp/97-nodia-teacher-technical-contracts.md#proyección-de-generación-en-el-listado-teacher--2026-11-06) y [evidencia](../../../evidence/teacher-study-journey-20261106-r01.json) distinguen esas capas. BloqueadoresV1, draft/partial/unregistered/approval:null conservados, sin publicación. Cortes inferiores históricos.

## Controles, padding y carga inicial Teacher — 2026-11-06

La revisión visual R25 adoptada corrige el padding de todos los TextInput multiline en su propietario reusable: raíz MUI espaciada y textarea0, conservando singleline, adornos, fuente y contrato. PlanReview usa título22px/700 y botones contained; los demás Button Teacher antes implícitos/text pasan a outlined cuando no contained, con variantes condicionales y paginación coherentes. QueryErrorAlert ofrece retryVariant optativo; Teacher elige outlined sin cambiar el default de los otros módulos.

TeacherLoading representa contenido inicial con Boneyard/initialBones geométricos. Refetch con datos conserva contenido y edición sin skeleton; los controles se bloquean según el estado remoto. Errores, vacío, borradores, foco y recuperación mantienen sus significados. Evaluación de impacto exclusivamente visual/carga existente: no agrega conceptos de producto, HTTP, herramientas, capacidades o permisos. Sin nuevos contratos, defaults, selección IA o inferencias por este arreglo.

ClientR25 adoptado:83pruebas únicas/12suites, tipos/lint/build y QA visual acotada correctos. PlanReview título/contained se verifican por fuente/unidad, sin reabrir el plan personal aceptado. [96§39](../../../mvp/96-nodia-teacher-implementation-plan.md#39-controles-padding-multilínea-y-carga-inicial-teacher--2026-11-06), [estándar TextInput](../../../../nodia-client/DESIGN.md#69-padding-único-en-textinput-multilínea--2026-11-06) y [evidencia](../../../evidence/teacher-ui-controls-20261106-r01.json) distinguen esos cortes. No se declara cierre V1 ni aprobación/publicación. Draft/partial/unregistered/approval:null y bloqueadores anteriores conservados; los apartados inferiores son históricos.

## Modelo e intensidad separados en Teacher — 2026-11-05

Gemini Agentic presenta una opción por grupo de variantes observadas y su intensidad en el selector de esfuerzo. Se limita a provider_key real gemini y modo agentic: etiqueta final/intensidad, sufijo de ID y preferencia ya existente deben concordar; se requieren al menos dos variantes inequívocas sin colisiones. Es agrupación léxica de presentación, no prueba de familia interna, soporte, cuota o equivalencia del proveedor. API/Codex, metadatos ausentes, grupos ambiguos e históricos con variante/esfuerzo cruzados permanecen planos.

No existe un ID base ejecutable nuevo. La selección guardada high/high conserva sus mismos ID/esfuerzo al abrir; otra intensidad elegida explícitamente resuelve a su variante real observada y esfuerzo, comprueba elegibilidad exacta y requiere Aplicar/guardar antes de Enviar/Implementar. Un grupo incompleto no habilita ejecución. Calificaciones/proofs de una variante nunca habilitan otra; defaults y jobs históricos no se reescriben.

Evaluación de impacto: simplifica la presentación de selección y cambia la interacción entre modelo e intensidad; se actualiza la ficha existente, sin nuevas operaciones, herramientas o capacidades. ClientR24 adoptado,28pruebas focales/2suites, tipos/lint/build y CUA escritorio/320px correctos. Low quedó no calificado y sin aplicar; Cancelar restauró high, sin inferencias nuevas. [95§20](../../../mvp/95-studies-adaptive-learning.md#20-comprender-la-definición-y-el-trabajo-en-curso--2026-11-05), [96§38](../../../mvp/96-nodia-teacher-implementation-plan.md#38-modelo-gemini-e-intensidad-separados-en-teacher--2026-11-05), [contrato97](../../../mvp/97-nodia-teacher-technical-contracts.md#agrupación-visual-de-variantes-gemini-y-selección-exacta--2026-11-05) y [evidencia](../../../evidence/teacher-model-effort-20261105-r01.json). Server/DTOs/SDK/runtime/DB/defaults e inferencias intactos; bloqueadores anteriores conservados. Draft/partial/unregistered/approval:null, sin publicación. Cortes inferiores históricos.

## Estado integrado y mensajes propios guardados — 2026-11-05

La definición usa «Define tu plan con Nodia Teacher» en22px/negrita y capitalización normal. El trabajo actual aparece dentro de esa conversación, bajo el título, con chip y actualización GET compacta; no se duplica una sección exterior «Trabajo de Teacher». Conserva el mismo polling, carga estable, errores/último estado conocido y recuperación de READY/terminal, continuación o nueva generación conforme al contrato. Actualizar sólo consulta, sin repetir la intención original.

«Implementar plan» es una etiqueta UI de la misma propuesta confirmada. El diálogo captura contexto y permite cancelar; confirmar genera una propuesta revisable, sin aceptar ni iniciar el curso. Conversar, ajustar, revisar y aceptar por revisión/hash siguen separados. El texto privado no enviado permanece excluido.

Sólo las burbujas propias obtenidas por GET muestran, al extremo derecho de «Tú», un check success con tooltip «Mensaje guardado». Ese mensaje está persistido en teacher_setup_messages; no se atribuye lectura, entrega al proveedor o respuesta IA. El borrador autoguardado y las respuestas Teacher no muestran ese check. Se oculta el caption de éxito habitual del borrador, manteniendo pendiente/guardando, error/reintento, validación y conflicto/texto remoto. CAS, límites, pausa y recuperación de resultado incierto no cambian.

Evaluación de impacto: cambia presentación e interpretación de la autoría y del CTA; requiere esta actualización de contexto, sin nuevas operaciones, herramientas, permisos, DTOs o modalidades. ClientR21 adoptado con73pruebas focales, build/tipos/lint y CUA escritorio/320px, conforme96§35. [95§20](../../../mvp/95-studies-adaptive-learning.md#20-comprender-la-definición-y-el-trabajo-en-curso--2026-11-05), [contrato97](../../../mvp/97-nodia-teacher-technical-contracts.md#estado-integrado-y-mensajes-propios-guardados--2026-11-05) y [evidencia](../../../evidence/teacher-inline-status-20261105-r01.json) separan reglas, resultado comprobado y pendiente. No hubo nuevas inferencias por esta documentación ni se cierran bloqueadores previos. Ficha draft/partial/unregistered/approval:null; no publicada. Los apartados siguientes conservan sus cortes históricos.

## Conversación Teacher y editor común — ClientR19/R20,2026-11-05

La definición adopta una conversación con Teacher a la izquierda y avatar de birrete, y la persona a la derecha. MessageComposer comparte únicamente texto, dictado, teclado y estilos; Teacher no incluye adjuntos. La selección dinámica de conexión/modo/modelo/esfuerzo está en el pie, con estado exacto dirty/ready y guardado por el CAS de la sesión. No se elige otra combinación ni se habilita una capacidad por un nombre de modelo.

El borrador se autoguarda privadamente con estado confirmado; desaparece Guardar mensaje como acción habitual y un fallo ofrece reintento sin perder texto. Enter envía, Shift+Enter añade una línea e IME/repeat no envían. Dictar produce texto editable bajo4000UTF-16/8192bytes UTF-8 y puede usar el servicio del navegador; no es inferencia Teacher ni carga de audio. Capturas/contextos obsoletos no pueden emitir texto tardío sobre otra sesión.

Proponer está arriba y confirma un contexto capturado antes del envío; cancelar permite seguir conversando. No acepta ni clausura la definición. Se revisa/conversa/ajusta antes de aceptar un plan y las revisiones posteriores conservan resultados/historia. Un tooltip accesible sustituye la guía permanente. Los fallos, conflictos y recibos inciertos conservan sus rutas de recuperación.

Evaluación de impacto: cambia presentación e interacción de definición, por lo que requiere actualizar su contexto funcional; no añade operaciones HTTP, herramientas, permisos, adjuntos o modalidades IA. El núcleo común no importa dominios Teacher/NodiaAI, y NodiaAI conserva su política multimedia en el wrapper. ClientR19/R20 adoptados y comprobados según96§34; autoguardado diferido durante dictado y contraste adecuado al fondo.105regresiones, build/tipos/lint y CUA escritorio/320px, sin grabar micrófono real ni generar contenido. Sin aprobar/publicar fichas. [Solicitud95§20](../../../mvp/95-studies-adaptive-learning.md#20-comprender-la-definición-y-el-trabajo-en-curso--2026-11-05) y [contrato UI97](../../../mvp/97-nodia-teacher-technical-contracts.md#conversación-de-definición-y-editor-compartido--2026-11-05) fijan la regla vigente;96 separa los resultados de cada entorno. Los cortes inferiores son históricos.

## QA final R16 con bloqueadores Gemini — 2026-11-05

ClientR16 adoptado: definición bloquea Enviar/Proponer/ajustar durante queued/running, conservando borrador/Pausar e históricos unknown cerrados. QA real: Gemini plan/material/práctica10/10 y final0/24 con refuerzo de material existente; escrita final2 unknown a120s y nueva generación final3 unknown/reply_framing, sin aprobación de sección. Close-pending conservó notaNULL e inactivó intento; ningún replay. Codex propuesta/ajuste completados y aplicados sin aceptar plan. QA archivadas y cursos personales conservados. SDK/Native sin cambios; no aceptación/publicación global. Fuente96§32.

[Seguimiento32](../../../mvp/96-nodia-teacher-implementation-plan.md#32-qa-final-solicitado-y-prevención-de-intenciones-superpuestas--2026-11-05) y [evidencia final](../../../evidence/teacher-final-qa-20261105-r01.json) separan inferencia real, pruebas locales y pendientes. Los apartados inferiores conservan sus cortes históricos; esta ficha continúa draft/partial/unregistered/approval:null.

## Definición y preparación estable — 2026-11-05

ClientR15 explica Guardar/Enviar/Proponer y bloquea Proponer mientras haya borrador no enviado, sin enviarlo automáticamente. NativeR12 corrige la carrera entre elegibilidad y ejecución Teacher con un turno acotado antes del dispatch, preservando plazos, exclusividad y cuarentena. La calificación actual y una propuesta por el Worker normal Gemini terminaron con un POST cada una, cierre y ambosACK. UI observó barra estable, candidata de una sección/unidad para revisión humana y archivo exclusivo del borrador técnico, sin aceptar o generar material. El curso de entrevistas técnicas conservó su conversación; Inglés ya estaba activo antes de este arreglo y mantiene sus dos prácticas14/14.

Las verificaciones fallidas de adopción conservan su evidencia. La reanudación correcta usa un operador propio ligado a reconstrucción criptográfica exacta del estado previo; no repite Native ni finge éxito del coordinador original. ServerR08/SDK/configuración/credenciales se conservan; ninguna captura CFG/DB PRE o publicación nuevas. [Reglas31](../../../mvp/96-nodia-teacher-implementation-plan.md#31-definición-clara-y-estado-de-preparación-estable--2026-11-05) y [evidencia](../../../evidence/teacher-preparation-ux-20261105-r01.json) fijan el alcance de pruebas; otras modalidades no heredan esta calificación. Draft/partial/unregistered/approval:null.

## Material corregido y práctica de Inglés — cierre 2026-11-05

ServerR08/ClientR14 están adoptados. Los cinco bloques de la versión nueva usan ejemplos ficticios con deletreo completo y sin la referencia a compartir credenciales. La práctica nueva terminó14/14 con feedback escrito real Gemini6/6; pausa/recarga recuperó Q5, explicación y nota, conservando la práctica anterior14/14 por separado. Las tres respuestas correctas de selección única aparecieron primero: se registra el límite de la muestra, sin certificar nivel personal, pronunciación ni curso completo.

El respaldo POST único pasó copia/GCM/restauración aislada44migraciones/94tablas y limpieza de cuatro recursos locales propios. Se conserva el indicador de igualdad textualfalse por22CHECK reparsed semánticamente iguales. El2026-11-05 se verificaron fuentes/recibos y salud del runtime por lectura, sin nueva inferencia o respaldo. [Evidencia actual](../../../evidence/teacher-material-correction-practice-20261104-r01.json) y [96§30](../../../mvp/96-nodia-teacher-implementation-plan.md#30-corrección-de-ejemplos-y-continuación-de-práctica--2026-11-04). Ficha draft/partial/unregistered/approval:null, sin publicación; apartados siguientes históricos.

## Gemini Teacher: selección calificada en Native R10 — 2026-11-02

La [evidencia técnica](../../../evidence/teacher-gemini-sdk-vm-20261102-r01.json) acredita OAuth personal separado, adopción Native R10/SDK R05 y calificación real de la selección Gemini Agentic persistida exacta: un POST upstream, FINISH DONE, cierre y ambos ACK. Sólo el finish verificado aporta respuesta; texto acompañante no concede herramientas ni reemplaza el resultado. Siete unknown históricos cerrados/ACK permanecen sin replay y sus respuestas descartadas no se reconstruyen.

El mensaje normal admitido por DI y consumido por el mismo Worker real terminó unknown/cerrado/ambos ACK y sin publicación: lifecycle/cli_timeout; SDK reserved, sin terminal ni contador del proveedor. La canary sigue calificada, pero Worker normal no pasó. No repetir el original. No acredita aún recorrido VM completo con plan/material/evaluación/pausa o contenido revisado, ni otras selecciones/modalidades. La muestra API DNS conserva su alcance, sin garantía universal. Compatibilidad chat/recuperación/backup final y V1 abiertos. ADR094 propuesto; ficha draft/partial/unregistered/approval:null, sin publicación. Apartados siguientes históricos.


## Corte histórico de cierre V1 — R07 unknown / R08 local

La [auditoría96 §25](../../../mvp/96-nodia-teacher-implementation-plan.md#25-checklist-de-cierre-v1-por-capa--corte-r07-unknown--r08-local) distingue lo implementado/probado localmente de lo aceptado en VM. Codex acredita calificación y respuesta técnica por Worker; no el recorrido completo del alumno con plan, material y evaluación reales. R07 se adoptó pero Gemini terminó unknown cerrado/ambos ACK; R08 sólo tiene fix de permisos y pruebas locales, sin disponibilidad aceptada. Faltan operación Gemini exacta, recorrido VM/contenido revisado, compatibilidad/recuperación final y consolidación. No se repiten unknowns ni se fabrican notas/progreso. Ficha draft/partial/unregistered/approval:null, sin publicación; cortes inferiores históricos.


## Corte parcial Gemini Teacher — 2026-11-02

[96 §24](../../../mvp/96-nodia-teacher-implementation-plan.md#24-reanudación-gemini-teacher-y-candidato-sdk--2026-11-02) y [ADR094 propuesto](../../../architecture/decisions/ADR-094-teacher-gemini-bounded-sdk-host.md) distinguen OAuth personal R03 completado de disponibilidad de inferencia. Native R06 se adoptó, pero su intento Teacher terminó unknown, cerrado y con ambos ACK, sin calificación ni replay. Su causa no puede reconstruirse desde el detalle terminal perdido.

La corrección propia ANY/finish pasó una prueba local con TLS sintético que respeta el modo, Owner/Host/motor reales, un POST y FINISH DONE. Ese resultado no demuestra la causa del unknown real ni habilita Gemini Teacher. SDK R03 y Native R07 están preparados; la adopción R07, calificación nueva de la selección exacta y generación normal por Worker siguen pendientes en este corte. Guardar/leer contenido Teacher ya existente conserva sus contratos; esta revisión no acredita material, diagnóstico, práctica o final nuevos generados con Gemini. Estado draft/partial/unregistered, approval null, sin publicación. Los apartados inferiores mantienen sus cortes históricos.


## Estado comprobado en VM — 2026-11-01

La [evidencia VM](../../../evidence/teacher-agentic-vm-20261101-r01.json) registra Codex conectado y Teacher verificado por Worker/publisher real con la selección persistida exacta, cierre y ambos ACK; smoke autenticado sin otro mensaje. NodiaAI texto/MCP pasó en Codex y Gemini, alcance independiente. Gemini Teacher sigue bloqueado: init.tools es un inventario global y no se demostró el contexto efectivo sólo finish/cero I/O. Tres borradores técnicos archivados; ambos unknown Gemini conservados sin replay. Respaldo DB POST restaurado; captura privada posterior consistente y copia local GCM verificadas. La ficha permanece draft/partial/unregistered/approval:null; cortes inferiores históricos.


> Implementación local2026-11-01: consultar [recibo](../../../evidence/teacher-local-implementation-20261101-r01.json). La revisión sigue draft/unregistered/approval:null.


# Nodia Teacher — contexto de producto para NodiaAI

## Alcance operativo local — 2026-11-01

La [ampliación de 96 §22](../../../mvp/96-nodia-teacher-implementation-plan.md#22-activación-local-por-operador) y su [recibo de activación](../../../evidence/teacher-local-activation-20261101-r01.json) registran el módulo Teacher asignado únicamente a Oscar, con las 18 asignaciones anteriores y roles intactos. El operador creó un borrador técnico mediante DTOs/casos de uso bajo su sesión real existente, sin crear JWT ni sesiones de autenticación.

Un POST real adicional calificó `teacher-text/1` en la selección API persistida exacta del recibo: resultado completed, cierre local, ACK y elegibilidad confirmados. El borrador técnico se archivó conservando su historial y sin otra generación. API, Client y Worker locales quedaron activos; HTTP público 200 y Teacher anónimo 401 acreditan entrada local y protección. Sigue pendiente el recorrido autenticado en navegador. En ese corte local, Agentic permanecía no calificado y no se operaron servicios de la VM; el estado VM posterior se documenta arriba.

La calificación técnica no acredita calidad pedagógica universal ni crea un curso del usuario. Las pruebas descartables de dominio/UI conservan su alcance anterior y no equivalen a uso real del alumno. Las fichas siguen draft/unregistered/approval:null. Los textos y checklists inferiores conservan su corte histórico; el baseline inicial de tablas/calificaciones vacías no describe esta activación posterior.

## Propósito y alcance

La [propuesta95 R02](../../../mvp/95-studies-adaptive-learning.md) y el [plan de implementación96](../../../mvp/96-nodia-teacher-implementation-plan.md) definen Nodia Teacher como producto general de Estudios. Cada persona crea una sesión de cualquier tema mediante formulario y chat breve; Teacher ofrece jornadas o tópicos, se revisa el plan y se genera material/preguntas progresivamente. Inglés cotidiano y tecnológico es un ejemplo personal, no un módulo ni un curso fijo. Las propuestas técnicas y documentos completos siguen sin aprobación.

La ampliación95 R03 detalla la revisión del borrador, ajustes manuales sin IA y una candidata comparada cuando se pide ayuda a Teacher. Crear guarda la revisión elegida y permite preparar material después. La disponibilidad del proveedor no bloquea guardar una propuesta válida existente; no significa que el material esté listo.

95 R04 amplía el ciclo posterior: preparar o recuperar una única versión/job, guardar el paquete completo antes de mostrar listo, presentar teoría/práctica y una pregunta por paso, separar borrador/envío y conservar pausa/cursor confirmados. Leer y corregir selección sobre material guardado no requiere inferencia; feedback abierto puede quedar pendiente. Ninguna de estas garantías está implementada por documentarla.

95 R05 recoge entrada por «Mis planes», retomar/unidad prevista y acceso directo a final de sección. Usuario confirma **90% o superior** para aprobar esa final. Se propone práctica con feedback inmediato y final con correcciones al entregar el conjunto; si no alcanza el umbral, refuerzo focal y otro intento con variantes. Sección/tópico agrupa unidades; aprobar su final no acredita lectura de toda la teoría, otras secciones o nivel oficial. Los detalles siguen en revisión.

El paquete95 R06/96 R05 y [97](../../../mvp/97-nodia-teacher-technical-contracts.md) concreta esos detalles como diseño V1 para iniciar implementación: datos/constraints, contratos, estados/acciones permitidas, puntuación y límites propios. No son capacidades observadas, cuotas del proveedor o aprobación humana integral.98 es entrega de desarrollo, no un prompt interno ni una fuente que Teacher deba ejecutar. Todas las tareas de producto/pruebas/calificación siguen pendientes.

## Conceptos y relaciones

| Concepto | Significado para el usuario | Relación y fuente |
|---|---|---|
| Sesión Teacher | Contenedor persistente del aprendizaje | Tema, formulario/chat, plan, contenido y progreso; no una auth_session ni conversación NodiaAI,95 §1/3 |
| Tema | Contenido libre que quiere aprender | No requiere módulo por materia ni niveles lingüísticos universales,95 §1–3 |
| Plan | Recorrido hacia objetivos elegidos | Jornadas o tópicos; cantidad de jornadas condicional,95 §3/5 |
| Jornada y clase | Material y punto de continuación | Una clase puede ocupar varias visitas; calendario pendiente, §2/5 |
| Diagnóstico | Evidencia inicial para orientar la ruta | No certifica un nivel global ni habilidades no ejercitadas, §4 |
| Avance y retención | Completar un recorrido y recordar después | Son medidas distintas, §4 |
| Guía/prompt interno | Instrucciones de enseñanza y plantilla versionada | Snapshot por generación, separado del progreso y de permisos,95 §13 |

## Módulos y autoridad

Módulo candidato `nodia_teacher` con ruta confirmada `/nodia-teacher`, aún sin alta ni implementación. Debe aparecer en el selector de URLs para asignarlo mediante el mantenedor. Estudios es una agrupación inicial modificable sin cambiar URL, filesystem o autoridad. Teacher tiene dominio propio, fuera de tools/utils. La [política89](../../../mvp/89-module-access-and-user-data-scope.md) conserva sesión, módulo asignado y ámbito propio para ordinarios; super_admin activo tiene bypass global sin eliminar invariantes ni confirmación. No existe acceso compartido de estudios definido. Compartir infraestructura IA no exige conceder el módulo NodiaAI ni Ajustes IA:96 propone fachada autorizada propia. El chat NodiaAI por sí solo tampoco concede Teacher.95 R07/96 R06 incluyen la migración transversal de rutas y enlaces en BD, conservando IDs, permisos y asignaciones.

## Índice de funcionalidades

La implementación conserva límites parciales por función y evidencia histórica en96. El cierre R02 y el recorrido VM R14/R41 de102§13 se separan por entorno/selección; no implican cierre global de todos los proveedores, eficacia humana o publicación de Teacher. El respaldo/restauración final y la reanudación operativa/UI están comprobados. Revisión/versionado Git editorial pendiente, separado del cierre funcional.

| Función | Ficha relativa | Implementación | Integración NodiaAI | Módulos de destino |
|---|---|---|---|---|
| Sesiones, formulario y chat de definición | [Ficha](features/session-setup-and-planning.md) | Parcial; definición/propuesta/ajuste comprobados en selección VM exacta | Sin registrar | Teacher `/nodia-teacher`, autoridad89/ADR092 |
| Diagnóstico y prueba final de sección | [Ficha](features/diagnostic-and-skip-assessment.md) | Parcial; diagnóstico y final comprobados por alcance VM | Sin registrar | Teacher `/nodia-teacher` |
| Planes y material guardado por jornada/tópico | [Ficha](features/adaptive-plans-and-day-material.md) | Parcial; snapshot y muestra SQL VM revisados; prediction/citas no emitidos | Sin registrar | Teacher `/nodia-teacher` |
| Lecciones, práctica, corrección y refuerzo | [Ficha](features/lessons-practice-and-review.md) | Parcial; práctica12/14 y corrección escrita VM comprobadas | Sin registrar | Teacher `/nodia-teacher` |
| Evidencia por objetivo y recomendaciones | [Ficha](features/learning-evidence-and-recommendations.md) | Parcial E1/E2/E3; evidencia/mapeos/recomendación VM | Sin registrar | Teacher `/nodia-teacher` |
| Repaso espaciado | [Ficha](features/spaced-repetition.md) | Parcial E5; tarjeta/repaso manual VM | Sin registrar | Teacher `/nodia-teacher` |
| Aclaraciones ancladas al material | [Ficha](features/contextual-clarifications.md) | Parcial E6; propósito y ayuda real anclada VM | Sin registrar | Teacher `/nodia-teacher` |
| Fuentes propias y citas | [Ficha](features/learning-sources.md) | Parcial E7a; fuente textual VM; sin cita emitida | Sin registrar | Teacher `/nodia-teacher` |
| Tipos internos de actividad y visuales declarativos | [Ficha](features/activity-types-and-visuals.md) | Parcial E7b/E7c; actividad/visual manual VM | Sin registrar | Teacher `/nodia-teacher` |
| Memoria entre planes y mapa focal | [Ficha](features/concept-memory-and-map.md) | Parcial E8; concepto manual VM; sin equivalencias reutilizadas acreditadas | Sin registrar | Teacher `/nodia-teacher` |

Voz, pronunciación, exportación, uso offline, notificaciones, marketplace y ejecución arbitraria de código no se habilitan. Los archivos propios tienen alcance local parcial E7a de texto/PDF textual pequeño; no se reinterpreta su exclusión en las versiones V1 históricas. Cada modalidad conserva contrato y comprobación propios antes de habilitarse en un entorno real.

## Interpretación de solicitudes que combinan funciones

«Quiero aprender redes» o «Prepárame inglés para explicar problemas técnicos» inicia tema/objetivo. Teacher aclara lo pertinente y ofrece jornadas/tópicos; no exigir duración en un recorrido por tópicos ni asumir nivel. «Retoma mi clase» resuelve sesión, plan y cursor con autoridad; no genera otro material ni da por contestada la pregunta pendiente. «Ya sé este tema» solicita una comprobación, no una aprobación automática.

## Restricciones y pendientes

La [referencia personal de Obsidian resumida en95 §2](../../../mvp/95-studies-adaptive-learning.md#referencia-de-obsidian-contrastada) no importa progreso ni impone sus90unidades o rúbrica.97 define el blueprint de ERD/DTOs y96 su ejecución; la implementación y sus verificaciones concretas se registran en96 y en la evidencia VM; el cierre funcional incluye respaldo/restauración y reanudación operativa/UI comprobados; revisión/versionado Git editorial pendiente; la revisión pedagógica de esta muestra técnica no acredita eficacia humana o calidad universal. La extracción usa ownership real compartido, sin conversaciones ficticias ni herramientas comerciales/nativas. Modelos dinámicos, presupuesto por POST, selección exacta y recuperación sin replay de91/92. Markdown no concede autoridad. V1 conserva contenido/snapshots bajo autoridad de la sesión con archivo reversible, sin purga automática ni DELETE público.

## Evolución y trazabilidad

| Revisión | Cambio funcional | Fuentes/evidencia | Impacto en fichas y catálogo |
|---|---|---|---|
| 1 | Solicitud, aclaraciones personales y propuesta por jornadas | Propuesta95 y ADR089 propuesto; sin evidencia operativa | Tres fichas candidatas; paths para validación; sin capacidades ni bindings nuevos |
| 2 | Nodia Teacher general, formulario/chat y recorridos por jornadas o tópicos; sustituye módulo Inglés | Aclaración del usuario del2026-11-01,95 R02 y96; sin evidencia operativa | Nueva ficha de definición y tres fichas reconciliadas; sin capacidades/bindings nuevos |
| 3 | Ampliación de revisión/ajustes y creación/guardado por solicitud del usuario | 95 R03/96 R02 del2026-11-01; sin evidencia operativa | Definición rev2 y planes rev3; sin cambios de herramientas o publicación |
| 4 | Ampliación de preparación, teoría/quiz y pausa/retorno de la primera unidad | 95 R04/96 R03 del2026-11-01; sin evidencia operativa | Planes rev4 y lecciones rev3; mismas fuentes y sin herramientas/bindings nuevos |
| 5 | Final de sección≥90%, práctica y repetición diferenciadas | Confirmación del umbral y propuesta95 R05/96 R04 del2026-11-01 | Evaluación rev3, lecciones rev4 y planes rev5; sin herramientas, inferencia o publicación |
| 6 | Paquete completo de implementación95..98 y contratos97 | Solicitud final del2026-11-01; blueprint/plan en revisión, sin evidencia operativa | Definición rev3, evaluación rev4, lecciones rev5 y planes rev6; mismas fuentes candidatas, sin herramientas/bindings nuevos |
| 9 | Activación local por operador según 96 §22 y recibo20261101: asignación individual y selección API exacta calificada | Sin herramientas, capacidades o bindings nuevos; ficha candidata | Conserva historial y gates de navegador, Agentic, pedagogía, aprobación y publicación |

### Ambos proveedores Agentic y adopción VM en curso

El usuario solicita ahora Teacher en la VM con Codex y Gemini/Antigravity disponibles. [96 §23](../../../mvp/96-nodia-teacher-implementation-plan.md#23-adopción-vm-y-ambos-proveedores-agentic-en-curso) distingue implementación y disponibilidad real; [ADR093 propuesto](../../../architecture/decisions/ADR-093-teacher-agentic-text-runtimes.md) describe las restricciones nativas. Codex usa un host sobre Core oficial con tools=[]; Antigravity usa sólo `finish` como devolución estructurada, con I/O y herramientas de negocio denegadas. No hay sustitución de Agentic por API key ni calificación por catálogo/login. Cada selección exige inferencia válida, cierre demostrado y ACK nativo sobre su configuración/época exactas. La ampliación permanece parcial: Codex Teacher está verificado; Gemini Teacher sigue bloqueado según el corte superior. La ficha conserva draft/partial/unregistered/approval:null; Teacher no añade herramientas a NodiaAI.

## Incorporación técnica en VM — 2026-11-01

La incorporación técnica en VM añadió el esquema Teacher y ownership neutral mediante cinco migraciones, con filas, IDs, grants y asignaciones anteriores conservados. Los carriles Native están instalados; esto no acredita inferencia Teacher Agentic ni transfiere la calificación API local. El [recibo VM](../../../evidence/teacher-agentic-vm-20261101-r01.json) distingue el estado operativo y los pendientes. Esta ficha conserva draft/unregistered/approval:null, sin aprobación ni publicación.

## Verificación de proceso y plazo autorizado — 2026-11-03

El alcance técnico operativo está comprobado por el recorrido VM: Codex acredita la final directa/refuerzo/material/práctica y conserva elegibilidad actual sin otra generación; Gemini R11 publicó su material real con un POST/FINISH DONE/cierre y ambos ACK. Su muestra revisada incluye cuatro bloques y la primera pregunta de práctica2/2; no se afirma práctica/final Gemini completas. Se conservan los unknown anteriores sin replay y los seis borradores técnicos están archivados por UI.

ClientR03 respeta latest_job_id del Server y el cursor guardado. La UI autenticada verificó recarga del quiz/corrección y bookmark de escritorio/móvil sin nueva inferencia. Chat actual verificó su compatibilidad de forma independiente; no se habilitan herramientas Teacher o escritores comerciales por estos resultados. DB final/restore/GCM y captura privada final/copia/GCM/reanudación pasaron.

La ampliación autorizada300s sólo aplica a learning_packet/assessment_only, con120s en los demás propósitos y menor deadline efectivo; conserva un POST/cero retries/no replay. La revisión pedagógica es una muestra acotada con límites de ejemplos, sin psicometría o garantía universal. La ficha sigue draft/partial/unregistered/approval:null y no se publica por esta entrega.

Fuentes: [evidencia de proceso](../../../evidence/teacher-v1-vm-process-20261103-r01.json), [96 §26](../../../mvp/96-nodia-teacher-implementation-plan.md#26-recorrido-directo-vm--2026-11-03) y [contrato97](../../../mvp/97-nodia-teacher-technical-contracts.md).


### Recorrido Gemini completo y refuerzo focal R05

La práctica real terminó14/14; la primera final20/40 dio refuerzo únicamente al objetivo0/20 y su segunda unidad canónica. Navegar consultó material y guardó el cursor sin generar; preparar fue otra acción. Tras seis bloques/lecturas y práctica14/14, una evaluación nueva conservó cobertura/40p y publicó variantes distintas; el intento2 terminó40/40, verificó sección y dejó la sesión completed. No se sumaron notas ni se usaron ayudas de la aplicación; el recorrido QA no certifica nivel personal.

R05 muestra puntos por recuperar sin umbral por objetivo ni claves, y el histórico no enlaza al plan actual. Conservó foco, borrador, pausa/recarga y destino móvil; un guardado incierto se concilió por receipt sin reenvío manual. Codex conserva elegibilidad actual y su calificación histórica, sin otra generación. Las preguntas/feedback revisados tienen límites DNS y de variación posicional; no se promete eficacia/precisión universal ni calibración. La pista opcional sospechosa se omite sin cambiar rúbrica, pudiendo dejar ayuda no disponible; la causa del primer rechazo histórico no se reconstruye. DB POST/GCM/restore y runtime reanudado pasaron. La captura original falló al reanudar y conserva su estado; auditoría independiente del par cifrado existente, sin recaptura. Ambas copias pasaron GCM íntegro por verificación independiente; el catálogo externo cifrado es un snapshot previo a restaurar timers y no se declara igual al actual. El runtime fresh y la UI final quedaron operativos, sin reclasificar la captura original fallida. [Recorrido27](../../../mvp/96-nodia-teacher-implementation-plan.md#27-recorrido-completo-gemini--continuación-solicitada).

## Alta guiada y estado Agentic — candidato local, 2026-11-12

[96§42](../../../mvp/96-nodia-teacher-implementation-plan.md#42-alta-guiada-selección-visible-y-estado-agentic--candidato-local-2026-11-12) y [funcionalidad revisión30](features/session-setup-and-planning.md#alta-guiada-y-selección-ia-visible--candidato-local-2026-11-12): formulario con ayudas accesibles, idioma validado que conserva etiqueta histórica, selección IA siempre visible al crear y cuatro controles48px responsive. Sin esfuerzos publicados se explica sincronización/guardado administrativo; actualizar conexiones sólo relee catálogo. Se conservan selección exacta/elegibilidad/CAS y bloqueos busy/fetch/envío.

Cabecera Codex distingue snapshot de salud y observación acotada compartida del actor/instancia actuales; desconocido y denegaciones no se convierten en verde. Verificación local: build/lint,382regresiones/51archivos y QA Chromium320/1280 correctos; diagnóstico vivo confirmado: f01/45migraciones,0recibos Agentic y tabla por propósito ausente en [verificación consolidada](../../../mvp/96-nodia-teacher-implementation-plan.md#verificación-local-y-diagnóstico-de-producción--2026-11-13); sin polling, inferencia, despliegue o publicación de este lote. Producto revisión35 draft/partial/unregistered/approval:null; evaluación de impacto visual/explicativo sin nueva herramienta, permiso o aceptación productiva.
