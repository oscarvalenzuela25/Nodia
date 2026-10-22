# AI-38 — selector de propietario: filtro de usuario exacto

Hallazgo independiente de la ventana autenticada. La [proyección nginx acotada](nodia-ai-ai38-users-scope-http-metadata-r01.json) observó un `GET /users` con filtro `id_eq` rechazado con 400, frente a cuatro 200 y un 304 sin ese filtro. Sólo se conservaron método, endpoint clasificado, estado y presencia del filtro; no queries, identidades, cuerpos, tokens o logs crudos.

El [selector compartido](../../nodia-client/src/components/UserScopeSelect/infrastructure/services.ts) busca por separado el propietario seleccionado mediante `q[id_eq]`. [UserFilterDto](../../nodia-server/src/user/dto/filter-user.dto.ts) omitía ese campo; el pipe global estricto lo rechazaba antes de llegar a Ransack. El listado general podía funcionar, pero `selected.isError` producía el botón «Reintentar». La política Ransack ya contemplaba el campo público `id` y su validación bigint.

La corrección de fuente añade únicamente `id_eq?: string` con `IsOptional` e `IsString`. No se relaja la whitelist, no se añaden permisos, endpoints, servicios o migraciones. Los predicados y la parametrización siguen en el compilador existente. No se convirtió el identificador a Number.

[Regresión del caso de uso](../../nodia-server/src/user/use-case/get-all-users.use-case.spec.ts):12/12 pruebas correctas, ocho nuevas. Recorren el pipe real, GetAllUsersUseCase, UserService y SQL TypeORM/Ransack sin conexión de red; sólo el terminal de lectura se simula. El identificador 9007199254740993 se conserva exacto; lista sin filtro, campos desconocidos, arrays/objetos/números, inyección textual y overflow bigint quedan cubiertos. La prueba positiva fallaba antes con 400. La ejecución preliminar tuvo 9 correctas/3 fallidas, conservada fuera de publicación; dos negativas aún esperaban una etapa posterior al rechazo del pipe. La suite final conserva esas validaciones en la etapa correspondiente.

Build local correcto y lint sin errores, con tres warnings históricos. [Resumen verificable y pins](nodia-ai-ai38-users-scope-fix-r01.json).

## Paquete y aceptación

El paquete operativo R02 congelado **no contiene esta corrección**. Su manifiesto conserva SHA-256 `c8f49aa3adb21f63da4d75f84a811ab3b758e90ce57fe8aff2e8d2fc498256ae`; el DTO fuente congelado tiene hash `97dc28dd5cc2ac5e8541ef74a1790c34d9366684103ff793e760c2a1142f2bb4` y el output JS `7eec6fa949992026561c97cd129b6cffd8f220212012a774761d6d7f478faa70`. No se modificó ese paquete ni se reiniciaron servicios. Falta adoptar un sucesor y verificar el selector en UI; este hallazgo no invalida por sí solo una operación sobre el dueño actual derivado del contexto por defecto.

## Impacto en conocimiento NodiaAI

Revisada la [ficha de Usuarios](../nodia-ai/knowledge/general-settings/features/users.md). El cambio restablece el contrato nativo usado por el selector; no cambia las capacidades descritas ni la autoridad. La ficha aprobada no referencia este DTO como fuente fijada. El esquema MCP `UserQuery` continúa cerrado y no admite `id_eq`: añadirlo al HTTP no lo publica para `nodia_users_list`. No se modificaron ficha aprobada, registry, fuentes runtime de publicación ni fragmentos; build conserva release `4189005373b4e6040a0e441d21c2978fe1d423ae568e53f74df1592e6f900130`. Una futura ampliación del filtro MCP requeriría contrato, catálogo y publicación propios.
