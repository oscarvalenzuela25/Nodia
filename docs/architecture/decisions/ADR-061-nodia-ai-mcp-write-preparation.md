# ADR-061 — Preparación MCP con contratos cerrados y confirmación humana independiente

> Estado: propuesto
> Fecha: 2026-10-18

## Contexto

AI36-C01 debe conectar 73 preparadores nativos con MCP sin otorgar al modelo autoridad para confirmar o ejecutar cambios. Los puertos existentes ya normalizan DTOs, resuelven mínimos, construyen snapshots y generan propuestas revisionadas. Reimplementar esas reglas en herramientas separadas produciría divergencia. La admisión y el gateway anteriormente sólo aceptaban lecturas y referencias.

## Opciones consideradas

### Invocador genérico de endpoints o SQL

Reduce código inicial, pero expone una superficie abierta, pierde proyecciones y autoridad por recurso y permite efectos antes de la revisión humana. Se descarta.

### Esquemas MCP cerrados y adaptadores hacia los preparadores existentes

Mantiene contratos explícitos por operación y reutiliza el flujo nativo. Requiere contrastar cada esquema y conservar un binding verificable con el contrato del preparador. Es la opción implementada como candidata, sin publicación automática.

## Decisión

- Tres bundles estáticos de contratos describen 26 operaciones de Finanzas/Negocios, 22 de Reservas y 25 de Core/proveedores. No contienen modelos, secretos ni nombres de clases a resolver dinámicamente.
- La entrada MCP contiene `partial` y, para continuar, `draft_id` junto con `expected_draft_revision`. Un parcial vacío permite pedir los mínimos faltantes; no permite crear un registro incompleto. El actor, sesión, conversación y tool-call proceden del backend.
- Cada adaptador conserva nombre, ámbitos, acciones y hash del preparador nativo. El esquema MCP incluye ese hash; cambiar el contrato nativo invalida el binding anterior. Los resultados públicos incluyen `draft_revision` y se contrastan con borrador, propuesta y proyección nativa persistidos.
- Los únicos campos JSON libres nativos admitidos usan un árbol tipado cerrado: objetos como pares clave/valor, listas y escalares explícitos. El adaptador reconstruye datos, nunca código. Rechaza claves duplicadas, conserva cero/falso/null y trata las claves de prototipo como datos inertes. La validación nativa sigue siendo obligatoria.
- Se mantienen los límites existentes: argumentos de 64 KiB, profundidad física del transporte 16 y profundidad lógica JSON 8. El árbol tipado puede agotar el límite físico antes que un JSON nativo equivalente; no se amplían techos ni se promete paridad de todos los tamaños aceptados por la API.
- `prepare_change` atraviesa admisión y gateway sólo si existe publicación y autoridad vigentes. El tool-call `validated`, el borrador/propuesta y su resultado `completed` comparten la transacción del checkpoint. Una salida inválida revierte todos esos registros. Un replay exacto recupera el recibo y vuelve a verificar autoridad; no vuelve a preparar ni ejecuta el dominio.
- La confirmación continúa exclusivamente por el canal humano autenticado y sobre la propuesta exacta. Ninguno de estos adaptadores confirma, ejecuta o recibe credenciales.
- El módulo de escritura se instancia sólo cuando el manifiesto selecciona candidatos. La composición con lecturas conserva propietario del recurso y metadata canónica; un manifiesto sin escrituras conserva los contratos de lectura. Los bytes de los bundles se construyen completos antes de seleccionar exports, para no alterar hashes por el subconjunto seleccionado.

## Consecuencias

- No hay tablas, migraciones ni endpoints nuevos. Se reutilizan borradores, propuestas, recibos, autorización y escritores existentes.
- La compilación de todos los contratos candidatos tiene un coste de arranque que debe medirse antes de habilitar publicación. Con cero escrituras seleccionadas no se instancia ese módulo.
- Los 73 contratos no equivalen a 73 herramientas publicadas. Las 74 herramientas actuales más 73 serían 147: exceden tanto las 74 herramientas/131.072 bytes admitidas por el adaptador como la cardinalidad JSON 128 y el contexto total de 262.144 bytes. Se necesita selección/publicación verificada antes de habilitarlas, sin aumentar esos techos por conveniencia.
- Los cuatro flujos seguros, el análisis explícito de factura y los seis ayudantes pendientes conservan AI36-C02..C04. La aceptación real del proveedor conserva su gate independiente.

## Referencias

- [Entrega y evidencia AI-36](../../mvp/82-nodia-ai-ai36-integral-coverage.md).
- [Contratos comunes](../../mvp/41-nodia-ai-v1-contracts.md), [publicación](../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md) y [confirmación humana](../../mvp/64-nodia-ai-ai18-human-confirmation.md).

