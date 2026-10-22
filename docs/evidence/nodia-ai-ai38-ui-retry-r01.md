# AI-38 — UI autenticada y continuidad de lectura tras la reversión

Fecha: 2026-10-20. Entorno: VM Linux local, acceso cerrado por túnel a localhost. Este corte complementa el [ensayo anterior](nodia-ai-ai38-adoption-r01.md), cuyo [consolidado histórico](nodia-ai-ai38-adoption-validation.json) permanece intacto. La aceptación de este alcance no completa AI-38 ni autoriza una entrega pública.

## Resultado observado

Se verificaron el ingreso humano ordinario de Google, la página privada NodiaAI, el drawer y la recuperación de un chat existente después de volver al servidor original. Los paquetes completos congelados Server/Client se activaron temporalmente y se revirtieron con los descriptores originales exactos. No se solicitaron mensajes nuevos, generaciones del proveedor, escrituras de selección, cambios comerciales ni nuevas conversaciones.

La [UI real](nodia-ai-ai38-adoption-ui-r02.json) conserva observaciones y cinco capturas. El [observer de la ventana candidata](nodia-ai-ai38-ui-retry-observer-end-r01.json) registró POST `auth/login` HTTP200, GET `auth/me` HTTP200, GET `authorization/context` HTTP200 y lecturas de conversaciones, historial, catálogo y elegibilidad HTTP200. El usuario completó el login por su cuenta; no se extrajeron, inyectaron o transfirieron tokens, cookies, credenciales o sesiones de fixtures.

Se navegó Inicio → NodiaAI, se abrió el chat propio y se recargó su ruta profunda mientras estaba activo el candidato. En el drawer se exploró Web → Agentic → Web como borrador local, y se canceló sin aplicar. Se observaron los nombres de modelo e intensidad entregados por el catálogo real; los IDs persistidos se obtuvieron por separado desde SQL readonly, sin atribuirlos a controles que sólo muestran etiquetas. Se comprobó el retorno de foco a Configuración. Las capturas cubren escritorio1440×900 y viewport390×844; las [métricas móviles](nodia-ai-ai38-ui-drawer-mobile-metrics-r01.json) muestran ancho390 sin overflow horizontal y acciones de cerrar/cancelar/aplicar visibles. Es una prueba de viewport, no de teléfono físico o teclado táctil.

## Continuidad entre las dos versiones

Después de [revertir el candidato](nodia-ai-ai38-adoption-rollback-r04.json), se mantuvo la SPA ya cargada y se navegó del chat objetivo a otro chat existente y de vuelta. Un [observer nuevo, iniciado después de la reversión](nodia-ai-ai38-ui-retry-post-observer-end-r01.json), registró GET200 del detalle y los mensajes del objetivo contra el servidor original. También registró una petición de elegibilidad499 y otra200 durante el cambio de chat; no se deduce de ello un fallo del proveedor.

Los [artículos de mensajes visibles antes](nodia-ai-ai38-ui-history-before-r01.json) y [después](nodia-ai-ai38-ui-history-after-r01.json) son dos y tienen el mismo SHA256 `dd494d05824faced40a465036e5008d2ab4b151439f484a58a9fbe6b55a931d1`. El texto no se guardó en esas proyecciones. Los snapshots SQL [previo](nodia-ai-ai38-ui-chat-before-r01.json) y [posterior](nodia-ai-ai38-ui-chat-after-r01.json), tomados en transacciones repeatable read readonly, conservan exactamente su proyección y SHA256 `745366408fc4ac99460e3f22682d46606c45814f8c0ea6cb75a15906e95238e5`: una conversación, dos mensajes, cinco partes, un run, un job y dos intentos históricos; selección Web existente y cero trabajos, intentos o slots pendientes. No se crearon duplicados en esa proyección.

