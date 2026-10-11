# QA aislada de Acciones

Con Vite, abrir `/src/test/manual/actions/index.html?theme=dark&lang=es`. Todos los datos y el transporte son sintéticos; no modifica acciones reales.

Probar 320/390/599/600/1280px, ambos idiomas/temas, ambos listados y vistas. Activos por defecto, filtro negocio Activos/Inactivos/Todos y chip general. Menú eliminar con icono error.main y confirmación; `failDelete=1` falla la primera eliminación y permite reintento, `empty=1` y `error=1` separan estados. Página conservada al redimensionar, edición y copia del ID bigint completo.
