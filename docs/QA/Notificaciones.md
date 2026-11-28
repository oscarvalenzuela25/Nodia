# QA de Notificaciones

Usar [la cuenta de la ronda](README.md#ejecución). Para pruebas de entrega,
preparar un origen HTTPS habilitado, una instalación de prueba y un negocio,
proveedor y contacto sintéticos. Aislar la instalación y el horario de los
recordatorios operativos. Registrar zona, navegador y plataforma. Los casos
son manuales y el recordatorio se programa de forma determinista.

## Casos

| Caso | Preparación y pasos | Resultado y evidencia |
| --- | --- | --- |
| NOT-01 Estado del dispositivo | Abrir `/notifications` con el permiso del navegador sin conceder. Activar en el perfil aislado, aceptar el aviso del navegador y recargar. En una ejecución aislada separada, denegar el permiso con la misma cuenta. | El estado de la UI refleja permiso y suscripción de esa instalación. La activación persiste al recargar. Denegar el permiso muestra la causa y deja la instalación sin suscripción activa. Registrar estados y código de la operación, sin guardar el endpoint Push. |
| NOT-02 Preferencia y programación | En el negocio sintético, activar la preferencia de visitas. Crear una visita con hora conocida y dejar la alarma vacía. Ajustar luego una hora manual anterior a la visita y repetir con una visita cuyo horario esté por confirmar. | La alarma automática usa 30 minutos antes de la visita conocida y 09:00 cuando está por confirmar. La hora manual válida se usa el día de la visita en `America/Santiago`. Registrar fecha, hora esperada y `send_at` observado. |
| NOT-03 Entrega y apertura | Programar la próxima ocurrencia aislada, cerrar la pestaña y esperar la notificación real. Abrirla desde el dispositivo probado y volver a consultar el registro de entrega. | Se recibe el recordatorio de la ocurrencia, y al pulsarlo se abre el negocio previsto para la sesión válida. La ocurrencia registra un solo resultado por suscripción. Registrar la hora, la plataforma, el destino y el recibo sanitizado. |
| NOT-04 Baja y revocación | Desactivar esa instalación desde Notificaciones, recargar y verificar su estado. En un caso separado de laboratorio, retirar el permiso del navegador y volver a abrir la página. | La aplicación refleja la baja o el permiso retirado. La instalación no recibe el siguiente aviso de control. Las preferencias del negocio se observan por separado del estado del dispositivo. Registrar estado antes y después y limpiar sólo la instalación de QA. |

[Plan PWA y contrato de Web Push](../mvp/103-pwa-progressive-implementation-plan.md#6-pwa-004--notificaciones-push) ·
[Contactos de proveedores](../mvp/31-provider-contacts-proposal.md).
