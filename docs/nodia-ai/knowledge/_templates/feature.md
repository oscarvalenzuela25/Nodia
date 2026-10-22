---
{
  "schema_version": 1,
  "document_id": "product-key.feature-key",
  "product_id": "product-key",
  "kind": "feature",
  "revision": 1,
  "document_status": "draft",
  "implementation": {
    "status": "planned",
    "notes": "PENDIENTE: contrastar el backend real; no confundir implementación e integración."
  },
  "integration_status": "unregistered",
  "maintainer": "PENDIENTE: responsable del producto",
  "sources": [
    {
      "path": "docs/mvp/README.md",
      "kind": "specification"
    }
  ],
  "verification": {
    "checked_on": null,
    "evidence_paths": [],
    "notes": "PENDIENTE: reemplazar fuente ilustrativa por especificación/contratos y registrar comprobación real."
  },
  "approval": null
}
---

# FEATURE_NAME — contexto funcional para NodiaAI

> Plantilla: copiar a `../PRODUCT_KEY/features/FEATURE_KEY.md`, completar y retirar esta línea. Las rutas son relativas a la ficha final; esta plantilla nunca se publica como contexto.

Metadatos canónicos sólo en frontmatter JSON. Reemplazar IDs/fuentes/responsable por valores reales; verification.checked_on permanece null hasta una comprobación real y approval null hasta aprobación explícita. Las plantillas no se publican.

## Qué resuelve y qué significa

PENDIENTE: propósito, conceptos, relaciones, límites y términos que usa una persona. Señalar lo confirmado, lo implementado y lo propuesto.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Datos faltantes/ambigüedad | Aclaración esperada |
|---|---|---|---|
| PENDIENTE: ejemplo sin datos privados | PENDIENTE | PENDIENTE | PENDIENTE |

Cubrir consulta y cambios aplicables, además de un caso que requiera aclaración y otro que deba rechazarse o remitirse al flujo seguro. No inventar entidades, resultados, identificadores ni capacidades.

## Operaciones y contratos

| Operación semántica | Clase/efecto | Herramienta y estado real | Endpoint/DTO/caso de uso | Resultado público |
|---|---|---|---|---|
| PENDIENTE | PENDIENTE: lectura, preparación, artefacto, análisis o flujo seguro | PENDIENTE: nombre sólo si registrado | PENDIENTE: enlaces comprobables o contrato por definir | PENDIENTE |

Los aliases HTTP no crean operaciones nuevas. Indicar efectos externos/coste si corresponde. El modelo prepara cambios; la confirmación y la ejecución pertenecen al coordinador autenticado. No incorporar SQL ni HTTP arbitrario.

## Datos mínimos y resolución de dudas

| Dato/concepto | Obligatorio, condicional u opcional | Significado y fuente contractual | Resolución/aclaración |
|---|---|---|---|
| PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |

Enlazar DTOs/esquemas, sin copiar todo el contrato. Explicar campos condicionales, fechas/zona horaria, moneda, referencias y valores derivados o administrados por Server. Preguntar lo mínimo requerido y las ambigüedades; no asumir pagado/pendiente, entidad o período sin una regla confirmada.

## Reglas, acceso y restricciones

PENDIENTE: módulos requeridos, autoridad del recurso, actor/destinatario, invariantes, estados válidos y datos públicos permitidos. Referenciar políticas comunes y fuentes de reglas específicas. Explicar eliminación frente a desactivación/cancelación/archivo cuando aplique. Credenciales y autenticación usan flujos seguros, no el chat.

## Filtros e informes

| Campo/medida | Predicados o agregaciones admitidos | Fecha/moneda/unidad/grano | Relaciones y procedencia | Fuente |
|---|---|---|---|---|
| PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |

Indicar límites y paginación según contratos reales. Distinguir importe registrado/pagado/facturado cuando exista esa diferencia. Para combinar productos, declarar compatibilidad y mantener procedencia separada; evitar doble conteo. Si no aplica, explicar por qué.

## Vista previa, confirmación y recuperación

PENDIENTE: contenido exacto de la vista previa, efectos y precondiciones, botón de confirmación, estrategia de idempotencia/conciliación y tratamiento de resultados inciertos. Referenciar contratos comunes y garantías nativas comprobadas. Si hay pasos dependientes, mostrar resultados parciales y conservar lo creado al fallar; recuperación sin duplicar. No declarar garantías todavía no implementadas.

## Integración y evidencia

- [ ] Fuentes de producto y contratos contrastados; estados y aprobación documentados.
- [ ] Herramientas/esquemas/proyecciones y contexto registrados, o tareas pendientes identificadas.
- [ ] Acceso, mínimos obligatorios, aclaraciones y rechazos comprobados.
- [ ] Informes/filtros y procedencia comprobados donde apliquen.
- [ ] Vista previa/confirmación, concurrencia y recuperación comprobadas donde apliquen.
- [ ] Adaptador/modo y publicación comprobados; evidencia enlazada sin secretos.

PENDIENTE: enlaces a pruebas/evidencia y pendientes con impacto en disponibilidad. Dejar sin marcar lo no comprobado. Si la integración es `not_applicable`, justificarlo sin fabricar herramientas.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Herramientas/contexto afectados | Compatibilidad/propuestas pendientes |
|---|---|---|---|
| 1 | PENDIENTE | PENDIENTE | PENDIENTE |

Registrar cambios de reglas o contratos, invalidación necesaria y retiro de capacidades. Enlazar esta ficha desde el README del producto y la especificación; actualizar el índice general si se crea un producto.
