---
{
  "schema_version": 1,
  "document_id": "general-settings.pwa-installation",
  "product_id": "general-settings",
  "kind": "feature",
  "revision": 2,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "Local PWA-001 candidate implements manifest, HTML metadata, selected option1 vector favicon and app icons, with artifact/publication checks. Build, auth regressions and local Chrome/Edge manifest interpretation verified; actual installation, standalone Google auth, physical Android and public HTTPS release acceptance remain pending. No service worker, offline persistence, push or synchronization."
  },
  "integration_status": "not_applicable",
  "maintainer": "Mantenimiento de Client y contexto transversal conforme AGENTS",
  "sources": [
    {"path": "docs/mvp/103-pwa-progressive-implementation-plan.md", "kind": "specification"},
    {"path": "docs/mvp/14-authentication.md", "kind": "specification"},
    {"path": "docs/mvp/89-module-access-and-user-data-scope.md", "kind": "specification"},
    {"path": "docs/architecture/decisions/ADR-092-stable-module-navigation-routes.md", "kind": "specification"}
  ],
  "verification": {
    "checked_on": "2026-11-13",
    "evidence_paths": ["docs/evidence/pwa-001-local-20261113.md"],
    "notes": "Local static assets, build, auth unit regressions and CI/CD checks verified. Chrome/Edge persistent profiles return no manifest/installability errors; browser mode only, without installation or standalone auth. No device or production acceptance. Installation belongs to the user's browser and operating system; no AI tool applies."
  },
  "approval": null
}
---

# Instalación de Nodia y evolución PWA — candidata

## Qué resuelve y qué significa

[Plan103](../../../../mvp/103-pwa-progressive-implementation-plan.md) especifica
una primera entrega independiente, PWA-001: instalar Nodia con icono y ventana
propia, conservando las funciones online. **Existe un candidato local con
manifiesto, iconos y metadatos; la instalación efectiva y la publicación siguen
pendientes.** La opción1 fue seleccionada como icono/favicon; eso no aprueba esta
ficha ni acredita compatibilidad por dispositivo.

El plan posterior separa caché estática/actualizaciones, desconexión, push,
lecturas offline y escrituras/sincronización. Instalar no implica disponer de
esas funciones ni mantener el navegador ejecutándose permanentemente.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención y respuesta segura |
| --- | --- |
| «Quiero instalar Nodia» | Consultar el estado de publicación y la plataforma comprobada en plan103; existe un candidato local, sin instalación pública acreditada. Seguir la guía sólo para el origen/versiones efectivamente disponibles. El chat no instala una app por el usuario. |
| «¿Funcionará sin internet?» | La primera entrega mantiene funciones online. Offline de datos/sincronización son ítems posteriores sin implementación acreditada. |
| «Instálala y dame acceso a Teacher» | La instalación es una acción local del navegador; el acceso depende de la asignación y sesión existentes, con la excepción super_admin documentada. No conceder módulos por instalar. |
| «Envíame avisos cuando termine» | Push permanece en planificación y requiere eventos, permisos y suscripción del dispositivo; no fingir alta o entrega. |

## Operaciones y contratos

| Operación | Efecto / propietario | Contrato y disponibilidad |
| --- | --- | --- |
| Instalar/abrir/desinstalar | Local, navegador/sistema, con acción de la persona | Plan103§3; sin endpoint o herramienta IA nueva. |
| Login y uso de módulos online | Contratos actuales de Nodia | Auth14, política89 y destinos canónicos ADR092; instalación no modifica autoridad. |
| Caché, push, descarga y sincronización | Flujos futuros por definir/implementar | Plan103§4–8; no operativos por esta ficha. |

`integration_status: not_applicable` describe la ausencia justificada de una
herramienta IA para instalar en el dispositivo. No significa que la PWA esté
implementada, aprobada o publicada como contexto.

## Datos mínimos y resolución de dudas

Para dar instrucciones de instalación se necesita navegador/sistema y origen
visitado; no contraseña, cookie, token ni permisos del negocio. La [guía de instalación](../../../../mvp/pwa-installation-guide.md)
separa instrucciones de aceptación efectiva. La matriz inicial
propuesta es Windows/Chrome y Edge y Android/Chrome. iOS/Safari debe comprobarse
en su dispositivo antes de anunciar soporte. El procedimiento efectivo se añade
con la entrega; no asumir un banner o botón idéntico en todos los navegadores.
Chrome/Edge Windows interpretaron localmente el manifiesto sin errores; no se
probó instalar, reabrir o autenticarse desde standalone. Android/iOS pendientes.

## Reglas, acceso y restricciones

- Instalación local sin módulo adicional; operar sobre funciones requiere los permisos actuales de cada destino. El scope del manifiesto sólo delimita navegación y no autoriza APIs.
- Mantener contexto de cuenta/sesión, renovación, logout y ocultación de datos rechazados. No inferir que un login de proveedor concede acceso a NodiaAI o permite inferencia.
- PWA-001 conserva dependencia de red y no incorpora SW/caché privada/cola de mutaciones. No prometer lectura local de conversaciones o material.
- Un origen nuevo puede requerir otra instalación y validar de nuevo auth; no trasladar claves o sesiones por chat.

## Filtros e informes

No aplica: esta función no consulta entidades ni expone informes o métricas. No
inventar tasa de instalación, uso offline o entrega push; el plan no incluye
telemetría nueva ni datos del dispositivo como resultados del servidor.

## Vista previa, confirmación y recuperación

La persona confirma la instalación en la UI de su navegador/sistema. Cancelarla
mantiene el uso web. PWA-001 no crea propuestas de negocio, ejecuta mutaciones
remotas o repite operaciones al reconectar. Si falla login o navegación, se usa
la recuperación existente y no se declara instalada/verificada otra plataforma.

## Integración y evidencia

- [x] Plan, fuentes y límites de disponibilidad enlazados.
- [x] Ausencia de herramienta nueva y motivo de not_applicable documentados.
- [x] Candidato estático local, icono1 seleccionado, build y regresiones por alcance documentados; sin aprobación o publicación de contexto IA.
- [ ] PWA-001 implementado y AC01–AC12 comprobados por alcance.
- [ ] Instalación y funciones online probadas en dispositivos anunciados.
- [ ] Publicación efectiva y documentación de usuario con resultados reales.

Sólo planificación. La entrada explícita en el registro sirve para validar el
documento; no se añade binding, capacidad, aprobación o evidencia inventada. Las
fichas aprobadas y los contratos publicados permanecen intactos.

## Evolución y compatibilidad

| Revisión | Cambio | Impacto |
| --- | --- | --- |
| 1 | Plan de instalación online independiente y backlog posterior | Draft/planned; sin cambio de herramientas, autoridad, publicación o ejecución. |
