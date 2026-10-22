# AI36-C05-R02 — recuperación de metadatos y rol MCP

Fecha: 2026-10-19. Estado: evidencia congelada, aceptación parcial de cuatro capacidades de siete; sin aprobación documental automática. La [validación derivada](nodia-ai-ai36-c05-r02-validation.json), sus inputs y validador conservan su estado histórico. El defecto del manifest y los nuevos ensayos continúan en [R03](nodia-ai-ai36-c05-r03-acceptance.md).

Esta continuación conserva inmutables el informe, los inputs y el validador de [R01](nodia-ai-ai36-c05-r01-acceptance.md). Parte de tres capacidades aceptadas de siete y 16 solicitudes de inicio nativo aceptadas acumuladas. Es un contador de solicitudes aceptadas por el adaptador, no de tokens, facturación o generaciones upstream comprobadas.

## Alcance y punto de partida

- Recuperar la observación de la sesión y del modelo High configurado dinámicamente; no cambiar el ID, esfuerzo, conexión ni configuración persistida.
- Verificar con un canario real el rol propio que declara `inheritMcp: true`. La evidencia estática del CLI y las pruebas aisladas de R01 no acreditan todavía su uso real.
- Completar `nodia_preferences_prepare`, `nodia_preferences_list`, `nodia_finance_movements_prepare_create` y `nodia_workflows_prepare` con los tres casos independientes existentes. Las escrituras siguen requiriendo confirmación humana sobre la propuesta exacta y recibos atómicos.
- Mantener una sola instancia propietaria del perfil. No ejecutar un segundo CLI, contenedor o adaptador sobre la misma sesión en paralelo.

Baseline observado por el supervisor de laboratorio a las 19:55:57 de la VM: imagen nativa original `b110dbdc78b0f6ec80c98d7ca5c0afe8e8e7fab3a9c46dc60b7eeee0f6855532`, cuatro servicios activos y 932 assets Node iguales al baseline. Sin trabajos, intentos o slots pendientes; R05 conservado. La corrección local del deadline y el rol r02 no están activados en ese baseline.

## Diagnóstico antes de cambiar el runtime

Hechos del código vigente:

1. La observación de sesión ejecuta `/usage` y después `models` dentro de un único plazo de 12 segundos. El segundo comando recibe sólo el tiempo que resta de ese plazo exterior.
2. Una observación válida se reutiliza durante 30 segundos. El fallo no queda acreditado ni se convierte en sesión disponible. La comprobación posterior de `/model` tiene su propio plazo de 10 segundos.
3. El runner espera la salida del proceso y EOF de ambos pipes. Un descendiente puede mantener abierto un pipe después de que termine el padre. La limpieza POSIX mata el grupo incluso si el padre ya terminó; Windows cierra su Job.
4. El código genérico `agentic_unavailable` no acredita credenciales inválidas, cuota agotada ni rechazo del modelo. El plazo exterior también puede producir ese código.

El [control aislado de EOF](nodia-ai-ai36-c05-agentic-metadata-eof-control.json) reproduce en Windows tres variantes —stdout, stderr y ambos—: padre con código cero, descendiente reteniendo el pipe, timeout acotado y limpieza del Job sin proceso residual. Es un control de la hipótesis, sin CLI, red o perfil real; no prueba que sea la causa en Linux.

La [primera observación real de R02](nodia-ai-ai36-c05-r02-metadata02-diagnostic-report.json) instrumenta únicamente la clase de comando y la vida de sus procesos mediante `/proc`; no exporta argv arbitrarios, stdout, archivos de sesión o credenciales. Pasa por el endpoint privado y su `ProfileAdmission` vigente. Resultado: `/usage` permanece vivo aproximadamente 6,884 s; `models`, 1,707 s; ambos completan dentro del plazo de sesión. Después `/model`, con el ID y esfuerzo configurados, permanece vivo aproximadamente 10,031 s hasta el timeout. La respuesta HTTP llega a los 18,671 s con `available: false`, `reason: agentic_timeout`, MCP falso. El muestreo tiene incertidumbre de 20 ms. No se observó un padre que terminase anticipadamente ni un descendiente en su grupo: la hipótesis EOF no explica este ensayo. Una petición HTTP, cero starts de inferencia y cero reinicios.

