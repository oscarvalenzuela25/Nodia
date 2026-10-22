# AI-13 — Página de NodiaAI y configuración por conversación

> Estado: implementado y verificado localmente el2026-10-16; no aprueba documentos, publicación de conocimiento ni despliegue del API habitual.
> Alcance: [plan45](45-nodia-ai-implementation-plan.md), [contratos41](41-nodia-ai-v1-contracts.md), [política48](48-nodia-ai-mode-routing-policy.md), [admisión56](56-nodia-ai-ai10-admission-retention.md), [worker57](57-nodia-ai-ai11-durable-worker.md) y [contexto58](58-nodia-ai-ai12-context-execution.md).

La ruta `/tools/nodia-ai` sustituye la presentación de preparación por una página de conversación de texto. El permiso de navegación sigue requiriendo el módulo asignado; el servidor relee autoridad por operación. Añadir una pantalla no habilita herramientas de negocio ni publica los borradores de conocimiento.

## Página y recuperación

- Lista propia paginada, creación idempotente y selección en `?chat=<uuid>`. Abrir o volver al chat sólo hace lecturas; no admite nuevamente mensajes.
- Detalle recupera selección, consentimiento, revisión y `current_run`; polling acotado a turnos en cola, ejecución o cancelación solicitada. Un resultado `unknown` bloquea otro turno y ofrece consulta de estado, sin replay.
- Historial con ventana reciente y paginación hacia mensajes anteriores. El backend conserva la dirección ascendente histórica como predeterminada para consumidores existentes; la página solicita `direction=backward`, con cursor separado por dirección y autoridad.
- Texto plano, sin ejecutar HTML ni interpretar respuestas como acciones. IDs bigint son strings; revisiones y respuestas remotas se validan en el límite con Zod. Mensajes restringidos no incluyen sus partes.
- El POST sólo admite un trabajo durable: el toast confirma recepción, no inferencia completada. Cada intención tiene UUID estable; una recepción incierta conserva texto y clave para recuperación explícita. No hay reintentos automáticos de escritura. Conflictos conocidos conservan el borrador y obligan a recuperar la revisión actual.
- Salir desmonta observadores; el worker independiente continúa. El cliente no inicia otro worker ni cancela trabajo por abandonar la página.

## Drawer y contratos de disponibilidad

`GET /nodia-ai/connections` entrega catálogo paginado bajo autorización NodiaAI, sin exigir acceso administrativo a Ajustes. Contiene instancia, configuración por modo, modelos e intensidades procedentes de configuración/metadata admitida; no devuelve claves, perfiles ni campos privados del proveedor. Los estados desconocidos permanecen desconocidos. No ejecuta inferencias ni probes MCP.

`GET /nodia-ai/connections/:id/eligibility` comprueba la selección exacta y su observación actual, sin generar. Reautoriza antes y después de la consulta externa. Una configuración guardada no equivale a disponibilidad; el backend vuelve a validar en la admisión y antes del despacho. La observación no garantiza que el proveedor siga disponible después.

El drawer selecciona conexión, modo, modelo e intensidad. No elige el primer modelo, no hereda preferencias entre modos y conserva una selección histórica desaparecida para revisión explícita. Las intensidades Low/Medium/High son preferencias documentadas en el contrato de proveedores, no una certificación de soporte; también conserva preferencias históricas válidas recibidas. Su disponibilidad se comprueba para la selección exacta, sin deducirla del nombre del modelo. `null` significa ausencia de preferencia explícita, sujeta a la validación del adaptador.

El catálogo limita su respuesta a1MiB y pagina entre conexiones completas; admite hasta200 modelos guardados por modo más el seleccionado histórico si falta en la sincronización. Un exceso individual produce503 explícito, sin truncar silenciosamente ni elegir un fallback. Son límites propios de la respuesta, no cuotas o restricciones del proveedor; si el catálogo crece por encima de ellos, habrá que añadir paginado/búsqueda de modelos.

Los cambios se aplican entre turnos a la conversación, sin alterar Ajustes globales. Si primero se guarda la selección y después falla el consentimiento, se conserva el primer resultado, se recupera la revisión y se permite corregir/reintentar; dos PATCH no se presentan como una transacción.

El switch está apagado inicialmente y aparece sólo en Web con un destino Agentic observado/verificado de la misma conexión. Usa modelo/intensidad y generaciones exactas del destino; no copia los de Web. Cambiar selección invalida el consentimiento anterior. API sigue diferida. El switch no confirma operaciones de negocio. Si desaparece el destino previamente consentido, se informa y permite desactivar el consentimiento.

