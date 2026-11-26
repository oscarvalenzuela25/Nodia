# Plan 113 — Nodia CV

> Estado: en revisión. Alcance recogido de la conversación y del prototipo interactivo.
> Fecha: 2026-11-24, America/Santiago. Rama: codex/nodia-cv, creada desde origin/development en 50bb9ec4.
> La implementación, el QA por selección y la adopción en producción se registran al final del plan. El prototipo usa datos ficticios.

## 1. Resultado y alcance

Una persona con acceso a **Nodia CV** en **Herramientas** guarda perfiles profesionales. Pega una oferta, elige idioma y una selección exacta de IA y revisa un borrador adaptado. Puede aportar evidencia que olvidó registrar, comparar plantillas y revisar el texto extraído del PDF final. **Guardar versión** crea un CV recuperable con los mismos bytes del PDF revisado. La persona descarga el documento y realiza la postulación.

| Solicitud | Resultado esperado |
| --- | --- |
| Acceso asignable | Ruta canónica /nodia-cv registrada en router, selector de rutas de Módulos y política HTTP. Configurar el grupo Herramientas y asignar el acceso desde los flujos existentes. |
| Perfiles completos | Alta, edición, duplicación precargada y borrado confirmado. Experiencias y proyectos repetibles, competencias por área, formación, certificaciones, idiomas y secciones adicionales. |
| Adaptación a una oferta | Pegar la descripción completa. Mostrar los requisitos detectados, su importancia y su evidencia o brecha. Añadir evidencia confirmada en revisión. |
| Selección de IA | Modelo y modo en dos líneas. Popover anclado arriba con conexión, Agentic/API key, modelo e intensidad. Catálogo y elegibilidad reales. |
| Generar y revisar | Bloqueo sin perfil guardado. Vista previa de contenido, PDF y texto extraído. El resumen profesional se administra en Perfiles. Guardado y borrado de versiones con identidad propia. |
| Lectura ATS | Clásica y Compacta de una columna, ES/EN, diagnóstico sobre el PDF exacto y pruebas de importación autorizadas por ATS objetivo. |

La primera entrega completa cubre desde el perfil hasta la descarga. La búsqueda en portales, scraping, envío de candidaturas, cartas, tracker, importación de archivos al perfil y herramientas conversacionales quedan como ampliaciones independientes. El editor manual admite pegar información para cargar el CV base.

[Guía UI y QA visual](../features/nodia-cv/ui-design.md) · [ADR119 propuesto](../architecture/decisions/ADR-119-nodia-cv-owned-generation-and-verified-pdf.md) · [Fichas NodiaAI](../nodia-ai/knowledge/nodia-cv/README.md)

El plan y la guía UI contienen la referencia del mockup en forma portable. Las capturas de trabajo se conservan fuera de Git y la evidencia textual sigue la [política de evidencia](../evidence/README.md).

## 2. Reglas del producto

### Perfiles personales

| Sección | Campos y precisión |
| --- | --- |
| Perfil | Nombre interno del perfil, nombre y apellidos, título profesional, segundo título opcional, resumen profesional y stack principal. Nombre interno y nombre de la persona son mínimos de guardado. |
| Contacto | Ubicación de presentación, correo, teléfono, LinkedIn, GitHub y portafolio separados. Cada canal es opcional. Advertir en el diagnóstico si faltan medios de contacto. |
| Experiencias | Empresa, cargo, ubicación, estado actual/finalizado/sin indicar, mes de inicio y término, responsabilidades/logros por línea y tecnologías. Cada empleo es una tarjeta. |
| Proyectos | Nombre, rol, estado, contexto de validación, inicio/fin cuando se conocen, contribuciones, tecnologías y enlace. Distinguir producción de laboratorio si la persona lo declara. |
| Competencias | Stack principal y áreas repetibles con nombres editables, por ejemplo Frontend, Backend y datos, Arquitectura y calidad, Cloud e IA aplicada. |
| Formación | Título/programa, institución, años de inicio y término y detalle opcional. |
| Certificaciones | Nombre, emisor, año, identificador y URL de verificación opcionales. |
| Idiomas | Idioma, nivel declarado y descripción de uso. Admitir A2 y otros niveles escritos por la persona. |
| Secciones adicionales | Título y líneas para publicaciones, charlas, voluntariado u otros antecedentes. Omitir secciones vacías en el documento. |

- Conservar identidad y orden al añadir, quitar o reordenar elementos repetibles. Los opcionales vacíos se representan con ausencia explícita. Fechas YYYY-MM para experiencia/proyectos y YYYY para formación/certificaciones. Respetar su precisión y orden. “Actualidad” exige estado actual explícito.
- Duplicar abre el editor de alta con una copia del detalle autorizado y un nombre sugerido. Guardar crea un perfil independiente con IDs nuevos, incluidas sus colecciones. Cancelar descarta la copia en edición. Un fallo conserva el editor.
- Eliminar usa el nombre del perfil y una confirmación. Retira el perfil de los selectores, invalida sus borradores temporales y conserva las versiones por su snapshot independiente. Al quitar el último perfil, vuelve el bloqueo de generación.

### Oferta, evidencia y versiones

1. El texto pegado es el insumo completo. Cargo y empresa de la vacante son metadatos opcionales de identificación. Una salida vacía o inválida conserva perfil, oferta y selección.
2. Extraer requisitos obligatorios, deseables e inciertos con fragmentos de origen. Mostrar todos los requisitos detectados. Clasificar su cobertura como **Con evidencia**, **Por confirmar**, **En el perfil, aún ausente del borrador** o **Brecha**. Presentar inferencias como tales.
3. Una habilidad omitida puede añadirse aportando evidencia real y confirmándola en el borrador. Si se quiere reutilizar en futuras ofertas, se edita y guarda en Perfiles. Registrar vínculo con empleo, proyecto, formación u otra fuente declarada. Mantener hechos, niveles, fechas y métricas en el sentido confirmado por la persona.
4. La IA adapta redacción y prioridades. El borrador permite revisar contenido, requisito y evidencia. Server valida IDs y reconstruye los campos invariantes desde los datos autorizados. La revisión humana cubre la equivalencia semántica.
5. **Guardar versión** fija perfil, contenido, idioma, plantilla, análisis de requisitos y PDF revisados. La versión es inmutable. Los cambios guardados generan otra versión. Renombrar o borrar el perfil conserva el resultado archivado.
6. **CV guardados** distingue un mismo cargo por número de versión, perfil, idioma, plantilla y fecha. Abrir recupera el análisis guardado en modo de lectura y el PDF de esa versión. Eliminar confirma la versión exacta y retira ese registro y su PDF. Si esa versión estaba abierta, limpiar su vista previa y enlace.

## 3. Ruta, UI y autoridad

- /nodia-cv es el destino canónico. Router lazy bajo BaseLayout y GuardStrict, opción i18n ES/EN en APP_AVAILABLE_ROUTES, alta con ModuleModal y asignación desde Usuarios/Módulos existentes. Página operativa y opción de ruta llegan juntas. El registro de código no crea asignaciones. Aplicar [ADR092](../architecture/decisions/ADR-092-stable-module-navigation-routes.md).
- Aplicar [Plan89](89-module-access-and-user-data-scope.md) a sesión vigente, módulo activo y ámbito. Filtrar datos y artefactos por titular en SQL para cuentas ordinarias. Un recurso ajeno y uno ausente devuelven el mismo resultado público. Mantener la regla administrativa vigente. La generación personal usa perfil y selección exactos del actor. Una operación administrativa sobre datos ajenos debe quedar explícita, atribuida y probada antes de exponerla en UI.
- Verificar enlace directo, módulo ausente/inactivo/revocado con token aún válido y atajos móviles. Cambiar nombre o grupo del menú conserva destino, permisos e identidad. Revalidar autoridad al reclamar trabajos, publicar resultados o servir PDF.
- La [guía UI](../features/nodia-cv/ui-design.md) define jerarquía, estados, breakpoints y QA. Perfiles, Generar CV y CV guardados viven en el layout nativo, con los tokens, tipografía y componentes de Nodia. Hacer aceptación visual desde el primer corte Client. El selector mantiene la referencia del compositor real y la recuperación se comprueba también con error y teclado.
- CV obtiene el catálogo sanitizado con autoridad del destino, siguiendo el patrón Teacher. Los ajustes y sesiones IA conservan su módulo. Perfiles y versiones guardadas siguen accesibles ante proveedor ausente o caído.
- Perfil, oferta, borrador y PDF son privados. Tratar insumos externos como datos, escapar texto y validar enlaces de presentación. Responder con private, no-store. Excluirlos de logs, telemetría, service worker y conocimiento NodiaAI. Liberar URLs de objeto y limpiar consultas cuando cambia la cuenta o pierde acceso.

## 4. Contratos propuestos

### Persistencia y concurrencia

| Recurso | Identidad y ciclo |
| --- | --- |
| Perfil | UUID, titular de sesión, revisión entera, timestamps y agregado tipado/versionado. IDs estables de elementos. El listado proyecta resumen acotado, con orden y paginado por dueño. |
| Generación y borrador | UUID, dueño, idempotencia, referencia y revisión del perfil, selección exacta, estados, plazos y snapshot temporal. Revisiones separadas para cambios y resultados de PDF. |
| Artefacto | ID, dueño, revisión de contenido, plantilla, idioma y formato, bytes, SHA-256 y diagnóstico de lectura. Se sirve a través del borrador autorizado o de su versión. Probar bytea acotado separado del listado antes de elegir en CV-00. |
| Versión | UUID, titular, número monotónico por dueño, snapshot inmutable, descriptor de oferta, referencia opcional a perfil y artefacto. Admitir huecos de numeración tras eliminar. |

