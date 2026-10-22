# ADR-032 — NodiaAI con herramientas de dominio e historial propio

> Estado: propuesto — alcance de producto confirmado; diseño técnico pendiente de viabilidad
> Fecha: 2026-10-14

## Contexto

El usuario solicita NodiaAI como página de chat con historial, configuración por conexión/modo/modelo, Gemini API/Web/Agentic por etapas y entradas de texto, imágenes, PDF y voz. Cada conjunto de cambios requiere vista previa editable y confirmación; una conversación puede combinar módulos.

Alcance adicional confirmado y aclaración posterior del 2026-10-14: consultar/crear/actualizar/eliminar información con las mismas operaciones/restricciones del backend de los dominios v1, además de consultas específicas, filtros e informes. Eliminación sustituye su aplazamiento anterior; lotes continúan fuera del alcance confirmado. Los ejemplos no forman un catálogo cerrado. Cambiar conexión/modo/modelo entre turnos preserva historial, decisiones y efectos. Salir de la página no detiene el trabajo: continuar y guardar el resultado obliga a separar ejecución de conexión HTTP y a diseñar recuperación persistida.

Ante pregunta específica, el usuario confirma todos los módulos actuales, incluidos Ajustes Generales: usuarios, roles, módulos y configuración además de Negocios/Reservas/Finanzas. Paridad funcional con contratos e invariantes, no exposición indiscriminada de rutas privadas. Operaciones que requieren secretos o autenticación interactiva usan flujos seguros existentes/asistidos sin entregar credenciales al modelo.

Durante el [inventario39](../../mvp/39-nodia-ai-current-capabilities-inventory.md), el usuario confirma tres decisiones: excluir de v1 los siete handlers bulk/import de escritura; exigir módulo de destino asignado además de NodiaAI para usuarios distintos de super_admin; e incluir filtros/agrupaciones/sumas combinables sobre campos/relaciones permitidos. La matriz actual de177 handlers/296 rutas es evidencia estática, no un catálogo MCP ejecutable ni disponibilidad de inferencia.

El usuario confirmó expresamente acceso transversal de `super_admin` a conversaciones y datos/operaciones, incluidas Finanzas y Reservas. Esto cambia sus restricciones anteriores de acceso, pero conserva propiedad de datos, validaciones e identidad del actor. La política nueva no está implementada.

Los adaptadores actuales son de extracción, con garantías distintas entre modos. Reservas tiene recuperación idempotente, Finanzas no ofrece la misma deduplicación por intención y Contactos posee creación idempotente y versionado. Reutilizarlos no demuestra automáticamente continuidad conversacional.

## Opciones consideradas

### Opción A acceso SQL libre desde el agente

- Ventajas: permite expresar consultas amplias con poco catálogo inicial.
- Desventajas: escrituras eluden reglas, auditoría y recuperación del dominio; lecturas pueden exponer columnas privadas, causar cargas ilimitadas o sumar incorrectamente. El rol del usuario no evita errores de interpretación o concurrencia.

### Opción B coordinador en Nodia Server y herramientas de dominio compartidas

- Ventajas: mantiene casos de uso como implementación única, permite confirmar comandos estructurados y recuperar efectos; catálogo reutilizable desde function calling y fachada MCP.
- Desventajas: necesita operaciones y consultas explícitas, contratos por adaptador y viabilidad por modo. La coordinación de varias escrituras no concede atomicidad automáticamente.

### Opción C runtime externo con MCP directo y estado exclusivo del proveedor

- Ventajas: aprovecha capacidades de sesiones/herramientas de un runtime.
- Desventajas: acopla continuidad y autorización al proveedor y limita portabilidad. Acceso directo a un microservicio privado cambiaría ADR-008; requiere comprobar transporte, identidad, aislamiento, renovación y cancelación.

## Decisión

Alcance revisado por el usuario el2026-10-14: Web sólo conversación, Agentic con MCP y alternancia desde Web únicamente si habilita un switch y el destino está verificado. API después. [ADR-036](ADR-036-nodia-ai-opt-in-agentic-routing.md)/[política48](../../mvp/48-nodia-ai-mode-routing-policy.md) detallan esta excepción autorizada y los contratos pendientes; no habilitar herramientas de dominio en Web ni sustituir un modo fallido.

Proponer B. Nodia conserva historial canónico, propuestas, confirmaciones y operaciones; el adaptador conserva su estado específico separado. El modelo propone una herramienta y argumentos; Server autentica, autoriza, valida y ejecuta el caso de uso. SQL se construye desde consultas del backend, sin herramienta genérica de SQL.

Diseñar una fachada MCP junto al coordinador, sin crear un microservicio por defecto ni habilitar herramientas en el extractor OCR existente. Transporte, SDK, persistencia detallada y uso de runtime agéntico se deciden después de la matriz de viabilidad.

Proponer un registro de capacidades versionado por módulo, con descripción funcional, esquemas derivados de contratos, operaciones/filtros/medidas admitidos y autoridad ejecutada en Server. El modelo descubre módulos accesibles y carga detalles relevantes; cada módulo nuevo integra su catálogo y pruebas como parte de su entrega. Markdown sirve como explicación versionada, OpenAPI como inventario/esquemas y la BD como datos; ninguno reemplaza casos de uso o concede automáticamente una herramienta. No explorar rutas/tablas arbitrarias ni copiar todas las columnas ORM al catálogo.