## Extensión AI36-C02 — cuatro preparadores del canal seguro

Se reutiliza el mismo adaptador transaccional para `prepare_secure_flow`: alta/actualización de API key, login de conexión y logout de Nodia. Un bundle separado conserva los bytes y hashes de los 73 contratos C01. El loader distingue ambos grupos y rechaza identidades seguras presentadas como cambios ordinarios o preparadores ordinarios presentados como seguros.

El esquema sólo admite identificadores del objetivo, modo de login y metadatos públicos de clave según la operación. No incluye `secret`, cookies, códigos, URLs de autorización, referencias de flujo, acciones del visor ni identidad de actor/sesión. La salida sigue siendo borrador/propuesta; no devuelve un descriptor de interacción humana. El botón exacto admite la ejecución y el worker existente establece `waiting_for_user`; únicamente el endpoint humano autenticado puede recibir el secreto o completar login/logout. Se preserva [ADR-053](ADR-053-nodia-ai-secure-human-interaction.md).

El logout propio no requiere Ajustes IA. Su puerto nativo conserva rutas/acciones de destino vacías y comprueba NodiaAI/actor/sesión mediante la autoridad común. Su registro MCP declara explícitamente `/tools/nodia-ai`, requisito basal ya obligatorio, sin añadir privilegios. El recurso `nodia_sessions` queda separado de `secure_flows`, cuyos otros tres preparadores necesitan `/settings/ai-providers` y `ai:manage`; así no se hereda ese permiso por una unión de recursos del catálogo.

Los cuatro contratos son candidatos sin publicación. No se cambia el canal humano, los DTOs de secretos, los proveedores/modelos, los límites o el esquema SQL. La verificación aislada y la aceptación real se registran en la continuación C02 de la entrega82; añadir el registro no acredita login ni inferencia.


## Extensión AI36-C04 — ayudantes comunes y preparación compuesta

Los seis nombres comunes pendientes reciben bindings candidatos explícitos, separados de los73 preparadores de dominio ycuatro seguros. Cuatro lecturas reutilizan casos de uso nativos con un manager existente; dos preparaciones reutilizan PrepareProposal y PrepareWorkflow dentro del checkpoint MCP. Los endpoints humanos conservan sus transacciones y contratos. No se anidan transacciones ni se añade infraestructura de persistencia.

`nodia_workflows_prepare` sólo compone borradores propios con enlaces tipados y catálogo nativo. Su excepción interna al bloqueo de chat ocupado exige recibo validated del mismo usuario/chat/run y el intento armado vigente. La llamada humana no recibe ese contexto interno y conserva el bloqueo. `nodia_preferences_prepare` propone create/update/delete mediante los tres puertos de memoria existentes, incluye sus hashes en el contrato y usa CAS de borrador; no acepta la preferencia. `prepare_workflow` y `prepare_preference_change` siguen la misma reserva validated, rollback y recibo completed de C01.

Las lecturas de propuestas, ejecuciones y adjuntos se restringen al chat fijado por Server, sin aceptar actor o conversation_id del modelo. Se conservan PublicProposal y ExecutionStatus públicos nativos: el hash de propuesta y referencias de resultado públicas no son credenciales. Los descriptores de recuperación e interacción humana siguen privados. Metadatos de adjunto excluyen contenido e interpretación; las preferencias son siempre propias y revalidan sus referencias actuales. El resultado durable se recupera como snapshot autorizado; una nueva llamada consulta el estado actual.

La composición existente canoniza módulos por ruta y conserva un propietario por recurso, incluida memoria compartida por lectura/preparación. No se debilita el registro para admitir recursos duplicados. Módulos sin selección explícita no instancian puertos. Ninguno de estos seis candidatos recibe operaciones para confirmar, ejecutar, reanudar, cancelar, revisar adjuntos, descargar bytes o completar login. Se mantienen los límites de transporte/contexto y los gates de publicación selectiva y aceptación real.


### Compatibilidad estructural AI36-C04

El ensayo SQL detectó que Capability.kind del schema canónico de publicación sólo enumeraba cinco clases, aunque los contratos comunes y TypeScript ya distinguían prepare_workflow y prepare_preference_change. Se añaden esas dos clases explícitas, preservando las cinco previas y el rechazo de valores desconocidos. Cambia contract_schema_sha256 y la release compilada por procedencia; no añade bindings ni aprueba/publica candidatos. El loader real verifica ambos tipos nuevos y rechaza uno desconocido, y se repite la integración SQL con el nuevo build. No se modifica la identidad semántica de las preparaciones para eludir la validación.
