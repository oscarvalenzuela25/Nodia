# QA aislado del topbar

Ejecutar Vite en un origen aislado y abrir `/src/test/manual/topbar-health/index.html?access=business&lang=es&theme=dark#qa`.

`access=business` simula un usuario con sólo el módulo Negocios. Omitir ese parámetro activa el perfil sintético super_admin. Ambos tienen API key configurada y Agentic indisponible. El adapter Axios local impide contactar servicios reales y registra en `#root[data-qa-requests]` sólo método y ruta. Usar un origen aislado de sesiones reales.

Verificar 320/599/600/1440 px, ES/EN y claro/oscuro. API key y Agentic deben quedar visibles y alcanzables sin desbordamiento ni cruce con idioma, tema o avatar. En Negocios son estados de solo lectura y la actualización hace un GET adicional a `/ai-providers/topbar-status`. Como super_admin los indicadores abren el ID 900 y el modo correspondiente. «Actualizar información» en el avatar debe recargar la página preservando ruta, parámetros y fragmento. Esta entrada no ejecuta inferencia ni acredita disponibilidad real.
