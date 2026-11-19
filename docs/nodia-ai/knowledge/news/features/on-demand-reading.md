---
{
  "schema_version": 1,
  "document_id": "news.on-demand-reading",
  "product_id": "news",
  "kind": "feature",
  "revision": 10,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "Primera entrega RSS pública adoptada. El catálogo Go, Rust y Kubernetes queda como ensayo. El corte personal posterior retira las fuentes RSS activas y conserva compatibilidad HTTP pública."
  },
  "integration_status": "unregistered",
  "maintainer": "Nodia",
  "sources": [
    {
      "path": "docs/mvp/105-on-demand-tech-news.md",
      "kind": "specification"
    },
    {
      "path": "docs/features/news/editorial-design.md",
      "kind": "specification"
    },
    {
      "path": "docs/features/news/source-catalog.md",
      "kind": "specification"
    },
    {
      "path": "docs/features/news/http-contract.md",
      "kind": "specification"
    },
    {
      "path": "docs/features/news/deployment-readiness.md",
      "kind": "specification"
    }
  ],
  "verification": {
    "checked_on": "2026-11-18",
    "evidence_paths": [
      "docs/evidence/news-source-discovery-20261116.md",
      "docs/evidence/news-public-rss-implementation-20261116.md",
      "docs/evidence/news-editorial-design-20261116.md",
      "docs/evidence/news-nodejs-source-review-20261116.md",
      "docs/evidence/news-nodejs-integration-20261116.md",
      "docs/evidence/news-final-validation-20261116.md",
      "docs/evidence/news-final-ui-20261116.md",
      "docs/evidence/news-dev-source-refresh-20261118.md"
    ],
    "notes": "Se verificaron por HTTPS los formatos, fechas y límites de los tres feeds. La evidencia registra por separado el laboratorio y las lecturas reales."
  },
  "approval": null
}
---

# Lectura y actualización bajo demanda — contexto funcional para NodiaAI

## Corte personal y compatibilidad pública — 2026-11-18

