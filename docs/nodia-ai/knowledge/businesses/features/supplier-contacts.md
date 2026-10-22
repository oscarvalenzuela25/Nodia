---
{
  "schema_version": 1,
  "document_id": "businesses.supplier-contacts",
  "product_id": "businesses",
  "kind": "feature",
  "revision": 4,
  "document_status": "approved",
  "implementation": {
    "status": "partial",
    "notes": "Publicación AI-15 de las lecturas/referencias expresamente enumeradas mediante contratos cerrados y reglas nativas. Las escrituras y otras etapas del producto no se habilitan. La disponibilidad de cada dependencia se observa por separado; no se promete éxito de toda inferencia ni acceso a contenido R2 no configurado."
  },
  "integration_status": "published",
  "maintainer": "Mantenimiento de Negocios y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/features/businesses/01-prd.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/19-prelaunch-review.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/31-provider-contacts-proposal.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/provider-contact/entities/provider-contact.entity.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/provider-contact/use-case/contact-validation.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/business/use-case/read-nodia-ai-business.use-case.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-16",
    "evidence_paths": [
      "docs/mvp/51-nodia-ai-ai05-product-knowledge.md",
      "docs/evidence/nodia-ai-ai05-knowledge-validation.json",
      "docs/evidence/nodia-ai-ai15-postgres-integration.json",
      "docs/evidence/nodia-ai-ai15-external-validation.json",
      "docs/evidence/nodia-ai-ai15-artifacts-integration.json",
      "docs/evidence/nodia-ai-ai15-live-local.json",
      "docs/evidence/nodia-ai-ai15-live-artifacts.json",
      "docs/evidence/nodia-ai-ai15-live-routing-interrupted.json",
      "docs/evidence/nodia-ai-ai15-live-external-final.json",
      "docs/evidence/nodia-ai-ai15-live-quota-gateway-final.json",
      "docs/evidence/nodia-ai-ai15-live-codex-root-postfix.json"
    ],
    "notes": "Gemini Agentic real completó un turno de cinco familias SQL (10 comprobaciones) y otro de tres referencias (12): dos CSV autenticados correctos; factura devuelve 503 por R2 sin configurar. La emisión de referencia no certifica bytes disponibles. Routing real completó Web conversacional y delegación opt-in SQL; el siguiente turno Web quedó unknown/502 y se concilió sin replay. El ensayo externo final completó recibos health/engines y luego quedó unknown; no se registra como aceptación generativa completa. La regresión Gateway de las cinco salidas usa observaciones sintéticas y cero inferencias. Los fallos permanecen en sus informes, sin atribuirlos a causa no observada. Las demás lecturas conservan su evidencia aislada SQL/HTTP; publicar no garantiza que el modelo siempre construya llamadas válidas."
  },
  "approval": {
    "reference": "docs/evidence/nodia-ai-ai15-publication-authorization.md",
    "revision": 4,
    "content_sha256": "f999a557ac417e8d78b60374e8022bee553022f6befd9becc1e300e9ef40f17e"
  }
}
---

# Contactos de proveedores — contexto funcional para NodiaAI

Estado actual: esta revisión publica sólo el fragmento «Lecturas disponibles en AI-15». Las secciones de implementación/evidencia anteriores a ese fragmento conservan la trazabilidad de entregas iniciales; sus frases históricas sobre publicación pendiente no sustituyen el frontmatter actual ni habilitan escrituras.

[Producto](../README.md). Metadatos canónicos migrados en [AI-06](../../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); esta revisión tiene autorización específica de publicación para las lecturas enumeradas al final; las demás operaciones conservan sus gates.

## Qué resuelve y qué significa

Guardar personas/áreas de contacto del proveedor, teléfonos, email y horario semanal propio del contacto.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención y aclaración esperada |
|---|---|
| «Agrega este teléfono al proveedor…» | Resolver cuál contacto; si nuevo preguntar nombre, y prefijo si no está claro. |
| «Cambia el horario del vendedor» | Pedir día e intervalo y conservar otros días. |
| «Envíale un WhatsApp» | Este contrato sólo guarda datos/enlace; no afirmar envío ni cuenta activa. |

Ejemplos ilustrativos sin resultados ni identificadores reales. Preguntar sólo obligatorios y ambigüedades; los opcionales no bloquean salvo condición del dominio.

