# ADR-062 — Análisis de factura dentro de la generación Agentic activa

> Estado: propuesto
> Fecha: 2026-10-18

## Contexto

AI36-C03 necesita un contrato MCP cerrado para analizar un adjunto, sin crear una factura ni sortear su revisión humana. El OCR legacy `AnalyzeInvoiceUseCase` inicia otra generación; invocarlo dentro del callback MCP de Agentic intentaría adquirir el mismo perfil físico que la generación activa mantiene ocupado. Su resultado y presupuesto tampoco pertenecen al intento durable actual. La autenticación de una sesión no demuestra disponibilidad de inferencia.

## Opciones consideradas

### Opción A — Invocar OCR legacy desde el callback

Reutiliza su endpoint pero genera dependencia circular del perfil, nueva inferencia y un resultado no conciliable mediante el recibo actual. Se descarta.

### Opción B — Añadir una etapa OCR durable separada

Permite otra generación observada, a cambio de introducir transición, presupuesto y recuperación específicos. Es válida para una extensión futura, pero no se simula con una llamada anidada.

### Opción C — Extraer en la generación activa y validar con el parser nativo

Reutiliza el archivo ya enviado y las reglas de proveedor comercial sin otra inferencia. Exige dos callbacks, acreditación de origen y un resultado explícitamente pendiente de revisión.

## Decisión

Implementar C como candidato no publicado `nodia_invoices_analyze`, de tipo `analyze_attachment`, con acciones cerradas `prepare` y `complete`. `prepare` fija negocio, proveedor opcional, adjunto y selección real del intento; entrega las instrucciones de extracción nativas. Agentic extrae en su generación activa y `complete` valida esa estructura mediante el endpoint privado puro `/nodia-ai/invoice-analysis/contract`. El endpoint comparte `build_invoice_prompt` y `clean_and_parse_invoice_json`; no abre perfiles, descarga archivos ni realiza inferencia. Es una ruta del microservicio privado existente, protegida conforme ADR-008, no un servicio nuevo.

Antes de armar el dispatch, Server acredita generación, SHA-256, bytes, MIME y epoch del archivo efectivamente cargado en el mensaje actual. Esa evidencia permanece privada en el contexto del intento. Sólo se admite imagen/PDF original, listo y vigente, del mismo chat/epoch; no texto revisado, audio ni archivos de mensajes anteriores. El límite propio de análisis es 10 MiB, hasta100 ítems, envelopes JSON de64 KiB, instrucciones de hasta32 KiB y los techos existentes de cardinalidad/profundidad/transporte. El límite general de adjuntos del chat no cambia.

La selección proviene del intento armado, incluida delegación autorizada; no se aceptan overrides de modelo, conexión, modo, actor, rutas o credenciales. Se revalidan configuración, permisos, relación proveedor/negocio y origen en las fronteras SQL. El adaptador externo se ejecuta fuera de transacciones. La finalización enlaza atómicamente un único resultado con su preparación en el recibo existente. No añade tablas ni estados del proveedor.

El resultado declara `extraction_source:active_agentic_generation` y `review_required:true`, conserva cero y null y no acredita una segunda verificación visual ni ejecución del endpoint OCR legacy. Su recuperación humana reautoriza el recibo y permite leer el resultado exacto después de terminar el run, sin nueva normalización. La normalización pura puede repetirse con otro callback tras una respuesta incierta; no repite inferencia ni efectos. Un mismo callback conserva su conciliación durable y no ejecuta de nuevo una operación incierta.

## Consecuencias

- Reutilización de reglas nativas sin acceso SQL/HTTP arbitrario ni creación de registros comerciales.
- Dos callbacks consumen el presupuesto MCP existente de una sola generación; no se añade un dispatch oculto ni se elevan límites.
- La extracción sigue siendo una interpretación del modelo, revisable por la persona. Crear factura/productos continúa por preparación, propuesta exacta y botón humano independientes.
- Candidato sujeto a publicación selectiva, despliegue conjunto del parser y aceptación real por modalidad/configuración. Las pruebas SQL usan transporte/normalizador sintéticos; el parser real se verifica aparte.
- Los contratos C01/C02 y los67 bindings publicados se preservan. Añadir una ficha draft al registro cambia su procedencia/release, no publica herramientas.

## Referencias

- [Entrega82](../../mvp/82-nodia-ai-ai36-integral-coverage.md).
- [Ficha funcional](../../nodia-ai/knowledge/businesses/features/active-invoice-analysis.md).
- [ADR-061](ADR-061-nodia-ai-mcp-write-preparation.md).
- [Seguridad interna](../internal-microservice-security.md).
- [Contrato MCP](../../../nodia-server/src/nodia-ai-products/contracts/invoice-analysis.json).
- [Parser privado](../../../nodia-gemini-microservice/invoice_mcp_contract.py).
