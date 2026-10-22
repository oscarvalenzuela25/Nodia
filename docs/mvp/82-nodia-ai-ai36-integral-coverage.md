# NodiaAI AI-36 — pruebas integrales y cobertura por capacidad

> Estado documental: en revisión; sin aprobación automática.
> Fecha: 2026-10-18.
> Estado técnico actual: C01..C04 implementan84 contratos/adaptadores candidatos. C05 publica en fuentes un primer lote de siete —crear un movimiento financiero y seis ayudantes comunes—, conservando67lecturas anteriores:74capacidades/31fragmentos. Los77candidatos restantes siguen sin publicar. El usuario eligió descubrimiento automático por etapas; implementación y aceptación del nuevo camino están en curso, sin dar por verificadas sus generaciones reales o su despliegue. AI-36 permanece abierto; las cifras siguientes anteriores a C05 son snapshots históricos.

[Plan 45](45-nodia-ai-implementation-plan.md) · [Casos NR-01..34](44-nodia-ai-data-model-review.md) · [Catálogo 40](40-nodia-ai-tool-catalog-v1.md) · [Contratos 41](41-nodia-ai-v1-contracts.md) · [Publicación 52](52-nodia-ai-ai06-knowledge-publication-contract.md).

## Resultado de la revisión

La revisión separa tres cosas que las cifras de las entregas anteriores no permiten equiparar: un ejecutor interno probado, una herramienta con contrato MCP cerrado y una capacidad publicada/verificada con el proveedor. El catálogo original conserva su fecha y cohorte de 177 handlers/156 nombres; el inventario actual contiene 217 handlers y 336 rutas con aliases. Los 40 handlers añadidos corresponden a coordinación de NodiaAI; no crean 40 herramientas de dominio.

Los 141 candidatos de dominio son 67 lecturas/referencias,73 preparadores de cambios y un análisis de factura. Hay 77 puertos internos de preparación:73 de dominio y cuatro flujos seguros. Las 67 lecturas están registradas/publicadas; esos 77 preparadores internos no son herramientas MCP publicadas. El análisis `nodia_invoices_analyze` tampoco equivale automáticamente a OCR nativo o a interpretar un adjunto del chat.

La [matriz por capacidad](../evidence/nodia-ai-ai36-capability-coverage.json) y su [validador](../evidence/scripts/nodia-ai-ai36-capability-coverage.cjs) recorren la cohorte original y el AST actual, enumeran los registros compilados reales, compilan los pares de esquemas de lectura y comprueban correspondencia de nombres, handlers y aliases. Cada fila registra contratos, proyección, autoridad, garantía, publicación, evidencia histórica y pendientes. No convierte coincidencias de nombres ni fixtures estructurales en prueba de operación. Sus fixtures negativas rechazan handlers faltantes, huérfanos, duplicados y deriva de aliases.

El chequeo estructural puede pasar con `readiness:false`; `--require-ready` debe fallar en ese caso. No se reescriben los flags del snapshot inicial para aparentar que un puerto interno cumple un contrato MCP. Los 73 preparadores y el analizador dejan 74 contratos de dominio sin esquema MCP cerrado/adapter/binding comprobado. Al sumar cuatro flujos seguros y seis ayudantes comunes no conectados, hay 84 candidatos bloqueados. Otros cinco ayudantes sí forman parte del runtime actual. Esos conteos describen estados de implementación/publicación, no cuotas del proveedor.

## Pruebas añadidas

### Backend integrado

Una suite compilada nueva compone módulos reales de Nest y PostgreSQL 16 desechable con las 29 migraciones. Usa preparación interna, transporte HTTP humano, desafío/hash/revisión exactos, ejecución y recibos reales. El adaptador del proveedor está sustituido por un puerto que falla si se invoca; no se simula la transacción, la autorización, el efecto o la regla que se comprueba.

Un mismo conjunto cruza Finanzas, Negocios y Reservas. Comprueba revocación entre pasos, conservación de lo comprometido, reanudación explícita sin duplicados, cancelación del sufijo y recuperación de un COMMIT cuya respuesta se perdió. Los informes consultan los efectos persistidos con procedencia separada. Un cambio incompatible se verifica mediante el validador compilado de disponibilidad y metadata sintética de otra versión sobre pasos almacenados; no se presenta como hot reload o despliegue real de otra versión.

El ensayo inicial rechazó una fecha futura inválida de la fixture conforme al dominio; se corrigió el dato sintético, conservando el fallo previo. No hubo un arreglo de producción para hacer pasar ese caso.

### Frontend integrado

Cinco pruebas nuevas recorren componentes, hooks, servicios Axios y schemas reales del cliente. El adaptador HTTP sintético cerrado ofrece respuestas del contrato; no se mockean los coordinadores del comportamiento bajo prueba. Cubren edición con nuevos IDs/bindings, confirmación exacta, doble clic, recibo parcial, reanudación, respuesta HTTP 200 inválida con conciliación sólo GET en ES/EN y cambio de sesión/revocación con respuesta tardía. No se atribuye a estas pruebas atomicidad PostgreSQL ni inferencia Gemini.

Se mide cobertura V8 del módulo por separado de la suite general. Un porcentaje representa sentencias/ramas instrumentadas en esa ejecución; no certifica permisos, rollback SQL, conducta del modelo o aceptación de todas las capacidades. No se introduce un umbral arbitrario ni se modifica la configuración para ocultar archivos.

### Evolución de conocimiento y compatibilidad de pruebas

Una regresión NR-31 usa el loader y ContextBuilder reales con un nuevo producto publicado **sólo en una fixture sintética**. El siguiente contexto descubre su fragmento autorizado y conserva mensajes; el loader del turno anterior continúa fijado a su release y la caché no elude revocación de ámbito. No modifica aprobaciones del corpus real ni prueba un despliegue con la cuenta del proveedor.

El arnés histórico AI-23 suponía que su migración seguía siendo la última. Se ajusta para revertir/restaurar exactamente `1792700000000`, conservando las comprobaciones de columnas y rechazo del rollback con payloads vivos. Mantiene el ledger completo de 29 migraciones y todas las assertions de negocio.

