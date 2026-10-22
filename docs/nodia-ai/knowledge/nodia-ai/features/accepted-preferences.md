---
{
  "schema_version": 1,
  "document_id": "nodia-ai.accepted-preferences",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 3,
  "document_status": "approved",
  "implementation": {
    "status": "partial",
    "notes": "AI36-C05 publica sólo el fragmento mínimo y los contratos enumerados de este lote bajo autorización humana específica. La evidencia interna C01/C04 no equivale a inferencia o aceptación productiva; otras funciones descritas históricamente conservan sus gates."
  },
  "integration_status": "published",
  "maintainer": "Mantenimiento NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/79-nodia-ai-ai33-accepted-preferences.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/41-nodia-ai-v1-contracts.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/50-nodia-ai-ai04-runtime-policy.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-preference/use-case/nodia-ai-preference-reader.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-common-reads/use-case/build-nodia-ai-common-read-tools.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-common-preparation/use-case/build-nodia-ai-common-preparation-tools.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-preference/use-case/build-nodia-ai-preference-operations.use-case.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-18",
    "evidence_paths": [
      "docs/evidence/nodia-ai-ai33-backend-validation.json",
      "docs/evidence/nodia-ai-ai33-runtime-validation.json",
      "docs/evidence/nodia-ai-ai33-sql-validation.json",
      "docs/evidence/nodia-ai-ai33-ui-validation.json",
      "docs/evidence/nodia-ai-ai33-validation.json",
      "docs/evidence/nodia-ai-ai33-activation.json",
      "docs/evidence/nodia-ai-ai33-ui-real-validation.json",
      "docs/evidence/nodia-ai-ai36-c04-validation.json",
      "docs/evidence/nodia-ai-ai36-c01-validation.json"
    ],
    "notes": "Contratos cerrados y adaptadores reales con integración SQL aislada C01/C04. C05 revisa publicación de este lote; las pruebas de proveedor y dependencias se registran separadamente, sin convertir fixtures o health200 en aceptación generativa. Los estados anteriores de los apartados históricos no sustituyen el frontmatter y el fragmento publicado actuales."
  },
  "approval": {
    "reference": "docs/evidence/nodia-ai-ai36-c05-publication-authorization.md",
    "revision": 3,
    "content_sha256": "13ad08d98fe37ad468b6c872d9e066c810cd09512bf52d7d2e721ff676637983"
  }
}
---

# Preferencias aceptadas

Estado actual AI36-C05: sólo se publica la sección «Preferencias propias publicadas en AI36-C05». Los apartados anteriores documentan etapas históricas; sus referencias a draft o publicación pendiente no revocan este fragmento ni habilitan otras capacidades.

[Producto](../README.md) · [Entrega AI-33](../../../../mvp/79-nodia-ai-ai33-accepted-preferences.md).

## Qué resuelve y conceptos

Una preferencia es una referencia de producto que el dueño aceptó recordar, independiente del chat donde nació. Nunca es una credencial, permiso o instrucción libre. No se aprende silenciosamente del historial y sólo se conserva tras confirmar una propuesta exacta.

## Solicitudes y aclaraciones

«Recuerda esta categoría para mis gastos» prepara el recuerdo y pide escoger una categoría concreta si hay dudas. «Prefiero este proveedor para este negocio» exige identificar ambos y validar su relación. «Olvida mi alojamiento habitual» prepara el borrado de la preferencia propia, sin borrar la casa ni reservas. «Recuerda mi API key» se rechaza como memoria y se remite al flujo seguro existente.

## Operaciones y mínimos

Catálogo inicial cerrado: categorías de gasto/ingreso en Finanzas, negocio favorito, proveedor dentro de un negocio y alojamiento favorito. Valores son IDs tipados con nombres resueltos por el backend; no JSON libre. Scope de proveedor contiene business_id. Crear/editar exige referencia activa y autorizada; editar/olvidar exige revisión actual. Propuesta, preview, desafío, botón exacto y recibo usan la coordinación común. Listar/catalogar/opciones y preparar por HTTP humano no publica herramientas MCP; nombres internos de preparadores e integración se detallan en la entrega.

