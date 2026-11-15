# Chat compacto y selección GPT Agentic — 2026-11-14

Rama `codex/nodia-ai-chat-space-gpt-selection`, creada desde
`origin/development` en `fe56f57de9e4c6c8a34c5183579916aade43931b`. Entrega local; no acredita despliegue, inferencia nueva,
disponibilidad del modelo seleccionado ni aceptación en teléfono físico.

## Diagnóstico confirmado

- OpenAI Agentic proyectaba esfuerzos exclusivamente desde
  `supportedReasoningEfforts`. Si faltaba metadata histórica, el catálogo
  devolvía `efforts: []` aunque existiera `thinking_level: medium` guardado.
  NodiaAI y Teacher interpretan correctamente esa discrepancia como selección
  no incluida en el catálogo; el origen de la pérdida estaba en Server.
- El GET sanitizado ya conserva metadata advisory desde el arreglo anterior;
  esa corrección no recuperaba por sí sola registros que ya la habían perdido.
- Teacher capturaba fallos distintos y devolvía siempre
  `provider_unavailable` con `checked_at: null`. El JSON aportado por el usuario
  no identifica por sí mismo cuál fue la excepción concreta.
- Inspección SSH productiva de sólo lectura: release
  `backend-307ffbccc510-3b25a0834e0f`, API/worker activos; no se encontró el
  ejecutable `teacher-codex-host` ni su drop-in de configuración en las rutas
  de despliegue revisadas. El transporte Teacher GPT exige ese host además del
  runtime Codex usado por el chat. No se leyó `runtime.env` protegido ni se
  inició inferencia o sesión. La omisión del aprovisionamiento está comprobada;
  atribuirle una petición autenticada concreta requerirá observarla en el entorno.

## Cambios

- Envío se convierte en Stop durante queued/running/cancel_requested.
  Reutiliza la cancelación identificada existente: petición incierta se recupera
  por GET, sin repetir inferencia ni asumir cierre remoto.
- Se retiran botón «Ver actividad del turno» y cabecera de título/modelo.
  Resultados/propuestas históricos se consultan al acercarse a la vista y
  conservan sus controles; renombrar usa el menú lateral y PATCH con revisión.
- PageContent aporta16px verticales y16/24/32px laterales según xs/sm/md+.
  Se preservan interiores y reserva inferior móvil. El chat aprovecha la altura
  liberada también en su workspace, con mínimos/scroll móvil existentes.