La evolución AI-34 añadió la medición de contexto al protocolo del adaptador. Las fixtures históricas se actualizan a ese contrato, sin sustituir presupuesto por cero, elevar el techo ni truncar el catálogo. El runtime enumera 74 herramientas: 67 de dominio, cinco ayudantes candidatos y dos herramientas técnicas de conocimiento ajenas a la cohorte original. La función nativa real, ejecutada sin red ni perfiles, mide 219.727 bytes incluyendo la primera respuesta `tools/list`, bajo el techo existente de 262.144. La [evidencia](../evidence/nodia-ai-ai36-native-budget-validation.json) no contiene inferencia ni cuotas supuestas. El helper sintético anterior sobreestimaba tres veces el catálogo; se corrige su envelope serializado conservando el overhead de la fixture.

### Corrección del worker detectada por la regresión

La reejecución AI-12 encontró un fallo productivo: agotar el presupuesto de delegación antes de enviar dejaba el run y la reserva física en `unknown`. El checkpoint ahora acredita la identidad exacta de un rechazo local de selección/presupuesto previo a `dispatch_armed`; sólo esa misma excepción permite finalizar como fallo conocido y liberar la reserva. Una excepción distinta, una respuesta SQL incierta o un armado anterior conservan `unknown`, sin replay. No se cambia el límite ni se agrega fallback. Se añaden regresiones de casos de uso y comprobaciones SQL de ambos presupuestos; la activación y los resultados finales se registran por separado.

## Verificación final por capa

La [validación consolidada](../evidence/nodia-ai-ai36-validation.json), la [matriz NR-01..34](../evidence/nodia-ai-ai36-requirements-matrix.json) y el [validador reproducible](../evidence/scripts/validate-nodia-ai-ai36.cjs) conservan hashes y límites por prueba. La matriz clasifica los 34 casos; no convierte evidencia parcial o histórica en aceptación completa. NR-26 conserva explícitamente pendiente la conducta frente a instrucciones embebidas en PDF/voz; una transcripción correcta no la demuestra.

| Capa | Resultado comprobado |
|---|---|
| Suite completa Server | 3.549 pruebas en 219 archivos; cero fallos u omisiones. Las dos specs del rechazo previo al envío se refuerzan y reejecutan después: 67 pruebas correctas. |
| Suite completa Client | 1.773 pruebas en 228 archivos; incluye cinco nuevas pruebas del ciclo de confirmación. |
| Regresiones compiladas/SQL | 30 suites correctas, 1.178 comprobaciones numeradas y dos suites sin contador numerado; [consolidado](../evidence/nodia-ai-ai36-regressions.json). |
| Nuevo cruce HTTP/SQL | 24 comprobaciones y 31 solicitudes HTTP; incluido cambio incompatible sintético y retención sin borrar registros del dominio. [Evidencia](../evidence/nodia-ai-ai36-integration-validation.json). |
| V8 Server | 295 archivos TypeScript de implementación, todos presentes: 85,67 % líneas y 84,21 % ramas. El reporte bruto conserva además 15 JSON; los 27 avisos de parseo corresponden únicamente a Markdown generado, ajeno al código ejecutable. |
| V8 Client | 80 archivos del módulo; 568 pruebas: 95,93 % líneas y 85,29 % ramas. No se suma cobertura de SQL o Gemini a V8. |
| Builds y lint | Ambos builds correctos; lint sin errores, con tres advertencias previas de Server. TSC global de fixtures conserva exactamente los 192 errores en 48 archivos del baseline; cero diagnósticos nuevos. [Detalle](../evidence/nodia-ai-ai36-unit-validation.json). |

Las primeras regresiones de dominio se ejecutaron contra el compilado activado de AI-35. Tras corregir los dos casos de uso, se reejecutan las seis suites de coordinación afectadas y el nuevo cruce AI-36 sobre el candidato final. Cada resultado conserva su manifest; no se atribuye a las 30 suites un único binario que no ejecutaron. Se preservan los fallos iniciales: deriva de fixtures de protocolo, sobreestimación del catálogo, forma de retorno `UPDATE RETURNING` en el driver y el fallo real de clasificación del worker. No se relajan las assertions para obtener verde.

La [activación](../evidence/nodia-ai-ai36-runtime-activation.json) reemplaza sólo dos JavaScript con respaldo privado y rollback exacto, sin migración. API y worker se reinician; Gemini y nginx mantienen sus procesos. La [comprobación final](../evidence/nodia-ai-ai36-final-health.json) acredita 932 archivos, release de conocimiento intacta, 29 migraciones, cuatro servicios activos, cero jobs/intentos/slots inciertos y chat R05 preservado. No demuestra inferencia por devolver health200.

## Trabajo necesario para cerrar AI-36

| Acción | Resultado verificable pendiente |
|---|---|
| AI36-C01 | Contratos/adaptadores de 73 preparadores implementados y verificados en esta continuación; publicación y aceptación real independientes siguen pendientes. |
| AI36-C02 | Cuatro contratos/adaptadores candidatos implementados y verificados en la continuación C02; claves, cookies y login siguen exclusivamente por el canal humano autenticado. Publicación y cuenta real pendientes. |
| AI36-C03 | Implementado como candidato no publicado: contrato de dos acciones, origen acreditado, parser nativo puro, recibos/recuperación y resultado revisable. SQL39+regresiones53; no otra inferencia ni creación comercial. Ver continuación C03. |
| AI36-C04 | Implementados y verificados seis contratos/adaptadores candidatos:4 lecturas y2 preparaciones nativas, con contexto backend, recibos y canal humano independientes. SQL41+regresiones92; sin publicación o inferencia real. Ver continuación C04. |
| AI36-C05 | Primer lote de7publicado en fuentes; descubrimiento automático por etapas en implementación. Matriz151 separa garantías internas, evidencia externa histórica, publicación y aceptación actual pendiente. Permanecen77candidatos sin publicar y gates por capacidad/entorno; AI-38 no absorbe esos pendientes. |

El criterio del plan que exige contratos de los 141 dominios comprobados sigue pendiente. Esta entrega de trazabilidad y pruebas no marca AI-36 completo ni desplaza silenciosamente esos contratos a AI-37/38. NR-33 conserva carga/rendimiento para AI-37; NR-34 conserva restore/cuarentena efectiva para AI-37/38. Que sus filas estén clasificadas en una matriz no significa que esas garantías se hayan ejecutado.

