# ADR-052 — Configuración IA no secreta con escritores compartidos

> Estado: propuesto; implementación AI-28, sin aprobación documental automática.
> Fecha: 2026-10-17.

## Contexto

NodiaAI necesita administrar conexiones y catálogos IA mediante la misma revisión y confirmación exacta de los efectos de dominio. La configuración tiene alcance global: elegir otro predeterminado modifica varias conexiones. Los campos históricos y las preferencias por canal deben conservarse; una sincronización remota no puede sobrescribir una edición confirmada mientras esperaba al proveedor. Los flags de catálogo y las preferencias guardadas no prueban sesión, soporte o inferencia.

## Opciones consideradas

- Llamar métodos de servicio que guardan fuera del manager del recibo: no garantiza rollback ni recuperación atómica.
- Crear tablas propias de configuración, duplicar reglas o aceptar JSON arbitrario desde el modelo: añade dos fuentes de verdad y permite introducir datos privados o capacidades inventadas.
- Compartir casos de uso nativos y admitir comandos cerrados: conserva un único escritor y permite congelar los cambios materiales antes del botón humano. Es la opción elegida.

## Decisión

Cuatro puertos internos crean o actualizan `ai_providers` y `ai_provider_catalog`. Reutilizan los casos de uso nativos bajo el manager del coordinador. La autoridad se comprueba desde PostgreSQL: sesión/actor actuales y `ai:manage`; NodiaAI exige además su módulo y el módulo de destino. Los escritores REST derivan el mismo actor autenticado. Una transacción heredada debe demostrar sus locks de autoridad actuales antes de leer identidad; estar activa por sí solo no demuestra esa frontera. No se reinician los timeouts heredados.

Todos los escritores locales bloquean catálogo y conexiones en un orden común. Predeterminados, preferencias, traducciones y recibo se confirman o revierten juntos. Las secuencias mixtas con Core conservan la frontera exclusiva de ADR-051; una configuración IA aislada usa SHARE de autoridad. El recibo sólo conserva versión, recurso, operación e ID. La recuperación no relee secretos ni repite un efecto comprometido.

Los comandos del chat no admiten `fields` arbitrarios, claves, cookies, tokens, códigos ni cuerpos de descubrimiento. La edición de modelos y razonamiento usa paths explícitos por canal. Los IDs de modelo proceden de configuración o catálogo persistido y se conservan exactos; no hay selección del primer resultado. Los niveles de preferencia permitidos por el contrato nativo pueden guardarse sin acreditar soporte. Limpiar una intensidad elimina la preferencia general y la del modelo seleccionado; la vista previa muestra el resultado. Datos históricos ajenos al cambio se preservan sin incluirlos en el contexto del modelo.

El descubrimiento remoto permanece fuera de SQL. Al persistir sus observaciones, el backend relee la conexión y combina sólo los modelos del canal observado bajo los mismos locks; no reescribe el snapshot anterior de preferencias. Preparar o ejecutar sincronización y cierre de sesión desde NodiaAI requiere su protocolo externo y conserva un gate explícito. AI-28 no los sustituye por efectos SQL ni abre login o secretos.

La configuración global y la selección de la conversación son contratos distintos. Un recibo completado invalida las consultas pertinentes del cliente; no cambia silenciosamente el proveedor/modo/modelo elegido por el dueño del chat. OpenAI Web conserva la retirada explícita del producto: se rechazan nuevas activaciones, sin inventar un adaptador ni convertir datos históricos en disponibilidad.

## Consecuencias

- Cero tablas, columnas o migraciones nuevas; se reutilizan configuración nativa y persistencia de intención/revisión/recibo.
- Una modificación concurrente material requiere nueva revisión y confirmación; cuotas y salud remota quedan fuera del snapshot SQL.
- El lock de configuración serializa cambios de catálogo y predeterminado. Su contención productiva requiere medición; las pruebas de laboratorio no certifican capacidad productiva.
- Markdown, registro de ejecutores, publicación MCP y aceptación real de proveedor siguen siendo estados distintos.

## Referencias

- [Entrega AI-28/74](../../mvp/74-nodia-ai-ai28-provider-configuration.md), [plan45](../../mvp/45-nodia-ai-implementation-plan.md) y [contrato de proveedores IA](../../mvp/ai-provider-feature-contract.md).
- [Contratos41](../../mvp/41-nodia-ai-v1-contracts.md), [ejecución43](../../mvp/43-nodia-ai-execution-architecture.md), [ADR-051](ADR-051-nodia-ai-core-exclusive-execution.md) y [ADR-029](ADR-029-chatgpt-web-browser-adapter.md).