## Operaciones y contratos

| Handler y ruta de referencia | Candidato del catálogo40 | Tratamiento vigente |
|---|---|---|
| [ProviderContactController.list](../../../../../nodia-server/src/provider-contact/provider-contact.controller.ts)<br>`GET /api/v1/providers/:providerId/contacts` | `nodia_provider_contacts_list` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [ProviderContactController.create](../../../../../nodia-server/src/provider-contact/provider-contact.controller.ts)<br>`POST /api/v1/providers/:providerId/contacts` | `nodia_provider_contacts_prepare_create` (prepare_change, candidato40) | Candidato; sin publicar |
| [ProviderContactController.update](../../../../../nodia-server/src/provider-contact/provider-contact.controller.ts)<br>`PUT /api/v1/providers/:providerId/contacts/:id` | `nodia_provider_contacts_prepare_update` (prepare_change, candidato40) | Candidato; sin publicar |
| [ProviderContactController.toggle](../../../../../nodia-server/src/provider-contact/provider-contact.controller.ts)<br>`PATCH /api/v1/providers/:providerId/contacts/:id/status` | `nodia_provider_contacts_prepare_set_active` (prepare_change, candidato40) | Candidato; sin publicar |

Los aliases de [inventario39](../../../../mvp/nodia-ai-current-endpoints.json) no crean capacidades distintas. Los nombres de operaciones proceden del catálogo documentado en [catálogo40](../../../../mvp/40-nodia-ai-tool-catalog-v1.md): sólo las lecturas enumeradas en esta revisión tienen binding explícito de publicación; las escrituras continúan candidatas.

DTOs de entrada/filtros: [provider-contact.dto.ts](../../../../../nodia-server/src/provider-contact/dto/provider-contact.dto.ts)

Delegación actual (casos de uso/servicios según controlador): [get-provider-contacts.use-case.ts](../../../../../nodia-server/src/provider-contact/use-case/get-provider-contacts.use-case.ts), [create-provider-contact.use-case.ts](../../../../../nodia-server/src/provider-contact/use-case/create-provider-contact.use-case.ts), [update-provider-contact.use-case.ts](../../../../../nodia-server/src/provider-contact/use-case/update-provider-contact.use-case.ts)

## Datos mínimos y resolución de dudas

| Dato/operación | Obligatorio, condicional u opcional; resolución |
|---|---|
| Crear | providerId bigint, name y request_key UUID v4 de Server/coordinador. Teléfonos/email/horario/comentario opcionales. |
| Teléfono y edición | Número E.164 internacional; elegir contacto existente o pedir su nombre si es nuevo. PUT exige valores completos y version; PATCH status sólo activo/version. |

Actor, permisos efectivos, claves de intención, versiones de concurrencia y referencias internas los controla Server; no los inventa ni decide el modelo. DTOs enlazados son fuente de campos, no un JSON Schema estricto de herramienta ya publicado.

## Reglas, acceso y restricciones

No hay GET individual ni DELETE de contacto; listar por proveedor para resolverlo. PUT reemplaza valores: omitir opcionales los vacía; para «agrega un número» leer y conservar teléfonos/horarios/email actuales. Máximo10 teléfonos, sin duplicados internos; horario por contacto, un rango/día, HH:mm con inicio<fin, sin nocturnos; zona semanal America/Santiago.

Destino /tools/business. Server restringe editar negocio y colaboradores a dueño o super_admin; listado normal usa pertenencia y all_businesses requiere super_admin. El acceso global autenticado a productos/proveedores/facturas/archivos es intencional conforme19, no el RBAC granular del PRD inicial. NodiaAI añade módulo propio y destino para ordinarios (AI-07), sin inventar permisos por acción ni usar alcance global para romper asociaciones.

## Filtros e informes

Búsqueda literal por contacto con page/limit≤100; no inferir totales de compras ni mandar WhatsApp/correo desde el chat. Nombres de personas conservan mayúsculas.

El nuevo registro combinable de [contratos41](../../../../mvp/41-nodia-ai-v1-contracts.md) sigue pendiente AI-30/31; filtros REST existentes no autorizan joins, campos o SQL libres. [Política50](../../../../mvp/50-nodia-ai-ai04-runtime-policy.md) acota trabajo del chat y no reemplaza silenciosamente límites del módulo.

