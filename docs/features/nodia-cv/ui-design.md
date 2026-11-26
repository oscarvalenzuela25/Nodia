# Nodia CV — diseño de interfaz

**Estado: en revisión.** Propuesta del 2026-11-24, hora de Santiago.
El [plan de implementación](../../mvp/113-nodia-cv-implementation-plan.md)
define los contratos, la secuencia y la verificación por entrega. Esta guía
describe las pantallas a partir de la maqueta revisada en la conversación.
Los registros y resultados de ejemplo pertenecen a las pruebas.
El [primer recorrido real](../../mvp/113-nodia-cv-implementation-plan.md#interfaz-de-perfiles-cv-02)
usa tabla nativa en escritorio, tarjetas en móvil y un editor modal amplio.
[CV-04](../../mvp/113-nodia-cv-implementation-plan.md#13-pantalla-de-generación-y-revisión-cv-04--2026-11-24) implementa la oferta, el selector, la matriz de requisitos y la vista previa del contenido. [CV-05](../../mvp/113-nodia-cv-implementation-plan.md#14-pdf-verificado-y-cv-guardados-cv-05--2026-11-24) añade PDF verificado, descarga y versiones guardadas.

## 1. Navegación y composición

- Entrada **Nodia CV** en `/nodia-cv` con
  [GuardStrict](../../../nodia-client/src/routes/GuardStrict.tsx). Publicar en el
  [selector de rutas](../../../nodia-client/src/routes/navigationOptions.ts) al
  integrar el destino funcional. Las asignaciones se realizan mediante
  [Módulos](../../../nodia-client/src/modules/generalSettings/pages/Modules/CONTRACT.md)
  y administración de usuarios. El grupo de navegación cumple el
  [ADR092](../../architecture/decisions/ADR-092-stable-module-navigation-routes.md).
- Cabecera compacta con título **Nodia CV**, con la tipografía y el
  degradado de producto compartidos con **Nodia IA** y **Nodia Teacher**.
  Las pestañas son **Perfiles**, **Generar CV** y **CV guardados**. La
  entrada inicial abre **Perfiles**.
  Una selección controla las pestañas, sus paneles y la navegación adaptable.
  Si a 320 px las etiquetas dejan de caber con objetivos de 44 px, usar un
  `SelectSingleInput` rotulado en `xs` y conservar las pestañas desde `sm`.
- Montar en `BaseLayout`. Usar el fondo, la tipografía, superficies, radios y
  colores semánticos del tema de Nodia. `PageContent` aporta 16 px verticales y
  16/24/32 px laterales en `xs`/`sm`/`md+`. Separar paneles con 24 px verticales
  y 16 px horizontales. Los interiores conservan de 12 a 16 px en móvil.
- Reutilizar la navegación inferior y la reserva de safe area del shell.
  La aplicación sigue desplazable con el teclado en pantalla. La etiqueta,
  el error y el control enfocado quedan a la vista. El área de la vista
  previa puede contener su propio desplazamiento cuando el documento lo requiere.

| Vista | Espacio suficiente | Pantalla estrecha |
| --- | --- | --- |
| Perfiles | Lista compacta a la izquierda y editor del seleccionado a la derecha | Selector o lista, editor y acciones en orden vertical |
| Generar CV | Preparación y requisitos a la izquierda, vista previa a la derecha | Preparación, requisitos y vista previa en ese orden, con acceso directo a la vista previa al quedar lista |
| CV guardados | Tabla de registros con acciones por versión | Tarjetas de registro en `xs` con el mismo orden, paginado y acciones |

Medir el ancho que queda con el menú lateral abierto y cerrado. Aun en `md`
apilar cuando la composición de dos paneles recorte los campos o el documento.
Mantener una sola instancia por editor, formulario o lector y una sola consulta
por conjunto de datos. Conservar selección, ediciones y scroll durante el cambio
de ancho. Seguir [DESIGN §9–10](../../../nodia-client/DESIGN.md#9-lineamientos-y-reglas-estrictas-para-dispositivos-móviles-mobile-first-guidelines).

## 2. Perfiles

1. Mostrar **Nuevo perfil** y un vacío explicativo cuando se obtiene una lista
   vacía. Un error de carga conserva su propio mensaje y acción **Reintentar**.
2. En el editor, agrupar identificación y títulos, contacto y enlaces, resumen
   profesional, habilidades, experiencia, proyectos, formación,
   certificaciones e idiomas conforme al plan. Las secciones adicionales son
   opcionales. Las etiquetas identifican los campos aun cuando tienen valor.
   Formar el currículo con contenido presente y autorizado por la persona.
   Cada campo tiene un icono de ayuda contextual en español e inglés,
   disponible al pasar el puntero, recibir foco o tocarlo. La ayuda explica
   qué escribir y conserva visibles las etiquetas y mensajes de validación.
3. Mostrar experiencia y proyectos en tarjetas repetibles. Mantener una acción
   de agregar por grupo y el nombre de la fila editable visible en su cabecera.
   Dar nombre accesible a las acciones de quitar, por ejemplo **Quitar
   experiencia en [empresa]**. Al agregar, enfocar el primer campo de la
   nueva tarjeta. Al quitar una fila local, devolver el foco a una fila vecina
   o a la acción de agregar cuando quede vacío.
4. Usar React Hook Form con Zod y `useFieldArray`. El
   [editor de jornadas](../../../nodia-client/src/modules/teacher/components/StudyCalendar/CalendarDayEditor.tsx)
   ya aplica este patrón. Separar la clave interna de la tarjeta del ID
   persistido y validar el contrato en el límite. Los valores y errores
   acompañan a la tarjeta al agregar, quitar o reordenar registros.
5. Mantener el corte de las fechas que conoce la persona, por ejemplo mes y
   año en experiencia o año en formación. El
   [DateInput compartido](../../../nodia-client/src/components/inputs/DateInput/DateInput.tsx)
   es de fecha civil completa. Si el contrato de CV admite otras precisiones,
   componer controles para esa precisión con textos localizados. Validar
   orden del período y coherencia de trabajo actual con su fecha fin.
6. **Guardar perfil** habilita su uso para generar. Tras confirmar el guardado,
   conservar el ID elegido y reflejar la revisión de Server. Ante error de
   validación, llevar al primer campo inválido y conservar los campos
   restantes. Un conflicto de revisión ofrece recuperar la revisión actual
   con aviso y preserva la edición pendiente para revisión.

### 2.1 Duplicar y eliminar

- Mostrar **Duplicar perfil** en el detalle de un registro guardado. Cargar su
  detalle autorizado, abrir el modo de creación con los campos precargados y
  sugerir un nombre editable. Enfocar el nombre. El bloque con datos
  precargados es un borrador hasta pulsar **Guardar perfil**. **Cancelar**
  vuelve al origen y devuelve el foco al control que inició la acción.
- Respetar la identidad y los permisos del nuevo perfil. Después de guardar,
  escoger la copia por el ID real devuelto. Al editar sus trabajos o
  tecnologías, la otra ficha conserva sus propios datos. El nombre sirve
  para mostrar y encontrar registros.
- **Eliminar perfil** está en el detalle de un registro guardado. Al
  confirmar, mostrar el nombre guardado y explicar que las versiones
  archivadas de CV se pueden abrir desde **CV guardados**. El plan define
  la relación entre la eliminación y un borrador abierto.
- Tras eliminar un perfil activo, ofrecer explícitamente otro perfil válido
  para selección. Con cero perfiles, volver al vacío de Perfiles y
  deshabilitar **Generar borrador**. La acción **Nuevo perfil** recibe el
  foco cuando desaparece el último registro.

## 3. Generar CV

### 3.1 Preparación y requisitos

- Controles en orden de lectura **Perfil**, **Idioma del CV**, **Cargo de la
  oferta**, **Oferta de trabajo**, selector de IA y **Generar borrador**.
  Etiquetas persistentes, textos que envuelven y área de pegado con
  `TextInput` multilínea. El idioma del CV es independiente del idioma de
  interfaz. El plan define qué campos son requeridos y sus límites.
- Sin perfil guardado, el selector de perfil y **Generar borrador** quedan
  deshabilitados. Indicar **Crea y guarda un perfil para generar el
  borrador** y dejar **Crear perfil** accesible. La oferta se puede pegar
  antes de guardar el perfil. Mantener ese texto al volver de Perfiles.
- Tras generar, presentar los requisitos obligatorios y deseables con
  evidencia vinculada o revisión pendiente. Identificar el trabajo,
  proyecto o habilidad que respalda el requisito. **Revisar** permite
  proponer o confirmar evidencia conforme al plan. Mantener las revisiones
  pendientes cuando el usuario corrija otros campos.
- Ocultar la vista previa, los requisitos y las acciones de versión cuando
  cambien el perfil, su revisión, la oferta, el idioma o la selección.
  Usar IDs de perfil y trabajo más la identidad exacta de la solicitud
  para ignorar respuestas tardías. Mantener la oferta y la edición del
  formulario frente a un fallo recuperable.

### 3.2 Selector de IA

- Adaptar la presentación de
  [ComposerSelection](../../../nodia-client/src/modules/nodiaAi/components/ComposerSelection/ComposerSelection.tsx).
  El botón texto de 44 px muestra modelo y modo en dos líneas, con
  chevrón que indica si está abierto. Mostrar el nombre completo de manera
  accesible aun cuando la línea visual use elipsis.
- Abrir un Popover MUI anclado arriba e izquierda del botón, con margen de
  16 px al viewport. La referencia actual limita ancho a
  `min(36rem, calc(100vw - 32px))` y alto a `min(50dvh, 28rem)`. Permitir
  scroll local con pista transparente y verificar foco con altura reducida.
  Cabecera **Configuración de IA**, línea **IA aplicada** con modelo, conexión,
  modo e intensidad cuando corresponda y botón accesible de cierre.
- Cuatro controles de 44 px con forma de pastilla, en orden **Conexión**,
  **Modo**, **Modelo** e **Intensidad**. Una fila en escritorio con espacio
  suficiente y dos columnas en móvil. Conservar los labels accesibles aunque
  se oculten visualmente. Usar `SelectSingleInput` y opciones provistas por
  el contrato. Expresar falta de modelo o intensidad como estado explícito.
- Distinguir tupla aplicada de edición del selector. Aplicar cambios
  habilita la selección definida por Server. Pendiente, inválida, ocupada o
  con edición sin aplicar bloquea **Generar borrador**. Una respuesta de
  elegibilidad anterior queda asociada a su tupla. El contrato del módulo
  conserva la identidad de conexión, modo, modelo e intensidad. Una
  selección compatible puede tener su primera ejecución desde el botón de
  generación. La disponibilidad del catálogo y la ejecución se verifican
  por separado.
- **Cancelar** recupera la edición de la tupla aplicada. Escape o clic
  exterior sigue el comportamiento del Popover correspondiente. Cierre
  explícito y confirmación satisfactoria devuelven el foco al disparador.
  Error de aplicación mantiene abierto el panel con la edición y un
  reintento explícito. Deshabilitar controles mientras se confirma.
- Mantener pruebas del compositor existente al extraer una presentación
  compartida. Cada producto conserva su contrato de catálogo, elegibilidad,
  aplicación y estado. Evitar cargar UI de chat en la ruta de CV.

### 3.3 Estado del trabajo

Mostrar vacío inicial con la acción que habilita el recorrido. Al salir de
**Generar CV**, limpiar la vista previa y los requisitos del trabajo
completado. Mantener el estado recuperable de los trabajos en curso o de
resultado incierto, junto al formulario. Durante la preparación, mostrar
el estado junto al botón. Bloquear doble envío también en el handler. Al completar
el trabajo visible, anunciar que hay una vista previa disponible sin
robar el foco. Un fallo permite corregir los insumos o usar la recuperación
de la misma intención que establece el plan. El resultado incierto no
dispara una inferencia nueva por revalidación, recarga o cambio de pestaña.

## 4. Vista previa y comprobaciones ATS

- Panel **Vista previa** con estado del borrador y selector de plantilla
  al comienzo. En móvil, preparar, leer y guardar quedan antes del
  contenido estructurado para evitar recorrer todo un CV largo.
  Presentar las opciones Clásica y Compacta según la elegibilidad definida
  por el plan. Mantener una sola columna documental, contacto dentro del
  cuerpo y jerarquía legible. Agrupar empresa, cargo y período en la
  vista de contenido y en el PDF. Cambiar plantilla conserva contenido y solicita
  renderizar o comprobar esa plantilla para el mismo resultado.
- La vista estructurada queda debajo de los controles con texto
  seleccionable. El **Resumen profesional** se edita en Perfiles.
  La vista del PDF usa las plantillas a partir de la revisión.
- **Ver PDF** carga y comprueba los bytes por intención. **Texto extraído**
  muestra la lectura devuelta por Server del PDF exacto. Vincularla a la misma identidad de documento y plantilla que
  se muestra y descarga. El texto de la vista HTML se puede mostrar como
  representación local con una etiqueta que indique ese origen. Usar
  componentes React y texto seguro para contenido de oferta, perfil y modelo.
- La comprobación de lectura comunica la legibilidad del archivo y
  ofrece el texto con encabezados, contacto, cargos, fechas y habilidades
  presentes. Los requisitos de la oferta tienen su propio panel.
  Si falla la extracción o falta evidencia externa, mostrar
  **No verificado** o el error correspondiente al caso. El estado de lectura
  local y la evidencia por importador son distintos. El piloto público
  OneATS aporta evidencia de los dos PDF sintéticos que se cargaron. Los filtros de
  selección de una empresa quedan fuera del control del panel.
- El estado de revisión y guardado sale del plan. **Guardar versión** es una
  acción explícita y conserva la identidad exacta aprobada. Preparar,
  escoger plantilla, alternar lectura o abrir versión son pasos de revisión.
  El éxito muestra el registro en **CV guardados**. Un fallo conserva la
  selección, la vista previa y el contexto del borrador.
- Cargar el lector o el archivo privado por intención, con un mensaje visible
  de carga y un reintento local. Liberar object URLs al cerrar o reemplazar el
  documento. Revocar también al cambiar sesión, perfil o versión y ante una
  denegación de acceso de Server. Evitar URLs persistentes o datos privados
  en caché del navegador fuera del alcance que admite el plan.

## 5. CV guardados y confirmaciones

- Reutilizar [MobileRecordCard](../../../nodia-client/src/components/MobileRecordCard/MobileRecordCard.tsx)
  en `xs` y el patrón de tabla de DESIGN §9.6 desde `sm`, con scroll
  horizontal dentro del contenedor y paginado fuera. Identificar cada versión
  por cargo o título, número de versión, perfil, idioma y plantilla con
  la metadata disponible del contrato. Envolver identificadores y nombres
  largos. Compartir consulta, selección y acciones entre representaciones.
- **Abrir vista previa** recupera el snapshot exacto, incluso cuando se
  eliminó su perfil de origen. Mostrar los requisitos y su evidencia de
  solo lectura cuando la versión contenga el análisis. Las versiones
  históricas sin análisis siguen mostrando el contenido y el PDF y
  comunican esa ausencia. **Eliminar CV** identifica cargo, versión y
  perfil en la confirmación. Dos versiones con igual cargo se distinguen
  por su versión y operan con IDs diferentes. Tras confirmar la eliminación
  de la versión abierta, cerrar esa vista y actualizar el listado.
- Usar [ConfirmDialog](../../../nodia-client/src/components/ConfirmDialog/ConfirmDialog.tsx)
  para ambos borrados, con el patrón destructivo de DESIGN §9.6 en la acción
  de origen. El componente compartido cierra desde **Cancelar** o **Cerrar**
  y mantiene su política de Escape y clic exterior.
  Si se necesita color destructivo específico dentro del diálogo, exponerlo
  como variante optativa y verificar consumidores actuales.
- **Cancelar** conserva el registro sin petición y devuelve el foco al
  iniciador. Durante la escritura, bloquear confirmaciones duplicadas.
  Fallar conserva diálogo, destino y campos con error y reintento. Confirmar
  con éxito devuelve el foco al vecino por ID o a la acción del estado vacío.
  Si se elimina el último registro de una página posterior, cargar la
  anterior una vez confirmado.

## 6. Estados y verificación

- MUI y Emotion con los componentes de Nodia. Texto de interfaz, mensajes,
  accesibilidad y toasts en ES/EN. Usar i18next, TanStack Query y Axios según
  [las reglas de Client](../../../nodia-client/AGENTS.md). Un responsable emite
  cada Sileo y, en errores, usa el mensaje permitido del servidor o un
  fallback traducido. El Alert contextual conserva el detalle y reintento.
- Carga inicial informativa con Boneyard. Controles con estado deshabilitado
  o loading durante la petición. Refetch y mutaciones con datos conservan
  registros y borradores, con progreso suave. Mantener un solo árbol
  interactivo y errores asociados a sus campos. Al salir por cambio de
  cuenta o revocación, retirar las vistas y cachés privadas de esa identidad.

| Prueba | Resultado observable |
| --- | --- |
| 320 y 390 px, 599/600 px, 768 px, 899/900 px, 1280/1440 px | Acciones visibles sin hover, objetivos de 44 px, sin cortes ni scroll horizontal del documento, mismos datos al cruzar bordes |
| Teclado, vista móvil horizontal, poco alto y 200 % de texto | Orden coherente, foco visible y recuperable, navegación y cierre por sus controles, CTA alcanzable con teclado virtual |
| ES/EN y claro/oscuro con nombres, enlaces y errores largos | Campos, chips, avisos y selector legibles. Contraste del tema y contenido completo accesible |
| Perfiles con duplicación, varias tarjetas, error y confirmación | Identidad por registro, fechas precisas, datos de la copia independientes y formularios retenidos tras fallo |
| Generación con cero perfiles, selección sucia, retardo, fallo y resultado incierto | Sin generación inválida, trabajo indeterminado recuperable, respuesta antigua fuera del editor activo |
| Primera generación con modelo compatible y navegación interna | El botón inicia el modelo e intensidad elegidos. Volver a Generar CV muestra la vista inicial. Abrir la versión guardada recupera los requisitos de esa revisión |
| Plantillas, documento y lectura ATS | Vista y lectura verificadas contra el mismo PDF. Errores y ausencia de evidencia explícitos. Solo guardado por clic |
| Dos CV del mismo cargo, borrar perfil y borrar versión | Abrir y borrar por identidad correcta, snapshot existente recuperable y confirmaciones diferenciadas |

Tomar los criterios pertinentes de la
[matriz responsive](../../../nodia-client/skills/responsive-design/references/responsive-verification.md).
Probar validación y transiciones en la unidad que las decide y recorrer la UI
en navegador con API aislada antes del piloto. Registrar ancho, tema, idioma,
fuente de datos y pruebas de teclado, touch o dispositivo físico por separado.
Mantener capturas fuera de Git según la [política de evidencia](../../evidence/README.md).
