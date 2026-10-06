# Contactos de proveedores

> Estado: en revisión
> Fecha: 2026-10-05
> Dependencias: [modelo de dominio](03-domain-model-erd.md), [restricciones de diseño](07-design-constraints.md), [revisión técnica](19-prelaunch-review.md), [ADR propuesto](../architecture/decisions/ADR-014-provider-contacts.md)

La ampliación permite registrar vendedores, contactos de despacho y otras personas o áreas asociadas a un proveedor comercial. El usuario autorizó la implementación el 2026-10-05: Server y Client están implementados y verificados localmente. Tras revisar la incidencia de endpoints reportada, la migración está aplicada en la BD local configurada, con respaldo previo. Aprobación documental, sesión real y otros entornos siguen pendientes.

## Requisitos expresados

- Nueva tabla `personal_info_provider`, vinculada a `providers` mediante `provider_id bigint`, con ID autoincremental, nombre requerido, teléfonos y email opcionales, horario, comentario opcional, estado activo y fechas de creación y actualización.
- Varios teléfonos: botón para agregar un input, deshabilitado mientras exista un teléfono nuevo sin completar. Selector de prefijo internacional a la izquierda, con Chile `+56` preseleccionado.
- En el listado, cada teléfono tiene acciones para copiar y abrir WhatsApp Web; el email tiene acciones para copiar y redactar un correo.
- Horarios inicialmente colapsados. Al expandir, mostrar los siete días con hora de inicio, fin y descripción opcional.
- Confirmado por el usuario el 2026-10-05: el horario pertenece a cada contacto. Se almacena en `personal_info_provider.schedule`; distintos contactos del mismo proveedor pueden tener horarios diferentes.
- Mantener el diseño de los desarrollos existentes y un scroll cómodo para formularios extensos.

## Hechos del sistema actual

`providers` pertenece a un negocio y contiene nombre, impuesto, configuración de columnas de facturas, estado y fechas. Su clave primaria bigint se representa como string en TypeScript. El formulario actual usa `BaseModal`, `TextInput`, React Hook Form, Zod y el switch de estado de Core.

`BaseModal` separa encabezado, contenido desplazable y acciones. Su contenido ya implementa scrollbars delgadas con pista transparente y adaptación al tema. Los nombres de proveedores actualmente se convierten a minúsculas; ese comportamiento no debe trasladarse automáticamente a nombres de personas.

Referencias: `nodia-server/src/provider/entities/provider.entity.ts`, `nodia-server/src/provider/dto/create-provider.dto.ts`, `nodia-server/src/provider/provider.service.ts`, `nodia-client/src/modules/business/pages/BusinessDetail/components/ProvidersTab/components/ProviderModal/ProviderModal.tsx` y `nodia-client/src/components/BaseModal/styles.ts`.

## Modelo implementado

Un proveedor tiene cero o muchos contactos. Cada contacto pertenece a un proveedor. Conservar el nombre de tabla solicitado y presentar el recurso como **Contactos** en la interfaz.

| Campo | Tipo propuesto | Regla |
|---|---|---|
| `id` | bigint autoincremental | PK; string en contratos TypeScript |
| `provider_id` | bigint | Obligatorio, FK a `providers.id`; índice para listar por proveedor |
| `name` | varchar(255) | Obligatorio; trim, rechazar texto vacío y conservar mayúsculas |
| `phone` | jsonb | Lista ordenada, default `[]`; estructura validada |
| `email` | varchar(254), nullable | Opcional; validar formato, vacío normalizado a null |
| `schedule` | jsonb | Horario propio del contacto, objeto de días, default `{}`; estructura validada |
| `description` | text, nullable | Comentario opcional; límite de longitud en el contrato |
| `is_active` | boolean | Default true |
| `version` | integer | Default 1; control de edición concurrente |
| `creation_key` | uuid | Clave interna de creación; única dentro del proveedor |
| `creation_hash` | char(64) | Huella interna del payload normalizado; no expuesta |
| `created_at` | timestamptz | Generado por servidor |
| `updated_at` | timestamptz | Actualizado por servidor |

Integridad implementada: FK con borrado restringido y desactivación como operación habitual. Desactivar un proveedor no borra ni modifica automáticamente sus contactos. No se impone unicidad de nombres, emails o teléfonos entre contactos: distintas personas pueden compartir datos de una oficina. Índices `(provider_id, id)` y único `(provider_id, creation_key)`.

### Teléfonos

Sustituir el objeto con claves `primary`, `secondary`, `thirtary`, etc. por una lista. Las claves ordinales obligan a renombrar al borrar y acoplan la persistencia al número de campos de la UI. La posición preserva el orden sin ese problema.

```json
[
  { "number": "+56987654321" },
  { "number": "+56223456789" }
]
```

