# OpenCode en Nodia · plan de implementación y aceptación

Propuesta técnica para revisión del 25 de noviembre de 2026.
Esta entrega reúne el plan y el catastro. La implementación, la calificación
y la adopción quedan pendientes.

**Objetivo.** Incorporar OpenCode en los modos Agentic y API key y verificar
todos los recorridos generativos de Nodia. Cada recorrido debe funcionar con
una selección OpenCode válida del modo correspondiente. Una capacidad ausente
en un modelo o acceso obliga a seleccionar explícitamente otro modelo,
transporte o acceso de OpenCode capaz y repetir su calificación. Si OpenCode
carece de una ruta viable, la celda queda bloqueada o no soportada con evidencia
y la cobertura solicitada sigue incompleta.

La [matriz reusable91](91-ai-provider-onboarding-verification.md) fija P01–P16
y A01–A08. El [catastro114](114-ai-model-usage-inventory.md) fija las superficies
y casos de producto que deben pasar. Se conservan el [contrato de conexiones](ai-provider-feature-contract.md),
el [runtime común92](92-nodia-ai-api-chat-parity.md), el
[catálogo de herramientas](40-nodia-ai-tool-catalog-v1.md) y la
[política de ejecución](50-nodia-ai-ai04-runtime-policy.md). La [ficha de OpenCode](../nodia-ai/knowledge/nodia-ai/features/opencode-provider.md) queda en borrador.

## 1. Rutas y punto de partida

| Modo Nodia | Ruta candidata | Acceso y evidencia inicial |
| --- | --- | --- |
| Agentic | Nodia Server controla un ejecutor OpenCode oficial, privado y supervisado. Descubre y selecciona el ID del proveedor y modelo del runtime. | Piloto con modelos gratuitos. Si se configura Go para una capacidad, el perfil Agentic usa sus propias credenciales y selección explícita. El ensayo Windows con OpenCode 2.4.1 en modo privado y texto sintético alcanzó HTTP 429 con *DeepSeek V4.1 Flash Free*. Sigue pendiente una respuesta válida. |
| API key · Go | Nodia Server llama directamente al prefijo /inference/go con la clave de la conexión y el formato calificado. | Catálogo público observado. Una prueba real autenticada requiere la clave y el acceso a Go, ambos pendientes para esta entrega. |
| API key · Console por consumo | Nodia Server llama directamente al prefijo /inference con una clave de la conexión y el modelo elegido. | Entrada explícita distinta de Go. La calificación requiere clave, permisos y saldo en el entorno de prueba. Las claves y catálogos se mantienen separados por conexión. |