- Confirmar entidades/DTOs, FK, nulabilidad y límites durante CV-00. Relaciones bidireccionales con Relation<T>, índices por consultas comprobadas, migraciones aditivas y arquitectura vertical de [Server](../../nodia-server/AGENTS.md).
- Alta idempotente y edición CAS. Un PUT obsoleto devuelve 409 y conserva el editor local para reconciliar y reintentar. Confirmar borrados por el ID y la revisión mostrados. Guardar cada agregado en transacción.
- Guardar versión verifica revisión y hash, reclama idempotencia y persiste snapshot/artefacto atómicamente. Repetir la misma intención devuelve el mismo ID. Borrar versión y el vínculo al artefacto en el mismo límite de consistencia, con purga de temporales según corresponda.
- Retención, recibos mínimos y restauración conforme al [ADR119 propuesto](../architecture/decisions/ADR-119-nodia-cv-owned-generation-and-verified-pdf.md#decisión). Revalidar un borrado de perfil durante generación o render antes de publicar resultados.

### HTTP

Prefijo candidato /api/v1/nodia-cv. Registrar método y ruta explícitos en Server. Formalizar OpenAPI, códigos de error y ejemplos sintéticos antes de conectar Client. Estos endpoints describen la propuesta.

| Método y recurso | Efecto |
| --- | --- |
| GET /profiles, GET /profiles/:id | Listado paginado de resúmenes y detalle autorizado. |
| POST /profiles, PUT /profiles/:id, DELETE /profiles/:id | Alta y duplicación por flujo de creación, edición con revisión y baja confirmada. El alta asigna IDs nuevos. |
| GET /ai-selection/catalog, GET /ai-selection/eligibility | Catálogo sanitizado y elegibilidad de selección exacta. Exponer estados comprobables por propósito. |
| POST /generations, GET /generations/:id | Inicio explícito con clave, perfil/revisión, oferta, idioma y selección aplicados. Consulta del estado y borrador. Recuperación por clave cuando se pierde la respuesta inicial. |
| PUT /drafts/:id | Confirmar evidencia y elegir hechos del perfil con revisión esperada. La plantilla pertenece al artefacto de PDF. Cambiar idioma del contenido generado pide nueva generación explícita. |
| POST /drafts/:id/pdf, GET /drafts/:id/pdf/:artifactId | Preparar una revisión y plantilla y recuperar los mismos bytes verificados. La preparación devuelve formato, renderer, idioma, páginas, hash, vencimiento y texto extraído. |
| GET /versions, GET /versions/:id, GET /versions/:id/pdf | Historial paginado, detalle y descarga autorizada, sin inferencia al reabrir. |
| POST /versions, DELETE /versions/:id | Guardar con clave de solicitud, generación, revisión, ID de artefacto y hash aprobados. Eliminar por ID de versión después de confirmar. |

Separar sesión inválida, módulo denegado, 409 de revisión/idempotencia, inválido por campo, conexión inelegible, cola ocupada, fallo conocido, resultado remoto desconocido, borrador vencido y fallo de PDF. Transportar sólo códigos y detalles permitidos. Consultar con backoff acotado. Abortar lecturas al navegar y recuperar mutaciones perdidas por su identidad.

## 5. Motor de generación

1. Versionar propósito cv_tailoring, prompt privado y esquema de salida. Separar instrucciones, perfil e insumo externo. Enviar hechos profesionales pertinentes con IDs. Incorporar correo, teléfono, dirección y enlaces de contacto en el render desde la fuente autorizada. La oferta pegada no habilita comandos, navegación, acceso a archivos ni funciones.
2. Dos pasadas lógicas dentro de una inferencia acotada. Extraer requisitos y citas. Después relacionar evidencia y proponer contenido. Validar cardinalidad/longitud, campos inesperados, citas e IDs. Reconstruir invariantes. Preservar fechas, métricas, negaciones, unidades y niveles. Salida inválida o sin evidencia queda identificada y no sobrescribe un borrador previo.
3. El primer intento real puede arrancar desde **Generar borrador** para la conexión, modo, modelo e intensidad compatibles elegidos. API key comprueba configuración y credencial. Agentic observa sesión, runtime y catálogo exactos mediante su contrato de cierre. Los recibos previos de CV sirven para diagnóstico. Aplicar [Plan91](91-ai-provider-onboarding-verification.md), [Plan92](92-nodia-ai-api-chat-parity.md), [contrato de proveedores](ai-provider-feature-contract.md) y [ADR119](../architecture/decisions/ADR-119-nodia-cv-owned-generation-and-verified-pdf.md).
4. En la base revisada el ledger conoce chat, teacher y flashcard_library. Añadir cv como propietario nuevo con FK compuesta y checks compatibles. Reusar el Worker y su registro. Un integrador compone claims/locks, ocupación activa y recuperación. Probar competencia entre dominios. Precisar límites de espera por cola antes de afirmar una cota global.
5. Una clave por actor e intención con hash canónico. Congelar perfil/revisión, selección exacta y configuración. Reservar presupuesto antes de intercambio. Empezar con un envío textual por intento. Reconciliar cierre local y conservar resultado remoto unknown cuando corresponda. Una respuesta incierta no habilita replay ni sustitución de proveedor. El reintento de un fallo conocido es explícito.
6. Estado y salida se ligan a su contexto original. Cambiar perfil, oferta o selección quita la vista previa anterior de la solicitud activa. Al salir a otra pestaña de CV se limpia el resultado visible de la generación y el historial abre cada versión por su identidad. Revalidar titular, módulo, perfil y configuración antes de publicar. Un trabajo activo o incierto conserva su referencia de recuperación por autoridad e ID o clave.
7. La integración del chat de NodiaAI se planifica por separado. Las fichas candidatas usan draft/planned/unregistered. Los paths nuevos en el registro habilitan validación documental. Aplicar [catálogo40](40-nodia-ai-tool-catalog-v1.md) y [publicación52](52-nodia-ai-ai06-knowledge-publication-contract.md).

## 6. PDF, ATS y reutilización

**Criterio técnico.** Clásica y Compacta conservan una columna, orden semántico, secciones estándar localizadas, contacto en el cuerpo y texto seleccionable. Fuente y activos con licencia verificable. Sin gráficos que sustituyan texto, texto oculto, encabezados huérfanos ni recortes. Compacta ajusta densidad manteniendo legibilidad. Preservar separadores, Unicode y fechas completas.

1. **Spike CV-00.** Renderizar ES/EN corto y largo, campos ausentes y caracteres/URLs largos. Probar [PDFKit](https://pdfkit.org/docs/getting_started.html) como candidato de Server y comparar con HTML a PDF en Chromium de QA. Evaluar A4 primero y calificar Carta por separado si se habilita. Estudiar reutilización del [extractor PDF de Teacher](../../nodia-server/src/teacher/policies/teacher-enrichment-sources.ts) sin ampliar sus límites. Medir en Windows y Linux compatible con el despliegue, con tamaños, tiempo, memoria, glifos, paginado, cero red durante render y cierre de recursos. Usar el [rasterizador existente](../../nodia-server/scripts/render-codex-pdf.mjs) para inspeccionar páginas. El diálogo de impresión por sí solo no entrega los bytes revisados.
2. **Identidad del artefacto.** Extraer del PDF final, comparar campos y orden con el DTO, vincular por hash/revisión y presentar exactamente esos bytes en la vista PDF y descarga. Cambiar contenido, idioma, plantilla o formato invalida el diagnóstico. Falla de parser, documento rasterizado y pérdida de un campo presente son estados distinguibles y bloquean el guardado de esa versión. Los avisos sobre opcionales ausentes o brechas siguen visibles en revisión. Corregir o reintentar sin perder borrador.
3. **Tres evidencias.** Lectura interna comprobada de esos bytes, cobertura de términos con evidencia y ensayo de importación real por ATS. Registrarlas por separado. Usar autorización y datos ficticios para el ensayo real. Indicar importación pendiente si falta acceso. El filtro de selección depende de la vacante y la configuración de cada empleador. [Greenhouse](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse) · [Lever](https://help.lever.co/s/article/Understanding-Resume-Parsing)
4. **Orden.** Una plantilla y extracción íntegra de PDF corto/largo primero. Compacta y casos extremos después. Registrar por ATS, entorno, versión de plantilla/renderer, idioma, resultado por campo y diferencias. Limitar las afirmaciones de compatibilidad a ese alcance.

| Fuente | Reutilización que se verificará |
| --- | --- |
| AI Job Search ab51f852 | [Revisión de texto](https://github.com/ai-job-search-dev/ai-job-search/blob/ab51f852316faca85fe6ce93cccd7ac58b9c20df/.claude/commands/apply.md#5d-ats--keyword-verification-cv), [extracción y fechas](https://github.com/ai-job-search-dev/ai-job-search/blob/ab51f852316faca85fe6ce93cccd7ac58b9c20df/tools/verify_pdf.py) y [huérfanos](https://github.com/ai-job-search-dev/ai-job-search/blob/ab51f852316faca85fe6ce93cccd7ac58b9c20df/tools/verify_layout.py). Trasladar reglas y regresiones pertinentes al stack de Nodia. |
| Career Ops 1ef2ea0 | [Dos pasadas](https://github.com/career-ops-hq/career-ops/blob/1ef2ea0da345853771cf5bf277b87322d4671ecf/modes/es/oferta.md#bloque-b--match-con-el-cv), [datos ATS](https://github.com/career-ops-hq/career-ops/blob/1ef2ea0da345853771cf5bf277b87322d4671ecf/ats-payload.mjs), [términos](https://github.com/career-ops-hq/career-ops/blob/1ef2ea0da345853771cf5bf277b87322d4671ecf/keyword-match.mjs) y [render aislado](https://github.com/career-ops-hq/career-ops/blob/1ef2ea0da345853771cf5bf277b87322d4671ecf/generate-pdf.mjs#L3374). Adaptar sin usar el puntaje HTML como criterio ATS. |

Ambos proyectos tienen licencia MIT. Al copiar un fragmento, conservar aviso y referencia exactos. Verificar fuentes y activos por licencia propia. El motor debe funcionar desde Nodia Server con contratos locales y fixtures sintéticas. [Licencia AI Job Search](https://github.com/ai-job-search-dev/ai-job-search/blob/ab51f852316faca85fe6ce93cccd7ac58b9c20df/LICENSE) · [Licencia Career Ops](https://github.com/career-ops-hq/career-ops/blob/1ef2ea0da345853771cf5bf277b87322d4671ecf/LICENSE)

## 7. Secuencia de implementación

Integrar en orden **CV-00 → CV-01 → CV-02 → CV-03 → CV-04 → CV-05 → CV-06**. Cada corte tiene una salida comprobable. Los ensayos de PDF y UI de CV-00 son independientes. Después pueden avanzar tareas con archivos disjuntos cuando su contrato esté fijado. Una integración fallida vuelve al primer requisito con evidencia de fallo.

### CV-00 — Conciliar contratos y ejecutar pruebas de concepto

- [x] Verificar SHA, estado de worktree, última migración disponible y ADR/planes dependientes. En la base revisada la última numeración es 179395. Reservar el identificador final al integrar. Localizar las fuentes de estado, ownership y sesión que realmente aplican.
- [x] Ejecutar el spike de PDF de §6 dentro de una jornada técnica inicial como referencia de esfuerzo. Probar un renderer que produzca bytes en Server y comparar con Chromium de QA. Decidir renderer, extractor, límites, fuente, formato inicial y almacén de bytes con evidencia. Documentar el acceso autorizado a ATS objetivo o la prueba externa pendiente.
- [x] En paralelo, contrastar la [guía UI](../features/nodia-cv/ui-design.md) con los componentes actuales y preparar escenarios sintéticos de vacíos, red y tap targets. Fijar primero el recorrido mínimo. Revisar accesibilidad y la maqueta en contraste claro/oscuro antes de empezar a implementar pantallas.
- [x] Fijar DTOs, estados, revisiones, idempotencia, retención y límites coherentes con [ADR119](../architecture/decisions/ADR-119-nodia-cv-owned-generation-and-verified-pdf.md). **Salida:** contrato y decisiones técnicas fechadas, con alcance y limitaciones de las pruebas de concepto.

### CV-01 — Dominio y perfiles en Server

- [x] Crear módulo vertical y migración aditiva, entidades, DTOs, validación atómica de fechas/colecciones, casos de uso, CRUD y revisión de escritura. Registrar política HTTP explícita. Hacer alta nueva y con valores clonados mediante el mismo contrato.
- [x] Comprobar dueño en consultas y mutaciones, dos cuentas, módulo incorrecto o revocado, ID ajeno, fechas, repetición de alta, CAS y eliminación. Probar con PostgreSQL aislado donde interese FK, concurrencia, idempotencia y ámbito real. Verificar migración sobre base vacía y copia aislada adecuada. **Salida:** HTTP de perfiles probado, OpenAPI y fixtures sintéticas.

### CV-02 — Perfiles y navegación Client

- [x] Montar Client con ruta lazy, opción asignable, guard, i18n y layout nativo. El laboratorio integró `/nodia-cv` con un módulo y una cuenta sintéticos.
- [x] Implementar vacío, editor de colecciones, duplicado, baja, CAS y conservación ante fallos. Aplicar la [guía UI](../features/nodia-cv/ui-design.md) desde este corte. Reutilizar piezas de Nodia y un único estado de formulario entre tamaños.
- [x] Verificar acceso directo, ruta seleccionable, recorrido de perfiles contra HTTP y temas/idiomas en navegador local. Los controles de cortes futuros muestran un estado explícito.
- [x] Verificar alta y asignación mediante endpoints nativos de Core. Comprobar navegación por teclado, foco, nombres en el límite y ancho tablet. La aceptación del mantenedor visual en el entorno de destino corresponde a CV-06.

### CV-03 — Generación y selección exacta en Server

- [x] Implementar caso de uso, prompt/esquema versionados, validación de evidencia, recuperación de borradores y catálogo sanitizado. Integrar owner CV y Worker común con un único responsable del cambio compartido. Verificar claims competidores, presupuesto, pre/post-dispatch, cierre, restauración y revocación.
- [x] Ejecutar una inferencia real con API key, perfil y oferta sintéticos y cierre por selección exacta. Registrar evidencia limitada a la combinación y entorno probados.
- [ ] Agentic requiere descriptor, transporte restringido y prueba de cierre propios de CV. La comprobación del modo devolvió `agentic_transport_unavailable` con cero despachos. Retomar por [la secuencia de §17](#17-continuación-de-cv-03--generación-agentic--2026-11-25).
- [x] Probar texto de terceros, respuesta inválida, citas o referencias ajenas, hechos conservados, resultado incierto y recuperación sin reenviar. **Salida API key:** borrador estructurado y recuperación privada comprobada.
- [ ] Completar la matriz de timeout, cuota y reinicio por transporte en el entorno de destino junto con CV-06.

### CV-04 — Preparar, generar y revisar en Client

- [x] Integrar oferta, idioma, selector, carga y recuperación, matriz de requisitos, evidencia y vista previa de contenido. Extraer el patrón de ComposerSelection si conviene compartirlo y proteger su consumo en NodiaAI con las pruebas existentes. La guía UI fija la referencia visual y el foco.
- [x] Exigir perfil guardado, oferta válida y selección aplicada/elegible. Mantener formulario y borrador ante fallo. Bloquear respuestas tardías de otro actor, perfil, oferta o selección. Dar estado explícito al borrador anterior y separar reintento recuperable de resultado remoto unknown.
- [x] Probar el flujo con API real, mocks aislados sólo para estados de fallo reproducibles y recorrido visual en ambos temas. **Salida:** recorrido de generación y lectura del contenido sin mostrar como comprobada la extracción antes de tener PDF.

### CV-05 — PDF, historial y guardado explícito

- [x] Integrar primero Clásica y luego Compacta. Render, extracción, hash, verificación y descarga autorizada. Implementar selector de plantilla, revisión de PDF exacto y texto extraído. Cargar el visor por intención, sin disparar IA y con reintento local si su carga falla.
- [x] Guardar versión, listar, abrir, descargar y eliminar con confirmación. Probar mismo cargo en varias versiones, doble guardado, borrar perfil conservando versiones, borrar versión conservando perfil y abrir historial sin perfiles. Verificar el borrado de la versión abierta, link revocado, caducidad y fallos de red.
- [x] Acordar antes identidad, archivos compartidos, proyecciones y contrato del artefacto. **Salida:** recorrido integrado hasta PDF descargable revisado, sin blobs en listado y evidencia por plantilla e idioma.

### CV-06 — Integración, QA visual y piloto

- [x] Repetir el flujo en Nest compilado, PostgreSQL aislado y navegador con dos cuentas sintéticas, con alta y asignación desde el mantenedor visual. Leer Clásica y Compacta del mismo borrador por la prueba pública oficial de OneATS y registrar resultados sin postular.
- [x] Ejecutar matriz UI en navegador, regresiones de identidad/cierre, tipos, lint, builds y suites afectadas. Registrar navegador, tema, idioma, anchos y alcance del entorno.
- [x] Ensayar migración aditiva y cuarentena de restauración según las barreras de [ADR109](../architecture/decisions/ADR-109-phase-aware-production-deploy-recovery.md). Aplicar el journal para evitar recuperar bajas y conservar la versión legítima con sus bytes exactos.
- [ ] Conciliar CI por SHA y verificar publicación y continuidad por fase en el entorno autorizado. Acreditar cobertura del journal externo después de habilitar ambos productores. Completar prueba en dispositivo físico y ensayo en tenant de reclutamiento si se habilita acceso.

## 8. Coordinación sin solapamientos

| Frente | Paralelismo permitido | Integración serial |
| --- | --- | --- |
| Pruebas de concepto | UI verifica referencias y casos. PDF desarrolla fixtures y compara herramientas con el mismo snapshot acordado. | Consolidar resultados y aprobar cambios de contrato antes de ramas consumidoras. |
| Server de perfiles y editor | Server escribe el módulo vertical. Client trabaja en componentes aislados cuando existan DTOs y fixtures. | Un responsable asigna migraciones, AppModule, política HTTP, router y selector de rutas. Reconciliar cambios allí antes de merge. |
| Motor IA y motor PDF | Carpetas independientes a partir de DTOs congelados y revisiones comunes. | Un integrador para ai-generation, GenerationWorkerSourceRegistry, locks/cupo, claims de Chat/Teacher/Flashcards, ejecución y restore. |
| Selector y pantallas | Perfiles e historial pueden avanzar en archivos propios. | Un dueño para extracción del selector compartido y pruebas de consumidores. Revisar compatibilidad del compositor antes de integrar CV. |
| Documentación | Evidencia por área con archivos disjuntos. | Integrador de plan, README, 00-progress, TODO, registro de conocimiento y pruebas de publicación. |

Antes de cada corte revisar git status, base, último paso real y contrato consumido. Dar a cada agente ámbito de archivos, dependencia y aceptación concreta. Una sola persona integra archivos compartidos. Revisar diff, migraciones, tests cruzados y documentación antes de pasar al siguiente corte. Si aparece un bloqueo, identificarlo con evidencia, corregir lo recuperable y mantener el trabajo independiente. Proceder con decisiones rutinarias dentro del alcance. Encauzar cambios de alcance, autoridad, presupuesto externo o despliegue por su autorización correspondiente.

**Límites iniciales de archivos.** Server trabaja en el módulo nuevo `nodia-server/src/nodia-cv/` y sus pruebas. Client trabaja en `nodia-client/src/modules/nodiaCv/`, pruebas focales y su namespace ES/EN. El integrador ajusta migraciones, AppModule, Worker, política HTTP, router, catálogo de rutas y registro i18n. Preparar fixtures independientes para probar UI y render con el mismo contrato de datos. Evitar cambios globales de estilos, refactorizaciones de otros módulos o una nueva API de proveedor como efecto colateral.

## 9. Matriz mínima de verificación

| Riesgo | Primera prueba que debe fallar si hay regresión |
| --- | --- |
| Acceso o datos cruzados | Ruta/selector/política HTTP coinciden. Dos cuentas, ID ajeno con respuesta de ausente, sesión revocada, caché aislada, PDF sin acceso posterior y prueba de autoridad administrativa. |
| Pérdida de perfil | Fechas mensuales/anuales, tarjetas con identidad estable, duplicación independiente, CAS y error de guardado que deja el editor y el foco recuperables. |
| Modelo o hechos incorrectos | Selección incompleta, instancia retirada, evidencia que pertenece a otro perfil, instrucción externa, salida inválida, campos protegidos fuera del prompt y métricas/datos no respaldados. |
| Doble despacho | Dos workers bajo el mismo lock/cupo, misma intención, reintento tras pérdida de red, unknown tras envío, recuperación con prueba de cierre y restore sin replay. |
| UI pierde el contexto | Cambio de perfil o modo con respuesta tardía, overlay desmontado, modo erróneo, carga inicial frente a refetch, reintento local y confirmación que conserva identidad cuando falla. |
| PDF ilegible o distinto | Nombre/contacto literal, fechas, ñ, acentos, C++/C#, separadores y orden sin cortes. Probar PDF raster/corrupto, timeout, hash incorrecto y cambios durante el render. |
| Borrado equivocado | Dos CV del mismo cargo y formato, eliminación confirma número/ID. El perfil sigue disponible. Borrar el último perfil bloquea generar y las versiones anteriores se abren con sus bytes originales. |
| Regresión visual | [Guía UI](../features/nodia-cv/ui-design.md) con 320/390, 599/600, 768, 899/900 y 1280/1440, ES/EN, claro/oscuro, zoom, teclas, safe area, nombres largos y estados de error. |
| Afirmación ATS | Campos importados por ATS, idioma y plantilla, si hubo ensayo real. Registrar evidencia textual o pendiente. La lectura local tiene su propio resultado. |
| Rendimiento y cambios ajenos | Chunks y red por ruta, visor fuera de la carga inicial, comparación por perfil, reintento local. Aplicar [Plan37](37-web-performance-implementation-plan.md) y [DESIGN](../../nodia-client/DESIGN.md#10-rendimiento-y-estabilidad-en-móvil-y-escritorio). |

Priorizar pruebas atómicas de fechas, evidencia, parser/hash y hooks de identidad. Usar integración puntual para las garantías que dependen de PostgreSQL, permisos, cierre/recovery, bytes y navegación real. Al cerrar cada corte, registrar comandos, SHA, entorno, resultados, límites y siguiente pendiente en evidencia textual. Mantener UTF-8/LF y las capturas nuevas fuera de Git.

## 10. Instrucción de traspaso

> Implementa Nodia CV en codex/nodia-cv. Lee Plan113, la guía UI, ADR119 y los AGENTS aplicables. Empieza por el primer paso real pendiente. Reparte únicamente trabajo independiente con archivos disjuntos. Integra y verifica cada corte antes de pasar al siguiente y registra la evidencia. El selector fiel, la UX móvil y los estados de error forman parte de la aceptación. Usa datos sintéticos y reporta por separado lectura PDF, importación ATS, inferencia real y despliegue.

**Primer pendiente real.** CV-00, verificar renderer y extracción de un PDF exacto con fixtures sintéticas, en paralelo con preparar la matriz UI. Registrar qué se midió y qué depende de un entorno autorizado. Partir de ese resultado para fijar el contrato y comenzar CV-01.

## 11. Validación de esta entrega documental

El 2026-11-24 se comprobaron estructura UTF-8/LF, enlaces locales, diff y compilación con knowledge:check, knowledge:build y context:build. El registro pasó de 102 a 105 fuentes y de 54 a 57 exclusiones. Las 48 fichas y 50 fragmentos del corpus publicado, junto a sus capacidades, coinciden con el cotejo de la misma base. Las tres fichas Nodia CV están excluidas. El build local generó su pin de contexto a partir de la nueva huella del inventario.

Esta validación corresponde a la documentación y su registro. CV-00, implementación, inferencia, aceptación UI de la app, importación ATS y despliegue están pendientes.

## 11. Primer corte local — 2026-11-24

Base `50bb9ec4`, worktree `codex/nodia-cv`. La última migración de la
base es `1793950000000`. Perfiles agrega `1793960000000-CreateNodiaCvProfiles`.
Su reversión en vacío está comprobada. Con perfiles o recibos existentes,
la reversión se detiene para preservar datos y evitar reabrir altas.

### Decisiones de CV-00

- Usar PDFKit 0.21.0 con DejaVu Sans Regular/Bold embebida para Clásica A4.
  Leer los bytes exactos mediante PDF.js 6.4.299. Chromium queda en QA.
  El límite preliminar es cuatro páginas, 256 KiB, 128 bloques y 24 000
  unidades UTF-16. Verificar concurrencia, timeout y Compacta al integrar.
  [Ensayo Windows/Linux](../evidence/nodia-cv-pdf-spike-20261124.md).
- Usar `bytea` acotado en tabla separada del historial. PostgreSQL 16.15
  aislado reprodujo los cuatro PDF sintéticos, conservó su hash y aceptó
  262 144 bytes exactos. La consulta de historial leyó sólo metadatos.
  El límite rechazó 262 145 bytes y la prueba comprobó borrado en cascada
  y rollback. La adopción del esquema definitivo y la prueba de restore
  corresponden a CV-05/CV-06.
- Mantener 24 h desde la admisión como ventana inicial para ofertas,
  borradores y artefactos temporales. Si un trabajo requiere conciliación,
  conservar su identidad técnica mínima hasta cierre local sin volver a
  exponer el contenido. Fijar purga y recuperación del ledger con el
  contrato del Worker en CV-03 y comprobar restore en CV-06. Las versiones
  guardadas duran hasta que la persona las elimina.
- El recorrido UI parte de Perfiles. GuardStrict, diálogo compartido,
  calendario con precisión propia y selector del compositor delimitados.
  La aceptación del selector adaptado se ejecutará en CV-04.
  [Preparación de UI](../evidence/nodia-cv-ui-readiness-20261124.md).
- El ensayo de extracción conserva campos, orden y glifos del PDF en
  español e inglés. La importación de campos en un ATS comercial queda
  pendiente de acceso autorizado.

### Contrato de perfiles (CV-01)

- El prefijo es `/api/v1/nodia-cv/profiles`. Se comprueban sesión vigente y
  módulo en método/ruta y de nuevo bajo la barrera de autoridad antes de
  consultar el dominio. GET colección devuelve el ámbito personal paginado.
  GET por ID incluye el acceso de lectura global de super_admin activo por
  ID explícito. Las mutaciones de perfil se hacen en la cuenta del actor.
  Una cuenta ordinaria recibe el mismo 404 por un ID ajeno y por uno ausente.
- GET admite `page` 1–10 000 y `page_size` 1–50, con valores iniciales 1 y 10.
  Responde `{items,total,page,page_size}` con resumen ordenado por fecha de
  modificación e ID descendentes. Los detalles agregan el contenido al
  resumen. Todos los resultados usan `Cache-Control: private, no-store`.
- POST recibe `{request_key,profile}` con UUID v4. Un actor y clave con la
  misma intención recuperan el perfil y su revisión vigente. Otro contenido
  devuelve 409. Tras una baja, la clave devuelve 410 y conserva un recibo
  opaco sin hash del contenido. El recibo dura hasta eliminar la cuenta,
  como barrera contra replays de alta tardíos. Una copia utiliza un
  POST nuevo sin IDs de tarjeta. Las claves se reclaman en la misma
  transacción que la escritura del perfil.
- PUT recibe `{revision,profile}` y sustituye el agregado. DELETE usa
  `?revision=n` y devuelve 204. Una revisión obsoleta en cualquier escritura
  devuelve 409. Las entradas repetibles conservan su UUID v4 dentro de
  la colección de origen. Server lo asigna si falta y rechaza usarlo dos
  veces o en un agregado distinto.
- Formato de entrada bajo `profile` y respuesta de detalle plana.
  Datos básicos mínimos `profile_name` y `full_name`. El agregado dispone
  de `professional_title`, `second_title`, `summary`, `main_stack`,
  `contact`, `experiences`, `projects`, `skill_areas`, `education`,
  `certifications`, `languages` y `additional_sections`. El detalle incluye
  `id`, `revision`, `schema_version=1`, `created_at` y `updated_at`.
  La colección vacía se devuelve como arreglo vacío y los opcionales de
  texto ausentes se omiten.
- Fechas mensuales y anuales con la precisión indicada en §2. El fin no
  precede al inicio. `current` requiere ausencia de fin. Las identificaciones
  de tarjeta requieren empresa y cargo, nombre de proyecto, nombre del área,
  título e institución de formación, nombre de certificación, nombre de
  idioma o título de sección según corresponda. Se admiten 25 entradas por
  colección, 30 líneas por campo, 96 KiB de intención normalizada y 128 KiB
  en la admisión HTTP. Los enlaces admiten HTTP(S) sin credenciales.
  [DTO ejecutado](../../nodia-server/src/nodia-cv/dto/nodia-cv-profile.dto.ts).
- La API devuelve códigos localizables por causa y una ruta de campo
  permitida para conflictos de fechas o de IDs de entrada. Los logs
  registran estados y códigos permitidos. La aplicación
  usa el mismo alta para formulario en blanco y para copia autorizada.
  [Prueba HTTP compilada](../../nodia-server/test/nodia-cv-profiles.integration.mjs).

### Interfaz de perfiles (CV-02)

- Ruta lazy con GuardStrict y una opción en el selector de Módulos con
  el mismo destino. Client carga la traducción ES/EN, presenta tabla y
  tarjetas según ancho, y utiliza BaseModal, TextInput, SelectSingleInput,
  ConfirmDialog y Sileo. El editor vive en un solo modal amplio para
  preservar su estado y dejar espacio para las colecciones.
- Chromium en Windows, 1300 × 900 y 320 × 740 CSS px, sobre la cuenta
  sintética asignada a Herramientas. Datos y mutaciones de perfiles
  reales en Nest y PostgreSQL 16.15 aislado. Se verificaron el vacío,
  alta, edición, experiencia mensual, foco al añadir experiencia,
  rechazo de fecha invertida con foco en el fin, copia precargada,
  conservación al cambiar de tamaño, borrado de la copia con el origen
  intacto y error 409 que deja abierta la confirmación. En 320 px se
  midió `scrollWidth=320` y acciones de 44 px de alto. Revisión de
  capturas de escritorio claro y modal móvil oscuro, y cambio de ES a
  EN en el shell real. El nuevo editor enfoca el nombre con teclado y
  Tab pasa al nombre completo. Los nombres al límite (120 y 160
  caracteres) se mantuvieron visibles a 320 y 720 px, sin ensanchar la
  página. Las capturas sintéticas quedaron fuera de Git.
- Core compilado y PostgreSQL aislado verificaron alta del grupo
  Herramientas/Tools, alta de módulo con enlace canónico y asignación
  explícita a cuenta ordinaria desde los endpoints que consumen
  Módulos y Usuarios. La cuenta recibió 403 antes de la asignación,
  200 después, mantuvo acceso al renombrar el grupo y volvió a 403 al
  revocar con el mismo token. El contexto devolvió grupo bilingüe
  y destino. El mantenedor visual queda para aceptación en destino.
- Unitarias CV y política HTTP, integración compilada con JWT real y
  PostgreSQL, lint y builds de Server y Client. Pruebas Client de
  formulario, GuardStrict, destinos, ModuleModal y UserModal. La prueba
  de la migración exige una base vacía, aislada y local. Ejecutar
  `npm run test:nodia-cv:profiles` en Server con
  `NODIA_CV_TEST_DATABASE_URL` apuntando a la base de ensayo
  `nodia_cv_test_*`. Pruebas de arranque y uso del formulario en entorno
  de destino pendientes.
- Generar CV muestra el requisito de perfil guardado cuando la lista
  está vacía. Las pestañas de generación e historial dejan visible su
  estado durante este corte. CV-03 continúa con el contrato del motor
  y la calificación por selección. CV-04 implementa el selector del
  compositor, oferta y vista previa, y CV-05 integra PDF e historial.

## 12. Motor de generación CV-03 — 2026-11-24

- Server admite `POST /api/v1/nodia-cv/generations` con `request_key`,
  `profile_id`, `profile_revision`, `language`, `offer_text` y una
  selección exacta. El cargo y la empresa de la oferta son opcionales.
  Devuelve 202 y el recibo. Recuperar por
  `GET /generations/:id` o `GET /generations/requests/:key`.
  La misma clave y contenido recuperan la misma intención. Con otro
  contenido devuelve 409 y tras purga, 410.
- `GET /ai-selection/catalog` proyecta conexión, modo y modelos
  configurados. `GET /ai-selection/eligibility` consulta la combinación
  exacta sin inferencia. El recibo de calificación vincula el propósito
  CV, la versión de prompt/esquema, la selección, la configuración y
  la época. Los iniciales de cada entorno requieren un probe
  sintético interno con acceso administrativo vigente.
- `cv-tailoring/1` instruye dos pasadas en un envío de texto. Valida el
  formato JSON, las citas literales y los IDs de evidencia del
  snapshot. La propuesta selecciona y ordena hechos de origen. Los
  opcionales ausentes y coincidencias débiles quedan visibles como
  brecha o confirmación. Los datos de contacto, las URLs, los
  IDs persistidos y otras referencias sensibles se excluyen del prompt.
  El borrador queda ligado al perfil y revisión registrados.
- Las migraciones `179397` y `179398` registran generaciones, recibos
  y el cuarto propietario técnico del ledger común. La reserva de
  un intercambio y el cupo se persisten antes del envío. Worker
  comprueba módulo, sesión, perfil, revisión y selección al reclamar,
  antes de enviar y al publicar. El perfil borrado y las generaciones
  vencidas se purgan conservando un recibo mínimo. Ante un resultado
  incierto conserva el estado `unknown` sin reenvío.
- La prueba real en la VM aislada devolvió un borrador válido con
  `OpenAI / gpt-6.1-terra / medium / API key`. TypeScript se relacionó
  con un hecho existente y Kubernetes quedó como brecha. El ledger
  registró un despacho, cierre local, respuesta válida y ACK. El
  borrador y el recibo pertenecen al laboratorio.
  [Evidencia del probe](../evidence/nodia-cv-api-key-vm-20261124.md).
- La comprobación de `OpenAI / gpt-6.1-sol / medium / Agentic` devolvió
  `agentic_transport_unavailable`. Su integración requiere un
  descriptor CV y un recibo nativo del mismo proceso y selección.
  La implementación de CV-04 puede consumir el carril API key
  y mostrar el estado de Agentic en el selector.

## 13. Pantalla de generación y revisión CV-04 — 2026-11-24

- **Generar CV** permite pegar el aviso, elegir perfil guardado, idioma
  y selección exacta de IA. Puede conservar el formulario al volver a
  Perfiles. Solicitar un borrador exige perfil vigente y elegibilidad.
  La presentación de IA comparte el popover de NodiaAI y conserva
  catálogo y permisos propios de CV. Agentic presenta su disponibilidad
  pendiente en la misma interfaz.
- El resultado combina la vista previa del contenido y citas de los
  requisitos. La vista previa usa el idioma del CV. La interfaz mantiene
  su propio idioma. Marca como anterior el resultado de otra intención,
  congela sus datos de presentación y suspende su revisión hasta volver
  al contexto correspondiente.
- Una admisión incierta consulta su recibo por la clave original. Si la
  consulta devuelve ausente, el reenvío explícito usa el insumo exacto
  de la solicitud original. Un estado remoto `unknown` conserva el
  resultado incierto y bloquea el mismo envío en la vista. Para
  recuperar una solicitud admitida tras recargar, la pestaña conserva
  su UUID y dueño en sessionStorage. El GET por clave autoriza y
  recupera la oferta y el snapshot originales desde Server.
- La migración `179399` añade revisión temporal. PUT
  `/api/v1/nodia-cv/drafts/:id` recibe `revision`,
  `included_fact_ids` y `evidence`. Server valida hechos y autor,
  añade anclajes y conserva el borrador original. Los aportes
  confirmados quedan identificados como declaraciones de la persona.
  Ante 409, el editor conserva los cambios locales y actualiza los
  campos que la persona dejó intactos. El guardado no consume IA.
  Al vencer o borrar el perfil, se retira el acceso y se purga la
  revisión junto con el borrador.
- En la VM aislada, el navegador envió un borrador por OpenAI API key
  con la selección `gpt-6.1-terra / medium`. Recibió los dos
  requisitos sintéticos y observó el cierre con un solo intercambio.
  Las pruebas locales comprobaron permisos, conflicto de revisión,
  pérdida de respuesta, selección, teclado, 320 px y los dos temas.
  Las capturas sintéticas quedaron en el laboratorio.
  [Evidencia CV-04](../evidence/nodia-cv-generation-ui-20261124.md).
- CV-05 integra render, lectura de los bytes exactos y versiones
  guardadas. La vista de CV-04 corresponde al contenido estructurado.
  La calificación por importador ATS y la adopción en destino siguen
  en CV-06.

## 14. PDF verificado y CV guardados CV-05 — 2026-11-24

- Clásica y Compacta producen PDF A4 de una columna en español e inglés.
  Usan el perfil congelado y la revisión vigente del borrador. Preparar,
  verificar, guardar y descargar son operaciones del módulo CV sin
  inferencia. El diagnóstico compara el texto y el orden de lectura del
  archivo generado con el contenido que Server envió al renderer. Las
  tecnologías seleccionadas del stack principal aparecen en la sección
  localizada de competencias junto con las áreas de habilidades elegidas.
- PDFKit 0.21.0 genera el PDF y PDF.js 6.4.299 lo lee en un worker
  acotado. Las fuentes locales DejaVu Sans se distribuyen con sus
  licencias. El ejecutor acepta un trabajo simultáneo por proceso, con
  un máximo de 128 bloques, 24.000 unidades de texto, cuatro páginas y
  256 KiB. Render y lectura disponen de cinco segundos cada uno. Un
  vencimiento termina el worker y devuelve el cupo.
- `POST /drafts/:id/pdf` acepta `revision` y `template`. Responde 200
  con la identidad del PDF y el diagnóstico de lectura. La preparación
  reclama la identidad por generación, revisión, plantilla y renderer.
  El render y la lectura ocurren fuera de la transacción. Para publicar,
  Server vuelve a comprobar sesión, módulo, perfil, vencimiento y
  revisión. Un 409 indica revisión obsoleta y un 410 indica vencimiento.
- Los GET binarios responden `application/pdf`, `private, no-store`,
  `Content-Disposition` y `X-Content-SHA256`. El archivo servido se
  comprueba contra su hash. Cambiar la evidencia, borrar el perfil o
  purgar el borrador elimina sus artefactos temporales.
- `POST /versions` fija los bytes comprobados, el diagnóstico y un
  snapshot del contenido que entró al PDF. El snapshot conserva la
  revisión de perfil y el descriptor de vacante. La huella de la oferta
  conserva su identidad sin persistir el texto original en el historial.
  Guardados concurrentes del mismo artefacto convergen en una versión.
  Una clave reutilizada con otro insumo devuelve 409. El recibo mínimo
  de una versión borrada devuelve 404 y evita recrearla en un reintento.
- La versión conserva un número creciente por titular, aun con bajas.
  El listado paginado proyecta cargo, empresa, perfil, idioma, plantilla
  y fecha. Carga el texto bajo demanda y entrega los bytes por una ruta
  independiente. Eliminar la versión confirmada retira el PDF guardado.
  Eliminar un perfil retira sus borradores temporales y conserva las
  versiones guardadas. La aceptación por importador ATS sigue en CV-06.
- Client reúne plantilla, lectura, descarga y guardado al inicio del
  panel de vista previa. El resumen estructurado sigue disponible debajo.
  Compara el SHA-256 al recuperar el binario y carga el visor local de PDF
  por intención. El texto extraído y la descarga siguen accesibles si
  falla el visor. CV guardados conserva la identidad de cada versión en
  tabla desde `sm` y tarjetas en `xs`. Si falla la baja, se mantiene
  abierto el diálogo de confirmación con el cargo, perfil y versión.
- La matriz de renderer verificó ocho casos compilados por entorno
  Windows y Linux. En Nest y PostgreSQL aislado, los cuatro PDF de la
  matriz HTTP mantuvieron texto, orden y hash. Edge comprobó la
  descarga, el reintento de carga del visor y la eliminación en móvil
  y escritorio con datos sintéticos y cero intercambios de IA.
  [Evidencia CV-05](../evidence/nodia-cv-pdf-versions-20261124.md).

## 15. Piloto en VM y lectura externa CV-06 — 2026-11-24

- La VM de laboratorio recorrió alta y asignación de `/nodia-cv`,
  creación y duplicación de perfil, generación con API key real y una
  revisión que produjo Clásica y Compacta. La historia mantuvo los
  mismos bytes al reabrir y descargar. La segunda cuenta obtuvo
  aislamiento por titular y la revocación bloqueó la sesión anterior.
- El parser público oficial de OneATS reconoció nueve de diez
  comprobaciones en ambos PDF EN de una página. Identificó el teléfono
  nacional, empresa, cargo, ambos meses, formación y habilidades.
  La ubicación quedó en el país, con ciudad y estado vacíos. El piloto
  usó exclusivamente datos sintéticos, con cero postulaciones.
- El renderer `/2` y la vista previa agrupan empresa, cargo y período.
  Los meses preservan la precisión revisada. El formato de las versiones
  previas se conserva al reabrir sus bytes. La UI distingue el documento
  que se está revisando de cada versión guardada.
- La restauración con el journal ampliado preservó la versión legítima
  y evitó recuperar bajas de perfil o versión. La cuarentena retiró
  borradores y PDF temporales y rechazó trabajo no conciliado.
  Producción, CI ligado a un SHA remoto y cobertura real del journal
  quedan pendientes de adopción.
  [Evidencia CV-06](../evidence/nodia-cv-pilot-vm-and-ats-20261124.md).

## 16. Separación del despliegue de Gemini — 2026-11-24

El CD del [primer merge a master](https://github.com/oscarvalenzuela25/Nodia/pull/102)
validó los baselines y detuvo la preparación antes de solicitar migraciones
o publicación. La protección del CD exige una entrega coordinada cuando
cambia el adaptador de Gemini.
[Ejecución de CD](https://github.com/oscarvalenzuela25/Nodia/actions/runs/45473004012).

La promoción de Nodia CV conserva la generación API key, las cinco
migraciones, los PDF y el registro de recuperación. La implementación
completa del cambio de cuenta de Gemini queda en
[`codex/nodia-cv`](https://github.com/oscarvalenzuela25/Nodia/tree/a08ed9d5d905831b8522687fc24cee40524aca7d)
para actualizar el adaptador y sus consumidores en una entrega coordinada.
Esta promoción usa la protección de CD existente.

## 17. Continuación de CV-03 — generación Agentic — 2026-11-25

**Estado: host, borrador real y selector verificados en el piloto aislado
de la VM.** Rama `codex/nodia-cv-agentic`, basada en `development`.
El entregable inicial es un borrador válido desde **Generar CV** en la VM
con **ChatGPT / Agentic / GPT-6.2 Sol / Alto** (`gpt-6.2-sol`, `high`).
Después, verificar Gemini Agentic de forma independiente con un modelo
y nivel explícitos del catálogo vivo de su cuenta. Los modelos de este
plan son objetivos de prueba. La configuración y el catálogo siguen
resolviendo los IDs que puede ejecutar cada conexión.

El catálogo de CV proyecta modelos y modos de IA. El worker integra
Codex con descriptor, custodia y recibo de `owner_kind='cv'`. El
resultado usa el prompt, el esquema y el verificador de evidencia del
módulo, y la interfaz habilitará Agentic después de la calificación.
[ADR119](../architecture/decisions/ADR-119-nodia-cv-owned-generation-and-verified-pdf.md) ·
[Plan91](91-ai-provider-onboarding-verification.md#matriz-de-aceptación) ·
[Contrato de proveedores](ai-provider-feature-contract.md).

### Secuencia de implementación

#### 1. Confirmar la línea base y elegir el transporte de Codex

**Línea base del 2026-11-25.** La VM usa Codex `0.171.0`. El sondeo
dentro del namespace de montajes de la API confirmó la sesión existente
y el catálogo autenticado de OpenAI con `gpt-6.2-sol` en `high` (Alto).
El servicio de CV compilado reprodujo `agentic_transport_unavailable`
con cero despachos. La evidencia incluye el mapa de fronteras y el CHECK
de descriptor que requiere una extensión para CV.
[Evidencia del paso 1](../evidence/nodia-cv-agentic-baseline-vm-20261125.md).

Desde la raíz de la rama, una vez instaladas las dependencias bloqueadas:

```sh
git status --short --branch
npm --prefix nodia-server test -- src/nodia-cv/nodia-cv-selection.service.spec.ts src/nodia-cv/engine/engine.spec.ts
```

- [x] Revisar `nodia-cv-selection.service.ts`, `nodia-cv-generation.worker.ts`,
  `nodia-cv-generation.store.ts` y la migración `179398`. Trazar en una
  tabla qué pieza resuelve configuración, admisión, despacho, conciliación
  y ACK para API key. Identificar las columnas y restricciones Agentic ya
  existentes en el ledger antes de proponer otra migración.
- [x] Comprobar en la VM el runtime instalado, la sesión registrada y el
  descubrimiento exacto de `gpt-6.2-sol` con `high`, sin inferencia.
- [x] Completar la comparación de los contratos de proceso de Codex y
  Teacher en `ai-generation/` y `common/ai/codex/`. Registrar qué
  componentes necesita CV, incluido el host restringido si corresponde,
  con fuente, huella y entorno.
- [x] Reproducir el bloqueo actual en la selección de CV y comprobar que
  deja cero despachos. Ejecutar la regresión de generaciones por API key
  con transporte sintético y almacenar únicamente el resultado saneado.
  **Salida**: línea base, puntos de integración y transporte candidato
  delimitados. Si el host necesario falta, resolver su preparación aislada
  antes del probe real. La implementación y pruebas sintéticas pueden
  continuar durante esa preparación.

#### 2. Fijar el contrato de CV y la validación previa al envío

El transporte aislado está en `nodia-server/src/nodia-cv/agentic/`.
Las pruebas pasan por la admisión, el protocolo nativo, la prueba de
cierre y el verificador de CV. El host base ofrece aislamiento y un
solo turno, pero su catálogo incorporado de Codex Core `0.161.0`
carece de GPT-6.2 Sol. La compatibilidad del host que se use para esa
selección y la persistencia de las barreras corresponden al paso 3.
[Evidencia del transporte](../evidence/nodia-cv-agentic-baseline-vm-20261125.md#paso-2-transporte-y-pruebas-sintéticas).

- [x] Definir un descriptor versionado y un recibo nativo de CV. Vincular
  el dueño, actor, generación/intento, revisión, hash del payload, recurso
  Agentic y generación de configuración y sesión. Registrar también
  proveedor, conexión, modelo, esfuerzo y versiones de propósito, prompt,
  esquema, política y runtime. Probar rechazo de un recibo de otro
  intento, sesión, configuración, modelo, esfuerzo o dueño.
- [x] Resolver la selección explícita mediante el catálogo real y las
  restricciones de la conexión. Separar observación del runtime y de la
  sesión, transporte disponible para CV y calificación generativa. Hacer
  la observación externa fuera de las transacciones de autoridad y
  comparar la identidad antes de persistir. Elegibilidad y consultas de
  catálogo se mantienen sin inferencia.
- [x] Fijar una respuesta de texto estructurado y acotado para el
  pipeline de `cv-tailoring/1`. Reusar el minimizador y el verificador de
  evidencia de CV. Tratar la oferta como datos externos. Permitir solo
  el mecanismo necesario para devolver la salida si el adaptador lo
  exige, con cero herramientas de trabajo, adjuntos o acceso a archivos.
  Separar falta de evidencia profesional de un fallo del proveedor.
  **Salida**: contrato y pruebas unitarias de identidad, límites y salida.

#### 3. Integrar Codex con la cola y la recuperación de CV

La migración `1794041000000` integra el descriptor y el cierre de CV
en el ledger compartido. El host preparado verifica GPT-6.2 Sol en
Alto con metadatos oficiales y un backend sintético. PostgreSQL aislado
verificó el envío único, la revocación antes y después del envío, el
ACK recuperado y la copia con cierre pendiente. La adopción en la VM
y la calificación real corresponden al paso 4.
[Evidencia del paso 3](../evidence/nodia-cv-agentic-baseline-vm-20261125.md#paso-3-host-cola-y-recuperación-en-postgresql-aislado).

- [x] Reusar la sesión, primitivas de proceso y slot común con el
  propietario técnico de CV. Añadir la selección explícita de transporte
  al worker. Usar los campos existentes si cubren el ciclo y, si falta
  alguno, hacer una migración aditiva compatible con operaciones previas.
  Integrar esquema, contrato, DI y worker en ese orden.
- [x] Revalidar sesión, módulo, titular, revisión del perfil y selección
  al admitir, al reclamar, antes de despachar y antes de publicar. Fijar
  descriptor, lease/fence y presupuesto antes del intercambio. Mantener
  un solo despacho por intención, incluyendo doble clic, reinicio,
  concurrencia y relectura del recibo. La misma clave con otro insumo
  conserva el 409.
- [x] Distinguir error previo al envío, rechazo definitivo, respuesta
  inválida, cierre local no probado y resultado remoto `unknown`.
  Conciliar por la identidad del intento y cerrar el proceso con evidencia
  nativa. Persistir el terminal y su resultado antes del ACK al adaptador.
  Recuperar un ACK pendiente por su referencia exacta, con cero reenvíos
  generativos y sin cambio automático de proveedor o modo. Mantener los
  slots y el bloqueo del perfil hasta el hito que corresponda al contrato
  común. Ensayar la restauración con trabajo pendiente en una copia
  desechable y demostrar que conserva el recibo para conciliación sin
  volver a despachar. **Salida**: PostgreSQL aislado demuestra un envío,
  cierre, recuperación tras reinicio y regresión API key.

#### 4. Calificar Codex con una generación real y conectar la UI

El piloto instaló el host restringido, admitió una sola intención real
con la sesión existente y activó el selector tras verificar el borrador,
el cierre, el ACK y ambas plantillas. La selección exacta en Alto quedó
calificada y en Medio sigue requiriendo evidencia propia.
[Evidencia del paso 4](../evidence/nodia-cv-agentic-baseline-vm-20261125.md#paso-4-borrador-real-y-selector-en-el-piloto-aislado-de-la-vm).

- [x] Ejecutar el probe administrativo de CV en la VM con perfil y
  oferta sintéticos. Incluir un requisito respaldado y otro ausente.
  Comprobar un intercambio Agentic, respuesta estructurada válida,
  evidencia literal, brecha visible, cierre nativo, persistencia y ACK.
  La calificación se habilita únicamente al verificar el recibo exacto de
  CV, asociado a esa combinación y entorno. Probar que el cambio de
  nivel o sesión vuelve a pedir calificación para la nueva selección.
- [x] Usar el popover actual de `CvModelSelector`. Mostrar estados
  distintos para runtime ausente, sesión pendiente, modelo o esfuerzo
  ausente, selección sin calificar y selección elegible. Mantener
  **Aplicar configuración** y **Generar borrador** sujetos a la respuesta
  del Server para esa selección, al perfil guardado y a la oferta. El
  feedback ES/EN conserva perfil, oferta, foco y evaluación al reintentar
  o cancelar. El cambio de modelo durante una lectura ignora resultados
  anteriores. Verificar teclado, foco, 320 px y escritorio.
- [x] Completar el recorrido de usuario con una intención nueva tras la
  calificación. Verificar borrador, preview, revisión y render de Clásica
  y Compacta con texto extraído. Reabrir o descargar el PDF guardado por
  acción explícita y comprobar el mismo hash. Registrar la lectura ATS
  con el alcance del verificador utilizado. **Salida**: Codex habilitado
  en la VM solo para la selección comprobada.

#### 5. Integrar y calificar Gemini por el mismo contrato de CV

El piloto de la VM calificó **Gemini 4 Hydrogen en Alto** mediante un
único borrador sintético y un recibo de CV completado y confirmado.
El catálogo de CV publica esa combinación en Agentic. La elegibilidad
vuelve a comprobar la sesión y configuración vigentes. El caso Codex
de GPT-6.2 Sol en Alto conservó su calificación.
[Evidencia del paso 5](../evidence/nodia-cv-agentic-baseline-vm-20261125.md#paso-5-gemini-agentic-en-el-piloto-aislado-de-la-vm).

- [x] Comparar el adaptador privado de Gemini con el contrato del paso 2.
  Reusar su admisión exclusiva y cierre verificable con descriptor de CV.
  Confirmar la disponibilidad del ID y nivel exactos en la cuenta de la
  VM. Mantener las agrupaciones de modelo y razonamiento existentes.
- [x] Repetir aislamiento, cuota, caída, timeout, cierre y reinicio con
  las garantías del transporte Gemini. Después ejecutar su probe y
  verificar el selector en la UI con datos sintéticos. Registrar el
  alcance por combinación. **Salida**: el piloto anuncia únicamente la
  selección Gemini validada. La generación ordinaria y el guardado
  de versiones siguen en el recorrido de aceptación pendiente.

#### 6. Preparar la entrega y verificar adopción

El piloto verificó las dos selecciones Agentic desde **Generar borrador**
hasta reabrir y descargar sendas versiones guardadas. La promoción
requiere la atestación productiva del host Codex CV y la preparación
del SDK restringido de Gemini en el VPS.
[Evidencia del paso 6](../evidence/nodia-cv-agentic-delivery-20261125.md).

El cierre productivo utiliza el
[runbook de acreditación de CV](../../ops/production/ai-runtime/README.md#acreditación-productiva-de-nodia-cv-agentic--2026-11-25).
El PR de promoción queda sujeto a lectura positiva de ambos recibos en
el VPS y al CD por SHA. El paquete Codex y la imagen con SDK de Gemini
se prueban por separado antes de la ventana de activación.

- [x] Ejecutar en Server `npm test -- src/nodia-cv`, `npm run lint`,
  `npm run build`, `npm run knowledge:check` y la integración
  `npm run test:nodia-cv:generations` sobre PostgreSQL aislado. Correr
  `npm run test:nodia-cv:pdf-versions` para el recorrido de artefactos.
  En Client ejecutar `npm run typecheck`, `npm run lint`, las pruebas
  focales de CV y el build. Si cambia el adaptador Gemini, ejecutar
  `run_tests.py` en su entorno aislado.
- [x] Completar las celdas aplicables del [Plan91](91-ai-provider-onboarding-verification.md#matriz-de-aceptación)
  y registrar SHA, entorno, tupla, código terminal y alcance en
  `docs/evidence/`. Matriz mínima para ambos carriles: sin perfil,
  usuario ajeno, revocación, selección inválida, sesión ausente, cuota,
  salida inválida/excesiva, duplicación, timeout antes y después del
  despacho, reinicio antes del cierre y reinicio antes del ACK. Registrar
  por separado pruebas sintéticas, inferencia real y adopción.
- [x] Abrir PR a `development` y conciliar CI por SHA. La promoción a
  `master` se realiza después de la validación de VM y por el proceso
  autorizado de entrega. Si cambia el árbol Gemini, aplicar el
  [rollout coordinado](../../ops/production/ai-runtime/README.md#actualización-coordinada-del-adaptador-gemini--2026-11-24)
  y verificar el recibo del VPS antes de promover. Si cambia un host
  Codex, documentar su preparación y reversión bajo el runbook operativo
  antes de activar el carril. Pasar CI/CD y comprobar que el release
  sirve Server y Client con ambos runtimes acreditados.
- [ ] Completar la calificación generativa y el recorrido autenticado en
  producción según §18. Actualizar progreso,
  [pendientes](TODO.md#cola-actual) y
  [ficha candidata](../nodia-ai/knowledge/nodia-cv/features/tailoring-and-verified-versions.md#agentic-en-el-piloto-de-la-vm)
  con evidencia real y estado por proveedor.

El primer cambio de código corresponde al paso 2, después de completar
la línea base del paso 1. Integrar un paso con sus pruebas antes de abrir
el siguiente cambio en archivos compartidos de worker, ledger o contratos.

## 18. Agentic en producción — incidencia del 2026-11-26

El [PR 118](https://github.com/oscarvalenzuela25/Nodia/pull/118) promovió
CV Agentic. Se comprobaron el backend activo
`backend-89db0f0deb8a-51d8cf48b46f`, API y worker activos, ambos
recibos de instalación y el Client de Pages. El
[CD de la versión previa](https://github.com/oscarvalenzuela25/Nodia/actions/runs/45734973451)
terminó correctamente.

En el navegador autenticado, ChatGPT mostró GPT-6.2 Sol/Alto y rechazó
la selección por falta de habilitación para CV. El selector Agentic de
Gemini no ofreció modelos. Server proyecta para Gemini únicamente
combinaciones con recibo de CV para la configuración guardada. La
promoción anterior verificó runtimes en el VPS e inferencias en la VM.
La calificación de producción requiere un recibo de CV de la misma
conexión, modelo, esfuerzo, configuración y sesión.

El [operador de producción](../../ops/production/ai-runtime/README.md#calificar-una-selección-en-el-release-activo)
usa el caso de uso interno y el worker activo. Quedó preparado un
perfil ficticio de TypeScript desde el navegador de producción.
La observación productiva de ChatGPT `2 / gpt-6.2-sol / high` y
Gemini `1 / gemini-4-hydrogen-high / high` devolvió
`qualification_required` para ambas selecciones.

El VPS admitió la prueba de ChatGPT y el worker la mantuvo en cola con
cero intercambios. La consulta de candidatos consideraba pendientes tres
proyecciones históricas de Chat cerradas con resultado completado. Chat
conserva su propia prueba de cierre y la proyección de su ledger puede
permanecer sin el ACK compartido que usan CV y Tarjetas. La corrección
alinea el selector de CV con Teacher y Tarjetas. Los jobs activos o
inciertos de Chat y Teacher siguen impidiendo el despacho y el slot
del recurso conserva su comprobación.

PostgreSQL aislado reprodujo el bloqueo con el código publicado. La
prueba exige cero envíos mientras el job de Chat está incierto y un
envío cuando termina, con su proyección histórica intacta. Pasaron
la integración Agentic con el arreglo, el build y 161 pruebas focales
de Server. La integración de generación por API key también pasó en
una base PostgreSQL 16 desechable.

### Publicación y prueba en navegador

El [PR 125](https://github.com/oscarvalenzuela25/Nodia/pull/125)
entró a master en `1239145f` y pasó
[CI de publicación](https://github.com/oscarvalenzuela25/Nodia/actions/runs/45840722196).
El [CD](https://github.com/oscarvalenzuela25/Nodia/actions/runs/45843244723)
perdió el sondeo de estado con `backend_poll_outcome_unknown`. La
consulta restringida de la operación `aa145def13ea7721ae58c91cfd6fe50c`
confirmó `complete`. El VPS confirmó el release
`backend-1239145f21a8-d29282c456cd`, ambos servicios activos y sin
bloqueo. El CD omitió Pages. El artefacto candidato y el Pages ya
publicado coinciden en los 289 recursos, la configuración pública y
la huella de árbol `9aac600d7b79e9ee3cd23217a1d7e682927789bcca9a08091a04b2c19d887c9a`.
La prueba del navegador usó ese origen público con el backend nuevo.
El [PR 126](https://github.com/oscarvalenzuela25/Nodia/pull/126)
devolvió el cambio a development. Su
[CI del merge](https://github.com/oscarvalenzuela25/Nodia/actions/runs/45841565208)
pasó.

| Selección exacta | Inferencia de calificación en producción | Recorrido ordinario |
| --- | --- | --- |
| ChatGPT `2 / gpt-6.2-sol / high` | `3f11a17b-8510-4e9d-b6b7-be0bc322ebc0` · un intercambio, borrador válido, cierre, ACK y elegibilidad | Se aplicó Agentic en Alto, se generó y se verificaron TypeScript con evidencia y Kubernetes como brecha. Se guardó la versión 1 en Clásica y español, se reabrió después de recargar y se descargó el PDF verificado. |
| Gemini `1 / gemini-4-hydrogen-high / high` | `dae7a714-4cb4-4e99-95c6-f93dcfe18a67` · un intercambio, cierre y ACK, resultado remoto `unknown` | El selector permanece bloqueado para Gemini. El diagnóstico interno registró un HTTP 200 y `reply_finish_missing` con cierre local comprobado. Se conservó el intento sin reenvío. |

El primer intento de ChatGPT en el release anterior venció en cola y
carecía de intento de proveedor. La prueba del release nuevo tuvo
una clave propia. El PDF descargado tras reabrir la versión de QA
contiene una página A4 y 13 331 bytes. Su SHA-256 es
`1b0ab6bc7f6df09d6202232516aaf878cb5ac5c401aeaa3f3855faf3170a0994`.
La interfaz confirmó la lectura de esos bytes y mostró TypeScript
en el texto extraído.

El primer pendiente de Agentic es resolver la falta de finalización
estructurada de Gemini, con evidencia propia de su transporte. La
respuesta anterior no habilita la selección ni autoriza su replay.

## 19. GPT-6.1 Sol en el selector Agentic — 2026-11-26

Por solicitud del usuario, la conexión productiva ChatGPT `2` incorpora
`gpt-6.1-sol` al catálogo guardado. El catálogo autenticado de Codex
`0.171.0` y la comprobación del host de CV confirmaron ese ID en Medio.
Se guardó el modelo descubierto mediante el caso de uso de configuración,
en el release `backend-1239145f21a8-d29282c456cd`. GPT-6.2 Sol en Alto
conservó su asignación principal. [Contrato del catálogo](ai-provider-feature-contract.md#gpt-61-sol-en-agentic--2026-11-26).

La ampliación generó una configuración nueva. El worker de producción
emitió un recibo con un intercambio, borrador válido, cierre y ACK para
cada selección.

| Selección ChatGPT Agentic | Generación de calificación | Elegible desde UTC |
| --- | --- | --- |
| `gpt-6.2-sol / high` | `c55afde1-9f13-48e7-8d93-730e7b5c599a` | `2026-11-26T15:44:13.256Z` |
| `gpt-6.1-sol / medium` | `c9c3084f-baf3-41c4-a957-43630c95c265` | `2026-11-26T15:45:11.059Z` |

El navegador de producción mostró los dos modelos en **Generar CV**.
Tras recuperar el recibo anterior, se aplicó 6.1 Sol en Medio y se
generó una oferta ficticia nueva. El borrador mostró TypeScript con
evidencia y Kubernetes como brecha. El PDF Clásico en español pasó
la lectura interna de una página y mostró el texto seleccionable.
El recorrido cubre las selecciones y esfuerzos de la tabla.
[Ficha candidata](../nodia-ai/knowledge/nodia-cv/features/tailoring-and-verified-versions.md#agentic-en-producción).

## 20. Primera generación y recuperación por versión — 2026-11-26

Codex sirve de referencia para iniciar una tarea con cualquier modelo
compatible que ofrece su selector. Nodia CV aplica la misma elección al
primer borrador e incorpora la revisión del perfil, la oferta y la
verificación del PDF en su flujo propio.
[Regla principal de IA en AGENTS.md](../../AGENTS.md#regla-principal-de-ia--codex-como-referencia-2026-11-26).

La solicitud explícita cambia la admisión de Nodia CV para ambos modos.
La calificación por modelo y configuración descrita en §17–19
documenta el comportamiento anterior. Cambiar de modelo o intensidad
puede iniciar su primera generación desde el botón normal siempre que
la selección real sea compatible con el transporte de CV. El clic usa
una intención propia. La consulta de elegibilidad, los cambios de
selector y la navegación son lecturas de estado.

Server verifica autoridad, credencial o sesión, modelo e intensidad
exactos y disponibilidad del transporte aplicable. El worker revalida
la configuración y reserva antes de enviar. La respuesta se publica
después de validar el borrador y conciliar el cierre conforme al
transporte. La incertidumbre remota mantiene la referencia original.
Las pruebas [Plan91](91-ai-provider-onboarding-verification.md) acreditan
comportamiento por combinación y entorno. Los recibos históricos
conservan su alcance de diagnóstico.

**Generar CV** mantiene separado el formulario de lo que la persona acaba
de generar. Cambiar de insumos o salir de esa pestaña limpia la vista
previa anterior y los requisitos que le pertenecían. Volver a abrir la
sección muestra la vista inicial. Los trabajos en curso o de resultado
incierto conservan acceso a su estado sin reenviar inferencia.

**CV guardados** lee los requisitos, estados y evidencia archivados en la
versión elegida. El análisis es de solo lectura y conserva la misma
identidad de revisión que el PDF. El detalle de versiones anteriores
recupera el análisis si todavía existe el artefacto temporal y coinciden
su propietario, revisión y huellas. Cuando ya falta esa fuente exacta, el
detalle indica la ausencia del análisis y ofrece el PDF archivado.

[Guía UI](../features/nodia-cv/ui-design.md#3-generar-cv) ·
[Ficha candidata](../nodia-ai/knowledge/nodia-cv/features/tailoring-and-verified-versions.md) ·
[ADR119 propuesto](../architecture/decisions/ADR-119-nodia-cv-owned-generation-and-verified-pdf.md).

### Control previo en producción

En una pestaña de QA y con un perfil sintético, el catálogo de ChatGPT
Agentic ofrecía GPT-6.1 Sol en Bajo. Al seleccionar esa intensidad, la
interfaz de producción mostraba «Esta selección exacta aún no está
habilitada para generar CV» y deshabilitaba aplicar y generar. Se registró
el bloqueo sin enviar una solicitud de inferencia. La misma selección es
el control para la verificación del despliegue.

### Verificación posterior al despliegue

El navegador generó y comprobó el PDF con GPT-6.1 Sol en Bajo,
GPT-6 Luna y Gemini 4 Neon en Bajo por Agentic, y con GPT-6.1 Terra
en Alto por API key. Después de guardar y salir de Generar CV, reabrir
la versión en CV guardados recuperó sus requisitos. La migración
recuperó también los de una versión histórica cuya fuente seguía vigente.
[Resultados y entrega](../evidence/nodia-cv-first-use-production-20261126.md).

## 21. Guardar o descartar antes de salir — 2026-11-26

El control previo en producción confirmó otra causa del botón inhabilitado.
Una recarga después de generar conservaba un recibo en la pestaña. Aunque
ChatGPT Agentic con GPT-6.1 Sol en Alto mostraba disponibilidad, la
interfaz exigía recuperar la oferta y el borrador anteriores.

Al cambiar de pestaña interna, salir por una ruta de Nodia o pedir otra
generación con un borrador listo sin guardar, elegir **Seguir editando**,
**Descartar** o **Guardar borrador**. Guardar reutiliza el artefacto
comprobado de la revisión y plantilla activas o lo prepara para guardar la
versión. Un error conserva el diálogo y el borrador. Descartar retira la
vista y su referencia local. El almacenamiento temporal de Server mantiene
su vencimiento. Las versiones se reabren en **CV guardados**. Para recarga
o cierre de la pestaña se presenta el aviso nativo cuando está disponible.

La referencia de generación se conserva para comprobar ocupación,
idempotencia y estado remoto. Se consulta con la autoridad vigente al
generar una nueva solicitud. La lectura conserva la edición actual y
ningún resultado previo se abre por esta vía. Una referencia terminada
o expirada deja continuar y una intención igual en curso o incierta
mantiene su propia identidad. Si la referencia anterior aún devuelve 404,
una continuación explícita utiliza esa misma clave para resolver una
admisión concurrente sin enviar otra clave para la misma operación.
[Guía UI](../features/nodia-cv/ui-design.md#33-estado-del-trabajo).
[Verificación en producción](../evidence/nodia-cv-draft-workflow-production-20261126.md#guardar-o-descartar-al-salir).

## 22. Edición del borrador con IA — 2026-11-26

Tras generar un borrador, **Editar con IA** acepta una instrucción como
«prioriza las competencias», «acorta la experiencia» u «omite los
proyectos». La primera entrega selecciona, omite y ordena datos
verificados del perfil y conserva las citas de la oferta y la evidencia
confirmada. La redacción libre que altera el sentido de una afirmación
requiere un contrato de revisión de hechos adicional.

Codex conserva el contexto al pedir una corrección. Nodia CV conserva la
oferta, el perfil y la revisión exacta y presenta una propuesta privada
antes de cambiar el borrador activo. La edición muestra la misma
selección de IA aplicada, con su conexión, modo, modelo e intensidad.
Ante error o resultado incierto, la persona conserva el borrador y la
instrucción. La consulta recupera por la clave original.

La admisión autenticada `POST /drafts/:id/ai-edits` usa la clave
idempotente, la revisión esperada, la instrucción y la selección aplicada.
La cola y el transporte de CV conservan presupuesto, autorización,
control de configuración y cierre comprobado. El trabajo hijo conserva
el perfil, la oferta y el alcance de revisión de la solicitud original.
La propuesta valida qué datos existen en la fuente y deja los documentos
guardados intactos.

**Aplicar cambios** comprueba la revisión base y activa la propuesta.
**Conservar original** retorna al borrador que se estaba revisando.
Render, vista previa y PDF aplican el mismo orden de la revisión activa.
Guardar o descartar sigue siendo una decisión independiente del resultado
de IA.

[Guía UI](../features/nodia-cv/ui-design.md#34-editar-con-ia) ·
[Ficha candidata](../nodia-ai/knowledge/nodia-cv/features/tailoring-and-verified-versions.md) ·
[ADR119 propuesto](../architecture/decisions/ADR-119-nodia-cv-owned-generation-and-verified-pdf.md).
[Prueba en producción](../evidence/nodia-cv-draft-workflow-production-20261126.md#editar-con-ia-y-reabrir-el-cv).