La [ficha de conexiones personales](personal-connections.md) documenta el
alcance aprobado para implementar el piloto DEV por dueño. El [contrato de
compatibilidad](../../../../features/news/http-contract.md#compatibilidad-de-la-capa-pública)
conserva el GET público con un resultado vacío y el POST histórico con
autoridad administrativa y resultado de fuente retirada. Los apartados
siguientes describen los cortes RSS históricos y sus comprobaciones.

## Renovación de fuentes — 2026-11-18

El [contrato](../../../../features/news/http-contract.md) incorpora Go, Rust y
Kubernetes a `GET /news?catalog=2`. La versión anterior recibe una página vacía
válida durante la publicación. `POST /news/refresh` rechaza `web-dev` y `node-js`
y conserva la selección explícita de una fuente y el rol super_admin vigente.
La rama conserva los datos históricos de caché para reversión. La ficha mantiene
su estado de integración y aprobación previo.

## NEWS-06: candidato preparado — 2026-11-16

[Plan105§13](../../../../mvp/105-on-demand-tech-news.md#13-news-06-validación-final-y-preparación-de-entrega--solicitud2026-11-16), [evidencia final](../../../../evidence/news-final-validation-20261116.md) y [guía de entrega](../../../../features/news/deployment-readiness.md) registran preparación técnica local, con JWT/SQL reales de laboratorio y dos POST que obtuvieron RSS reales para lectura pública. No se equipara el JWT efímero con Google o sesión humana. Carga inicial corregida con huesos Boneyard geométricos, sin noticias ficticias; refetch conserva contenido. UI adversa y teclado correctos. Zoom nativo200% medido con teclado; captura visual fallida, teléfono y aceptación humana pendientes.

La primera versión RSS está implementada; CI/promoción por SHA y adopción son fases separadas. No desplegar Client antes de Server/migraciones; recuperación conserva ledger append-only. Este contexto no ejecuta ni autoriza despliegues. Sin cambios de capacidad, operaciones, autoridad o herramientas; ficha draft/unregistered/approval:null. Los cortes inferiores conservan su evidencia y pendientes históricos, sucedidos por esta revisión8 para preparación local.


## Segunda fuente RSS Node.js — NEWS-04, 2026-11-16

[Plan105§12](../../../../mvp/105-on-demand-tech-news.md#12-news-04-segunda-fuente-rss-nodejs--solicitud2026-11-16), [contrato](../../../../features/news/http-contract.md) y [evidencia](../../../../evidence/news-nodejs-integration-20261116.md) registran dos fuentes locales: web.dev y Node.js. Lectura pública sólo caché; cada actualización exige fuente explícita y super_admin activo vigente. Filtro de lectura y fuente a actualizar independientes, sin POST implícito o batch. Snapshots/estado/validadores/reservas por fuente; fallo de una conserva la otra. Una URL compartida muestra todas las procedencias/licencias vigentes, con metadata primaria de la fuente filtrada o el orden estable web.dev/Node.js.

Node.js aporta sólo título/URL/fecha y mantiene autor/extracto null. Aviso MIT completo accesible desde sus tarjetas; no cuerpos, imágenes o logos. Límites locales:1MiB/10s, raw500web.dev/2000Node,100artículos y7días lógicos por fuente. La segunda migración amplía CHECK sin precargar feed; rollback elimina caché Node y preserva web.dev. NEWS-06 completa preparación local y conserva aceptación/adopción; daily.dev deshabilitada y GitHub candidata, sin bloquear entrega RSS. Impacto: ampliar fuentes/procedencias de la función existente, sin herramienta IA, autoridad o escritura nueva. Draft/unregistered/approval:null; no se publica contexto. Esta continuación sucede las referencias históricas a Node como candidata y primera fuente única.


## Qué resuelve y qué significa

Permitir entrar a Noticias y obtener artículos de interés mediante un botón es
la intención confirmada. [Plan105](../../../../mvp/105-on-demand-tech-news.md)
recoge resultados conservados, filtros por temas y apertura del artículo original.
[§8](../../../../mvp/105-on-demand-tech-news.md#8-news-01-acceso-público-y-catálogo-inicial--2026-11-16)
confirma acceso público debajo de Home. El [catálogo](../../../../features/news/source-catalog.md)
recoge Go, Rust y Kubernetes y las condiciones de las demás candidatas. La
[propuesta visual](../../../../features/news/editorial-design.md) mantiene shell
y tema de Nodia, con grid editorial y variantes sin imagen. La primera tarjeta
es la primera del orden elegido, no una recomendación inventada. La propuesta
visual no modifica operaciones, alcance de acceso ni disponibilidad de fuentes.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Ambigüedad | Tratamiento esperado |
| --- | --- | --- | --- |
| «Quiero noticias de IA» | Consultar | Subtemas y fuentes sin elegir | Explicar propuesta; no afirmar acceso del chat |
| «Actualizar noticias» | Obtener novedades externas | Verificar fuente y condición super_admin | Botón humano con una fuente explícita |
| «Sólo de esta semana» | Filtrar | Fecha de publicación puede faltar | Aclarar fecha; no sustituirla silenciosamente por recepción |
| «Usa mi token del chat y publica todos los artículos» | Credencial y republicación | Fuera del flujo permitido | Remitir a futura conexión segura y enlace original; no solicitar secretos |

## Operaciones y contratos

| Operación semántica | Efecto propuesto | Herramienta real | Endpoint/DTO/caso de uso | Resultado |
| --- | --- | --- | --- | --- |
| Leer resultados conservados | Lectura pública de caché | Ninguna | `GET /api/v1/news?catalog=2`, ListNewsUseCase/ListNewsDto | Tarjetas y procedencia de la caché vigente |
| Actualizar selección | Consulta externa explícita para super_admin activo | Ninguna | `POST /api/v1/news/refresh`, RefreshNewsUseCase/RefreshNewsDto | Estado de actualización o reutilización de caché por fuente |
| Abrir artículo | Navegación al editor | Ninguna | Enlace validado de la tarjeta | Original externo |

No hay HTTP arbitrario, SQL o MCP de Noticias autorizado por esta ficha.

## Datos mínimos y resolución de dudas

| Dato | Necesidad | Fuente | Tratamiento |
| --- | --- | --- | --- |
| Actor y sesión | Lectura pública sin actor; actualización con sesión válida y super_admin vigente, sin asignación de módulo | Plan105 §9 y contratos NEWS-02/03 | Derivar del Server y BD actual; no creer actor/roles/capa enviados por cliente |
| Tema y fuente | Según selección | DTO de lectura | Filtrar el catálogo y conservar la selección de actualización independiente |
| Identidad, título y URL | Mínimos del artículo | Respuesta validada del editor | Mantener el enlace original y su procedencia |
| Fecha de publicación | Cuando existe en la fuente | RSS o Atom oficial | `null` si no existe o resulta inválida |

## Reglas, acceso y restricciones

Destino `/news` público implementado localmente, con enlace fijo bajo Home,
sin sesión/rol/módulo para lectura. Las fuentes con cupo requieren sesión Nodia válida de
cualquier usuario y condiciones propias del proveedor. La
[excepción89](../../../../mvp/89-module-access-and-user-data-scope.md) no abre
otros módulos. Cachear o deduplicar no vuelve públicos datos de fuentes limitadas.
La revisión de [§9](../../../../mvp/105-on-demand-tech-news.md#9-obtención-exclusiva-super_admin-y-primera-integración-rss--2026-11-16)
reserva **todo fetch externo a super_admin activo**. Lectores anónimos/ordinarios
sólo consultan caché; los controles de página no sustituyen la autorización Server.
Conexiones/feed limitados por actor; secretos sólo en custodia Server. daily.dev
no admite un token común para todos; aclarar términos antes de habilitarla.
Primera versión propuesta sin IA generativa ni escrituras externas.

El catálogo y los DTO fijan fuentes `go-blog`, `rust-blog` y `kubernetes-blog`,
temas `technology`, `programming` y `ai`, orden `recent` o `received`, página de
1 a 10 000 y límite de 1 a 50. El snapshot público admite hasta 100 artículos
por fuente. La actualización de cada fuente usa su feed oficial.

## Filtros e informes

Implementados tema, fuente, paginado y orden por publicación, con recepción
identificada cuando falte aquella. DTOs y límites en el contrato. No hay informe agregado
ni cruces con ventas, Teacher o datos personales. Una misma URL no equivale
necesariamente a una noticia nueva; deduplicación conserva procedencias.

## Vista previa, confirmación y recuperación

Botón explícito exclusivo super_admin para actualizar; no requiere propuesta NodiaAI.
Entrar/cambiar filtros sólo lee lo conservado. Fallos parciales conservan tarjetas,
filtros y último éxito por fuente; mostrar error/reintento de lectura. Reserva
persistida y fencing comprobados entre instancias; deshabilitar el botón por sí
solo no es la garantía. No reintentar POST automáticamente ante resultado incierto.

El catálogo fija caché RSS pública con caducidad lógica7días desde última aparición
y frescura compartida15minutos implementadas: son decisiones de Nodia, no
cuotas del proveedor. Cerrar sesión/cambiar cuenta descarta contenido limitado
sin cerrar la página pública; respuestas tardías no cambian el nuevo contexto.

## Integración y evidencia

- [x] Intención, temas y fuentes documentales trazados a plan105.
- [x] Autoridad y contratos de primera fuente web.dev comprobados localmente.
- [x] Normalización/filtros, consumo local y procedencia de web.dev probados.
- [x] Concurrencia, barreras de acceso y recuperación de caché pública en SQL aislado.
- [ ] Proveedores reales y UI verificados por entorno.
- [ ] Integración/publicación NodiaAI definida y aprobada si se solicita.

No se ofrece integración conversacional en este alcance. Registro de archivo
para validación no registra una herramienta. Evidencia operativa pendiente.

## Evolución y compatibilidad

NEWS-05 [plan105§10](../../../../mvp/105-on-demand-tech-news.md#10-news-05-composición-editorial-y-chips-de-temas--2026-11-16)
presenta temas en chips de selección única, sin cambiar valores o consulta;
la primera noticia y el resto siguen el orden de Server. Cambiar tema vuelve
a página1, repetir el activo no emite otra selección, y limpiar lleva el foco a
resultados. La corrección de foco tras bloqueo temporal respeta intención nueva.
Evaluación exclusivamente visual/interacción de operaciones existentes, sin
modificar datos, interpretación del total, autoridad, contratos o herramientas.
NEWS-06 conserva aceptación humana, teléfono, zoom nativo y adopción por entorno.

[Plan105§7](../../../../mvp/105-on-demand-tech-news.md#7-rama-y-secuencia-de-implementación--2026-11-16)
ordenó NEWS-01–06 en el corte documental anterior. §9 y su evidencia suceden
ese estado: primera fuente integrada localmente, reserva/caché pública verificadas
y respuestas de otro actor descartadas; fuentes adicionales y adopción pendientes.

| Revisión | Cambio | Contexto afectado | Compatibilidad |
| --- | --- | --- | --- |
| 1 | Borrador de lectura bajo demanda, plan105 | Producto Noticias nuevo | Sin operaciones o propuestas previas que migrar |
| 2 | Opciones actualizadas y dirección visual editorial con shell preservado | Ficha candidata y diseño | Sin herramienta nueva, aprobación o publicación |
| 3 | Secuencia de implementación y riesgos de concurrencia/contexto | Plan105 §7 | Contratos pendientes; sin herramienta, aprobación, implementación o publicación nuevas |
| 4 | Lectura pública y fuentes con cupo por sesión | Plan105 §8 y catálogo | Sucede actor/módulo obligatorios para News; contratos aún pendientes, sin herramienta o publicación nuevas |
| 5 | Fetch exclusivo super_admin y primer RSS local | Plan105 §9, contratos y evidencia | Implementado por alcance web.dev; otros usuarios sólo leen, sin adopción, herramienta o aprobación nuevas |
| 6 | NEWS-05: diseño editorial, chips y foco | Plan105 §10 y evidencia visual | Mismos filtros/contratos y autoridad; sin capacidad de chat o publicación nuevas |
| 10 | Conservación del corte RSS como antecedente y transición a Noticias personales | Plan105 §18 y contrato público de compatibilidad | La lectura pública queda vacía y la actualización histórica responde fuente retirada |