## Límites de esta verificación

Datos sintéticos y PostgreSQL desechable; ninguna nueva inferencia, acceso R2, modificación de datos de negocio configurados o publicación de herramientas. La corrección del worker afecta dos casos de uso; no cambia modelos, credenciales, permisos ni esquema. Se conservan las evidencias reales anteriores con su versión y alcance, sin renovarlas por ejecutar mocks o leer health200. No se reinicia el microservicio Gemini para comprobar pruebas de código.

## Continuación AI36-C01 — contratos y adaptadores de preparación MCP

Solicitud del usuario del 2026-10-18. Esta sección continúa el snapshot anterior; sus cifras de 74 contratos pendientes describen el estado previo y permanecen como evidencia histórica.

Se implementan **73 contratos candidatos cerrados**: 26 de Finanzas/Negocios, 22 de Reservas y 25 de Core/proveedores IA. Los cuatro preparadores de canal seguro no forman parte de estos 73. Cada entrada admite un `partial` específico y la continuación de un borrador mediante ID/revisión inseparables. Se conservan los validadores nativos: sólo se pregunta por mínimos faltantes; fechas, ámbitos, relaciones y dinero se validan por el producto. Los identificadores y los importes de precisión amplia mantienen su representación decimal exacta.

Los contratos residen en `nodia-server/src/nodia-ai-products/contracts/write-*.json`. El módulo `nodia-ai-write-tools` conecta los mismos preparadores que ya utiliza el canal humano; no replica escritores ni acepta SQL, endpoints, actor o sesión enviados por el modelo. Los campos nativos JSON flexibles de proveedor/factura se transportan mediante un árbol tipado cerrado. El límite físico de profundidad y bytes puede ser más estricto que el JSON nativo; no se amplían los límites para ocultarlo. [ADR-061](../architecture/decisions/ADR-061-nodia-ai-mcp-write-preparation.md) registra alternativas, binding y consecuencias.

El gateway admite `prepare_change` condicionado a publicación, hash congelado y autorización vigente. Inserta el tool-call validado dentro de la misma transacción que el borrador/propuesta y completa su recibo tras validar la salida. Si ésta es inválida, se revierte todo el conjunto. Se verifican la proyección completa, la revisión, el vínculo borrador/propuesta, el propietario y la conversación. Una recuperación histórica sólo devuelve el recibo exacto persistido y reautorizado. Preparar no confirma ni ejecuta: el botón humano sobre la propuesta exacta sigue siendo obligatorio.

El registro compone lecturas y escrituras únicamente para los IDs seleccionados por el manifiesto. Con selección de escrituras vacía no instancia sus dependencias SQL/Redis y conserva las lecturas. Se mantiene el release publicado de 67 capacidades/27 fragmentos; las fichas actualizadas siguen draft/unregistered. Los candidatos no aparecen en el catálogo real por existir estos archivos.

Impacto documental: se actualizan las fichas existentes de producto NodiaAI, registro/gateway y coordinación, más sus índices. El cambio añade el transporte de preparación y no cambia reglas o mínimos nativos de los productos; las 27 fichas funcionales aprobadas de lectura conservan su contenido y aprobación. No se incorpora un path nuevo ni se enseña una escritura al contexto publicado antes de revisar su binding.

La [auditoría reproducible de candidatos](../evidence/nodia-ai-ai36-c01-write-contracts.json) diferencia contratos compilados y bindings nativos de publicación. La [validación consolidada C01](../evidence/nodia-ai-ai36-c01-validation.json) enlaza pruebas unitarias, SQL, hashes y fallos iniciales. La [integración PostgreSQL C01](../evidence/nodia-ai-ai36-c01-write-sql-validation.json) usa datos desechables y adaptador de proveedor sintético: 22 comprobaciones, 29 migraciones y ocho solicitudes HTTP. Recorre MCP→borrador incompleto→CAS→propuesta→confirmación HTTP humana→efecto financiero/recibo atómico, además de proveedor con JSON tipado. Comprueba replay sin duplicados, conflicto de payload, revisión obsoleta, revocación, cruce de chats, claves duplicadas, límites y rollback conjunto ante salida inválida.

La regresión final Server pasa **3.880 pruebas en 225 archivos**, sin omisiones, con dos workers. La primera ejecución conserva cuatro fallos en las nuevas pruebas de compilación concurrente; se eliminó la compilación repetida de validadores de fixture y se separaron los 73 casos estructurales por capacidad, manteniendo las assertions y el límite de cinco segundos. Build, tipado de producción y lint correctos; tres advertencias lint previas. El log de TSC global de fixtures permanece idéntico al baseline:192 errores en48 archivos, SHA256 `c5c7c21e659651d0d72bd544cb4adc6ddd4b8bf16e22738a16dbd91356126dc9`, cero diagnósticos nuevos. Cliente y porcentajes V8 anteriores son evidencia histórica y no se reejecutan/recalculan en C01. Una revisión independiente no encontró hallazgos bloqueantes; no sustituye la aceptación individual de las73 capacidades.

Antes de publicar se deben reconciliar tres metadatos del catálogo planificado con los recursos nativos: crear/editar catálogo IA usa `ai_provider_catalog` en vez de `ai_providers`; borrar clave usa `ai_api_keys` en vez de `api_keys`. El adaptador conserva los recursos nativos comprobados. No se renombra el dominio ni se modifica una publicación para ocultar esa diferencia; la auditoría la registra como pendiente de revisión del binding.

No se declara ejecución SQL individual de las 73 operaciones en esta continuación: sus contratos se contrastan con los puertos nativos y DTOs en pruebas, los escritores conservan sus verificaciones históricas y el gateway se verifica con esos dos recorridos representativos. Tampoco hay inferencia Gemini nueva, acceso R2, despliegue de este candidato ni cambios de datos operativos, esquema, modelos o credenciales.

**Estado actualizado:** AI36-C01 completa contratos y adaptadores candidatos con verificación local/SQL; la publicación y la aceptación real siguen pendientes. Del dominio queda un candidato sin contrato/adaptador MCP, el analizador de factura AI36-C03; los 73 preparadores continúan sin publicar. Los 84 candidatos previamente bloqueados no se convierten en herramientas disponibles por esta entrega. C02 y C04 conservan cuatro canales seguros y seis ayudantes por resolver. AI-36 sigue abierto.

