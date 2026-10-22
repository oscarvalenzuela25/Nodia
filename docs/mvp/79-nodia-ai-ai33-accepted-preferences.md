# NodiaAI AI-33 — preferencias aceptadas

> Estado documental: en revisión; sin aprobación automática.
> Fecha: 2026-10-18.
> Estado técnico: implementado, verificado y activado en laboratorio.

[Plan45](45-nodia-ai-implementation-plan.md) · [Contratos41](41-nodia-ai-v1-contracts.md) · [ERD42](42-nodia-ai-erd.md) · [Arquitectura43](43-nodia-ai-execution-architecture.md) · [Política50](50-nodia-ai-ai04-runtime-policy.md) · [ADR-058](../architecture/decisions/ADR-058-nodia-ai-accepted-preferences.md) · [Ficha](../nodia-ai/knowledge/nodia-ai/features/accepted-preferences.md).

## Alcance y consentimiento

Una preferencia es una referencia de producto que el dueño aceptó recordar. No es una instrucción libre, permiso, credencial ni un efecto de negocio. Crear, editar y borrar reutilizan propuesta/revisión inmutable, vista previa exacta, desafío, botón humano, ejecución y recibo atómico. Preparar nunca guarda una preferencia aceptada. Un patrón observado o una respuesta del modelo no autoriza aprenderla silenciosamente.

La lista pertenece al usuario autenticado. La inspección de otro chat por super_admin no permite escribir recuerdos en nombre de su dueño ni mezclar esas preferencias con las propias. El administrador conserva sus facultades transversales sobre referencias de productos conforme a las reglas nativas; cada recuerdo sigue teniendo un dueño personal.

## Registro inicial de valores

| Ámbito | Clave | Valor | Scope |
|---|---|---|---|
| finance | expense_category_id | ID de categoría financiera autorizada y activa | `{}` |
| finance | income_category_id | ID de categoría financiera autorizada y activa | `{}` |
| business | business_id | UUID de negocio autorizado y activo | `{}` |
| business | supplier_id | ID de proveedor autorizado perteneciente al negocio indicado | `{ "business_id": "UUID" }` |
| rental | property_id | ID de alojamiento autorizado y activo | `{}` |

El catálogo es único en backend; la UI consulta metadatos y opciones paginadas con etiquetas reales. No hay editor JSON ni IDs técnicos como selector de producto. Categorías financieras no tienen tipo nativo: expense/income expresa para qué uso se aceptó la preferencia, no inventa una clasificación de la entidad. No recordar estados pagado/pendiente ni decidir obligatorios ambiguos a partir de un patrón.

Las claves, scopes y tipos están cerrados. UUIDs se normalizan para que distintas representaciones no creen recuerdos duplicados. El límite inicial de50 preferencias por dueño es un presupuesto propio de Nodia, centralizado y aplicado también bajo concurrencia; no una cuota del modelo. Ampliar el registro exige validación de referencias, presentación, contexto y pruebas de esa nueva clave.

La autorización conserva la diferencia nativa entre favoritos de negocio y proveedores: el negocio favorito exige acceso como dueño/colaborador o super_admin; los proveedores mantienen el acceso global autenticado del recurso, con pertenencia exacta al negocio y actividad. El selector de scope de proveedor usa `for_supplier_scope=true` exclusivamente con `scope_key=business,key=business_id`; no amplía el selector de negocios favoritos ni los permisos del producto.

## Coordinación HTTP

Todas las rutas requieren sesión y NodiaAI y responden `Cache-Control: no-store`. No hay un endpoint CRUD directo que salte el consentimiento.

| Método y ruta | Contrato |
|---|---|
| GET `/nodia-ai/preferences` | Lista propia paginada, revisión, disponibilidad y etiquetas autorizadas; incluso super_admin recibe sólo sus recuerdos. |
| GET `/nodia-ai/preferences/catalog` | Registro cerrado de claves y scopes aplicable a los módulos actuales del actor. |
| GET `/nodia-ai/preferences/options` | Referencias elegibles paginadas; sin SQL arbitrario ni catálogo estático en cliente. |
| POST `/nodia-ai/preferences/prepare` | HTTP200; `conversation_id` y operación create/update/delete. Crear incluye scope/key/value; editar incluye ID/revisión/value; olvidar incluye ID/revisión. Devuelve preparación/aclaraciones o propuesta, nunca aceptación implícita. |

