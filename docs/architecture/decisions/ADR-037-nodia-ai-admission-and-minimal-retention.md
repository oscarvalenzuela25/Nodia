# ADR-037 — NodiaAI: presupuesto durable y conservación mínima

> Estado: propuesto
> Fecha: 2026-10-15

## Contexto

AI-02/03 verifican recorridos aislados Web/Agentic, pero los contadores MCP son locales al proceso y login aún no comparte toda la exclusión. Web→Agentic podría multiplicar recursos si abre otro turno o resetea límites. El usuario confirma5 minutos/20 MiB y rechaza conservar auditoría adicional al vencer el chat. El modelo42 separa payload de recibos sin haber fijado su duración.

## Opciones consideradas

### Opción A — límites por adaptador y archivo técnico independiente

- Ventajas: configuración local sencilla, mayor historia para soporte.
- Desventajas: reiniciar/delegar permite eludir presupuestos; auditoría180 días/receipts durante la vida del gasto contradice la preferencia del usuario; un mutex local no coordina réplicas.

### Opción B — una política versionada y pendientes operativos mínimos

- Ventajas: límites acumulados del run, identidad por perfil real, purga sin archivo técnico adicional y recuperación protegida.
- Desventajas: requiere admisión/fences compartidos, validación de configuración completa y limpieza explícita de registros operativos; los unknown no se pueden olvidar automáticamente.

## Decisión

Proponer B mediante [política50](../../mvp/50-nodia-ai-ai04-runtime-policy.md)/[configuración](../../mvp/nodia-ai-v1-runtime-policy.json), separando decisiones de producto confirmadas de valores operativos iniciales. Un run por mensaje y etapas de proveedor con identidad exacta; una delegación temporal como máximo, sin tablas nuevas de workflows. Schema/wire/ERD de snapshots/contadores/procedencia se actualizan conjuntamente en AI-09/12 antes de usar esta semántica.

Cero retención adicional de audit/attempts/receipts resueltos al borrar chat. Desvincular del chat permite terminar limpieza o conciliación, no conservar archivo indefinido. Unknown retiene sólo descriptores mínimos hasta cerrar; nunca reejecutar una intención vencida. Negocio/journals nativos y preferencias aceptadas permanecen bajo sus propias reglas. No hacer CASCADE automático sobre una protección de efecto/proceso aún activo.

Rotación propia de backups en máximo7 días y restore en cuarentena, sin jobs/replay. Lista operacional de borrados limitada a las copias que podrían revivirlos; no historia de producto permanente. Falta de prueba de borrado remoto o backup no se presenta como borrado completo. Los valores no son cuotas ni capacidades del proveedor.

## Consecuencias

- Positivas: menor conservación y duplicación, reintentos acotados, presupuesto no eludible al alternar modos y datos de dominio preservados.
- Costos o riesgos aceptados: menos historia para diagnóstico; reconciliación y cleanup fallidos requieren operador; memoria/latencia reales necesitan carga en gates posteriores.
- Trabajo posterior: AI-09..13/17..20/32..38 materializan los gates de50. No microservicio, tablas de conocimiento/vectores, cambio de modelo ni nuevos defaults comerciales. El guard login observado sigue pendiente AI-11.
- Complementa ADR-034/035/036; precisa su política pendiente y sustituye la propuesta de retención extra, sin cambiar garantías de idempotencia de los dominios.

## Referencias

- [AI-04 y gates50](../../mvp/50-nodia-ai-ai04-runtime-policy.md), [ficha funcional](../../nodia-ai/knowledge/nodia-ai/features/runtime-policy.md).
- [ADR-034](ADR-034-nodia-ai-postgres-jobs-and-retention.md), [ADR-035](ADR-035-nodia-ai-bounded-persistence-and-knowledge.md), [ADR-036](ADR-036-nodia-ai-opt-in-agentic-routing.md).
- [ERD42](../../mvp/42-nodia-ai-erd.md), [arquitectura43](../../mvp/43-nodia-ai-execution-architecture.md), [plan45](../../mvp/45-nodia-ai-implementation-plan.md).
