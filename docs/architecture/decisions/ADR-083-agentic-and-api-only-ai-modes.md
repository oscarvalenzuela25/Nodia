# ADR-083 — Modos IA Agentic y API key; retirada de Web

> Estado: propuesto; implementación autorizada por petición explícita del usuario el 2026-10-27. No equivale a aprobación documental/publicación.
> Fecha: 2026-10-27

## Contexto

Nodia comparte tres modos históricos con persistencia, UI y ejecución. El usuario solicita retirar Web, renombrar token_plan_agentic a agentic y conservar API key, sin perder funciones actuales, con pruebas reales Linux/VM y API posterior.

## Opciones consideradas

### A: ocultar Web y conservar su runtime

Menor cambio inmediato, pero deja rutas, credenciales, dependencias, flags y contratos muertos y mantiene dos nombres para Agentic. No satisface la retirada solicitada.

### B: retirar Web integralmente y migrar el contrato

Un único lenguaje de modos, menor superficie y pruebas por capacidad. Requiere upgrade coordinado, protección de históricos y tratar explícitamente selecciones retiradas. Elegida por la instrucción del usuario.

## Decisión

Aplicar [plan90](../../mvp/90-agentic-api-only-web-retirement.md): API/TS usan agentic/api_key; flags can_use_agentic/use_agentic y fields.agentic. El microservicio privado sólo ejecuta Agentic; keys API permanecen cifradas en Server. Ningún fallback implícito. Los defaults Web se desasignan, no se convierten en otra modalidad. Conservar registros/snapshots históricos y su integridad; toda compatibilidad de lectura es explícita y no habilita ejecución Web. Migración incremental/transaccional con preflight, ensayo aislado y copia privada previa a aplicación real. Capacidades por proveedor/modelo/epoch verificadas, sin listas cerradas de modelos.

## Consecuencias

Retirar login/visor/SDK Web, delegación Web→Agentic y su UI; preservar admisión, cancelación, no-replay, confirmación e idempotencia. La brecha API del chat se trata como implementación verificable, no como una opción ficticia. No prometer paridad modal de proveedores sin prueba. Aplicar [plan91](../../mvp/91-ai-provider-onboarding-verification.md) a todo proveedor nuevo y registrar gates pendientes de VM/credencial.

## Referencias

- [Contrato funcional](../../mvp/ai-provider-feature-contract.md).
- [Política histórica48](../../mvp/48-nodia-ai-mode-routing-policy.md), sustituida en la retirada de Web por la decisión actual.
- [Publicación52](../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md): sin aprobar/publicar fichas por implementar.