La confirmación y consulta de ejecución reutilizan los contratos comunes existentes. Los tres nombres internos `nodia_preferences_prepare_create`, `nodia_preferences_prepare_update` y `nodia_preferences_prepare_delete` son adaptadores de preparación, sin publicación MCP en esta entrega. Los recibos contienen identidad/revisión del efecto, sin copiar el valor de la preferencia.

## Persistencia y ejecución

M4 incorpora sólo `nodia_ai_preferences`, con identidad UUID, dueño, scope/key/value, hash del scope, revisión, origen opcional en chat/paso y timestamps. Unicidad por dueño/hash de scope/clave. No hay tablas de candidatos, aprendizaje, auditoría adicional o snapshots de contexto de AI-34. Orígenes SET NULL permiten que purgar el chat y su recibo no borre el recuerdo aceptado.

La creación requiere ausencia; edición y eliminación requieren identidad/revisión exactas y la precondición congelada en la propuesta. El efecto y su recibo se confirman en la misma transacción. Reentregar el trabajo recupera el recibo, sin duplicar ni reponer una preferencia borrada posteriormente. Una corrección material genera otra revisión y exige volver a confirmar.

Crear/editar reautorizan NodiaAI, módulo de destino y referencia/relaciones actuales al preparar y al aplicar. Olvidar un recuerdo propio exige NodiaAI y confirmación pero no recuperar acceso al recurso perdido. La lista puede mostrarlo como no disponible, sin resolver etiquetas de un dominio revocado; no se aplica al contexto. No borrar datos de Negocios, Finanzas o Reservas al olvidar su referencia.

## Contexto y límites de la memoria

El worker carga únicamente recuerdos propios aceptados y actualmente autorizados, mediante consultas por conjuntos. Los incluye como datos JSON separados del historial; no los eleva a instrucciones o capacidades. El mensaje actual prevalece y las dudas se aclaran. Los preparadores de dominio mantienen sus campos explícitos y su preview: esta etapa no introduce relleno silencioso de comandos ni atribuye `accepted_preference` a valores que el humano eligió expresamente en un formulario.

El manifiesto del turno conserva IDs, revisiones y hashes, sin otra copia de los valores/etiquetas. Antes de enviar al proveedor se revalida su fingerprint tras observación y al armar el envío durable, en la misma transacción de autoridad/fence/presupuesto. El lock del dueño comparte orden con las mutaciones para cubrir también inserciones. Si cambia la memoria o su disponibilidad antes de esa frontera, falla con `preferences_changed` sin enviar una inferencia. No hay red ni espera humana dentro de esa transacción.

El rechazo tipado exacto del validador local demuestra que no se armó el envío y mantiene un fallo conocido. Si una cancelación o deadline gana mientras SQL está pendiente, se conserva `unknown` y la conciliación del slot; una respuesta tardía de SQL no permite continuar hacia el proveedor. Una excepción genérica o respuesta de commit perdida no demuestra rollback ni habilita replay.

Eliminar una preferencia impide aplicarla como memoria vigente en futuros envíos; no reescribe mensajes históricos ni demuestra borrado en la infraestructura del proveedor. Las preferencias no reinician los90 días del chat y permanecen hasta olvido explícito. El contexto total sigue sujeto a su presupuesto de bytes; no truncar recuerdos silenciosamente.

## Interfaz y publicación

Panel cargado por intención desde la página NodiaAI: lista, propuesta para recordar, editar y olvidar. Selección por nombres, scopes explícitos y mensajes ES/EN; errores conservan formularios y borradores. La propuesta se revisa con los componentes de confirmación existentes; ningún submit directo crea/modifica memoria aceptada.

Los preparadores internos y el acceso HTTP humano no publican herramientas MCP por sí solos. La propuesta automática desde Gemini depende de la publicación y aceptación de su herramienta en la etapa correspondiente, como los demás preparadores de dominio. No se amplía el catálogo nativo ni se afirma una nueva inferencia por implementar este panel.

## Activación y reversión

La migración `CreateNodiaAiPreferences1792900000000` es aditiva y se aplica antes de activar API/worker nuevos. Respaldar base y archivos vigentes, comprobar cola sin trabajo arrendado, preservar perfiles/modelos/credenciales y reiniciar sólo API/worker. Gemini no cambia en esta etapa. Contrastar archivos compilados, ledger y salud con el reporte operativo de la entrega.

