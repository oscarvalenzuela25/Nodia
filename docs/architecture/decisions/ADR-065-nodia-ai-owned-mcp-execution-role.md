# ADR-065 — Rol nativo propio para la ejecución MCP de NodiaAI

> Estado: propuesto
> Fecha: 2026-10-19

## Contexto

La continuación [C05-R01](../../evidence/nodia-ai-ai36-c05-r01-acceptance.md) utiliza exclusivamente la selección High configurada por instrucción del usuario. Después de corregir la frontera del deadline en [ADR-064](ADR-064-nodia-ai-dispatch-deadline-boundary.md), las lecturas08 completan ambos envíos, pero preferencias09 agota119s antes de MCP. Su diagnóstico estructural registra inicialización del CLI, eventos `view_file`, un error con indicadores de hook/permisos y ningún RPC MCP. Los eventos no identifican una ruta ni equivalen a dos invocaciones independientes. El caso financiero10 sí completa la selección MCP y se detiene esperando la respuesta terminal. No está demostrada una causa única de ambos timeouts.

El adaptador ya prohíbe filesystem/shell/HTTP en el prompt MCP, mantiene workspace aislado y un hook de autorización independiente. Sin embargo, MCP conserva el rol general privado del CLI; conversación y adjuntos ya utilizan un `mainAgent` propio de Nodia con herramientas acotadas. La hipótesis comprobable es que un rol explícito concentre la ejecución MCP en las herramientas suministradas y la respuesta terminal, evitando intentos accesorios. No se afirma que resolverá la latencia del proveedor.

## Opciones consideradas

### Conservar el rol general y repetir los ensayos

- Ventajas: mantiene el transporte previamente verificado.
- Desventajas: no controla las instrucciones internas del agente general ni aporta una hipótesis distinta para repetir el caso fallido.

### Permitir filesystem, aumentar el plazo o cambiar de modelo

- Ventajas: podría facilitar que el agente general termine su secuencia.
- Desventajas: amplía permisos o cambia las condiciones para acomodar el ensayo. No corresponde a la petición High ni a las garantías de NodiaAI. Se descarta.

### Reutilizar el mecanismo de rol propio para MCP

- Ventajas: limita el comportamiento solicitado desde la definición del agente y conserva el gateway y hook como autoridad real.
- Desventajas: requiere verificar el soporte efectivo del CLI para el dispatcher MCP, contabilizar el documento del rol y obtener una nueva prueba real antes de declarar disponibilidad.

## Decisión

Implementar localmente la tercera opción bajo la autorización vigente. El ADR permanece propuesto; tests sintéticos no equivalen a aceptación del CLI real.

1. Definir un rol MCP propio, puro y verificable, sin valores predeterminados de modelo o esfuerzo. Usar `inheritMcp: true` para las herramientas de la configuración temporal que contiene únicamente `nodia_runtime`; la lista nativa del rol contiene `finish` y, sólo con adjuntos validados, `view_file`. El dispatcher MCP no se declara como herramienta nativa por su nombre de ejecución. La herencia no copia configuraciones globales ni concede otra herramienta o servidor.
2. Crear su documento únicamente en el workspace temporal propio, verificar contenido/ruta y exigir la identidad esperada del agente en los eventos terminales del CLI.
3. Conservar el catálogo explícito de Server, hooks, paths exactos de adjuntos, denegaciones, contadores, admisión por perfil, cuarentena, pruebas terminales y ACK. El rol no concede permisos ni sustituye estas barreras.
4. Incluir los bytes del documento del agente en la medición y el límite del contexto efectivamente suministrado. No convertir bytes en tokens ni atribuir una ventana privada al proveedor.
5. Vincular la acreditación MCP a la política nativa de ejecución nueva. La prueba del rol anterior no habilita el rol nuevo; conservar por separado la compatibilidad del protocolo HTTP si su wire no cambia.
6. Antes de una prueba real nueva, cerrar y conciliar los ensayos en curso, verificar el paquete exacto y ejecutar un canario MCP acotado con el mismo proveedor/modelo/esfuerzo. Un timeout no autoriza replay ni fallback.

