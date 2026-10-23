# AI-38 — revisión de observaciones concurrentes al recargar

Fecha local: 2026-10-22. Revisión de fuente, sin inferencias, servicios ni cambios operativos ejecutados por este subagente. Las observaciones reales y su correlación HTTP pertenecen a la tarea principal.

## Corrección de la hipótesis de adjuntos

Una lectura inicial del componente hoja `Attachments.tsx` omitió el barrel `index.ts`: la página importa realmente `AttachmentsLoader`. El loader sólo importa y monta la hoja tras intención explícita. El hook padre `useAttachmentDrafts` ya usa `useAttachmentCapabilities(chatId, revision, entries.length > 0)`. Por tanto, **la fuente congelada R01 no solicita capacidades de adjuntos al montar un chat sin borradores y sin abrir ese panel**. Que la hoja consulte al montarse es correcto: su montaje ya es intencional.

Se retiraron íntegramente los cambios exploratorios propios de un segundo acordeón y un guard de auth no necesario para esta hipótesis; no se ejecutaron ni empaquetaron como R02. Los tests del componente vuelven a no tener diff. Se compararon bytes restaurados contra `production_sources` del manifest R01 `cdc832c045cb26a4050d4fcceb979b9b7ef910b3ce3471c56c05cd7f219a1a93`:

| Fuente | SHA256 igual al R01 |
| --- | --- |
| `Attachments.tsx` | `85bae83e20041980946bec12c98fd3efeb90c7f48397d8a76179292493033f4b` |
| `hooks/useAttachmentDrafts.ts` | `ee2fb81ebefe5a1979d643d5a7e0681888c785527945193c4a4c38ccddc92307` |
| `AttachmentsLoader.tsx` | `765b043b9f309acfd571cf91274b8f44578b9af2742b946ceec5536a45d903a5` |
| `index.ts` | `15ebf6d9fd4609a5b76a4ddb8921674d083db10c333130c56833adea4becffc4` |

No se requiere un fix de adjuntos bajo esta hipótesis. No se modifica la evidencia de QA del R01 ni se atribuye causalidad al GET de adjuntos sin haber observado ese GET en la ventana real.

## Otro competidor posible: salud del proveedor

Flujo de fuente confirmado:

1. `AiProviderIndicators` consume `useAiProvidersHealth` al montar. La consulta compartida `ai-providers-health` tiene staleTime y polling120s. Tras recargar, el nuevo QueryClient puede iniciar esa lectura.
2. `GetAiProvidersHealthUseCase.execute` consulta todas las conexiones (`all: true, includes: true`), no sólo la predeterminada que muestra el topbar. Si existe una conexión Gemini activa con Web o Agentic habilitado, inicia una única lectura compartida `GeminiService.getDualEngineStatus` para esa respuesta.
3. `GeminiService.getDualEngineStatus` hace GET privado `/engines/status`. Este endpoint ejecuta `agentic_status` y `web_status` mediante gather.
4. `agentic_status` toma `profiles.operation('agentic')` antes de consultar `agentic.get_status`. Aunque este getter comparte un refresh y conserva un snapshot30s, la reserva del perfil se obtiene antes de acceder a ellos. Si el snapshot expiró, `_observe` espera secuencialmente los comandos no generativos `/usage` y `models` dentro de esa reserva.
5. El preflight NodiaAI recorre `ObserveNodiaAiEligibilityUseCase` → `GeminiNodiaAiAdapterUseCase.observe` → POST privado `/nodia-ai/agentic/observe` → `ChatAdapter.observe`. Este último toma la misma reserva física durante su comprobación y comando `/model`.
6. `ProfileAdmission.reserve` rechaza inmediatamente una segunda reserva con `runtime_busy`; no distingue dos observaciones del perfil de una observación concurrente con ejecución/login. No hay cola ni singleflight del gate entre esos endpoints.

Por tanto, salud y elegibilidad **pueden** competir sin que exista un run o efecto SQL activo. Un snapshot nativo reciente puede devolver sin espera externa y reducir la ventana; no se afirma que toda lectura de health produzca un rechazo. Contadores SQL/nativos de generaciones en cero no descartan un chequeo no generativo transitorio.

Esto es una posibilidad demostrada por el flujo de código, **no una correlación temporal probada de una recarga concreta**. Antes de cambiar coordinación deben correlacionarse la ventana HTTP y las categorías privadas permitidas de health y observe, sin cuerpos, sesiones ni credenciales. No se sustituye `runtime_busy` por disponible y no se eliminan reservas o cuarentenas.

## Propuesta condicionada

Se evaluó diferir la solicitud de elegibilidad detrás de una promesa health ya en vuelo del mismo QueryClient, manteniendo error/reintento, cambio de actor/selección y bloqueos por trabajo real. Un flag `useIsFetching` usado sólo como `enabled` no basta para garantizar el orden al montar: TanStack inicia consultas en `QueryObserver.onSubscribe`; habría que comprobar el estado en el propio queryFn y esperar únicamente la lectura que ya exista, sin `fetchQuery`/`refetch` adicional. La query propia permanecería fetching durante la espera para bloquear también datos positivos anteriores; un error de health liberaría el GET propio en vez de bloquearlo por siempre. Una cancelación del consumidor no debe cancelar la lectura compartida ni permitir un GET tardío del contexto anterior.

**Decisión de integración de la tarea principal: no implementar esa coordinación.** El health HTTP agrega todas las conexiones y su cliente admite45s por las comprobaciones Codex; diferir después la elegibilidad Gemini, cuyo transporte HTTP usa20s, añadiría dependencia y latencia de otras conexiones sin causalidad temporal comprobada. No se incorpora una nueva cola, timeout arbitrario ni caché que fabrique disponibilidad.

Incluso esperar una lectura ya en vuelo sólo coordinaría ese orden dentro de un QueryClient: no evita otra ventana/worker ni un health que empiece después y llegue antes por red. Una garantía global requeriría revisar la coordinación en el dueño del perfil, fuera de este fix Client mínimo.

Se conserva R01: una respuesta real `runtime_busy` bloquea el envío y ofrece reconsulta explícita; no se inicia otra generación, no se modifica health y no se cambia proveedor/modelo. No se creó ni desplegó ClientR02. Esta revisión termina sin cambios de fuente o paquete adicionales; la correlación y aceptación real quedan en el reporte integrado por la tarea principal.
