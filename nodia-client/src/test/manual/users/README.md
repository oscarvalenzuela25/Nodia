# QA aislada de Usuarios

Con Vite, abrir `/src/test/manual/users/index.html?theme=dark&lang=es`. Datos sintéticos y adaptador Axios local; no modifica cuentas reales.

Probar 320/390/599/600/1280 px, ES/EN y claro/oscuro. Activos por defecto; quitar chip muestra todos y Limpiar restaura activos. Comparar página tras redimensionar. ID bigint exacto, correo/nombres/asignaciones largos y nombre ausente. Actualizar y activar/desactivar conservan los formularios existentes. `failUpdate=1` falla la primera modificación y permite reintento; `empty=1` y `error=1` verifican estados diferentes.
