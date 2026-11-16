---
{
  "schema_version": 1,
  "document_id": "studies.guided-setup-and-study-experience",
  "product_id": "studies",
  "kind": "feature",
  "revision": 5,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "Primera entrega local2026-11-15: wizard3pasos contra DTO actual, resumen/selección conservados, guard salida SPA/recarga y recuperación existente. TUX-03…05 y comprensión humana pendientes; no acredita disponibilidad operativa. Continuación2026-11-16: mockups aceptados y desarrollo autorizado en la misma rama para cabecera/estado/acciones, Drawer adaptativo con Mis fuentes inicial y selector IA horizontal en Popover sin botón +. Implementación y QA sintética local de seis perfiles/continuidad verificadas; suite 3027/364 antes del último ajuste de recuperación y 11 focales posteriores correctos; tipos/lint/build por alcance correctos. Última alineación CSS xs, lint focal y build final correctos; matriz de seis perfiles repetida. No se afirma una segunda global de 3028 casos. No cambia contratos, contexto o herramientas ni acredita inferencia, adopción o aprobación/publicación. Continuación106§13: revisión legible/edición progresiva locales con QA sintética. Global3039/365 previa al guard final y al caso histórico;26focales posteriores y build/lint finales correctos. Sin contratos, contexto o herramientas nuevos; aceptación UX/adopción pendientes. Cierre106§14 (2026-11-16): el usuario confirma que TUX-001 funciona bien y pide cerrarlo. Alta guiada, paneles/selector y revisión legible aceptados por alcance entregado; TUX-03/05 siguen como evolución propuesta separada, no implementada por el cierre. No acredita dispositivos/entornos no descritos, inferencia o despliegue nuevos; no aprueba ni publica esta ficha."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Teacher conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/106-nodia-teacher-guided-ux-redesign.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/97-nodia-teacher-technical-contracts.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/teacher/dto/teacher.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/hooks/useStudySetup.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/components/AdaptiveWorkspace/AdaptiveWorkspace.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/components/SelectionPanel/SelectionPanel.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/components/PlanReview/PlanReview.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/teacher/components/PlanStructureEditor/PlanStructureEditor.tsx",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-11-16",
    "evidence_paths": [
      "docs/evidence/teacher-guided-setup-20261115.md",
      "docs/evidence/teacher-drawer-chat-ui-20261116.md",
      "docs/evidence/teacher-plan-review-20261116/README.md"
    ],
    "notes": "Regresiones de comportamiento y Chromium local con transporte sintético; sin inferencia, UI autenticada/shell real, comprensión humana o adopción VM/producción. Corte2026-11-16: solicitud/mockups y contratos UI contrastados documentalmente; QA sintética local de seis perfiles, foco/borradores y errores comprobados; suite global 3027/364 previa al último ajuste de recuperación y 11 focales posteriores correctos. Tipos/lint/build por alcance correctos; último CSS xs, lint focal y build final correctos, con la matriz de seis perfiles repetida. Sin segunda global de 3028 casos, inferencia o adopción afirmadas; detalle en evidencia propia. Continuación106§13: QA Chromium12perfiles320–1280 ESoscuro/ENclaro, borradores/foco/nodos y503/409 conservados; aceptación ID/hash exactos sin IA. Global3039/365 anterior al guard final !policyValid y al caso histórico;26focales posteriores12,38s, build/lint finales y typecheck previo correctos. UI autenticada, comprensión, teléfono físico/adopción pendientes. Aceptación humana funcional registrada en106§14 por confirmación del usuario el2026-11-16; sustituye el pendiente humano del alcance entregado sin reinterpretar las pruebas sintéticas como sesión/dispositivo real ni inventar mediciones."
  },
  "approval": null
}
---

## Cierre funcional TUX-001 — 2026-11-16