- Preferencias Agentic centralizadas por proveedor cuando falta metadata GPT;
  los IDs de modelo siguen viniendo de configuración/catálogo. Metadata válida,
  incluida una lista vacía explícita, mantiene sus opciones exactas. Los valores
  configurables no prueban soporte. Elegibilidad conserva tupla, sesión y entorno.
  GPT ofrece low/medium/high/xhigh/max/ultra como preferencias compatibles con
  el enum del protocolo fijado, conservando preferencias históricas válidas;
  Gemini conserva low/medium/high. API mantiene sus reglas independientes.
  [Fuente oficial fijada](https://github.com/openai/codex/blob/979011409de0a60b52f179721948e65531d26144/codex-rs/protocol/src/openai_models.rs).
- Teacher conserva categorías públicas seguras de fallo y la fecha de una
  observación negativa real; errores sin observación conservan fecha desconocida.
- Operador revisable de host Teacher en
  `ops/production/ai-runtime/prepare-teacher-runtime.py`: verifica artefacto
  release Linux/ABI/manifiesto/capabilities, fija binarioSHA512 y sólo dos variables
  no secretas. Activación exige consumidores drenados/detenidos y preflight
  SQL READ ONLY; registra drop-in72 y hashes en el guard CD, conservando70/71.
  No detiene/arranca servicios ni genera contenido. Ver
  [runbook](../../ops/production/ai-runtime/README.md).

## Verificación

Las pruebas de transporte/UI usan datos
sintéticos y no consumen proveedores. Chromium con fixture aislada5194 verificó
320/599/600/899/900/1280px: documento sin overflow horizontal, padding vertical16px,
Stop44×44, un solo control de cancelación y ningún botón de actividad/envío
duplicado. Un POST de cancelación sintético produjo cancel_requested y toast;
el control permaneció bloqueado esperando conciliación.

Client: suite global2946/357 correcta; tras el último ajuste del progreso de
refetch,59pruebas finales de la página y build correctos. Tipado incluido en ambos
builds Client. Lint de código correcto con `npm run lint -- --ignore-pattern '.tmp/**'`;
el comando general detectó el experimento previo ignorado
`.tmp/teacher-upgrade-browser/main.tsx`, sin modificarlo ni cambiar la configuración.
Server: build y knowledge:check correctos;91fuentes,47excluidas,44documentos y46fragmentos.
Sólo se refresca un hash técnico de implementación de la capacidad OCR afectada
por la proyección de errores; fichas aprobadas y contratos comerciales conservados.
Lint Server correcto con aviso previo `no-unsafe-finally` de fixture.
Server global:351archivos correctos,6054pruebas pasadas y1omitida por requerir
Linux (`api-nodia-ai-runtime-owner.spec.ts`, identidad de PID/start ticks).
Se ejecutó después ese escenario real contra el Server compilado en
WSL/Linux con Node24.22.2: nacimiento de proceso comprobado, PID con nacimiento
distinto reconocido como cerrado y dueño actual conservado como activo. Pasó
sin red o procesos externos; es una comprobación adicional compilada, no una
segunda suite Vitest global ni una supresión de su omitida Windows.

Backend:78pruebas focales finales en tres archivos, además de la primera corrida
de109 en cinco archivos parcialmente solapados; no se suman como suites únicas.
La observación Teacher rechaza metadata nativa ausente, conserva `[]` explícito
y no fabrica un catálogo vacío a partir de metadata perdida.

Operador:79comprobaciones Python en Linux sin omisiones. Una copia aislada en
filesystem Linux nativo pasó35pruebas `test_backend_update*.py`,25del receptor,
11de `test_ai_runtime_updater.py` y7de `test_teacher_runtime.py`. El primer intento
de una fixture de ownership en `/mnt/c` falló por la semántica de ese filesystem;
la misma fuente pasó en filesystem Linux nativo sin cambiar las garantías.
El roundtrip real `package()`→`verified_bundle()` pasó por separado con git
del repositorio y detectó corrupción del nuevo operador (1prueba).
`py_compile`, `git diff --check` y actionlint de `ci.yml` correctos. CI incluye
las regresiones en el runner root aislado y el roundtrip en el host con git.
El runner Docker no se invocó localmente por ausencia de daemon; los módulos
se ejecutaron en WSL/Linux root aislado, sin systemd/cuentas/inferencia.

Comandos ejecutados sobre la copia aislada de las comprobaciones:

```text
python3 -m unittest discover -s /root/nodia-teacher-tests-r01/ops/production/tests -p 'test_backend_update*.py' -q
python3 -m unittest discover -s /root/nodia-teacher-tests-r01/ops/production/tests -p test_deploy_receiver.py -q
python3 -m unittest discover -s /root/nodia-teacher-tests-r01/ops/production/tests -p test_ai_runtime_updater.py -q
python3 -m unittest discover -s /root/nodia-teacher-tests-r01/ops/production/tests -p test_teacher_runtime.py -q
env GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=safe.directory GIT_CONFIG_VALUE_0=/mnt/c/Users/Oscar/Desktop/Nodia python3 -m unittest discover -s /mnt/c/Users/Oscar/Desktop/Nodia/ops/production/tests -p test_ai_runtime_bundle.py -v
```

EN/claro: modal de renombrado lateral conserva título editado y borrador del chat
al cambiar1280→320px. El PATCH rechazado por el adaptador sintético muestra
toast/error y mantiene el modal/título; no acredita guardado SQL. El borrador del
chat también se conserva al volver a1280px. La prioridad de recuperación de una
admisión incierta conserva su control en lugar de ocultarlo tras Stop.

Se observaron avisos de desarrollo React sobre actualización durante render y
`:first-child`, ya documentados en QA previa; esta entrega no acredita corregirlos.
Capturas e informes intermedios en `output/playwright/`, sin secretos.
El antecedente de interfaz
[AI13](nodia-ai-ai13-browser-qa.json) conserva su evidencia histórica original;
este recibo sustituye sólo su referencia en el vector acotado del producto.

## Límites y continuación

El host de Teacher GPT requiere aprovisionamiento y verificación con la selección
exacta en el destino. Corregir catálogos y diagnósticos locales no instala ese
ejecutable ni demuestra inferencia operativa. Las fichas candidatas continúan
draft/unregistered/approval:null y no se publican nuevas herramientas.
El artefacto release Linux nuevo no se construyó: Docker local está apagado y el
binario dev histórico de238MB es rechazado por el operador. No se aplicó ninguna
instalación, reinicio o cambio de configuración en producción.