Antes de publicar escrituras se necesita seleccionar herramientas y medir el catálogo/contexto con el proveedor: las 74 herramientas actuales más 73 serían 147. El adaptador admite 74 herramientas/131.072 bytes de catálogo; además existen cardinalidad JSON 128 y contexto ensamblado de 262.144 bytes. Son controles distintos y se conservan todos: la selección, coste de arranque y aceptación real se verifican por separado.

## Continuación AI36-C02 — preparación MCP de cuatro flujos seguros

Solicitud del usuario del 2026-10-18. Estado de esta continuación: implementación candidata verificada mediante contratos y SQL aislado; sin publicación ni activación. Las cifras anteriores permanecen como snapshots de sus respectivas entregas.

Se añaden contratos de entrada/salida MCP cerrados y adaptadores para cuatro puertos nativos existentes:

| Herramienta candidata | Entrada parcial permitida | Canal humano posterior |
|---|---|---|
| `nodia_secure_flows_prepare_api_key_create` | Conexión y metadatos públicos de clave: etiqueta, orden, selección y actividad | Introducir el secreto después de confirmar la propuesta exacta |
| `nodia_secure_flows_prepare_api_key_update` | Conexión, clave exacta y metadatos públicos opcionales | Reemplazo opcional del secreto; conservar la clave si sólo se modifican metadatos |
| `nodia_secure_flows_prepare_connection_login` | Conexión y modo Web/Agentic | Login nativo por visor o autorización de la conexión exacta |
| `nodia_secure_flows_prepare_nodia_logout` | Objeto vacío; identidad y sesión derivadas del backend | Cerrar únicamente la sesión Nodia actual del actor |

La entrada conserva `partial`, borrador y revisión CAS. No admite secretos, cookies, códigos, URLs OAuth, referencias humanas/nativas, `payload` de interacción, comandos de visor o actor/sesión elegidos por el modelo. Un parcial incompleto pregunta por los mínimos no secretos; el secreto de una API key no se solicita como mensaje o campo del borrador. Los valores opcionales se completan únicamente conforme a las reglas nativas, incluida la normalización de selección de claves.

`secure-flows.json` se carga por separado de los tres bundles C01. Se extiende el adaptador existente con `prepare_secure_flow`, sin duplicar normalización, autoridad, CAS, revisión pública o recibos. Se rechaza un binding que etiquete uno de estos cuatro puertos como cambio ordinario o un puerto ordinario como seguro. Admisión, descubrimiento y gateway sólo lo ofrecen si existe publicación exacta y permisos vigentes. Los analizadores, conjuntos y preferencias conservan sus gates.

El resultado MCP es exclusivamente la proyección no secreta de borrador/propuesta. Preparar no crea credenciales, no abre login y no cierra sesiones. La confirmación humana admite la ejecución, el worker existente pasa a `waiting_for_user` y libera sus recursos; la UI obtiene el descriptor por su endpoint humano autenticado. Sólo ese canal recibe secretos/códigos o inicia la interacción nativa. La recuperación no transforma una respuesta incierta en un segundo login.