## Consecuencias

- Consecuencia positiva esperada: una definición propia expresa la tarea de integración en lugar de heredar el comportamiento general de programación. Su eficacia debe medirse, no suponerse.
- Costos o riesgos aceptados: compatibilidad de `call_mcp_tool` en el rol del CLI, identificación terminal y nueva acreditación por política. No relajar el hook si la whitelist no funciona.
- Trabajo posterior: pruebas offline de aislamiento, medición, identidad y cancelación; canario real con cierre/ACK; completar las capacidades pendientes sólo cuando haya evidencia semántica y confirmación exacta.
- Las cohortes08–11 conservan el compilado y la política nativa utilizados originalmente. No se presentan como validación del nuevo rol. Las fichas afectadas permanecen draft/unregistered y no se publica conocimiento por este cambio.

## Primer canario y corrección de compatibilidad

El primer candidato declaraba `call_mcp_tool` dentro de `tools`. Sus pruebas sintéticas no demostraban que ese nombre fuera válido en el rol del CLI. El [canario12](../../evidence/nodia-ai-ai36-c05-role-canary12-canary-report.json) termina en unos3,1s con cero callbacks; el [diagnóstico](../../evidence/nodia-ai-ai36-c05-live-attempt12-native-diagnostics.json) acredita rol inicializado, fase `validating_terminal`, exit3 y categoría `unknown_tool`, después de seis RPC. No es otro timeout119s y el diagnóstico no conserva el nombre exacto rechazado. Su prueba `abandoned_unknown`, cierre y ACK sólo acreditan conciliación, no compatibilidad MCP.

La inspección del binario público verificado encuentra el campo YAML `inheritMcp` en el esquema del agente y su descripción en el changelog embebido. La revisión corrige el documento conforme a ese mecanismo y exige configuración temporal única, conservando hooks/allowlist. Cambiar el documento cambia el fingerprint de política; QA e inferencia siguientes requieren evidencia nueva. Se preservan candidato, pruebas y fallo anteriores sin sobrescribirlos. La compatibilidad real de la revisión sigue pendiente hasta su propio canario.

## Verificación posterior C05-R02

La [continuación R02](../../evidence/nodia-ai-ai36-c05-r02-acceptance.md) conserva la investigación de metadatos y los preflights fallidos sin inferencia. Tras recuperar una observación High válida en la misma instancia, el [canario02](../../evidence/nodia-ai-ai36-c05-r02-role-canary02-canary-report.json) acredita la revisión `inheritMcp`: un callback con nonce, terminal `completed`, proceso cerrado y ACK exacto. El [original AI15](../../evidence/nodia-ai-ai36-c05-r02-role-canary02-original-ai15-report.json) comprueba MCP disponible después y ninguna identidad pendiente. La prueba pertenece a la imagen `902d…`, política `782045…` y selección/configuración observadas; no se transfiere a otro rol, reinicio o proveedor.

Este canario acredita transporte y política del rol, no aceptación de capacidades de negocio ni del compilado Node operativo. Los timeouts de metadatos conservan causa indeterminada; no se amplían sus límites ni se atribuyen a auth/cuota por este resultado. El ADR permanece propuesto, sin aprobación documental automática.

## Referencias

- [ADR-016](ADR-016-antigravity-cli-adapter.md), [ADR-063](ADR-063-nodia-ai-bounded-staged-discovery.md), [política50](../../mvp/50-nodia-ai-ai04-runtime-policy.md).
- [Diagnóstico09](../../evidence/nodia-ai-ai36-c05-live-attempt09-native-diagnostics.json), [diagnóstico10](../../evidence/nodia-ai-ai36-c05-live-attempt10-native-diagnostics.json).
- [Definiciones de agentes](../../../nodia-gemini-microservice/native_execution_agents.py), [sesiones MCP](../../../nodia-gemini-microservice/native_mcp_sessions.py), [presupuesto nativo](../../../nodia-gemini-microservice/native_context_budget.py).
