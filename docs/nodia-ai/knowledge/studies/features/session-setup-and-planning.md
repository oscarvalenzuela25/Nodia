---
{
  "schema_version": 1,
  "document_id": "studies.session-setup-and-planning",
  "product_id": "studies",
  "kind": "feature",
  "revision": 30,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "QA55/55 R02 conservado para Windows/API key exacta. Continuación VM OpenAI Agentic sobre ServerR14/ClientR41 comprobada: diagnóstico/evidencia, plan/material, ayuda, práctica12/14 y final40/40; respaldo/restauración y reanudación operativa/UI pasados. Las respuestas son del agente de QA, no eficacia humana ni55nuevas pruebas VM. Revisión/versionado Git editorial pendiente; sin master, aprobación o publicación. Candidato local2026-11-12: formulario guiado, idioma validado conservando etiqueta histórica y selección IA visible/48px con ayuda; catálogo sin esfuerzos explicado sin inventarlos. Cabecera Codex consulta observación acotada compartida, sin polling. Build/lint,382regresiones/51archivos y QA320/1280 correctos; f01productivo tiene0recibos Agentic y carece de tabla por propósito; sin despliegue/inferencia o publicación del lote."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Nodia Teacher y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "nodia-client/src/modules/teacher/components/SetupConversation/SetupConversation.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/components/JobPanel/JobPanel.tsx",
      "kind": "implementation"
    },
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
      "path": "nodia-server/src/teacher/dto/teacher.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/teacher/use-case/execute-teacher-command.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/components/PlanReview/PlanReview.tsx",
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
      "path": "nodia-client/src/modules/teacher/hooks/useSetupDraft.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/pages/TeacherNew/TeacherNew.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/teacher/policies/teacher-setup-draft.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/teacher/policies/teacher-initial-plan.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/providers/AuthSessionProvider.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/providers/hooks/useRetainedSessionView.ts",
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
      "path": "nodia-client/src/modules/teacher/components/SetupConversation/styles.ts",
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
      "path": "nodia-client/src/modules/teacher/pages/Teacher/Teacher.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/teacher/use-case/teacher-session-jobs.ts",
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
      "path": "nodia-server/src/teacher/use-case/teacher-generation-admission.ts",
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
      "docs/evidence/teacher-setup-draft-new-page-20261104-r01.json",
      "docs/evidence/teacher-preparation-ux-20261105-r01.json",
      "docs/evidence/teacher-final-qa-20261105-r01.json",
      "docs/evidence/teacher-chat-ui-20261105-r01.json",
      "docs/evidence/teacher-inline-status-20261105-r01.json",
      "docs/evidence/teacher-message-gap-20261105-r01.json",
      "docs/evidence/teacher-message-gap16-20261105-r01.json",
      "docs/evidence/teacher-model-effort-20261105-r01.json",
      "docs/evidence/teacher-ui-controls-20261106-r01.json",
      "docs/evidence/teacher-study-journey-20261106-r01.json",
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

> Continuidad VM del2026-11-11: ServerR14/ClientR41 adoptados en la VM de development, con autenticación Google normal y recorrido SQL desde la UI comprobados para la selección OpenAI Agentic configurada. Diagnóstico, evidencia por objetivo, propuesta/material, ayuda anclada, práctica y final quedaron registrados; el respaldo final posterior al QA pasó restauración de DB/configuración; la comprobación operativa y recarga de UI tras reanudar servicios pasaron. [Recibo VM](../../../../evidence/teacher-upgrade-development-vm-20261111-r01.json). El cierre55/55 R02 conserva su alcance Windows/API key; este recorrido no representa55pruebas nuevas en VM ni eficacia educativa humana. Sin promoción a master, aprobación documental o publicación. Los cortes inferiores conservan sus fechas.

## Definición y personalización locales — 2026-11-11

## Recorrido VM por alcance — 2026-11-11

La definición y propuesta reales recibieron evidencia/fuentes del snapshot. R41 bloqueó el ajuste IA con selección no lista o borrador low sin guardar, conservando edición manual; cancelar el borrador devolvió medium disponible y permitió el ajuste real. La candidata posterior sólo cambió título y no se activó; objetivos/política y plan aceptado intactos. [Recibo VM](../../../../evidence/teacher-upgrade-development-vm-20261111-r01.json).

## Cierre vigente del upgrade — 2026-11-11

Los55criterios quedaron verificados para el alcance Windows/API key configurado; [evidencia R02](../../../../evidence/teacher-upgrade-local-20261111-r02.json) y [matriz](../../../../evidence/teacher-upgrade-acceptance-20261111-r02.md) separan pruebas, muestras y límites. No se copian aceptaciones a operación, no hay nueva herramienta/binding y se conservan draft/unregistered/approval:null. Los apartados inferiores son cortes anteriores o detalle funcional no sustituido.

