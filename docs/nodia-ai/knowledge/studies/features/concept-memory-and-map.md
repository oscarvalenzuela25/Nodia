---
{
  "schema_version": 1,
  "document_id": "studies.concept-memory-and-map",
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
      "path": "nodia-client/src/modules/teacher/components/AdaptiveWorkspace/ConceptsPanel.tsx",
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

## Conceptos y equivalencias locales — 2026-11-11

## Recorrido VM por alcance — 2026-11-11

El recorrido VM registró un concepto manual asociado al objetivo y sus metadatos propios. Esto no acredita extracción automática, equivalencias entre planes efectivamente reutilizadas, transferencia de notas o un grafo global validado; se conservan las pruebas/límites R02 de esos alcances. [Recibo VM](../../../../evidence/teacher-upgrade-development-vm-20261111-r01.json).

## Cierre vigente del upgrade — 2026-11-11

Los55criterios quedaron verificados para el alcance Windows/API key configurado; [evidencia R02](../../../../evidence/teacher-upgrade-local-20261111-r02.json) y [matriz](../../../../evidence/teacher-upgrade-acceptance-20261111-r02.md) separan pruebas, muestras y límites. No se copian aceptaciones a operación, no hay nueva herramienta/binding y se conservan draft/unregistered/approval:null. Los apartados inferiores son cortes anteriores o detalle funcional no sustituido.

Conceptos manuales con condiciones y objetivo opcional; equivalencias proposed/accepted/rejected con revisión y reversión entre planes del mismo propietario, sin fusionar por texto ni transferir notas/verificaciones. El contexto puede recuperar evidencia de objetivos relacionados por equivalencias aceptadas, manteniendo procedencia/condiciones y sin interpretación de dominio. La vista focal usa datos declarados y estados distintos; no es extracción automática ni un grafo global validado. Archivo reversible no revoca por sí solo lectura autorizada.

Corte histórico de construcción local y QA parcial: las comprobaciones sintéticas y los pendientes registrados entonces se conservan como historia. El cierre R02 y la continuación VM superiores contienen la evidencia posterior; no habilitan herramientas NodiaAI ni implican aprobación o publicación. Contratos en [97](../../../../mvp/97-nodia-teacher-technical-contracts.md), alcance/criterios en [101](../../../../mvp/101-nodia-teacher-adaptive-upgrade-plan.md) y campaña en [102](../../../../mvp/102-nodia-teacher-phased-implementation-and-final-qa.md).


# Memoria de conceptos y mapa focal de Teacher — contexto funcional para NodiaAI

> Propuesta del [upgrade101](../../../../mvp/101-nodia-teacher-adaptive-upgrade-plan.md) y [ADR098 propuesto](../../../../architecture/decisions/ADR-098-teacher-learning-evidence-and-adaptive-progression.md); sin implementación, aprobación o publicación de esta capacidad. Las etapas y criterios de aceptación del plan son la fuente canónica.

## Qué resuelve y qué significa

E8 propone recuperar ideas ya estudiadas en otros planes propios y mostrar su relación con el objetivo actual. El mapa focal presenta un concepto, sus prerrequisitos y la evidencia pertinente antes de considerar un lienzo global. Depende de identidad/evidencia E1, diagnóstico E2 y práctica E3; la reutilización entre planes requiere correspondencias explícitas y política de relevancia/antigüedad.

Una proposición registrada no es necesariamente verdadera, comprendida o recordada. Las relaciones distinguen prerrequisito, explicación/apoyo y derivación; no convertir proximidad de nombres en equivalencia o implicación lógica. Si varias premisas son necesarias, el mapa no transforma su conjunción en varias pruebas independientes.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Datos faltantes/ambigüedad | Aclaración esperada |
|---|---|---|---|
| «¿Esto se relaciona con lo que estudié antes?» | Buscar conexiones propias | Concepto y planes autorizados | Mostrar relaciones candidatas y procedencia |
| «Usa mi conocimiento de otro plan» | Reutilizar evidencia relevante | Equivalencia/versión y condiciones | Revisar correspondencia; no aprobar la sección nueva |
| «Estos dos conceptos no significan lo mismo» | Corregir equivalencia candidata | Relación concreta | Conservar historial y revisar usos futuros |
| «Completa mi mapa con lo que saben otros usuarios» | Reutilizar datos ajenos | Sin autoridad de esos datos | Rechazar mezcla entre personas o ámbitos |

## Operaciones y contratos

| Operación semántica | Clase/efecto | Herramienta y estado real | Endpoint/DTO/caso de uso | Resultado público propuesto |
|---|---|---|---|---|
| Consultar mapa focal | Lectura privada | Sin registrar | Modelo/proyección E8 pendiente | Relaciones, estados y fuentes explícitas |
| Proponer equivalencia | Análisis candidato; puede consumir IA | Sin registrar | Política/runtime por definir | Correspondencia revisable con motivos y límites |
| Revisar relación | Mutación propia explícita | Sin registrar | Versión/CAS por definir | Nueva relación/revisión sin reescribir historia |
| Reutilizar evidencia | Preparación contextual acotada | Sin registrar | Snapshot E1/E2/E8 por definir | Referencias relevantes, sin transferencia de aprobaciones |

## Datos mínimos y resolución de dudas

| Dato/concepto | Obligatorio, condicional u opcional | Significado | Resolución/aclaración |
|---|---|---|---|
| Conceptos, ámbito y versiones | Obligatorios | Identidad semántica contextual | No unir por etiqueta o similitud textual |
| Relación y procedencia | Obligatorias | Qué conexión se afirma y dónde | Marcar candidata, revisada, contradictoria o desconocida según contrato futuro |
| Evidencia y condiciones de origen | Para reutilización | Fecha, modalidad, ayuda y objetivo observado | Comprobar relevancia; no extrapolar texto a oralidad |
| Equivalencia revisada | Para cruzar planes | Correspondencia explícita | Si falta, mostrar relación posible sin usarla como desempeño demostrado |

## Reglas, acceso y restricciones

Autoridad actual por destino Teacher y política89. El mapa no elude una revocación de acceso ni copia información a otras personas. El archivo reversible no revoca por sí mismo la lectura: los planes archivados conservan consulta/historia conforme97 y la autoridad vigente. Sólo las relaciones pertinentes alimentan contexto; no enviar todo el historial. Contenido, evidencia y verificación se conservan separados y versionados. Aprobar un plan no aprueba otro, y olvidar un concepto no anula una verificación histórica.

La primera implementación propuesta usa relaciones de PostgreSQL y carga por intención. Una base de grafos, embeddings o servicio adicional requerirían medición y decisión propia; no se introducen por la visualización. Cambiar relaciones no puede producir ciclos en los prerrequisitos requeridos del plan aceptado ni modificar su cobertura silenciosamente.

## Filtros e informes

Se propone lectura focal por concepto, plan, tipo de relación y origen, con límites/paginación a definir en E8. El estado visual distingue visitado, comprensión inmediata, aplicación independiente, retención observada y sección verificada. No existe porcentaje de dominio global ni deducción de fortaleza por cantidad de nodos.

## Vista previa, confirmación y recuperación

Mostrar la relación candidata, las fuentes y qué recomendaciones futuras podría afectar. Revisar equivalencia es una acción explícita sobre versión exacta; no reescribe intentos ni recalcula notas. Corregir una relación conserva origen e invalida su uso futuro incompatible mediante el contrato que se defina. Respuesta perdida se concilia por recibo; un resultado tardío no reemplaza una revisión posterior. Abrir el mapa no extrae, audita o genera automáticamente.

## Integración y evidencia

- [ ] AC de E8: identidad, equivalencias, contradicciones y procedencia comprobadas.
- [ ] Reutilización mantiene propietario, relevancia, antigüedad y condiciones de ayuda/modalidad.
- [ ] Mapa focal móvil/accesible y carga acotada medidos por perfil/ruta.
- [ ] Corregir relaciones conserva intentos, verificación y snapshots originales.
- [ ] Datos ausentes permanecen desconocidos; no se atribuye dominio por extracción o visualización.

Aplicar [101](../../../../mvp/101-nodia-teacher-adaptive-upgrade-plan.md) y ADR098 propuesto; el diseño no es implementación, evidencia pedagógica o publicación.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Herramientas/contexto afectados | Compatibilidad/propuestas pendientes |
|---|---|---|---|
| 1 | Memoria privada entre planes y mapa focal propuestos en E8 | Sin herramientas/servicio/base nuevos | Modelo y equivalencias por definir; ninguna aprobación o fusión retroactiva |
