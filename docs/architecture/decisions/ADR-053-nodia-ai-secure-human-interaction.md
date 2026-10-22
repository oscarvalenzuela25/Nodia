# ADR-053 — Canal humano seguro y pausa de ejecución de NodiaAI

> Estado: propuesto
> Fecha: 2026-10-17

## Contexto

AI-29 necesita iniciar login y gestionar credenciales desde una propuesta exacta sin entregar secretos al modelo ni mantener una transacción o worker ocupado durante la intervención humana. Las sesiones Web, Agentic y Nodia tienen autoridades y ciclos de vida distintos. Una respuesta remota perdida no permite deducir si el efecto ocurrió.

## Opciones consideradas

### Herramientas que reciben la credencial o mantienen abierta la ejecución

- Simplifican el transporte inicial.
- Exponen secretos al contexto y acoplan la duración de una transacción y un lease al login. No se eligen.

### Canal humano separado con referencia opaca y testigo durable

- Reutiliza propuestas, ejecuciones, pasos, grants y jobs existentes.
- Exige revalidar autoridad, revisión y estado en cada acción y al volver de una llamada externa.

## Decisión

La propuesta contiene únicamente metadatos permitidos. Tras el botón de confirmación, el worker produce una referencia aleatoria ligada a dueño, sesión, ejecución, revisión y vencimiento; deja ejecución/paso en `waiting_for_user` y job en `waiting`, sin lease ni transacción abierta.

Un endpoint autenticado independiente recibe temporalmente la clave o el código y devuelve al humano los datos necesarios del login. No se registra como herramienta del modelo ni se serializan secretos en eventos, propuestas, receipts o cachés de mutaciones del cliente. Las respuestas humanas usan `no-store`.

Los efectos SQL de claves y revocación de la sesión Nodia propia comparten manager y commit con el recibo mínimo. Las acciones externas guardan un testigo antes del I/O y verifican el resultado en otro checkpoint. Ante incertidumbre no se repite una mutación; la reconciliación consulta el estado o conserva el pendiente hasta demostrar el cierre nativo. Se reutilizan ownership, exclusión y limpieza del runtime nativo; la pausa no autoriza una inferencia anidada sobre el perfil ocupado.

La política independiente `timing.secure_human_seconds` limita inicialmente la intervención a300 segundos, acotada además por sesión, grant, job y chat. Es un límite propio de Nodia, no una cuota del proveedor. No sustituye los plazos nativos ni convierte un resultado incierto en cancelación confirmada.

Cada flujo seguro requiere una propuesta individual. Los conjuntos dependientes de AI-23 continúan usando los puertos locales existentes. El recibo seguro contiene sólo versión, recurso `secure_flows`, UUID del flujo y operación; nunca IDs de sesión nativa o secretos. No se añaden tablas, columnas ni migraciones para esta etapa.

## Consecuencias

- La espera humana no consume capacidad de ejecución ni bloqueos SQL; la sesión nativa puede conservar su reserva mientras la interacción está activa.
- Otro usuario o sesión, incluso con rol administrador, no puede apropiarse de un desafío humano existente.
- Los fallos de transporte se muestran como inciertos cuando no existe prueba de resultado. Una referencia vencida no demuestra que terminó un proceso externo.
- La interfaz conserva el formulario ante errores y limpia el secreto al completarse. La publicación de preparadores MCP y la aceptación con cuentas reales se verifican por separado.

## Referencias

- [AI-29](../../mvp/75-nodia-ai-ai29-secure-human-flows.md), [contratos41](../../mvp/41-nodia-ai-v1-contracts.md), [arquitectura43](../../mvp/43-nodia-ai-execution-architecture.md).
- [AI-28](../../mvp/74-nodia-ai-ai28-provider-configuration.md), [política50](../../mvp/50-nodia-ai-ai04-runtime-policy.md), [publicación52](../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md).