OpenCode documenta HTTP 403 para clientes externos que solicitan modelos
gratuitos de chat. El CLI oficial permite un piloto sin cuenta con acceso
gratuito, sujeto a cuota y catálogo vigentes. Go documenta identificación del
cliente y un ID estable de sesión para inferencia conversacional. Implementar
el encabezado requerido con una identidad propia de Nodia y un valor opaco
estable por conversación. Console documenta bearer keys personales o de
servicio para inferencia. El modo API key usa la API de inferencia, mientras
que Agentic usa las sesiones del ejecutor OpenCode.
[CLI oficial](https://opencode.ai/docs/cli/commands#run) ·
[Inferencia de Console](https://opencode.ai/docs/console/api/inference) ·
[Uso y endpoints de Go](https://opencode.ai/docs/console/go) ·
[Claves de Console](https://opencode.ai/docs/console/api#api-keys).

La metadata remota orienta el descubrimiento. *GPT 6 Luna* apareció en Go
con Responses, PDF, imágenes, herramientas y salida estructurada. La lista
pública de modelos de chat gratuitos observada anunciaba imágenes en parte
del catálogo y carecía de PDF. El runtime V2 documenta adjuntos PDF para
modelos que los acepten y excluye audio y video de sus adjuntos binarios del
prompt. Console publica modelos de generación de imagen independientes y
OpenCode documenta una ruta experimental de imagen en el runtime. Estas
observaciones permiten diseñar las pruebas y la selección inicial. Su
disponibilidad o equivalencia con el flujo Nodia se determina por inferencia
real, por formato y propósito.
[Catálogo y metadata](https://opencode.ai/docs/console/api/models) ·
[Adjuntos V2](https://opencode.ai/docs/attachments/#formats) ·
[Modelos de imagen en Console](https://opencode.ai/docs/console/models) ·
[API del runtime](https://opencode.ai/docs/api).

## 2. Decisiones de implementación propuestas

- Registrar una identidad propia para OpenCode en el catálogo de Nodia.
  Usar los únicos modos públicos vigentes, Agentic y API key. Seleccionar
  explícitamente el acceso Go o Console al configurar la conexión API. Para
  Agentic, distinguir el proveedor del runtime oficial, su perfil y su
  generación. Un cambio de plan, clave, perfil, binario, configuración
  efectiva o contrato invalida las observaciones afectadas.
- Descubrir por perfil Agentic o por el endpoint autenticado de la conexión
  API elegida. Vincular ID, modalidad, protocolo, opciones de razonamiento
  realmente declaradas y calificación efectiva a conexión, modo, modelo,
  esfuerzo y propósito. Conservar identificadores diferentes aunque
  compartan nombre visible. Tratar metadata ausente como desconocida,
  conservar los ceros y rechazar una selección retirada al enviar. El
  catálogo de arranque se inicia vacío.
- Usar destinos HTTPS oficiales fijos por acceso y protocolo. Validar la
  metadata descubierta contra esa configuración. Para el primer tramo API
  usar Responses si la selección y el endpoint específico pasan P06.
  Agregar Chat Completions, Messages o GenerateContent por necesidad
  demostrada de un propósito, con sus serializadores y pruebas de
  continuación, contenido y errores. Conservar el protocolo seleccionado
  durante toda la ejecución. Mantener la identidad OpenCode en transportes,
  recibos y evidencia aunque el formato sea compatible con otro proveedor.
- Usar el almacén cifrado de claves en Server, con máscara, selección y
  aislamiento por conexión en API key. Agentic obtiene acceso mediante su
  perfil privado. El ensayo gratuito arranca con un perfil desechable y
  credenciales de otros proveedores ausentes. Todo acceso pagado se habilita
  explícitamente y se ensaya con presupuesto acotado. Una cuota desconocida
  queda sin cifra. La prueba de autenticación, el catálogo y la inferencia
  conservan estados distintos en Ajustes IA y topbar.
- Preferir para Agentic un proceso oficial V2 que Server pueda supervisar
  y cuyo cierre y terminación de descendientes se puedan comprobar. Evaluar
  el CLI privado para la prueba de texto y la API/cliente del runtime
  oficial para las sesiones supervisadas. Fijar versión, huella y contrato
  de eventos en cada entorno. Cerrar la elección en un ADR propuesto
  después de acreditar aislamiento, herramientas, abort y conteo de
  despachos. Cualquier proceso persistente debe permanecer en loopback
  o red privada, con autoridad exclusiva de Server y credencial privada.
  [Cliente y eventos](https://opencode.ai/docs/build/client) ·
  [SDK oficial](https://opencode.ai/docs/build/sdk/) ·
  [Frontera de servicios internos](../architecture/internal-microservice-security.md).
- Configurar un directorio y perfil controlados por Nodia, aislados de las
  cuentas y archivos del host. Bloquear shell, edición, red arbitraria,
  plugins/skills no controlados y herramientas ajenas. Permitir sólo el
  transporte MCP privado de Nodia cuando el turno tenga herramientas
  autorizadas. Si se necesita un plugin supervisado para medir inferencia,
  limitarlo al contrato de ejecución y su versión validada. Comprobar
  que el agente ve exclusivamente las herramientas del intento. Revisar
  en pruebas qué lee del entorno y qué archivos entrega al proveedor.
  [Permisos de OpenCode](https://opencode.ai/docs/permissions) ·
  [Transporte MCP de OpenCode](https://opencode.ai/docs/mcp-servers).
- Instrumentar el agente antes de ofrecerlo como modo de producción.
  Acreditar si el runtime puede bloquear reintentos, llamadas de título
  o resumen, compactación automática y rutas de red fuera de la frontera
  controlada. La compactación explícita conserva su propio control del
  presupuesto. Verificar el conteo físico en el adaptador de OpenCode y
  correlacionarlo con el ledger de Nodia. Si una llamada generativa queda
  fuera de la autoridad o el conteo, detener la habilitación del modo
  antes de usar datos del producto.
  [Hooks de sesión y reintento](https://opencode.ai/docs/build/plugins/server).
- Reutilizar la admisión, ToolGateway, selección autorizada, propuestas,
  confirmación humana exacta, idempotencia, persistencia, ACK y recuperación
  de cada producto. En Agentic, los callbacks MCP se vinculan al dueño,
  selección, intento y grants exactos. API usa function calling y
  conserva supports_mcp como false. El modelo accede únicamente al
  catálogo cerrado. Ventas y reportes mantienen sus capacidades de
  consulta. Las escrituras autorizadas de otros módulos requieren
  confirmación humana y escritor nativo.
- Conservar pruebas terminales del transporte correspondiente. Agentic
  demuestra cancelación local y cierre del proceso supervisado con
  identidad exacta. API reserva el presupuesto durable antes de cada
  POST y registra proof3 con cierre HTTP local. Mantener resultado remoto
  unknown al perder una respuesta después del envío, conforme a cada
  contrato. Un ACK es conciliación local y nunca un reenvío. Los intentos
  ejecutan la selección original y evitan rotación, fallback y reintento
  automático ante resultado incierto.

## 3. Secuencia de implementación

| Fase | Trabajo | Salida verificable |
| --- | --- | --- |
| OC-00 · Preparación | Confirmar el SHA base y alcance de los casos del catastro. Crear entorno desechable con Server, Client, worker y PostgreSQL. Fijar binario oficial Windows/Linux y configuración privada. Obtener acceso de prueba Go o Console según modalidad y acordar techo de envíos con el operador. | Línea base y matriz U/P/A por propósito. Credencial ausente o 429 observado quedan bloqueados y localizados. |
| OC-01 · Identidad y configuración | Agregar la entrada OpenCode, resolver perfiles y claves, mapear descubrimiento, razonamiento, retirada de modelos y observaciones de salud. Ajustar selector compartido y lista de modelos por propósito, con Client en ES/EN y acceso por módulo. Si se necesitan migraciones, mantenerlas aditivas y verificar esquema previo y rollback. | P01–P05/P15 y regresiones de OpenAI, Gemini, configuración histórica y Web retirado. |
| OC-02 · Texto API key | Incorporar el transporte seleccionado al runtime HTTP común, incluido User-Agent e ID de sesión de Go. Aplicar retry cero, presupuesto, tamaño, error y prueba terminal. Ejecutar un canary sintético con modelo explícito, respuesta válida y ACK, primero en laboratorio. | P06/P12–P14 y A01–A04. La evidencia declara Go o Console y el formato exactos. |
| OC-03 · Texto Agentic | Integrar el proceso aislado y protocolo de eventos en el adaptador, gates del supervisor, mapa de sesión, leases/fences y cierre recuperable. Validar el perfil gratuito con un texto y correr cancelación, reinicio y aislamiento. | P06/P12–P14 de Agentic, inferencia válida y evidencia de cierre. Si la cuota bloquea, registrar el 429 y esperar disponibilidad para repetir bajo un nuevo intento explícito. |
| OC-04 · NodiaAI y herramientas | Implementar adaptadores de continuación API y MCP Agentic contra ToolGateway. Integrar historial, compactación, selección de capacidades, adjuntos, imagen explícita y OCR conversacional. Aplicar la matriz por tema/operación. | P08–P11/P13 y A02–A08. Una lectura real, preparación real, confirmación SQL una sola vez y pruebas de autoridad negativa. |
| OC-05 · Facturas, Teacher y CV | Conectar los transportes a los puertos comunes de extracción y generación que correspondan. Integrar los propósitos y resultados específicos de cada dominio en ambos modos. Mantener las validaciones de sus propios casos de uso. | Celdas de catastro cerradas en navegador autenticado, Nest, worker y PostgreSQL aislados. |
| OC-06 · Verificación transversal y entrega | Ejecutar los gates específicos por selección, los regresivos y los de fallos del worker. Completar evidencias, fichas e índices aplicables. Ensayar la instalación y rollback en VM Linux y validar por conexión y propósito en el entorno destino. | Auditoría U/P/A con casos positivos, negativos y pendientes por modo. Adopción y activación sólo con evidencia real de la selección y entorno correspondientes. |

OC-02 y OC-03 pueden avanzar en paralelo después de fijar el contrato
común. Los equipos de UI y de cada dominio comparten el mismo registro
de selección y plan de evidencia. La implementación del nuevo adaptador
de OCR revisará tanto el servicio de extracción como el selector y
el camino conversacional. Los transportes de Teacher y CV se conectarán
a sus puertos existentes y mantendrán sus pruebas por propósito.
[Código API de chat](../../nodia-server/src/nodia-ai-adapter/api-nodia-ai-chat-transport.ts) ·
[Extracción API](../../nodia-server/src/common/ai/api-provider.service.ts) ·
[Generación compartida](../../nodia-server/src/ai-generation/ai-generation.module.ts) ·
[Generación CV](../../nodia-server/src/nodia-cv/nodia-cv-generation.worker.ts).

## 4. Cobertura mínima de producto en ambos modos

Repetir cada caso aplicable con la selección exacta de **cada modo**.
Conservar el identificador del [catastro114](114-ai-model-usage-inventory.md)
más el propósito, el MIME y la ruta cuando existan. Cada fila de esta tabla
resume sus subcasos y se verifica con los pasos detallados del catastro.

| Catastro | Cierre Agentic | Cierre API key |
| --- | --- | --- |
| U01 · Ajustes IA, selección y salud | Crear y reabrir conexión y perfil aislados. Descubrir modelo y esfuerzo reales, verificar disconnect, cancelación, actualización y selección en chat/OCR/Teacher/CV según calificación. | Crear y reabrir conexión y clave enmascarada. Distinguir Go y Console, catálogo, entitlement, clave inválida, modelo retirado y disponibilidad. API verde sólo acredita una clave guardada. |
| U02 · NodiaAI texto y continuidad | Turno válido, stream o salida terminal, continuidad en conversación, cambio de selección y compactación aplicable con presupuesto y sesión correctos. | Los mismos recorridos con transporte HTTP, identidad y presupuesto por POST, incluyendo continuaciones sin estado remoto implícito. |
| U03 · NodiaAI herramientas y propuestas | MCP real con lectura autorizada, propuesta revisable y confirmación autenticada. Probar artefactos y flujos dependientes publicados, actor/módulo ajeno, callback tardío y replay. | Mismo catálogo, gateway, ACL, confirmación y recibo con function calling real. Ventas y reportes sólo se consultan en ambos modos. |
| U04 · NodiaAI adjuntos e imagen | Lectura de cada original soportado con firma, ownership, tamaño y expiración. Probar imagen generada por carril explícito, método de entrega privada y persistencia. Audio nativo requiere demostrar un transporte compatible. | Probar cada MIME en el protocolo y combinación seleccionados, incluido el PDF que proceda. Calificar imagen en endpoint y modelo de salida específicos de Console cuando Go no los ofrezca. Descargar, recargar y vencer el artefacto sin otro envío. |
| U05 · Facturas OCR manual | PNG/JPEG/WebP y PDF según contrato del flujo. Si el proveedor acepta sólo imágenes, comprobar total de páginas, orden, resolución, límites y relación con el original antes de calificar un PDF convertido. | Calificar cada formato con el proveedor y protocolo elegidos. En ambos modos validar folio, montos, líneas, ceros, campos ausentes, discrepancias y guardado explícito con recibo. |
| U06 · OCR por NodiaAI | Turno que pregunta proveedor cuando falta, selección autorizada, extracción, comparación y reapertura. Confirmación humana sólo donde el contrato comercial lo permite. | Los mismos pasos en el modo API exacto con planner y extracción reales y presupuesto de A07. Comparación y reapertura reutilizan el resultado en ambos modos. |
| U07 · Teacher guía, propuesta y material | Crear un estudio con selección explícita y, cuando aplique, diagnóstico, propuesta, aceptación y material por etapa. Verificar editor, revisión y continuidad. | Mismos casos y validación por propósito. Conserva la admisión especial de Teacher para primer intento sin canary generativo previo del usuario. |
| U08 · Teacher ayuda, evaluaciones y enriquecimiento | Probar ayuda anclada, práctica, evaluación, corrección y propuesta de ajuste según los propósitos activos. Verificar veracidad de referencias y recuperación. | Mismo conjunto. Cada respuesta se valida contra su esquema y revisión. Una prueba de texto genérico no acredita estos propósitos. |
| U09 · Teacher tarjetas de cita y biblioteca, texto | Probar la generación anclada con la selección de la sesión. Ampliar la admisión de biblioteca con ejecutor Agentic. Verificar texto desde apuntes/cita, regeneración, cancelación, propósito y revisión. | Integrar la selección OpenCode en la generación anclada y en el carril de biblioteca. Verificar los orígenes, regeneraciones y recuperación del borrador en ambos flujos. |
| U10 · Teacher biblioteca de tarjetas, imagen | Integrar un ejecutor Agentic con salida de imagen acreditada. Validar la combinación por propósito y regeneración sólo de imagen o de ambos componentes. | Integrar el endpoint de imagen con actualizaciones por parte, vista previa, retención y limpieza. Verificar aceptación humana del borrador antes de guardar, también en Agentic. |
| U11 · Nodia CV | Generación privada con perfil y oferta sintéticos, citas y hechos autorizados, sin I/O nativo. Cierre por trabajo y prueba de recuperación. | Mismo contrato con una llamada presupuestada. En ambos modos validar el borrador editable, ACK, guardado explícito, PDF verificado y descarga de ambas plantillas sobre la misma revisión. |
| U12 · Recuperación y observabilidad | Stop, silencio, desconexión, kill/reinicio y proceso huérfano, pérdidas de eventos y cierre demostrable. | Abort/timeout, pérdida de respuesta, reinicio, prueba HTTP local y unknown remoto. En ambos modos validar aislamiento, recibo exacto e idempotencia bajo concurrencia. |

**Modalidades y alcance.** La entrada de imágenes, lectura de PDF nativo,
lectura de PDF convertido, audio de entrada y salida de imagen son pruebas
distintas por ruta. El PDF convertido conserva el original para revisión y
resulta elegible únicamente en el flujo que ejecutó esa conversión. Para
imagen generada, seleccionar explícitamente una ruta y modelo de salida
disponibles en el acceso probado, con material sintético. Para Agentic, el
camino actual de adjuntos V2 no ofrece binarios de audio y video. Sólo se
podrá calificar audio nativo si otro transporte oficial cumple el contrato
de Nodia. Dictado y lectura mediante APIs del navegador siguen su QA de
producto independiente cuando no llaman al adaptador. Las generaciones
que se mantienen pospuestas en [plan92](92-nodia-ai-api-chat-parity.md)
conservan sus gates históricos, con evaluación independiente del alcance
nuevo de OpenCode.

## 5. Criterios de evidencia, adopción y reapertura

- Registrar una fila por propósito, acceso, conexión, modo, modelo, esfuerzo,
  versión, SO y entorno. Añadir origen del modelo, fecha real de ejecución,
  identificadores sanitizados de intento y prueba terminal, resultado y
  evidencia. Usar las etiquetas del plan91, con motivo de bloqueo y dominio
  exactos. Revalidar las celdas afectadas al cambiar configuración, perfil,
  credencial, modelo, versión de protocolo o ejecutor.
- Hacer pruebas unitarias focales para transporte, selección, traducción de
  esquemas, callbacks, límites y errores. Usar integración aislada para
  transacciones, permisos, jobs, presupuesto, idempotencia y recuperación.
  La suite en CI usa fixtures sintéticos. Las pruebas reales, laboratorios
  PostgreSQL y recorridos autenticados se observan y registran por separado.
- Probar desde Client selección inicial, interacción con teclado, móvil y
  escritorio en ES/EN, recarga, refetch, vacíos, errores traducidos y
  reintento con borrador preservado. Los negativos incluyen 401, 403, 429,
  retiro de modelo, proveedor caído, payload inválido, tamaño excedido y
  desconexión en distintas fases. Rechazar equipos, cuentas y evidencia
  ajenos. Un bloqueado requiere motivo y próxima acción concreta.
- Mantener secretos, archivos reales, cookies, estados del perfil y
  respuestas crudas fuera de Git y de artefactos públicos. Las nuevas fichas
  o revisiones de conocimiento mantienen estado de borrador hasta aprobación
  explícita. Compilar el contexto publicado contra el
  [contrato52](52-nodia-ai-ai06-knowledge-publication-contract.md).
- Confirmar quiet, respaldos restaurables y pines de Server/Client/runtimes
  antes de una adopción. Probar deshabilitación del proveedor y rollback
  con historial legible, conexiones existentes recuperables y sin replay
  de operaciones inciertas. Publicar el resultado por entorno y propósito.
  La presencia en Ajustes, un catálogo exitoso o una respuesta en una
  modalidad conservan su alcance observado.
- **El primer paso es iniciar OC-00** desde la base del
  PR, preparar el runtime privado en Windows y Linux, obtener acceso para
  API key con presupuesto acordado y repetir P06 de Agentic cuando esté
  disponible la cuota. El primer hito demuestra texto útil por modo y
  habilita el trabajo de producto. La entrega se cierra al completar los
  casos aplicables de ambos modos y resolver los bloqueos del alcance.
