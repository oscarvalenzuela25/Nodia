# Teacher: selección IA, primera generación y alta — 2026-11-14

Rama local `codex/unify-model-reasoning-selector`, base development898aec84.
Solicitud: recuperar razonamiento/creación del plan, mejorar copy/orden/estilo del
alta y mantener el módulo seleccionado en páginas internas. Decisión adicional
explícita: permitir que Crear plan sea el primer intento real sin canary previo.
[96§43](../mvp/96-nodia-teacher-implementation-plan.md#43-alta-de-estudio-razonamiento-recuperable-y-menú-persistente--2026-11-14)
y [ADR100 propuesto](../architecture/decisions/ADR-100-teacher-first-generation-with-explicit-ai-selection.md).

## Hallazgos y correcciones

1. El GET sanitizaba `supportedReasoningEfforts`; guardar luego podía borrar las
   opciones persistidas. El sanitizador conserva sólo metadata válida advisory,
   con regresión de roundtrip, datos ausentes/inválidos y límite32, sin cuotas inventadas.
2. Teacher leía exclusivamente el snapshot guardado y no podía recuperar un
   histórico ya dañado. La observación nativa por conexión devuelve únicamente
   identidades configuradas/seleccionadas presentes vivas, sin escritura o inferencia.
3. El estado «Comprobando» también aparecía con la consulta deshabilitada; ahora
   refleja actividad real o el motivo específico de selección incompleta/fallo.
4. La lectura de elegibilidad bloqueaba cambiar razonamiento. Ahora permite
   editar, cancela consultas obsoletas y exige que el resultado coincida con la
   selección final; no transfiere una respuesta de otro esfuerzo.
5. Las invalidaciones de sesión podían disparar modelos/elegibilidad en paralelo
   y disputar el perfil con el Worker. Observaciones serializadas y actualización
   dirigida por el panel, sin refetch durante trabajo/guardado o retry deshabilitado.
6. El recibo generativo previo bloqueaba el primer uso. Teacher/3 lo deja como
   diagnóstico opcional; el Worker conserva observación real fuera de locks,
   claim exacto, presupuesto, un POST por intento e incertidumbre sin replay.
7. Campo título primero, copy/ayudas ES/EN, botones contained y marca igual al
   listado. Menú lateral/móvil conserva selección por destino canónico más específico.

## Checks locales de Client

- Suite global:2.934pruebas/357archivos correctos; ajustes finales acotados de
  bloqueo de refresh/invalidación y metadata revalidados en53pruebas/4archivos.
- UI de formulario:12pruebas/4archivos; navegación:26/4. Los conjuntos focales
  se solapan con la suite global y no deben sumarse como campañas independientes.
- Build con TypeScript y lint del código correctos. Se excluye únicamente
  `.tmp/**` del lint porque conserva el experimento previo ajeno ya documentado.
- El primer pase global detectó una versión intermedia del validador de metadata
  mientras se editaba el lote; regresión corregida y pase global posterior completo
  correcto. Las garantías se evalúan sobre los checks finales, sin ocultar fallos.

## Navegador local, sin proveedor real

Playwright Chromium y fixture Teacher de Axios interceptado. ES oscuro320×900,
600×900 y1280×1100; EN claro1280. Document width=scrollWidth en todos los tamaños.
Título fue el primer input; conocimientos/contexto ofrecieron sus hints traducidos.
Marca de alta y listado idénticas: Karmatic Arcade/line-heightnormal,348.28×39px
a1280 y245.84×28px a320. Selectores48px; Mis planes/Guardar/Crear contained44px,
ancho288px en320.

Con catálogo persistido de esfuerzos vacío, el orden fue GETmodels→eligibility
exacta medium. Mientras high estaba pendiente2500ms, el selector permaneció
editable y se cambió a low. Tras la respuesta exacta low, un doble clic Crear
produjo **un POST** sessions/start_plan:true con todos los campos y la tupla low,
recibió job queued y navegó al detalle de sesión. Redimensionar conservó low.
Con noEfforts=1 asentó selección incompleta/aviso específico, sin spinner eterno
ni llamada eligibility. La disponibilidad positiva fue explícitamente sintética;
no constituye prueba generativa real o aceptación de un proveedor.

Capturas auxiliares ignoradas en `output/playwright/teacher-new-{320,600,1280}-dark-es.png`
y `teacher-new-1280-light-en.png`. Procesos propios de navegador y Vite5198 cerrados.

## Server y PostgreSQL descartable

- Lote final Server:261pruebas/31archivos correctos y Oxlint sin avisos en el
  código afectado. Incluye admisión/claim, política opcional, transporte,
  cancelación, metadatos/DTO y diagnósticos existentes.
- Metadata/DTO/proyección/observación:110pruebas/7archivos correctos en el corte
  de recuperación de opciones. Política/3:12pruebas; cambios de admisión/claim,
  cancelación y diagnóstico se revalidaron mediante suites focales y SQL reales.
- Build Server completo con Nest/contexto/políticas/knowledge correcto. No se
  compila o modifica un binario Native ni se cambian sus descriptores pinneados.
  Las menciones históricas de qualification en capabilities no son un gate
  ejecutable de admisión; Server aplica la decisión funcional nueva.
- API:32comprobaciones con PostgreSQL16 descartable y transporte HTTP sintético.
  Primer `setup_reply` mediante admisión real sin recibos previos; dos Workers
  produjeron un POST y salida publicada, replay de idempotencia recuperó el mismo
  job y las tablas de calificación permanecieron vacías. Tres POST sintéticos en
  la campaña total, sin red al proveedor o credenciales operativas.
- Agentic:36comprobaciones con PostgreSQL16 descartable y Native sintético.
  Crear plan fue el primer intento sin filas de calificación: propuesta ready,
  sin aceptar el plan. Dos instancias Runtime produjeron un solo start/ACK.
  Sesión inicialmente null quedó ligada a la observación real de ese intento.
- Cambiar configuración o revocar autoridad entre observación y claim produjo
  cero operaciones/start. Reemplazar la configuración del job con el mismo fence
  no prestó evidencia al nuevo dueño. Se conservaron presupuesto, unknown,
  confirmación de cierre/ACK, recuperación y protección contra duplicados.
- Ambos harness se repitieron sobre el build final de CAS. Contenedores propios
  y volumen Agentic eliminados/verificados. Sin base, perfil o inferencia reales.

Las44fichas aprobadas y46fragmentos publicados siguen siendo el corpus admitido;
91fuentes/47excluidas. El compilado local puede cambiar de release porque el
manifiesto incluye `source_hashes` de especificaciones/código actualizados, además
del contenido de las fichas. No equivale a aprobación de borradores, publicación
externa o adopción de una release compilada en producción. Los hashes/evidencias
anteriores se conservan con su fecha y no se reescriben para simular paridad.

`knowledge:check` final correcto, release local
`16411811a6f8d262740612213493cf6536a82c9410ae4dec411ebb7c40f33ea4`;
sin publicación o actualización de un entorno operativo.

## Alcance

No se ejecutaron migraciones, seeds, cambios de configuración operativa,
despliegues o generaciones reales. No se modifican respuestas/evidencias históricas
firmadas ni aprobación/publicación de fichas. La primera generación real y la
adopción del artefacto conservan su verificación por entorno; esta evidencia de
UI sintética no acredita eficacia pedagógica o soporte universal de modelos.
