# QA aislada de Módulos

Ejecutar Vite y abrir `/src/test/manual/modules/index.html?theme=dark&lang=es`.
Todos los registros son sintéticos y el adaptador Axios intercepta todas las peticiones. No modifica servicios ni registros reales.

- Probar 320/390/599/600/1280 px y ES/EN, claro/oscuro.
- Activos por defecto; Inactivos/Todos conservan búsqueda y reinician página.
- Menú Eliminar: cancelar no escribe; grupo ocupado (incluidos inactivos) conserva confirmación con error; grupo vacío desaparece.
- `failDelete=1`: el primer DELETE de módulo falla; se conserva el modal y el segundo intento funciona.
- Paginación mantiene registros al revalidar y usa las mismas consultas al cambiar de tamaño.

FX-03: usar Vite en un puerto libre y modo QA, sin reemplazar la app de uso:

```powershell
npm run dev -- --host 127.0.0.1 --port 5186 --mode qa-modules
```

Abrir `http://127.0.0.1:5186/src/test/manual/modules/index.html?theme=dark&lang=es`.

- Botón Ordenar: Todos sin filtros parciales; Terminar restaura filtros normales. Cada flecha guarda al resolver.
- Subir/Bajar módulo y grupo, observar el nuevo orden del sidenav después de releer `/authorization/context`.
- El grupo Administración tiene once módulos, por lo que cruza la página de diez. Herramientas contiene uno; Grupo vacío permite ordenar grupos sin crear hijos.
- Extremos reales deshabilitados; el primer/último elemento de una página no necesariamente es extremo del grupo.
- `failMove=conflict`: primera operación simula cambio concurrente y409; releer antes de otra intención.
- `failMove=timeout`: primera operación se aplica y pierde su respuesta; no reenviar automáticamente.
- `failMove=invalid`: primera operación se aplica pero devuelve respuesta incompleta; recuperar mediante lecturas.
- `failRecovery=1` junto con failMove: la primera lectura de recuperación falla; conservar bloqueo/reintento.
- `missingMetadata=1`: omite metadata y deshabilita las flechas sin inventar vecinos.

Los fallos y cambios anteriores sólo afectan arrays sintéticos del documento QA. Una recarga reinicia la fixture. No acredita autenticación real, permisos backend ni persistencia SQL.
