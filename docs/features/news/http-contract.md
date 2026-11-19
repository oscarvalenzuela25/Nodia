# Noticias — contratos de conexiones y lectura

## Corte de Noticias personales

Alcance de implementación aprobado en [Plan105 §18](../../mvp/105-on-demand-tech-news.md#18-plan-de-noticias-personales).
La [decisión de autoridad y almacenamiento](../../architecture/decisions/ADR-110-personal-news-connection-ownership.md)
queda en revisión documental. Las verificaciones autenticadas reales y la
adopción se registran por separado.

### Compatibilidad de la capa pública

| Método / ruta bajo `/api/v1` | Comportamiento de transición |
| --- | --- |
| `GET /news` | Acceso público. Query sin catálogo o con `catalog=2` y filtros históricos admitidos. Devuelve `{ items: [], sources: [], pagination: { page, limit, total: 0, total_pages: 0 } }` con el paginado válido solicitado |
| `POST /news/refresh` | Conserva el DTO y la autoridad administrativa. Sin sesión devuelve 401. Una sesión ordinaria con una fuente válida devuelve 403. `super_admin` activo recibe 410 para una fuente retirada. Un DTO inválido o una clave desconocida devuelve 400 para una sesión autenticada |

Los dos handlers de compatibilidad omiten toda lectura de contenidos en base
de datos y toda consulta externa. El POST conserva la validación de identidad y
rol vigente. Los clientes anteriores pueden seguir mostrando el vacío público
sin acceder a credenciales, contenido o procedencias de una cuenta.

El GET admite `source_key` con `web-dev`, `node-js`, `go-blog`, `rust-blog` y
`kubernetes-blog`, `topic=technology|programming|ai`, `order=recent|received`,
`page` entre 1 y 10 000 y `limit` entre 1 y 50. Por defecto usa página 1 y límite
20. El POST admite `{ source_key }` con el mismo conjunto de claves retiradas.

### Operaciones personales

Se aplican sesión válida y propiedad por actor en handlers exactos. Los
identificadores de proveedor son `dev-community` y `daily-dev`. DEV se habilita
para el piloto local al configurar `NEWS_PERSONAL_ENCRYPTION_KEY` de 32 bytes
en 64 caracteres hexadecimales en Server. Con la llave ausente o inválida, el
circuito de credenciales queda inhabilitado. daily.dev añade una condición de
entorno de desarrollo y dueño explícito para su piloto local.

Las rutas, el ciclo de credenciales y la recuperación se definen en
[Plan105 §18.3](../../mvp/105-on-demand-tech-news.md#183-contrato-y-almacenamiento-candidatos).
Las lecturas privadas usan estado local. Cada acción que consume un proveedor
requiere una intención explícita y una conexión propia. Las respuestas privadas
se entregan con `Cache-Control: private, no-store`.

El listado de conexiones devuelve `state`, `account_name`, una máscara fija
de clave y metadatos de pruebas, actualización y reintento. Los estados son
`disconnected`, `connected`, `reconnect_required` y `pending`. La lista privada
de artículos admite `provider` opcional y devuelve sólo metadatos vigentes del
dueño. La actualización distingue `updated`, `empty`, `no_followed_tags` y
`cached`. Desconectar devuelve 204 al completar la operación.

Cada artículo puede incluir `cover_image_url` si Forem entrega una portada
HTTPS válida desde `media2.dev.to`. Los resultados anteriores siguen siendo
válidos con el campo ausente. Se guarda únicamente la URL en el JSONB existente.
Client muestra la portada sin referer y ofrece una tarjeta con icono cuando
la URL falta o la imagen falla. La actualización explícita incorpora la
portada a los resultados nuevos.

`tags` es una lista opcional de etiquetas normalizadas de Forem. Se conserva
en el mismo JSONB al actualizar. Los artículos guardados antes de incorporar
este campo siguen visibles en la lectura completa. Client aplica el filtro
de tema sobre los resultados cargados, además del filtro de fuente.

### Límites del piloto DEV

El [adaptador DEV](../../../nodia-server/src/news/personal/dev-community-news.client.ts)
verifica identidad con `/api/users/me`. Para actualizar, usa `/api/follows/tags`
para seleccionar hasta cuatro etiquetas y solicita una página de hasta 24
artículos a `/api/articles` con `tags`. El PAT acompaña las consultas de cuenta.
La consulta de artículos públicos usa el destino definido por el adaptador y
omite el PAT. El límite por respuesta es 1 MiB y el plazo total por operación
es de 10 s.

El snapshot tiene una vigencia lógica de 24 horas. El intervalo local tras una
actualización correcta es de 15 minutos. Un 429 respeta el `Retry-After` válido
y usa un enfriamiento local de 60 segundos si falta un dato válido. Estos
valores son límites de Nodia, con evidencia real de cuota separada.

### Límites del piloto local daily.dev

`daily-dev` usa los mismos handlers privados por dueño. Server exige para
leer, conectar, probar o actualizar `NODE_ENV=development`, una llave de
cifrado válida y que el actor coincida con `NEWS_DAILY_DEV_LOCAL_OWNER_ID`.
Fuera de ese alcance, la fuente queda pendiente y el adaptador permanece
inactivo. Desconectar limpia la conexión propia del dueño local configurado,+incluso si falta la llave, y devuelve 204 sin efecto para otros actores.

- Alta y prueba verifican la credencial con un `GET /public/v1/profile/`.
  La actualización explícita usa sólo `GET /public/v1/feeds/foryou?limit=10`,
  sin continuar el cursor. Ambos destinos son fijos y llevan Bearer. La lectura
  local no emite peticiones al proveedor. El plazo por petición es 10 s y el
  máximo por respuesta exitosa 512 KiB. [OpenAPI](https://api.daily.dev/public/v1/docs/json),
  [CLI](https://docs.daily.dev/daily-dev-from-your-terminal/).
- `GET /news/personal/articles` sirve daily.dev sólo con `provider=daily-dev` y
  la sesión habilitada. Para las demás sesiones ese filtro devuelve `items: []`.
  La consulta sin filtro lee DEV. La vista por fuente atribuye los resultados
  a daily.dev y enlaza a la publicación original.
- El snapshot de hasta diez entradas conserva título, URL HTTPS de la
  publicación, fecha si existe y etiquetas disponibles. Su vigencia lógica
  máxima es de 60 minutos. Client ofrece filtros de tema locales para daily.dev
  cuando hay etiquetas. Los resultados quedan fuera de cachés compartidas y
  las acciones de otro proveedor carecen de efecto sobre esa conexión.

Consultar el [alcance aprobado](../../mvp/105-on-demand-tech-news.md#188-piloto-personal-local-de-dailydev).

## Contrato histórico del ensayo RSS

Los apartados siguientes conservan el contrato de laboratorio anterior para
interpretar su evidencia. Para usar el contrato del siguiente corte, consultar
[Noticias personales](#corte-de-noticias-personales).

> NEWS-02/03,2026-11-16. Primera fuente implementada/verificada localmente en
> `codex/news-implementation`, con [evidencia por alcance](../../evidence/news-public-rss-implementation-20261116.md).
> Fuente funcional: [plan105§9](../../mvp/105-on-demand-tech-news.md#9-obtención-exclusiva-super_admin-y-primera-integración-rss--2026-11-16).
> No acredita adopción de entorno ni aprueba el ADR105.
> NEWS-04 amplía el catálogo con `node-js` por [plan105](../../mvp/105-on-demand-tech-news.md),
> conservando lectura pública y una fuente explícita por POST super_admin.
> La [revisión del catálogo](../../mvp/105-on-demand-tech-news.md#16-renovación-del-catálogo-de-noticias-dev--2026-11-18)
> sustituía esas dos fuentes durante el ensayo. El contrato de ese ensayo se
> conserva abajo.

### Operaciones

| Método / ruta bajo `/api/v1` | Autoridad | Efecto |
| --- | --- | --- |
| `GET /news` | Pública, sin sesión/módulo | Lee sólo caché de fuentes públicas habilitadas; nunca consulta al editor |
| `POST /news/refresh` | Sesión válida y `super_admin` activo en BD actual | Obtiene la fuente explícita si no hay reserva/enfriamiento; ninguna otra sesión puede consumirla |

No existe operación pública de actualización, endpoint genérico de HTTP ni
disparo desde filtros, navegación o NodiaAI. El POST no se anota `Public` y su
política exacta no requiere un módulo News. La comprobación real del rol ocurre
antes de reservar consumo y vuelve a validarse antes de publicar el resultado.
IDs/roles del body, caché de navegación y JWT no sustituyen esa autoridad.

### Lectura pública

Query permitida: `catalog=2`, `topic=technology|programming|ai`,
`source_key=go-blog|rust-blog|kubernetes-blog`,
`order=recent|received` (predeterminado `recent`), `page` entero≥1 y `limit`
entero1–50 (predeterminado20); página máxima10000. Omitir tema/fuente significa todos los habilitados,
no consultar otras fuentes externas. Rechazar parámetros desconocidos/estructuras
inválidas. Filtros y paginado se aplican a metadatos conservados vigentes.

Client solicita `catalog=2`. Una lectura sin catálogo ni `source_key` devuelve
`items: []`, `sources: []` y total cero, respetando página y límite. Así una
pestaña con Client anterior puede leer el estado vacío mientras se publica el
nuevo Client. Un filtro de fuente requiere `catalog=2`. `web-dev` y `node-js`
se rechazan en el filtro y en la actualización.

Respuesta: `{ items, sources, pagination: { page, limit, total, total_pages } }`.

| Objeto | Campos públicos |
| --- | --- |
| Artículo | `id`, `source_key`, `source_name`, `title`, `url`, `excerpt`, `author`, `topic`, `published_at`, `received_at`, `license_url`, `provenances` |
| Estado de fuente | `key`, `name`, `home_url`, `license_url`, `last_attempt_at`, `last_success_at`, `next_refresh_at`, `last_error_code` |

Go y Rust se clasifican como `programming`; Kubernetes como `technology`.
La publicación admite `null`. Instantes válidos en ISO8601; nunca sustituir
publicación ausente por recepción sin indicarlo. Metadatos de estado desconocidos
también son `null`. Errores de fuente son códigos públicos estables, sin XML,
contenido remoto, credenciales o mensajes internos. No se exponen fuentes
deshabilitadas ni metadatos privados por deduplicar enlaces.

`provenances` es una lista no vacía de `{source_key, source_name, license_url}`
por URL, sin repetir fuentes. Una misma URL en varios snapshots produce una
tarjeta que conserva sus procedencias y licencias. Los campos primarios
`source_*` y `license_url` siguen el orden Go, Rust y Kubernetes
según orden estable del catálogo; con filtro de fuente, la primaria es la
seleccionada.
La paginación y total se calculan después de agrupar URLs. La procedencia sólo
incluye entradas vigentes; no recupera metadata privada ni vencida.

Se guardan título, URL, fecha y procedencia. `excerpt` y `author` son `null`.
La UI enlaza la licencia de cada fuente y el aviso MIT de Rust en
`/legal/news-rust-notice.txt`.

### Actualización administrativa

El body admite un único `source_key` del catálogo activo. Respuesta:
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

### Persistencia, recursos y recuperación

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
ni habilitar otros feeds o credenciales desde el body. El transporte tiene un
plazo total de 10 s y un máximo de 1 MiB en Go y Rust. Kubernetes tiene un límite
propio de 2 MiB. El parser admite hasta 50 entradas para cada Atom y 150 para
el RSS. Se conservan como máximo 100 artículos por fuente.
`ReplaceDevNewsSources1793750000000` amplía el CHECK de `news_sources` sin
reescribir las migraciones anteriores ni precargar artículos. La aplicación
retira web.dev y Node.js del catálogo; sus snapshots quedan preservados para
reversión. El `down` elimina la caché de los tres nuevos feeds y restaura el CHECK
anterior. Adopción y reversión operativas siguen el procedimiento de plan99.

### Exclusiones y verificación

daily.dev permanece deshabilitada por sus condiciones de redistribución.
El [catálogo](source-catalog.md) registra la clasificación de las demás candidatas.
La actualización se ejecuta bajo demanda desde el botón administrativo.

Verificar DTOs/normalización/retención, HTTP público vs POST protegido, roles
actuales/revocación, concurrencia entre instancias y recuperación en PostgreSQL
aislado. QA UI separa fixtures sintéticas, lectura RSS real y sesión auténtica.
