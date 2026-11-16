# Noticias de tecnología, programación e IA bajo demanda

> Seguimiento de implementación futura: `NEWS-001` en [TODO central](TODO.md).
> La especificación, opciones y diseño se retoman desde este plan y sus dependencias.

> Alcance vigente2026-11-16: [§9](#9-obtención-exclusiva-super_admin-y-primera-integración-rss--2026-11-16).
> Noticias pública debajo de Home; fuentes con cupo sólo para sesiones válidas,
> toda obtención externa sólo por super_admin activo. RSS público primero;
> daily.dev deshabilitada hasta resolver
> condiciones. Sucede las candidatas privadas y el orden de fuentes de §5/§7.

> Estado documental: en revisión. Investigación inicial2026-11-15 y primera
> integración web.dev local2026-11-16, con [evidencia propia](../evidence/news-public-rss-implementation-20261116.md).
> Confirmado: el usuario quiere entrar a una sección y obtener noticias mediante
> un botón; temas elegidos: tecnología, programación e IA.
> NEWS-02/03 y NEWS-05 implementados localmente; [NEWS-04§12](#12-news-04-segunda-fuente-rss-nodejs--solicitud2026-11-16)
> incorpora Node.js como segunda fuente RSS. NEWS-06 conserva aceptación/adopción;
> GitHub candidata y daily.dev deshabilitada, sin aprobación documental heredada.
> Continuación vigente de presentación: [NEWS-05§10](#10-news-05-composición-editorial-y-chips-de-temas--2026-11-16),
> solicitada por el usuario para completar diseño/chips; contratos y fetch §9 conservados.
> Trabajo trasladado el 2026-11-15 a `codex/news-section-design`, creada desde
> `origin/development` actualizado en `4e73a1ed`. Los siete archivos iniciales
> se comprobaron byte a byte antes de continuar la revisión.

## 1. Experiencia propuesta

Una sección **Noticias**, con destino canónico candidato `/news`, independiente
del grupo del menú conforme a [ADR092](../architecture/decisions/ADR-092-stable-module-navigation-routes.md).
Por la solicitud de §8 será pública, sin asignación de módulo, con enlace fijo
debajo de Home; aún no existe como ruta implementada. La excepción de Noticias
no cambia [autoridad89](89-module-access-and-user-data-scope.md) para otros dominios.

1. Al entrar, mostrar las noticias conservadas y cuándo se consultó cada fuente.
   Si aún no existen, explicar el estado y ofrecer **Obtener noticias**.
2. Elegir temas y pulsar **Actualizar noticias** para consultar fuentes externas.
   Entrar, cambiar filtros o volver a la página no provoca esa consulta externa.
3. Mostrar tarjetas con título, fuente/editor, fecha de publicación si existe,
   etiquetas y extracto cuando esté disponible y permitido. **Leer artículo**
   abre el original; no descargar ni republicar artículos completos.
4. Filtrar lo ya obtenido por tema y ordenar por publicación o recepción cuando
   falte esa fecha, indicando la diferencia. No presentar popularidad como novedad.
5. Durante la actualización conservar tarjetas y filtros con carga discreta;
   bloquear acciones incompatibles. Al terminar mostrar resultado real, incluso
   «sin novedades», fallos parciales o fuente no configurada.

Propuesta para después: guardar para leer, leído/no leído e intereses personales.
No son requisitos confirmados. La primera entrega no necesita IA generativa:
puede usar metadatos de las fuentes y un catálogo de temas. Un resumen/traducción
con IA sería otra ampliación con coste, selección explícita y procedencia.

## 2. Fuentes investigadas

Consulta documental histórica:2026-11-15; clasificación vigente y lecturas RSS
del2026-11-16 en [catálogo](../features/news/source-catalog.md) y §8.
No se usaron credenciales ni se probaron cuentas.
Los límites publicados no acreditan disponibilidad de una cuenta de Nodia.

| Fuente | Aporte | Acceso y límites documentados | Evaluación para Nodia |
| --- | --- | --- | --- |
| [daily.dev](https://docs.daily.dev/public-api/) | Feed personalizado, etiquetas, búsqueda y tendencias técnicas | REST con Bearer; API beta. Documentación: Free 200 peticiones/30 días, 60/min por cuenta y 300/min por IP; Plus retira cuota mensual. Cuota compartida entre tokens, OAuth y MCP | Candidata principal; validar plan efectivo y condiciones antes de depender de ella |
| [Hacker News API](https://github.com/HackerNews/API) | Enlaces y discusión tecnológica; listados nuevos/populares | API pública; actualmente sin rate limit declarado. Listados devuelven IDs, con detalle separado por noticia; sin filtro temático nativo | Complemento opcional; acotar consultas y filtrar elementos eliminados/dead |
| [RSS de GitHub Changelog](https://github.blog/changelog/) y otros editores oficiales | Novedades directas de productos/proyectos | Cada editor define campos, frecuencia y condiciones; RSS no otorga una licencia universal | Complemento recomendado mediante catálogo curado; validar cada fuente |
| [DEV / Forem V1](https://developers.forem.com/api/v1) | Artículos y tutoriales por etiquetas | Lecturas públicas; revisar términos específicos del sitio. No asumir una cuota de lectura a partir de límites de creación de v0 | Alternativa secundaria; diferenciar tutoriales de noticias y aclarar uso permitido |

daily.dev publica [precios](https://daily.dev/pricing/) que aún muestran acceso
API sólo en Plus, en discrepancia con su documentación del 2026-11-07. Pendiente:
comprobar acceso/cuota reales y aclarar con el proveedor si es necesario.
No presupuestar ni prometer acceso gratuito garantizado.

Para integración personal, daily.dev describe PAT; para aplicaciones con otros
usuarios, [OAuth](https://docs.daily.dev/oauth-apps/) permite consentimiento por
cuenta y scope `read`. Recomendar OAuth de lectura si la sección se ofrece a
varios usuarios. Un PAT tiene alcance amplio: limitar el adaptador a lecturas
y custodiarlo sólo en Server, sin logs ni exposición posterior al cliente.
No usar una cuenta personal para servir feeds personalizados a todos.

Los [términos daily.dev](https://daily.dev/tos/) señalan integraciones personales
y con token propio, y restricciones para productos competidores. El acceso
automatizado al texto vinculante completo no pudo verificarse; uso multiusuario,
almacenamiento, retención y exhibición quedan sujetos a revisión de esas condiciones.
Los [términos DEV](https://dev.to/terms) también requieren aclarar uso comercial
y exhibición. Ninguna API o feed implica permiso para republicar imágenes,
extractos o textos de terceros: almacenar/mostrar sólo campos autorizados,
con atribución y enlace, y definir retención antes de persistir contenido externo.

[NewsAPI](https://newsapi.org/pricing/) no se prioriza para estos temas: su plan
Developer es sólo para desarrollo, no producción, incluso interna. Reevaluarlo
si se amplía a noticias generales y existe presupuesto; no hace falta para V1.

### DEV: ampliación de viabilidad solicitada el 2026-11-15

El usuario pregunta expresamente por DEV como fuente adicional. Una lectura real
sin credenciales de `GET https://dev.to/api/articles?tag=ai&per_page=1`, con
`Accept: application/vnd.forem.api-v1+json`, respondió HTTP200 y un artículo.
Se comprobó presencia de título, descripción, URL, publicación, etiquetas, autor,
tiempo de lectura e imagen; presencia del campo no garantiza valor ni permiso de
exhibición. Es evidencia puntual de lectura pública, no integración con Nodia.

La [API V1](https://developers.forem.com/api/v1) documenta filtros por etiquetas
y listados de artículos; el listado habitual prioriza popularidad y existe
`/api/articles/latest` para novedades. DEV incluye tutoriales, opiniones y
discusiones además de noticias: proponer filtro de fuente/tipo editorial y no
tratar cualquier publicación reciente como anuncio técnico verificado.
Sigue como candidata sujeta a aclarar condiciones de exhibición/almacenamiento:
los [términos §2](https://dev.to/terms) restringen copia, uso comercial,
exhibición pública y mirroring. No asumir que tarjeta con atribución y enlace
resuelve por sí sola esas condiciones. No se obtuvo una cuota global verificada
de lectura; aplicar límites propios sin prometer acceso ilimitado.

## 3. Diseño técnico candidato

Módulo vertical dentro de Nodia Server y página Client con adaptadores separados
por fuente; sin microservicio nuevo. Consumir REST/feeds directamente desde
Server: MCP no es necesario para el botón ni incorpora herramientas al chat.

- Separar leer resultados conservados de solicitar actualización externa. DTOs,
  entidades, endpoints y límites exactos se definirán al implementar; no existen
  contratos ejecutables de Noticias acreditados en esta entrega.
- Aislar conexiones, preferencias, resultados personalizados y cursores por
  actor/cuenta. Compartir sólo caché de datos públicos cuando la licencia y el
  contrato lo permitan; comprobar autoridad antes de devolver cualquier caché.
- Una actualización activa por ámbito/selección, con coordinación compartida
  entre procesos, límite de frecuencia y presupuesto por cuenta/fuente. Deshabilitar
  el botón sólo en Client no evita duplicar consumo desde varias pestañas.
- Acotar fuentes, páginas, elementos, bytes, concurrencia y duración. Un clic
  puede consumir varias peticiones; no prometer una petición por actualización.
  Respetar `Retry-After` y cuotas reales; no inventar saldo si faltan cabeceras.
- Mantener estado separado por fuente: intento, éxito, error, consulta y contenido
  conservado. Fallo parcial no borra noticias anteriores ni marca todas las fuentes
  como actualizadas. Timeout no permite asumir cancelación remota ni consumo cero.
- Deduplicar primero por identidad de fuente y después por URL normalizada de
  forma conservadora. No fusionar por título ni eliminar parámetros desconocidos
  que distingan artículos. Conservar todas las procedencias al agrupar enlaces.
- Normalizar fechas y opcionales: publicación, recepción y última consulta son
  conceptos distintos; `null` no es cero. No inventar resumen, imagen o tiempo de
  lectura cuando la fuente no los entrega. Popularidad no acredita veracidad.
- Catálogo inicial de RSS administrado, sin URLs arbitrarias del usuario. Validar
  destinos/redirecciones contra SSRF, bloquear redes privadas y limitar descarga;
  parsear XML sin entidades externas y sanear HTML. Enlaces sólo HTTP(S) seguros.
- Primera carga informativa con Boneyard; actualización con soft loading, estados
  vacío/error/reintento y toast internacionalizado conforme a las reglas Client.
  Tarjetas responsive, tema actual, teclado/foco y padding de página vigente.

Antes de fijar almacenamiento/conexiones y contratos compartidos, evaluar ADR
con alternativas y retención. Este borrador no decide esquema irreversible.

## 4. Entregas y aceptación propuestas

- [x] Registrar intención y temas confirmados; investigar documentación oficial.
- [x] Crear [ficha de producto](../nodia-ai/knowledge/news/README.md) y
  [función candidata](../nodia-ai/knowledge/news/features/on-demand-reading.md),
  índices y registro explícito de validación; sin aprobación ni publicación.
- [x] Trasladar cambios a rama propia desde development actualizado y definir
  [dirección visual editorial](../features/news/editorial-design.md), manteniendo
  sidenav, topbar, tema y navegación móvil; NEWS-05 completa UI local en§10.
- [x] Resolver alcance público/por sesión y primer catálogo RSS por §8: web.dev
  como primera fuente propuesta, campos/licencia y retención local definidos.
- [ ] Resolver términos y conexión real daily.dev antes de habilitar esa fuente;
  impedimento independiente que no bloquea la primera entrega RSS pública.
- [x] Definir autoridad, entidades/DTOs, caché, límites y ADR si corresponde;
  contrastar contratos con backend antes de construir formularios/componentes.
- [x] Implementar una fuente de extremo a extremo: entrar sin consumo externo,
  actualización explícita, tarjetas reales y enlace original.
- [x] Añadir RSS y probar deduplicación y fallos parciales sin borrar resultados.
- [x] Verificar unidades de normalización/fechas/dedupe y política de consumo;
  integración aislada para ámbito, revocación, concurrencia y caché.
- [x] Probar en laboratorio respuesta vacía/inválida, datos ausentes, servicio
  caído,401/403/429, timeout, doble clic, exclusión entre instancias, selección
  obsoleta y configuración histórica; alcances reales separados en§9/12/13.
- [x] Verificar UI sintética ES/EN móvil/escritorio, reintento y errores sin perder
  contenido; RSS reales, JWT/SQL y zoom nativo geométrico/teclado separados en§13.
- [ ] Aceptación humana, teléfono/sesión auténtica e inspección visual nativa200%,
  seguida de adopción y postchecks del entorno autorizado. No confundir con CI.

No se implementan actualizaciones programadas, push, lector completo ni herramientas
NodiaAI en este corte. Cada ampliación necesita alcance propio. El Markdown explica
la propuesta; no concede permisos ni habilita operaciones.

## 5. Opciones vigentes y diseño — continuación 2026-11-15

El usuario solicita trabajar en rama nueva desde development actualizado y
actualizar las opciones y el diseño con inspiración en
[Freesets Blogs](https://freesets.dev/blogs), conservando sidenav y topbar.
Se mantiene el foco confirmado en tecnología, programación e IA.

| Opción | Estado actual | Papel propuesto |
| --- | --- | --- |
| daily.dev | API documentada; cuenta/plan efectivo y condiciones pendientes | Descubrimiento técnico/personalización, si se valida acceso |
| DEV | Lectura pública puntual HTTP200 comprobada; exhibición/retención pendientes | Artículos y experiencias por etiquetas; fuente seleccionable |
| RSS oficiales | Catálogo y condiciones por editor pendientes | Anuncios directos, con procedencia separada |
| Hacker News | Documentación pública revisada; adaptador pendiente | Complemento opcional de discusión/tendencias |

Estas fuentes conviven mediante adaptadores; elegir fuentes para actualización
y filtrar lo conservado son acciones distintas. Cambiar el filtro de lectura
no hace peticiones externas. El alcance inicial recomendado es daily.dev + RSS,
con DEV preparado como candidato explícito; no se adopta una fuente sin resolver
su acceso y condiciones. Si daily.dev no resulta viable, reevaluar el orden de
entregas de forma visible, sin sustituirlo silenciosamente.

**Dirección visual recomendada: revista técnica contemporánea**, inspirada
principalmente en Codrops, con legibilidad/metadatos de Smashing Magazine y
filtros de DEV. La elección es juicio de diseño, no aprobación del usuario o
resultado de una prueba de rendimiento. [Especificación visual](../features/news/editorial-design.md)
contiene referencias, wireframes, tokens, variantes sin imagen y criterios QA.
Freesets es directorio de inspiración; no es API de noticias ni licencia para
copiar código, portadas, identidad o contenido de los sitios listados.

Se propone actualizar sólo el contenido de Noticias en `PageContent`: cabecera
compacta, temas, fuente/orden, primera noticia con mayor jerarquía y grid regular.
La primera noticia ocupa esa posición por el orden elegido, sin llamarla
«destacada» o «recomendada» si no existe una regla comprobada. No duplicarla en
el resto del feed. Sidenav, topbar, MobileBottomNav, permisos y theme siguen
siendo los componentes compartidos; no se rediseñan desde Noticias.

Skills locales aplicadas: frontend-design, responsive-design, accessibility,
create-component y frontend-quality para el contrato visual y futura ejecución.
Conservar MUI/Emotion y tokens actuales; no hace falta instalar otra librería o
skill para obtener esta dirección. Las pautas creativas genéricas de tipografía
se adaptan a DM Sans y al theme vigente de Nodia.

PENDIENTE: revisión de la propuesta visual y del alcance de V1, resolución de
condiciones por fuente, contratos y aplicación real. Una maqueta con fixtures
no acredita consultas desde Nodia, permiso de redistribución o aceptación de UI.

## 6. Verificación de esta entrega documental y maqueta

Transferencia exacta de los siete archivos iniciales comprobada contra el stash
de origen; stash temporal retirado tras la comprobación. Rama actual
`codex/news-section-design`, base `4e73a1ed` de origin/development actualizado.
Sin commit/push o cambios a componentes productivos por esta entrega.

`knowledge:check` correcto:94 fuentes,50 excluidas y44 documentos/46 fragmentos
publicados conservados. Frontmatter draft/planned/unregistered, approval:null;
enlaces locales, UTF-8/LF y `git diff --check` comprobados. No se emitió bundle
ni se publicaron herramientas/contexto. Plan y diseño siguen en revisión.

Maqueta standalone en `output/news-design/`, con fixtures y shell esquemático.
Inspección visual de escritorio/móvil y seis perfiles Chromium
320/600/1440px × claro/oscuro correctos: sin overflow del documento, filtros y
vacío/HN, reset, selección conservada al redimensionar, aviso de actualización
local sin HTTP, colapso88px, drawer y diálogo con Escape. Cero errores JS o
peticiones externas durante ese recorrido. Variante sin portada usa el título;
primera tarjeta derivada del primer resultado filtrado. Capturas locales y recibo
QA son artefactos de revisión ignorados, no dependencias del producto.

No acredita UI integrada en Nodia, auth/permisos reales, cuenta/API, teléfono
físico, contraste auditado, ES/EN, zoom200% o el resto de la matriz de diseño.
Esos gates permanecen pendientes para la implementación.

## 7. Rama y secuencia de implementación — 2026-11-16

Solicitud actual: crear una rama dedicada y concretar el plan de implementación.
Se creó `codex/news-implementation` desde `origin/development` actualizado,
commit `2585b767`, con árbol limpio. La rama histórica
`codex/news-section-design` se conserva; la propuesta y sus fichas ya están en
development y no requieren copiar cambios ni repetir la maqueta. Este corte
define secuencia y aceptación; no acredita código News, conexión real, aprobación
documental, commit/push ni despliegue nuevos.

### Alcance propuesto para V1

Propuesta de este corte, sucedida por §8 en acceso público y orden de fuentes.
Sección `/news`, sujeta al catálogo y autoridad reales, con noticias de tecnología,
programación e IA, resultados conservados, actualización por botón, filtros
locales y enlace al original. Se reutiliza el diseño editorial de §5 dentro del
shell auténtico. Se mantiene la recomendación daily.dev + RSS oficiales;
DEV y HN son ampliaciones candidatas, sin integración simultánea obligatoria.
El primer pendiente sigue siendo elegir y habilitar las fuentes con condiciones
comprobadas. Si daily.dev no es viable, registrar el motivo y revisar expresamente
el orden; no sustituirla automáticamente.

| Etapa | Trabajo y resultado revisable | Criterio de salida |
| --- | --- | --- |
| NEWS-01 — fuentes y alcance | Matriz por fuente: acceso real, ámbito personal/multiusuario, campos permitidos, retención, atribución, límites observables y catálogo/taxonomía. Reutilizar la investigación existente y revisar sólo lo pendiente o cambiado | Una primera fuente viable y ámbito definidos; cuestiones sin resolver explícitas. Sin persistir/exhibir campos cuya autorización siga pendiente |
| NEWS-02 — contratos y autoridad | Ruta pública bajo Home según §8/ADR105 y contratos separados para fuentes limitadas por sesión, sin rol/módulo. Lectura conservada, actualización, DTOs, paginación, almacenamiento, retención y presupuesto | Contrato verificable y plan de migración/rollback; actor de fuentes limitadas derivado de sesión, caché pública separada y condiciones del catálogo aplicadas. Endpoints y entidades pendientes |
| NEWS-03 — primera fuente completa | Dominio vertical Server con adaptador de lectura y primera UI funcional integrada. Conexión segura cuando aplique, normalización, actualización explícita, persistencia permitida y resultados reales | Entrar/filtrar no consume fuente externa; el botón obtiene resultados o informa vacío/error real. Una cuenta no devuelve feed/credenciales de otra |
| NEWS-04 — RSS y múltiples fuentes | Catálogo administrado, validación de destinos/redirecciones, XML seguro, deduplicación conservadora y procedencias. Integrar la segunda fuente habilitada | Fallo parcial conserva noticias y último éxito por fuente; enlaces repetidos no duplican tarjetas ni pierden atribución |
| NEWS-05 — cierre editorial y responsive | Completar la propuesta existente: jerarquía de primera tarjeta, grid, selección de fuentes para actualizar separada del filtro de lectura, ES/EN, teclado/foco y variantes sin medios | Shell/theme conservados, sin doble padding u overflow; carga inicial y actualización distintas, vacío/error/reintento y contenido conservado al redimensionar |
| NEWS-06 — aceptación y entrega | Consolidar pruebas de reglas, integración aislada, fuente/cuenta real y QA visual; actualizar evidencia, fichas, TODO y progreso. Adopción separada por entorno | Evidencia distingue fixtures, HTTP real, UI autenticada y teléfono físico; limitaciones y siguiente pendiente registrados, sin aprobación documental heredada |

La UI mínima pertenece a NEWS-03; NEWS-05 completa sus variantes y revisión.
No construir todo el backend antes de comprobar el primer recorrido completo.
Las pruebas de cada etapa se ejecutan al introducir su regla, no sólo al final.
Si una cuenta/condición externa bloquea NEWS-01, se pueden preparar contratos y
fixtures aislados; eso no acredita integración ni fija un esquema antes del ADR.

### Garantías a concretar y verificar

- Coordinación compartida por actor/cuenta/fuente, incluyendo selecciones que se
  solapan entre pestañas. Límites y presupuesto se reservan antes de cada petición
  externa; un clic puede realizar varias. No mantener una transacción SQL abierta
  durante la red ni añadir infraestructura de jobs sin evaluar la existente.
- Definir en NEWS-02 ejecución acotada frente a trabajo durable, recuperación tras
  caída y consulta de estado. Un timeout no prueba cancelación o consumo cero;
  volver a consultar el estado local no debe disparar otra actualización.
- Revalidar autoridad antes de entregar resultados; separar conexiones, cursores
  y resultados personalizados. Una respuesta tardía no modifica la cuenta o
  selección nueva. Compartir caché pública sólo si contrato y condiciones lo permiten.
- Fechas de publicación/recepción/consulta separadas; opcionales desconocidos
  explícitos. Identidad de fuente y URL normalizada conservadoramente, sin fusión
  por título ni eliminación de parámetros desconocidos. Títulos externos se
  conservan en su idioma original.
- Unidades de normalización, fechas, deduplicación y consumo; integración aislada
  para autorización/revocación, aislamiento, concurrencia entre procesos y caché.
  Casos: vacío/inválido, datos ausentes, 401/403/429 y Retry-After, caída/timeout,
  doble clic, dos pestañas, cambio de cuenta/selección y configuración histórica.
- QA UI en 320/600/900/1440px, claro/oscuro, ES/EN, sidenav expandido/colapsado,
  zoom200%, teclado y medios rotos. Prueba con sesión auténtica y dispositivo físico
  separada de la automatización sintética; credenciales fuera de fixtures y logs.

### Revalidación documental de proveedor en este corte

El 2026-11-16 se consultaron nuevamente las páginas oficiales de
[API daily.dev](https://docs.daily.dev/public-api/) y
[OAuth](https://docs.daily.dev/oauth-apps/): ambas describen beta; OAuth para
aplicaciones multiusuario requiere intercambio en Server y PKCE, y permite
scope `read`. NEWS-01 debe definir scopes mínimos y necesidad de renovación;
no solicitar `write` ni historial de lectura para obtener noticias.
Esta lectura no prueba una cuenta operativa, no resuelve la discrepancia previa
de precios ni verifica condiciones de exhibición/retención. Los gates siguen abiertos.

**Primer paso real:** NEWS-01. No repetir la maqueta existente ni iniciar cuatro
adaptadores a la vez. Alcances posteriores (IA, guardados/leídos, push y consultas
programadas) conservan sus decisiones separadas de §1 y §4.

Verificación de este corte documental: `knowledge:check` correcto con96fuentes,
52excluidas y44documentos/46fragmentos publicados conservados; fichas Noticias
revisión3 draft/planned/unregistered, approval:null. Enlaces locales existentes,
UTF-8/LF y `git diff --check` correctos en los siete archivos editados. No se
ejecutaron pruebas de producto ni build de aplicación al no cambiar código.

## 8. NEWS-01: acceso público y catálogo inicial — 2026-11-16

### Reglas confirmadas por el usuario

Noticias será pública y aparecerá inmediatamente debajo de Home en el menú.
Cualquier persona podrá leerla sin sesión. Fuentes gratuitas sin asignación
periódica de llamadas podrán alimentar la capa pública; fuentes con cuota
estarán reservadas a cualquier usuario con sesión Nodia válida, por ahora sin
exigir rol ni módulo. Guardar sus resultados no los vuelve públicos.

El criterio de cupo comprende día/mes u otro período equivalente: una API gratis
con200peticiones mensuales no cumple la capa anónima. Protección de tráfico y
enfriamiento de Nodia son distintos y se conservan; ausencia de cuota publicada
no se presenta como llamadas ilimitadas garantizadas.

### Resultado y orden actualizado

[Catálogo canónico](../features/news/source-catalog.md): clasificación, campos,
atribución y política local propuesta. [Evidencia NEWS-01](../evidence/news-source-discovery-20261116.md):
GET200 reales de web.dev, Node.js y GitHub Changelog y revisión de condiciones.
No son consultas desde Nodia ni validación de adaptadores.

1. Primera fuente para NEWS-03: RSS web.dev público, licencia explícita y
   atribución; sin imágenes inicialmente. Tecnología/Programación/IA se conservan
   como temas, con ámbito Programación para este editor. Una fuente no acredita
   cobertura de todos los temas.
2. Node.js candidata adicional tras preparar avisos y cerrar alcance de contenido;
   GitHub Changelog mantiene derechos de redistribución pendientes. No activar
   portadas/extractos por mera presencia en el RSS.
3. daily.dev pasa expresamente de primera candidata a limitada/deshabilitada.
   Sus términos restringen compartir datos/tokens y productos competidores;
   aclarar compatibilidad de News con el proveedor antes de habilitar. Login Nodia
   no basta y OAuth propio no resuelve esa cláusula por sí solo. No usar token
   común ni comprar Plus para servir a todos. Cuenta/app reales siguen pendientes.

La propuesta pública de7días desde última aparición y15minutos entre consultas
compartidas está detallada en el catálogo; son decisiones de Nodia aún sin
implementar, no límites del editor. Daily.dev necesitará otra política si se habilita.

### Autoridad y dependencias afectadas

[ADR105 propuesto](../architecture/decisions/ADR-105-public-news-and-source-access-tiers.md)
separa página pública, handlers por capa y cachés. Es excepción de Noticias
respecto a la propuesta privada anterior; no abre otros módulos ni exige
GuardStrict/asignación para News. Las operaciones limitadas requieren sesión
real y permisos del proveedor, sin otro permiso Nodia.

La inspección confirma que `AuthSessionProvider` envuelve el router y puede
retenerlo durante recuperación. NEWS-02 debe permitir lectura pública ante
sesión histórica inválida sin relajar rutas privadas. Delimitar handlers públicos
uno a uno, sin hacer público un controller que incluya datos limitados. Verificar
logout/cambio de cuenta, caché vieja y dedupe sin filtrar procedencias privadas.

### Cierre por alcance y primer pendiente

- [x] Confirmadas exposición pública, menú y regla de cupo/sesión.
- [x] Revisados RSS reales y condiciones documentales por separado.
- [x] Definida primera fuente y propuesta de campos/retención/taxonomía.
- [x] Registrados impedimento daily.dev y revisión explícita del orden.
- [x] Actualizados diseño, autoridad documental, fichas e índices afectados.
- [x] NEWS-02: contratos/DTOs, handlers/caché, límites de descarga/elementos,
  navegación pública y migración; implementado/verificado después en§9.
- [ ] daily.dev: aclaración del proveedor, cuenta/app y verificación real;
  dependencia separada que no condiciona la primera entrega web.dev pública.

NEWS-01 cerrado por alcance de selección pública inicial; no se declara resuelta
la integración daily.dev, habilitada ninguna fuente ni aprobado el ADR/documento.

Verificación documental del corte: `knowledge:check` correcto con96fuentes,
52excluidas y44documentos/46fragmentos publicados conservados. Fichas revisión4
draft/planned/unregistered, approval:null; doce archivos documentales con enlaces
locales y UTF-8/LF comprobados, `git diff --check` correcto. Sin cambios de código,
pruebas de aplicación, build o despliegue en este paso de investigación.

## 9. Obtención exclusiva super_admin y primera integración RSS — 2026-11-16

El usuario reserva el fetch de noticias a su condición de super_admin y solicita
continuar. Esta regla sucede la obtención anónima o por cualquier sesión de §8:
**GET de resultados públicos para cualquiera; petición externa sólo por sesión
válida con super_admin activo en la BD actual**. No se fija un ID/email en código
ni se concede acceso por grupo/asignación de módulo. Ser super_admin no elimina
las condiciones de una fuente: daily.dev continúa deshabilitada.

### NEWS-02/03: alcance de construcción

[Contratos canónicos](../features/news/http-contract.md): `GET /api/v1/news`
público de caché y `POST /api/v1/news/refresh` administrativo, body de fuente
explícita. Filtros de tema/fuente/orden y paginado acotado; no hay HTTP arbitrario
ni consultas upstream en lectura, montaje o cambios de filtro. Primer editor
web.dev con tarjetas tipográficas, atribución/licencia y originales externos.

Snapshot persistido máximo100artículos normalizados por fuente, retención7días
y reserva/enfriamiento15minutos compartidos entre procesos. Reserva y publicación
validan autoridad actual, sin transacción abierta durante red. La migración se
entrega como código para ensayo aislado; no se adopta automáticamente en la BD
de trabajo o producción. No registrar módulos/asignaciones News para habilitar
una sección que el usuario pidió pública.

Client integra el enlace fijo Home→Noticias en el shell existente y conserva
el feed ante errores de sesión. Botón de actualización sólo con contexto de
super_admin del actor vigente, bloqueado en peticiones; el POST vuelve a comprobar
en Server. Cualquier usuario sin ese rol puede leer/filtrar y reintentar GET,
sin consumir una fuente externa. Sin cambios de MobileBottomNav, IA, cron, imágenes,
otras fuentes, despliegue o publicación de fichas en este alcance.

### Checklist y estado

- [x] Registrada nueva autoridad exclusiva del fetch y contrato compartido.
- [x] NEWS-02: DTOs, política HTTP exacta, migración/snapshot y reserva comprobados.
- [x] NEWS-03: adaptador RSS seguro y primera UI pública integrada.
- [x] Pruebas atómicas, HTTP y PostgreSQL aislado para autorización, concurrencia,
  retención, recuperación, datos inválidos y rechazo sin upstream.
- [x] Tipos/lint/build y QA sintética responsive del shell auténtico.
- [x] Lectura RSS real desde el adaptador, diferenciada de fixtures y UI autenticada.

Implementación local verificada según [evidencia final por alcance](../evidence/news-public-rss-implementation-20261116.md):
3078pruebas Client/374archivos,43focales Server,9gates SQL/HTTP descartables y una
lectura real del adaptador con10artículos. Global Server6088correctos/1omitido
histórico Linux/355archivos; tipos/lint/build correctos con avisos previos delimitados.
La migración no se aplicó a BD configurada ni se desplegó. Borradores Noticias
revisión5: producto partial, función implemented por primera fuente, unregistered
y approval:null. Corpus44documentos/46fragmentos conservado.

Siguiente NEWS-04: condiciones/avisos y segunda fuente (Node/GitHub candidatas),
sin reabrir NEWS-01 ni repetir el primer adaptador. NEWS-05/06 conservan revisión
humana, zoom200% no comprobado en este corte, sesión auténtica/dispositivo y
adopción por entorno. daily.dev mantiene aclaración y cuenta/app pendientes;
no se publica su feed por restringir el fetch a super_admin.

## 10. NEWS-05: composición editorial y chips de temas — 2026-11-16

El usuario solicita completar el diseño editorial planeado, incluidos chips de
temas. Se retoma NEWS-05 sin reabrir fuentes, contratos, reserva, permisos o
migración. Se mantiene la misma rama y los cambios previos del workspace.

### Cambios implementados

- Cabecera editorial compacta con contexto temático, título y subtítulo; barra
  de filtros delimitada, fuente/orden reutilizables y temas visibles como chips.
- `NewsTopicChips`: Todos/Tecnología/Programación/IA, selección única anunciada,
 44px y wrap. Repetir selección no la borra ni dispara GET. Cambio de tema conserva
  orden/fuente y reinicia página según el contrato anterior.
- CSS por contenedor:1columna bajo580px útiles,2desde580px y3desde1020px;
  primera noticia ocupa2cuando existen. Gaps24px vertical/16px horizontal,
  sin doble padding. No duplicar árbol, estado o consultas por breakpoint.
- «Para explorar» y conteo de `pagination.total`, sin inventar novedades ni sumar
  sólo la página. Fuente/fecha junto al titular, tema real y autor opcional;
  encabezados h1→h2→h3. Variante sin imágenes, títulos íntegros y originales/licencia.
- Corrección de teclado observada en Chromium: un chip deshabilitado durante
  GET perdía el foco a body. Retorno local al terminar sólo para esa activación,
  cancelado por cualquier intención nueva; sin listeners permanentes o timers.
  Limpiar filtros lleva al encabezado persistente de resultados, no al botón retirado.

### Estado y aceptación

[Diseño actualizado](../features/news/editorial-design.md) y
[evidencia NEWS-05](../evidence/news-editorial-design-20261116.md) distinguen
implementación visual de aceptación humana. Focales24/4archivos, tipado/lint/build
correctos y global Client3087/375 correcto. QA sintética
10perfiles320/600/900/1200/1440px en oscuro ES/claro EN, más sidenav colapsado,
teclado, filtros/paginado y reflow720px por alcance documentado.

Impacto exclusivamente de presentación/interacción de filtros existentes: no
cambia su taxonomía, peticiones, interpretación de cuotas, contratos de artículos
o autoridad. Campos de autor/tema/total ya estaban en backend. Evaluación en
fichas revisión6, sin capacidad/herramienta, aprobación o publicación nuevas.

NEWS-05 tiene implementación editorial local completa para la variante actual
sin medios. NEWS-06 conserva revisión humana/sesión auténtica, teléfono físico,
zoom de escritorio nativo200% y adopción por entorno. El reflow720px CSS no se
presenta como prueba de zoom nativo. NEWS-04 sigue separado para segunda fuente;
sin consultas externas reales, cambios Server/DB o despliegue en este corte UI.

NEWS-05 cerrado por implementación editorial y verificación local de la variante
sin medios:10perfiles principales, reflow720px, foco/teclado, paginación y503
sintético correctos. El primer intento global se interrumpió al corregir foco de
limpieza; la ejecución final3087/375 se hizo después del último cambio de código.
No se repitieron SQL, migraciones o inferencias de §9 ni se amplió su aceptación.

## 11. Pendientes reales de News — conciliación2026-11-16

La consulta del usuario sobre lo restante no cambia el alcance ni acepta News.
NEWS-01 queda resuelto para habilitar la primera fuente; NEWS-02/03 y NEWS-05
están implementados/verificados localmente por §9–10. Los checklists iniciales
de §4 y la secuencia histórica de §7 se leen junto a estas continuaciones, sin
repetir los contratos, integración web.dev o composición editorial ya entregados.

- **NEWS-04:** verificar condiciones y avisos de la segunda fuente RSS; Node.js
  es la candidata inicial y GitHub Changelog conserva su revisión de derechos
  pendiente. Después integrar catálogo múltiple, procedencias/deduplicación y
  fallos parciales sin perder resultados de otras fuentes. La primera entrega
  sólo admite web.dev; no se presenta como agregador multifuente terminado.
- **NEWS-06:** completar revisión humana con sesión auténtica, teléfono físico y
  zoom nativo de escritorio200%; el reflow720px comprobado no demuestra ese zoom.
  Consolidar aceptación y adopción por entorno, con migración/rollback propios.
  La migración sólo se ensayó en PostgreSQL descartable: no está aplicada a la
  BD configurada, VM o producción por este desarrollo.
- **daily.dev:** permanece deshabilitada por condiciones de acceso y
  redistribución pendientes según el [catálogo](../features/news/source-catalog.md).
  Es una dependencia separada: no bloquea entregar RSS y no se resuelve dando
  el fetch a super_admin. No construir conexión ni compartir un token mientras
  esas condiciones sigan sin aclararse.

La variante editorial actual sin imágenes está cerrada por NEWS-05. Incorporar
portadas exige una fuente/contrato autorizado; no es un defecto pendiente del
diseño entregado. No hay nuevas consultas externas, pruebas de código, aprobación
documental o despliegue en esta conciliación de seguimiento.

## 12. NEWS-04: segunda fuente RSS Node.js — solicitud2026-11-16

El usuario solicita integrar Node.js manteniendo lectura pública y fetch exclusivo
super_admin. Continúa la misma rama `codex/news-implementation`; no se reabren
primera fuente, NEWS-05, shell o autoridad. Este corte sucede el pendiente de
segunda fuente de§11; GitHub y daily.dev no son requisitos para cerrar NEWS-04.

### Fuente y alcance comprobable

[Revisión Node.js](../evidence/news-nodejs-source-review-20261116.md): RSS oficial
HTTP200 normal TLS,1074entradas/328143bytes, metadata trazada al generador y
Markdown/MDX del repositorio oficial. Licencia MIT específica del sitio, aviso
completo conservado y enlace de atribución; la inferencia de habilitación se
limita a título, URL y fecha. No extractos, autores, cuerpos o medios; esos campos
opcionales quedan null. No se identificó cuota periódica y no se promete uso
ilimitado. daily.dev sigue deshabilitada por sus condiciones independientes.

### Implementación y garantías

- Catálogo cerrado `web-dev`/`node-js`; GET público lee snapshots por lote en una
  consulta y entrega ambos estados, incluso antes de su primera actualización.
  POST actualiza exactamente la fuente explícita, con comprobación de actor,
  sesión y super_admin actual antes de reservar y publicar.
- Estado, enfriamiento15minutos, lease/fencing, validadores y último éxito/error
  independientes por fuente. Un fallo Node no borra ni modifica web.dev; una
  fuente puede actualizar mientras la otra tiene una reserva en vuelo.
- Mismos controles DNS/IP pública fijada, TLS, deadline10s y1MiB antes de parsing.
  Node admite2000entradas XML por su histórico completo; web.dev conserva500.
  Snapshot máximo100 por fuente y retención lógica7días con poda por actualización.
  Son límites de Nodia, no cuotas del editor; no se añade cron o janitor.
- URLs normalizadas idénticas se agrupan antes de paginar/contar. `provenances`
  conserva las atribuciones/licencias vigentes; primaria por orden estable del
  catálogo, o por fuente filtrada. No mezclar extractos entre editores ni
  atribuciones vencidas. Los campos primarios previos se conservan.
- Selector administrativo independiente del filtro de lectura y sin fuente
  inicial implícita. Elegir/filtrar no hace POST; errores conservan feed y
  selección. Feedback tardío se descarta al cambiar actor/fuente. Aviso MIT
  servido en `/legal/news-nodejs-notice.txt` y enlazado desde toda tarjeta Node,
  incluidas procedencias secundarias.
- Migración nueva `NewsNodeSource1793670001000` amplía el CHECK de fuentes,
  conservando `PublicNewsCache1793670000000`. No precarga artículos. Rollback
  elimina sólo la caché Node y restaura CHECK original; web.dev se conserva.
  Adopción y rollback en entorno requieren el procedimiento de plan99, con
  procesos drenados; no se ejecutan contra la BD configurada en esta entrega.

### Verificación y continuación

La [evidencia NEWS-04](../evidence/news-nodejs-integration-20261116.md) conserva
pruebas atómicas, integración SQL/HTTP descartable, adaptador real y QA UI por
separado. La lectura real compilada normalizó100artículos Node válidos sin
credenciales o persistencia. La investigación de licencia y la revisión de código
no sustituyen aceptación humana o adopción.

Globales finales: Client3103/375; Server6091/355 y1omitida histórica Linux;
tipos/lint/build y conocimiento correctos por el alcance de la evidencia.
NEWS-04 queda cerrado por implementación y verificación local; NEWS-06 continúa aceptación y entrega:
revisión humana/sesión auténtica, teléfono físico, zoom nativo200% y adopción por
entorno de ambas migraciones. El reflow previo no se reclasifica como zoom. No se
despliega, publica conocimiento, aprueba ADR105/fichas o realiza inferencia en este
corte. Evaluación de conocimiento: ampliar fuentes/procedencias de la función
existente, sin herramienta IA, permisos o capacidad de escritura nueva; fichas
producto/función revisión7, draft/unregistered/approval:null.

## 13. NEWS-06: validación final y preparación de entrega — solicitud2026-11-16

El usuario solicita validar y dejar News lista **para desplegar**. Este corte
completa la preparación técnica local y versiona el candidato para revisión/CI;
no ejecuta promoción a master, migración de DB configurada o despliegue. La
aceptación humana y adopción se conservan como alcances separados.

La [evidencia final](../evidence/news-final-validation-20261116.md) y
[QA UI](../evidence/news-final-ui-20261116.md) distinguen capas:

- JWT verificado por clases de autenticación reales y sesiones SQL descartables:
  13gates sin red externa. Tokens inválidos/vencidos/firma/audiencia incorrectas,
  usuario/sesión/rol revocados bloquean POST sin consumo. GET sigue público.
- Opt-in de laboratorio14gates: dos POST super_admin con JWT efímero consultan
  RSS reales, persisten web.dev10/Node100 y GET anónimo devuelve110/3páginas.
  Exactamente2consultas upstream, sin retry/fallback. No Google o cuenta humana.
- UI del build: vacío/JSON inválido/503/reintento; refetch fallido conserva
  tarjetas, selección, foco y feedback; teclado/fuentes y logout durante POST
  tardío, sin envío implícito o replay.
- Defecto de carga inicial encontrado y corregido: Boneyard ocultaba contenido
  sin initialBones. `NewsInitialLoading` reserva220px y huesos del theme, sin
  datos inventados; sólo primera carga.41focales/5archivos, tipos/lint/build y
  QA320/900/1440 correctos; refetch conserva tarjetas y usa carga suave.
- Chrome nativo200% confirmado por UI accesible y DPR1→2/innerWidth929→464,
  sin overflow y con selección/foco por Space. Restaurado100%. La captura visible
  falló; PNG negras no se usan como evidencia. Reflow visual464CSS es distinto
  y no cierra inspección visual nativa pendiente.

[Guía de entrega](../features/news/deployment-readiness.md): Server y Client
coordinados, dos migraciones News desde paquete validado, inventario append-only
y postchecks. Down/up de caché en laboratorio no acredita rollback automático de
producción. Volver a un paquete pre-News con menos migraciones no satisface el
ledger: recuperación compatible o procedimiento explícito con mantenimiento.

### Estado por fase

- [x] Preparación técnica local de NEWS-06 y evidencia consolidada.
- [x] Pruebas/corrección de la carga inicial, UI adversa, JWT/SQL y RSS reales.
- [x] Procedimiento de entrega/recuperación y mínimos postchecks registrado.
- [ ] CI del SHA final: consultar PR/Actions del candidato versionado; una suite
  local o build previo no lo acredita. La promoción requiere el gate CI correcto.
- [ ] Aceptación humana y postchecks con sesión auténtica/teléfono en entorno;
  inspección visual nativa200% pendiente por la limitación de captura descrita.
- [ ] Adopción y cierre operativo por recibo de la entrega autorizada.

La preparación solicitada no queda bloqueada por hardware inaccesible; las
limitaciones se entregan explícitas y no se marcan como pruebas ejecutadas.
NEWS-001 continúa como **candidato preparado**, con siguientes pasos CI/promoción
y adopción según su autoridad. daily.dev y GitHub siguen fuera de esta primera
entrega; no son gates adicionales para RSS. ADR105 sigue propuesto y las fichas
revisión8 draft/unregistered/approval:null. Impacto de conocimiento: consolidar
verificación y corrección de presentación de la función existente, sin nuevas
operaciones, herramientas, permisos o inferencias.
