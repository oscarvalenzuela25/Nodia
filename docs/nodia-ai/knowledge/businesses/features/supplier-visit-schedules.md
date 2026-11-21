---
{
  "schema_version": 1,
  "document_id": "businesses.supplier-visit-schedules",
  "product_id": "businesses",
  "kind": "feature",
  "revision": 1,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "Ampliación del horario nativo de Contactos para indicar día de visita con hora por confirmar. El estado de implementación y verificación por canal sigue el Plan31."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Negocios y NodiaAI conforme AGENTS",
  "sources": [
    { "path": "docs/mvp/31-provider-contacts-proposal.md", "kind": "specification" },
    { "path": "nodia-server/src/provider-contact/types/provider-contact.types.ts", "kind": "implementation" },
    { "path": "nodia-server/src/provider-contact/use-case/contact-validation.ts", "kind": "implementation" }
  ],
  "verification": {
    "checked_on": "2026-11-20",
    "evidence_paths": ["docs/mvp/31-provider-contacts-proposal.md"],
    "notes": "En PostgreSQL 16 aislado, HTTP real verificó alta con hora pendiente, replay, actividad y compatibilidad con intervalos. El CSV comprobó la ida y vuelta de las horas nulas. Plan31 separa la evidencia por canal."
  },
  "approval": null
}
---

# Horarios de visita de contactos — candidata

[Producto Negocios](../README.md) y
[contrato de horarios](../../../../mvp/31-provider-contacts-proposal.md#día-de-visita-con-hora-por-confirmar--2026-11-20).
El horario semanal de visita pertenece a un contacto de un proveedor. En cada
día se puede indicar un intervalo o una visita con hora por confirmar. La segunda
variante permite contar con el día en la agenda sin asignarle una hora ficticia.

## Solicitudes en lenguaje natural

| Solicitud | Intención y resolución |
| --- | --- |
| «¿Cuándo pasa este vendedor?» | Resolver negocio, proveedor y contacto. Distinguir el rango registrado de un día cuya hora sigue por confirmarse. |
| «El vendedor pasa el miércoles, todavía no sé a qué hora» | Registrar el día y la hora pendiente desde Contactos. Conservar las demás entradas al editar. |
| «Pasa a las 10:30» | Resolver contacto, día y fin del intervalo si faltan. |
| «Avisa a todos que viene cada miércoles» | Consultar el alcance de [recordatorios PWA-004](supplier-visit-reminders.md) y sus destinatarios autorizados. |

## Operaciones, datos y acceso

La vista Contactos usa los endpoints de proveedor existentes para listar y
guardar. Proveedores permite importar y exportar el JSON `contacts` en CSV.
El contrato `schedule` es semanal en `America/Santiago`. Una lista vacía o la
ausencia del día representan un día sin visita. Una entrada presenta dos
horas válidas `HH:mm` con inicio anterior al fin, o dos valores `null` explícitos
para una visita con hora por confirmar. La descripción es opcional.

El servidor valida la relación contacto, proveedor y negocio con la autoridad
de [Negocios](../../../../mvp/89-module-access-and-user-data-scope.md#contratos-y-barreras).
La activación de un contacto y su horario se resuelven por separado. Las
reglas de búsqueda y paginación siguen en [Plan31](../../../../mvp/31-provider-contacts-proposal.md#contrato-implementado).

## Confirmación, recuperación e integración

Editar por PUT reemplaza el horario enviado y aplica la versión del contacto.
Cuando existe un día con hora por confirmar, el reemplazo debe incluir su
clave. Usar `[]` para quitar deliberadamente la visita pendiente y una entrada
con las dos horas para confirmar el intervalo. El mismo contrato protege la
importación contra omisiones de clientes anteriores.
La importación conserva los controles de asociación, replay y transacción. Ante
un conflicto, recargar la versión vigente del contacto y revisar los cambios.

La lectura de NodiaAI v2 devuelve un conflicto cuando su página contiene una
visita con hora pendiente. El preparador existente de reemplazo completo
rechaza cambios a esos contactos. La acción de actividad conserva el horario.
La persona puede consultar o editar la visita en **Proveedores → Contactos**
o por CSV. El [contrato de compatibilidad](../../../../mvp/31-provider-contacts-proposal.md#compatibilidad-de-nodiaai)
conserva las revisiones firmadas. La [revisión aprobada de Contactos](supplier-contacts.md)
conserva su evidencia y aprobación originales. Esta ficha es una candidata
sin nueva aprobación o publicación. La [planificación push](supplier-visit-reminders.md)
registra sus propios estados y pendientes.