Convención documental solicitada el 2026-10-14: mantener explicaciones en `docs/nodia-ai/knowledge/`, con [estándar, índices y plantillas](../../nodia-ai/knowledge/README.md) exigidos desde AGENTS al especificar productos/funciones y al modificar su comportamiento. Estados de aprobación, implementación e integración separados; fichas y publicación no conceden autoridad ni prueban ejecución. Esta concreción de autoría no aprueba el ADR ni implementa el registro/publicador.

El coordinador valida módulo de destino al descubrir, ejecutar y recuperar para ordinarios; asignar módulo padre a recursos sin página independiente. Revalidar revocación y conservar RequireAction ai:manage/reglas de ámbito donde existan. No asumir que invocar un caso de uso internamente atraviesa guards y ValidationPipe HTTP, ni introducir permisos granulares donde el producto los descartó.

Inventariar correspondencia HTTP/herramientas o flujos seguros para todos los módulos actuales, incluidas escrituras y eliminación cuando exista. Conservar reglas de último superadministrador/rol reservado/claves inmutables y permisos específicos de configuración. Consultas estructuradas pueden combinar filtros/agrupaciones/agregados permitidos sin necesitar un reporte UI por cada pregunta. El backend construye SQL parametrizado, valida ámbito y acota trabajo. Una operación ausente o un dato inexistente no se completa con SQL libre o resultados inventados.

No proponer un corte arbitrario por número de mensajes. Historial guardado, contexto activo del modelo, retención y límites por ejecución son conceptos separados. Conservar historial/estado al compactar o alcanzar un límite técnico; valores por tiempo, pasos, concurrencia y volumen se fijan con evidencia.

La autoridad transversal de `super_admin` es una decisión de producto confirmada por el usuario. Su implementación debe compartir política con los dominios y separar actor administrador de destinatario/propietario. No trasladar ese privilegio a otros roles ni convertir lectura de chat ajeno en consentimiento para ejecutar una propuesta.

Proponer ejecuciones identificadas/persistidas en Server con configuración fija, sin cancelación por desconexión del navegador y con consulta de estado al regresar. Worker/cola y protocolo de eventos se eligen tras viabilidad. Reinicio o resultado incierto requiere reconciliar, sin reenvío automático; conservar deadlines y cancelación explícita. El flujo OCR mantiene sus garantías propias.

## Consecuencias

Derivación del2026-10-14: [catálogo40](../../mvp/40-nodia-ai-tool-catalog-v1.md) y [contratos41](../../mvp/41-nodia-ai-v1-contracts.md) proponen156 herramientas (141 de dominio,11 comunes,4 flujos seguros), sin publicación/runtime. El usuario confirma botón sobre preview exacta, secuencia con conservación de efectos y recuperación sin duplicar, e informes cruzados compatibles con procedencia separada. La coordinación específica queda en [ADR-033](ADR-033-nodia-ai-confirmation-and-sequential-recovery.md), propuesto; ERD/esquemas por dominio y viabilidad pendientes.

- Positivas: reglas únicas, efectos revisables, recuperación y continuidad controladas por Nodia.
- Costos/riesgos de la propuesta: catálogo de operaciones, persistencia de contexto, manejo multimodal y limitaciones de Web/Agentic. Las preferencias y resúmenes no garantizan recuerdo perfecto ni autorización.
- Trabajo posterior: matriz Gemini, política administrativa, comandos versionados, idempotencia transaccional para operaciones que carecen de ella, límites y retención de adjuntos, pruebas de concurrencia/cancelación, ERD y tareas.
- Reabrir revisión del acceso en Finanzas22/Reservas28 y ajustar sus consumidores/cachés/tests. La evidencia anterior valida la política histórica, no la nueva.
- Conservar sesión, propiedad e integridad. Ninguna transacción permanece abierta mientras el modelo responde o el usuario confirma.
- No se instala software, modifica código, ejecuta inferencia ni migra datos por registrar este ADR.

## Referencias

- [ERD42](../../mvp/42-nodia-ai-erd.md), [ejecución43](../../mvp/43-nodia-ai-execution-architecture.md), [ADR-034](ADR-034-nodia-ai-postgres-jobs-and-retention.md): derivación propuesta sin nuevo microservicio ni runtime habilitado.

- [Investigación y plan NodiaAI](../../mvp/38-nodia-ai-research-and-v1-plan.md).
- [Inventario actual de capacidades39](../../mvp/39-nodia-ai-current-capabilities-inventory.md) y [snapshot de endpoints](../../mvp/nodia-ai-current-endpoints.json).
- [Contrato IA](../../mvp/ai-provider-feature-contract.md).
- [Finanzas22](../../mvp/22-personal-finance-contracts.md), [Reservas28](../../mvp/28-rental-reservations-contracts.md), [Contactos31](../../mvp/31-provider-contacts-proposal.md).
- [ADR-008](ADR-008-internal-microservices-only.md), [ADR-012](ADR-012-rental-property-collaboration.md).
