# QA de Core

Usar [la cuenta y el entorno de la ronda](README.md#ejecución). Preparar un
grupo sintético y registros identificables de catálogo sólo en entorno
aislado. Guardar el orden y las preferencias iniciales para restaurarlos al
cerrar. Los casos de esta suite son manuales. La configuración de IA se
verifica en [Proveedores de IA](ProveedoresIA.md).

## Casos

| Caso | Preparación y pasos | Resultado y evidencia |
| --- | --- | --- |
| CORE-01 Inicio y sesión | En un perfil sin sesión, abrir `/`, luego `/users` por URL y entrar como `super_admin` por Login. Abrir Usuarios, recargar y salir desde el avatar. | Inicio está disponible al visitante. La ruta protegida lleva a Login antes de montar Usuarios. La sesión validada restablece acceso al recargar. Después de salir, reabrir `/users` vuelve a pedir sesión. Registrar rutas y estados de sesión. |
| CORE-02 Navegación y rutas canónicas | Con la cuenta autenticada, abrir Usuarios, Roles, Acciones y Módulos desde el menú. Abrir `/general-settings/users?qa=routes#qa` como alias documentado. Contrastar el destino de NodiaAI con su entrada directa. | El menú y la URL llevan a `/users`, `/roles`, `/actions`, `/modules` y `/nodia-ai`. El alias de Usuarios conserva consulta y fragmento al resolver `/users`. Registrar destino visible y código de respuesta de las lecturas pertinentes. |
| CORE-03 Catálogos y filtros | Preparar registros activo e inactivo en un catálogo Core compatible. Buscar por un término único, aplicar Inactivo, luego Todos y limpiar. Cambiar tamaño de página con suficientes filas. | El estado inicial y el restablecido son Activo. Cada opción devuelve el conjunto y total esperados. Cambiar filtros reinicia el paginado. Registrar controles, estados y cantidad de filas. |
| CORE-04 Administración aislada | En Módulos, anotar el orden original. Mover un grupo sintético y un módulo, recargar, restaurar el orden y volver a recargar. Verificar la ruta del módulo y la disposición del menú. | La tabla y el menú aplican el nuevo orden y lo recuperan tras recargar. El destino canónico y las asignaciones conservan su identidad. Registrar orden antes, después y tras restaurar. |
| CORE-05 Recuperación y borrador | En el entorno aislado, simular un fallo conocido de guardado de un formulario Core con datos sintéticos. Editar el dato y guardar correctamente. En otra entrada, simular API indisponible durante la restauración de sesión y recuperar la lectura. | El fallo muestra feedback y conserva el borrador y el formulario. La corrección guarda una vez. La restauración muestra el estado recuperable y habilita la página tras una lectura correcta. Registrar efectos y peticiones. |
| CORE-06 Topbar y móvil | En escritorio y una ventana móvil, cambiar paleta y modo claro/oscuro por separado, recargar y abrir un destino desde el menú. Comprobar contraste, foco, contenido horizontal y volver a la preferencia anterior. | Color y modo se conservan de forma independiente en el navegador. El destino abre correctamente con el layout y los atajos disponibles para la cuenta. Registrar navegador, tamaño y controles verificados. |

[Autenticación](../mvp/14-authentication.md) ·
[Rutas canónicas](../architecture/decisions/ADR-092-stable-module-navigation-routes.md) ·
[Catálogos Core y orden](../mvp/87-core-feedback-module-order-plan.md) ·
[Atajos móviles](../mvp/35-mobile-cards-shortcuts-plan.md) ·
[Temas](../mvp/108-user-theme-presets.md).