Guardar el número como string internacional normalizado; el prefijo y la parte nacional son controles del formulario, no dos fuentes de verdad adicionales. `+56` es el prefijo de país. La validación debe contemplar números móviles y fijos, no limitar todo a móviles chilenos. Rechazar duplicados normalizados dentro de un contacto.

La primera fila vacía permite empezar a escribir, pero no obliga a ingresar teléfono. Una fila totalmente vacía no se persiste; una fila parcialmente ingresada o inválida impide guardar. Agregar otra fila solo cuando las actuales estén completas y sean válidas. Permitir quitar filas. Los límites de cantidad y longitud deben ser iguales en Client y Server.

El botón de WhatsApp usa `https://web.whatsapp.com/send?phone=<dígitos internacionales>`, sin enviar mensajes automáticamente ni afirmar que ese número tiene cuenta. Se verificaron los enlaces generados en navegador. El botón de email abre el cliente de correo mediante `mailto:`; no representa un envío completado.

### Horarios

El horario semanal pertenece a cada contacto, confirmado por el usuario el 2026-10-05. Se propone una estructura con claves estables independientes del idioma. Los días sin configuración no tienen visita definida. No generar horarios vacíos al expandir el formulario.

```json
{
  "monday": [
    { "from": "09:00", "to": "12:00", "description": "Visita del vendedor" }
  ],
  "thursday": [
    { "from": "14:00", "to": "17:00" }
  ]
}
```

Usar listas de rangos permite ampliar a mañana y tarde sin cambiar el formato persistido. Esta versión admite como máximo un rango por día, en Client y Server; se validan días permitidos, horas `HH:mm`, inicio y fin completos e inicio anterior a fin. Los rangos nocturnos y múltiples rangos requieren una decisión de producto antes de incluirlos. Son horas locales semanales de Chile (`America/Santiago`), no fechas UTC ni desplazamientos fijos; el cambio estacional conserva la hora de visita local.

## Interfaz implementada

En detalle de negocio → tab Proveedores, cada fila tiene la acción **Contactos** debajo del nombre. Abre un listado paginado de nombre, teléfonos, email, resumen de horarios, estado y acciones, dentro del mismo tab y con botón Volver. El listado de proveedores conserva su búsqueda y página. Se consulta únicamente el proveedor seleccionado, sin N+1; el código de contactos y la validación telefónica se cargan mediante `lazy`/`Suspense` al abrir el apartado.

El formulario independiente de contacto reutiliza `BaseModal` en tamaño amplio, con datos generales, teléfonos repetibles, email, acordeón de horarios, comentario y switch de activo. Un único scroll vertical en el cuerpo conserva accesibles el encabezado y Guardar/Cancelar. En móvil, campos apilados y acciones principales de ancho completo; tabla con scroll horizontal y mínimo de 650px. Mantener tema claro/oscuro, teclado, etiquetas accesibles y traducciones ES/EN.

Aplicar los estados del proyecto: skeleton inicial solo para contenido, revalidación sutil conservando datos, estados vacíos y errores con reintento. Bloquear controles durante peticiones; éxito/error mediante `sileo`, también al copiar. Ante error de guardado, conservar el modal abierto y todos sus campos. Colapsar horarios no elimina sus datos ni oculta errores de validación: expandir la sección si contiene un error.

## Contrato implementado

Recurso vertical `nodia-server/src/provider-contact/`, registrado en AppModule, con DTOs anidados y casos de uso. Conserva autenticación global y el alcance vigente de [19](19-prelaunch-review.md). IDs bigint como strings; rechazar cero, negativos o valores fuera del rango de PostgreSQL. No acepta propiedades arbitrarias dentro de teléfonos, días o rangos.

| Método y ruta, bajo `/api/v1` | Entrada / resultado |
|---|---|
| `GET /providers/:providerId/contacts` | `page` ≥ 1, `limit` 1–100 (default 25), `search` hasta 255 caracteres; `{data, meta}` |
| `POST /providers/:providerId/contacts` | Valores del contacto + `request_key` UUID v4; devuelve entidad y `version` |
| `PUT /providers/:providerId/contacts/:id` | Reemplazo completo de valores + `version` esperada |
| `PATCH /providers/:providerId/contacts/:id/status` | `{is_active, version}`; conserva los demás valores |

Valores: nombre requerido hasta 255; máximo 10 teléfonos válidos E.164 sin extensiones ni duplicados internos; email opcional hasta 254; comentario hasta 2000; descripción de visita hasta 255; días `monday` a `sunday`. Campos opcionales omitidos/vacíos se normalizan a `[]`, `{}` o `null`; no se convierte el nombre a minúsculas. Errores de validación/paginación 400, relación inexistente 404 y conflicto 409.