Esta comprobación acredita continuidad de lectura de un historial existente y de su selección, no una nueva respuesta del proveedor ni igualdad de todas las columnas de toda la base. El nginx original devuelve404 en la raíz; por eso el ensayo posterior conservó la SPA cargada. La recarga completa de la página después de revertir no forma parte de la aceptación.

## Repetición controlada y cierre

La [continuación R04](nodia-ai-ai38-adoption-continuation-r04.json) reutiliza el staging congelado y los helpers revisados, conservando todos los recibos anteriores. El [snapshot inicial](nodia-ai-ai38-ui-retry-entry-r01.json) acredita el servidor original antes de la nueva ventana. Tras detener API/worker con comprobaciones repetidas de quietud, se creó un [backup nuevo AES256/MDC](nodia-ai-ai38-adoption-backup-r04.json) y se verificó su restauración en PostgreSQL aislado sin red, puertos ni contenido servido. Las62 tablas,29 migraciones, filas y esquema lógico quedaron contrastados, incluida la comparación nativa de CHECK ya acreditada en el ensayo previo. No se restauró la base de datos original.

La [activación R04](nodia-ai-ai38-adoption-activate-r04.json) y el [inspector independiente del candidato](nodia-ai-ai38-adoption-runtime-candidate-r04.json) acreditan ambos paquetes completos, los procesos efectivos y los171 outputs del cliente servidos con bytes exactos mediante174 comprobaciones HTTP. La reversión restableció el servidor original de932 outputs y los descriptores exactos. La imagen, descriptor y época de Gemini permanecieron iguales, sin reinicios, migraciones nuevas o replay de inferencias.

La [purga R04](nodia-ai-ai38-adoption-backup-purge-r04.json) retiró la copia cifrada, la clave y las unidades de expiración propias después de verificar la reversión. El [cierre local](nodia-ai-ai38-adoption-localclosure-r02.json) acredita cierre de pestaña y túnel propios, reset del viewport y cero listeners restantes en5174, sin terminar procesos ajenos. El [snapshot final](nodia-ai-ai38-adoption-runtime-final-r04.json) conserva API, worker, Gemini y nginx originales activos, identidad de Node y Gemini intactas y cero pendientes SQL/nativos. La VM permanece encendida.

## Validación y límites

El [consolidado complementario](nodia-ai-ai38-ui-retry-validation.json) se genera mediante [checker offline](scripts/validate-nodia-ai-ai38-ui-retry.cjs) con un [contrato de paths explícitos](nodia-ai-ai38-ui-retry-input-r01.json). Contrasta la cadena de recibos, épocas, backup fresco/purga, identidad efectiva, observadores separados, capturas, proyecciones SQL/DOM y limpieza final. Sus controles de aceptación incluyen un positivo, siete negativos y preservación del estado parcial. No se importan runtimes, consultan servicios o efectúan cambios de VM al ejecutarlo.

El login ordinario puede persistir sesión o perfil; no se afirma cero escrituras totales en la base. Los controladores del ensayo y snapshots no escribieron datos comerciales. Las peticiones nginx son metadatos corroborantes dentro de ventanas de UI exclusivas; por sí solas no identifican un navegador ni prueban una generación o efecto comercial.

Permanecen independientes los gates de HTTPS/orígenes públicos, rotación cifrada externa, journal e inventario/restore de objetos/versiones. El límite heredado de nginx es11MiB y no acepta aún el contrato de adjuntos de20MiB. No se verificaron en esta ventana R2, subida/descarga de adjuntos, nueva cuenta Google, API keys, login de proveedor, una nueva generación o un efecto comercial. La purga acredita ausencia de archivos y unidades propias, no borrado físico ni rotación externa. Los relojes y sus tolerancias no cambiaron; el orden usa observaciones de la VM.

Los31 documentos de conocimiento aprobados y su publicación se conservan. Este ensayo no aprueba documentación nueva, no publica herramientas y no completa las77 capacidades candidatas pendientes de AI-36.