## Presentación y accesibilidad

MUI/Emotion y theme existentes; sin padding exterior adicional al de PageContent. Escritorio muestra lista y chat; los anchos estrechos usan un drawer de historial y el mismo estado. Sólo un overlay se abre a la vez y queda vinculado al ID del chat; navegar a otro no conserva un formulario del anterior. Cada mutación fija identidad/sesión/chat al iniciarse y la secuencia de selección/consentimiento se interrumpe si cambia el chat activo. La incertidumbre de envío también se conserva por ID al usar Atrás/Adelante.

El formulario de configuración conserva valores ante refetch, fallo y resize; MUI gestiona foco y retorno. Mensajes y lista tienen scroll contenido y barras transparentes. En móvil, el historial tiene una altura legible mínima y la página puede desplazarse verticalmente para alcanzar el compositor, evitando reducir la lectura a unas pocas líneas con títulos largos. Carga inicial informativa con Boneyard, revalidación suave, errores con aviso/reintento y feedback Sileo ES/EN. El catálogo de modelos se solicita al abrir el drawer.

No se añaden adjuntos, grabación, previews de negocio, carpetas, administración de chats ajenos ni organización avanzada. Renombrar/buscar/fijar/archivar conservan su etapa posterior aunque los endpoints de metadata ya existan. La API de eventos todavía no está materializada por el worker: AI-13 consulta el estado durable, sin emitir eventos vacíos o progreso supuesto; eventos/deltas completos quedan en AI-16.

## Verificación y límites

[Evidencia de entrega](../evidence/nodia-ai-ai13-validation.json), con comandos y hashes de16 fuentes finales:

- Client: **1248 pruebas/196 archivos**,49 focales/5 archivos, typecheck/lint/build correctos. Conserva avisos previos de chunks grandes/timing del build; no implica un benchmark de rendimiento.
- Server: **1266 pruebas/144 archivos**,34 focales y21 comprobaciones HTTP compilado/PostgreSQL desechable con adaptador sintético. Build/tipado correctos, lint sin errores y tres warnings previos. Sin cambios de esquema o migraciones nuevas.
- Contratos:125 schemas/222 fixtures,269 hashes; AST45 módulos/36 controladores/187 handlers/306 rutas. Coordinación10/28 implementadas; ninguna herramienta de negocio publicada.
- [QA navegador](../evidence/nodia-ai-ai13-browser-qa.json):28 combinaciones320/390/599/600/899/900/1440px × ES/EN × claro/oscuro y siete escenarios de interacción, Chrome155; cero errores JS o tráfico API real. En12 casos móviles el área de mensajes mide360px y el compositor es alcanzable mediante scroll natural. Capturas de [página320](../evidence/nodia-ai-ai13-browser-320-main-dark-es.png), [drawer320](../evidence/nodia-ai-ai13-browser-320-dark-es.png) y [escritorio1440](../evidence/nodia-ai-ai13-browser-1440-light-en.png).
- Retorno sin POST, UUID/payload original ante incertidumbre, identidad inmutable tras navegación, revisión obsoleta, resultado unknown, fallo parcial de configuración y202 seguido de pérdida del observador tienen regresiones. Un202 confirmado conserva el run en caché; al recuperar un estado completado aparece el assistant sellado sin segundo POST.
- knowledge:check mantiene43 draft/unregistered excluidos y0 documentos/fragmentos publicados. Fichas actualizadas sin aprobación automática.

El navegador usa servicios, página, drawer y theme reales con fixtures Axios aisladas. No demuestra inferencia Gemini desde la nueva UI, shell autenticado completo, teléfono físico/teclado virtual ni otros motores. Los ensayos Gemini AI-11/12 permanecen separados. [Vista de revisión sintética](http://127.0.0.1:5194/src/test/manual/nodia-ai/index.html?lang=es&theme=dark), servidor5194; Client5174 y túnel3100 existentes continúan escuchando.

El API habitual del laboratorio conservaba su release anterior al comenzar esta etapa. Un build verificado no lo actualiza automáticamente ni aplica migraciones sobre la base de uso. Despliegue, aceptación productiva y gates50 siguen su plan propio.

[Ficha funcional](../nodia-ai/knowledge/nodia-ai/features/conversation-coordination.md) · [Producto](../nodia-ai/knowledge/nodia-ai/README.md).
