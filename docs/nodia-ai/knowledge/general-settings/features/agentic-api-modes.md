---
{
  "schema_version": 1,
  "document_id": "general-settings.agentic-api-modes",
  "product_id": "general-settings",
  "kind": "feature",
  "revision": 1,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "Retirada de Web y migración a Agentic/API key en desarrollo. La aceptación local, PostgreSQL aislado, VM y API real se registran por separado."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Ajustes Generales y NodiaAI conforme AGENTS",
  "sources": [
    { "path": "docs/mvp/90-agentic-api-only-web-retirement.md", "kind": "specification" },
    { "path": "docs/mvp/91-ai-provider-onboarding-verification.md", "kind": "specification" },
    { "path": "docs/mvp/ai-provider-feature-contract.md", "kind": "specification" },
    { "path": "nodia-server/src/ai-provider/entities/ai-provider.entity.ts", "kind": "implementation" },
    { "path": "nodia-server/src/ai-provider/entities/ai-provider-catalog.entity.ts", "kind": "implementation" },
    { "path": "nodia-server/src/nodia-ai-adapter/use-case/resolve-nodia-ai-adapter.use-case.ts", "kind": "implementation" }
  ],
  "verification": {
    "checked_on": null,
    "evidence_paths": [],
    "notes": "Pendiente de consolidar pruebas locales, migración y aceptación real; no inferir disponibilidad del catálogo."
  },
  "approval": null
}
---

# Agentic y API key — contexto funcional para NodiaAI

[Producto](../README.md), [plan de retirada](../../../../mvp/90-agentic-api-only-web-retirement.md) y [aceptación de proveedores](../../../../mvp/91-ai-provider-onboarding-verification.md).

## Qué resuelve y qué significa

Nodia utiliza dos modos: **Agentic** (`agentic`) y **API key** (`api_key`). La identidad del proveedor, una instancia de conexión y el modo son conceptos distintos. Un proveedor nuevo requiere un adaptador verificado: habilitar un flag no lo implementa.

Agentic usa la sesión oficial del adaptador correspondiente. API key usa una clave cifrada ligada a la instancia. No comparten credenciales ni heredan modelos entre modos. Web se retira; las evidencias antiguas de Web explican hechos históricos y no habilitan su ejecución.

## Solicitudes en lenguaje natural

| Solicitud | Intención y resolución |
|---|---|
| «Usa Agentic» | Identificar instancia y modelo configurados; verificar disponibilidad de esa selección. |
| «Usa mi API key» | Identificar instancia API y modelo elegido; nunca pedir la clave en el chat del producto. |
| «Mi chat usaba Web» | Conservar el historial y solicitar una nueva selección explícita antes de enviar. |
| «Prueba un proveedor nuevo» | Aplicar P01–P16 del plan91 y declarar las capacidades no soportadas. |
| «Si falla, usa otra cuenta o modo» | No cambiar automáticamente proveedor, modo, modelo ni credencial fuera de la rotación autorizada de la misma instancia API. |

## Operaciones y contratos

| Operación | Contrato y efecto |
|---|---|
| Configurar instancia | `use_agentic`, `use_api_key`, `default_mode` nullable y configuración separada en `fields.agentic`/`fields.api_key`. Confirmación humana y permisos de la operación nativa. |
| Configurar catálogo | `can_use_agentic` y `can_use_api_key` describen modos configurables; no garantizan autenticación, inferencia o modalidades. |
| Migrar instalación histórica | Renombrar Agentic preservando identidad/configuración; desasignar Web sin elegir otro modo. Conflictos y trabajos activos bloquean la migración. |
| Consultar salud | Una observación real por la caché unificada; datos ausentes son desconocidos. El topbar API verde significa clave guardada, no inferencia exitosa. |
| Ejecutar OCR | Instancia, modo y modelo explícitos; resultado validado como borrador, con cero y null distintos. Guardar o actualizar productos conserva revisión y confirmación humanas. |
| Conversar y usar herramientas | Agentic conserva su runtime verificado. API key no obtiene chat, MCP o imágenes por tener una clave: cada capacidad exige adaptador y verificación propios. |

## Reglas, acceso y restricciones

Se mantienen autoridad por módulos y propietario/colaborador, bypass de super_admin conforme a política89, secretos en canal seguro, idempotencia y tratamiento de resultados inciertos. Elegir Agentic o API key no confirma escrituras. Los snapshots y recibos históricos no se reescriben para aparentar compatibilidad.

El modelo se descubre y configura dinámicamente. No hay listas cerradas de modelos, modelos por defecto inventados, cuotas ficticias ni capacidades inferidas del nombre. Una respuesta HTTP exitosa sin contenido válido no cierra una prueba de inferencia.

## Estados, errores y recuperación

Una selección retirada o incompleta bloquea el envío y permite reconfigurar sin perder el historial. Un fallo de mutación conserva formulario y borrador. Timeout o cancelación con resultado incierto requieren conciliación exacta, sin reenvío de generación. Un servicio caído no justifica un fallback a otra modalidad.

## Verificación y pendientes

Aplicar la matriz P01–P16 del plan91 por proveedor, modo, modelo y entorno. Separar configuración, autenticación, descubrimiento, éxito de inferencia y aceptación de cada función. El alcance de una prueba en VM Linux no certifica Windows ni producción global. Esta ficha permanece en revisión, sin publicación ni herramientas nuevas.