## Autorización y conservación

Preferencias del dueño autenticado; inspeccionar chat ajeno no concede escritura sobre sus recuerdos. Tener NodiaAI y módulo de destino no sustituye autoridad nativa del recurso. Si se pierde acceso, la preferencia permanece revisable/olvidable por su dueño pero sus etiquetas no se resuelven y no entra al contexto. Origen de chat/paso SET NULL al purgar; el recuerdo permanece hasta borrado explícito. Olvidar no modifica datos de negocio ni reescribe mensajes históricos.

## Contexto y límites

Hasta50 preferencias por dueño como presupuesto propio de Nodia; paginado y opciones acotados. El worker incorpora referencias aceptadas vigentes como datos separados, con presupuesto total de contexto. Manifiesto con IDs/revisiones/hash, sin duplicar valores. Revalidación tras observación y al armar envío durable; preferencias cambiadas impiden el dispatch. Preguntar ante ambigüedad, preservar prioridad del mensaje y confirmación humana. No inferir pagado/pendiente ni rellenar contratos nativos silenciosamente. No hay agregados/informes de memoria ni búsqueda de chats que la incorpore.

## Integración y verificación

AI-33 implementado y verificado técnicamente; consultar evidencia y límites del entorno en la entrega. La propuesta automática desde Gemini conserva el gate de publicación de su herramienta; esta ficha draft no habilita capacidades. Contexto largo y compactación corresponden a AI-34; aceptación productiva e integral a AI-36..38.


## AI36-C04 — seis ayudantes comunes candidatos

[Entrega82](../../../../mvp/82-nodia-ai-ai36-integral-coverage.md#continuación-ai36-c04--seis-ayudantes-comunes) y [evidencia C04](../../../../evidence/nodia-ai-ai36-c04-validation.json) documentan los contratos/adaptadores explícitos de propuestas, operaciones, conjuntos, adjuntos y preferencias. Las lecturas de propuestas/operaciones/adjuntos quedan ligadas al chat del contexto backend; las preferencias pertenecen al actor, incluso para super_admin. El metadato de adjunto no entrega contenido, nombre de archivo, interpretación, URL o clave de almacenamiento. Las preparaciones sólo generan borrador/propuesta: el botón y canal humanos conservan confirmación, ejecución, reanudación/cancelación y aceptación de memoria. Sin cambios visuales ni impacto de layout/responsive/bundle cliente. Esta ficha permanece draft/unregistered; su actualización no publica herramientas.

## Preferencias propias publicadas en AI36-C05

`nodia_preferences_list` pagina exclusivamente las preferencias aceptadas del actor actual con su revisión, ámbito y disponibilidad reautorizada. Ni super_admin puede nominar otro dueño mediante esta herramienta. Una referencia no disponible no se usa como valor predeterminado. La ausencia de memoria no autoriza inferir una preferencia.

`nodia_preferences_prepare` propone crear, actualizar o borrar una preferencia propia mediante las cinco claves y ámbitos permitidos por el catálogo nativo. Pregunta si falta la clave, el valor o la referencia correcta; no inventes claves nuevas ni guardes información secreta. Para modificar una preferencia existente exige su identidad/revisión nativas; para continuar un borrador exige draft_id y expected_draft_revision. La propuesta no cambia la memoria aceptada. Sólo el botón humano sobre la propuesta exacta acepta el cambio. La memoria tiene un límite propio de50 preferencias y se conserva independientemente del chat hasta eliminarla. Una intención actual del usuario prevalece sobre una preferencia y nunca sustituye mínimos ni confirmación.

Este contrato sólo se ofrece cuando esté publicado, seleccionado en el intento y autorizado. La publicación no acredita disponibilidad ni inferencia real del proveedor.
