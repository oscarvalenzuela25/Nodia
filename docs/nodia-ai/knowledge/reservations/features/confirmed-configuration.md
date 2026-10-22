---
{
  "schema_version": 1,
  "document_id": "reservations.confirmed-configuration",
  "product_id": "reservations",
  "kind": "feature",
  "revision": 1,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "AI-24 implementa y verifica en laboratorio privado seis puertos internos de configuración de casas, colaboradores y políticas, con confirmación exacta y recibos atómicos. SQL/HTTP/worker, recuperación y activación comprobados; preparadores MCP sin publicar y aceptación de escrituras Gemini pendiente."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Reservas y NodiaAI conforme AGENTS",
  "sources": [
    { "path": "docs/mvp/28-rental-reservations-contracts.md", "kind": "specification" },
    { "path": "docs/mvp/41-nodia-ai-v1-contracts.md", "kind": "specification" },
    { "path": "docs/mvp/70-nodia-ai-ai24-rental-configuration.md", "kind": "specification" },
    { "path": "nodia-server/src/rental-property/use-case/create-rental-property.use-case.ts", "kind": "implementation" },
    { "path": "nodia-server/src/rental-property/use-case/update-rental-property.use-case.ts", "kind": "implementation" },
    { "path": "nodia-server/src/rental-collaborator/use-case/create-rental-collaborator.use-case.ts", "kind": "implementation" },
    { "path": "nodia-server/src/rental-collaborator/use-case/update-rental-collaborator.use-case.ts", "kind": "implementation" },
    { "path": "nodia-server/src/rental-cancellation-policy/use-case/create-rental-cancellation-policy.use-case.ts", "kind": "implementation" },
    { "path": "nodia-server/src/rental-cancellation-policy/use-case/update-rental-cancellation-policy.use-case.ts", "kind": "implementation" }
  ],
  "verification": {
    "checked_on": "2026-10-17",
    "evidence_paths": ["docs/mvp/70-nodia-ai-ai24-rental-configuration.md", "docs/evidence/nodia-ai-ai24-ui-validation.json", "docs/evidence/nodia-ai-ai24-postgresql.json", "docs/evidence/nodia-ai-ai24-regressions.json", "docs/evidence/nodia-ai-ai24-lab-activation.json", "docs/evidence/nodia-ai-ai24-deployed-equality.json", "docs/evidence/nodia-ai-ai24-lab-runtime.json", "docs/evidence/nodia-ai-ai24-knowledge-validation.json"],
    "notes": "Server2418/191, Client1441/202 y focal178/5;227 comprobaciones SQL/HTTP/procesos (36 nuevas y191 de regresión), tipado/lint/build y QA sintético ES/EN/móvil. Laboratorio privado activo con25 migraciones/18 tablas NodiaAI/241 columnas,32 ejecutores y0 pendientes; sin esquema nuevo. La ficha sigue draft/unregistered y excluida del bundle; verificación interna no acredita publicación MCP, escritura Gemini o aprobación humana."
  },
  "approval": null
}
---

# Configuración confirmada de Reservas

## Qué resuelve y qué significa

Crear/editar casas, acceso de colaboradores y políticas de cancelación mediante propuestas exactas, sin duplicar la lógica nativa. Esta ampliación interna de [AI-24/70](../../../../mvp/70-nodia-ai-ai24-rental-configuration.md) no confirma una estadía ni cobra o devuelve dinero. Las nueve fichas aprobadas de lectura mantienen su alcance y esta ficha no se publica por existir.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Duda o mínimo pendiente | Aclaración esperada |
|---|---|---|---|
| «Crea una casa para seis huéspedes» | Alta de alojamiento | Nombre y dueño autorizado | Preguntar el nombre; mostrar defaults efectivos antes de confirmar |
| «Dale acceso a esta persona» | Agregar colaborador | Casa y usuario concreto | Resolver ambos; no asignar módulos generales ni crear un usuario nuevo implícitamente |
| «Quita el acceso a ese colaborador» | Editar actividad del vínculo | Vínculo exacto | Proponer is_active false, sin borrado físico |
| «Cambia la devolución a la mitad desde una semana antes» | Crear/editar reglas de política | Política, umbral cero y demás reglas | Resolver política y completar sólo reglas mínimas, sin inventar porcentajes |
| «Borra la casa y todo su historial» | Operación sin DELETE nativo | Desactivación frente a eliminación | Explicar la operación disponible y pedir intención exacta; no borrar registros relacionados |

## Operaciones y contratos

| Operación | Preparador interno | Writer nativo y resultado |
|---|---|---|
| Crear/editar alojamiento | `nodia_rental_properties_prepare_create`, `_update` | `CreateRentalPropertyUseCase`, `UpdateRentalPropertyUseCase`; casa configurada |
| Agregar/editar colaborador | `nodia_rental_collaborators_prepare_create`, `_update` | `CreateRentalCollaboratorUseCase`, `UpdateRentalCollaboratorUseCase`; asociación individual |
| Crear/editar política | `nodia_rental_cancellation_policies_prepare_create`, `_update` | `CreateRentalCancellationPolicyUseCase`, `UpdateRentalCancellationPolicyUseCase`; política y reglas |

