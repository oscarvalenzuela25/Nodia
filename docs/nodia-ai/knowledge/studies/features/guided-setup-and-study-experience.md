---
{
  "schema_version": 1,
  "document_id": "studies.guided-setup-and-study-experience",
  "product_id": "studies",
  "kind": "feature",
  "revision": 1,
  "document_status": "draft",
  "implementation": { "status": "planned", "notes": "Rediseño UX/UI futuro solicitado2026-11-15. Baseline Teacher existente no acredita implementación del wizard ni aceptación de comprensión." },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Teacher conforme AGENTS",
  "sources": [
    { "path": "docs/mvp/106-nodia-teacher-guided-ux-redesign.md", "kind": "specification" },
    { "path": "docs/mvp/97-nodia-teacher-technical-contracts.md", "kind": "specification" },
    { "path": "nodia-server/src/teacher/dto/teacher.dto.ts", "kind": "implementation" }
  ],
  "verification": { "checked_on": null, "evidence_paths": [], "notes": "Lectura de contratos trazada en plan106; sin prototipo Teacher, ejecución de UI, inferencia, pruebas de usabilidad o adopción por esta entrega." },
  "approval": null
}
---

# Experiencia guiada de Teacher — contexto funcional para NodiaAI

## Qué resuelve y qué significa

El usuario reporta que Teacher es difícil de entender, especialmente al crear.
[Plan106](../../../../mvp/106-nodia-teacher-guided-ux-redesign.md) propone alta
de3pasos, ayuda contextual opcional, revisión legible y primera lección con
siguiente acción clara. Es un rediseño pendiente, no el funcionamiento actual.
La [ficha de sesión](session-setup-and-planning.md) conserva el baseline real.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Ambigüedad | Aclaración/tratamiento esperado |
| --- | --- | --- | --- |
| «No sé cómo empezar» | Ayuda de navegación | Sesión nueva o existente | Identificar situación y explicar siguiente acción real; no afirmar que el wizard ya existe |
| «Quiero aprender SQL» | Nuevo estudio | Falta objetivo y elección IA al generar | Guiar mínimos; no inventar nivel o configuración |
| «Guarda esto y sigo después» | Conservar borrador | Alta incompleta frente a sesión persistida | Distinguir estado local y acuse Server; no anunciar guardado inexistente |
| «Usa este plan» | Aceptación humana | Revisión exacta por confirmar | Mantener botón/confirmación nativos; conversación no autoacepta |
| «Falló, vuelve a enviarlo» | Recuperar | Puede ser resultado incierto | Consultar estado/recibo antes de nueva intención; unknown no habilita replay |

## Operaciones y contratos

| Operación semántica | Clase/efecto | Herramienta real | Contrato | Resultado |
| --- | --- | --- | --- | --- |
| Avanzar/volver en wizard | Presentación local propuesta | Ninguna nueva | Plan106; UI pendiente | Mismos datos, sin IA o POST por paso |
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
como guardada ni promete persistencia tras recarga. Pendiente probar implementación.

## Integración y evidencia

- [x] Solicitud y baseline trazados a106/97 y DTOs reales.
- [ ] Prototipo específico Teacher y comprensión contrastados con usuario.
- [ ] Implementación, mínimos/autoridad y estados probados.
- [ ] Aceptación exacta, conflictos, concurrencia y recuperación comprobados.
- [ ] UI responsive/ES/EN/temas y continuidad histórica verificadas por entorno.
- [ ] Integración/publicación NodiaAI definida si se solicita; ninguna nueva en106.

Registro de fuente sólo para validación documental; no publica ni acredita UI.
Seguimiento [TODO](../../../../mvp/TODO.md), TUX-001; fases TUX-00…06 del plan106.

## Evolución y compatibilidad

| Revisión | Cambio | Contexto afectado | Compatibilidad |
| --- | --- | --- | --- |
| 1 | Rediseño futuro de alta y continuidad, plan106 | Nueva candidata UX y fichas Teacher | Sin cambio de contratos/autoridad; capacidades actuales conservadas |
