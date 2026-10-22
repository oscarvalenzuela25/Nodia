# AI-32: adjuntos sintéticos aislados

Desde `nodia-client`, ejecutar `npm run dev -- --host 127.0.0.1 --port 5196 --mode qa-ai32` y abrir `http://127.0.0.1:5196/src/test/manual/ai32/frame.html?lang=es&theme=dark`.

El adaptador rechaza peticiones ajenas a los endpoints sintéticos de adjuntos. No accede a BD, API ni proveedor. El micrófono real sólo se solicitaría si se pulsa grabar; no hacerlo durante QA de layout. Las respuestas, contenido y metadatos del PDF son fixtures claramente sintéticas.

Comprobar ES/EN, claro/oscuro, 320/390/599/600/900/1440 px; añadir PDF, subir, corregir texto, simular fallo de revisión y reintentar conservando texto. La expansión mantiene el borrador al redimensionar; el scroll del panel es local y transparente. La vista muestra límites del endpoint, ceros reales e IDs de adjuntos, nunca URLs externas ni payload binario. Estas comprobaciones no acreditan inspección multimedia, R2 o Gemini real.