Los sufijos abreviados sustituyen el sufijo del nombre completo de cada fila. Son seis registros internos, sin publicación MCP ni efectos externos nuevos. Los DTOs/casos de uso nativos enlazados en sources prevalecen sobre ejemplos; no hay SQL o HTTP arbitrario.

## Datos mínimos y resolución de dudas

| Concepto | Mínimo o condición | Resolución |
|---|---|---|
| Casa nueva | Nombre y capacidad entera 1..1000 | Dueño/zona/defaults proceden del contrato autorizado, visibles en preview; campos opcionales no se exigen |
| Edición de casa | ID y cambio admitido | Política predeterminada pertenece a la casa y sigue activa; no hay transferencia de dueño por update |
| Colaborador | Casa y usuario existente al crear; vínculo al editar | Cargo opcional/nullable; no duplicar vínculo ni agregar al dueño como colaborador |
| Política | Casa, nombre al crear y reglas | 1..100 reglas, umbrales enteros 0..36500 únicos y una regla cero; porcentaje string 0..100 con hasta dos decimales |

Distinguir ausencia, null, cero y cadena vacía. IDs bigint e importes enteros viajan como strings; porcentajes no se convierten a flotantes para persistir. Resolver entidades ambiguas antes de preparar. Editar reglas reemplaza la colección solicitada; no completa umbrales o porcentajes dudosos.

## Reglas, acceso y restricciones

Módulos NodiaAI y `rental_reservations` para ordinarios, más autoridad nativa de dueño en configuración; `super_admin` transversal conserva su propia identidad conforme [54](../../../../mvp/54-nodia-ai-ai08-transversal-authority.md). Colaboración no concede administración. Cambios de permisos se releen en preparación, confirmación y ejecución.

Zona de casa con historial es inmutable; reducir capacidad y aumentar preparación mínima respeta acuerdos vigentes/transiciones aprobadas. No desactivar una política que sigue predeterminada; la modificación de reglas no reescribe snapshots de acuerdos históricos. No se crean DELETE, pagos ni transiciones de reservas en esta etapa.

El backend ordena umbrales y normaliza porcentajes. No impone monotonicidad de devolución; no introducir esa regla desde la UI. Credenciales y datos privados ajenos al contrato nunca entran al contexto. Configuración o sesión autenticada no prueban que el proveedor pueda ejecutar herramientas.

## Filtros e informes

AI-24 no agrega informes ni filtros. Se mantienen las lecturas publicadas de [casas/colaboradores](properties-and-collaborators.md), [políticas](cancellation-policies.md) y [disponibilidad](availability-and-calendar.md), con autoridad y límites de AI-15. Capacidad configurada no equivale a disponibilidad para un intervalo. Porcentajes de política no se suman como importes pagados ni se mezclan con gastos.

## Vista previa, confirmación y recuperación

La propuesta congela comando/scope/precondiciones, muestra cambios exactos y sus defaults efectivos y requiere botón humano sobre revisión/hash. La edición crea otra revisión y confirmación. Client permite filas estructuradas de días/porcentaje, conserva borrador/foco al fallar y muestra errores; nunca confirma una colección parcialmente válida.

El escritor y `RentalEffectReceipt` comparten transacción local. El recibo acredita recurso/ID/operación/casa originales; recuperar no repite el efecto. Los controles de [66](../../../../mvp/66-nodia-ai-ai20-execution-recovery.md) conservan una intención tras rollback y concilian resultados inciertos antes de otro intento. Conjuntos de [69](../../../../mvp/69-nodia-ai-ai23-dependent-workflows.md) conservan commits anteriores; cancelar no los revierte. Esta entrega no habilita bindings nuevos de casa futura.

Expirar el chat elimina sus datos técnicos resueltos, sin borrar el alojamiento o sus políticas/asociaciones. Los pendientes inciertos conservan sólo el descriptor mínimo hasta conciliarlos. El recibo es histórico y no promete que el registro siga sin cambios; Client enlaza `/tools/reservations` y refresca su caché autorizada.

## Integración y evidencia

- [x] Fuentes nativas, mínimos y reglas contrastados; estados separados de aprobación.
- [x] Seis puertos, coordinación SQL/HTTP/worker y activación del laboratorio privado consolidados en70 con evidencia trazable; sin cambios de esquema.
- [x] Evidencia de UI sintética ES/EN/móvil y suite Client consolidada en70; no equivale a SQL/proveedor real.
- [ ] Publicación de preparadores MCP y aceptación con Gemini.

La ficha permanece draft/unregistered y approval null; no tiene binding publicado de preparación MCP. [70](../../../../mvp/70-nodia-ai-ai24-rental-configuration.md) registra las pruebas de unidad, bases PostgreSQL desechables, QA de UI y activación privada por separado. Las fixtures no acreditan inferencia real ni aceptación productiva pública.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Herramientas/contexto y compatibilidad |
|---|---|---|
| 1 | AI-24: seis operaciones de configuración con escritores nativos y recibos | Ficha nueva draft excluida; cuerpos aprobados de lectura intactos. Cambios materiales de contrato/precondiciones invalidan propuestas incompatibles antes del efecto. |
