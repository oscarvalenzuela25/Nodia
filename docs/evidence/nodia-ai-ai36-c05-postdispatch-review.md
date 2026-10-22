# C05 — Revisión factual de esperas posteriores al envío

Fecha: 2026-10-19. Alcance: lectura de evidencia R02–R05 y fuentes locales; sin VM, perfiles, inferencias, modificaciones operativas ni aprobación documental. Esta revisión no establece una causa de los stalls restantes.

Las trazas permiten separar dos resultados. El defecto de profundidad del manifiesto sí se reprodujo y corrigió: preferencias pasa de cero RPC en [R02](nodia-ai-ai36-c05-r02-case-attempt01-preferences-native-diagnostics.json) a ocho RPC y dos callbacks completados en [R03](nodia-ai-ai36-c05-r03-case-attempt01-preferences-native-diagnostics.json), pero continúa sin terminal dentro de119s. Finanzas R02/R03 y descubrimiento de preferencias R04 conservan `running_cli`, `prompt_received`, cero callbacks observados y vencimiento del plazo. No se ha demostrado otro defecto local que explique esas esperas. Tampoco se atribuyen a red, cuota, razonamiento o retries internos del proveedor.

## 1. La restauración perdió el diagnóstico nativo de R05

**Hecho.** El [canario R05](nodia-ai-ai36-c05-r05-role-canary02-canary-report.json) conserva un start, prueba `abandoned_unknown/process_closed=true` y ACK exacto. El [suplemento](nodia-ai-ai36-c05-r05-closure-supplement.json) y la [nota de cierre](nodia-ai-ai36-c05-r05-acceptance.md) registran que no se extrajo el WARN antes de recrear el contenedor. Por tanto, fase, RPC, callbacks y causa de ese intento permanecen desconocidos; no son ceros.

**Ubicación.** [Supervisor nativo](../../nodia-gemini-microservice/native_mcp_sessions.py):358–359 emite `nodia_ai_mcp_terminal` al finalizar. El [orquestador R05](scripts/nodia-ai-ai36-c05-r05-role-canary-remote.py):121 ejecuta la restauración tras quiet, sin una captura estructural intermedia. El [extractor existente](scripts/nodia-ai-ai36-c05-r01-native-diagnostics.py):76–109 ya restringe IDs, ventana y salida a metadatos.

**Acción propuesta.** Incorporar al siguiente control una captura acotada del resumen por attempt y contenedor exactos antes de su recreación. Conservar conciliación/cierre y ACK del mismo proof; no exigir captura previa al ACK cuando el resumen permanece en los logs del contenedor. No retrasar indefinidamente cierre o ACK por diagnóstico. Después comprobar quiet y restaurar. Si no se obtiene el resumen, registrar `missing` y su límite de evidencia; no reconstruir actividad ni restaurar mientras exista incertidumbre pendiente. Exportar sólo campos cerrados, sin logs crudos, argumentos, prompts, resultados o credenciales.

**Límite.** Es una pérdida de observabilidad demostrada, no una explicación del timeout. R05 no puede recuperar retrospectivamente su WARN desaparecido mediante otro intento.

## 2. Seis RPC no prueban que `tools/list` haya respondido correctamente

**Hecho.** [Finanzas R02](nodia-ai-ai36-c05-r02-case-attempt01-finance-native-diagnostics.json), [Finanzas R03](nodia-ai-ai36-c05-r03-case-attempt01-finance-native-diagnostics.json) y [preferencias R04](nodia-ai-ai36-c05-r04-case-attempt02-preferences-native-diagnostics.json) registran seis RPC sin callbacks. El contador nativo aumenta antes de validar el método o producir su respuesta. Su evento técnico no conserva la clase de método ni si la respuesta fue resultado, error o notificación.

**Ubicación.** [Puente stdio](../../nodia-gemini-microservice/native_mcp_stdio.py):164–179 cuenta y crea el evento; :212 atiende `tools/list`. [Supervisión](../../nodia-gemini-microservice/native_mcp_sessions.py):454–480 incorpora los eventos y mantiene el contador agregado.

**Acción propuesta.** Antes de otro ensayo comparable, instrumentar exclusivamente clases cerradas de método y resultado: inicialización, notificación de listo, listado, llamada, otro; resultado, error o sin respuesta. Para el listado, conservar cantidad y huella del catálogo autorizado, sin esquemas ni contenido. Probar offline que un listado rechazado no se presenta como listado exitoso y que no cambian contadores, presupuestos ni permisos. La instrumentación requiere implementación y verificación offline antes de otro control real; no está implementada aquí.

**Límite.** Los seis RPC prueban actividad del puente, pero no permiten afirmar que falló ni que terminó su handshake. Este control distinguiría una espera local de inicialización/listado de una espera posterior; por sí solo no prueba que el modelo haya incorporado las herramientas.

## 3. `initialized=true` no acredita el agente/modelo observado durante un intento incierto

**Hecho.** Las trazas R02–R04 muestran inicialización y recepción del prompt, pero el indicador de inicialización sólo registra la clase del evento. La igualdad de `init.agent` y del modelo se valida después de que termina el CLI; un timeout no alcanza esa validación. Los eventos retenidos no permiten certificar esos valores en los intentos inciertos.

**Ubicación.** [Progreso CLI](../../nodia-gemini-microservice/agentic_progress.py):35–52 registra el evento `init`. [McpTrace](../../nodia-gemini-microservice/native_mcp_sessions.py):98–146 añade categorías cerradas sin proyectar su identidad. El [validador terminal](../../nodia-gemini-microservice/native_mcp_sessions.py):429–435 comprueba agente y modelo tras finalizar el proceso.

**Acción propuesta.** Conservar en el observador la cantidad de eventos `init` y comparaciones booleanas/null contra agente y modelo esperados, con tiempo monotónico del evento. No exportar los valores originales ni interpretar ausencia como coincidencia. Verificar offline coincidencia, discrepancia, evento ausente y duplicado; mantener intactos el validador terminal y las concesiones. Combinarlo con el resumen de handshake del hallazgo2 en un único control instrumentado, sin nuevos requests al proveedor durante la observación.

**Límite.** El rol propio y su herencia ya tienen pruebas de ejecuciones completadas. Este hueco impide comprobarlos en una ejecución incierta; no demuestra que el CLI los ignorara ni que fueran la causa del stall. Ningún indicador nuevo sustituiría terminal completo, cierre, ACK, confirmación humana o aceptación por capacidad.

## Siguiente control útil

Primero verificar offline la captura y sus casos de error; después, tras el gate técnico interno de QA/quiet, utilizar un único intento con las identidades, selección High, catálogo, límites y permisos expresamente fijados. Capturar los tres conjuntos de metadatos anteriores y preservarlos antes de recrear su contenedor. Mantener el orden seguro de conciliación/cierre, ACK, quiet y restauración; no repetir un resultado incierto. El objetivo sería localizar dónde deja de avanzar la ejecución, sin afirmar causalidad por un éxito o un fallo adicional. El usuario ya autorizó desarrollo y diagnóstico; esta revisión no incluye implementación ni ejecución de ese control.
