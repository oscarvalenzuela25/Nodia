# QA aislado del topbar

Ejecutar Vite en un origen aislado y abrir `/src/test/manual/topbar-health/index.html?lang=es&theme=dark`.

Fixture sintético: rol super_admin sin acciones, proveedor predeterminado con API deshabilitada, Web disponible y Agentic indisponible. El adapter Axios local impide contactar servicios reales. No abrir en el origen de una sesión de usuario.

Verificar 320/390/600/1280 px, ES/EN y claro/oscuro: tres etiquetas visibles, indicadores gris/verde/rojo, botones de 44 px de alto, sin overflow ni intersección con idioma/tema/avatar. API no navega; Web/Agentic abren el ID 900 y modo exactos. Esta entrada no ejecuta inferencia ni acredita disponibilidad real.