Las generaciones de propuesta/ajuste y material reciben snapshot de evidencia/objetivos/revisión y contexto pertinente de fuentes/conceptos. El motivo y el hash quedan guardados al admitir. Diagnóstico omitido o sin banco conserva desconocidos; el plan mantiene revisión y aceptación humana. Las respuestas/interpretaciones nuevas no sobrescriben la candidata ya admitida ni crean un cambio silencioso de objetivos.

Corte histórico de construcción local y QA parcial: las comprobaciones sintéticas y los pendientes registrados entonces se conservan como historia. El cierre R02 y la continuación VM superiores contienen la evidencia posterior; no habilitan herramientas NodiaAI ni implican aprobación o publicación. Contratos en [97](../../../../mvp/97-nodia-teacher-technical-contracts.md), alcance/criterios en [101](../../../../mvp/101-nodia-teacher-adaptive-upgrade-plan.md) y campaña en [102](../../../../mvp/102-nodia-teacher-phased-implementation-and-final-qa.md).


## Upgrade por etapas: definición y personalización — 2026-11-11

El [upgrade101](../../../../mvp/101-nodia-teacher-adaptive-upgrade-plan.md) propone priorizar E1/E2/E3. La base V1 tiene implementación parcial y evidencia histórica por alcance en los cortes inferiores; esos cortes no acreditan el upgrade ni el cierre integral actual. E0 debe reconciliar los gates vigentes de96 antes de habilitar ampliaciones.

E2 conectará diagnóstico y propuesta de plan mediante un snapshot de [evidencia por objetivo](learning-evidence-and-recommendations.md). La base declarada se conserva como declaración; no equivale a conocimiento demostrado. El diagnóstico es opcional y omitirlo deja desconocidos, sin imponer entrevista o certificación universal.

Antes de existir un plan aceptado, el diagnóstico necesita su blueprint propio versionado, dimensiones descriptivas e ítems revisados conforme95§4. La correspondencia posterior con objetivos del plan se registra explícitamente: no por títulos parecidos ni IDs inventados sin significado. La propuesta explica qué observaciones cambian la secuencia o recomiendan apoyo. Conocimiento insuficiente no autoriza al modelo a marcar prerrequisitos verificados.

Modificar objetivos/cobertura continúa produciendo una revisión que el usuario revisa y acepta; ninguna recomendación acepta o reescribe el plan. Los contratos nuevos de E1/E2, sus límites y AC quedan en101/ADR098 propuesto, pendientes de implementación y calificación. No se añaden herramientas o endpoints mediante esta ficha.

## Mis planes durante una generación admitida — 2026-11-06

Tras admitir una generación, «Mis planes» permite volver manualmente al listado sin cancelar el Worker ni volver a enviarla. No se añade redirección automática. El listado proyecta latest_job nullable por sesión: trabajo queued/running más reciente, si existe; en otro caso último por created_at/id DESC. El objeto público sólo contiene job_id/state/purpose, con máximo50IDs ya autorizados por página y un único batch, sin GET por tarjeta ni payloads privados.

Un chip distinto muestra ese trabajo, sin reemplazar draft/active/paused/completed/archived de la sesión. Unknown y retenido por pausa no se presentan como generando; Resultado guardado no equivale a plan aceptado. useTeacherSessions conserva caché por actor/versión/parámetros y consulta GET cada5s sólo para queued/running visibles. No reintroduce skeleton al revalidar. Error conserva tarjetas como último estado confirmado y detiene el sondeo hasta recuperación GET; datos ausentes/legacy no inventan actividad. Desmontar detiene observación y aborta sólo una lectura pendiente, sin comando de cancelación o replay.

