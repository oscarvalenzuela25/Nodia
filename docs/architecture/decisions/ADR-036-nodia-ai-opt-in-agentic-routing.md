# ADR-036 — NodiaAI: alternancia a Agentic por consentimiento explícito

> Estado: propuesto técnicamente; separación de modos y switch confirmados por el usuario
> Fecha: 2026-10-14

## Contexto

El usuario cambia el alcance: Web sólo conversación y Agentic con MCP. Autoriza un switch en el drawer para alternar cuando una petición necesita herramientas; precisa que en v1 el destino sea sólo Agentic y API llegue más adelante. El contrato anterior prohibía cambios automáticos sin elección explícita. AI-02 demostró un loop Web sintético, pero no lo publicó ni obliga a usarlo en el producto.

## Opciones consideradas

### Opción A — Cambiar sólo manualmente

- Ventaja: selección única y recorrido más simple.
- Desventaja: no satisface el switch solicitado por el usuario.

### Opción B — Routing condicionado por consentimiento y destino exacto

- Ventajas: automatiza únicamente lo solicitado, conserva contexto y procedencia, mantiene preview/confirmación separadas.
- Costos: contratos de consentimiento/fases, presupuesto conjunto, deduplicación y elegibilidad/reautorización al despachar.

### Opción C — Activar cualquier modo disponible al necesitar herramientas o fallar

- Ventaja: oculta parte de la configuración al usuario.
- Desventajas: cambia identidad/coste/cuenta, puede repetir trabajo incierto y contradice selección y consentimiento. Descartada.

## Decisión

Proponer B para implementar las decisiones confirmadas según [política48](../../mvp/48-nodia-ai-mode-routing-policy.md). Switch apagado por defecto, usando Web y únicamente con Agentic verificado en la misma conexión; API no es destino en v1. Los modelos/esfuerzos se resuelven por modo, sin fallback. El switch autoriza delegación, no escrituras. MCP continúa sujeto a ToolGateway y al botón humano para cambios.

Web no publica herramientas de dominio. El routing es una etapa explícita, no un cambio de la selección de una inferencia ya admitida. [AI-04/50](../../mvp/50-nodia-ai-ai04-runtime-policy.md) concreta una delegación temporal por run/mensaje, Web como base siguiente, consentimiento revisionado y presupuesto acumulado. Wire/schema/rutas/ERD y procedencia siguen pendientes AI-09/12 antes de runtime. No añadir una tabla por este ADR ni reutilizar JSON libre para eludir contratos.

## Consecuencias

- Contexto canónico y resultados conservados en el mismo chat, con procedencia por fase.
- Elegibilidad deriva de pruebas del adaptador y disponibilidad actual, no de catálogo o clave almacenada.
- Error, cuota o resultado incierto no activan otro modo. Ningún proveedor externo a la selección se elige automáticamente.
- Política anterior permanece para OCR y consumidores existentes. La excepción sólo opera dentro de NodiaAI con consentimiento explícito vigente.
- Reconciliar contratos/ERD/UI/evidencia dependientes sin aprobar documentos automáticamente. [AI-03](../../mvp/49-nodia-ai-ai03-gemini-agentic-viability.md) cerró viabilidad MCP sintética con cuenta; adaptador productivo, autoridad y routing conservan sus gates AI-04/12/13. Ese cierre no hace elegible el switch por sesión o catálogo solos.

## Referencias

- [Alcance38](../../mvp/38-nodia-ai-research-and-v1-plan.md), [contratos41](../../mvp/41-nodia-ai-v1-contracts.md), [arquitectura43](../../mvp/43-nodia-ai-execution-architecture.md), [plan45](../../mvp/45-nodia-ai-implementation-plan.md).
- [AI-02](../../mvp/47-nodia-ai-ai02-gemini-web-viability.md), [ADR-032](ADR-032-nodia-ai-domain-tools-and-conversation.md), [ADR-033](ADR-033-nodia-ai-confirmation-and-sequential-recovery.md).