El [control aislado de cancelación](nodia-ai-ai36-c05-agentic-metadata-cancel-control.json) también conserva ocupado el perfil mientras termina el cleanup de la observación cancelada. Propaga la cancelación y sólo después permite otra reserva. No demuestra una liberación anticipada en ese caso; no se cambia `shield` como supuesto arreglo del timeout. No cubre cancelaciones repetidas durante el cleanup.

El diagnóstico extendido autoriza una única ejecución no generativa de `/model` con límite de 45 segundos, validando cero turnos, cero tokens e ID exacto mediante el parser vigente. Se detienen los consumidores y el propietario habitual antes de utilizar el mismo perfil en un contenedor exclusivo, sin puertos; se conserva imagen, UID, mounts, entorno y recursos. El primer control se detiene antes de crear el contenedor o ejecutar CLI: esperaba que `systemctl stop` eliminase el objeto Docker, cuando lo conserva detenido. Su `finally` restaura los cuatro servicios. Se conserva ese fallo y se corrige la precondición a proceso detenido/PID cero.

La [ejecución siguiente](nodia-ai-ai36-c05-r02-model45-02-report.json) completa `/model` en 3,708 s, exit cero, ID exacto y envelope válido con cero turnos/cero tokens; no deja procesos del runner. Se confirma la ausencia del contenedor exclusivo antes de restaurar la imagen original y los cuatro servicios. Este resultado no identifica la causa de la demora previa ni demuestra una recuperación estable bajo el servicio habitual. No se modifican los límites de producción a partir de una respuesta rápida en la comprobación exclusiva. El diagnóstico no habilita MCP ni acredita las cuatro capacidades pendientes.

## Secuencia y límites de aceptación

Recuperar metadatos → desplegar candidato bajo drenaje y propietario único → canario del rol con callback, terminal, cierre y ACK exactos → casos de preferencias, Finanzas y conjunto dependiente. Cada resultado incierto se concilia antes del siguiente caso; no hay replay automático.

Máximo previsto, si cada gate pasa: un canario y dos generaciones por cada uno de los tres casos, siete nuevos starts aceptados. La aceptación anterior conserva su propia procedencia; completar siete capacidades acumuladas no significa haberlas probado todas bajo la misma imagen o rol.

## Activación y recuperación observada en el servicio

Se activa el candidato inmutable `902d0edc51ae2153d02bd32ad77c496bf1d16ee09d89d98d8dce86bb7cffd8c5`, con las tres fuentes ya verificadas en R01. Node operativo conserva sus 932 assets; el compilado de aceptación conserva su manifiesto independiente. El primer canario de R02 se detiene en su preflight de sesión/catálogo a los aproximadamente 12 s: cero starts nativos, callbacks o inferencias. Se restauran los cuatro servicios y se preserva el resultado fallido.

Una nueva observación controlada, sin reinicio y con métricas de cgroup, completa `/usage` en aproximadamente 6,43 s, `models` en 1,48 s y `/model` en 3,80 s. HTTP devuelve `available: true`, MCP falso, en aproximadamente 11,754 s. No se observa incremento de throttling CPU o eventos de memoria; uso aproximado de memoria 77,4 MiB, límites de dos CPU y 2 GiB. No se observan descendientes reteniendo el grupo. Estas medidas no identifican una causa remota ni prueban ausencia de presión en ensayos anteriores.

El [segundo canario de R02](nodia-ai-ai36-c05-r02-role-canary02-canary-report.json) aprovecha la misma instancia/sesión y conserva el preflight propio del original AI15. El primer canario no había consumido el único start autorizado para esta comprobación. El [original AI15](nodia-ai-ai36-c05-r02-role-canary02-original-ai15-report.json) pasa: un callback con nonce correcto, prueba `completed`, proceso cerrado, ACK exacto y `supports_mcp_after: true`, sin identidad pendiente. El start se acepta a las 20:09:08,137 UTC de la VM; el ACK termina a las 20:09:33,772. El wrapper se reutiliza sin modificar, por lo que conserva su etiqueta histórica `AI-36-C05-R01`; el [supervisor R02](nodia-ai-ai36-c05-r02-role-canary02-runner-report.json) identifica la continuación y su epoch reales.

