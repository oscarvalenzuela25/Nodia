---
{
  "schema_version": 1,
  "document_id": "businesses.supplier-visit-reminders",
  "product_id": "businesses",
  "kind": "feature",
  "revision": 8,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "PWA-004.02–.04 implementados en Server y Client local. PWA-004.05 verificó recepción con la pestaña cerrada, apertura desde el sistema y baja en Chrome para Windows. En Chrome para Android verificó recepción con Nodia cerrada y apertura con el worker instrumentado."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Negocios y NodiaAI conforme AGENTS",
  "sources": [
    { "path": "docs/mvp/103-pwa-progressive-implementation-plan.md", "kind": "specification" },
    { "path": "docs/mvp/31-provider-contacts-proposal.md", "kind": "specification" },
    { "path": "docs/architecture/decisions/ADR-111-web-push-provider-visit-reminders.md", "kind": "specification" },
    { "path": "nodia-server/src/provider/dto/create-provider.dto.ts", "kind": "implementation" },
    { "path": "nodia-server/src/visit-notifications/visit-notifications.controller.ts", "kind": "implementation" },
    { "path": "nodia-server/src/provider-visit-planning/use-case/reconcile-provider-visit-planning.use-case.ts", "kind": "implementation" },
    { "path": "nodia-server/src/visit-notifications/delivery/deliver-provider-visits.use-case.ts", "kind": "implementation" },
    { "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/ProvidersTab/components/ProviderModal/ProviderModal.tsx", "kind": "implementation" },
    { "path": "nodia-client/src/modules/notifications/pages/NotificationSettings/NotificationSettings.tsx", "kind": "implementation" },
    { "path": "nodia-client/public/service-worker.js", "kind": "implementation" }
  ],
  "verification": {
    "checked_on": "2026-11-20",
    "evidence_paths": ["docs/mvp/103-pwa-progressive-implementation-plan.md"],
    "notes": "NestJS compilado y PostgreSQL 16 aislado verificaron 004.02/004.03 con transporte sintético. El piloto HTTPS acreditó en Chrome para Windows recepción con la pestaña cerrada, apertura desde el aviso y baja desde la interfaz. En Chrome para Android verificó la apertura con el worker instrumentado. Una visita de control posterior a la revocación por API completó su ventana con cero intentos en cada plataforma."
  },
  "approval": null
}
---

# Recordatorios de visita de proveedores — candidata

[Producto Negocios](../README.md) y
[alcance de Client de PWA-004.04](../../../../mvp/103-pwa-progressive-implementation-plan.md#66-client-y-apertura-del-negocio--00404).
Server guarda el consentimiento, planifica las visitas y envía avisos cifrados
a instalaciones elegibles cuando está configurado el transporte. Client permite
gestionar la alarma, la preferencia y el alta por dispositivo. El
[piloto HTTPS](../../../../mvp/103-pwa-progressive-implementation-plan.md#67-piloto-https-y-retirada--00405)
verificó la recepción con la pestaña cerrada, la apertura del negocio desde
el aviso de Windows y la baja del dispositivo en Chrome. En Chrome para
Android se verificó la recepción con Nodia cerrada y la apertura del negocio
correcto desde el aviso con el worker instrumentado del piloto. Tras revocar
la suscripción de Android desde la API, una nueva visita completó su ventana
con cero intentos de envío. La
[ficha de horarios](supplier-visit-schedules.md) define qué se considera una visita.

## Solicitudes en lenguaje natural

| Solicitud | Tratamiento previsto |
| --- | --- |
| «¿A qué hora me avisaría si el proveedor llega a las 10:30?» | Comprobar si hay hora de alarma configurada. Con alarma vacía, el aviso se calcula para las 10:00. |
| «Avísame cuando venga el proveedor» | Activar los avisos de ese negocio en su pestaña Proveedores y usar **Activar en este dispositivo** en Mi cuenta → Notificaciones. |
| «¿Llegó el aviso a mi teléfono?» | Distinguir los estados del aviso. La aceptación del servicio push acredita su recepción para transporte, sujeta a caducidad. La lectura requiere evidencia propia. |
| «Activa avisos para el negocio de otra cuenta» | Derivar a la configuración de la cuenta propia, siguiendo el acceso de Negocios y la intervención del usuario en el dispositivo. |

## Operaciones y datos

La hora local opcional del proveedor tiene prioridad. Con alarma vacía se usa
el inicio menos 30 minutos. Si el día está configurado y la hora de inicio
está por confirmar, la hora por defecto es 09:00 en `America/Santiago`. El
cálculo usa los 30 minutos previos también si la alarma fija coincide con el
inicio conocido o cae después. La planificación guarda una ocurrencia por
negocio, proveedor, contacto y fecha. La hora de alarma pertenece al proveedor
y el horario semanal a cada contacto.

La preferencia personal parte desactivada. Server comprueba que el titular
sea dueño o colaborador activo del negocio y tenga acceso vigente a Negocios.
La suscripción pertenece a una cuenta e instalación. Al dar de baja una
instalación o revocar explícitamente la sesión vinculada, Server retira sus
datos de transporte. La expiración normal del login conserva el consentimiento.
Client solicita el permiso desde el botón de esa instalación. Al abrir el
aviso vuelve a comprobar la sesión y los permisos del negocio. El texto de la
notificación es genérico.

## Recuperación e integración

Server distingue ocurrencias planificadas, canceladas y expiradas. Cambiar o
desactivar un contacto o proveedor encola un recálculo durable. La agenda
conserva el horario vigente en Negocios. La entrega distingue aceptación del
transporte, rechazo, expiración y resultado incierto. Puede reintentar rechazos
temporales específicos dentro de la vigencia, con máximo de tres intentos.
Los resultados aceptados o inciertos quedan fuera de los reintentos. El alta, baja y permisos
se administran con la cuenta autenticada. La decisión técnica se mantiene
[propuesta](../../../../architecture/decisions/ADR-111-web-push-provider-visit-reminders.md).
