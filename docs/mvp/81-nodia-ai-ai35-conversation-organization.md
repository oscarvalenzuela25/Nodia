# NodiaAI AI-35 — organización e interacción final del chat

> Estado documental: en revisión; sin aprobación automática.
> Fecha: 2026-10-18.
> Estado técnico: implementado, verificado y activado en laboratorio; sin aprobación documental ni aceptación productiva automática.

[Plan45](45-nodia-ai-implementation-plan.md) · [Contratos41](41-nodia-ai-v1-contracts.md) · [Política50](50-nodia-ai-ai04-runtime-policy.md) · [ADR-060](../architecture/decisions/ADR-060-nodia-ai-authorized-text-search.md) · [Ficha](../nodia-ai/knowledge/nodia-ai/features/conversation-organization.md).

## Organización

La página incorpora búsqueda por título/texto, filtros de archivado y fijadas, y acciones de renombrar, fijar/desfijar y archivar/desarchivar. Usa las rutas existentes de conversaciones y su paginación backend; no filtra ni reordena páginas localmente. El orden sigue updated_at/id descendente. Una conversación archivada sigue accesible por su enlace y conserva las mismas reglas de vigencia. Organizarla no reinicia los90 días: sólo un mensaje nuevo del dueño cambia la actividad humana relevante.

El rol super_admin se obtiene del contexto de autorización cargado. Permite escoger ámbito propio/global; los chats ajenos siguen de sólo lectura conforme al contrato existente. La API revalida acceso, sesión, propiedad, revisión y estado ocupado. La UI no infiere permisos del rol que acompaña un objeto de usuario ni habilita escrituras por mostrar un chat.

Cada PATCH envía únicamente el metadato solicitado y expected_conversation_revision. La respuesta debe conservar identidad, coincidir con el cambio solicitado y avanzar exactamente una revisión. Un conflicto o fallo conserva el formulario y su título; «Revisar estado actual» obtiene la nueva revisión sin sobrescribir el texto editado. El reintento necesita otro clic. No hay replay ni cierre del modal por error. Título vacío se representa como null y el límite es256 bytes UTF-8. La búsqueda mayor que ese límite muestra aviso y no reemplaza la consulta aplicada.

## Búsqueda autorizada y almacenamiento

Se busca sólo el título y partes textuales visibles de mensajes escritos por el dueño o el asistente, con scope válido y autorizado. No se buscan adjuntos, transcripciones, interpretaciones de archivos, mensajes de herramientas, snapshots ni preferencias. Comodines se escapan como contenido literal. Los cursores rechazan fechas imposibles antes de consultar PostgreSQL y conservan microsegundos. Una búsqueda sin resultados no implica que no exista información fuera de ese ámbito.

La migración añade un único índice GIN parcial pg_trgm, sin tablas o columnas nuevas. [ADR-060](../architecture/decisions/ADR-060-nodia-ai-authorized-text-search.md) documenta alternativas, mediciones y bloqueo transaccional del despliegue. Términos amplios/cortos y consultas globales auditadas conservan costes que debe ampliar AI-37; no se declaran objetivos productivos a partir de datos sintéticos.

## Interacción, acceso y recuperación

Filtros y formularios viven por encima de los contenedores responsive para conservarse al cambiar de breakpoint. El borrador del compositor pertenece al chat y no se borra al organizarlo. Los controles de navegación se bloquean mientras se graba voz. Cargar mensajes antiguos conserva la posición relativa del lector; el navegador no añade un segundo anclaje automático. Los mensajes parciales llevan una etiqueta explícita en ES/EN, sin aparentar una respuesta completa ni streaming nuevo.

Colapsar una propuesta o su actividad histórica conserva el editor ya abierto. La carga inicial sigue por intención; al ocultar se detienen las lecturas/polling asociados, y reabrir revalida sin perder el borrador. Una mutación pendiente o de resultado incierto impide ocultar el editor. Los controles de expansión anuncian región y estado mediante ARIA. El drawer de configuración mantiene cabecera y acciones accesibles con contenido desplazable; controles de adjuntos envuelven texto y conservan superficie táctil.

