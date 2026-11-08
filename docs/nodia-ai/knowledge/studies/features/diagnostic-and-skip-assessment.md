---
{
  "schema_version": 1,
  "document_id": "studies.diagnostic-and-skip-assessment",
  "product_id": "studies",
  "kind": "feature",
  "revision": 15,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "Recorrido Gemini completo y runtime operativo: práctica14/14 → final20/40 → refuerzo focal unidad2/material/práctica14/14 → nuevo intento40/40, sección verificada/sesión completed. Codex elegible actual/calificaciónNov1 preservada y0generación. R05Client/Server adoptados, Native intacto; foco/borrador/pausa/móvil/recovery y UI final verificados. DB POST/restore y CFGcopias/GCM íntegro pasaron mediante auditoría/reanudación fresh independientes; captura original permanece fallida y catálogo cifrado es snapshot anterior. QA/contenido tienen límites, sin certificación personal, aprobación o publicación."
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
      "path": "nodia-server/src/teacher/policies/teacher-assessment.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/teacher/policies/teacher-cursor.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/teacher/use-case/teacher-pending-closure.ts",
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
    }
  ],
  "verification": {
    "checked_on": "2026-11-03",
    "evidence_paths": [
      "docs/evidence/teacher-local-implementation-20261101-r01.json",
      "docs/evidence/teacher-local-activation-20261101-r01.json",
      "docs/evidence/teacher-agentic-vm-20261101-r01.json",
      "docs/evidence/teacher-gemini-sdk-vm-20261102-r01.json",
      "docs/evidence/teacher-v1-vm-process-20261103-r01.json",
      "docs/evidence/teacher-gemini-journey-20261103-r01.json"
    ],
    "notes": "Recorrido Gemini completo y runtime operativo: práctica14/14 → final20/40 → refuerzo focal unidad2/material/práctica14/14 → nuevo intento40/40, sección verificada/sesión completed. Codex elegible actual/calificaciónNov1 preservada y0generación. R05Client/Server adoptados, Native intacto; foco/borrador/pausa/móvil/recovery y UI final verificados. DB POST/restore y CFGcopias/GCM íntegro pasaron mediante auditoría/reanudación fresh independientes; captura original permanece fallida y catálogo cifrado es snapshot anterior. QA/contenido tienen límites, sin certificación personal, aprobación o publicación."
  },
  "approval": null
}
---

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


# Diagnóstico y prueba final de sección — contexto funcional para NodiaAI

## Alcance operativo local — 2026-11-01

