# Noticias de tecnología, programación e IA bajo demanda

> Seguimiento de implementación futura: `NEWS-001` en [TODO central](TODO.md).
> La especificación, opciones y diseño se retoman desde este plan y sus dependencias.

> Estado: en revisión; investigación y propuesta del 2026-11-15.
> Confirmado: el usuario quiere entrar a una sección y obtener noticias mediante
> un botón; temas elegidos: tecnología, programación e IA.
> Implementación e integración: pendientes. La selección de fuentes y el alcance
> siguiente son recomendaciones, sin aprobación documental ni operación real.
> Trabajo trasladado el 2026-11-15 a `codex/news-section-design`, creada desde
> `origin/development` actualizado en `4e73a1ed`. Los siete archivos iniciales
> se comprobaron byte a byte antes de continuar la revisión.

## 1. Experiencia propuesta

Una sección **Noticias**, con destino canónico candidato `/news`, independiente
del grupo del menú conforme a [ADR092](../architecture/decisions/ADR-092-stable-module-navigation-routes.md).
La key, alta del módulo y sus asignaciones quedan por definir; esta ruta no existe
por escribirla aquí. Aplicar [autoridad89](89-module-access-and-user-data-scope.md).

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

Consulta documental: 2026-11-15. No se usaron credenciales ni se probaron cuentas.
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
  sidenav, topbar, tema y navegación móvil. Propuesta visual, sin UI productiva.
- [ ] Resolver acceso efectivo, condiciones/retención y conexión personal frente
  a multiusuario; elegir catálogo inicial de fuentes y temas concretos.
- [ ] Definir autoridad, entidades/DTOs, caché, límites y ADR si corresponde;
  contrastar contratos con backend antes de construir formularios/componentes.
- [ ] Implementar una fuente de extremo a extremo: entrar sin consumo externo,
  actualización explícita, tarjetas reales y enlace original.
- [ ] Añadir RSS y probar deduplicación y fallos parciales sin borrar resultados.
- [ ] Verificar unidades de normalización/fechas/dedupe y política de consumo;
  integración aislada para ámbito, revocación, concurrencia y caché.
- [ ] Probar respuesta vacía/inválida, datos ausentes, servicio caído, 401/403/429,
  timeout, doble clic/dos pestañas, selección obsoleta y configuración histórica.
- [ ] Verificar UI ES/EN móvil/escritorio, reintento y errores sin perder contenido;
  comprobar cuenta real y fuentes seleccionadas con evidencia separada.

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
