# Noticias — contratos de lectura y actualización RSS

> NEWS-02/03,2026-11-16. Primera fuente implementada/verificada localmente en
> `codex/news-implementation`, con [evidencia por alcance](../../evidence/news-public-rss-implementation-20261116.md).
> Fuente funcional: [plan105§9](../../mvp/105-on-demand-tech-news.md#9-obtención-exclusiva-super_admin-y-primera-integración-rss--2026-11-16).
> No acredita adopción de entorno ni aprueba el ADR105.
> NEWS-04 amplía el catálogo con `node-js` por [plan105](../../mvp/105-on-demand-tech-news.md),
> conservando lectura pública y una fuente explícita por POST super_admin.

## Operaciones

| Método / ruta bajo `/api/v1` | Autoridad | Efecto |
| --- | --- | --- |
| `GET /news` | Pública, sin sesión/módulo | Lee sólo caché de fuentes públicas habilitadas; nunca consulta al editor |
| `POST /news/refresh` | Sesión válida y `super_admin` activo en BD actual | Obtiene la fuente explícita si no hay reserva/enfriamiento; ninguna otra sesión puede consumirla |

No existe operación pública de actualización, endpoint genérico de HTTP ni
disparo desde filtros, navegación o NodiaAI. El POST no se anota `Public` y su
política exacta no requiere un módulo News. La comprobación real del rol ocurre
antes de reservar consumo y vuelve a validarse antes de publicar el resultado.
IDs/roles del body, caché de navegación y JWT no sustituyen esa autoridad.

## Lectura pública

Query permitida: `topic=technology|programming|ai`, `source_key=web-dev|node-js`,
`order=recent|received` (predeterminado `recent`), `page` entero≥1 y `limit`
entero1–50 (predeterminado20); página máxima10000. Omitir tema/fuente significa todos los habilitados,
no consultar otras fuentes externas. Rechazar parámetros desconocidos/estructuras
inválidas. Filtros y paginado se aplican a metadatos conservados vigentes.

Respuesta: `{ items, sources, pagination: { page, limit, total, total_pages } }`.

| Objeto | Campos públicos |
| --- | --- |
| Artículo | `id`, `source_key`, `source_name`, `title`, `url`, `excerpt`, `author`, `topic`, `published_at`, `received_at`, `license_url`, `provenances` |
| Estado de fuente | `key`, `name`, `home_url`, `license_url`, `last_attempt_at`, `last_success_at`, `next_refresh_at`, `last_error_code` |

Fuentes `web-dev` y `node-js`, tema de catálogo `programming`. `excerpt`, `author`
y publicación admiten `null`. Instantes válidos en ISO8601; nunca sustituir
publicación ausente por recepción sin indicarlo. Metadatos de estado desconocidos
también son `null`. Errores de fuente son códigos públicos estables, sin XML,
contenido remoto, credenciales o mensajes internos. No se exponen fuentes
deshabilitadas ni metadatos privados por deduplicar enlaces.

`provenances` es una lista no vacía de `{source_key, source_name, license_url}`
por URL, sin repetir fuentes. Una misma URL en ambos snapshots produce una
tarjeta, conservando ambas procedencias y licencias. Los campos primarios
`source_*`/licencia y contenido proceden de web.dev primero y Node.js después
según orden estable del catálogo; con filtro de fuente, la primaria es la
seleccionada. No copiar extracto/autor de web.dev a una tarjeta primaria Node.js.
La paginación y total se calculan después de agrupar URLs. La procedencia sólo
incluye entradas vigentes; no recupera metadata privada ni vencida.

Node.js habilita sólo título/URL/fecha del RSS; `excerpt` y `author` son `null`.
No se consultan cuerpos o medios. La UI conserva aviso MIT completo en
`/legal/news-nodejs-notice.txt`, además de enlace a licencia original y marca.

## Actualización administrativa

Body exacto: `{ "source_key": "web-dev" }` o `{ "source_key": "node-js" }`. Respuesta:
`{ source_key, status, received_count, stored_count, last_attempt_at,
last_success_at, next_refresh_at }`, con estado `updated`, `not_modified` o `cached`.
`cached` informa reutilización, no un nuevo éxito upstream. Rechazo o fallo no
borra el snapshot previo ni cambia la última consulta correcta.

Cualquier anónimo recibe401; usuario ordinario403, sin petición externa. La UI
ofrece el botón sólo tras contexto vigente del actor con `super_admin`; ocultarlo
es una ayuda visual, no la barrera de autorización. Cambio de cuenta, logout o
renovación no aplican respuestas tardías al contexto anterior. No reintentar el
POST automáticamente ante un resultado incierto.

La selección administrativa de fuente a actualizar es independiente del filtro
de lectura. Comienza sin fuente; seleccionar no ejecuta el POST. Cada clic
autorizado afecta exactamente una fuente y su propio estado. No existe «todas»
para actualizar ni fallback a otra fuente. Validar también que la respuesta
corresponde a la fuente solicitada; cambiar actor/fuente descarta feedback tardío.

## Persistencia, recursos y recuperación

Snapshot JSONB de metadatos normalizados, máximo100 artículos por fuente, con
estado/reserva persistidos en una fila. Es caché pública acotada, no archivo de
artículos ni esquema de conexiones de proveedores. Conservación7días desde última
aparición; excluir vencidos también en lectura, no depender sólo de una purga.
La poda física ocurre al reservar/finalizar actualización; sin nuevos intentos
pueden conservarse metadatos vencidos no visibles dentro del snapshot acotado.
No se incorpora un janitor temporal ni se promete borrado físico al séptimo día.

Enfriamiento compartido por fuente15minutos desde cada intento reservado; fallo no autoriza
replay inmediato. Exclusión entre procesos y token de reserva impiden publicar
resultados de una reserva obsoleta. Reserva/finalización transaccionales; descarga
fuera de transacción. Validadores HTTP/304 conservan semántica de recepción y
`Retry-After` puede ampliar el próximo intento permitido.

Destino fijo administrado, resolución DNS y TLS comprobadas, límites antes del
parsing de bytes/tiempo/entradas, XML sin DTD/entidades externas, texto normalizado
sin HTML ejecutable y enlaces HTTP(S) seguros. No seguir redirecciones arbitrarias
ni habilitar otros RSS/credenciales desde el body. Los límites efectivos de
transporte son10s de deadline total y1MiB antes del parsing;
se conservan como máximo100artículos por fuente. Límite de entradas XML:
500 para web.dev y2000 para Node.js, cuyo feed incluye historia completa; son
protecciones locales, no cuotas del editor. El límite de1MiB/deadline10s se
mantiene para ambas. Migración inicial `PublicNewsCache1793670000000` conservada;
`NewsNodeSource1793670001000` amplía su CHECK de fuentes admitidas, sin precargar
artículos. El rollback elimina sólo la caché Node y restaura el CHECK web.dev.
Ensayar ambas migraciones y conservación de web.dev en PostgreSQL descartable;
adopción/rollback de entorno siguen el procedimiento de plan99.

## Exclusiones y verificación

daily.dev permanece deshabilitada; ser super_admin no elimina sus condiciones
de redistribución o producto competidor. Node.js se incorpora sólo por el alcance
de metadata/avisos verificado; GitHub sigue candidata del
[catálogo](source-catalog.md). No hay ingestión programada, imágenes, inferencia
IA, propuestas/herramientas de chat o despliegue en esta entrega local.

Verificar DTOs/normalización/retención, HTTP público vs POST protegido, roles
actuales/revocación, concurrencia entre instancias y recuperación en PostgreSQL
aislado. QA UI separa fixtures sintéticas, lectura RSS real y sesión auténtica.