La [ampliación de 96 §22](../../../../mvp/96-nodia-teacher-implementation-plan.md#22-activación-local-por-operador) y su [recibo de activación](../../../../evidence/teacher-local-activation-20261101-r01.json) registran el módulo Teacher asignado únicamente a Oscar, con las 18 asignaciones anteriores y roles intactos. El operador creó un borrador técnico mediante DTOs/casos de uso bajo su sesión real existente, sin crear JWT ni sesiones de autenticación.

Un POST real adicional calificó `teacher-text/1` en la selección API persistida exacta del recibo: resultado completed, cierre local, ACK y elegibilidad confirmados. El borrador técnico se archivó conservando su historial y sin otra generación. API, Client y Worker locales quedaron activos; HTTP público 200 y Teacher anónimo 401 acreditan entrada local y protección. Sigue pendiente el recorrido autenticado en navegador. En ese corte local, Agentic permanecía no calificado y no se operaron servicios de la VM; el estado VM posterior se documenta arriba.

Esta canary no evalúa a un alumno real ni acredita ítems revisados o calidad pedagógica. El umbral final del 90% y los resultados siguen las versiones y reglas del Server, sin deducirse de la calificación del adaptador. Las fichas siguen draft/unregistered/approval:null. Los textos y checklists inferiores conservan su corte histórico; el baseline inicial de tablas/calificaciones vacías no describe esta activación posterior.

## Qué resuelve y qué significa

El usuario solicita una vía para demostrar conocimientos y saltar contenido, y un diagnóstico útil cuando el tema/objetivo lo requiere. [Propuesta95 §4](../../../../mvp/95-studies-adaptive-learning.md#4-diagnóstico-y-avance) y [plan96](../../../../mvp/96-nodia-teacher-implementation-plan.md) sitúan esa opción dentro de sesiones de cualquier tema. Inglés ilustra evidencia por habilidades; no existe un diagnóstico obligatorio universal ni nivel lingüístico para otras materias. Ninguna función está implementada.

[95 R05 §17](../../../../mvp/95-studies-adaptive-learning.md#17-práctica-y-prueba-final-de-sección-r05) concreta esa comprobación como final de sección/tópico, que agrupa unidades. Entrada directa y posterior al estudio conservan cobertura/política y umbral **≥90% confirmado**. La final se prepara independientemente del material de las unidades; aprobar verifica esa sección, sin inventar lectura ni aprobar otras. Feedback tras entregar y reintento con variantes son propuestas, no garantías implementadas.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Datos faltantes/ambigüedad | Aclaración esperada |
|---|---|---|---|
| «Quiero saber por dónde empezar en inglés» | Preparar diagnóstico | Objetivo y modalidades reales | Confirmar alcance escrito u oral disponible |
| «Esto ya me lo sé, quiero saltarlo» | Comprobar una sección | Plan y sección | Resolverlos sin marcar aprobación |
| «¿Qué me falta reforzar?» | Consultar evidencia | Plan si hay más de uno | Mostrar sólo resultados persistidos autorizados |
| «Ponme aprobado sin responder» | Alterar evidencia | No falta información | Rechazar fabricación de aprendizaje; ofrecer comprobación |

## Operaciones y contratos

| Operación semántica | Clase/efecto | Herramienta y estado real | Endpoint/DTO/caso de uso | Resultado público |
|---|---|---|---|---|
| Preparar diagnóstico o final | Preparación | No existe herramienta registrada | Candidatos96, sin endpoint real | Alcance/objetivos/política y trabajo/assessment propios |
| Entregar/corregir final | Escritura de evidencia | No disponible | Candidato sections/:sectionId/attempts y submit de96 | Respuestas congeladas, receipt, corrección o pending; sin claves/puntos antes de entregar |
| Consultar perfil | Lectura | No disponible | PENDIENTE | Habilidades observadas y sin evaluar |

## Datos mínimos y resolución de dudas

| Dato/concepto | Obligatoriedad propuesta | Significado y fuente | Resolución/aclaración |
|---|---|---|---|
| Tema, objetivos y alcance | Necesarios | Qué pretende observar el diagnóstico,95 §4 | No deducir oralidad desde texto |
| Plan/sección | Para desafío | Objetivos que habilitarían el salto | Aclarar cuando haya varias opciones |
| Versión de ítems y rúbrica | Administrada por Server | Intento reproducible | PENDIENTE contrato |

## Reglas, acceso y restricciones

Aplicar [política89](../../../../mvp/89-module-access-and-user-data-scope.md). Módulo de destino pendiente. No asignar A1–C2 por porcentaje de aciertos ni certificar conversación desde un quiz escrito. Omitir diagnóstico deja desconocido. Una pista, solución vista o ausencia de respuesta no es evidencia independiente de dominio. Ítems nuevos generados necesitan revisión y no se presentan como calibrados. El umbral final≥90% está confirmado; no se traslada al diagnóstico ni implica adoptar la rúbrica personal de Obsidian.

## Filtros e informes

No existen filtros ni informes de Estudios registrados. La propuesta distingue resultado de intento, habilidades observadas y cobertura pendiente; no crear porcentajes de confianza o agregados cruzados sin contrato.

## Vista previa, confirmación y recuperación

Una futura preparación identifica tema, sección, cobertura y política aplicable. Las mutaciones desde NodiaAI deben conservar los contratos comunes de propuesta/confirmación; responder en UI es una acción directa del alumno. Guardar la pregunta pendiente y fijar su versión; no revelar clave antes de responder, duplicar corrección por reenvío ni aprobar por fallo del proveedor. Idempotencia, revisión de ítems incorrectos y concurrencia están PENDIENTES de implementación.

En la final, guardar/navegar una pregunta no revela su solución o puntos. «Enviar prueba» congela el conjunto, versiones y denominador con recibo idempotente; después se muestran respuesta real, correcta/alternativas y explicación. Corrección necesaria pendiente no es cero ni un aprobado/reprobado. Comparar nota exacta≥90% sin redondear; omisión incompleta y «No lo sé» explícito son estados distintos. Ítem inválido o explicación ausente requiere estado/revisión propios, no alterar la clave a escondidas.

Resultado completo menor a90%: proponer refuerzo de las brechas y otra final con variantes que mantenga cobertura/política, sin reducirla sólo a errores, sumar notas entre intentos ni repetir literalmente las soluciones vistas. Conservar todo el historial. Recuperar un intento pendiente no es crear un reintento; una respuesta perdida consulta receipt, sin replay. Detalles de feedback/variantes siguen como propuesta en95/96.

El [blueprint97](../../../../mvp/97-nodia-teacher-technical-contracts.md) concreta puntos enteros, rúbrica/denominador, estado del intento y resultado separados, grade_pending/explanation_pending, navegación de final y acciones permitidas por Server. La política V1 fija cantidades y distribución antes de aceptar el plan, sin dejar que el modelo cambie pesos/umbral. Sus defaults son propuestas, no cifras del proveedor ni calificación del usuario. Implementar y verificar conforme aTH-01/06/07/12/13/15; no confundir diseño completo con evaluación ejecutada.

## Integración y evidencia

- [x] Solicitud, propuestas y fuentes documentadas en95.
- [x] Diseño de rúbricas, política y contratos concretado en97; sólo el umbral final tiene confirmación humana explícita.
- [ ] Ítems/contenido revisados y evaluación realmente comprobada.
- [ ] Contratos, autoridad, corrección, cobertura y recuperación comprobados.
- [ ] Herramientas/contexto, confirmación y publicación autorizados.
- [ ] Cualificación real del proveedor/modo y modalidades necesarias.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Herramientas/contexto afectados | Compatibilidad/propuestas pendientes |
|---|---|---|---|
| 1 | Diagnóstico y salto propuestos en95 | Sin herramientas actuales | Fijar versiones; no recalificar intentos históricos silenciosamente |
| 2 | Diagnóstico opcional por objetivo y desafío sobre unidades genéricas de Teacher | Sin herramientas actuales | Jornadas/tópicos comparten evidencia; sin umbral universal ni dependencia de Inglés |
| 3 | Final de sección independiente, umbral≥90% confirmado y propuesta de feedback/reintento de95 R05 | Sin herramientas actuales | Cobertura/puntos fijados, submit conjunto y variantes; no calificar otros ámbitos ni publicar |
| 4 | Política/DTOs/estados de evaluación concretados por97 y plan completo96 | Sin herramientas actuales | Sin puntuación real, aprobación documental integral o publicación |
| 6 | Activación local por operador según 96 §22 y recibo20261101: asignación individual y selección API exacta calificada | Sin herramientas, capacidades o bindings nuevos; ficha candidata | Conserva historial y gates de navegador, Agentic, pedagogía, aprobación y publicación |

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
