# Verificación técnica de preferencias API y acceso NodiaAI

Corte local del 2026-11-12/13, rama `codex/enable-ai-provider-login`. Comprobante
compacto para los siete contratos administrativos cuyo registro exige evidencia
bajo `docs/evidence/`. La explicación funcional y la continuidad se mantienen en
el [contrato de proveedores](../mvp/ai-provider-feature-contract.md#verificación-consolidada-de-preferencias-y-acceso--2026-11-12).

## Implementación vinculada

| Fuente | SHA-256 |
| --- | --- |
| `nodia-server/src/nodia-ai-provider-operations/use-case/build-nodia-ai-provider-operations.use-case.ts` | `55c264e5d4d97a64b34182cff700493ec220be2bb30c5aef063d00e8f830cb9c` |
| `nodia-server/src/common/ai/api-reasoning.ts` | `eae4856f7a74d37cad55ac72ab03971c5252d5ac75f2406532c622a2931f2b16` |

La validación admite `xhigh`/`max` en OpenAI API; Gemini conserva sus preferencias
implementadas. Ultra API se rechaza. Catálogo, preferencia y login no prueban
inferencia ni soporte de cada modelo. Los siete bindings conservan identidades,
revisiones, esquemas y autoridad; sólo se actualizan sus pins técnicos y evidencia.

## Comprobaciones ejecutadas

- Backend: build correcto; 249 regresiones API y 60 unidades de autorización
  correctas. El harness HTTP pasó 74 comprobaciones con routing/guardas Nest reales
  y fronteras sintéticas de sesión/persistencia. No fue un ensayo PostgreSQL real.
- Client: build con TypeScript dentro del build y lint correctos. Suite general
  de 349 archivos/2812 casos: 2810 correctos y dos fixtures Home antiguos corregidos;
  Home5 y hook real7 pasaron después. ProviderDetail38 se comprobó por separado:
  2850 casos únicos cubiertos, sin fingir una segunda ejecución global.
- Regresiones: contexto del actor actual, asignación/revocación, destino canónico
  y clave exacta, excepción super_admin, variante Gemini con ID real y OCR
  independiente, fallo de guardado conservando selección y OpenAI API sin Ultra.
- Chromium sintético a 320/1280px, ES oscuro y EN claro: sin overflow horizontal,
  una tarjeta por familia Gemini reconocida, cambio High→Medium conservando OCR
  High, acciones contained y controles de razonamiento con altura de44px.

Los arreglos de autenticación/UI de PR4 y la nueva observación de cabecera se
integran y verifican en su corte posterior del contrato; no se atribuye a este
baseline una ejecución que no realizó.

Integración posterior con development1cc7621d/PR4 el2026-11-13: build y lint
Client correctos; 393 casos correctos en52archivos de Teacher, proveedores y
Topbar. Incluye guards de sesión validada, suspensión del sondeo ante401/403,
aislamiento por instancia/versión de sesión y conservación de ambos arreglos UI.
No se repitió toda la suite general tras este merge; los393 son el alcance
afectado comprobado.

## Límites

No se desplegó esta configuración de aplicación ni se solicitó inferencia real.
No se probó la causa operativa del antiguo síntoma del menú. Los 44 documentos
de conocimiento aprobados permanecen intactos; no se aprueban/publican candidatas
ni se habilitan capacidades por incorporar este comprobante.
