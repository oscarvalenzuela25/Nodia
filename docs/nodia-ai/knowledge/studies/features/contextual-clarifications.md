---
{
  "schema_version": 1,
  "document_id": "studies.contextual-clarifications",
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
      "path": "nodia-server/src/teacher/use-case/teacher-enrichment-persistence.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/teacher/use-case/teacher-enrichment.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/components/AdaptiveWorkspace/ClarificationPanel.tsx",
      "kind": "implementation"
    },
    {
      "path": "docs/mvp/102-nodia-teacher-phased-implementation-and-final-qa.md",
      "kind": "specification"
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

## Hilos contextuales locales — 2026-11-11

## Recorrido VM por alcance — 2026-11-11

El propósito contextual_reply se calificó en esta selección VM; R14 completó el probe original sin redispatch conservando ancla/raw/hash. La ayuda posterior real quedó vinculada al mismo bloque y explicó SELECT/FROM/WHERE/ORDER BY correctamente, sin conceder comprensión o nota; la asistencia pertinente quedó registrada. Las claves/finales no se leyeron antes de entregar sus respuestas. [Recibo VM](../../../../evidence/teacher-upgrade-development-vm-20261111-r01.json).

## Cierre vigente del upgrade — 2026-11-11

Los55criterios quedaron verificados para el alcance Windows/API key configurado; [evidencia R02](../../../../evidence/teacher-upgrade-local-20261111-r02.json) y [matriz](../../../../evidence/teacher-upgrade-acceptance-20261111-r02.md) separan pruebas, muestras y límites. No se copian aceptaciones a operación, no hay nueva herramienta/binding y se conservan draft/unregistered/approval:null. Los apartados inferiores son cortes anteriores o detalle funcional no sustituido.

Hilo anclado a versión/bloque/selección exacta, consulta de historia y envío de mensajes por runtime Teacher. contextual_reply devuelve texto estructurado bajo plantilla teacher-text/2; máximo120s y presupuesto/no-replay comunes. Server rechaza el nuevo helper durante finales; publicar vuelve a comprobar ancla/contexto y registra ayuda relevante, nunca comprensión. La implementación y la respuesta real del propósito se comprobaron para la selección VM identificada arriba, sin extender su calificación a otras selecciones.

Corte histórico de construcción local y QA parcial: las comprobaciones sintéticas y los pendientes registrados entonces se conservan como historia. El cierre R02 y la continuación VM superiores contienen la evidencia posterior; no habilitan herramientas NodiaAI ni implican aprobación o publicación. Contratos en [97](../../../../mvp/97-nodia-teacher-technical-contracts.md), alcance/criterios en [101](../../../../mvp/101-nodia-teacher-adaptive-upgrade-plan.md) y campaña en [102](../../../../mvp/102-nodia-teacher-phased-implementation-and-final-qa.md).


# Aclaraciones vinculadas al material de Teacher — contexto funcional para NodiaAI

> Propuesta del [upgrade101](../../../../mvp/101-nodia-teacher-adaptive-upgrade-plan.md) y [ADR098 propuesto](../../../../architecture/decisions/ADR-098-teacher-learning-evidence-and-adaptive-progression.md); sin implementación, aprobación o publicación de esta capacidad. Las etapas y criterios de aceptación del plan son la fuente canónica.

## Qué resuelve y qué significa

E6 propone aclarar una frase o ejemplo sin abandonar la unidad. El hilo pertenece al contenido que lo originó: su versión, bloque y selección exacta. Una explicación recibida cuenta como ayuda vista; no acredita que el alumno haya comprendido o aplicado la idea. Depende de evidencia/asistencia E1 y anclas de contenido existentes; no requiere E3, E4/E5 ni un grafo global. Conserva continuidad del lector y, cuando exista E3, comparte su interpretación de asistencia.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Datos faltantes/ambigüedad | Aclaración esperada |
|---|---|---|---|
| «Explícame esta frase con otro ejemplo» | Aclaración acotada | Fragmento/version si falta selección | Solicitar o conservar el ancla exacta |
| «Vuelve a la duda de la unidad anterior» | Recuperar hilo existente | Hilo si hay varios | Mostrar su referencia original, sin moverla al contenido actual |
| «No entendí qué cambió en el nuevo material» | Comparar contexto | Versiones autorizadas | Aclarar qué versión se consulta; no reemplazar anclas antiguas |
| «Resuelve esta pregunta de la final desde el ayudante» | Ayuda en evaluación | Ninguno | Bloquear el nuevo ayudante por Server durante la final |

## Operaciones y contratos

| Operación semántica | Clase/efecto | Herramienta y estado real | Endpoint/DTO/caso de uso | Resultado público propuesto |
|---|---|---|---|---|
| Consultar hilo guardado | Lectura autorizada | Sin registrar | E6 pendiente | Referencia/version y conversación existente |
| Pedir aclaración | Generación explícita y persistencia con coste | Sin registrar | Propósito Teacher/runtime común por definir | Respuesta atribuida y estado real, sin herramientas de negocio |
| Registrar ayuda expuesta | Evidencia de condiciones | Sin registrar | Modelo E1/E6 pendiente | Qué explicación pudo ver el alumno antes de responder |

## Datos mínimos y resolución de dudas

| Dato/concepto | Obligatorio, condicional u opcional | Significado | Resolución/aclaración |
|---|---|---|---|
| Propietario/sesión/versión/bloque | Obligatorios | Identidad de contenido | Autorizar lectura en Server |
| Selección exacta y contexto mínimo | Condicional al aclarar texto | Qué pasaje originó la duda | Verificar coincidencia; pedir nueva selección si quedó ambigua |
| Pregunta y revisión del hilo | Obligatorias al enviar | Evitar respuesta aplicada al hilo equivocado | Mantener foco/borrador ante error o conflicto |
| Selección IA y presupuesto | Obligatorios para generar | Coste y capacidad realmente disponibles | Sin fallback o generación al abrir el panel |

## Reglas, acceso y restricciones

Aplicar Teacher/política89; sólo material autorizado de esa sesión. El contexto del ayudante se construye desde contenido visible: no incluir claves, soluciones no reveladas, prompts privados u otras sesiones. Que el contexto oculte una clave no impide que el modelo resuelva una pregunta: por eso el nuevo ayudante se bloquea en la final inicial. No modifica el flujo de pistas preaprobadas ya definido por97.

No atribuir inferencias del ayudante al documento original. Si no puede responder con el material, identifica el límite; no inventa citas. Una respuesta parcial o un fallo no se presentan como conclusión guardada. No se envían herramientas, shell, SQL, HTTP arbitrario o datos comerciales.

## Filtros e informes

Se propone lectura de hilos por sesión/ancla y versión, sin informe de dominio o conteo de aprendizaje. Consultar ayuda no aumenta el avance ni la puntuación. Orden, límites y paginación se fijarán en E6; no hay consultas registradas en NodiaAI.

## Vista previa, confirmación y recuperación

El panel muestra el fragmento y su versión antes de enviar. Abrir/cerrar sólo cambia la presentación y conserva borrador/foco; no cancela remotamente un trabajo admitido ni lo repite. Reabrir recupera el mismo hilo y job/recibo. Actualizar material no mueve silenciosamente las conversaciones antiguas. Dos pestañas y resultados tardíos se concilian por identidad/revisión sin sobrescribir otro hilo.

## Integración y evidencia

- [ ] AC de E6: ancla estable, contenido visible y ausencia de claves privadas comprobados.
- [ ] Bloqueo Server del nuevo ayudante durante final y registro de ayuda comprobados.
- [ ] Navegación/recarga/error conserva hilo, borrador y foco; sin inferencia por montaje.
- [ ] Presupuesto por POST y recuperación de `unknown` respetan97, sin replay.
- [ ] Interacción móvil/teclado y coste/calidad se verifican con sus propios alcances.

No se ejecutaron estos criterios. La etapa canónica y sus dependencias están en [101](../../../../mvp/101-nodia-teacher-adaptive-upgrade-plan.md).

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Herramientas/contexto afectados | Compatibilidad/propuestas pendientes |
|---|---|---|---|
| 1 | Aclaraciones ancladas y ayuda propuesta en E6 | Nueva ficha sin herramientas/bindings | Nuevo propósito/contrato pendiente; pistas V1 y claves privadas intactas |