401/403/404/410 retiran el contenido privado observado y su caché vinculada: títulos/listados, detalle, mensajes, adjuntos y resultados dejan de renderizarse. Se cancelan lectores pendientes para impedir que una respuesta tardía repueble datos retirados. No se borra otro actor/sesión. Un500 conserva contenido previo y borradores con error visible. Recuperar acceso exige reintento explícito conjunto de detalle e historial, evitando presentar una historia vacía como recuperación exitosa. Las notificaciones de mutación se emiten una vez mediante Sileo, traducidas, con el mensaje de servidor cuando existe.

## Verificación y límites

La integración de PostgreSQL usa una base desechable con migraciones reales y corpus sintético. La QA de navegador usa la página real y un adaptador HTTP sintético cerrado, aislado de BD, micrófono y proveedores. Permite reproducir paginación, cambiosCAS,503/409/403/500, borradores, parciales, propuestas, informes y pasos. No equivale a una inferencia Gemini, acceso R2 ni aceptación productiva.

AI-35 no añade carpetas, globo global, exportación nueva, publicación de herramientas de escritura ni nuevos modos/modelos. El microservicio Gemini y sus sesiones conservan su verificación anterior; los formatos nativos no se revalidan por cambios de interfaz. AI-36..38 mantienen paridad/aceptación de extremo a extremo, rendimiento/carga y operación/restore por entorno.

## Evidencia por capa

- [Casos de uso y cliente](../evidence/nodia-ai-ai35-unit-validation.json): suites, tipado de producción, lint y build. El tsc global de fixtures conserva192errores/48archivos, idénticos al baseline AI-34; cero errores en los archivos backend modificados.
- [SQL47](../evidence/nodia-ai-ai35-sql-validation.json): permisos/revocación, fuentes excluidas, filtros/cursor/calendario, migraciones up/down/up pobladas, extensión compartida/esquema ajeno y roles no superuser. [Regresión AI-34](../evidence/nodia-ai-ai35-ai34-regression.json):36checks sobre el mismo build/pin; el arnés apunta a su migración exacta en lugar de asumir que sigue siendo la última.
- [Medición intercalada](../evidence/nodia-ai-ai35-search-performance.json): mismo plan sin GIN en las consultas amplias; una muestra amplia ronda3,7s. Mejora selectiva acreditada; rendimiento global/productivo no declarado.
- [QA navegador](../evidence/nodia-ai-ai35-browser-qa.json):24 perfiles ES/EN claro/oscuro y320..1440px, sin overflow ni errores finales. Borradores de mensaje/propuesta/filtro conservados,503/403/500, informe y resultados por paso;409 y CAS también comprobados en integración de componentes. Reproducción fallida inicial de anclaje corregida; diez mensajes antepuestos conservan posición con delta0,56px. Se corrigieron también keys iguales de drawers hermanos; no se ocultó el warning.
- [Activación](../evidence/nodia-ai-ai35-runtime-activation.json) y [salud](../evidence/nodia-ai-ai35-final-health.json): backup privado y única migración28→29;932outputs Node,21tablas/289columnas, índice válido y pin de58fuentes/31excluidas. Conserva27fragmentos/67lecturas, sin publicar escrituras. Gemini99fuentes permanece sin reiniciar; servicios activos y cero pendientes.

La lectura de la página real en5174 conserva el chatR05 y sus tres adjuntos. Una búsqueda por el marcador sintético de su respuesta devuelve un chat; se limpió el filtro y se cerró el historial sin enviar mensajes ni modificar metadatos. Esa lectura no revalida los binarios o formatos del proveedor. La aceptación productiva, teléfono físico, carga/concurrencia y coste de auditoría global siguen en AI-36..38.

**AI-35 cierra técnicamente en laboratorio.** Server3543/219 y Client1768/227, builds y lint correctos (tres warnings previos Server). El [consolidado verificable](../evidence/nodia-ai-ai35-validation.json) enlaza cada capa y sus hashes; el tipado global de fixtures conserva su deuda previa explícita. Ficha draft/unregistered y ADR propuesto. Siguiente AI-36: pruebas integrales y cobertura por capacidad; no se declara aceptación de todas las escrituras o configuraciones por esta entrega.
