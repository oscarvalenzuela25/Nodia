# ADR-067 — Compatibilidad explícita del CLI y comparación acotada de MCP

> Estado: propuesto
> Fecha: 2026-10-19

## Contexto

[C05-R03](../../evidence/nodia-ai-ai36-c05-r03-acceptance.md) acredita High y el rol `inheritMcp` con CLI1.3.1 y corrige el lector del manifiesto. Las dos herramientas de preferencias ya responden, pero no llega el terminal dentro del límite; el descubrimiento financiero también agota su plazo. Hay cuatro capacidades aceptadas de siete, no una causa única demostrada para las demoras.

El [changelog oficial](https://www.antigravity.google/docs/changelog/) anuncia en1.3.4 una corrección de esperas entre reintentos que podían alcanzar cuatro minutos. Esa observación no prueba reintentos en los intentos retenidos. No se obtuvo un paquete histórico1.3.4 con metadatos verificables. Se conserva esa investigación sin inventar URL, identificador de build o hash.

El [manifiesto oficial fijado](../../evidence/nodia-ai-ai36-c05-cli-1.4.2-package-pin.json) ofrece1.4.2, descargado y verificado contra SHA512. Su ELF tiene hash derivado del paquete comprobado; no se obtuvo firma independiente. El changelog embebido termina en1.4.1. Ni la descarga ni la versión por sí solas acreditan compatibilidad de sesión, modelo, hooks o MCP.

## Opciones consideradas

### Ampliar el plazo o repetir sin intervención

- Ventajas: permite esperar respuestas tardías.
- Desventajas: no identifica la causa, aumenta consumo y ocupación del perfil, y altera el criterio de aceptación. Se mantiene el límite vigente y no se reenvían intentos inciertos.

### Instalar automáticamente la versión más reciente

- Ventajas: adopta correcciones del proveedor.
- Desventajas: el resultado deja de ser reproducible; configuración y hash podrían describir otro binario, y los gates1.3.1 no demuestran compatibilidad nueva. Se descarta la actualización automática.

### Candidato fijado, contrato explícito y experimento reversible

- Ventajas: compara una intervención concreta con trazabilidad de versión, binario, fuentes y sesión, manteniendo High y los límites.
- Desventajas: requiere QA y canario nuevos; puede cambiar el protocolo de herramientas o almacenamiento de credenciales. Una comparación exitosa no establece causalidad ni certifica todos los consumidores históricos.

## Decisión

Preparar la tercera opción dentro del alcance de implementación autorizado. Mantener1.3.1 como valor histórico cuando la configuración omite `ANTIGRAVITY_CLI_VERSION`; aceptar1.4.2 exclusivamente como selección explícita del operador. Rechazar versiones fuera del contrato admitido. La inicialización sigue verificando SHA512 y la salida real de `--version`; nunca se deriva la versión del nombre del archivo ni se cambia el binario ante un error.

Distinguir compatibilidad del transporte de disponibilidad real. Chat/MCP de la versión candidata requieren una observación no generativa del mismo ID y esfuerzo, y un canario propio con callback/nonce, autorización, cierre y ACK. La configuración no acredita `supports_mcp`. Los gates históricos de adjuntos y OCR permanecen cerrados para1.4.2 hasta sus pruebas específicas; la compatibilidad MCP no se presenta como certificación de extracción.

El experimento R04 comienza sólo después de QA aislada y revisión de la intervención. Usar contenedor único, imagen inmutable, binario fijado y API/worker pausados. Conservar descriptor y override originales en almacenamiento privado; no exportar perfiles ni credenciales. Revisar compatibilidad antes de usar el perfil real y no restaurar ciegamente tokens antiguos después de una posible rotación oficial.

Presupuesto máximo: cinco starts nuevos, un canario y dos etapas por cada caso independiente de preferencias y Finanzas. Los intentos anteriores ya conciliados no se repiten con su identidad. Mantener High exacto, su esfuerzo persistido, catálogo descubierto y plazos119/120s. Sin Low, otro proveedor, API, sufijos inventados, extensiones MCP nuevas, herramientas nativas adicionales o confirmaciones implícitas. Si no pasa un prerrequisito, no consumir sus etapas dependientes.

Al cerrar esta comparación, conciliar cualquier resultado incierto y restaurar imagen061552/CLI1.3.1 y los cuatro servicios, conservando Node932 y R05. Una prueba del candidato no habilita soporte MCP actual después de reiniciar o volver a otra instancia. La eventual adopción operativa de1.4.2 exige evaluar también consumidores históricos pendientes, no sólo estas tres capacidades.

## Consecuencias

- La variante del CLI deja de ocultarse en una constante que describiría incorrectamente un binario nuevo.
- Se conservan los informes R01/R02/R03 inmutables. Cada continuación fija su entorno y no transfiere pruebas efímeras entre sesiones.
- Los callbacks tardíos sin terminal completo siguen sin acreditar una capacidad. Confirmación HTTP exacta, idempotencia, recibos SQL y ausencia de efectos previos conservan sus criterios.
- Los reintentos internos y consumo upstream permanecen desconocidos salvo señal real; cero reenvíos de Nodia no equivale a cero reintentos del proveedor.
- Los resultados, versión/wire realmente observados, recuperación y limitaciones se registrarán en evidencia R04 y la ficha correspondiente. Este ADR no se marca aprobado automáticamente.

## Referencias

- [ADR-016: adaptador CLI](ADR-016-antigravity-cli-adapter.md), [ADR-065: rol propio](ADR-065-nodia-ai-owned-mcp-execution-role.md), [ADR-066: límite del manifiesto](ADR-066-nodia-ai-mcp-manifest-depth-boundary.md).
- [Runbook Agentic](../../mvp/agentic-cli-runbook.md), [contrato de proveedores](../../mvp/ai-provider-feature-contract.md).
- [Investigación oficial](../../evidence/nodia-ai-ai36-c05-official-cli-research.json), [paquete fijado1.4.2](../../evidence/nodia-ai-ai36-c05-cli-1.4.2-package-pin.json).
