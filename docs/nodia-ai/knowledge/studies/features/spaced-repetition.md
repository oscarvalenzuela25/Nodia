---
{
  "schema_version": 1,
  "document_id": "studies.spaced-repetition",
  "product_id": "studies",
  "kind": "feature",
  "revision": 5,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "QA55/55 R02 conservado para Windows/API key exacta. Continuación VM OpenAI Agentic sobre ServerR14/ClientR41 comprobada: diagnóstico/evidencia, plan/material, ayuda, práctica12/14 y final40/40; respaldo/restauración y reanudación operativa/UI pasados. Las respuestas son del agente de QA, no eficacia humana ni55nuevas pruebas VM. Revisión/versionado Git editorial pendiente; sin master, aprobación o publicación."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Teacher y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/101-nodia-teacher-adaptive-upgrade-plan.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-098-teacher-learning-evidence-and-adaptive-progression.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/95-studies-adaptive-learning.md",
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
      "path": "nodia-server/src/teacher/policies/teacher-enrichment-scheduling.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/teacher/use-case/teacher-enrichment.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/components/AdaptiveWorkspace/ReviewPanel.tsx",
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

## Repaso local con política propia — 2026-11-11

## Recorrido VM por alcance — 2026-11-11

El recorrido VM registró tarjeta/repaso manual con su política propia en el recibo. No se infiere retención, scheduler estadístico, FSRS, generación automática o calidad de aprendizaje a partir de ese registro. [Recibo VM](../../../../evidence/teacher-upgrade-development-vm-20261111-r01.json).

## Cierre vigente del upgrade — 2026-11-11

Los55criterios quedaron verificados para el alcance Windows/API key configurado; [evidencia R02](../../../../evidence/teacher-upgrade-local-20261111-r02.json) y [matriz](../../../../evidence/teacher-upgrade-acceptance-20261111-r02.md) separan pruebas, muestras y límites. No se copian aceptaciones a operación, no hay nueva herramienta/binding y se conservan draft/unregistered/approval:null. Los apartados inferiores son cortes anteriores o detalle funcional no sustituido.

Tarjetas de autoría manual, objetivo opcional, zona IANA y autoevaluación sólo al vencer. Motor teacher-intervals/1 propio, **no FSRS**: rating1 repite en10minutos;2 agenda1día;3/4 usan crecimiento determinista acotado hasta365días a mediodía local. Recibo y revisión evitan aplicar dos veces un rating. No hay generación automática de tarjetas, optimización estadística, notificaciones o retención garantizada. No revoca la verificación histórica de una sección.

Corte histórico de construcción local y QA parcial: las comprobaciones sintéticas y los pendientes registrados entonces se conservan como historia. El cierre R02 y la continuación VM superiores contienen la evidencia posterior; no habilitan herramientas NodiaAI ni implican aprobación o publicación. Contratos en [97](../../../../mvp/97-nodia-teacher-technical-contracts.md), alcance/criterios en [101](../../../../mvp/101-nodia-teacher-adaptive-upgrade-plan.md) y campaña en [102](../../../../mvp/102-nodia-teacher-phased-implementation-and-final-qa.md).


# Repaso espaciado de Teacher — contexto funcional para NodiaAI

> Propuesta del [upgrade101](../../../../mvp/101-nodia-teacher-adaptive-upgrade-plan.md) y [ADR098 propuesto](../../../../architecture/decisions/ADR-098-teacher-learning-evidence-and-adaptive-progression.md); sin implementación, aprobación o publicación de esta capacidad. Las etapas y criterios de aceptación del plan son la fuente canónica.

## Qué resuelve y qué significa

Propone volver a recuperar conocimientos después de una pausa, en vez de confundir un acierto inmediato con retención duradera. E5 amplía el repaso V1 sin calendario de95: no reinterpreta esa versión ni invalida sus verificaciones históricas. Depende de evidencia y condiciones de ayuda disponibles en E1/E3.

El motor de intervalos, su versión y configuración se seleccionarán y probarán antes de implementar. FSRS es una alternativa evaluable; no se adopta automáticamente el port o sus valores predeterminados de LearnHarness. El objetivo estadístico de retención del scheduler y el umbral final ≥90% son reglas diferentes.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Datos faltantes/ambigüedad | Aclaración esperada |
|---|---|---|---|
| «¿Qué conviene repasar hoy?» | Consultar cola propia | Plan y zona horaria si falta contexto | Mostrar vencimientos calculados con la política guardada |
| «Quiero practicar aunque aún no venza» | Práctica voluntaria | Conceptos seleccionados | Explicar si esta modalidad actualiza o no su agenda |
| «No lo recordé después de ver una pista» | Registrar recuperación asistida | Intento y ayuda real | Conservar esa condición; no acreditarla como independiente |
| «Apruébame la sección porque recordé las tarjetas» | Sustituir final | Ninguno | Remitir a la final independiente del contrato97 |

## Operaciones y contratos

| Operación semántica | Clase/efecto | Herramienta y estado real | Endpoint/DTO/caso de uso | Resultado público propuesto |
|---|---|---|---|---|
| Consultar agenda | Lectura | Sin registrar | E5 pendiente | Objetivos/preguntas vencidos y política aplicada |
| Revisar material ya guardado | Lectura y respuesta propia | Sin registrar | E5 pendiente sobre contratos97 | Evidencia de recuperación, sin inferencia por abrir tarjeta |
| Registrar resultado de repaso | Persistencia | Sin registrar | Calendario y recibos por definir | Próximo vencimiento y resultado observado |
| Preparar variantes nuevas | Generación explícita con coste | Sin registrar | Runtime común; propósito/contrato por definir | Paquete versionado; sin generación automática por visita |

## Datos mínimos y resolución de dudas

| Dato/concepto | Obligatorio, condicional u opcional | Significado | Resolución/aclaración |
|---|---|---|---|
| Objetivo, pregunta y versiones | Obligatorios | Qué conocimiento se recupera | No suponer equivalencia entre todas las pistas |
| Momento, zona horaria y día de estudio | Obligatorios al calcular agenda | Vencimientos coherentes | Definir cambios de zona/DST; no usar zona del proceso por accidente |
| Política y estado previo | Obligatorios | Intervalo reproducible | Versionar cambios sin reescribir revisiones anteriores |
| Resultado, ayuda y tipo de valoración | Obligatorios | Desempeño observado frente a autoevaluación | No convertir una autoevaluación en nota formal |

## Reglas, acceso y restricciones

Agenda privada bajo Teacher y política89. No programar notificaciones, automatizaciones, inferencias o calendarios externos en esta etapa. No prometer una retención lograda por configurar el motor. Las tarjetas sirven a recuperación acotada; resolver problemas complejos requiere práctica de transferencia. Una nueva evidencia de olvido recomienda refuerzo, sin revocar una sección aprobada.

Primero se decidirá si el estado de intervalo pertenece al objetivo, a la pregunta o a una capacidad de recuperación específica: compartirlo entre pistas distintas exige evidencia y evita duplicados. No copiar un límite diario, hora de corte o parámetro de otra aplicación como requisito confirmado.

## Filtros e informes

Se propone cola por plan, concepto, vencimiento y estado, con historial y fecha de referencia. Los vencimientos son cálculos del motor guardado, no predicciones de aprendizaje real. Autoevaluaciones, aciertos independientes y asistencia se cuentan separadamente. No existe contrato de informe agregado ni API de agenda por esta documentación.

## Vista previa, confirmación y recuperación

Antes del repaso se muestra alcance y si registrará resultados. Preparar variantes es otra intención con selección y presupuesto explícitos. La aceptación de una valoración se aplica una vez con recibo; una respuesta perdida consulta lo guardado. Pausa/retorno conserva pregunta, versión y estado. Cambiar política no recalifica intentos ni inventa repeticiones para llenar el calendario.

## Integración y evidencia

- [ ] AC de E5: algoritmo/política versionados, calendario, DST y cambios de zona comprobados.
- [ ] Reintento por respuesta perdida no duplica valoración ni modifica dos veces el intervalo.
- [ ] Repaso asistido, voluntario y evaluación formal permanecen diferenciados.
- [ ] Lectura/corrección determinista de contenido existente no consume inferencia.
- [ ] Calidad de tarjetas y transferencia se revisan; no se declara eficacia por tests sintéticos.

E5 y sus dependencias se aceptan conforme [101](../../../../mvp/101-nodia-teacher-adaptive-upgrade-plan.md), sin operación o evidencia nueva en esta ficha.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Herramientas/contexto afectados | Compatibilidad/propuestas pendientes |
|---|---|---|---|
| 1 | Scheduler/recuperación diferida propuestos en E5 | Sin herramienta, notificación o binding | Amplía V1; conserva verificaciones y evidencia originales |
