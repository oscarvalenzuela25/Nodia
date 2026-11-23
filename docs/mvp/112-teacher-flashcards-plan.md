# Tarjetas de repaso de Nodia Teacher

> Borrador de producto del 2026-11-22. El usuario aceptó el mockup
> revisado y solicitó iniciar la implementación. La generación de
> imágenes en Teacher conserva su verificación pendiente.

Teacher ya admite tarjetas manuales y calificación de repaso dentro
de una sesión. La propuesta amplía esa base con mazos personales
entre sesiones, generación y medios. El contrato inicial debe definir
cómo conservar las tarjetas y las marcas existentes.
[Repaso actual de Teacher](97-nodia-teacher-technical-contracts.md#enriquecimiento-comandos-y-consultas).

## Recorrido propuesto

**Tarjetas de repaso** sería una tercera pestaña de Teacher, junto a
**Mis planes de estudio** y **Calendario de estudio**. La persona organiza
sus tarjetas en **Mazos** y puede repasar juntos fragmentos de distintas
sesiones. Cada tarjeta pertenece a un mazo. **General** recibe las
tarjetas cuando la persona omite el mazo y permite moverlas después.

| Entrada | Recorrido |
| --- | --- |
| **Nueva tarjeta** | Escribir la pregunta y la respuesta. Elegir un mazo y, si se desea, subir una imagen o agregar una fuente. |
| **Generar desde apuntes** | Pegar contenido, elegir el mazo y revisar las tarjetas propuestas. Cada propuesta generada incluye una ilustración por defecto. Se pueden editar y seleccionar las tarjetas que se guardarán. |
| **Crear flashcard** desde la lección | Seleccionar un fragmento en la lectura y abrir el editor con la propuesta de pregunta, respuesta e imagen. La tarjeta conserva la procedencia y un acceso al fragmento cuando sigue disponible y autorizado. |

**Generar propuestas** se habilita al ingresar texto en los apuntes.
Un campo vacío o compuesto por espacios mantiene la acción deshabilitada.
Cuando la entrada contiene sólo títulos, el flujo pide apuntes o una
fuente con contenido para construir las respuestas. El recorrido desde
la lectura aprovecha las anclas y la selección de las [aclaraciones de
Teacher](106-nodia-teacher-guided-ux-redesign.md#18-lectura-y-aclaraciones-por-tópico--2026-11-17).
El contrato debe distinguir selecciones repetidas dentro del mismo
bloque. Si se pierde la posición exacta, puede mostrar la cita mientras
la persona conserve acceso a la fuente.

## Imágenes

- La imagen es parte de la propuesta al generar una tarjeta automática.
  La persona puede cambiarla por una subida desde su equipo o teléfono.
  La creación manual permite una imagen subida como campo opcional.
- Como propuesta de presentación, la imagen va con la pregunta cuando
  aporta una pista útil o con la respuesta cuando revela lo que se quiere
  recordar. La presentación debe conservar un equivalente textual para
  cualquier información necesaria.
- El editor muestra el resultado de texto e imagen por separado. Si
  falla la imagen, conserva la propuesta de texto y ofrece reintentar esa
  parte, subir una imagen o guardar el texto por decisión explícita.
- La vista previa iguala la altura del bloque **Subir imagen** y
  **Mostrar imagen**. Las fotos horizontales, verticales y de gran tamaño
  se ajustan dentro de ese espacio. Si un archivo falla, el editor
  conserva la imagen previa y el borrador, y muestra el error junto a
  los controles.
- Las imágenes guardadas quedan vinculadas al propietario y a la tarjeta.
  El diseño técnico debe precisar tipos admitidos, límites, autorización
  de lectura, sustitución y limpieza de archivos privados.

La [generación de imágenes de NodiaAI](../nodia-ai/knowledge/nodia-ai/features/image-generation.md#integración-y-evidencia)
tiene evidencia por selección de Codex y Antigravity Agentic dentro
del chat. Teacher requiere validar su propia selección, salida de imagen
y persistencia privada. El carril de imágenes por API key conserva el
aplazamiento de [Plan92](92-nodia-ai-api-chat-parity.md). El texto y la
imagen dependen de capacidades comprobadas para las selecciones exactas.

## Menú de cada tarjeta

El botón de tres puntos abre las acciones de forma independiente de la
tarjeta. **Editar** permite cambiar pregunta, respuesta, imagen y mazo.
**Regenerar** permite elegir texto, imagen o ambos. La propuesta parte de
la versión guardada y, cuando corresponde, de su fuente autorizada.
Regenerar una imagen puede partir del contenido textual actual. Usar
una imagen como referencia requiere una capacidad verificada por separado.

La persona revisa la propuesta y confirma qué aplicar. Cerrar, cancelar
o recibir un error conserva la tarjeta guardada y su mazo. La regeneración
de una parte conserva la otra. La definición técnica debe precisar cómo
registrar el repaso cuando cambia el contenido de la tarjeta.

**Eliminar** solicita confirmación con la pregunta y el mazo de la
tarjeta. La confirmación retira la tarjeta del mazo y del repaso.
El contrato de persistencia debe precisar el tratamiento del historial
y la limpieza de la imagen vinculada.

## Repaso móvil

Elegir un mazo y mostrar una tarjeta a la vez. La vista presenta primero
la pregunta y una acción **Mostrar respuesta**. Después ofrece **La
recordé** y **Repasar de nuevo** con controles táctiles y navegación por
teclado. Las marcas de repaso pertenecen a la tarjeta y el sistema de
evaluaciones de Teacher conserva su contrato. Definir cómo extender a
mazos la política de intervalos de sesión y conservar el historial antes
de publicar la programación de próximos repasos.

## Mockup navegable

La vista de revisión de esta conversación recorre **Mazos**, **Desde
apuntes**, **Desde una lección** y **Repaso móvil**. Permite crear un mazo
o una tarjeta manual, elegir cuáles guardar de un lote, subir o cambiar
una imagen, y volver al fragmento de ejemplo. El menú de tres puntos
permite editar y comparar la tarjeta guardada con la propuesta.

Chromium verificó la biblioteca de escritorio y el repaso a 320 px.
Se probaron General como destino por defecto, archivo local, selección
de tarjetas, retorno a la lección tras guardar, cancelación y aplicación
de una regeneración, y reintento de imagen tras un fallo simulado. La
muestra usa ejemplos locales. Su alcance es la interacción y no amplía
los contratos ni las herramientas de NodiaAI.

La segunda revisión comprobó a 1024 y 320 px el botón de generación
con texto vacío, con espacios y con contenido. Se verificaron la
confirmación de eliminación, el recuento del mazo y la altura compartida
de la vista previa y sus controles con fotos horizontales y verticales.
Un archivo dañado o de tipo distinto conservó la imagen y el texto
del editor.

## Primer corte nativo

La biblioteca usa el recurso `/api/v1/teacher/flashcards` bajo la
autoridad de Teacher. Las tarjetas manuales por sesión conservan su
flujo. La procedencia nueva contiene la sesión, versión, bloque y cita.
El enlace abre la sesión autorizada. El salto exacto al fragmento
requiere un localizador que preserve el cursor.

Los mazos, la tarjeta manual, la subida privada, la edición, la
eliminación confirmada y el repaso forman el primer recorrido.
Preparar una tarjeta desde la lección permite guardar la cita y editar
los campos manualmente. La carga de imagen usa una miniatura WebP de
hasta 144 KiB. Los apuntes y la regeneración seguirán el contrato de
generación que se califique para Teacher.

La generación de borradores requiere un propósito propio con selección
explícita, admisión, presupuesto y recuperación. El runtime actual de
Teacher vincula las generaciones a una sesión y a publicaciones
específicas. Los apuntes y la regeneración de tarjetas de la biblioteca
requieren diseñar ese alcance independiente. Las imágenes generadas
requieren su propia calificación y almacenamiento.
[ADR propuesto](../architecture/decisions/ADR-117-teacher-flashcard-library.md).

### Contrato local

| Operación bajo `/api/v1/teacher/flashcards` | Datos y efecto |
| --- | --- |
| `GET decks`, `POST decks` | Mazos del propietario, incluida la vista virtual **General**. El alta guarda un título personal. |
| `GET cards` | Páginas de 12 tarjetas por mazo. Incluye metadatos de imagen y procedencia, con el ancla omitida cuando la fuente deja de ser accesible. |
| `POST cards`, `PATCH cards/:id` | Alta con clave de solicitud. Edición de contenido, fuente, imagen o mazo con revisión vigente. |
| `GET cards/:id/image` | Miniatura WebP privada, sin caché compartida. La lectura comprueba propiedad y acceso a Teacher. |
| `POST cards/:id/reviews` | Guarda una marca por clave de solicitud. El repaso avanza al recibir la confirmación. |
| `DELETE cards/:id` | Elimina imagen y marcas de la biblioteca en la misma transacción. Conserva un recibo mínimo para evitar recreaciones por reintento. |

El repaso por mazo revela la respuesta y registra si la persona la
recordó. Las marcas no programan próximos repasos. Las tarjetas y el
historial que ya existen dentro de las sesiones conservan su flujo.
El primer corte se puede probar localmente bajo el acceso de Teacher.

La prueba integrada de selección en una lección, con Chromium, Nest y
PostgreSQL aislado, verificó la cita exacta, el guardado explícito en
General, la vuelta del foco y el cursor de lectura intacto. El enlace
guardado abre la sesión de origen. La ubicación exacta de la cita y
la distinción de ocurrencias repetidas quedan pendientes.

### Verificación local del 2026-11-22

- Client y Server compilaron. Pasaron las pruebas de Teacher en Client
  y la validación del registro de conocimiento. La ficha sigue siendo
  candidata y queda fuera de la publicación.
- La [suite HTTP y PostgreSQL](../../nodia-server/test/teacher-flashcards.integration.mjs)
  verificó migración de ida y vuelta con una tarjeta heredada, propiedad
  de mazos y bytes, citas válidas y guardia de evaluación final, revisión
  y reintentos idempotentes, junto con eliminación de bytes y marcas.
  Se ejecuta desde Server con `npm run test:teacher:flashcards`.
- Chromium usó Nest y PostgreSQL aislados para verificar la creación
  de un mazo, el guardado manual en General, la subida de una imagen
  grande, su portada al recargar, la conservación de la imagen previa
  tras un reemplazo dañado, edición, confirmación de borrado y
  persistencia del repaso. El recorrido móvil en inglés comprobó la
  revelación a 320 px y objetivos táctiles de 44 px.
- La validación de WebP acepta el perfil de color de Chromium en
  archivos estáticos acotados. La rama está servida en local con
  la migración `CreateTeacherFlashcards1793900000000`.

## Secuencia para retomar

- [x] Revisar el mockup móvil de Mazos, editor con imagen y repaso, incluido
  el recorrido desde una selección de la lección.
- [x] Implementar propiedad, biblioteca manual, subida privada, menú,
  repaso por mazo y procedencia desde la lección. Mantener las tarjetas
  y las marcas de las sesiones en su recurso existente.
- [x] Añadir la importación JSON revisable para una tarjeta o un mazo.
- [x] Incorporar el propósito de propuestas de texto para citas de
  lección y tarjetas con esa procedencia.
- [ ] Calificar la propuesta de texto desde una lección por selección
  exacta y comprobar la inferencia real en el entorno autorizado.
- [x] Incorporar la admisión, el presupuesto y las propuestas de
  biblioteca para apuntes y tarjetas con o sin lección.
- [ ] Calificar la conexión, modelo, esfuerzo y clave del carril de
  imagen en el entorno autorizado. Verificar inferencia real por alcance.
- [ ] Resolver la ubicación exacta de la cita y definir la continuidad
  con las tarjetas y el repaso programado de sesión.
- [ ] Añadir la generación interna por lote desde apuntes con estado
  por tarjeta. Fijar su tamaño, presupuesto y recuperación.

## Importación JSON y propuestas de texto

**Importar tarjetas** permite copiar dos instrucciones para un LLM externo,
una para una tarjeta y otra para un mazo. El formato v1 admite JSON
plano o un solo bloque de código JSON. Se puede revisar el contenido,
marcar qué tarjetas importar y elegir el destino antes del guardado.
El nombre y la categoría opcional se usan al crear un mazo. **General**
es el destino inicial al omitir el mazo. Una categoría es un nombre
opcional del mazo personal y se puede usar para filtrar los mazos.
El importador admite hasta 30 tarjetas y
el guardado tiene un límite de 200 KiB de JSON serializado en UTF-8.

```json
{
  "version": 1,
  "deck": { "title": "Inglés inicial", "category": "Idiomas" },
  "cards": [
    {
      "question": "¿Cuándo uso «an»?",
      "answer": "Antes de un sonido vocálico, como en «an apple».",
      "source": "Apuntes de artículos"
    }
  ]
}
```

El objeto `deck` y el campo `source` son opcionales. Las tarjetas
importadas conservan una fuente de texto cuando se incluye. Para añadir
una imagen se usa el editor de la tarjeta con un archivo local.
Previsualizar no envía una solicitud de escritura ni llama a un modelo.
El POST confirmado `/api/v1/teacher/flashcards/imports` admite destino
existente o nuevo. Guarda mazo, tarjetas en el orden revisado y recibo
en una transacción. El mismo recibo confirma un reintento sin duplicar
las tarjetas. Una clave con distinto contenido da conflicto.

Al seleccionar una cita en una lección, **Generar propuesta de texto**
muestra la conexión, modo, modelo y razonamiento de esa sesión.
La solicitud registra el propósito `flashcard_text` con la selección
exacta y usa el presupuesto y el Worker de Teacher. El acceso a la
cita y la ausencia de una evaluación final activa se vuelven a
comprobar durante el recorrido. **Regenerar texto** usa el mismo
contrato con la revisión actual de una tarjeta que tenga una cita
accesible. La pregunta y respuesta actuales y la cita sustentan la
propuesta.

El POST de generación admite una intención y devuelve 202. Las lecturas
por id de trabajo o clave de solicitud recuperan su estado. Una respuesta
perdida se concilia por GET. Las propuestas listas se pueden poner en
el editor, ajustar y guardar por acción expresa. La preparación no
modifica la tarjeta, la imagen guardada ni el punto de lectura.

El recorrido de sólo texto con selección de la lección se mantiene
junto a las [propuestas de la biblioteca](#propuestas-de-texto-e-imagen-en-la-biblioteca).

### Verificación local del 2026-11-23

- [Integración de importación](../../nodia-server/test/teacher-flashcards.integration.mjs).
  Nest y PostgreSQL verificaron propiedad, orden, un solo efecto ante
  concurrencia, rechazo de replay con contenido cambiado y rollback
  completo ante un fallo de inserción. La reversión de la migración
  se habilita cuando las categorías y recibos todavía están vacíos.
- [Integración de propuesta](../../nodia-server/test/teacher-flashcard-generation.integration.mjs).
  Nest, PostgreSQL y el Worker probaron admisión, presupuesto, cierre,
  relectura sin reenvío, evaluación final activa y revisión obsoleta
  con transporte de prueba. No hubo inferencias reales.
- Chromium verificó la revisión previa al POST y el mazo categorizado.
  Probó también la propuesta y la regeneración de texto desde el menú
  usando los endpoints de Teacher y una publicación de prueba. El
  cursor permaneció intacto y sólo las confirmaciones modificaron
  la biblioteca.

[Calendario de estudio](111-teacher-study-calendar-plan.md) ·
[Ficha candidata de tarjetas](../nodia-ai/knowledge/studies/features/flashcards.md) ·
[Cola de entregas](TODO.md#cola-actual).

## Propuestas de texto e imagen en la biblioteca

**Generar desde apuntes** admite hasta 8000 bytes UTF-8 de contenido.
**Crear flashcard** desde una cita usa el fragmento vigente y conserva
el origen al guardar. En ambos casos la propuesta ofrece pregunta,
respuesta y, si se selecciona, una ilustración. Se prepara una tarjeta
por intención. El menú de los tres puntos permite regenerar **Texto**,
**Imagen** o **Texto e imagen** usando la revisión guardada.

El editor muestra cada resultado en una vista previa. La persona elige
qué partes usar, puede ajustarlas o subir otra imagen y guarda de forma
explícita. Cuando falla la imagen, el texto listo permanece disponible.
La imagen se puede mostrar con la pregunta o con la respuesta. El
repaso y el progreso de la tarjeta siguen sus operaciones existentes.

| Ruta bajo `/api/v1/teacher/flashcards/proposals` | Efecto |
| --- | --- |
| `POST /` | Admite por clave inmutable, origen, parte solicitada y selección exacta por parte. Devuelve 202 con el identificador. |
| `GET /eligibility` | Comprueba la tupla elegida para texto o imagen. Es una lectura de configuración y evidencia. |
| `GET /:id`, `GET /requests/:key` | Recupera estados y resultado de texto por propietario. Revalida procedencia y revisión vigentes. |
| `GET /:id/image` | Entrega la miniatura WebP privada de una imagen lista y vigente. |

El [ADR-118](../architecture/decisions/ADR-118-teacher-flashcard-proposal-execution.md)
define presupuesto, slots compartidos y retención. El modelo de texto
y el de imagen se eligen explícitamente. El carril inicial de biblioteca
usa API key. La calificación con el comando
`scripts/qualify-teacher-flashcard-image.mjs` requiere un operador,
sesión vigente y selección exacta. La prueba envía la descripción
sintética fija de una figura y exige cierre y reconocimiento durables.
Se conserva la opción de sólo texto con la IA de la lección.

### Evidencia local de propuestas con imagen

La [integración compilada](../../nodia-server/test/teacher-flashcard-generation.integration.mjs)
ejecutó Nest, el Worker y todas las migraciones en PostgreSQL aislado.
Las respuestas de texto e imagen llegaron por HTTP interceptado. Se
verificaron la calificación exclusiva de la selección, la secuencia de
texto e imagen, la vista previa privada, la conservación de texto ante un
resultado incierto, la revisión de tarjeta y el retiro del contenido
vencido de las filas activas. Releer una clave incierta no repitió el POST
generativo. El ensayo no usó proveedores reales. En la instancia local
de Nodia no había conexiones ni claves de IA configuradas.

Chromium verificó la interfaz a 320 y 1440 px con respuestas de prueba,
incluidos el bloqueo de apuntes vacíos, la vista previa antes del guardado
y el reemplazo de una imagen conservando el texto de la tarjeta.

La [prueba de recuperación](../../nodia-server/test/teacher-flashcard-library-recovery.integration.mjs)
comprobó que vencer un lease no libera un ejecutor vivo. Tras
demostrar el cierre local se liberó el slot y se conservó el resultado
remoto como incierto. También se verificaron el límite de resultados
serializados y el rechazo de restauraciones con trabajo pendiente.