## Vista previa, confirmación y recuperación

Usar request_key/creation_hash nativos para creación y CAS version/replay idéntico para edición. Preview muestra colección final y vaciados; ante conflicto releer/versionar, no sobrescribir. Pérdida de respuesta verifica la misma intención antes de otro intento.

Desde NodiaAI, preparar es distinto de ejecutar: cambios requieren vista previa exacta y botón humano de41; el switch Web→Agentic no confirma. Conservar efectos completados si falla un paso dependiente y no reenviar un resultado desconocido. Payload del chat caduca según50 sin borrar registros de dominio ni sus journals nativos.

## Integración y evidencia

- [x] Fuentes de producto/backend, diferencias y mínimos revisados estáticamente en AI-05.
- [x] Correspondencia de handlers/candidatos y enlaces comprobada offline; no prueba de autorización/efectos.
- [ ] Schema de herramienta/proyección, autoridad y contexto registrados con AI-06/07 y familia pertinente.
- [ ] Casos de uso reales de acceso/ambigüedad, confirmación, concurrencia y recuperación verificados para NodiaAI.
- [ ] Adaptador/modalidades, publicación y aceptación operativa comprobados.

Pendientes con efecto sobre disponibilidad: AI-23: derivar proyección/schema y adaptar idempotencia/versionado sin secretos; no publicar sólo por existir DTO.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Contexto y propuestas |
|---|---|---|
| 1 | AI-05: explicación inicial a partir de contratos/código enlazados | Sin cambio de backend ni publicación. Al cambiar reglas/DTOs, actualizar ficha/schema/registro, invalidar propuestas incompatibles y mantener recuperación original |

## Historial de implementación local AI-15

`nodia_provider_contacts_list` tiene un puerto local con [schema cerrado](../../../../../nodia-server/src/nodia-ai-products/contracts/business.schema.json), sin publicación. Reutiliza validación de proveedor, búsqueda escapada y paginado del caso de uso nativo con manager heredado; añade selección interna de actividad, inicialmente activa. La respuesta contiene contacto, teléfonos, email, horario, descripción, actividad y versión, sin `creation_key/hash`. No crea ni actualiza contactos. La ruta HTTP mantiene su comportamiento previo cuando no recibe este criterio interno. Ver [AI-15](../../../../mvp/61-nodia-ai-ai15-product-reads.md).


## Lecturas disponibles en AI-15

Consultar contactos del proveedor identificado. No agregar números ni actualizar contactos mediante una lectura.

Herramientas de esta sección: `nodia_provider_contacts_list`.

Resolver entidades, destinatario, intervalo y filtros ambiguos antes de llamar. Usar sólo los campos del schema de la herramienta. Conservar IDs y dinero exactos, cero y falso; ausencia o unknown no equivalen a cero. La paginación y los límites de resultados deben comunicarse y una página no representa el universo completo. En recursos con actividad, iniciar Activo y usar Inactivo/Todos sólo cuando se soliciten; Todos omite el filtro.

Server valida sesión, módulo NodiaAI y todos los módulos destino actuales para usuarios ordinarios; super_admin conserva transversalidad y las reglas de dominio. Datos privados y autoridad se revalidan al devolver o recuperar resultados. Finanzas permite owner_id ajeno sólo a super_admin; Reservas conserva autoridad actual del alojamiento; administración IA conserva ai:manage. No construir SQL libre ni pedir tokens, cookies o secretos.

Esta publicación incluye lecturas y referencias privadas, no preparaciones ni ejecución de escrituras. Cualquier creación, edición, eliminación o confirmación conserva sus herramientas y etapas posteriores. No anunciar informes cruzados, un total por proveedor u otros filtros/agrupaciones si el schema o caso de uso no los soporta. Web permanece conversacional; MCP sólo se ejecuta mediante Agentic verificado, con delegación Web→Agentic opt-in de la misma conexión.

Las observaciones externas se ejecutan fuera de SQL, con deadline/cancelación y verificación posterior de autoridad y configuración. La recuperación de una llamada completada no repite red; una llamada interrumpida no se reintenta ciegamente. Los artefactos son referencias privadas current_on_download: la descarga humana reautoriza chat/recurso, rechaza exceso sin truncar y no conserva el archivo al expirar el chat; el original de factura pertenece al negocio.
