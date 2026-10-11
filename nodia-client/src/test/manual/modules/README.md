# QA aislada de Módulos

Ejecutar Vite y abrir `/src/test/manual/modules/index.html?theme=dark&lang=es`.
Todos los registros son sintéticos y el adaptador Axios intercepta todas las peticiones. No modifica servicios ni registros reales.

- Probar 320/390/599/600/1280 px y ES/EN, claro/oscuro.
- Activos por defecto; Inactivos/Todos conservan búsqueda y reinician página.
- Menú Eliminar: cancelar no escribe; grupo ocupado (incluidos inactivos) conserva confirmación con error; grupo vacío desaparece.
- `failDelete=1`: el primer DELETE de módulo falla; se conserva el modal y el segundo intento funciona.
- Paginación mantiene registros al revalidar y usa las mismas consultas al cambiar de tamaño.
