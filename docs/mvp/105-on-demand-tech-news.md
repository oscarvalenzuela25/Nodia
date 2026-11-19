# Noticias de tecnología, programación e IA bajo demanda

> Seguimiento de implementación futura: `NEWS-001` en [TODO central](TODO.md).
> La especificación, opciones y diseño se retoman desde este plan y sus dependencias.
> Alcance aprobado para implementación: [Noticias personales §18](#18-plan-de-noticias-personales).
> La [verificación local](#185-implementación-y-verificación-local) registra Client,
> Server, PostgreSQL y el actualizador de CD aislado.
> Continuación para un solo dueño en desarrollo: [piloto personal daily.dev §18.8](#188-piloto-personal-local-de-dailydev).

> Alcance de la primera versión RSS del 2026-11-16: [§9](#9-obtención-exclusiva-super_admin-y-primera-integración-rss--2026-11-16).
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

## 14. PR a development y capturas fuera de Git — solicitud2026-11-16

El usuario solicita PR de estos desarrollos a development, retirar imágenes de
validación y actualizar TODO. Se conserva la [PR46 existente](https://github.com/oscarvalenzuela25/Nodia/pull/46),
`codex/news-implementation`→`development`, sin duplicarla, fusionarla o desplegar.
Su corte funcional `8886e42f43c1dc93e4a67cfb643b9aac7d9c9f17` pasó
[CI43958680003](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43958680003):
Client3104/376, Server6092/355 sin omisiones y40comprobaciones de esquema.

La actualización documental retira247capturas históricas del árbol versionado
(16486902bytes), conserva originales locales/ignorados, hashes y enlaces al
commit original en el [catálogo](../evidence/validation-images-archive-20261116.md).
No había capturas nuevas en el diff de News; la retirada afecta las históricas
ya incluidas en development. No se reescribe historia ni se promete reducir el
tamaño de un clon completo. JSON históricos y assets funcionales intactos.

Los enlaces modificados cambian únicamente procedencia de cuatro documentos
publicados, sin cambiar contenidos, contratos, capacidades o aprobaciones según
[delta](../evidence/validation-images-knowledge-delta-20261116.json). Los derivados
de conocimiento se reconstruyen mediante scripts existentes; no se omiten sus
checks. Las cuatro fichas afectadas permanecen draft/approval:null.

La PR actualizada requiere su CI de SHA exacto; el CI funcional anterior no se
atribuye al commit posterior. Siguiente paso: revisión/integración a development
y promoción/adopción autorizada según la guía, conservando límites manuales de§13.

## 15. Promoción y publicación comprobadas — 2026-11-16

Consulta de estado posterior al usuario: [PR46](https://github.com/oscarvalenzuela25/Nodia/pull/46)
integrada en development `d50dc414`; [PR47](https://github.com/oscarvalenzuela25/Nodia/pull/47)
integrada en master `03206aa1c9f9c5357d8bedcdd489cf33707c12a9`.
[CI43967669633](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43967669633)
y [CD43969486953](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43969486953)
completos y correctos. Logs saneados del CD registran backend/client complete
para ese SHA, operación backend8b4ba109… con deployment_performed:true,
publicación Client9f47f475… y10recursos PWA verificados en un intento.

Comprobación pública posterior: `GET https://166.0.112.187/api/v1/news` sin
credenciales, HTTP200 y TLS verificado normalmente. Respuesta con0artículos y
fuentes web-dev/node-js, sin último éxito o error registrados. El vacío inicial
es válido: no se ejecutó POST ni consumo externo durante esta consulta de estado.
No se deduce una actualización real del proveedor a partir de ese GET.

Primer pendiente real: desde la sesión super_admin, elegir cada fuente y efectuar
una intención explícita de actualización; verificar después su lectura pública,
permisos/UI reales y aceptación humana. Teléfono e inspección visual nativa200%
conservan los límites de§13. No repetir integración, promoción o despliegue ya
comprobados. Esta conciliación no modifica contratos, capacidades, herramientas
o aprobación de fichas/ADR; no acredita un recorrido humano por leer logs.

## 16. Renovación del catálogo de Noticias dev — 2026-11-18

El usuario solicita retirar web.dev y Node.js y buscar fuentes para Noticias
dev. `codex/dev-news-sources`, creada desde `development`, las sustituye en el
catálogo activo por The Go Blog, Rust Blog y Kubernetes Blog. Go y Rust cubren
Programación y Kubernetes, Tecnología. La [revisión de los feeds](../evidence/news-dev-source-refresh-20261118.md)
documenta publicaciones recientes, tamaños y atribución. También registra
GitHub Changelog, DEV Community, Hacker News y Hugging Face como candidatas.

El [contrato de lectura y actualización](../features/news/http-contract.md)
usa `catalog=2` para leer las fuentes nuevas. Las pestañas con Client anterior
reciben una página vacía válida mientras se publica el Client actualizado.
La actualización requiere una fuente explícita, sesión válida y `super_admin`
vigente. Se mantiene la lectura pública de caché, el enfriamiento de 15 minutos
y la retención lógica de siete días. Se muestran título, URL, fecha y procedencia.

La migración `1793750000000` amplía el CHECK sin tocar las filas históricas.
La API excluye las dos fuentes retiradas de lectura y actualización. Su caché
se conserva para una reversión de versión. El `down` restaura el CHECK anterior
y elimina sólo la caché nueva. CI incorpora la prueba de migración y autoridad HTTP de
Noticias sobre PostgreSQL desechable, con transporte controlado.

El resultado queda como antecedente del ensayo de fuentes. La selección para el
siguiente corte se recoge en §17.

## 17. Evaluación de conexiones personales con Forem y daily.dev — 2026-11-18

El usuario descarta Go, Rust y Kubernetes como próxima entrega y pide evaluar
Forem y daily.dev con una conexión propia por persona. El corte anterior queda
como evidencia de laboratorio. Esta evaluación propone un flujo de lectura
privada y requiere comprobar las capacidades con una cuenta de prueba.

| Fuente | Capacidad documentada | Primera prueba propuesta |
| --- | --- | --- |
| [Forem API v1](https://developers.forem.com/api/v1) | Clave personal en `api-key`; `GET /api/users/me` acredita identidad, `GET /api/follows/tags` expone etiquetas seguidas y `GET /api/readinglist` devuelve guardados. `GET /api/articles` admite filtrado de artículos públicos | Validar la identidad y leer etiquetas seguidas. Construir una selección acotada a partir de esas etiquetas y conservar título, URL original y procedencia. Identificarla como una selección que genera Nodia. Revisar el alcance de uso previsto bajo los [términos de DEV](https://dev.to/terms) |
| [daily.dev API](https://docs.daily.dev/public-api/) | `GET /feeds/foryou` entrega el feed personalizado de la cuenta. El PAT tiene alcance amplio; [OAuth](https://docs.daily.dev/oauth-apps/) permite consentimiento de sólo lectura por persona. El plan Free documenta 200 peticiones por 30 días, compartidas por cuenta | Aclarar cómo aplica la sección 18 de los [términos](https://daily.dev/tos/) a una sección de noticias de desarrolladores. Si el uso encaja, probar una conexión de sólo lectura vía OAuth y recuperar una página de `For You` |

Comprobaciones sin credenciales: Forem devolvió HTTP 200 con tres artículos
públicos filtrados por etiqueta y HTTP 401 al consultar la identidad. Las
lecturas de etiquetas seguidas y guardados devolvieron 429 en esa consulta.
`For You` de daily.dev devolvió HTTP 401. Los resultados documentan el transporte
y las respuestas observadas; la lectura autenticada queda pendiente.

La propuesta asocia cada conexión al usuario autenticado en Nodia y deriva la
propiedad en Server. El primer alcance se limita a lectura. Una clave guardada
se cifra en Server y la interfaz muestra su estado. La actualización se inicia
por acción explícita y respeta el límite del proveedor. La vista y cualquier
caché permitida quedan aisladas por usuario y por conexión. Al desconectar, se
retira el acceso y se limpia la caché asociada. La sección 18 de daily.dev limita
el uso en productos o funciones sustitutivas de su agregador, incluso con
credenciales individuales. La documentación de OAuth instruye cómo conectar
cuentas y el encaje de la función requiere revisión propia.

## 18. Plan de Noticias personales

> El usuario aprobó implementar este alcance el 2026-11-18 después de revisar
> el plan y mockup. DEV es la única fuente del piloto. daily.dev permanece
> pendiente del encaje bajo sus términos y de pruebas independientes de OAuth.
> El mockup usa estados y artículos de demostración. La [ficha candidata](../nodia-ai/knowledge/news/features/personal-connections.md)
> y [ADR110](../architecture/decisions/ADR-110-personal-news-connection-ownership.md)
> conservan sus estados de revisión documental.

### 18.1. Primera visita y acciones

1. Al entrar en `/news` con sesión válida, consultar en Nodia el estado de las
   conexiones y resultados conservados. Con cero conexiones, mostrar **Conecta
   una fuente para ver tus noticias** con tarjetas separadas para DEV Community
   y daily.dev. En este corte DEV ofrece la conexión si está configurado y
   daily.dev explica su estado pendiente. Se puede continuar sin conectar.
   El acceso anónimo conserva el contrato público de compatibilidad.
2. **Conectar** abre el formulario de la fuente elegida. La clave se oculta al
   escribir y se puede mostrar temporalmente con un control etiquetado. **Probar
   y conectar** hace una prueba autenticada mínima y guarda la conexión sólo al
   confirmar el resultado. El estado **Conectada** corresponde a esa prueba.
   En caso de error, mantener el formulario y el borrador. Si el error corresponde
   a la clave, enfocar su campo y asociarle el mensaje traducido.
3. Una vez conectada, la tarjeta ofrece **Probar conexión**, **Reconectar** y
   **Desconectar**. La prueba actualiza el estado de acceso. Reconectar valida
   la nueva clave antes de reemplazar la anterior. El reemplazo invalida los
   resultados previos, que pueden pertenecer a otra cuenta del proveedor.
   Desconectar exige confirmación,
   retira la conexión y sus resultados de Nodia y orienta a revocar la clave
   en el proveedor si la persona quiere retirarla allí también.
4. **Actualizar noticias** consulta la fuente seleccionada y distingue primer
   resultado, feed vacío y resultados anteriores. Entrar, cambiar filtros y
   volver a la vista sólo leen datos de Nodia. Cada acción externa se solicita
   explícitamente y afecta una sola fuente. Probar acceso y obtener noticias
   tienen estados propios y aislados por proveedor.

La vista conserva el shell y el theme de Client. En móvil, las tarjetas se
apilan y los botones principales ocupan el ancho disponible. La implementación
reutiliza `BaseModal`, los inputs compartidos, `ConfirmDialog` y Sileo con i18n
es/en. Validar al interactuar, asociar los errores al campo, anunciar cambios
de estado y devolver el foco al cerrar. Usar Boneyard sólo en la carga inicial
de datos y conservar resultados visibles al revalidar. Aplicar la
[matriz de modern-web-guidance](../../nodia-client/AGENTS.md#modern-web-guidance)
y el [perfil responsive](../../nodia-client/skills/responsive-design/references/nodia-profile.md).

### 18.2. Alcance por proveedor

| Fuente | Piloto | Qué verá la persona |
| --- | --- | --- |
| DEV Community (Forem) | `dev-community`, PAT de una cuenta de prueba. Validar con `GET /api/users/me`. Al actualizar, obtener las etiquetas seguidas con `GET /api/follows/tags` y consultar `GET /api/articles` con un presupuesto acotado de páginas y etiquetas. Verificar el uso de metadatos fuera del piloto local bajo los [términos de DEV](https://dev.to/terms) | **DEV Community · Según tus etiquetas**. La selección se arma en Nodia con artículos públicos. Si la cuenta carece de etiquetas seguidas, mostrar instrucciones para seguirlas en DEV |
| daily.dev | `daily-dev`, estado pendiente. Revisar el encaje de la sección 18 para Noticias y comprobar por separado la integración OAuth de sólo lectura con `GET /feeds/foryou` | **daily.dev · For You** es el feed personalizado documentado por el proveedor. La tarjeta del corte actual explica el estado pendiente |

Los PAT y OAuth pueden consumir cuota del proveedor. Validar con cuentas de
prueba en el flujo seguro local cuando exista. El usuario ya tiene ambas claves.
La persona introduce los PAT únicamente en el formulario seguro de Nodia. Referencias
[Forem API](https://developers.forem.com/api/v1), [daily.dev Public API](https://docs.daily.dev/public-api/),
[daily.dev OAuth](https://docs.daily.dev/oauth-apps/) y [daily.dev Terms §18](https://daily.dev/tos/#public-api).

### 18.3. Contrato y almacenamiento candidatos

| Operación bajo `/api/v1/news/personal` | Comportamiento |
| --- | --- |
| `GET /connections`, `GET /articles` | Devuelven al dueño estado, metadatos permitidos y resultados vigentes. Lectura local |
| `POST /connections/:provider` | Recibe `api_key` de sólo escritura para PAT, valida y crea o reemplaza la conexión del dueño |
| `POST /connections/:provider/test` | Prueba explícita de acceso de la conexión existente |
| `POST /connections/:provider/refresh` | Actualiza una fuente y devuelve un resultado con semántica propia de caché y de consulta externa |
| `DELETE /connections/:provider` | Elimina credencial y caché asociadas en una transacción e invalida reservas en vuelo |

- Los handlers privados derivan el dueño de una sesión válida y activa. Server
  consulta y escribe por `user_id` y proveedor permitido. Una sesión ordinaria
  opera sus fuentes personales. `super_admin` conserva su validación propia en
  el handler de compatibilidad pública.
- `1793760000000-PersonalNewsConnections` agrega `news_personal_connections`
  con FK al usuario, unicidad por dueño/proveedor y versionado de credencial.
  La llave opcional `NEWS_PERSONAL_ENCRYPTION_KEY` de 32 bytes se entrega como
  64 caracteres hexadecimales sólo a Server. Con la llave ausente, DEV queda
  inhabilitado para el piloto. El cifrado AES-256-GCM vincula usuario, proveedor
  y versión a la credencial cifrada. El PAT se envía por TLS y se descarta del
  formulario al guardar, cancelar o cambiar de sesión. Server lo descifra al
  efectuar la acción autenticada que lo necesita.
  La API responde sólo con disponibilidad, máscara fija y metadatos autorizados.
  Sanear logs, traces, errores y diagnósticos. Excluir credenciales y resultados
  privados de cachés compartidas, persistencia en el navegador, CDN y service worker.
- Fijar destinos y permisos por adaptador. Acotar páginas, etiquetas, tamaño de
  respuesta, tiempo total y concurrencia. Persistir sólo metadatos permitidos
  con vigencia finita y enlace al original. Ajustar retención a las condiciones
  de cada proveedor antes de activar caché y excluir vencidos desde la lectura.
  Usar `Cache-Control: private, no-store` en respuestas privadas. Al cerrar sesión
  o cambiar de cuenta, vaciar el estado privado del Client y descartar respuestas tardías.
- Coordinar el consumo con una reserva por conexión en SQL y un presupuesto
  explícito por operación. La red corre fuera de la transacción. Finalizar sólo
  si la reserva y la versión de credencial siguen vigentes. Así reconectar o
  desconectar invalida una actualización en vuelo, incluso entre procesos.
- Una clave inválida o revocada requiere reconexión y retira el acceso a su
  snapshot. Un fallo de red, 5xx o 429 conserva los resultados vigentes con fecha
  del último éxito y estado claro. Respetar `Retry-After` válido. Cuando el
  proveedor omita el dato, aplicar un enfriamiento local identificado como tal.
  El reintento de una mutación queda disponible por acción explícita tras la
  ventana aplicable. Una respuesta válida sin artículos muestra el estado vacío.

### 18.4. Secuencia y comprobaciones de entrega

| Paso | Salida y criterio de avance |
| --- | --- |
| NEWS-P01 · Revisar propuesta | Alcance aprobado para implementar el circuito personal con piloto DEV. La revisión de metadatos fuera del piloto y la habilitación de daily.dev conservan sus propios criterios |
| NEWS-P02 · Server y migración | Agregar persistencia, adaptador Forem, endpoints y política de dueño. Probar con transporte controlado y PostgreSQL desechable, desde cero y desde un esquema representativo poblado. Validar cifrado/redacción, dos usuarios con el mismo proveedor, sesión expirada, cuota, resultado vacío, errores, doble clic y carrera con reconexión/desconexión |
| NEWS-P03 · Client y piloto | Implementar la vista tras sesión válida. Probar modo claro/oscuro, teclado, móvil y desktop, cambio de cuenta y estado pendiente de daily.dev. Medir que primera entrada y filtros generan cero peticiones a proveedores. Verificar en laboratorio que una cuenta de prueba conecta, obtiene una selección por sus etiquetas y desconecta. Registrar resultado por operación con evidencias saneadas |
| NEWS-P04 · CI y CD | Antes del PR a `development`, revisar el diff contra el catálogo efectivamente desplegado, el ledger y el empaquetado. Cerrar el gate con el SHA exacto en `development` antes de promover. Al pasar a `master`, verificar CI, CD, salud de API, ledger previsto y smoke autenticado controlado. Adoptar daily.dev sólo después de su validación propia |

La migración de Noticias personales agrega una tabla inicialmente vacía.
La versión previa de Server debe funcionar con el esquema ampliado, y Client
se publica después de comprobar Server y migración. La entrega retira web.dev
y Node.js del catálogo activo y de las actualizaciones. `GET /api/v1/news`
mantiene el paginado y devuelve `items: []` y `sources: []` para clientes sin
catálogo o con `catalog=2`. El POST público histórico conserva la autoridad
administrativa y devuelve un código de fuente retirada. Consultar el
[contrato exacto](../features/news/http-contract.md#compatibilidad-de-la-capa-pública).
La caché histórica queda fuera de lectura y las noticias de una cuenta sólo
aparecen en su lectura autenticada.

La migración del ensayo Go/Rust/Kubernetes `1793750000000` quedó fuera de la
entrega personal. Se comprobó en transacciones de sólo lectura que no figura
en los ledgers locales de `nodia_postgres` y `nodia-business-feedback-pg`.
Las referencias remotas registradas localmente no contienen el commit del
ensayo `d373920e`. Su historia y [evidencia de laboratorio](../evidence/news-dev-source-refresh-20261118.md)
se conservan junto con las migraciones históricas aplicadas.

En el gate de esquema, ejecutar el actualizador real del CD en un ambiente
aislado con los artefactos de la entrega y comprobar migraciones, esquema y
compatibilidad con la API anterior. Simular también un fallo anterior a la
migración: la API anterior debe volver automáticamente, el ledger debe conservar
las mismas migraciones y el CD debe seguir bloqueado si R2 queda incierto.
Seguir la [recuperación por fase](99-production-deployment-and-cicd-plan.md#36-continuidad-del-servicio-y-reintento-por-fase)
y la [guía de entrega de Noticias](../features/news/deployment-readiness.md).

La comprobación documental de conocimiento valida 98 fuentes registradas,
54 excluidas, 44 documentos y 46 fragmentos. El párrafo de autoridad en
[Plan89](89-module-access-and-user-data-scope.md#noticias-personales--alcance-de-implementación-aprobado-el-2026-11-18)
cambia exclusivamente el hash de procedencia de siete entradas del manifiesto.
Reponer el hash previo sólo en memoria reproduce el identificador anterior.
Los cuerpos y las aprobaciones permanecen con sus valores históricos. La
ficha personal queda en borrador fuera del registro de publicación.

### 18.5. Implementación y verificación local

El circuito personal quedó implementado en `codex/dev-news-sources` con DEV
Community como proveedor del piloto. La vista acepta el PAT en el formulario
autenticado y el Server sólo habilita DEV con su llave dedicada. daily.dev
queda pendiente de sus condiciones y de una validación OAuth propia.

| Comprobación | Resultado en laboratorio |
| --- | --- |
| Client | Suite completa con 3 323 pruebas en 410 archivos, 50 pruebas focales de News, lint y build correctos |
| Navegador | Chromium con Vite en `/news` y respuestas de API sintéticas a 1 440 y 390 px. Se verificó el cambio de tema a 390 px y el diálogo sin desborde con foco inicial a 320 px. Se comprobó campo enmascarado, cierre con Escape, conservación de la entrada tras rechazo del proveedor, asociación del error mediante ARIA, acciones de proveedor explícitas y ausencia de persistencia en navegador |
| Server | Build y lint correctos, con una advertencia previa de lint. La pasada principal registró 6 211 pruebas correctas en 370 suites y una omisión en Windows. Una suite ajena a Noticias coincidió con la reescritura del manifiesto y pasó luego en una corrida focal separada de 136 pruebas |
| HTTP y PostgreSQL 16 | Seis grupos con Server compilado y base desechable. Se comprobó cifrado, aislamiento de dos dueños, sesiones, conservación de caché al fallar una reconexión, límites y revocación, descarte del refresh tardío al desconectar, cierre con llave ausente y protección del `down` con datos. La suite de instalación registró 47 pruebas correctas |
| Actualizador de producción aislado | `update-backend-action` ejecutado en Linux con UID 900, red Docker interna y PostgreSQL con TLS `verify-full`, artefactos compilados y manifiestos de prueba. `inspect` comprobó estado quiescente, ledger 58 y objetivo 59. `migrate` aplicó una migración y comprobó las columnas persistentes de 77 entidades. `verify` comprobó el ledger objetivo y 0 pendientes. Rechazó repetir `migrate`, conservó la fila histórica y dejó la tabla nueva vacía |
| Fallo de respaldo en systemd aislado | 36 comprobaciones correctas. Con `recovery_write_unknown` sintético de R2, la API pasó de HTTP 503 a 200 con los mismos procesos, los timers se restauraron y el CD siguió bloqueado. El resultado SQL era simulado y no se solicitó una migración (`migration_requested: false`) |

Forem respondió HTTP 200 con tres resultados en una consulta pública de
`/api/articles` con varias etiquetas. Sigue pendiente conectar una cuenta de
prueba con su PAT, recuperar su selección y desconectar en el flujo local.
El acceso con cuenta real, la apertura del PR, los gates de CI del SHA final
y la adopción por CD quedan pendientes. La revisión de uso más amplio de los
metadatos de DEV conserva su propio criterio. Seguir [NEWS-001 en TODO](TODO.md#cola-actual).

El piloto local quedó disponible en `http://localhost:5174/news`. La base
`nodia_feedback` de pruebas avanzó de 58 a 59 con una sola migración aplicada
y las columnas de la tabla nueva verificadas. El Server reiniciado escucha en
loopback y tiene habilitada su llave dedicada. Una sesión temporal revocada al
terminar comprobó HTTP 200 en conexiones y artículos a través del proxy local,
con DEV disponible para conectar y daily.dev pendiente. Esta comprobación
leyó sólo el estado local, sin enviar credenciales ni consultar proveedores.

### 18.6. Portadas y paneles plegables

La vista autenticada presenta noticias en tarjetas con el título, procedencia,
fecha disponible y portada cuando DEV la entrega. El campo opcional
`cover_image_url` admite únicamente HTTPS de `media2.dev.to`. Server conserva
la URL en el snapshot JSONB. Client solicita la imagen sin referer y conserva
una tarjeta con icono cuando falta la portada o falla la carga. La próxima
actualización explícita incorpora portadas a la lectura según lo que devuelva
el proveedor. El cambio es compatible con los snapshots anteriores y se aplica
sin una migración de esquema.

**Tus fuentes** y **Tu lectura** empiezan expandidas y pueden plegarse de forma
independiente con ratón o teclado. Los paneles conservan su estado de lectura y
el filtro de fuente durante la visita. Plegar y reabrir son acciones locales de
la interfaz. El [contrato HTTP](../features/news/http-contract.md#operaciones-personales)
y el [diseño editorial](../features/news/editorial-design.md) describen estas
garantías.

El piloto recibió portadas en 17 de 24 artículos de una consulta pública
de comprobación a Forem. En Chromium se probaron tarjetas con portada, sin
portada y con un fallo de imagen, más los paneles independientes con teclado
a 1 440 y 320 px. El recorrido no volvió a pedir las listas ni emitió mutaciones
al plegar y reabrir los paneles. Pasaron 62 pruebas de Client para News, las
pruebas del adaptador y la lectura de snapshots con y sin portada por HTTP
en PostgreSQL desechable. El Server local reiniciado atendió `/news/personal`
con la conexión DEV existente disponible y el ledger local en 59.

### 18.7. Tarjetas enlazadas y filtro por tema

Toda la tarjeta de una noticia enlaza al artículo original. El enlace usa el
título como nombre accesible, conserva el foco visible y abre en otra pestaña.
**Tu lectura** combina el filtro de fuente con el tema seleccionado.

La actualización guarda las etiquetas que devuelve Forem como el campo opcional
`tags` del snapshot existente. Client agrupa etiquetas afines en Frontend,
Backend, DevOps e IA. También permite seleccionar etiquetas individuales de la
lectura cargada. Un artículo puede coincidir con varios temas. Filtrar se
resuelve localmente y no consume el proveedor. Las opciones reflejan las
etiquetas de la fuente seleccionada. Si un snapshot de DEV no tiene etiquetas,
**Tu lectura** mantiene visibles todos sus artículos y ofrece **Actualizar DEV**
en lugar del selector de tema. Esa acción explícita incorpora los metadatos
disponibles sin migración SQL.

Consultar el [contrato HTTP](../features/news/http-contract.md#operaciones-personales)
y el [diseño editorial](../features/news/editorial-design.md).

La consulta pública de prueba devolvió `tag_list` y `tags` en los seis artículos
de la muestra. Chromium comprobó clic sobre la portada y Enter sobre la misma
tarjeta. Probó los cuatro grupos, una etiqueta individual y conservación del
filtro al plegar a 1 440 px y verificó el layout a 320 px. El filtro de tema no
provocó nuevas lecturas ni mutaciones. La prueba HTTP de PostgreSQL desechable
recuperó snapshots con y sin etiquetas. Tras reiniciar el Server local,
conexiones y artículos respondieron HTTP 200 con una sesión temporal.

### 18.8. Piloto personal local de daily.dev

El usuario autorizó incorporar daily.dev como piloto de lectura personal e
interna para una sola persona en una instancia local de desarrollo. El piloto
se plantea bajo el supuesto de uso personal de §18.2(i) y toma como referencia
el lector manual del CLI oficial. La licencia, el permiso para un producto
distribuido y la integración de varias cuentas conservan su evaluación propia.
[Términos §18](https://daily.dev/tos/#public-api),
[CLI oficial](https://docs.daily.dev/daily-dev-from-your-terminal/),
[OAuth apps](https://docs.daily.dev/oauth-apps/).

- **Acceso de un dueño.** Server habilita `daily-dev` únicamente con
  `NODE_ENV=development`, la llave `NEWS_PERSONAL_ENCRYPTION_KEY` válida y el
  ID del actor vigente igual a `NEWS_DAILY_DEV_LOCAL_OWNER_ID`. El piloto se
  prueba en la instancia local. Las demás sesiones y entornos conservan estado
  pendiente y quedan fuera de su lectura y acciones. El PAT se introduce en
  el formulario protegido y se cifra por persona, proveedor y versión.
- **Lectura breve.** Conectar o probar verifica el perfil mediante `GET
  /public/v1/profile/`. Una actualización explícita admitida consulta una sola
  página `GET /public/v1/feeds/foryou?limit=10` con el PAT
  de ese dueño. Al elegir daily.dev en **Tu lectura**, la vista **Para ti de
  daily.dev** identifica la procedencia y enlaza a la publicación original.
  Conserva únicamente metadatos mínimos durante una ventana de lectura de
  hasta 60 minutos. El contrato excluye cuerpo, resumen, enriquecimientos y
  resultados de la lectura de DEV. La vista tiene su propio filtro de tema
  local cuando el resultado incluye etiquetas. La primera visita, los filtros
  y el cambio de fuente sólo leen datos locales.
- **Esquema y entrega.** `1793770000000-AllowDailyDevPersonalPilot` amplía los
  proveedores admitidos en `news_personal_connections` de forma aditiva. Se
  preservan las migraciones aplicadas y las conexiones existentes. Repetir
  instalación limpia, upgrade poblado, esquema y protección del `down` en
  PostgreSQL aislado antes de atribuir el nuevo corte al paquete. La
  [guía de entrega](../features/news/deployment-readiness.md#piloto-local-de-dailydev)
  separa estas pruebas del gate real de CI/CD.

#### Verificación local del piloto

El candidato local incorpora adaptador, vista por fuente y migración nueva.
El build de Client y las 72 pruebas de News pasaron. Chromium verificó el
formulario con un PAT simulado, la conservación del borrador y el foco, las
lecturas y filtros temáticos separados, la vista a 320 px y la ausencia de
persistencia de la clave en el navegador. Entrar no disparó actualización.

Pasaron el build de Server, 19 pruebas focales y los grupos HTTP con Server
compilado y PostgreSQL desechable. Se comprobó la migración aditiva, la
protección de reversión con filas daily.dev, la restricción por dueño y
entorno, el cifrado separado y la exclusión de daily.dev en la lectura sin
filtro. La habilitación técnica corresponde a la instancia local. El acceso
con PAT real y el plan efectivo de la cuenta tienen su propia verificación.

La suite de instalación completó 47 comprobaciones. El actualizador SQL real
ejecutado en Linux aislado con TLS avanzó el ledger de 59 a 60, aplicó una
migración, comprobó las tablas de 77 entidades y registró cero pendientes.
Rechazó repetir la migración y conservó la fila histórica y el cifrado de
DEV. El ensayo systemd aislado también pasó sus 36 comprobaciones. Ante R2
incierto simulado, la API volvió a HTTP 200, se restauraron los timers y el
CD siguió bloqueado. El ensayo no solicitó una migración.

La base de pruebas local `nodia_feedback` avanzó de 59 a 60 y conservó el
cifrado y la versión de la conexión de DEV. En `http://localhost:5174/news`, la
vista y las lecturas privadas de conexiones y artículos con sesión de prueba
respondieron HTTP 200. DEV quedó conectado. daily.dev apareció disponible y
sin conexión para el dueño configurado. Una lectura privada sin sesión recibió
HTTP 401. La primera lectura real de daily.dev requiere introducir el PAT en
el formulario local. PR, CI y CD del SHA final conservan sus propios gates.

Una futura entrega en cloud, a varias personas o como agregador requiere una
evaluación nueva de términos y permisos, más la validación de OAuth de sólo
lectura. La evidencia de los cortes DEV anteriores se conserva en §18.5–§18.7.