Resultado: el rol r02 con `inheritMcp` queda acreditado para la selección, configuración y sesión observadas. Un start nuevo y 17 acumulados; cero efectos de negocio y ninguna capacidad nueva aceptada por el canario. Las tres capacidades históricas mantienen su procedencia y las cuatro nuevas requieren sus propios casos semánticos.

## Preferencias: descubrimiento válido, ejecución incierta conciliada

El [caso independiente](nodia-ai-ai36-c05-r02-case-attempt01-preferences-receipt.json) consume dos starts. La selección de capacidades termina y recibe su ACK; la ejecución siguiente agota aproximadamente 119 s sin llamadas MCP. El [diagnóstico estructural](nodia-ai-ai36-c05-r02-case-attempt01-preferences-native-diagnostics.json) registra init y prompt recibido, dos eventos/1.814 bytes de stdout, cero stderr, herramientas, RPC y callbacks; no hay respuesta terminal. No conserva la identidad exacta del agente, que sólo se valida al terminar correctamente, por lo que no se atribuye esa comprobación al intento incierto.

La prueba incierta se concilia con cierre y ACK exactos a las 20:14:53,564 UTC de la VM. No hay efectos ni preferencias aceptadas; SQL y estado nativo quedan sin pendientes y R05 se conserva. El caso no acredita `nodia_preferences_prepare` ni `nodia_preferences_list`, y no se repite automáticamente. Total hasta este caso: tres starts R02/19 acumulados.

Comparación con el ensayo09: prompt canónico, catálogo, contratos, selección y publicación tienen los mismos hashes. El incremento de contexto medido es exactamente el documento del rol, 822 bytes: ejecución 26.982 → 27.804 bytes; discovery 23.769 → 24.591. El presupuesto propio sigue siendo 262.144 bytes; no se infiere una ventana de tokens del proveedor. Los eventos difieren:09 registró `view_file` denegado, R02 ningún evento de herramienta. No se atribuye la espera a tamaño, schema, red, cuota o razonamiento sin un control que lo demuestre.

## Finanzas y conjunto dependiente

El [caso de Finanzas](nodia-ai-ai36-c05-r02-case-attempt01-finance-receipt.json) se ejecuta después de comprobar ACK y ausencia de pendientes. Su descubrimiento consume un start, llega a seis RPC de bootstrap y agota el plazo sin callbacks o terminal completo. Queda conciliado con ACK exacto a las 20:20:22,142 UTC de la VM, sin efectos. No se acredita el preparador financiero ni se repite esa inferencia.

El [caso de conjunto dependiente](nodia-ai-ai36-c05-r02-case-attempt01-workflow-receipt.json) pasa con dos generaciones completas, cierre y ACK de ambas. Sus cuatro verificaciones prueban orden y contenido exactos de los pasos, cero efecto antes de confirmar, una preferencia y un gasto sintético de1234 después de confirmar, y dos recibos nativos completados en el orden esperado. La repetición HTTP es idempotente y recuperar el resultado no vuelve a ejecutar los pasos. Esto acredita `nodia_workflows_prepare`; sus borradores de entrada se construyen por otra vía y no acreditan los preparadores MCP de preferencia o gasto.

La preparación/confirmación utiliza únicamente PostgreSQL desechable. La BD configurada se consulta en modo de sólo lectura; no se acepta físicamente la UI ni se atribuye aceptación productiva.

## Cierre observado de R02

Seis starts nuevos y 22 acumulados. Cuatro capacidades acumuladas: las tres históricas y `nodia_workflows_prepare` en la imagen902d. Preferencias —dos capacidades— y preparación financiera quedan pendientes. Ningún replay automático ni resultado incierto sin conciliar.

Estado observado a las 20:24:17 UTC de la VM: cuatro servicios activos, imagen902d conservada, Node operativo932 intacto, cero trabajos/intentos/slots/pruebas nativas pendientes y R05 preservado. No se equipara este snapshot con disponibilidad futura. El lote siguiente requiere QA del arreglo y canario nuevo; los otros77 candidatos y AI-36 conservan sus gates independientes.