El cambio amplía información de lectura, preservando autenticación/módulo/owner existentes, DTOs de mutación, CAS, presupuesto y protocolo de ejecución. ClientR26/ServerR09 adoptados con50pruebas Client/8suites y2Server/1suite, tipos/lint/build correctos; PostgreSQL aisladoR03 pasó5checks. CUA1915/320 verificó recorrido/controles y cuatro tarjetas reales con ready/failed_known, sin generación activa observable o nuevas inferencias. [95§20](../../../../mvp/95-studies-adaptive-learning.md#mis-planes-y-trabajo-en-segundo-plano--ampliación-del-2026-11-06), [96§40](../../../../mvp/96-nodia-teacher-implementation-plan.md#40-recorrido-compacto-y-generación-visible-en-mis-planes--2026-11-06), [contrato97](../../../../mvp/97-nodia-teacher-technical-contracts.md#proyección-de-generación-en-el-listado-teacher--2026-11-06) y [evidencia](../../../../evidence/teacher-study-journey-20261106-r01.json) conservan el alcance. Draft/partial/unregistered/approval:null y bloqueadores anteriores intactos, sin publicación o cierreV1. Cortes inferiores históricos.

## Presentación de controles y carga de definición — 2026-11-06

La revisión R25 adoptada cambia la presentación: título de revisión del plan22px/700 y todos sus botones contained; otros Button Teacher declarados outlined cuando no contained, estados condicionales no seleccionados outlined y paginación outlined. Los reintentos Teacher eligen retryVariant="outlined" en QueryErrorAlert, conservando su default text en consumidores ajenos. Aplicar, guardar, aceptar, navegar y recuperar mantienen su significado, guards y handlers.

El doble padding de objetivos/objetivo se corrige en TextInput reusable: raíz MUI con espaciado y textarea0, conservando una línea/adornos/tipografía, sin un parche exclusivo de Teacher. TeacherLoading usa Boneyard e initialBones sólo para contenido inicial sin datos. La revalidación mantiene contenido/edición y deshabilita los controles pertinentes; no muestra de nuevo skeleton ni pierde borradores, foco o mensajes. Estado vacío/error, reintento, conflicto y recuperación conservan sus contratos.

Evaluación de impacto exclusivamente visual y representación de carga existente; no cambia conceptos, operaciones HTTP, DTOs, persistencia, autorización, selección/elegibilidad exactas o capacidades del contexto. ClientR25 adoptado con83pruebas únicas/12suites, tipos/lint/build y QA visual acotada correctos. PlanReview se acredita por fuente/unidad, sin reabrir el plan personal aceptado. [96§39](../../../../mvp/96-nodia-teacher-implementation-plan.md#39-controles-padding-multilínea-y-carga-inicial-teacher--2026-11-06), [estándar TextInput](../../../../../nodia-client/DESIGN.md#69-padding-único-en-textinput-multilínea--2026-11-06) y [evidencia](../../../../evidence/teacher-ui-controls-20261106-r01.json) separan la verificación local del entorno efectivo. Sin inferencias nuevas acreditadas o cierre V1; bloqueadores anteriores conservados. Draft/partial/unregistered/approval:null, sin publicación; cortes inferiores históricos.

## Modelo e intensidad separados sin cambiar identidades — 2026-11-05

El SelectionPanel Teacher puede agrupar variantes de Gemini Agentic bajo una opción visual y separar intensidad en esfuerzo. Sólo se habilita con provider_key=gemini reportado y modo agentic. `modelOptions.ts` contrasta etiqueta con intensidad final entre paréntesis, una preferencia existente concordante y sufijo exacto de model_id. Exige al menos dos variantes observadas con esfuerzos distintos, sin colisiones de etiqueta/grupo; no interpreta el nombre como soporte, familia real o equivalencia semántica del proveedor. Datos ausentes/ambiguos, grupos unitarios e históricos variante/esfuerzo cruzados conservan las opciones literales. API key y Codex siguen planos.

La opción usa un ID real del catálogo y conserva una relación reversible con sus variantes; no crea un identificador base ejecutable. Leer high/high mantiene exactamente la combinación guardada. Elegir explícitamente otra intensidad selecciona el ID observado correspondiente junto a su effort_id. Elegir un grupo nuevo sin esfuerzo completo no habilita selección/ejecución; puede restaurarse sólo la preferencia persistida exacta y completa del mismo grupo. No cambia defaults ni repara históricos por abrir o revalidar.

El resultado sigue requiriendo elegibilidad de connection_id/mode/model_id/effort_id exactos y Aplicar/guardar por el PATCH/CAS/recibo de sesión. Mientras dirty/no-ready, Enviar e Implementar permanecen bloqueados. Una variante calificada no habilita otra ni transfiere proofs/aceptaciones. Las generaciones e históricos conservan sus identidades; un bloqueo no cambia proveedor, modo o modelo automáticamente.

Evaluación de impacto: es presentación/interacción de selección, no un nuevo runtime o una capacidad IA; se mantiene en esta ficha. No cambia Server, DTOs ejecutables, discovery, SDK/Native, DB, credenciales, presupuesto o inferencias.ClientR24 adoptado con28pruebas focales/2suites, tipos/lint/build y CUA escritorio/320px correctos. [95§20](../../../../mvp/95-studies-adaptive-learning.md#20-comprender-la-definición-y-el-trabajo-en-curso--2026-11-05), [96§38](../../../../mvp/96-nodia-teacher-implementation-plan.md#38-modelo-gemini-e-intensidad-separados-en-teacher--2026-11-05), [contrato97](../../../../mvp/97-nodia-teacher-technical-contracts.md#agrupación-visual-de-variantes-gemini-y-selección-exacta--2026-11-05) y [evidencia](../../../../evidence/teacher-model-effort-20261105-r01.json) separan las capas. Bloqueadores Gemini previos conservados; draft/partial/unregistered/approval:null, sin publicación. Los apartados siguientes son cortes históricos.

## Estado integrado, propuesta y autoría guardada — 2026-11-05

La cabecera «Define tu plan con Nodia Teacher» usa22px/700 y capitalización normal. Debajo se compone el estado del mismo Job mediante chip y control compacto de actualización GET, sin panel independiente «Trabajo de Teacher» en definición. Se conservan el dueño de consulta/polling y callbacks, carga estable, fallos conocidos, unknown y último estado confirmado tras error de lectura. Continuar antes de despacho, solicitar otra generación y consultar el recibo conservan guards/idempotencia; actualizar no reenvía.

«Implementar plan» cambia sólo la etiqueta de la acción que propone. Abre la confirmación contextual existente y solicita la estructura revisable con objetivo e historial enviado; el snapshot/contexto obsoleto bloquea confirmar. No acepta, no prepara material, no inicia el curso ni clausura la conversación. Revisar manualmente, conversar y ajustar preceden a aceptar por revisión/hash. Un resultado fallido conserva la apertura/recuperación conforme al contrato; uno incierto no autoriza replay.

Un mensaje role=user recibido del GET de historial lleva check success al extremo derecho de «Tú», con tooltip/nombre accesible «Mensaje guardado». El backend lee teacher_setup_messages y Client conserva id/role/text; ese origen confirma persistencia del mensaje propio sin inventar marcas de entrega/lectura. El check no aparece en un borrador, aunque esté autoguardado, ni en una burbuja Teacher. Un trabajo de respuesta queued/running/failed_known/unknown no convierte ese check en prueba de respuesta del modelo.

Se oculta el caption normal de éxito bajo el editor. Permanecen pendiente/guardando, error con reintento explícito, validación y conflicto con texto remoto. Autoguardado1500ms, límites4000UTF-16/8192UTF-8, CAS, beforeunload, pausa y limpieza del snapshot enviado se conservan. Una intención incierta sigue bloqueada y se reconcilia por GET antes de otro envío; no guardar prompts/texto en browserstorage ni repetir un resultado desconocido.

Evaluación de impacto: cambia la interpretación visible de persistencia y propuesta, por lo que se actualiza la ficha existente. No agrega operaciones HTTP, herramientas, permisos, proveedores/modalidades o semántica de aceptación; Server/DTOs/runtime IA permanecen. ClientR21 adoptado con73pruebas focales, build/tipos/lint y CUA escritorio/320px, conforme96§35. [95§20](../../../../mvp/95-studies-adaptive-learning.md#20-comprender-la-definición-y-el-trabajo-en-curso--2026-11-05), [contrato97](../../../../mvp/97-nodia-teacher-technical-contracts.md#estado-integrado-y-mensajes-propios-guardados--2026-11-05) y [evidencia](../../../../evidence/teacher-inline-status-20261105-r01.json) registran el alcance y la revisión ClientR21 activa con sus recibos. No acredita inferencia, voz real o cierre V1; bloqueadores anteriores conservados. Draft/partial/unregistered/approval:null, sin publicación. Cortes inferiores históricos.

## Conversación y propuesta confirmada — ClientR19/R20,2026-11-05

La definición usa burbujas Teacher izquierda/birrete y persona derecha, con autoría/orden de lectura explícitos. El editor común MessageComposer aporta texto, dictado y controles44px; Teacher no monta adjuntos, loaders de archivos o catálogos NodiaAI. La selección exacta se compone en el pie mediante SelectionPanel, conservando su PATCH/CAS/recibo. dirty o no-ready bloquean enviar/proponer; una lectura o disponibilidad desconocida no sustituye la combinación guardada. En definición no se duplica otro panel de selección.

La acción normal es el autoguardado privado1500ms con estado confirmado, no un botón Guardar permanente. Tras error hay reintento explícito; el texto/conflicto y la recuperación se conservan. Enviar guarda primero y publica sólo el snapshot reconocido; Proponer no absorbe un borrador sin enviar. Enter envía, Shift+Enter conserva una línea, IME/keyCode229/repeat no envían. Los límites reales son4000unidades UTF-16 y8192bytes UTF-8, independientes. Dictado añade texto revisable y rechaza el resultado completo que supere el límite, sin truncarlo. El reconocimiento puede usar un servicio del navegador; no crea adjuntos ni una llamada IA Teacher. Cancelar, revocar interacción, cambiar scope o desmontar invalida callbacks y libera la captura propia, incluidos permisos/resultados tardíos.

Proponer está en la cabecera junto al tooltip de ayuda y abre una confirmación. El snapshot local liga scope, revisión/selección de sesión, página, IDs del historial y texto; un cambio deshabilita confirmar hasta reabrir. La confirmación usa una sola intención y mantiene datos/recuperación si no se confirma el resultado. Cancelar no genera ni deja la definición cerrada. Una propuesta no equivale a aceptar: la persona todavía puede revisar manualmente, conversar y ajustar antes de aceptar por revisión/hash. El plan aceptado y las revisiones futuras mantienen historia y notas según el dominio existente.

Evaluación de impacto: no es únicamente CSS, porque cambia los controles habituales de borrador, teclado, voz y confirmación; la ficha incorpora esa interacción. No altera conceptos de aprobación del plan, permisos, DTOs, herramientas, selección de proveedor o presupuesto. ClientR19/R20 adoptados con105regresiones focales, build/tipos/lint y CUA escritorio/320px; autoguardado aplazado durante captura y contraste6,288:1. No se grabó micrófono real ni se generó contenido. La evidencia de96§34 separa estas capas; los bloqueadores Gemini R16 no desaparecen por este cambio visual. Draft/partial/unregistered/approval:null, sin publicación. [Regla de producto95§20](../../../../mvp/95-studies-adaptive-learning.md#20-comprender-la-definición-y-el-trabajo-en-curso--2026-11-05) y [contrato97](../../../../mvp/97-nodia-teacher-technical-contracts.md#conversación-de-definición-y-editor-compartido--2026-11-05);96 conserva la evidencia por capa. Los cortes inferiores son históricos.

## QA final R16 con bloqueadores Gemini — 2026-11-05

ClientR16 bloquea Enviar/Proponer/ajustar por queued/running con guard de handler; guardar borrador, edición y pausa permanecen disponibles. Terminal sin publicación refresca sesión una vez, sin bloquear unknown históricos cerrados. Codex verificó propuesta/ajuste aplicado, borrador privado, recarga y archivo/restauración; móvil320px sin overflow. Gemini material/práctica10/10 pasaron, pero dos fallos posteriores impiden declarar cierre completo: escrita120s unknown y reply_framing. SDK causal pendiente; sin ampliar plazo, replay o publicar fichas. Fuente96§32.

[Seguimiento32](../../../../mvp/96-nodia-teacher-implementation-plan.md#32-qa-final-solicitado-y-prevención-de-intenciones-superpuestas--2026-11-05) y [evidencia final](../../../../evidence/teacher-final-qa-20261105-r01.json) separan inferencia real, pruebas locales y pendientes. Los apartados inferiores conservan sus cortes históricos; esta ficha continúa draft/partial/unregistered/approval:null.

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


# Sesiones y definición del plan — contexto funcional para NodiaAI

## Alcance operativo local — 2026-11-01

La [ampliación de 96 §22](../../../../mvp/96-nodia-teacher-implementation-plan.md#22-activación-local-por-operador) y su [recibo de activación](../../../../evidence/teacher-local-activation-20261101-r01.json) registran el módulo Teacher asignado únicamente a Oscar, con las 18 asignaciones anteriores y roles intactos. El operador creó un borrador técnico mediante DTOs/casos de uso bajo su sesión real existente, sin crear JWT ni sesiones de autenticación.

Un POST real adicional calificó `teacher-text/1` en la selección API persistida exacta del recibo: resultado completed, cierre local, ACK y elegibilidad confirmados. El borrador técnico se archivó conservando su historial y sin otra generación. API, Client y Worker locales quedaron activos; HTTP público 200 y Teacher anónimo 401 acreditan entrada local y protección. Sigue pendiente el recorrido autenticado en navegador. En ese corte local, Agentic permanecía no calificado y no se operaron servicios de la VM; el estado VM posterior se documenta arriba.

La creación del borrador por DTOs/casos de uso acredita esa ruta de persistencia y autoridad. No acredita creación desde el formulario, mini chat ni login OAuth en el navegador real. Las fichas siguen draft/unregistered/approval:null. Los textos y checklists inferiores conservan su corte histórico; el baseline inicial de tablas/calificaciones vacías no describe esta activación posterior.

## Qué resuelve y qué significa

El usuario crea una sesión de estudio sobre un tema libre y Teacher concreta su objetivo mediante formulario y chat breve. Ofrece jornadas o tópicos y presenta una propuesta revisable. [Especificación95 R02](../../../../mvp/95-studies-adaptive-learning.md) y [plan96](../../../../mvp/96-nodia-teacher-implementation-plan.md) describen el flujo solicitado y sus contratos candidatos. Inglés no es un módulo obligatorio.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Datos faltantes/ambigüedad | Aclaración esperada |
|---|---|---|---|
| «Quiero aprender redes para entender una API» | Definir tema/objetivo | Base/contexto relevantes | Preguntar sólo lo útil y proponer organización |
| «Prefiero estudiarlo por tópicos» | Elegir recorrido | Unidades/profundidad de la propuesta | No pedir días obligatorios |
| «Organízalo por jornadas» | Distribuir unidades | Cantidad de jornadas | Ofrecer opciones sin prometer dominio por fecha |
| «Crea este plan» | Aceptar propuesta | Revisión/hash exactos y acción autenticada | Mostrar la propuesta y aceptar una sola revisión |
| «Usa mis accesos para modificar un negocio mientras enseñas» | Acción fuera del propósito | No falta información | Rechazar herramientas de negocio; no heredar autoridad del chat |

## Operaciones y contratos

| Operación semántica | Clase/efecto | Herramienta y estado real | Endpoint/DTO/caso de uso | Resultado público |
|---|---|---|---|---|
| Crear/editar borrador | Persistencia propia | No registrada | Candidatos /teacher/sessions en96; sin DTO real | Formulario y revisión, sin inferencia |
| Observar selección | Lectura/observación | No registrada | Fachada Teacher de conexiones/eligibilidad propuesta | Selección exacta y causas, sin secretos |
| Conversar/proponer | Generación con coste y persistencia | No registrada | Mensajes/plan-proposals y jobs candidatos96 | Respuesta, brief, opciones o propuesta |
| Aceptar plan | Cambio persistido | No registrada | Accept de revisión propuesto96 | Plan aceptado; material todavía por preparar |

## Datos mínimos y resolución de dudas

| Dato/concepto | Obligatoriedad propuesta | Significado y fuente | Resolución/aclaración |
|---|---|---|---|
| Tema/objetivo | Necesarios | Formulario95 §13 | No sustituir objetivo con temario fijo |
| Base/contexto/idioma | Opcionales en formulario | Adaptación del plan | Idioma/profundidad se revisan; no inventar nivel |
| Organización | Antes de aceptar | Jornadas o tópicos,95 §3/5 | Teacher propone; usuario elige |
| Cantidad de jornadas | Condicional | Sólo para ese recorrido | No exigir en tópicos |
| Selección IA/revisión/request | Necesarias antes de generar/aceptar | Identidad y coste/recuperación,96 | IDs/versiones reales administrados por Server |

## Reglas, acceso y restricciones

Aplicar89: sesión válida, módulo Teacher candidato y ámbito propio para ordinarios; super_admin conserva bypass global. No conceder módulo de NodiaAI ni Ajustes para usar Teacher. Compartir proveedores exige extraer infraestructura real, no chats/runs ficticios. La lane de planificación no recibe herramientas de negocio o nativas. Texto del usuario/modelo es dato, no permiso ni aceptación del plan.

## Filtros e informes

Listado de sesiones propio, paginado y con estados propuestos; no hay reportes ni consultas combinables implementados. El mini chat no obtiene información de otros productos para completar ejemplos. Fuentes operativas y métricas desconocidas no se inventan.

## Vista previa, confirmación y recuperación

Mostrar tema/objetivo, idioma, organización, tópicos/unidades/prerrequisitos y evaluación antes de crear. La UI Teacher acepta mediante acción directa autenticada sobre la revisión exacta; no confundirla con una propuesta de herramientas del chat NodiaAI. Una futura herramienta de ese chat conservaría sus contratos comunes de confirmación y autorización propios.

[95 R03](../../../../mvp/95-studies-adaptive-learning.md#revisar-y-ajustar-el-plan-r03) detalla los bloques revisables y dos formas de ajuste: editar campos/temario y guardar otra revisión sin inferencia, o pedir a Teacher una candidata vinculada a la revisión actual y comparar lo añadido/quitado/modificado antes de usarla. Conservar el borrador ante fallo, resultado incierto o candidata obsoleta. Excluir un tópico reduce alcance; no acredita dominio ni permite romper prerrequisitos.

Adoptar la candidata es una mutación sin inferencia que valida candidate_id y revisión/hash base esperados en Server, conservando procedencia. No se aplica por copiar sus campos desde Client ni sustituye un borrador posterior sin revisión. Guardar para continuar después no programa una preparación automática.

«Crear plan» guarda localmente la revisión elegida, organización, guía/políticas y referencias de plantillas junto con el vínculo de sesión/cursor y recibo. No llama al proveedor ni depende de su disponibilidad para nuevas generaciones. Propuesta incompleta puede guardarse como borrador, pero aceptar requiere validar su estructura. Tras éxito se elige preparar la primera unidad o continuar después; error en preparación no revierte el plan. No añadir otro diálogo genérico de confirmación al botón explícito de esta revisión.

Guardar mensaje/propuesta y recibo idempotente antes de continuar. Error conserva formulario, conversación y selección. Dos pestañas producen conflicto de revisión; respuesta perdida consulta request/job sin reenviar generación. Crear el plan y preparar material son operaciones distintas: fallo de preparación no elimina el plan. Prompts internos conservan plantilla/variables/versiones, sin reemplazar datos del plan o progreso. Garantías pendientes de implementación y pruebas.

El [blueprint97](../../../../mvp/97-nodia-teacher-technical-contracts.md) fija límites/defaults propios del formulario, rutas privadas/listado, DTOs/errores, revisiones y allowed_actions del Server. Se implementan conforme a96, sin preguntar otra vez decisiones rutinarias. Son contratos de diseño, no endpoints disponibles. No enviar98 ni sus instrucciones de desarrollo al mini chat de Teacher.

## Integración y evidencia

- [x] Aclaración y flujo de95/96 trazados, con propuestas y hechos separados.
- [x] Diseño de contratos/ERD y fachada Teacher concretado en97; implementación y comprobación reales pendientes.
- [ ] Infraestructura compartida con ownership/lanes y regresión del chat comprobada.
- [ ] Formulario/chat/opciones/aceptación y concurrencia/recuperación comprobados.
- [ ] Cualificación real por selección y calidad del plan comprobadas.
- [ ] Integración/publicación autorizadas, sin publicar borradores.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Herramientas/contexto afectados | Compatibilidad/propuestas pendientes |
|---|---|---|---|
| 1 | Solicitud genérica R02 del2026-11-01 y96 | Nueva ficha candidata; sin herramientas | No heredar identidad, retención, módulo ni capacidades de la conversación NodiaAI |
| 2 | Revisión/ajuste y creación/guardado ampliados en95 R03/96 R02 | Sin herramientas actuales | Nuevos contratos candidatos de edición/diff; aceptación local separada de inferencia, sin publicar |
| 3 | Datos/DTOs/estados/defaults concretados en97 y entrega de96/98 | Sin herramientas actuales | Materialización/verificación pendientes; blueprint no concede permisos ni publica la función |
| 5 | Activación local por operador según 96 §22 y recibo20261101: asignación individual y selección API exacta calificada | Sin herramientas, capacidades o bindings nuevos; ficha candidata | Conserva historial y gates de navegador, Agentic, pedagogía, aprobación y publicación |

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


## Mensaje privado y nueva sesión en página — 2026-11-04

El mensaje de definición aún no enviado se guarda en Server con revisión propia, sin cambiar la revisión de sesión ni generar contenido. Autoguardado confirmado y pausa atómica permiten recuperarlo al recargar. Un conflicto o resultado incierto conserva la edición local y exige revisar/consultar el recibo original, sin reenviar. La recarga antes del guardado confirmado recibe aviso; no se garantiza funcionamiento offline. Enviar sólo limpia la versión correspondiente.

Nueva sesión abre /nodia-teacher/new con los mismos campos/validaciones que la edición, selección explícita y autoridad del módulo canónico Teacher. Crear plan confirma sesión y trabajo en cola en una sola transacción; el plan continúa sujeto a revisión/aceptación humana. Guardar borrador no exige disponibilidad IA y no infiere. Ningún texto del borrador se persiste en storage del navegador ni se incluye como contexto antes de enviarlo. [Reglas29](../../../../mvp/96-nodia-teacher-implementation-plan.md#29-mensaje-persistente-y-alta-en-página--2026-11-04).


### Continuidad y QA VM R07/R13

El corte siguiente es histórico. La definición y preparación revisadas el2026-11-05 se registran en [96§31](../../../../mvp/96-nodia-teacher-implementation-plan.md#31-definición-clara-y-estado-de-preparación-estable--2026-11-05): tres acciones explicadas, borrador no enviado excluido del plan y progreso estable durante sondeo. La comprobación de disponibilidad no reserva capacidad futura; Teacher espera sólo una observación real dentro de sus plazos, sin desplazar ejecuciones/login o cuarentena. No hay envío implícito de mensajes ni reintento de inferencia incierta.

La renovación del mismo actor ya validado conserva el formulario y la operación en vuelo montados e inertes; las nuevas mutaciones esperan a la sesión activa. Recuperación inicial, ausencia de identidad/credencial, cambio de actor/versión, logout o revocación no heredan la vista anterior. El usuario autorizó300s también para definición/propuesta/ajuste del plan; feedback escrito conserva120s y material/evaluaciones300s, con un único envío por trabajo y sin extender/repetir el original incierto.

La QA de Inglés obtuvo plan7secciones/20unidades, revisión manual2 aceptada y primera unidad4bloques; pausa/recarga recuperaron lectura y pregunta1 de práctica sin respuestas ni notas. La muestra tiene pendientes de redacción/contenido descritos en [96§29](../../../../mvp/96-nodia-teacher-implementation-plan.md#29-mensaje-persistente-y-alta-en-página--2026-11-04). No acredita pronunciación, nivel personal, curso completo ni calidad universal; continúa draft/partial/unregistered/approval:null.

## Evaluación exclusivamente visual: separación de mensajes — 2026-11-05

En el corte histórico R22, el ajuste de8px entre mensajes adyacentes no cambia conceptos, operaciones ni interpretación de resultados del contexto Teacher. Aplica theme.spacing(1) a article + article dentro del historial; el gap anterior no alcanzaba las filas porque Skeleton añade un contenedor block. No modifica DTOs, consultas, callbacks, borradores, check de persistencia, modelo o inferencia, ni habilita herramientas o publica esta ficha. No introduce un breakpoint: la misma separación corresponde a escritorio y móvil. [96§36](../../../../mvp/96-nodia-teacher-implementation-plan.md#36-separación-real-entre-mensajes-del-chat--2026-11-05) y [evidencia](../../../../evidence/teacher-message-gap-20261105-r01.json) registran la geometría comprobada y la adopción, separadas de esta regla visual.

Comprobación de esa evaluación visual: ClientR22 activo,0→8px medidos entre filas/burbujas en escritorio y320px; sin overflow móvil,17regresiones existentes y tipos/lint/build correctos. Borrador/contador conservados, sin nueva inferencia. La aprobación/publicación documental y los bloqueadores Gemini anteriores permanecen intactos.

## Preferencia visual posterior:16px — 2026-11-05

La solicitud posterior cambia el espacio vigente entre mensajes de8px a16px mediante theme.spacing(2) en el mismo selector local. La evaluación y medición de8px anterior conserva su corte R22 histórico. Sigue siendo exclusivamente visual: no afecta conceptos, operaciones o interpretación del contexto, y no modifica borradores, persistencia, consulta, autorización o proveedor. [96§37](../../../../mvp/96-nodia-teacher-implementation-plan.md#37-separación-de-mensajes-ampliada-a16px--2026-11-05) y [evidencia de16px](../../../../evidence/teacher-message-gap16-20261105-r01.json) separan adopción y geometría; sin nuevas herramientas, aprobación o publicación.

Verificación de la preferencia posterior: ClientR23 activo;8→16px entre filas/burbujas en1088×892 y320×892, sin overflow móvil, borrador o contador alterados.17regresiones existentes y tipos/lint/build correctos. Sin nuevas inferencias o publicación.

## Alta guiada y selección IA visible — candidato local, 2026-11-12

El formulario incorpora introducción, cuadrícula responsive y ayudas ES/EN por campo mediante botón44px con tooltip descriptivo y foco de teclado. El idioma usa etiquetas válidas para Server: Client recorta y valida2–35 caracteres y `^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$`. Presenta12 idiomas; conserva una etiqueta persistida no listada, incluida regional, hasta que la persona elija otra. No promete calidad/capacidad del proveedor ni modifica el idioma de los menús.

En creación, Selección IA se muestra siempre como sección semántica, sin plegado, con ayuda en conexión/modo/modelo/intensidad. Los cuatro selectores tienen48px locales con/sin valor/limpiar; dos columnas desde600px, una debajo. Los controles compartidos fuera de Teacher conservan sus estilos. La marca Teacher evita recorte usando line-height normal.

| Situación | Interpretación y respuesta segura |
|---|---|
| «No puedo elegir intensidad» | Distinguir consulta/guardado en vuelo de catálogo sin esfuerzos. Mantener busy/fetch disabled; sin opciones, explicar ausencia y no fabricarlas. |
| «Actualiza los niveles de Codex» | Teacher sólo vuelve a leer catálogo persistido. Un administrador debe sincronizar modelos en Ajustes IA, guardarlos y luego actualizar conexiones en Teacher. No conceder el módulo administrativo por esta solicitud. |
| «El modelo aparece, pero no puedo generar» | Catálogo/preferencia no acredita elegibilidad. Se verifica la tupla exacta y su época/cualificación; otra variante no transfiere su aprobación técnica. |
| «Quiero explicaciones en otra lengua» | Elegir etiqueta válida; conservar el valor histórico hasta elección explícita. El locale de la interfaz y la calidad del proveedor son independientes. |

Se conserva la elección de esfuerzos reportados incluso si la combinación anterior es inelegible cuando no hay peticiones en vuelo. Guardar/enviar siguen dependiendo de ready y respuesta para conexión/modo/modelo/esfuerzo exactos, con CAS/recibo existentes; sin defaults nuevos ni cambio de presupuestos. Actualizar conexiones no sincroniza modelos, autentica, infiere o escribe configuración automáticamente.

La cabecera incorpora observación acotada compartida de cuenta Codex para complementar el snapshot de salud, aislada por instancia predeterminada activa y sesión actual. Desconocido/error/ausencia no son disponibilidad; denegación explícita de uso/sesión se conserva. No añade polling, login o inferencia.

Evaluación de impacto: ayudas, presentación y explicación del estado sobre operaciones existentes, sin nuevas herramientas o permisos. Implementación local comprobada: build/lint,382regresiones/51archivos y QA Chromium320/1280 correctos; diagnóstico vivo confirmado: f01/45migraciones,0recibos Agentic y tabla por propósito ausente; [96§42](../../../../mvp/96-nodia-teacher-implementation-plan.md#42-alta-guiada-selección-visible-y-estado-agentic--candidato-local-2026-11-12), [contrato97](../../../../mvp/97-nodia-teacher-technical-contracts.md#alta-teacher-y-selección-explícita--contrato-client-candidato-2026-11-12) y [verificación consolidada](../../../../mvp/96-nodia-teacher-implementation-plan.md#verificación-local-y-diagnóstico-de-producción--2026-11-13). Revisión30 draft/partial/unregistered/approval:null; no despliegue, inferencia real o aceptación productiva por este lote. Las fuentes aprobadas y gates anteriores siguen intactos.