[Plan106§14](../../../../mvp/106-nodia-teacher-guided-ux-redesign.md#14-cierre-tux-001-por-aceptación-humana--2026-11-16)
registra la confirmación del usuario de que TUX-001 funciona bien y solicita
cerrarlo. Alta guiada, cabecera/paneles/selector y revisión legible quedan
aceptados por el alcance entregado; las notas de comprensión pendiente de los
cortes anteriores son históricas. TUX-03/05 conservan evolución propuesta fuera
de este cierre; no se da por implementado su rediseño de continuidad.

La confirmación no especifica versión, entorno o dispositivo. Conserva los
límites de QA e inferencia y no ejecuta una adopción nueva. Evaluación de impacto:
sólo seguimiento documental, sin conceptos, operaciones, contexto, herramientas,
permisos o contratos nuevos. Ficha revisión5, draft/partial/unregistered y
approval:null; no se aprueba ni publica conocimiento.

## Revisión legible del plan — solicitud2026-11-16

[Plan106§13](../../../../mvp/106-nodia-teacher-guided-ux-redesign.md#13-revisión-del-plan-legible-y-edición-progresiva--solicitud2026-11-16)
retoma TUX-04 por petición del usuario: entender la propuesta antes de editarla.
Resumen con título/objetivo/organización y conteos reales; recorrido por secciones
con detalles bajo demanda. «Usar este plan» es principal; «Editar estructura» y
«Pedir un ajuste» conservan acceso visible, con editor y ajuste plegables. La
activación futura mantiene su acción versionada propia. Con propuesta disponible,
la revisión precede a la conversación de planificación, que se despliega mediante
su botón y sigue montada para conservar borrador, selección y editores. Sin
propuesta continúa visible; no se pliega durante grabación. El helper de «Usar
este plan» distingue guardar la propuesta y elegir una unidad de preparar material.

Se conservan todos los campos y reglas de edición, cantidades inválidas, IDs y
borradores al plegar, revalidar o fallar503/409. Cambios locales/política inválida
bloquean aceptación con explicación y acceso al editor. Resolver una promesa de
comando no acredita guardado; el éxito lo determina la revisión confirmada.
Ajustar con IA, guardar revisión manual, aceptar y preparar material son acciones
diferentes. Abrir/leer no genera ni acepta implícitamente; aceptación exacta no
requiere proveedor listo cuando el contrato permita esa acción.

Evaluación de impacto: presentación y acceso progresivo a operaciones actuales,
sin cambiar conceptos, efectos, contexto enviado, permisos, herramientas o
interpretación de resultados. Implementación y QA sintética local verificadas en
[la evidencia propia](../../../../evidence/teacher-plan-review-20261116/README.md):
12perfiles320–1280px, ES oscuro/EN claro, sin overflow ni escrituras al entrar;
drafts/nodos/foco conservados al plegar o redimensionar y ante503/409. Aceptación
con ID/hash exactos de la revisión confirmada, sin IA o preparación automática.
Una política inválida bloquea aceptación y también ajustes con IA, incluso sin
cambio estructural; ayuda ES/EN y corrección comprobadas sin escrituras. La
regresión histórica posterior conserva título/duración ausentes y estado vacío
hasta editar explícitamente, sin inventar jornadas ni aceptar si no está permitido.

Global365archivos/3039pruebas correcta antes del último guard de política, su
assertion y el caso histórico posterior;26focales correctas después en12,38s, build final
(tipado+Vite), lint final con sólo `.tmp/**` excluido y typecheck independiente
previo correctos. No se afirma otra global posterior. Comprensión humana, UI
autenticada, teléfono físico y adopción siguen independientes; TUX-04 parcial
por alcance local. Draft/partial/unregistered/approval:null, sin publicación,
aprobación o inferencia nuevas por esta entrega.

## Cabecera, drawer y selector IA — solicitud2026-11-16

[Plan106§11](../../../../mvp/106-nodia-teacher-guided-ux-redesign.md#11-cabecera-drawer-adaptativo-y-selector-ia--solicitud2026-11-16)
registra la continuación aceptada: estado al extremo derecho del título,
«Mis planes de estudio» contained y resultado confirmado junto a las acciones,
sin recarga contigua. Aprendizaje adaptativo pasa a Drawer derecho con Mis fuentes
primero/seleccionado al entrar; cada categoría muestra su información existente.
El chat usa resumen compacto y configuración horizontal en Popover, sin botón «+».

Implementación y QA sintética local verificadas en la rama actual; regresiones y
checks finales de código correctos por alcance, incluida la última alineación
CSS xs y la repetición de seis perfiles según evidencia. Borradores, foco,
retry, selección exacta y datos de disponibilidad mantienen sus contratos; mover
controles no genera IA, acepta planes ni guarda selecciones implícitamente.
Evaluación de impacto: presentación y acceso a operaciones existentes, sin nuevos
conceptos, herramientas, permisos o contexto del modelo. Candidata draft/partial/
unregistered/approval:null, sin publicación o adopción por este lote.
[Evidencia propia](../../../../evidence/teacher-drawer-chat-ui-20261116.md); el mockup no
prueba UI integrada, dispositivo físico o capacidades de un proveedor.

# Experiencia guiada de Teacher — contexto funcional para NodiaAI

## Qué resuelve y qué significa

El usuario reporta que Teacher es difícil de entender, especialmente al crear.
[Plan106](../../../../mvp/106-nodia-teacher-guided-ux-redesign.md) propone alta
de3pasos, ayuda contextual opcional, revisión legible y primera lección con
siguiente acción clara. El alta3pasos es un candidato implementado localmente. La revisión legible cuenta
con la entrega local de106§13 y aceptación funcional del usuario en106§14.
La confirmación no identifica entorno/dispositivo ni acredita una adopción nueva. La primera lección TUX-05 conserva su alcance pendiente; no se
atribuye disponibilidad operativa por existir código.
La [ficha de sesión](session-setup-and-planning.md) conserva el baseline real.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Ambigüedad | Aclaración/tratamiento esperado |
| --- | --- | --- | --- |
| «No sé cómo empezar» | Ayuda de navegación | Sesión nueva o existente | Identificar situación y explicar siguiente acción real; distinguir el candidato local de su adopción operativa |
| «Quiero aprender SQL» | Nuevo estudio | Falta objetivo y elección IA al generar | Guiar mínimos; no inventar nivel o configuración |
| «Guarda esto y sigo después» | Conservar borrador | Alta incompleta frente a sesión persistida | Distinguir estado local y acuse Server; no anunciar guardado inexistente |
| «Usa este plan» | Aceptación humana | Revisión exacta por confirmar | Mantener botón/confirmación nativos; conversación no autoacepta |
| «Falló, vuelve a enviarlo» | Recuperar | Puede ser resultado incierto | Consultar estado/recibo antes de nueva intención; unknown no habilita replay |

## Operaciones y contratos

| Operación semántica | Clase/efecto | Herramienta real | Contrato | Resultado |
| --- | --- | --- | --- | --- |
| Avanzar/volver en wizard | Presentación local implementada | Ninguna nueva | Plan106§10; candidato local | Mismos datos, sin IA o POST por paso |
| Guardar alta válida | Persistencia nativa existente | Sin herramienta nueva de chat | CreateSessionDto, start_plan:false | Borrador confirmado; exige tema/objetivo/idioma |
| Crear propuesta | Persistencia y generación explícitas existentes | Sin herramienta nueva de chat | CreateSessionDto start_plan:true / comandos97 | Candidata para revisión, no plan aceptado |
| Aceptar / preparar material | Confirmación exacta / generación separadas | Ninguna nueva por este rediseño |97 y runtime nativo | Plan aceptado y material con garantías actuales |

Los nombres UX no conceden acceso ni convierten endpoints en herramientas MCP.

## Datos mínimos y resolución de dudas

Tema, objetivo e idioma obligatorios incluso para guardar alta; título, base y
contexto opcionales conforme DTO. Organización inicial teacher_suggests; cantidad
de jornadas opcional/nula en entrada inicial,1–365 si existe. IA exacta necesaria
al generar, no al guardar. [Matriz106§4.3](../../../../mvp/106-nodia-teacher-guided-ux-redesign.md#43-datos-mínimos-y-persistencia-honesta).
No confundir autoguardado del mensaje de definición con alta incompleta.

## Reglas, acceso y restricciones

Mismo destino `/nodia-teacher` y autoridad89/ADR092; no requiere NodiaAI para usar
Teacher. Conservar `allowed_actions`, historial, presupuestos, selección exacta,
CAS/idempotencia/cierre y no-replay. ADR100 mantiene primer intento sin canary
obligatorio. Evaluar conocimientos es opcional y distinto de elegibilidad IA.
Esconder controles avanzados no elimina capacidades ni cambia permisos.

## Filtros e informes

Conservar búsqueda/paginación/archivo actuales en Mis planes. No hay informes
nuevos o métricas inferidas de aprendizaje. Estado y siguiente acción deben
derivar de contratos reales; pendiente probar proyección UI de cada fase.

## Vista previa, confirmación y recuperación

Propuesta primero legible, editor estructural por intención y aceptación exacta
de revisión/hash. Preparación de primera lección explícita; abrir/aceptar no
genera automáticamente material. Error conserva datos, edición y cursores;
unknown consulta/conciliación sin replay. Alta incompleta local no se anuncia
como guardada ni promete persistencia tras recarga. Regresiones y QA locales por alcance en evidencia; comprensión/adopción pendientes.

## Integración y evidencia

- [x] Solicitud y baseline trazados a106/97 y DTOs reales.
- [x] Aceptación funcional del candidato entregado confirmada por el usuario en106§14; no acredita un estudio observado adicional.
- [x] Alta local implementada: mínimos, navegación, selección/errores y salida protegida probados con fixtures; autoridad Server reutilizada.
- [ ] Aceptación exacta, conflictos y recuperación comprobados localmente en106§13;
  concurrencia/HTTP autenticado y adopción no se reaceptan por esa QA sintética.
- [x] Alta responsive/ES/EN/temas verificada en Chromium sintético; continuidad histórica y entorno real no reaceptados.
- [ ] Integración/publicación NodiaAI definida si se solicita; ninguna nueva en106.

Fuente candidata validada; no publica ni acredita operación real por sí sola.
Seguimiento [TODO](../../../../mvp/TODO.md): TUX-001 cerrado por alcance en106§14;
TUX-03/05 conservan su evolución propuesta separada.

## Evolución y compatibilidad

| Revisión | Cambio | Contexto afectado | Compatibilidad |
| --- | --- | --- | --- |
| 1 | Rediseño futuro de alta y continuidad, plan106 | Nueva candidata UX y fichas Teacher | Sin cambio de contratos/autoridad; capacidades actuales conservadas |

| 2 | Alta3pasos local, selección conservada y salida protegida | Guía Client y recuperación existentes | Sin cambios Server, publicación o aprobación; comprensión y resto pendientes |
