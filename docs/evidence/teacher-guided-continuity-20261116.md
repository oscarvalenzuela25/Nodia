# Teacher: TUX-03/05 — validación local 2026-11-16

Rama `codex/teacher-guided-continuity`, creada desde `origin/development`
`6b7f15a5`. Alcance canónico: [plan106§15](../mvp/106-nodia-teacher-guided-ux-redesign.md#15-tux-0305-guía-y-continuidad-implementadas-localmente--2026-11-16).
Entrega posterior al cierre humano TUX-001; aceptación del alcance nuevo y
adopción por entorno independientes.

## Resultado implementado

- Crear propuesta como acción principal; conversación opcional con selección IA
  visible y compositor conservado al plegar. Mensaje sin enviar bloquea la
  propuesta y sólo se elimina por descarte confirmado sobre el contexto exacto.
- Diagnóstico consultado al abrir su modal, sin iniciar intento ni crear banco.
  Un intento nuevo exige banco revisado y acción nativa; un intento activo puede
  retomarse. Falta de banco no bloquea crear propuesta. Fallo conserva el modal
  y la recuperación del comando; el doble envío permanece bloqueado.
- Preparación describe el propósito real y diferencia consultar un trabajo de
  solicitar otra generación. No se inventa selección, progreso, cuota o plazo.
- Siguiente paso desde plan/unidad/material/cursor/intento reales. Elegir unidad
  confirma CAS antes de cambiar la vista. Preparar material requiere intención
  separada; unknown/preparing sin trabajo sólo permiten lectura de estado.
  Un job asociado se inspecciona sin seguir automáticamente sus resultados.
- Abrir/Continuar sólo enfoca lectura o intento existente. Un cursor histórico
  se conserva; no se promete recuperar la versión histórica exacta con el GET de
  material actual. Guardar punto de lectura cambia el estado local tras acuse.
- Respuesta pendiente/conflicto/grabación bloquean aceptar/activar un plan y
  cambiar de unidad, preservando el editor y su respuesta ante errores.

## Verificación del árbol

En `nodia-client`:

| Comprobación | Resultado |
| --- | --- |
| `npm run typecheck` | Correcta |
| `npm run test -- src/test/modules/teacher` | Final: 277 pruebas / 42 suites correctas, 40,08 s |
| `npm run test` | 3171 pruebas / 383 suites correctas, 278,29 s; corte previo al ajuste final descrito abajo |
| `npm run build` | Final correcta; incluye `tsc -b` |
| `npm run lint -- --ignore-pattern '.tmp/**'` | Correcta, sin advertencias |
| `git diff --check` | Correcta |

La global precede dos ajustes finales pequeños: carga inicial Boneyard de la
guía y eliminación de un guard de preparación redundante con la política nativa.
El árbol final se verifica con la focal Teacher277/42, build/tipado, lint y los
recorridos Chromium repetidos; no se atribuye una segunda global a ese delta.

El lint general inicial encontró cuatro errores exclusivamente en prototipos
locales anteriores de `.tmp/pos-registration-auto-add-qa`, `.tmp/product-alias-qa`
y `.tmp/teacher-upgrade-browser`. Se conservaron esos temporales y la
configuración; el comando documentado excluye `.tmp`, manteniendo todas las
fuentes, configuración y pruebas del repositorio. La suite emite avisos de
jsdom sobre navegación/canvas/media no implementados; no son pruebas reales de
esas APIs. Vite conserva su advertencia de tamaño de chunks, sin error de build.

## Chromium con transporte sintético

Se utilizó `src/test/manual/teacher/index.html` con su adaptador Axios sintético,
sin proveedor, DB operativa, credencial real ni HTTP a producción. Se extendió
el fixture para disponibilidad, banco revisado y fallos de cursor/respuesta.

Recorridos observados:

1. Plan listo: cero mutaciones al montar. Fallo409 del cursor conserva la vista;
   reintento confirmado elige la unidad. No genera por elegir. Preparar produce
   una única petición explícita de material. Abrir enfoca `h2` sin otra escritura.
2. Disponibilidad unknown: no ofrece preparar; Actualizar estado sólo lee.
3. Mensaje sin enviar: Crear propuesta deshabilitado. Cancelar el descarte
   conserva exactamente el texto y el compositor.
4. Diagnóstico sin banco: sólo GET al abrir, inicio deshabilitado, cierre y
   propuesta disponibles. Con banco revisado, inicio sólo por acción expresa.
5. Diagnóstico durante revisión: fallo503 al guardar respuesta conserva el radio
   elegido; aceptar plan y volver a abrir diagnóstico permanecen bloqueados.
6. Evaluación con plan: respuesta pendiente bloquea cambiar unidad. Tras guardar
   explícitamente, un fallo409 al cambiar unidad conserva intento, respuesta y
   cursor; no solicita material ni IA.

Matriz responsive: 16 perfiles, combinando borrador/lección, español/inglés y
anchos320/600/900/1440, con claro/oscuro distribuidos. Tras resolver datos y
fuentes: sin desbordamiento horizontal, botones visibles de al menos44px,
cero mutaciones y cero consultas de diagnóstico al montar. Capturas de móvil,
escritorio, tema oscuro e incertidumbre inspeccionadas; no se sustituyen pruebas
con teléfono físico, shell autenticado, zoom nativo o comprensión humana.

Capturas y scripts/logs intermedios quedan en `output/playwright/teacher-continuity/`
y `.tmp/` ignorados, sin imágenes nuevas en Git. La evidencia duradera es este
resumen y el fixture sintético mantenido. No hay despliegue ni inferencia real
por este lote; no se alteran contratos Server, migraciones, permisos o modelos.

## Contexto NodiaAI

`context:prepare`, `context:build` y `test:nodia-ai:knowledge` correctos:58 pruebas
del compilador/pins;44documentos,46fragmentos y153capacidades publicadas. Release
`5dd6e76f3a29d90dab84224c12334e9455828549077c885dcb4a8ded86703d20`, pins src/dist
coherentes. Fichas candidatas Estudios44, experiencia guiada6 y sesión38 conservan
draft/partial/unregistered/approval:null; no se publica una capacidad Teacher nueva.