La creación usa unicidad de clave + hash normalizado: reintentos iguales recuperan el contacto, aunque se pierda la respuesta HTTP; reutilizar la clave con otros datos devuelve 409. La edición compara `version` atómicamente e incrementa una vez; un replay idéntico de la versión inmediatamente anterior recupera el resultado. Cambios concurrentes diferentes devuelven 409. El modal conserva datos y bloquea edición ante un resultado incierto, ofreciendo **Verificar guardado** con la misma intención; conflictos requieren reabrir la versión vigente. Las claves internas no se exponen en respuestas.

## Evidencia local — 2026-10-05

- Client: suite completa 841 pruebas / 147 archivos; después del ajuste de carga diferida y etiquetas, 46 pruebas del área de proveedores pasan; typecheck, lint y build correctos. El chunk BusinessDetail baja de aproximadamente 434 kB a 215 kB y Contactos queda separado (221 kB, sin comprimir).
- Server: suite completa 561 pruebas / 97 archivos; 33 pruebas de casos de uso de contactos pasan tras revisar explícitamente el rechazo de duplicados. Build y lint correctos, con siete warnings anteriores ajenos a contactos.
- `npm run test:provider-contacts:integration`: migración up/down/up y HTTP real sobre PostgreSQL 16 temporal. Comprueba autenticación sintética, asociación al proveedor, paginación, validación anidada, creación concurrente/replay, edición concurrente, desactivación conservando horarios, vaciado opcional, búsqueda literal y FK de borrado restringido.
- Navegador con ProvidersTab real → NestJS → PostgreSQL temporal: alta con dos teléfonos, edición de horario propio, rechazo de fin anterior al inicio, conservación y recuperación tras respuesta perdida con una sola fila persistida. Inspección de WhatsApp/mailto y copia; revisión de escritorio y móvil 390×844, ES/EN, claro/oscuro. Modal con un scroll, pie visible y sin desbordamiento de página.
- Dependencia exacta `libphonenumber-js` 1.13.14 en ambos proyectos. Auditoría Client sin alertas; Server mantiene nueve alertas en otras dependencias (dos bajas, una moderada y seis altas), fuera del alcance de esta ampliación.

La verificación inicial usó fixtures y autenticación de prueba, sin modificar la BD configurada. Posteriormente se aplicó únicamente la migración de contactos en la BD local para corregir el endpoint; evidencia a continuación. `migration:run` ejecuta todas las pendientes, por lo que no debe tratarse como una operación exclusiva de contactos sin revisar el inventario.

## Incidencia de endpoints y operación local — 2026-10-05

- Facturas: `GET /api/v1/invoices?q[business_id_eq]=<UUID>&limit=1` respondía 400. El DTO transformado creaba campos opcionales `undefined`; Ransack intentaba resolver los filtros especiales de fecha como columnas antes de comprobar ausencia. El compilador ahora omite únicamente `undefined` antes de resolver claves; filtros desconocidos explícitos siguen rechazados. Cinco regresiones de caso de uso con DTO/servicio/QueryBuilder reales; suite completa Server: 566 pruebas / 97 archivos, build/lint correctos (siete warnings previos).
- Contactos: `GET /api/v1/providers/4/contacts?page=1&limit=25&search=` fallaba porque `personal_info_provider` no existía en `nodia_db`. Se comprobó proveedor 4 existente, baseline `providers.id bigint` y tabla de historial vacía. No era un rechazo de `search=`: la búsqueda vacía es válida.
- Respaldo previo PostgreSQL en formato custom: `nodia-server/.temp/backups/before-provider-contacts-2026-10-05T23-27-16.569Z.dump`, 109582 bytes, archivo legible por `pg_restore --list`, fuera de Git. No se afirma una restauración completa por comprobar el inventario.
- Comando específico `npm run migration:provider-contacts`: revisa baseline y ejecuta solo `CreateProviderContacts1791220000000` en transacción. Aplicado en la BD local configurada; historial contiene únicamente esta migración. Segunda ejecución confirma que ya está aplicada. No se ejecutaron las migraciones pendientes de Finanzas/Reservas.
- Smoke HTTP con controladores compilados, parser/ValidationPipe reales y conexiones a la BD local en modo de solo lectura: ambos URLs reportados devuelven 200; facturas `limit=1`, total 15; contactos del proveedor 4, total 0. Se usa guard sintético en un servidor temporal ligado a localhost, cerrado al finalizar; no modifica ni sustituye la autenticación del servidor de desarrollo. No equivale a comprobar la sesión real del navegador. Reiniciar un proceso sin watch para cargar el cambio Ransack.

## Pendientes

- Smoke con sesión real y aplicación en otros entornos; despliegue. BD local configurada ya migrada.
- Revisión documental explícita. El permiso de implementar no marca documentos como aprobados.
- Cargo/función y múltiples rangos o cruces de medianoche siguen fuera del esquema confirmado.