Si se revierte el código, conservar la tabla aditiva y sus recuerdos. `down` rechaza una tabla con preferencias aceptadas: no usarlo como limpieza ni restaurar un backup anterior sobre recuerdos nuevos. Cualquier reversión de datos exige conciliación explícita independiente. La expiración del chat continúa purgando sus mensajes/adjuntos y pone los dos orígenes de memoria en NULL; no borra la memoria.

## Verificación

- Backend completo:3.400 pruebas en216 archivos, anteriores a las dos correcciones finales; después,290 pruebas en cuatro suites de recibo/confirmación/ejecución y98 en cuatro suites de contexto/runtime. No sumar esas pasadas como tests distintos. Build de producción, TypeScript de producción y lint de archivos afectados correctos. [Backend](../evidence/nodia-ai-ai33-backend-validation.json) y [runtime](../evidence/nodia-ai-ai33-runtime-validation.json).
- Cliente:1.705 pruebas en223 archivos correctas en la pasada final con dos workers;499/31 de NodiaAI focales, tipado/lint/build correctos. Un timeout anterior de un chunk en ProvidersTab se conserva y pasó13/13 aislado; no se ampliaron plazos para ocultarlo. [QA visual](../evidence/nodia-ai-ai33-ui-validation.json): fixture HTTP aislado, ES/EN, claro/oscuro,320/599/600/900/1440px sin overflow, preview de negocio coherente, un desafío/confirmación, lista actualizada y borrador preservado. Cero mensajes o cambios de conexión enviados por esa prueba.
- [PostgreSQL compilado](../evidence/nodia-ai-ai33-sql-validation.json):36 comprobaciones con Nest real y PostgreSQL desechable. Cinco claves, consentimiento exacto, CAS, pertenencia y módulos, revocación, etiquetas privadas, rollback, respuesta de COMMIT perdida, replay, orígenes SET NULL y memoria independiente. Dos propuestas confirmadas desde49 respetan serialización nativa por actor y dejan50 recuerdos/un recibo nuevo; el segundo efecto se rechaza. No afirmar dos efectos paralelos del mismo actor, que el contrato nativo impide.
- Frontera de envío comprobada en SQL: cambio tras ensamblado no arma intento ni presupuesto y libera el slot. Cancelación mientras SQL de arming sigue abierto conserva unknown; al confirmar tarde el arming queda un presupuesto reservado y el slot en conciliación, con cero llamadas al adaptador. Cuatro observaciones del adaptador de prueba son sintéticas; cero generaciones del proveedor y operaciones de almacenamiento en esa suite. Sandboxes retirados.
- Hallazgos conservados: intento SQL inicial falla por registro incompleto de PreferenceEffectReceipt; corregido y cubierto por tres tests de proyección. El intento de capacidad paralelo usó indebidamente un segundo claim simultáneo del mismo actor; se corrigió el arnés respetando la serialización. Una revisión independiente detectó la carrera de cancelación durante armDispatch; fix, cuatro regresiones y SQL36 posteriores. El fixture visual inicial reutilizaba etiquetas financieras al escoger negocio; corregido antes de verificar exactitud de preview.

[Activación](../evidence/nodia-ai-ai33-activation.json), [backup](../evidence/nodia-ai-ai33-backup-verification.json) y [salud final](../evidence/nodia-ai-ai33-final-health.json):923 outputs idénticos,27 migraciones,20 tablas NodiaAI/279 columnas y tabla de preferencias vacía. Respaldo privado de296.521B antes de M4; catálogo de596 entradas de pg_restore comprobado después del rollout, sin atribuirlo al preflight. Sólo API/worker reiniciados; Gemini92 fuentes y configuración preservados. Cuatro servicios activos, HTTP200 y cero trabajos/intentos/slots pendientes; chat R05 conservado.

[Lectura de UI real](../evidence/nodia-ai-ai33-ui-real-validation.json): lista vacía y catálogo de dos claves de Negocios, consistente con los siete módulos efectivos. [SQL de autoridad](../evidence/nodia-ai-ai33-catalog-authority.json) confirma que Finanzas y Reservas aún no existen como módulos en esa BD; no se crearon automáticamente ni se ampliaron permisos. Las cinco claves registradas se verificaron con configuración explícita en SQL aislado. Panel cerrado y mensaje original vacío al terminar, sin guardar recuerdos ni propuestas operativas.

[Consolidado reproducible](../evidence/nodia-ai-ai33-validation.json). Esta entrega no realiza nuevas inferencias, operaciones R2, publicación de preparadores MCP ni aceptación productiva AI-38. AI-34 conserva compactación y snapshots como siguiente etapa.
