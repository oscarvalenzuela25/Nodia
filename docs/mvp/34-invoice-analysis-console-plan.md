# Plan de acción: consola visual del análisis de facturas

Fecha: 2026-10-08. Estado: **implementado y verificado localmente por solicitud del usuario; aceptación operativa pendiente**. La implementación no aprueba automáticamente documentos ni acredita inferencia con cuentas reales.

## 1. Objetivo y alcance confirmado

Mostrar el avance observable del análisis en `Negocios → detalle → Productos → importar factura`:

- Con espacio suficiente: drag and drop/previsualización a la izquierda y consola a la derecha.
- Al reducir el ancho disponible: consola debajo del drag and drop.
- Mostrar eventos de la ejecución iniciada por el usuario, su estado y los fallos que permitan comprender qué está ocurriendo.

La consola acompaña al análisis y a la preparación del borrador. La extracción sigue siendo revisable: terminar el análisis **no guarda una factura ni actualiza stock**. Conservar el flujo de selección, validación, revisión y guardado existente.

## 2. Dependencias y hechos comprobados

La tabla siguiente conserva la baseline inspeccionada al preparar el plan. Las diferencias implementadas y la evidencia actual se registran en la sección 8.

Fuentes: [contrato IA](ai-provider-feature-contract.md), [autenticación](14-authentication.md#incidencia-de-análisis-desde-negocios--2026-10-06), [incidencias previas](19-prelaunch-review.md), [plan Agentic](32-agentic-cli-implementation-plan.md), [Codex](../features/ai-providers/openai-codex-agentic.md) y ADR-008/009/016/018. Implementar según las skills locales de calidad frontend/backend/Python, componentes, accesibilidad y testing correspondientes.

| Hecho observado en el código | Implicación |
|---|---|
| `ProductInvoiceImport.handleAnalyze` espera `useAnalyzeInvoice`, después consulta histórico de productos y prepara filas. | Hay etapas de Client posteriores a la respuesta IA que también deben distinguirse. |
| `business/infrastructure/services.ts` hace un POST multipart a `/invoices/analyze`, espera JSON y tiene timeout de 360 s. | Actualmente no hay progreso intermedio en el navegador; no basta con añadir un panel visual. |
| `InvoiceController.analyze` crea una señal al cerrar la respuesta principal. | Mantener la cancelación de la petición principal y separar su lifecycle del observador. |
| `AnalyzeInvoiceUseCase` transmite esa señal a Codex, pero no a sus llamadas actuales de Gemini ni API. | La consola no puede prometer cancelación uniforme sin completar la propagación y sus pruebas. |
| Gemini Server usa un deadline propio de 340 s; el microservicio valida el resultado y elimina el archivo temporal. | Conservar plazos, validación y limpieza; observabilidad no autoriza ampliarlos. |
| `agentic_progress.py` observa NDJSON acotado: inicialización, eventos de documento, resultado y antigüedad del último evento. `agentic_service.py` lo resume en logs al terminar. | Reutilizar este parser seguro y publicar categorías mientras suceden. Actualmente no existe un endpoint de progreso público. |
| Codex procesa notificaciones por thread/turn y valida el JSON final en `ExecuteCodexInvoiceUseCase`. | Se pueden traducir notificaciones permitidas a hitos; descartar textos de reasoning y del documento. |
| El catch externo de Codex aún llama `runtime.stop(id)` al abortar, aunque no haya adquirido el lease. | Corregir y probar el P1 documentado antes de aceptar ejecución/cancelación concurrente de esa integración. |
| Gemini Web y API entregan a estos adaptadores una respuesta final; no publican etapas internas de extracción al Client. | Mostrar los hitos reales del adaptador y la espera. El grado de detalle puede variar por modo. |
| Análisis/verificación requieren sesión, sin el permiso adicional `invoice:analyze` según la política vigente. | Mantener esa política; los eventos nuevos sí se aíslan por actor y ejecución, aunque Negocios tenga acceso global. |

No se han ejecutado inferencias ni probado capacidades nuevas de los proveedores durante esta planificación.

## 3. Diseño funcional propuesto

### Distribución

- Incorporar un contenedor común para el bloque de carga/previsualización y `AnalysisConsole`; controles de selección compartidos arriba y resultados editables debajo.
- Umbral inicial propuesto: **900 px de ancho útil del contenedor**, sujeto a QA. El espacio útil importa porque el sidenav reduce el área aunque la ventana sea grande. Resolver con estilos responsive del proyecto/container query, sin listeners de resize ni estado duplicado.
- Dos columnas con `min-width: 0`, separación horizontal 16 px; al apilar, separación vertical 24 px. Respetar el padding de `PageContent`, sin añadir padding exterior duplicado.
- Consola con alto acotado, inicialmente 320–480 px como propuesta de diseño; scroll propio, track transparente y thumb fino adaptado al tema. No ampliar la página con miles de líneas ni aplastar la previsualización PDF/imagen.
- Cabecera: título, estado y duración transcurrida. Mostrar proveedor/modo/modelo **resueltos por Server para esa ejecución**; la selección previa del formulario debe identificarse como selección solicitada hasta recibir confirmación.
- Cada entrada: hora, categoría traducida e icono/estado. El color complementa el texto.

### Estados y comportamiento

| Estado | Presentación y acción |
|---|---|
| Sin análisis | Consola visible con mensaje ES/EN que invita a cargar y analizar una factura. |
| Preparando/subiendo | Hitos locales comprobables y carga suave. Porcentaje únicamente del upload si el transporte entrega bytes enviados y total válidos. |
| Analizando | Lista incremental de hitos y etapa actual; indicador indeterminado. No ocultar la previsualización ni reemplazar la consola por skeleton durante la mutación. |
| Sin nuevos eventos | Conservar la última etapa; informar que se espera respuesta y cuánto tiempo ha pasado desde el último evento. No afirmar que el modelo está bloqueado o que acabó. |
| Observación desconectada | Conservar entradas, aviso de que no se puede actualizar la consola y recuperación **solo del observador**. La inferencia principal continúa si sigue conectada. |
| Extracción validada | Server confirma resultado validado; Client todavía prepara las filas del borrador. |
| Borrador listo | Solo después de recibir la extracción y terminar el mapeo local. Mantener el flujo de revisión/guardado y su feedback existentes. |
| Error/timeout | Conservar archivo, selecciones y entradas; categoría segura, correlación y toast único. Conservar códigos upstream permitidos. |
| Resultado incierto | Diferenciar respuesta principal perdida de fallo confirmado. Un snapshot que diga que Server terminó no recupera por sí solo el JSON de extracción. No reenviar análisis automáticamente. |

La consola sigue el final de la lista mientras el usuario esté abajo. Si revisa entradas anteriores, detener el autoscroll y ofrecer volver a los eventos recientes. Usar `role="log"`/anuncios accesibles moderados, sin anunciar el reloj o cada heartbeat. El foco permanece en la acción del usuario; conservar la navegación actual a resultados tras preparar filas.

### Hitos permitidos y procedencia

| Evento propuesto | Fuente verificable |
|---|---|
| Archivo seleccionado / envío iniciado / progreso de subida | Handler de Client y transporte Axios. |
| Archivo recibido y validado | Interceptor/límites HTTP y `validateInvoiceFile`; rechazo previo al caso de uso requiere integración del pipeline de error con la observación. |
| Conexión y modelo resueltos | Configuración validada del caso de uso; no eco de parámetros sin verificar. |
| Sesión/modelo comprobados | Adaptador correspondiente, únicamente si realiza y supera esa comprobación. |
| Solicitud enviada al proveedor | Punto real de envío del adaptador. No equivale a aceptación del proveedor. |
| Inicialización CLI / evento de lectura iniciado o terminado | Parser Agentic actual, categorías fijas. Un `view_file: DONE` no prueba comprensión del documento. |
| Turno iniciado / respuesta en recepción | Notificación Codex validada para el mismo thread/turn, si está presente. |
| Respuesta recibida / extracción validada | Recepción y validación real del contrato; `result_seen` nunca se traduce directamente a éxito. |
| Consulta de histórico / preparación de filas / borrador listo | Operaciones locales de `handleAnalyze`. Una consulta histórica fallida muestra advertencia y conserva el fallback de catálogo ya existente. |

No ofrecer una secuencia idéntica artificial para todos los proveedores. Web/API pueden permanecer en «Esperando respuesta del proveedor» hasta recibirla. No emitir etapas inventadas como «leyendo página 2», «calculando impuestos» o «80 % de razonamiento».

## 4. Arquitectura y transporte propuestos

**Recomendación para la primera entrega:** conservar el POST multipart y JSON final; añadir una observación acotada por ejecución con polling autenticado. Una consulta de progreso lee eventos ya observados, nunca consulta de nuevo al modelo.

| Alternativa | Evaluación |
|---|---|
| Polling de observaciones + POST actual | Reutiliza Axios/TanStack Query y la renovación central de sesión. Añade peticiones de lectura pequeñas; requiere límites y correlación. Opción propuesta. |
| SSE autenticado + POST actual | Menor latencia de eventos, pero requiere gestionar conexión, renovación, cursor y buffering del proxy. Alternativa relevante a registrar en ADR, si se necesita mayor frecuencia. |
| Reemplazar análisis por jobs durables | Permitiría recuperar resultados tras recargas/reinicios, pero añade persistencia, almacenamiento de documentos, ejecución y política de retención. Ampliación separada si se exige esa garantía. |

Registrar un ADR con el [template](../architecture/decisions/ADR-template.md) antes de implementar el protocolo compartido. Sin nuevo microservicio, sockets ni colas por defecto.

### Contrato público propuesto, aún inexistente

1. `POST /api/v1/invoices/analysis-observations`: reserva una observación para el actor autenticado y contexto solicitado. Devuelve ID opaco generado por Server y expiración. **No inicia inferencia**.
2. `POST /api/v1/invoices/analyze`: añade la cabecera opcional `X-Nodia-Analysis-Id`, validada y vinculada a la reserva **antes de parsear el upload**. Así se pueden correlacionar también rechazos de Multer/archivo excesivo que ocurren antes del caso de uso. Conserva el multipart y JSON actuales. Clientes históricos sin ID mantienen el contrato anterior.
3. `GET /api/v1/invoices/analysis-observations/:id?after=<sequence>`: snapshot de estado más eventos posteriores al cursor, con límite de página y señal de hueco si el buffer ya descartó entradas. No devuelve factura, prompts ni contenido del modelo.

Respetar aliases singular/plural donde corresponda y la versión base de API existente. Los endpoints de observación son nuevos y deben documentarse/probarse antes de consumirse.

- Actor derivado de la sesión, no del body. Cada reserva pertenece a actor/contexto; negocio e IDs solicitados se validan conforme a la política global de Negocios, sin inventar ownership de negocio.
- La capa de adaptación valida/autoriza/reclama la cabecera antes del upload y comunica el resultado a los casos de uso; no lleva lógica de negocio al controller. Verificar allowlist CORS y proxy para la cabecera, sin ampliar orígenes o credenciales permitidos.
- Validar que el análisis coincida con el contexto reservado; reclamar la reserva atómicamente una sola vez. Un ID ya consumido devuelve conflicto sin segunda inferencia. El ID es correlación, no una credencial ni prueba de autorización.
- Eventos tipados con versión, `analysisId`, secuencia monotónica, fecha de Server, etapa/código, severidad y parámetros permitidos. Client traduce códigos ES/EN y valida snapshots/eventos con Zod.
- Estados propuestos de Server: `reserved`, `running`, `succeeded`, `failed`, `cancelled`. La conectividad del observador y «borrador listo» son estados de Client separados; no alteran el resultado de Server. `succeeded` significa extracción validada, nunca factura guardada.
- Estado terminal único. Eventos tardíos de una ejecución anterior no cambian el estado ni las filas de la siguiente.
- Respuestas privadas `no-store`; 401/sesión revocada detienen observación y datos privados. Un ID ajeno/no disponible no revela otra operación.
- Polling inicial propuesto cada 2 s solo durante la ejecución visible; una solicitud en vuelo a la vez. En errores usar backoff acotado, aviso deduplicado y recuperación manual de lectura. Detener al terminar, cambiar contexto, desmontar o cerrar sesión. No repetir el POST de análisis para reconectar.
- El paso de reserva no debe generar un toast de «análisis completado». Mantener un único responsable del feedback de inicio/resultado/error; los eventos incrementales no emiten un toast por línea.

Ejemplo sintético del contrato propuesto, sin texto libre procedente del proveedor:

```json
{
  "version": 1,
  "analysisId": "ef3b9d86-fb40-4d5a-8ee2-bfc12f54a25e",
  "state": "running",
  "events": [
    {
      "sequence": 3,
      "occurredAt": "2026-10-08T18:00:00Z",
      "stage": "provider_request_started",
      "severity": "info",
      "parameters": {}
    }
  ],
  "nextCursor": 3,
  "hasGap": false,
  "errorCode": null
}
```

AC-01 debe fijar el esquema final de identidad resuelta, snapshot, parámetros por categoría, cursor/hueco y errores; no aceptar payloads genéricos de proveedor en `parameters`.

### Almacenamiento temporal y escalado

Propuesta inicial: registro de observaciones en Server con buffer por ejecución, TTL y límites globales/por actor, sin archivos ni JSON de factura. Valores iniciales de diseño a validar: reserva 120 s; retención terminal 5 min; 256 eventos por ejecución y máximo 2 KiB por evento. Estos son **límites propuestos del producto**, no cuotas del proveedor.

Acotar también el total de reservas/ejecuciones, tasas de lectura y lotes por respuesta; medir memoria con los máximos antes de fijar configuración. El registro no sustituye la admisión/locks de los adaptadores. Reservas sin upload y observaciones terminales se purgan.

El almacenamiento en memoria exige un proceso o afinidad explícita de las rutas. Si el despliegue tiene varias réplicas, un store compartido con TTL es requisito previo de esa entrega. No habilitar varias instancias suponiendo que comparten memoria. Tras reinicio/expiración, representar «observación no disponible/estado desconocido», sin inventar un fallo del proveedor ni reenviar inferencia. Recuperación durable del resultado queda fuera de esta propuesta.

### Puente con Gemini y aislamiento

- El navegador llama solo a Nodia Server. Progreso privado en FastAPI exige el token exclusivo de servicio y red privada, conforme a ADR-008.
- Server asigna y transmite correlación privada a la única llamada de análisis. El microservicio mantiene eventos acotados de esa ejecución; Server lee su progreso privado mientras el POST está en vuelo y traduce las categorías permitidas.
- Diseñar registro/lectura privados sin carrera: antes de que la operación se registre, ausencia significa todavía no observado. No asociar la consola al último análisis global ni a stdout de otro usuario.
- Extender `CliProgress` para notificar cambios seguros, sin retener argumentos/texto. Preservar su tolerancia a NDJSON fragmentado, inválido y excesivo.
- Web publica etapas reales alrededor de su llamada actual; no cambiar de API del SDK para inventar detalle. Si se propone streaming adicional, comprobarlo por separado contra la versión instalada y su cancelación.
- El polling privado también es acotado y termina en éxito/error/cancelación/shutdown. Un fallo del puente no repite ni falla deliberadamente la inferencia; la consola declara que perdió esa observación.

## 5. Cancelación, errores y límites de información

- Mantener un único dueño de cada archivo, proceso, lease, timer y suscripción. Cerrar en `finally` y shutdown.
- Completar propagación de la señal del llamador a Gemini/API; comprobar desconexión Server→FastAPI y cancelación del SDK/proceso. Abortar HTTP no garantiza que el proveedor haya dejado de generar: reflejar incertidumbre cuando corresponda.
- Corregir P1 Codex: una operación sin lease propio no puede detener el proceso utilizado por otra. Añadir regresión con dos solicitudes y cancelación antes de obtener admisión.
- Desconectar el observador de progreso no cancela el análisis. Cerrar la petición principal mantiene su política de cancelación y no lanza una segunda generación.
- No añadir un botón nuevo de cancelar como requisito de esta primera consola; si se incorpora posteriormente, exigir antes cancelación comprobada de todos los canales que lo ofrecen.
- No alterar modelos, modos, proveedor, razonamiento, rotación permitida de claves ni deadlines existentes. Cada intento se mantiene separado y una inferencia incierta no se reintenta automáticamente.
- Nunca exponer reasoning interno, prompts, texto del documento, argumentos de herramientas, rutas, cookies, API keys, tokens, stderr o stack traces. La consola es un registro de hitos seguros, sin comandos ejecutables.
- Un contador de eventos o tiempo transcurrido no mide porcentaje completado, consumo de tokens, costo ni tiempo restante. Mantener `null`/desconocido cuando no haya evidencia.

## 6. Tareas y orden de ejecución

AC-01..10 y AC-12 implementadas/verificadas localmente. AC-11 tiene QA sintético local completado y aceptación con proveedores/entorno reales pendiente. No se utilizaron subagentes.

| ID | Trabajo | Archivos/área principal | Depende de | Criterio de cierre |
|---|---|---|---|---|
| AC-01 | Formalizar contrato de eventos, estados, ownership, límites y ADR de transporte/store. | `docs/architecture/decisions/`, este plan, contratos IA. | — | Ejemplos válidos/inválidos, estados terminales, cursor/huecos, contexto y estrategia de despliegue documentados. |
| AC-02 | Corregir ownership de cancelación Codex y auditar propagación de señal a API/Gemini. | `execute-codex-invoice.use-case.ts`, `execute-api-invoice.use-case.ts`, `analyze-invoice.use-case.ts`, `gemini.service.ts`. | AC-01 | Cancelar A nunca termina B; limpieza/deadlines comprobados, sin replay. |
| AC-03 | Implementar reserva/claim/snapshot de observaciones y límites. | Módulo vertical `invoice/`: DTOs, types, infraestructura y `use-case/`; controller delgado. | AC-01 | Actor/contexto correctos, claim atómico, eventos ordenados, TTL/buffer/capacidad y HTTP autenticado verificados. |
| AC-04 | Instrumentar hitos comunes y API; cerrar observación también ante errores previos al caso de uso. | Pipeline multipart/errores, `AnalyzeInvoiceUseCase`, `ExecuteApiInvoiceUseCase`, `ApiProviderService`. | AC-02, AC-03 | Etapas corresponden a acciones realizadas; errores de validación/admisión/credencial/cuota/resultado visibles y seguros. |
| AC-05 | Crear puente de observación privada Gemini Web/Agentic. | `main.py`, contratos/admisión, registro acotado, `agentic_progress.py`, `agentic_service.py`, `gemini_service.py`; `GeminiService` Node. | AC-01, AC-02, AC-03 | Eventos incrementales llegan al Server; aislamiento, NDJSON inválido y limpieza comprobados; observador caído no reenvía inferencia. |
| AC-06 | Instrumentar Codex desde las notificaciones existentes. | `ExecuteCodexInvoiceUseCase`, tipos/eventos de observación. | AC-02, AC-03 | Hitos solo del thread/turn propio; contenido reasoning/documento filtrado; respuesta final sigue validándose. |
| AC-07 | Implementar transporte y lifecycle Client. | `business/infrastructure/{services,useServices,types}.ts`, schema/eventos y hook específico de la consola. | AC-03, AC-04 | Reserva→upload único→observación→JSON final; polling sin solapamiento, cursor/dedupe, auth central y recuperación sin nueva inferencia. |
| AC-08 | Crear `AnalysisConsole` e integrar layout responsive. | `ProductInvoiceImport/{ProductInvoiceImport,styles}.tsx/ts`, componente con `styles.ts`/`index.ts`, traducciones `business` ES/EN y tests espejo. | AC-07 | Dos columnas/apilado por espacio útil, estados, autoscroll, teclado/lector, temas y scrollbars; previsualización conservada. |
| AC-09 | Conectar preparación local del borrador y errores. | `handleAnalyze`, consultas de histórico, mapeo de filas y feedback existente. | AC-07, AC-08 | «Borrador listo» solo al completar filas; fallo de histórico explicado; no guardado automático ni toast duplicado. |
| AC-10 | Ejecutar matriz de regresiones y checks de cada capa. | Tests Client, `use-case/*.spec.ts` Server, integración HTTP compilada y runner Python. | AC-04..AC-09 | Matriz de abajo comprobada; no tests unitarios de controllers/services Server. |
| AC-11 | QA integrada y operacional. | Navegador→Server→adaptadores, proxy/túnel y runtime admitido. | AC-10 | Consola recibe eventos reales; no watcher reinicia Server durante una inferencia; ausencia de evidencia externa declarada. |
| AC-12 | Registrar entrega y pendientes. | Feature en `docs/features/ai-providers/`, contrato IA, 06/07/11 si cambia su decisión y `00-progress.md`. | AC-11 | Evidencia sintética/real separada y límites de despliegue documentados, sin aprobación automática. |

Primer paso operativo pendiente: **AC-11**, comprobar los modos disponibles con cuenta/modelo y despliegue reales. El soporte Windows/cuenta Codex mantiene los pendientes del plan 33.

## 7. Matriz de aceptación

| Escenario | Garantía exigida |
|---|---|
| Escritorio y sidenav expandido/colapsado | Izquierda carga/previsualización, derecha consola, sin overflow ni columnas ilegibles. |
| Ancho útil justo encima/debajo del umbral; 320/390/600 px | Apilado consistente, controles accesibles, botones principales full width en móvil. |
| ES/EN, claro/oscuro, teclado/lector | Traducción completa; color no exclusivo, foco estable, log sin anuncios excesivos. |
| Ninguna ejecución / upload pendiente | Empty state; controles dependientes bloqueados; no porcentajes de inferencia. |
| Mismo catálogo, dos conexiones / dos actores / dos pestañas | ID/contexto propios; ningún evento, resultado o cancelación cruzados. |
| Doble envío o mismo ID concurrente | Una reclamación y como máximo una inferencia iniciada por esa intención. |
| Reserva abandonada, buffer lleno, saturación | TTL y memoria acotados; hueco de cursor explícito, sin inventar eventos descartados. |
| Archivo inválido/excesivo, DTO inválido o modelo sin asignar | Rechazo antes de inferir, observación consistente y archivo/selección revisables. |
| API con éxito/rechazo/cuota; Web sin eventos internos | Hitos reales y detalle según disponibilidad, sin falsa lectura/razonamiento; rotación vigente conservada. |
| Agentic con NDJSON fragmentado/inválido/excesivo | Parser robusto; sin filtración ni éxito por `result_seen`; una generación. |
| Codex sin sesión/runtime/cuota; notificaciones de otro turno | Clasificación correcta y filtrado por thread/turn; no datos de otra ejecución. |
| GET de progreso falla pero POST continúa | Entradas conservadas, aviso único, relectura de eventos; ninguna nueva inferencia. |
| POST falla o devuelve extracción inválida | Evento terminal/error seguro, toast único y sin borrador/stock ficticios. |
| Principal perdida tras resultado / reinicio / observación expirada | Resultado/estado desconocidos representados correctamente; ningún reenvío automático. |
| Cerrar/navegar/cancelar antes de lease o con dos operaciones | Liberación de recursos propios; señal propagada, ninguna operación ajena terminada. |
| Logout, JWT vencido/renovado, sesión revocada, ID ajeno | Auth existente respetada, polling detenido y datos privados limpiados. |
| Respuesta tardía después de iniciar otra ejecución | No altera la consola ni las filas actuales. |
| Histórico falla después de extracción válida | Advertencia diferenciada y mapeo con catálogo existente, sin perder respuesta. |
| Varias réplicas/reinicio de un worker | Store compartido o afinidad comprobados; no declarar la solución en memoria apta para ese despliegue. |

Checks de implementación: Client `test`, `typecheck`, `lint`, `build`; Server `test`, `lint`, `build`, HTTP de análisis/acceso y regresiones IA afectadas; Python `run_tests.py` mediante `.venv` y su aislamiento. Verificar límites/cancelación con fixtures y procesos propios, sin cuota. Después comprobar por separado cada modo realmente disponible con documento sintético y cuenta/entorno autorizados. No atribuir a Codex Windows una prueba realizada en otro OS.

## 8. Entrega local — 2026-10-08

Implementada la consola en `ProductInvoiceImport`, con selectores compartidos arriba y carga/previsualización a la izquierda/consola a la derecha desde 900 px **útiles**. Por debajo se apila; sin listeners de resize. Incluye estados traducidos, duración observada, identidad inicialmente desconocida, log accesible, autoscroll pausado al revisar entradas, control de eventos recientes y barras transparentes. El dropzone ahora funciona también con Enter/Espacio. Se corrigió un desbordamiento del selector de modo en 320 px; acción principal móvil ocupa el ancho disponible.

Transporte implementado según [ADR-019](../architecture/decisions/ADR-019-invoice-analysis-observations.md): reserva autenticada, header opcional, claim único antes de Multer/pipes, validación del contexto, snapshot incremental por cursor y no-store. Actor desde sesión, otro actor 404, repetición 409. Estados/TTL/ring/límites están en el caso de uso Server y registro privado Python. Una reserva valida la forma del contexto; la pertenencia proveedor/negocio y la selección IA se comprueban en el análisis existente. No introduce una nueva política de acceso a Negocios.

API publica envío desde el punto de fetch y recepción del cuerpo, con señal/deadline y sin rotación al cancelar. Gemini tiene puente privado con ID independiente y categorías acotadas; Python reclama antes de parsear multipart. Agentic reutiliza el parser NDJSON durante stdout; Web instrumenta sesión/modelo/envío/respuesta existentes. Codex conserva JSON terminal, descarta mensajes de otro turno y solo detiene perfiles cuyo lease posee; la regresión de dos solicitudes reproduce el P1 anterior.

Client conserva el multipart/JSON final, usa TanStack Query/Axios/Zod, consulta sin solapamiento, hace snapshot final y no reenvía el POST al recuperar seguimiento. Conserva entradas ante caída, diferencia respuesta perdida, añade consulta de histórico/preparación de filas/borrador listo y descarta respuestas tardías. La renovación de token pausa el observador sin abortar la principal; cambio de sesión/actor/negocio, logout y desmontaje la cancelan. Un episodio de fallo del observador tiene un único toast incluso con la caché global; las mutaciones mantienen feedback existente.

### Evidencia ejecutada

- Client: suite completa **963 pruebas / 160 archivos**; después, regresión final de importación **40 pruebas**, incluida protección de doble clic, correcta. Regresiones de consola, renovación de sesión y caché global; tipado/lint/build finales correctos.
- Server: suite completa **764 pruebas / 105 archivos**, incluidas regresiones API/Gemini/Codex; build/lint y HTTP compilado correctos. Lint mantiene dos warnings preexistentes de imports IA ajenos al cambio.
- HTTP real aislado: AuthGuard/ActionPermissionGuard/ValidationPipe/Multer/controlador/casos de uso ejecutados; aliases, ID ajeno, DTO inválido, contexto distinto, archivo >10 MiB, claim duplicado antes/durante ejecución, eventos mientras el principal está abierto y snapshot terminal. Persistencia/auth/adaptador de inferencia sintéticos; ninguna BD/Redis/cuenta consultada.
- Python: **120 pruebas** aisladas; ruta privada autenticada, doble claim sin segunda inferencia, errores previos al adaptador, retención/huecos y NDJSON fragmentado/inválido/acotado. Suites existentes conservan cancelación/limpieza de procesos y Web.
- Navegador: `ProductInvoiceImport` real con transporte sintético temporal, 320/390/600/1280 px, claro/oscuro y ES/EN. Geometría confirma columnas a 1280, apilado a 390/600 y ausencia de overflow de página a 320 tras corregir selectores; tabla interna desplazable. Carga por teclado, selección bloqueada durante análisis, progreso incremental y borrador final comprobados. Fixture/Vite/tab temporales cerrados; no cuenta ni inferencia real.

### Contrato de ejemplo (datos sintéticos)

```json
{"version":1,"id":"9601aa95-dd70-4af3-a5cf-50dd553a4ae9","state":"running","identity":null,"events":[{"version":1,"sequence":1,"occurredAt":"2026-10-08T20:00:00.000Z","stage":"reserved","severity":"info"}],"lastSequence":1,"gap":false}
```

Versiones distintas, UUID inválidos/ajenos, stages libres (`raw_stdout`), fechas inválidas y cursores regresivos se rechazan; ausencia de identidad/modelo permanece `null`. `succeeded` acredita extracción validada, no factura guardada ni stock modificado.

### Pendientes operativos

AC-11: recargar el código en los servicios del entorno autorizado y comprobar cada modo realmente disponible con documento sintético y cuenta/modelo elegidos. No se reiniciaron servicios del usuario, modificó BD ni consumieron cuotas. Codex Windows/cuenta mantiene sus limitaciones previas. Store efímero requiere un proceso por capa; múltiples workers/réplicas necesitan almacenamiento TTL compartido o afinidad comprobada **antes** de desplegar. Reinicio/expiración producen seguimiento desconocido y ningún replay automático; no hay recuperación durable del JSON de extracción. No se acredita performance del VPS ni una auditoría con lector de pantalla real.
