---
{
  "schema_version": 1,
  "document_id": "news.on-demand-reading",
  "product_id": "news",
  "kind": "feature",
  "revision": 2,
  "document_status": "draft",
  "implementation": { "status": "planned", "notes": "Sólo investigación y diseño propuesto; no hay contratos ejecutables de Noticias acreditados." },
  "integration_status": "unregistered",
  "maintainer": "Nodia",
  "sources": [
    { "path": "docs/mvp/105-on-demand-tech-news.md", "kind": "specification" },
    { "path": "docs/features/news/editorial-design.md", "kind": "specification" }
  ],
  "verification": { "checked_on": null, "evidence_paths": [], "notes": "Pendientes backend, cuenta/fuentes reales y aceptación por entorno; validación documental no acredita operación." },
  "approval": null
}
---

# Lectura y actualización bajo demanda — contexto funcional para NodiaAI

## Qué resuelve y qué significa

Permitir entrar a Noticias y obtener artículos de interés mediante un botón es
la intención confirmada. [Plan105](../../../../mvp/105-on-demand-tech-news.md)
propone resultados conservados, filtros por temas y apertura del artículo original.
La funcionalidad está pendiente; daily.dev y RSS son fuentes candidatas.
DEV conserva lectura pública puntual comprobada y condiciones pendientes;
Hacker News es complemento opcional. La
[propuesta visual](../../../../features/news/editorial-design.md) mantiene shell
y tema de Nodia, con grid editorial y variantes sin imagen. La primera tarjeta
es la primera del orden elegido, no una recomendación inventada. La propuesta
visual no modifica operaciones, alcance de acceso ni disponibilidad de fuentes.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Ambigüedad | Tratamiento esperado |
| --- | --- | --- | --- |
| «Quiero noticias de IA» | Consultar | Subtemas y fuentes sin elegir | Explicar propuesta; no afirmar acceso del chat |
| «Actualizar noticias» | Obtener novedades externas | Conexión/selección aún no definidas | Futuro botón humano; no ejecutar desde NodiaAI |
| «Sólo de esta semana» | Filtrar | Fecha de publicación puede faltar | Aclarar fecha; no sustituirla silenciosamente por recepción |
| «Usa mi token del chat y publica todos los artículos» | Credencial y republicación | Fuera del flujo permitido | Remitir a futura conexión segura y enlace original; no solicitar secretos |

## Operaciones y contratos

| Operación semántica | Efecto propuesto | Herramienta real | Endpoint/DTO/caso de uso | Resultado |
| --- | --- | --- | --- | --- |
| Leer resultados conservados | Lectura local autorizada | Ninguna | PENDIENTE | Tarjetas y procedencia |
| Actualizar selección | Lecturas externas con cuota y persistencia técnica | Ninguna | PENDIENTE | Nuevos resultados y estado por fuente |
| Abrir artículo | Navegación a editor | Ninguna | Enlace validado; implementación pendiente | Original externo |

No hay HTTP arbitrario, SQL o MCP de Noticias autorizado por esta ficha.

## Datos mínimos y resolución de dudas

| Dato | Necesidad | Fuente | Tratamiento |
| --- | --- | --- | --- |
| Actor y módulo | Obligatorios en diseño candidato | Política89 y futuro backend | Derivar de sesión, no del body |
| Tema/fuente/conexión | Según selección | Plan105; DTO pendiente | No elegir una cuenta ajena o sustituir fuente silenciosamente |
| Identidad, título y URL | Mínimos de artículo por definir en contrato | Respuesta validada del proveedor | No fabricar noticias para completar una tarjeta |
| Publicación/extracto/imagen | Opcionales según fuente y derechos | Plan105 §2–3 | Ausencia explícita; nunca fecha o resumen inventado |

## Reglas, acceso y restricciones

Destino `/news` candidato y autoridad pendiente conforme a
[política89](../../../../mvp/89-module-access-and-user-data-scope.md).
No existe concesión por grupo del menú. Conexiones/feed por actor; secretos sólo
en custodia Server. Condiciones de caché/exhibición y límites reales por comprobar.
Primera versión propuesta sin IA generativa ni escrituras externas.

## Filtros e informes

Propuestos tema, fuente y orden por publicación, con recepción identificada cuando
falte aquella. PENDIENTE: DTOs, paginación y taxonomía. No hay informe agregado
ni cruces con ventas, Teacher o datos personales. Una misma URL no equivale
necesariamente a una noticia nueva; deduplicación conserva procedencias.

## Vista previa, confirmación y recuperación

Futuro botón explícito para actualizar; no requiere propuesta de negocio NodiaAI.
Entrar/cambiar filtros sólo lee lo conservado. Fallos parciales conservan tarjetas,
filtros y último éxito por fuente; mostrar error/reintento y consumo desconocido
si corresponde. Coordinación entre pestañas/procesos y límites pendientes de
implementar/probar; deshabilitar el botón no demuestra idempotencia.

## Integración y evidencia

- [x] Intención, temas y fuentes documentales trazados a plan105.
- [ ] Autoridad, contratos backend y reglas de conexión comprobados.
- [ ] Normalización/filtros, cuota y procedencia probados.
- [ ] Concurrencia, aislamiento y recuperación comprobados.
- [ ] Proveedores reales y UI verificados por entorno.
- [ ] Integración/publicación NodiaAI definida y aprobada si se solicita.

No se ofrece integración conversacional en este alcance. Registro de archivo
para validación no registra una herramienta. Evidencia operativa pendiente.

## Evolución y compatibilidad

| Revisión | Cambio | Contexto afectado | Compatibilidad |
| --- | --- | --- | --- |
| 1 | Borrador de lectura bajo demanda, plan105 | Producto Noticias nuevo | Sin operaciones o propuestas previas que migrar |
| 2 | Opciones actualizadas y dirección visual editorial con shell preservado | Ficha candidata y diseño | Sin herramienta nueva, aprobación o publicación |