Para el logout propio se conserva la autoridad nativa sin módulos/acciones de destino. El registro MCP declara `/tools/nodia-ai`, requisito basal que el backend ya exige, y el recurso separado `nodia_sessions`; no hereda `/settings/ai-providers` ni `ai:manage` de los otros tres flujos. Esto evita que la unión de rutas de `secure_flows` impida cerrar la sesión propia. La diferencia con el recurso agrupado del catálogo planificado queda explícita para revisar su binding antes de publicar. [ADR-061](../architecture/decisions/ADR-061-nodia-ai-mcp-write-preparation.md#extensión-ai36-c02--cuatro-preparadores-del-canal-seguro) amplía la decisión sin cambiar [ADR-053](../architecture/decisions/ADR-053-nodia-ai-secure-human-interaction.md).

La [auditoría C02](../evidence/nodia-ai-ai36-c02-secure-contracts.json) y la [validación consolidada](../evidence/nodia-ai-ai36-c02-validation.json) separan compilación, contratos nativos, regresión de los 73 hashes C01, SQL aislado y publicación. El estándar documental se aplica actualizando las fichas existentes de NodiaAI, gateway/coordinación y Ajustes Generales/interacción segura. No se cambian las fichas aprobadas de lectura ni se añaden fuentes al registro.

La integración C02 pasa **31 comprobaciones, 25 solicitudes HTTP y 29 migraciones** en PostgreSQL desechable. Los cuatro recorridos llegan desde MCP a propuesta y confirmación humana, y el worker pausa en `waiting_for_user` sin iniciar login. Comprueba alta cifrada/actualización de clave mediante el endpoint humano, inicio/cancelación nativos con transporte simulado y revocación de la sesión Nodia de origen, conservando otra sesión del mismo usuario. Verifica secretos/identidad rechazados, ausencia de acciones humanas registradas en MCP, revisión CAS, replay exacto, conflicto, rollback de salida inválida, revocación y cruce de chats. La regresión C01 añade **22 comprobaciones y ocho HTTP sobre el mismo compilado**, sin atribuirles ejecución individual de los73 escritores.

Verificación final C02: **3.937 pruebas Server en226 archivos**, cero fallos u omisiones con dos workers. Build y tipado de producción correctos, lint sin errores con tres advertencias previas; el tipado global de fixtures conserva exactamente192 errores en48 archivos, mismo SHA256 `c5c7c21e659651d0d72bd544cb4adc6ddd4b8bf16e22738a16dbd91356126dc9`. Auditoría offline compila cuatro pares seguros y compara73 hashes MCP/nativos y bytes/ref de esquemas C01 sin deriva. Revisión independiente sin hallazgos bloqueantes. Cliente y V8 previos permanecen históricos, no reejecutados en esta continuación.

La [evidencia SQL](../evidence/nodia-ai-ai36-c02-secure-sql-validation.json) conserva los tres intentos, el fallo de fixture y sus compilados separados. Los947 archivos de ejecución/assets son idénticos entre intentos; el snapshot final verifica2.750 outputs, incluyendo declaraciones, mapas y metadata incremental. Un refuerzo del último arnés extiende el escaneo de marcadores a once tablas de coordinación, conservando el intento anterior correcto. La [salud posterior](../evidence/nodia-ai-ai36-c02-secure-sql-health.json) comprueba cuatro servicios activos, tres HTTP200 y cero contenedores desechables de ambos namespaces; no acredita paridad del runtime operativo con este candidato, que no se despliega.

El primer intento SQL falló por una expectativa de fixture: una fila de slot en estado `free` no equivale a un recurso ocupado. Se conserva ese fallo y se corrige la aserción para comprobar que la pausa no crea slots nuevos ni conserva slots ocupados; no cambia producción ni relaja la exclusión. La auditoría compara hashes con la misma versión sintética de catálogo que C01, porque ésta forma parte del hash; una primera comparación con otra etiqueta sintética no probaba deriva contractual.

Límites: rechazo estructural de campos secretos no equivale a detectar secretos semánticos pegados en texto libre. La búsqueda de marcadores sintéticos de integración se limita a once tablas enumeradas: borradores, propuestas, pasos de propuesta, mensajes, recibos MCP, eventos, ejecuciones, pasos de ejecución, trabajos, intentos y grants. El canal de claves comprueba cifrado en su tabla nativa aislada. No se declara inspección de todo almacenamiento, DLP, login con cuenta real, Gemini nuevo o disponibilidad de otros modos/modelos por estas pruebas.

C02 no modifica tablas, migraciones, endpoints, UI ni adaptadores nativos. Se conservan las 67 lecturas/27 fragmentos y el release publicado; los 77 preparadores candidatos de C01+C02 permanecen sin publicar. AI-36 continúa abierto por C03/C04 y los gates independientes de selección/publicación y aceptación real. No se elevan los límites de 74 herramientas/131.072 bytes del adaptador ni los de contexto para habilitarlos.


## Continuación AI36-C03 — análisis de facturas en la generación activa

### Contrato y ejecución

`nodia_invoices_analyze` tiene un contrato cerrado de tipo `analyze_attachment` con dos acciones. `prepare` resuelve negocio/proveedor comercial y el adjunto original del mensaje actual, fija la selección real del intento y devuelve las instrucciones nativas. El modelo extrae durante la generación Agentic que ya recibió ese archivo. `complete` valida y normaliza la estructura con el parser nativo privado y guarda un resultado revisable. No crea factura, producto, borrador o propuesta comercial ni confirma una escritura.

No se invoca `AnalyzeInvoiceUseCase` desde MCP: ese OCR legacy iniciaría otra inferencia y competiría por el perfil físico ocupado por la generación activa. [ADR-062](../architecture/decisions/ADR-062-nodia-ai-active-invoice-analysis.md) documenta esta decisión y la alternativa futura de una etapa OCR durable separada. La salida declara `extraction_source:active_agentic_generation` y `review_required:true`; no acredita una segunda inferencia o verificación visual independiente.

El nuevo módulo vertical `nodia-ai-invoice-analysis` compila su candidato sólo mediante publicación explícita. Su configuración vacía no instancia el cliente externo. El gateway, admisión y descubrimiento aceptan análisis exclusivamente mediante el protocolo externo de tres fases; la normalización HTTP ocurre fuera de transacciones SQL. El esquema vive en `nodia-ai-products/contracts/invoice-analysis.json`.

Server acredita, antes de armar el dispatch, el SHA-256/bytes del archivo cargado, generación y epoch reales. Guarda ese manifiesto privado en `stage_contexts` sólo si el analizador está entre los descriptores de la etapa. El callback exige imagen/PDF original listo/vigente del mensaje actual, mismo chat/epoch y metadatos idénticos; no acepta texto revisado, audio, mensajes antiguos, archivos ajenos, URLs o storage keys. Aplica el límite nativo de10 MiB para análisis, sin reducir el general de20 MiB del chat. Hasta100 ítems,32 KiB de instrucciones y64 KiB de contrato JSON, conservando los techos de MCP, cardinalidad, profundidad y presupuesto del intento. No se aceptan overrides de actor, conexión, modo, modelo o intensidad; se revalida la configuración nativa del intento base/delegado.

`POST /nodia-ai/invoice-analysis/contract` es un endpoint privado puro del microservicio existente. Conserva autenticación exclusiva de servicio y rechazo previo al parseo por tamaño/profundidad/duplicados. Comparte `build_invoice_prompt` y `clean_and_parse_invoice_json`, incluidos cinco mapeos, impuesto, cero/null, fechas y cantidades derivadas; no duplica esas reglas en TypeScript, abre perfiles, descarga archivos o realiza inferencia.

La preparación es un recibo completado inmutable. Su scope privado fija origen/configuración y el hash del resultado; el completion se enlaza atómicamente al guardar su recibo. Sólo uno compromete el resultado por análisis. Un resultado terminado se recupera por el endpoint humano con permisos/configuración/origen revalidados, incluso después de terminar el run, sin otra normalización. Un callback de resultado incierto no se ejecuta automáticamente otra vez. La normalización pura puede repetirse bajo otro callback sin inferencia o efecto comercial, manteniendo una sola finalización durable.

### Verificación y límites de entrega

Server final:4.000 pruebas/228 archivos correctos, cero fallos u omisiones. Las44 pruebas del adaptador y107 focalizadas del gateway se conservan como ejecuciones parciales incluidas en la suite, no se suman a4.000. Build, tipado de producción y lint pasan con tres warnings preexistentes; los192 errores globales de fixtures/48 archivos mantienen exactamente el baseline SHA-256, sin diagnósticos nuevos. Cliente/V8 no se repiten al no haber cambios en ese ámbito.

PostgreSQL desechable completa39 comprobaciones C03 ycinco GET humanos, más22 comprobaciones/ocho HTTP de C01 y31/25 de C02:92 checks y38 solicitudes humanas sobre2769 outputs compilados idénticos. El primer intento falló por una captura prematura del adaptador real en la fixture DI; se corrigió el arnés y se preservaron el fallo y su manifiesto, sin cambiar producción. Se retiraron los contenedores desechables y se verificaron servicios y dependencias; no hubo reinicios operativos. Los17 dispatches del arnés,12 preparaciones y8 normalizaciones son sintéticos y corresponden a sus distintos casos, no inferencias Gemini.

El parser y contrato privado Python pasan435/435 pruebas en Linux aislado sin red/perfiles; Windows ejecuta435, con433 correctas ydos omisiones históricas. Se verifican101 archivos del paquete candidato, incluidos95 Python y40 archivos de prueba; no se presenta esa cifra como archivos de producción ni como despliegue. La imagen/ID/StartedAt del Gemini activo permanecen idénticos antes/después.

La [evidencia consolidada C03](../evidence/nodia-ai-ai36-c03-validation.json) registra las suites finales, el build y los informes por capa. La [auditoría offline](../evidence/nodia-ai-ai36-c03-invoice-contracts.json) construye las factories reales, compila ambos contratos y compara los77 hashes MCP/nativos y bytes de schemas C01/C02 sin cambios. No ejecuta el handler ni un proveedor. La prueba SQL usa Nest, worker, admisión, recibos y canal humano reales contra PostgreSQL desechable; almacenamiento, extracción y normalizador son puertos sintéticos explícitos. El parser/endpoint privado real se comprueba separadamente en Python Windows/Linux, no se atribuye al ensayo SQL una inferencia o HTTP nativo que no realizó.

La [ficha nueva](../nodia-ai/knowledge/businesses/features/active-invoice-analysis.md), draft/unregistered y sin aprobación, añade un path explícito:59 fuentes/32 excluidas,27 documentos/fragmentos publicados y67 lecturas conservadas. La release cambia a `41bf6ff92268d406776fd29f07f74871ae966740f14ec45accbfcffd9969a127` por la procedencia del registro; no se modifica ningún binding aprobado ni se publica el analizador. La ficha histórica aprobada de OCR/lecturas permanece intacta. No hay cambios visuales ni impacto en layout, responsive, interacción o bundles cliente.

[Inventario reconciliado](../evidence/nodia-ai-ai36-c03-catalog-delta.json):87 módulos locales,46 controladores,217 handlers,336 aliases y860 hashes TypeScript de producción. Sin nuevas rutas Node, tablas o migraciones:29 migraciones conservadas. La única ruta nueva es el contrato privado puro Python, ajeno al inventario REST de Nodia Server. Los snapshots C01/C02 no se reescriben.

No se despliega el candidato ni se reinicia el servicio Gemini activo; la imagen/sesión y pruebas de modalidades existentes permanecen en su estado anterior. Cero inferencias nuevas, acceso R2 o efectos en datos operativos. La validación funcional del modelo con la cuenta real sigue pendiente de publicación selectiva y aceptación por entorno. No se cargan los78 candidatos junto a los67 publicados por defecto: se conserva el techo de74 herramientas/131072 bytes; elevarlo no es una solución autorizada por esta entrega.

Siguiente paso: C04, seis ayudantes comunes con contratos/fixtures; después selección/publicación compatible con los límites y aceptación Gemini real. AI-36 y las etapas AI-37..40 conservan sus gates. Implementación y evidencia de C03 no constituyen aprobación documental ni cierre de la v1.


## Continuación AI36-C04 — seis ayudantes comunes

### Contratos y autoridad

| Candidato | Clase | Adaptación nativa y límite |
|---|---|---|
| `nodia_proposals_get` | read | PublicProposal nativo de este chat, revisión pública exacta; hash público no confirma |
| `nodia_operations_get` | read | ExecutionStatus nativo de este chat; sin control de ejecución o descriptor privado |
| `nodia_attachments_describe` | read | Metadatos del adjunto de este chat; sin bytes, filename, interpretación, URLs, hashes o claves |
| `nodia_preferences_list` | read | Página de memoria propia, disponibilidad y referencias reautorizadas; super_admin tampoco cambia el dueño |
| `nodia_workflows_prepare` | prepare_workflow | Compone borradores propios y enlaces tipados en propuesta secuencial; no confirma ni ejecuta |
| `nodia_preferences_prepare` | prepare_preference_change | Propone create/update/delete de las cinco claves nativas, con CAS; no cambia memoria aceptada |

Los módulos verticales `nodia-ai-common-reads` y `nodia-ai-common-preparation` implementan contratos cerrados, puertos tipados y selección explícita. Con selección vacía no importan los módulos operativos. El compositor existente resuelve metadata canónica por ruta y un propietario por recurso; lectura/preparación de memoria no requieren claves artificiales ni relajar el registro.

El gateway aporta chat/run/intento desde el contexto backend a las lecturas y prepara un recibo validated antes de las dos nuevas clases de preparación. La mutación de borrador/propuesta y su resultado completed comparten checkpoint/transacción. Repetir un callback completado recupera el recibo exacto y reautoriza el recurso; cambiar payload no reutiliza el callback. Un resultado inválido revierte la preparación y el recibo. No se aceptan actor, sesión, conversation_id, credenciales o HTTP/SQL arbitrario como argumentos.

Las API de lectura nativas ahora permiten reutilizar el manager existente; sus endpoints humanos conservan contrato y transacción propios. Se conserva PublicProposal/ExecutionStatus, incluidos hash público y referencias públicas de resultados; no se entrega un token de confirmación, recovery_descriptor o descriptor del visor. Una propuesta histórica se revalida contra su revisión nativa y campos inmutables; un estado de ejecución almacenado sólo puede referenciar sus pasos/resultados reales. La consulta nueva obtiene el estado actual; el replay conserva el snapshot autorizado de su recibo.

`nodia_preferences_list` conserva la proyección nativa y común —incluye revisión, scope y available—. El bundle candidato explicita el máximo nativo de50 y adapta ramas redundantes de oneOf al compilador estricto, sin cambiar su significado. Los cursores nativos quedan ligados al actor/sesión/filtro. `nodia_preferences_prepare` usa los puertos nativos de memoria, sus hashes y las cinco claves/scope/value permitidos; cualquier cambio efectivo requiere la propuesta exacta y el botón humano. El actor nunca puede nominar otro dueño.

El compositor de conjuntos nativo mantiene el bloqueo humano cuando el chat está ocupado. Únicamente el camino interno MCP acredita el recibo validated, run/usuario/chat y un intento armado vigente antes de preparar dentro de ese run. No crea una ejecución ni abre otro trabajo. [Extensión de ADR-061](../architecture/decisions/ADR-061-nodia-ai-mcp-write-preparation.md#extensión-ai36-c04--ayudantes-comunes-y-preparación-compuesta).

### Verificación y estado de entrega

Server final:4.057 pruebas en230 archivos, cero fallos u omisiones. Incluye20 pruebas nuevas de lectores y28 del adaptador de preparación, más las nuevas regresiones nativas y de gateway/loader; se conservan las ejecuciones focalizadas20/1,92/3 y87/3 como subconjuntos, no se suman a4.057. Build/tipado de producción/lint correctos, tres advertencias previas; los192 errores de fixtures/48 archivos mantienen exactamente el baseline SHA-256, sin errores nuevos. No se repiten cliente, V8 o Python porque no cambiaron.

PostgreSQL desechable completa41 comprobaciones C04 y24 solicitudes HTTP humanas. C01 añade22/8, C02 31/25 yC03 39/5 sobre el mismo ejecutable:133 checks y62 solicitudes HTTP. El paquete final verifica2789 archivos de compilación; la diferencia de un archivo entre el segundo ytercer ensayo es tsconfig.tsbuildinfo, caché de TypeScript, y todos los JS/JSON/MD ejecutables son idénticos. Se mantienen29 migraciones y41 rutas de coordinación, sin tablas/endpoints nuevos. Inventario reconciliado:89 módulos,46 controladores,217 handlers,336 aliases y866 hashes TS; [delta C04](../evidence/nodia-ai-ai36-c04-catalog-delta.json).

Además del fallo real del enum en el primer ensayo, el segundo detectó una expectativa incorrecta del arnés: revocar un módulo del grant congelado invalida todo callback del run, no permite continuar otras herramientas bajo ese grant. La prueba ahora verifica ese rechazo y usa un nuevo run admitido sin el módulo para comprobar preferencias unavailable y preparación denegada. Se preservan ambas ejecuciones fallidas, manifiestos y clasificación; no se cambió la política de producción para hacer pasar el arnés. La ejecución final y las tres regresiones pasan, contenedores desechables retirados, cuatro servicios activos y tres health HTTP200. No hay reinicio ni sustitución del Gemini activo.

La [evidencia consolidada C04](../evidence/nodia-ai-ai36-c04-validation.json) registra las verificaciones finales. Pruebas SQL con PostgreSQL desechable separan la aplicación/worker/canal humano reales del transporte sintético del proveedor; no acreditan inferencia Gemini. La [auditoría offline](../evidence/nodia-ai-ai36-c04-common-contracts.json) y su [script](../evidence/scripts/nodia-ai-ai36-c04-common-contracts.cjs) compilan los seis pares de esquemas y contrasta los78 candidatos C01/C02/C03 anteriores sin reescribir sus snapshots históricos. Contrato compilado, publicación y aceptación real conservan estados independientes.

Se actualizan las fichas draft existentes de [registro/gateway](../nodia-ai/knowledge/nodia-ai/features/capability-registry-gateway.md), [coordinación](../nodia-ai/knowledge/nodia-ai/features/conversation-coordination.md), [memoria](../nodia-ai/knowledge/nodia-ai/features/accepted-preferences.md), [adjuntos](../nodia-ai/knowledge/nodia-ai/features/attachments-and-voice.md) y su [producto](../nodia-ai/knowledge/nodia-ai/README.md). Sin nuevos paths/bindings o aprobaciones:59 fuentes/32 excluidas y67 lecturas/27 fragmentos conservados. La release cambia de41bf6ff9 a e0af65be46d699fcc79ae12e5fd23206fed98e21c64e42058c1a9b58d10839fb exclusivamente por ampliar Capability.kind del schema canónico con las dos clases ya previstas; el resto del manifiesto publicado se compara idéntico. No hay cambios visuales, de interacción responsive o bundle cliente.

Los seis candidatos no se publican por defecto. El runtime continúa con67 lecturas de dominio y siete herramientas técnicas; publicar más exige selección compatible con74 herramientas/131072 bytes de catálogo y los techos independientes de JSON/contexto. No se aumentan límites, migraciones, tablas o endpoints humanos para cerrar C04. Sin despliegue del candidato, reinicio de servicios, inferencias nuevas, R2 o datos operativos. AI-36 conserva C05 y los gates de publicación/aceptación y las etapas siguientes mantienen sus gates.


El primer ensayo SQL de C04 rechazó correctamente el manifiesto sintético porque Capability.kind omitía prepare_workflow y prepare_preference_change. Se conservan el fallo, fuente y manifiesto iniciales. El contrato canónico se amplía con esas dos clases —las cinco anteriores permanecen—, y el loader real tiene regresiones de admisión de ambas/rechazo de una desconocida. El arnés no falsifica sus tipos para obtener verde. Se recompila y repite SQL/suite completa con la nueva huella; se conservan los logs de suites interrumpidas antes de las dos verificaciones finales de referencia/publicación.


Cierre técnico candidato C04: contratos, adaptadores, puertos manager-aware, guard del workflow, contexto/recibos y verificación completados. [Consolidación reproducible](../evidence/scripts/validate-nodia-ai-ai36-c04.cjs) y [SQL](../evidence/nodia-ai-ai36-c04-common-sql-validation.json). Ninguna casilla de publicación, aprobación o aceptación real se completa por estos resultados.

## Continuación AI36-C05 — publicación selectiva y descubrimiento por etapas

### Alcance y estados separados

La instrucción humana del2026-10-18 autoriza avanzar con publicación selectiva y aceptación por capacidad. La [referencia estrecha C05](../evidence/nodia-ai-ai36-c05-publication-authorization.md) registra su texto y el primer lote técnico; no aprueba especificaciones o ADR generales ni atribuye al usuario revisión línea por línea. La decisión posterior «Descubrimiento automático por etapas» define la interacción predeterminada, documentada en [ADR-063 propuesto](../architecture/decisions/ADR-063-nodia-ai-bounded-staged-discovery.md). La aprobación de contenido, publicación, selección enviada, despliegue, inferencia y aceptación productiva mantienen estados independientes.

El primer lote incorpora estos siete contratos:

| Capacidad | Resultado autorizado |
|---|---|
| `nodia_finance_movements_prepare_create` | Borrador/propuesta de un ingreso o gasto individual; mínimos, categoría y estado nativos; nunca crea sin botón humano |
| `nodia_proposals_get` | Revisión pública exacta de una propuesta de este chat |
| `nodia_operations_get` | Estado y resultados públicos de una ejecución de este chat; no reanuda ni ejecuta |
| `nodia_attachments_describe` | Sólo metadatos públicos del adjunto de este chat; sin bytes, nombre, interpretación, URLs, hashes o claves |
| `nodia_preferences_list` | Memoria aceptada exclusivamente propia, paginada y reautorizada; super_admin tampoco nomina otro dueño |
| `nodia_workflows_prepare` | Propuesta secuencial desde borradores propios y enlaces tipados; sin confirmar o ejecutar |
| `nodia_preferences_prepare` | Propuesta de cambio de memoria propia bajo catálogo nativo y CAS; no acepta la preferencia |

Se conservan67lecturas y sus bindings, esquemas, metadata y hashes MCP. El registro pasa a74capacidades,31documentos/fragmentos publicados y59fuentes/28excluidas. No se añaden paths: se publican sólo cuatro secciones mínimas en fichas existentes. Las27fichas aprobadas de lectura conservan su contenido exacto. Los77candidatos restantes, incluido el análisis de factura, no se habilitan por este lote. La [matriz151](../evidence/nodia-ai-ai36-c05-publication-validation.json) separa el estado por capacidad, evidencia interna por familia, observaciones externas históricas y aceptación actual pendiente.

Se conserva el epoch opaco `nodia-ai-ai15-reads/1`: participa en el hash de recuperación y cambiarlo invalidaría las67lecturas aunque sus contratos no cambiaran. El nuevo `release_id` fija contenido y bindings; no se usa un nombre nuevo para forzar compatibilidad. El [script C05](../evidence/scripts/nodia-ai-ai36-c05-publication-build.cjs) construye los schemas MCP con los builders reales, conserva sus bytes/definiciones C01/C04, compara67hashes antes/después de la composición y valida el compilador real. Sus esquemas generados son artefactos de publicación; no duplican a mano las reglas nativas.

### Selección automática sin ampliar autoridad

Las74capacidades globales más siete descriptores técnicos no caben simultáneamente en el techo de74herramientas. La solución elegida conserva ese límite y131072bytes de catálogo, además de JSON128, grant SQL128 y contexto262144bytes. Tampoco trunca el catálogo ni crea un invocador genérico.

El camino predeterminado planificado usa una generación Agentic de descubrimiento con ocho descriptores técnicos: los siete anteriores más `nodia_capabilities_select`. Se descubre el catálogo global publicado y autorizado, ligado a un hash congelado. La selección contiene entre1y67IDs exactos y únicos contra ese catálogo; la lista vacía es inválida y el recibo transaccional queda ligado al mismo run/intento. El callback sólo registra la selección: no amplía el grant de esa generación ni concede módulos, acciones o recursos.

Después de terminar la generación de descubrimiento con prueba terminal y ACK, una etapa local `tool_selection`, sin inferencia, revalida el subconjunto y reemplaza la allowlist del grant por la selección validada, sin exceder módulos/ámbito congelados ni permisos vigentes. Sólo entonces continúa `inference` o `delegated_inference`. La generación de ejecución recibe los contratos seleccionados más siete técnicos; `nodia_capabilities_select` desaparece. Se arma únicamente si el catálogo completo y el contexto caben en sus límites reales. Los ocho técnicos de descubrimiento y74capacidades suman82nombres potenciales en la unión, sin enviarlos juntos.

El camino Agentic que solicita y valida capacidades seleccionadas presupuesta dos generaciones: descubrimiento y ejecución. Sin selección, un saludo, aclaración o consulta resuelta por los ayudantes técnicos —incluidos informes nativos acotados— puede completar en una generación; eso no habilita preparadores de dominio o confirmaciones. La delegación Web→Agentic, exclusivamente con switch opt-in válido de la misma conexión, puede presupuestar tres: Web, descubrimiento y ejecución Agentic. El presupuesto acumulado de tres incluye compactación: si una operación Web delegada también compacta, puede agotarse antes de continuar; no se eleva ni reinicia el contador. No se cambia el modo por un fallo ni se repite una inferencia incierta; cancelación, cierre nativo y conciliación conservan sus garantías entre etapas. Sólo un fallo de ACK puede reintentar la limpieza acotada previa al dispatch; cancelación o estado desconocido impiden una segunda generación. El perfil explícito `finance_assistance` —11lecturas financieras y siete nuevos contratos— queda disponible únicamente para API/backend, pruebas y compatibilidad; no se añade un selector de perfiles a la UI. La matriz lo identifica como selección candidata de18capacidades, nunca como aceptación automática.

Se reutilizan manifiesto, grants, recibos y etapas existentes. Este bloque no introduce Python, tablas, migraciones o UI. La selección no acepta memoria, no confirma propuestas y no ejecuta escrituras por lenguaje natural: cada efecto mantiene la propuesta exacta, botón humano y recibo nativo.

### Revisión y aceptación pendientes

Esta continuación está en revisión. La publicación en fuentes y sus checks offline no acreditan todavía el nuevo camino con el worker, SQL aislado, cuenta real o app. Las suites y resultados posteriores deben enlazarse con su compilado y entorno exactos, conservando fallos y resultados inciertos; no se declara QA de trabajo aún en curso. Los scripts históricos C01..C04 no se reescriben para aparentar publicación o inferencia.

La aceptación debe comprobar selección exacta/catálogo acotado, rechazo de IDs no publicados o no autorizados, revocación entre etapas, replay de selección sin duplicados, cancelación y presupuesto agotado antes de dispatch. Con proveedor real, debe acreditar cierre/ACK de descubrimiento y continuación, callbacks por capacidad y recuperación; para efectos, confirmación HTTP humana y recibo SQL separados de una interacción física/UI. Los reportes por entorno no convierten un piloto de siete en aceptación de las151capacidades ni cierran automáticamente AI-36/38.
