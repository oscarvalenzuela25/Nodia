# AI-38 — Contrato del ensayo de proxy y adjuntos de 20 MiB

Estado: checklist de aceptación, no recibo de ejecución. Entorno: VM Linux local. Fecha: 2026-10-20.

## Alcance comprobable

El flujo de adjuntos reserva una intención mediante JSON y carga cada archivo mediante `PUT application/octet-stream`; no usa multipart. Por tanto, el cuerpo binario exacto de 20 MiB es de **20.971.520 bytes**, sin sobrecoste de envolvente. Los 40 MiB del mensaje son la suma de sus adjuntos, no un único cuerpo HTTP de 40 MiB. El cambio propuesto debe limitarse a la ruta de contenido de adjuntos de NodiaAI, sin ampliar el límite global ni modificar las reglas del backend.

| Caso | Evidencia necesaria | Resultado que permite afirmar |
|---|---|---|
| Archivo válido de exactamente 20 MiB | Archivo sintético identificado por tamaño y SHA-256; carga autenticada real desde la app; observación HTTP y SQL/R2 del adjunto propio | El límite nginx deja pasar el cuerpo de tamaño máximo y el backend lo conserva |
| Integridad del archivo | HEAD y GET privados del objeto R2 propio, mediante observador operador de sólo lectura y comparados con el SHA-256 del archivo | El transporte y el almacenamiento no truncan ni modifican el contenido; no acredita descarga por UI/API de la aplicación |
| 20 MiB + 1 byte | Fixture válido; rechazo frontend explícito; prueba HTTP separada al proxy, cuando se realice, con 413 y prueba de que no se creó objeto | El límite se mantiene; el rechazo frontend por sí solo no prueba el proxy |
| Backend y reserva | Contrato/DTO y rechazo de reserva con `byte_count` superior al máximo, cuando se realice | El máximo no depende exclusivamente de nginx o la UI |
| Autenticación | Sesión humana existente restaurada o nuevo login Google; ninguna inyección de fixtures, cookies o tokens; metadatos HTTP acotados | La carga ensaya el canal autenticado de la aplicación |
| Revisión en la app | Nombre/tamaño/estado del adjunto y acciones coherentes, feedback visible y captura sin datos ajenos | La aceptación no se basa sólo en un cliente HTTP externo |
| Retiro de material de prueba | Ledger privado de IDs/claves propios; descarte/purga del adjunto propio; SQL y HEAD/GET R2 posteriores | Los objetos y recursos creados para el ensayo quedan retirados sin afectar datos ajenos |
| Nginx reversible | Hash de descriptor previo; `nginx -t`; aplicación; reversión con hash exacto; nueva aplicación final verificada | La configuración durable final admite el máximo y dispone de reversión ensayada |
| Cierre operativo | Cuatro servicios activos; paquetes Node/Client conservados; misma época Gemini; cero trabajos, intentos y slots pendientes | El ensayo no deja una entrega candidata activa ni efectos generativos inciertos |

El ensayo de transporte no exige una nueva inferencia Gemini. Una descarga correcta no acredita OCR, transcripción o uso del archivo por el proveedor; esas modalidades conservan sus recibos independientes. Tampoco certifica TLS, publicación pública, rotación de backups, restore externo o retención remota continua. La ausencia de un objeto vivo no acredita borrado físico del almacenamiento.

El borrador de adjuntos de la UI ofrece subir, revisar y quitar; no tiene una acción de descarga. El alcance de esta ventana es carga real de 20 MiB desde la UI, estado listo, lectura de integridad R2 por el observador operador y descarte desde la UI seguido de ausencia R2. La descarga autenticada de la aplicación ensayada históricamente en AI-32-R05 no se vuelve a acreditar para el archivo de 20 MiB. El rechazo frontend del archivo de 20 MiB + 1 byte, sin crear intención, y el 413 anónimo del proxy son comprobaciones independientes; ninguna implica por sí sola acceso autenticado al archivo.

## Procedencia y seguridad del recibo

Los resultados deben citar fuentes y recibos por ruta y SHA-256. Se preservan los recibos históricos de AI-32 y AI-38; sus antiguos límites de proxy siguen siendo ciertos para su corte. Los archivos sintéticos pueden publicarse mediante manifiesto de tamaños y digests, pero las credenciales, cookies, URLs firmadas, configuración secreta y claves R2 permanecen privadas. No se autoriza listado global ni purga por prefijo amplio: sólo claves y registros de propiedad comprobada del ensayo.

La consolidación acepta únicamente hechos observados en esta ventana y mantiene `AI38_complete:false` y `release_authorized:false`. No cambia las 31 fichas aprobadas, el plan45 ni los paquetes congelados. Las verificaciones que no se ejecuten quedan expresamente pendientes.
