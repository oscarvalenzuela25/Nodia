# ADR-048 — Puertos financieros nativos y recibos de operación

> Estado: propuesto
> Fecha: 2026-10-17

## Contexto

AI-19/20 ejecuta una creación financiera con witness local atómico y recuperación. AI-21 debe ampliar esa garantía al CRUD de cuatro recursos, incluidas operaciones que modifican varias filas y eliminaciones físicas. Los recibos completados deben seguir siendo observables cuando el registro afectado ya no existe. Las revisiones confirmadas de creación v2 conservan su identidad.

## Opciones consideradas

### Copiar escritores o ejecutar SQL generado desde un coordinador general

- Ventajas: acceso uniforme aparente a todas las tablas.
- Desventajas: duplica reglas financieras, expone una autoridad excesiva y dificulta probar saldo, relaciones, locks y efectos exactos. Requiere coordinar dos implementaciones ante cada cambio.

### Crear un ledger y una tabla de payloads por cada familia

- Ventajas: permite almacenar contratos y resultados independientemente del dominio.
- Desventajas: repite comando, identidad y recibos ya persistidos y amplía esquema/retención sin necesidad para efectos locales. No aporta por sí mismo atomicidad ni garantías de concurrencia.

### Registros de puertos cerrados con los escritores nativos y witness existente

- Ventajas: conserva una sola implementación de reglas; el efecto y su recibo comparten transacción. Un contrato por operación permite revisar objetivo, cambios y precondiciones sin admitir SQL o clases dinámicas.
- Desventajas: cada operación necesita su preparador, snapshot, proyección y pruebas pertinentes. Las estructuras de vista previa y límites de asociaciones deben mantenerse explícitos.

## Decisión

Usar la tercera opción. Registrar en código doce identidades financieras permitidas y despachar por nombre, contrato, recurso y operación comprobados. Cada puerto comparte el manager de la transacción del coordinador y llama al escritor nativo correspondiente; los efectos compuestos nativos permanecen dentro de ese mismo paso.

Las nuevas operaciones vinculan el envelope completo, incluido el ID objetivo de update/delete, y reciben un witness mínimo con operación, recurso, ID y destinatario. Mantener intactos contrato, catálogo, binding y recibo de la creación v2 de AI-19. La proyección histórica valida el witness contra su origen y autoridad, sin exigir presencia actual de lo eliminado.

Reutilizar jobs, grants, intentos, outbox, triggers y recuperación de AI-20. No añadir tablas/columnas ni un historial permanente. La ampliación de registros internos no publica preparadores MCP ni aprueba contexto funcional.

## Consecuencias

- Las reglas financieras conservan sus escritores, propiedad, precisión monetaria, locks y constraints nativos.
- Un receipt completed es histórico; no garantiza que el registro siga presente ni permite recrearlo al observarlo.
- Cancelación y reanudación conservan la intención original y se reautorizan; cambios materiales exigen otra propuesta y botón.
- Una operación compuesta de dominio no habilita todavía secuencias de pasos dependientes.
- Las asociaciones de una propuesta se limitan por política y se rechazan si exceden el presupuesto; no se ocultan efectos mediante truncado.
- Publicación MCP, pruebas Gemini y aceptación productiva mantienen sus gates independientes.

## Referencias

- [AI-21](../../mvp/67-nodia-ai-ai21-financial-operations.md), [Finanzas22](../../mvp/22-personal-finance-contracts.md), [AI-20](../../mvp/66-nodia-ai-ai20-execution-recovery.md).
- [ADR-046](ADR-046-nodia-ai-local-financial-witness.md) y [ADR-047](ADR-047-nodia-ai-local-execution-recovery.md).
