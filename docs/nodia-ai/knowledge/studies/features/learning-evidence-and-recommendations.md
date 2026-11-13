---
{
  "schema_version": 1,
  "document_id": "studies.learning-evidence-and-recommendations",
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
      "path": "nodia-server/src/teacher/use-case/teacher-learning-persistence.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/teacher/use-case/teacher-learning.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/teacher/policies/teacher-learning.ts",
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

## Evidencia y recomendaciones locales — 2026-11-11

## Recorrido VM por alcance — 2026-11-11

La UI y el snapshot conservaron diagnóstico2/4, confianza0, asistencia y dos mapeos explícitos. Recomendó refuerzo/discriminación de WHERE y composición de ORDER BY sin inventar dominio. La práctica y la ayuda añadieron evidencia propia sin reescribir respuestas anteriores; passed/assisted=false en la final sigue siendo estado técnico de un intento respondido por el agente. [Recibo VM](../../../../evidence/teacher-upgrade-development-vm-20261111-r01.json).

## Cierre vigente del upgrade — 2026-11-11

Los55criterios quedaron verificados para el alcance Windows/API key configurado; [evidencia R02](../../../../evidence/teacher-upgrade-local-20261111-r02.json) y [matriz](../../../../evidence/teacher-upgrade-acceptance-20261111-r02.md) separan pruebas, muestras y límites. No se copian aceptaciones a operación, no hay nueva herramienta/binding y se conservan draft/unregistered/approval:null. Los apartados inferiores son cortes anteriores o detalle funcional no sustituido.

Evidencia append-only por respuesta/objetivo/estado, explicación y confianza opcionales con CAS antes de enviar; observaciones conservan fecha de respuesta y condiciones de ayuda. Snapshot y recomendaciones por revisión alimentan generación de plan/material. No hay porcentaje global de dominio ni interpretación del razonamiento que pueda cambiar notas.

Corte histórico de construcción local y QA parcial: las comprobaciones sintéticas y los pendientes registrados entonces se conservan como historia. El cierre R02 y la continuación VM superiores contienen la evidencia posterior; no habilitan herramientas NodiaAI ni implican aprobación o publicación. Contratos en [97](../../../../mvp/97-nodia-teacher-technical-contracts.md), alcance/criterios en [101](../../../../mvp/101-nodia-teacher-adaptive-upgrade-plan.md) y campaña en [102](../../../../mvp/102-nodia-teacher-phased-implementation-and-final-qa.md).


# Evidencia por objetivo y recomendaciones de Teacher — contexto funcional para NodiaAI

> Propuesta del [upgrade101](../../../../mvp/101-nodia-teacher-adaptive-upgrade-plan.md) y [ADR098 propuesto](../../../../architecture/decisions/ADR-098-teacher-learning-evidence-and-adaptive-progression.md); sin implementación, aprobación o publicación de esta capacidad. Las etapas y criterios de aceptación del plan son la fuente canónica.

## Qué resuelve y qué significa

Propone que Teacher pueda explicar por qué recomienda una actividad a partir de respuestas reales. Contenido, evidencia del alumno y verificación de sección son modelos distintos: registrar una idea o leerla no demuestra comprenderla. El historial V1 de respuestas no acredita por sí mismo una memoria pedagógica reutilizable.

E1 introduce procedencia por objetivo, explicación del alumno y confianza opcionales; E2 conecta diagnóstico y plan; E3 usa esa evidencia para seleccionar práctica. La recomendación identifica su política y evidencia, sin convertir hipótesis del modelo en calificaciones.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Datos faltantes/ambigüedad | Aclaración esperada |
|---|---|---|---|
| «¿Por qué me recomiendas practicar esto?» | Consultar justificación | Actividad/plan si no hay contexto | Mostrar las observaciones propias que realmente la sustentan |
| «Acerté, pero elegí por descarte» | Aportar explicación opcional | Ocurrencia de respuesta | Guardar declaración asociada sin alterar silenciosamente una nota |
| «No quiero indicar mi confianza» | Omitir dato opcional | Ninguno | Conservar `null`; no fabricar un valor inicial |
| «Muéstrame las dificultades de otra persona» | Consultar datos ajenos | Autoridad insuficiente | Aplicar política89; no usar otras sesiones como ejemplos |

## Operaciones y contratos

| Operación semántica | Clase/efecto | Herramienta y estado real | Endpoint/DTO/caso de uso | Resultado público propuesto |
|---|---|---|---|---|
| Registrar observación | Persistencia de evidencia propia | Sin herramienta NodiaAI registrada | Modelo/DTO nuevos pendientes en E1 | Referencia a respuesta, objetivo, versión, condiciones y estado |
| Consultar evidencia pertinente | Lectura autorizada | Sin registrar | Proyección por definir; contratos97 conservan V1 | Observaciones y desconocidos, sin claves privadas |
| Ensamblar contexto pedagógico | Preparación interna acotada | Sin herramienta pública | Snapshot por definir en E1/E2 | Motivo público y referencias; contenido privado sólo en Server |
| Proponer siguiente actividad | Recomendación; generar después puede consumir IA | Sin registrar | Política versionada por definir en E3 | Actividad propuesta, razón y alcance, sin ejecución implícita |

La interpretación del modelo puede producir una hipótesis revisable; el servidor controla elegibilidad, asistencia, revisiones y acciones admitidas. No se inventan endpoints, herramientas o informes operativos por esta ficha.

## Datos mínimos y resolución de dudas

| Dato/concepto | Obligatorio, condicional u opcional | Significado | Resolución/aclaración |
|---|---|---|---|
| Propietario/sesión/objetivo y versión | Obligatorios | Procedencia inequívoca | Resolver en Server; no fusionar por título parecido |
| Respuesta/ítem/intento | Obligatorios para desempeño observado | Qué comportamiento se observó | Distinguir observado, declarado, pendiente y desconocido |
| Explicación del alumno | Opcional | Texto aportado voluntariamente | Ausencia no penaliza ni prueba falta de comprensión |
| Confianza declarada | Opcional y explícita | Autopercepción, no probabilidad de dominio | Ausencia `null`; escala/validación versionadas antes de implementar |
| Ayuda y momento de exposición | Condicional | Condiciones de independencia | Registrar ayuda real; no prometer detectar ayuda externa |
| Política, referencias y hash del snapshot | Obligatorios al adaptar | Reproducibilidad de la recomendación | Evidencia tardía genera una recomendación nueva, no reescribe la anterior |

## Reglas, acceso y restricciones

Aplicar módulo Teacher canónico `/nodia-teacher` y ámbito real de política89/ADR092. Los campos nuevos no conceden acceso, no amplían modalidades y no requieren acceso al chat NodiaAI. Evidencia insuficiente o feedback pendiente conserva ese estado; nunca se convierte en cero o aprobado. Una respuesta correcta con ayuda y una independiente son observaciones distintas.

No puntuar estilo, longitud o ausencia de autoexplicación. No deducir una concepción errónea únicamente de confianza alta. Conservar datos y recibos bajo la autoridad y política de sesión Teacher; no copiar la retención del chat ni crear purga. Los snapshots excluyen otras personas, claves, secretos y contextos irrelevantes.

## Filtros e informes

Se propone lectura por sesión, revisión, objetivo, origen y condición de ayuda, con referencias y fecha de observación. Orden, paginación y límites se fijarán en el contrato de E1. No hay reporte transversal registrado ni porcentaje global de dominio. Visitado, comprendido en un check, aplicado independientemente, recordado después y sección verificada se muestran por separado.

## Vista previa, confirmación y recuperación

La siguiente actividad explica su motivo antes de prepararla; leer la recomendación no despacha inferencia. Envíos y borradores conservan identidad, CAS y recibos de97. Una respuesta HTTP perdida se concilia sin registrar otra observación; eventos tardíos no alteran el snapshot de una generación ya admitida. Cambiar objetivos/cobertura conserva revisión y aceptación de plan; una recomendación no acepta esa revisión.

## Integración y evidencia

- [ ] E1: procedencia, opcionales ausentes, integridad por objetivo y lectura privada verificadas.
- [ ] E2: snapshot diagnóstico mapeado explícitamente a la propuesta de plan.
- [ ] E3: recomendación explicable reproduce evidencia/política y distingue ayuda de independencia.
- [ ] Conflictos, respuesta perdida y eventos tardíos preservan evidencia sin duplicar ni reenviar inferencia incierta.
- [ ] Calidad, selección IA y publicación comprobadas por separado cuando exista implementación.

Los AC canónicos pertenecen a E1/E2/E3 de [101](../../../../mvp/101-nodia-teacher-adaptive-upgrade-plan.md). Esta ficha no acredita que se hayan ejecutado.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Herramientas/contexto afectados | Compatibilidad/propuestas pendientes |
|---|---|---|---|
| 1 | Propuesta E1/E2/E3 del upgrade101 | Nueva ficha candidata, sin bindings ni herramientas | Contratos/migración por definir; historia V1 sin evidencia nueva permanece desconocida |
