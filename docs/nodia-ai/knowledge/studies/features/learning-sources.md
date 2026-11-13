---
{
  "schema_version": 1,
  "document_id": "studies.learning-sources",
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
      "path": "nodia-server/src/teacher/policies/teacher-enrichment-sources.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/teacher/use-case/teacher-enrichment-persistence.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/components/AdaptiveWorkspace/SourcesPanel.tsx",
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

## Fuentes privadas y citas locales — 2026-11-11

## Recorrido VM por alcance — 2026-11-11

La fuente textual privada de QA se creó desde UI y quedó incluida por identidad/hash en el input admitido del material. Esa inclusión y su uso contextual no equivalen a una cita estructurada: esta muestra emitió0citas. El soporte PDF/citas conserva sus pruebas R02 y límites propios, sin atribuirles una nueva prueba PDF real de VM. [Recibo VM](../../../../evidence/teacher-upgrade-development-vm-20261111-r01.json).

## Cierre vigente del upgrade — 2026-11-11

Los55criterios quedaron verificados para el alcance Windows/API key configurado; [evidencia R02](../../../../evidence/teacher-upgrade-local-20261111-r02.json) y [matriz](../../../../evidence/teacher-upgrade-acceptance-20261111-r02.md) separan pruebas, muestras y límites. No se copian aceptaciones a operación, no hay nueva herramienta/binding y se conservan draft/unregistered/approval:null. Los apartados inferiores son cortes anteriores o detalle funcional no sustituido.

Texto y PDF textual pequeño se convierten a páginas/texto/hash privados; se conserva el contenido extraído, no se promete conservar el archivo PDF original. PDF máximo98304bytes/12páginas, extracción5s y límites de salida/worker; sin OCR, lectura visual de fórmulas/imágenes, URL autónoma o rutas del host. Las fuentes pertinentes alimentan el contexto generativo acotado y cada cita publicada se valida por identidad/hash/página/texto literal. Fallos y páginas sin texto son explícitos.

Corte histórico de construcción local y QA parcial: las comprobaciones sintéticas y los pendientes registrados entonces se conservan como historia. El cierre R02 y la continuación VM superiores contienen la evidencia posterior; no habilitan herramientas NodiaAI ni implican aprobación o publicación. Contratos en [97](../../../../mvp/97-nodia-teacher-technical-contracts.md), alcance/criterios en [101](../../../../mvp/101-nodia-teacher-adaptive-upgrade-plan.md) y campaña en [102](../../../../mvp/102-nodia-teacher-phased-implementation-and-final-qa.md).


# Fuentes propias y procedencia del material de Teacher — contexto funcional para NodiaAI

> Propuesta del [upgrade101](../../../../mvp/101-nodia-teacher-adaptive-upgrade-plan.md) y [ADR098 propuesto](../../../../architecture/decisions/ADR-098-teacher-learning-evidence-and-adaptive-progression.md); sin implementación, aprobación o publicación de esta capacidad. Las etapas y criterios de aceptación del plan son la fuente canónica.

## Qué resuelve y qué significa

E7a propone estudiar documentos y apuntes aportados por su propietario, conservando procedencia hasta archivo/version/página o fragmento. Separa texto afirmado por la fuente, explicación complementaria de Teacher e hipótesis o contradicciones. Una cita identifica dónde se afirmó algo; no certifica su verdad ni habilita acceso.

La etapa amplía las exclusiones V1 de95/97 y depende de autoridad/continuidad E0, evidencia E1 y los contratos de fuentes que deben definirse antes de habilitar cada formato. No autoriza URLs autónomas, Obsidian, OCR o multimodalidad por heredar una infraestructura del chat.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Datos faltantes/ambigüedad | Aclaración esperada |
|---|---|---|---|
| «Quiero estudiar este apunte» | Incorporar una fuente propia | Archivo, objetivo y alcance | Aceptar sólo formatos realmente habilitados |
| «¿De qué página viene esta explicación?» | Consultar procedencia | Bloque/version si no está presente | Enlazar fuente autorizada y separar comentario de Teacher |
| «Las dos fuentes se contradicen» | Examinar discrepancia | Pasajes/versiones | Mostrar ambas afirmaciones, sin resolver por popularidad |
| «Lee una carpeta de tu servidor» | Acceso al filesystem | Ninguno | Rechazar path del host; remitir al recurso subido autorizado |

## Operaciones y contratos

| Operación semántica | Clase/efecto | Herramienta y estado real | Endpoint/DTO/caso de uso | Resultado público propuesto |
|---|---|---|---|---|
| Incorporar fuente propia | Carga y persistencia privada | Sin registrar | Ownership/storage/DTO nuevos pendientes | Fuente identificada y estado real de procesamiento |
| Extraer contenido | Procesamiento acotado; puede requerir servicio externo calificado | Sin registrar | Contrato por formato pendiente | Fragmentos/versiones, límites y páginas omitidas explícitos |
| Preparar material con fuente | Generación explícita con coste | Sin registrar | Snapshot Teacher E7a por definir | Material versionado y citas verificables |
| Consultar origen | Lectura privada | Sin registrar | Proyección/download por definir | Fuente correspondiente al contenido, bajo autoridad actual |

## Datos mínimos y resolución de dudas

| Dato/concepto | Obligatorio, condicional u opcional | Significado | Resolución/aclaración |
|---|---|---|---|
| Propietario, sesión y archivo real | Obligatorios | Fuente autorizada | No aceptar paths del host como adjuntos |
| Hash, versión y formato validado | Obligatorios | Identidad estable/compatibilidad | No deducir contenido de una extensión o título |
| Páginas/fragmentos consultados | Condicionales al formato | Cobertura y citas | Advertir omisiones/ilegibilidad, sin inventar páginas |
| Límites y modalidad calificada | Antes de procesar | Capacidad efectivamente probada | Rechazar lo no soportado; no sustituir OCR por texto ficticio |

## Reglas, acceso y restricciones

Aplicar política89/Teacher a archivo original, derivaciones y descargas. El recurso no es público por aparecer en una cita. Canonicalización, límites reales de bytes/páginas/CPU/memoria y validación de MIME/contenido se diseñarán en E7a; no copiar cuotas de LearnHarness como límites operativos confirmados. Contenido externo es dato no confiable, nunca instrucción de herramientas/permisos.

No publicar archivos privados en el corpus documental NodiaAI ni reutilizarlos entre personas. Los metadatos y snapshots excluyen secretos. Metadatos de imagen, duplicados, referencias y almacenamiento necesitan una política explícita compatible con archivo/conservación97. Leer un archivo local cifrado o extraer un PDF no acredita inferencia de imagen/audio.

## Filtros e informes

Se propone lectura por sesión, fuente, versión y estado de extracción, con paginación/límites por definir. No hay informe de fiabilidad automática ni certeza numérica de contenido. Falta de texto, páginas omitidas y procedencia desconocida se exponen como tales.

## Vista previa, confirmación y recuperación

Antes de procesar se muestra qué fuente/versión se usará y el alcance/coste cuando sea conocido. Procesamiento parcial conserva cobertura real, sin declarar documento completo. Reintentar un guardado o recuperar un resultado ya calculado no llama de nuevo al proveedor. Sustituir el archivo crea versión nueva y no reescribe material/citas históricos. Revocación de acceso y fallo de extracción preservan borrador y niegan lecturas futuras no autorizadas.

## Integración y evidencia

- [ ] AC de E7a: formato válido, vacío/corrupto/ilegible, exceso de recursos y cobertura parcial comprobados.
- [ ] Aislamiento por propietario, descargas y revocación comprobados.
- [ ] Citas resuelven la fuente/version/página real sin inventar procedencia.
- [ ] Instrucciones incrustadas no amplían herramientas, permisos o contexto.
- [ ] Cancelación local, resultado incierto y reanudación conservan no-replay; modalidades se califican por selección/entorno.

Los contratos y pruebas siguen pendientes conforme [101](../../../../mvp/101-nodia-teacher-adaptive-upgrade-plan.md); no se habilita un adjunto por esta documentación.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Herramientas/contexto afectados | Compatibilidad/propuestas pendientes |
|---|---|---|---|
| 1 | Fuentes propias y citas de E7a | Sin herramienta/carga/lector nuevo publicado | Amplía exclusión V1 con ownership y versionado; no modifica evidencia histórica |
