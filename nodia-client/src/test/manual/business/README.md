# Negocios · QA sintética

Abrir `/src/test/manual/business/index.html` con Vite. Rutas y componentes reales; Axios intercepta todas las peticiones y rechaza operaciones desconocidas. No escribe en BD ni consume IA.

Parámetros: `theme=dark|light`, `lang=es|en`, `list=1`, `empty=1`, `error=products|providers|invoices` (primer GET falla, reintento funciona), `failSave=1` (primera actualización de negocio falla). Filtros y paginación aplicados en transporte. Comprobar cinco pestañas, contactos, formularios y últimas páginas.
