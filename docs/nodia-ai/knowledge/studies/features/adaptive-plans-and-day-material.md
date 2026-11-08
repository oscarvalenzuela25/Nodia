---
{
  "schema_version": 1,
  "document_id": "studies.adaptive-plans-and-day-material",
  "product_id": "studies",
  "kind": "feature",
  "revision": 24,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "ServerR08/ClientR14 adoptados: ejemplos ficticios no sensibles, deletreo completo y nueva versión explícita con confirmación/CAS/recuperación GET. Cinco bloques de Inglés revisados; ejemplo incompleto y referencia a compartir credenciales reemplazados. Práctica nueva14/14 con Gemini escrito6/6 y pausa/recargaQ5; práctica anterior14/14 conservada por separado. Sesgo posicional de la muestra registrado, sin certificación personal, curso completo, aprobación formal o publicación."
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
      "path": "docs/mvp/92-nodia-ai-api-chat-parity.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/teacher/use-case/teacher-plan-persistence.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/teacher/use-case/publish-teacher.use-case.ts",
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
      "path": "nodia-server/src/teacher/policies/teacher-prompts.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/components/NewMaterialVersion/NewMaterialVersion.tsx",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-11-04",
    "evidence_paths": [
      "docs/evidence/teacher-local-implementation-20261101-r01.json",
      "docs/evidence/teacher-local-activation-20261101-r01.json",
      "docs/evidence/teacher-agentic-vm-20261101-r01.json",
      "docs/evidence/teacher-gemini-sdk-vm-20261102-r01.json",
      "docs/evidence/teacher-v1-vm-process-20261103-r01.json",
      "docs/evidence/teacher-gemini-journey-20261103-r01.json",
      "docs/evidence/teacher-setup-draft-new-page-20261104-r01.json"
    ],
    "notes": "ServerR08/ClientR14 incorporan guía de material con ejemplos ficticios no sensibles, deletreo completo y reemplazo explícito por nueva versión con confirmación/CAS/recuperación. La versión anterior y su práctica se conservan; la práctica de QA anterior terminó14/14 con feedback Gemini real. Ver96§30 para la publicación y revisión del paquete nuevo, sin afirmar calidad universal, nivel personal o curso completo. Draft/unregistered/approval:null, sin publicación nueva."
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


# Planes por jornadas o tópicos — contexto funcional para NodiaAI

## Alcance operativo local — 2026-11-01

La [ampliación de 96 §22](../../../../mvp/96-nodia-teacher-implementation-plan.md#22-activación-local-por-operador) y su [recibo de activación](../../../../evidence/teacher-local-activation-20261101-r01.json) registran el módulo Teacher asignado únicamente a Oscar, con las 18 asignaciones anteriores y roles intactos. El operador creó un borrador técnico mediante DTOs/casos de uso bajo su sesión real existente, sin crear JWT ni sesiones de autenticación.

Un POST real adicional calificó `teacher-text/1` en la selección API persistida exacta del recibo: resultado completed, cierre local, ACK y elegibilidad confirmados. El borrador técnico se archivó conservando su historial y sin otra generación. API, Client y Worker locales quedaron activos; HTTP público 200 y Teacher anónimo 401 acreditan entrada local y protección. Sigue pendiente el recorrido autenticado en navegador. En ese corte local, Agentic permanecía no calificado y no se operaron servicios de la VM; el estado VM posterior se documenta arriba.

La generación y recuperación de planes/paquetes en almacenamiento descartable conserva su alcance anterior. La nueva canary no genera un curso del usuario ni marca como listo todo su material. Las fichas siguen draft/unregistered/approval:null. Los textos y checklists inferiores conservan su corte histórico; el baseline inicial de tablas/calificaciones vacías no describe esta activación posterior.

## Qué resuelve y qué significa

El usuario solicita crear sesiones de cualquier tema y elegir jornadas o tópicos con material preparado al avanzar y guardado para retomar. [Propuesta95 R02](../../../../mvp/95-studies-adaptive-learning.md), [plan96](../../../../mvp/96-nodia-teacher-implementation-plan.md) y [ADR089 propuesto R02](../../../../architecture/decisions/ADR-089-versioned-study-plans-and-content.md) organizan las mismas unidades con identidad estable. Guardado en Server, descarga y uso offline son alcances distintos; los dos últimos no están definidos.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Datos faltantes/ambigüedad | Aclaración esperada |
|---|---|---|---|
| «Quiero aprender un tema a mi ritmo» | Proponer plan por tópicos | Objetivo/contexto | No exigir días ni asumir nivel |
| «Quiero inglés cotidiano con situaciones informáticas» | Proponer plan | Preferencia de organización y base | Teacher ofrece jornadas/tópicos; duración sólo si aplica |
| «Prepara el material de hoy» | Preparar paquete | Jornada del plan | Resolver cursor; aclarar si hay varios planes |
| «Pausa y lo sigo después» | Conservar y detener preparación futura | Plan | Conservar material/cursor y conciliar trabajo en vuelo |
| «Hazme todo con cualquier proveedor» | Solicitud costosa sin selección exacta | Alcance, presupuesto y conexión | Exigir selección y revisión; no hacer fallback |

## Operaciones y contratos

| Operación semántica | Clase/efecto | Herramienta y estado real | Endpoint/DTO/caso de uso | Resultado público |
|---|---|---|---|---|
| Crear/replanificar | Preparación y cambio persistido | No registrada | Contratos candidatos96; sin endpoint real | Objetivos, tópicos/unidades, organización y revisión |
| Preparar material | Artefacto con consumo IA | No registrada | PENDIENTE | Paquete y estado real de generación |
| Consultar/retomar | Lectura | No registrada | PENDIENTE | Material existente y cursor autorizado |
| Pausar | Cambio de estado | No registrada | PENDIENTE | Punto conservado; trabajo incierto identificado |

## Datos mínimos y resolución de dudas

| Dato/concepto | Obligatoriedad propuesta | Significado y fuente | Resolución/aclaración |
|---|---|---|---|
| Tema y objetivo | Necesarios para plan | Alcance del recorrido,95 §3/5 | Minutos diarios opcionales |
| Jornadas | Sólo en esa organización | Cantidad elegida tras opciones | No exigir en tópicos; no inferir calendario |
| Selección IA y presupuesto | Antes de inferencia | Proveedor/conexión/modo/modelo/esfuerzo,95 §7 | Modelos dinámicos; sin sustitución silenciosa |
| Material y revisión | Administrados por Server | Contenido ya preparado | Recuperar sin regenerar |
| Guía/plantilla/snapshot | Administrados por Server | Plan estructurado y generación,95 §13 | No son campos de ai_providers ni autoridad |
| Destino del guardado | Si se pide exportación | Nodia frente a Obsidian/archivo | No asumir sincronización |

## Reglas, acceso y restricciones

Sesión, módulo de destino y propiedad según [política89](../../../../mvp/89-module-access-and-user-data-scope.md); módulos pendientes. Un plan de X jornadas no garantiza fluidez en X días. No enviar inferencias al reabrir ni encadenarlas sin límite. Cada POST al proveedor de IA consume presupuesto antes de envío; resultado remoto desconocido conserva recuperación sin replay. Lecturas/progreso no dependen de retención del chat. Solucionarios privados no se incluyen en el paquete previo a evaluación. Retención/archivo/borrado de Estudios deben definirse por separado.

## Filtros e informes

Consulta propuesta por propietario y estado del plan, con paginación y una jornada cargada a la vez. Son requisitos de diseño, sin filtros ni reportes ejecutables. No inventar duración real, coste o porcentaje de preparación desde títulos generados.

## Vista previa, confirmación y recuperación

Mostrar objetivo, número de jornadas, alcance de preparación, selección IA, presupuesto disponible y contenido que cambiaría. Las herramientas futuras del chat deben respetar confirmación humana exacta. Conservar material completado si falla otra jornada; una corrección produce revisión futura. Pausa detiene nuevos envíos, sin afirmar que canceló el proveedor remoto. Reanudar recupera trabajos/resultados antes de considerar otra generación. Contratos y garantías pendientes.

R02: el número de jornadas sólo aparece si corresponde; en tópicos se revisan unidades/orden sin fecha obligatoria. «Crear plan» acepta la revisión exacta; preparar material es un trabajo posterior. Cambiar la vista no regenera ni borra respuestas. Cambiar objetivos/distribución exige revisión futura. La primera generación es una unidad por intención explícita; no una cadena ilimitada.

R03 detalla que se puede guardar una propuesta existente válida aunque el proveedor no esté disponible para preparar nuevas unidades. El resultado es un plan con temario/guías, no un curso ya generado. Ediciones manuales no generan; los ajustes asistidos producen una candidata comparada. El guardado perdido se recupera por recibo sin duplicar; otra revisión ya aceptada produce conflicto y no reemplazo silencioso. Al terminar se ofrece preparar primera unidad o continuar después, sin un envío automático no aceptado.

[R04](../../../../mvp/95-studies-adaptive-learning.md#preparar-la-primera-unidad-y-guardar-su-material-r04) consulta primero material/job de la unidad/revisión/intención y evita preparaciones equivalentes concurrentes. El contexto fija plan, unidad, objetivos, guía/plantilla y evidencia pertinente; no inventa desempeño inicial. learning_packet incluye teoría/ejemplos/práctica y evaluación privada juntos. Validar paquete y vigencia antes de guardar versión, assessment y recibo en una transacción; recibir texto no basta para mostrar listo. El paquete público excluye soluciones, prompts y preguntas futuras del quiz. Reabrir recupera, no regenera.

La pausa guarda continuidad y retiene nuevos dispatches. Uno ya armado puede terminar sin despausar ni encadenar la siguiente unidad; uno todavía no despachado necesita acción explícita para continuar. Al volver se consulta estado/recibo; unknown sigue en conciliación sin replay. Una salida completa pero inválida es error de contenido, no un curso vacío. Material ya listo sigue accesible con Nodia disponible aunque no haya nueva inferencia del proveedor.

R05 precisa que learning_packet contiene el quiz **formativo de unidad**. La final de sección/tópico es un assessment_only independiente: acceso directo no genera teoría de todas las unidades. Fija sección/revisión/objetivos/política y umbral≥90% confirmado, sin cambiarlo por estudiar antes. Reintentar es una nueva intención con variante apta y cobertura prevista; retomar recupera intento/job existente. Una sección verificada no marca todas las lecciones como leídas. La propuesta de feedback de final se muestra tras entregar el conjunto, no por cada respuesta guardada.

El [modelo/contratos97](../../../../mvp/97-nodia-teacher-technical-contracts.md) fija relaciones/versiones, snapshots, deduplicación, DTOs/estados, coordinación común y límites técnicos V1. Su conservación explícita es por sesión con archivo reversible, sin purga automática o DELETE público. Los presupuestos de generación son límites propios, no cuotas/costes del proveedor. El paquete96/98 ordena su implementación; ninguna tabla o job Teacher está disponible por describirlo.

## Integración y evidencia

- [x] Solicitud de material guardado y referencia de Obsidian trazadas en95.
- [x] Diseño V1 de jornadas/tópicos, preparación por unidad, guardado Server y conservación/archivo concretado en97; no aprobación documental integral.
- [ ] Contratos, propiedad, presupuesto y ejecución durable comprobados.
- [ ] Pausa, concurrencia, caída del proveedor y resultado incierto probados sin replay.
- [ ] Herramientas/contexto, confirmación y publicación autorizados.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Herramientas/contexto afectados | Compatibilidad/propuestas pendientes |
|---|---|---|---|
| 1 | Material por jornadas y preparación híbrida propuesta | Sin herramientas actuales | Replanificación no reescribe material/intentos activos ni evidencia histórica |
| 2 | Generalización a sesiones de tema libre, jornadas/tópicos y guías internas según95/96 | Sin herramientas actuales | Sustituye jornadas obligatorias; conserva versiones/historia y autoridad |
| 3 | Revisión/ajuste y creación/guardado detallados en95 R03/96 R02 | Sin herramientas actuales | Guardado independiente de inferencia; edición/candidata versionadas, sin cambiar materiales históricos |
| 4 | Preparación/guardado de primera unidad ampliados en95 R04/96 R03 | Sin herramientas actuales | Paquete único versionado, clave privada, publicación tras commit, continuidad y no replay; sin disponibilidad acreditada |
| 5 | Final de sección desacoplada del material, según95 R05/96 R04 | Sin herramientas actuales | Generación directa de assessment/variantes; preparación sólo por intención; sin nuevos proveedores o capacidades |
| 6 | Blueprint completo de persistencia/contratos/runtime de97 y entrega96/98 | Sin herramientas actuales | Materialización/garantías reales pendientes; conservación V1 explícita, sin publicar |
| 8 | Activación local por operador según 96 §22 y recibo20261101: asignación individual y selección API exacta calificada | Sin herramientas, capacidades o bindings nuevos; ficha candidata | Conserva historial y gates de navegador, Agentic, pedagogía, aprobación y publicación |

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

### Evaluación visual del listado — 2026-11-04

La marca usa la fuente del logo, el título gana peso700, el buscador ocupa media fila desde600px y todo el ancho en móvil, y Mostrar archivados pasa debajo con etiqueta14px. Abrir plan usa contained. Los chips representan los mismos estados del contrato mediante success/completed, info/active, warning/paused, error/archived y neutral/draft, con sus etiquetas y contraste del tema.

El ajuste no cambia conceptos, operaciones, filtros, interpretación de notas, autoridad ni herramientas de NodiaAI; no requiere contexto funcional nuevo ni publicación. Conserva draft/partial/unregistered/approval:null. [Evidencia y límites de verificación](../../../../evidence/teacher-list-ui-20261104-r01.json).

### Evaluación visual del detalle — 2026-11-04

El detalle compacta sus grupos principales a gap8px, muestra el título en negrita y reutiliza la marca y los chips del listado. Actualizar estado incorpora un icono de actualización y conserva su lectura existente. El panel de recorrido adopta su altura natural mediante alineación CSS, sin estirarse con la evaluación; conserva el breakpoint900px y el acordeón móvil.

Son cambios de presentación: no modifican conceptos, operaciones, notas, progreso, consultas, capacidades o autoridad de NodiaAI. La ficha sigue draft/partial/unregistered/approval:null, sin publicación. [Evidencia y alcance](../../../../evidence/teacher-detail-ui-20261104-r01.json).

### Colores de marca y filtro alineado — 2026-11-04

Por ajuste posterior del usuario, listado y detalle muestran el mismo degradado del logo en Nodia Teacher y etiquetas de chips en negrita. Pausar y guardar usa contained. Mostrar archivados vuelve a compartir la fila del buscador desde600px, alineado a la derecha; en móvil conserva una fila propia y el buscador completo. Esta decisión de presentación sustituye la colocación bajo el buscador del corte visual inicial.

La evaluación no altera el contexto funcional: estados, archivo, búsqueda, pausa, notas y autoridad conservan sus contratos. No añade capacidades ni publica la ficha; mantiene draft/partial/unregistered/approval:null. [Evidencia del ajuste](../../../../evidence/teacher-brand-ui-20261104-r01.json).

El ajuste posterior de tamaño usa34px para la marca desde600px y24px en móvil, reutilizando la definición compartida de listado y detalle. Conserva fuente, degradado y contexto funcional sin capacidades, aprobación o publicación nuevas. [Verificación del tamaño](../../../../evidence/teacher-brand-size-20261104-r01.json).


### Selección predeterminada y configuración compacta — 2026-11-04

Teacher conserva la selección de cada sesión. Si aún no existe, precarga únicamente la conexión predeterminada explícita, su modo predeterminado y modelo/esfuerzo guardados; no busca sustitutos. Cuando la selección exacta está completa y elegible, intenta persistirla una vez por el flujo existente, sin inferir. La confirmación permite colapsar el panel con resumen; errores, campos pendientes o cambios locales lo mantienen abierto. La pausa bloquea el guardado y los resultados inciertos conservan recuperación sin replay.

Esta ampliación cambia la preparación de la sesión, no habilita modelos, permisos, herramientas ni disponibilidad por mera configuración. La calificación es por selección/época efectiva: un reinicio de Native puede requerir una prueba nueva sin que eso demuestre pérdida de login. Los botones contained, padding local del formulario y acceso directo a Archivar con confirmación son presentación/ergonomía; notas, contenido y umbral permanecen iguales. La ficha sigue draft/partial/unregistered/approval:null. [Solicitud y reglas28](../../../../mvp/96-nodia-teacher-implementation-plan.md#28-qa-de-selección-predeterminada-y-formulario--2026-11-04), [evidencia y límites](../../../../evidence/teacher-selection-qa-20261104-r01.json).


### Mensaje guardado y creación en página — 2026-11-04

El mensaje de definición aún no enviado dispone de un borrador privado revisionado en Server. Autoguardado confirmado y pausa atómica permiten recuperarlo tras recargar; cambios locales/error/conflicto se distinguen del guardado, y una recarga pendiente recibe aviso. No se almacenan prompts/payloads en el navegador ni se reenvían intenciones inciertas. Enviar limpia sólo la versión correspondiente, conservando otra edición concurrente.

La creación usa /nodia-teacher/new, con autoridad del módulo Teacher, campos completos y selección guardada explícita. Crear plan confirma sesión y trabajo en cola juntos mediante una sola petición; el Worker realiza la generación existente y el plan sigue pendiente de revisión/aceptación humana. Guardar borrador permanece disponible sin disponibilidad IA. El modelo puede proponer la organización/cantidad cuando se solicita, sin defaults inventados. No habilita nuevas herramientas o permisos de NodiaAI; mantiene draft/partial/unregistered/approval:null. [Reglas29](../../../../mvp/96-nodia-teacher-implementation-plan.md#29-mensaje-persistente-y-alta-en-página--2026-11-04).


### Continuidad y QA VM R07/R13

La renovación del mismo actor ya validado conserva el formulario y la operación en vuelo montados e inertes; las nuevas mutaciones esperan a la sesión activa. Recuperación inicial, ausencia de identidad/credencial, cambio de actor/versión, logout o revocación no heredan la vista anterior. El usuario autorizó300s también para definición/propuesta/ajuste del plan; feedback escrito conserva120s y material/evaluaciones300s, con un único envío por trabajo y sin extender/repetir el original incierto.

La QA de Inglés obtuvo plan7secciones/20unidades, revisión manual2 aceptada y primera unidad4bloques; pausa/recarga recuperaron lectura y pregunta1 de práctica sin respuestas ni notas. La muestra tiene pendientes de redacción/contenido descritos en [96§29](../../../../mvp/96-nodia-teacher-implementation-plan.md#29-mensaje-persistente-y-alta-en-página--2026-11-04). No acredita pronunciación, nivel personal, curso completo ni calidad universal; continúa draft/partial/unregistered/approval:null.


### Ejemplos completos y reemplazo explícito — 2026-11-04

Los ejemplos de lenguaje usan identificadores ficticios no sensibles; no recomiendan compartir contraseñas, claves o credenciales. El deletreo conserva cada carácter en orden, incluidos dígitos, símbolos y repeticiones, distinguiendo nombres de letras de pronunciación de palabras. La guía reduce errores de generación, pero no sustituye la revisión del material real ni garantiza calidad universal.

Generar otra versión del material confirma una única solicitud por la ruta existente variant=new. Conserva la versión anterior y sus intentos; no cambia respuestas ni notas anteriores. El contexto y CAS se capturan al abrir y no se rebasean automáticamente. Error/resultado incierto conserva recuperación del recibo original sin reenvío; cerrar explícitamente el diálogo no borra la intención pendiente. Un intento activo se retoma hasta concluirlo normalmente; una evaluación nueva no hereda sus respuestas o puntos. [Reglas y QA30](../../../../mvp/96-nodia-teacher-implementation-plan.md#30-corrección-de-ejemplos-y-continuación-de-práctica--2026-11-04).

QA R08/R14 en VM: cinco bloques nuevos revisados, dev_42/bug-7/tag-3 deletreados completos y sin referencia a compartir credenciales. La práctica nueva concluyó14/14, con Gemini escrito6/6 y pausa/recargaQ5/explicación/nota; la anterior conservó14/14 por separado. Finalizar con feedback pendiente mostró estado pendiente sin nota anticipada. Las tres respuestas correctas de selección única aparecieron primero: límite de esta muestra, sin calibración/garantía universal, pronunciación certificada o curso completo. [Evidencia actual](../../../../evidence/teacher-material-correction-practice-20261104-r01.json).
