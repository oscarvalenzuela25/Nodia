---
{
  "schema_version": 1,
  "document_id": "studies.activity-types-and-visuals",
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
      "path": "nodia-server/src/teacher/policies/teacher-enrichment-activities.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/teacher/use-case/teacher-enrichment.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/components/AdaptiveWorkspace/ActivitiesPanel.tsx",
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

## Actividades y visuales locales — 2026-11-11

## Recorrido VM por alcance — 2026-11-11

El recorrido VM registró actividad y visual declarativo manuales de QA. Su autoría conserva asistencia y no acredita ejecución arbitraria, nuevos renderers, corrección independiente ni transferencia humana; los límites de los tipos y visuales permanecen. [Recibo VM](../../../../evidence/teacher-upgrade-development-vm-20261111-r01.json).

## Cierre vigente del upgrade — 2026-11-11

Los55criterios quedaron verificados para el alcance Windows/API key configurado; [evidencia R02](../../../../evidence/teacher-upgrade-local-20261111-r02.json) y [matriz](../../../../evidence/teacher-upgrade-acceptance-20261111-r02.md) separan pruebas, muestras y límites. No se copian aceptaciones a operación, no hay nueva herramienta/binding y se conservan draft/unregistered/approval:null. Los apartados inferiores son cortes anteriores o detalle funcional no sustituido.

Registro interno de ordering/classification/error_location/completion con autoría manual y esquema/solución validados. Como el autor conoce la solución, la observación siempre es assisted=true, independent=false y grants_verification=false. No se presenta esta corrección como prueba independiente o transferencia acreditada. Visuales declarativos limitados a bar_chart/timeline con alternativa textual; no simulaciones arbitrarias, plugins descargables o ejecución HTML/JS/código.

Corte histórico de construcción local y QA parcial: las comprobaciones sintéticas y los pendientes registrados entonces se conservan como historia. El cierre R02 y la continuación VM superiores contienen la evidencia posterior; no habilitan herramientas NodiaAI ni implican aprobación o publicación. Contratos en [97](../../../../mvp/97-nodia-teacher-technical-contracts.md), alcance/criterios en [101](../../../../mvp/101-nodia-teacher-adaptive-upgrade-plan.md) y campaña en [102](../../../../mvp/102-nodia-teacher-phased-implementation-and-final-qa.md).


# Tipos de actividad y visuales declarativos de Teacher — contexto funcional para NodiaAI

> Propuesta del [upgrade101](../../../../mvp/101-nodia-teacher-adaptive-upgrade-plan.md) y [ADR098 propuesto](../../../../architecture/decisions/ADR-098-teacher-learning-evidence-and-adaptive-progression.md); sin implementación, aprobación o publicación de esta capacidad. Las etapas y criterios de aceptación del plan son la fuente canónica.

## Qué resuelve y qué significa

E7b propone ampliar las actividades para ordenar pasos, clasificar ejemplos, encontrar errores o completar estructuras. E7c agrega visuales declarativos cuando aclaren un objetivo: gráficos parametrizados, diagramas o simulaciones de plantillas aprobadas. Se evalúa el comportamiento educativo, no la cantidad de controles.

El contrato separa tipo/versión, consigna, respuesta, corrección, ayuda y representación. Un renderer no decide autoridad ni revela soluciones. E7b depende de evidencia/práctica E1/E3; E7c consume tipos/contratos seguros de E7b. Usar un documento propio añade dependencia E7a, no una carga implícita.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Datos faltantes/ambigüedad | Aclaración esperada |
|---|---|---|---|
| «Quiero ordenar los pasos de este proceso» | Practicar secuencia | Objetivo y actividad disponible | Usar sólo tipos aprobados y preservar respuestas |
| «Muéstrame qué cambia al modificar este parámetro» | Explorar un visual | Plantilla/rango/unidad | Identificar significado y límites de parámetros |
| «Responde sin usar arrastrar y soltar» | Accesibilidad | Ninguno | Ofrecer interacción por teclado/equivalente textual |
| «Ejecuta este script de ejemplo en el servidor» | Ejecución arbitraria | Ninguno | Rechazar; requiere una frontera separada aún no autorizada |

## Operaciones y contratos

| Operación semántica | Clase/efecto | Herramienta y estado real | Endpoint/DTO/caso de uso | Resultado público propuesto |
|---|---|---|---|---|
| Cargar actividad guardada | Lectura | Sin registrar | Esquema discriminado/versionado pendiente en E7b | Tipo compatible y estado real |
| Responder/corregir | Evidencia y feedback | Sin registrar | Validación/corrección Server por definir | Respuesta, ayuda, resultado o pendiente |
| Preparar una actividad nueva | Generación explícita con coste | Sin registrar | Runtime común/contrato por definir | Snapshot apto validado, sin código ejecutable |
| Manipular un visual declarativo | Interacción local; evidencia sólo si se define tarea | Sin registrar | Plantillas y parámetros de E7c pendientes | Representación reproducible y alternativa accesible |

## Datos mínimos y resolución de dudas

| Dato/concepto | Obligatorio, condicional u opcional | Significado | Resolución/aclaración |
|---|---|---|---|
| Tipo y versión soportada | Obligatorios | Interpretación de input/resultado | Histórico no soportado sigue legible; no sustituir tipo silenciosamente |
| Objetivo/consigna/rúbrica privada | Obligatorios al evaluar | Qué se observa y cómo | Fijar antes de responder; no inventar una puntuación |
| Respuesta y ayuda | Condicionales a la tarea | Evidencia real de interacción | Mover un control no acredita aprendizaje |
| Plantilla, parámetros, unidades y rangos | Obligatorios en visuales | Estado reproducible | Validar en Server/cliente según contrato y preservar cero real |

## Reglas, acceso y restricciones

Autoridad Teacher/política89, continuidad y claves privadas97. El registro inicial es interno y aprobado; no descarga plugins ni ejecuta JavaScript/HTML generado, código del alumno, shell o herramientas nativas. El timeout y un directorio temporal no constituyen aislamiento para código arbitrario. Una eventual ejecución requeriría ADR/aislamiento/contratos propios, fuera del alcance inicial.

Mantener teclado, lector de pantalla, alternativa textual, tema Nodia y estados carga/vacío/error. La interfaz no depende sólo de color, precisión de puntero o arrastre. En móvil se conservan consigna, controles, foco y borrador. La permutación de opciones queda fija por intento/IDs; ítems con orden semántico necesitan validación para no cambiar el significado.

## Filtros e informes

Se propone lectura por plan, objetivo, tipo y versión; los límites se concretarán en E7b. No existe métrica general de comprensión a partir de clics/tiempo/exploración. Las observaciones de ejecución o manipulación no equivalen a una nota de corrección. Sólo se agregan actividades con reglas comparables y procedencia explícita.

## Vista previa, confirmación y recuperación

Presentar objetivo, consigna, interacción y condición de ayuda. Las actividades se guardan con snapshot compatible antes de estar listas. Fallos de renderer conservan contenido/consigna legibles y recuperación, sin reenviar generación. Reanudar mantiene versión, orden y parámetros; una nueva versión no modifica un intento activo. La ayuda y la solución respetan práctica frente a final; no exponer claves por un componente nuevo.

## Integración y evidencia

- [ ] AC de E7b: validación de tipo/versión, corrección y compatibilidad histórica comprobadas.
- [ ] AC de E7c: límites/valores/estado del visual reproducibles, sin ejecución arbitraria.
- [ ] Accesibilidad, móvil, foco y recuperación de borradores comprobados por actividad.
- [ ] Errores, tipos desconocidos y resultados tardíos mantienen contenido y autoridad.
- [ ] La calidad pedagógica se revisa con tareas reales; los tests del renderer no la acreditan.

Los AC y decisiones pendientes son los de [101](../../../../mvp/101-nodia-teacher-adaptive-upgrade-plan.md); no hubo implementación en esta entrega documental.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Herramientas/contexto afectados | Compatibilidad/propuestas pendientes |
|---|---|---|---|
| 1 | E7b/E7c: actividades/visuales internos declarativos | Sin herramientas, plugins o ejecución nuevos | Definir esquemas/migración compatible; conservar claves y propósito de evaluación |
