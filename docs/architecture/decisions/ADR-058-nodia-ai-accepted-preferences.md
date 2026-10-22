# ADR-058 — Memoria aceptada, acotada y reautorizada de NodiaAI

> Estado: propuesto
> Fecha: 2026-10-18

## Contexto

El usuario acepta recordar preferencias y puede consultarlas y borrarlas. Deben sobrevivir a la expiración del chat, sin convertirse en credenciales, autoridad ni aprendizaje silencioso. Las escrituras conversacionales ya tienen propuesta exacta, consentimiento humano y recibo atómico.

## Opciones consideradas

### Texto libre aprendido del historial

Reduce formularios, pero mezcla instrucciones con datos, dificulta revocación y deja ambiguo qué se aceptó. No se adopta.

### CRUD directo con confirmación independiente

Es pequeño inicialmente, pero duplica consentimiento, idempotencia y recuperación. No se adopta.

### Registro cerrado y ejecución existente

Reutiliza las garantías de propuestas y efectos y añade sólo la tabla de preferencias prevista en M4. Requiere validar cada familia de referencias y presentar sus valores correctamente.

## Decisión

Implementar un registro inicial de cinco claves de referencias en Finanzas, Negocios y Reservas, con scope de negocio obligatorio para proveedor. Sin secretos ni texto libre. Dueño personal derivado de sesión, referencias reautorizadas y presupuesto inicial de50 recuerdos por dueño. FK opcionales al chat/paso con SET NULL; sin tabla de historial de memoria.

Preparar, editar y olvidar usan propuestas y botón exactos existentes; guardar y emitir recibo forman una transacción. Lecturas y mutaciones comparten un lock por dueño para la frontera de envío. El worker incluye sólo preferencias aceptadas y autorizadas como datos y guarda sus referencias/hash en el manifiesto. Un validador local en armDispatch comprueba el fingerprint en la transacción que reserva presupuesto y arma el envío; no permite I/O externo. Cambios anteriores a esa frontera impiden el dispatch.

## Consecuencias

- Un borrado del chat no borra la memoria aceptada ni los registros de negocio.
- Olvidar sigue siendo posible al perder acceso al dominio; no se exponen etiquetas revocadas en el contexto.
- Añadir claves exige registro, reglas, presentación y pruebas; no interpreta JSON arbitrario como capacidad.
- No aplica defaults silenciosos a contratos nativos ni publica MCP automáticamente. Preferencias históricas en mensajes no se consideran memoria vigente.
- La memoria por dueño añade lectura y validación al pipeline; consultas por conjuntos y presupuesto acotado evitan N+1 o prompts sin límite.
- AI-34 compactación y AI-36..38 publicación/operación/aceptación conservan sus etapas.

## Referencias

- [Entrega AI-33](../../mvp/79-nodia-ai-ai33-accepted-preferences.md).
- [Contratos41](../../mvp/41-nodia-ai-v1-contracts.md), [ERD42](../../mvp/42-nodia-ai-erd.md) y [Política50](../../mvp/50-nodia-ai-ai04-runtime-policy.md).
